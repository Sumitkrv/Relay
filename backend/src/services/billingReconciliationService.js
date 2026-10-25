import Subscription from '../models/Subscription.js';
import razorpayClientService from './razorpayClientService.js';

class BillingReconciliationService {
  /**
   * Reconciles a single subscription with its provider state.
   */
  async reconcileSubscription(workspaceId) {
    const subscription = await Subscription.findOne({ workspaceId });
    if (!subscription || !subscription.providerSubscriptionId) {
      return { reconciled: false, reason: 'No provider subscription ID to reconcile.' };
    }

    try {
      const providerSub = await razorpayClientService.fetchSubscription(subscription.providerSubscriptionId);
      const now = new Date();

      if (providerSub && providerSub.status) {
        subscription.providerStatus = providerSub.status;
        if (providerSub.status === 'active') {
          subscription.internalStatus = 'ACTIVE';
          if (providerSub.current_start) {
            subscription.currentPeriodStart = new Date(providerSub.current_start * 1000);
          }
          if (providerSub.current_end) {
            subscription.currentPeriodEnd = new Date(providerSub.current_end * 1000);
          }
        } else if (providerSub.status === 'cancelled') {
          subscription.internalStatus = 'CANCELLED';
        } else if (providerSub.status === 'halted') {
          subscription.internalStatus = 'HALTED';
        }

        subscription.lastReconciledAt = now;
        await subscription.save();
      }

      return {
        reconciled: true,
        workspaceId,
        providerSubscriptionId: subscription.providerSubscriptionId,
        internalStatus: subscription.internalStatus,
        providerStatus: subscription.providerStatus,
      };
    } catch (err) {
      subscription.internalStatus = 'RECONCILIATION_REQUIRED';
      subscription.lastReconciledAt = new Date();
      await subscription.save();
      return { reconciled: false, error: err.message };
    }
  }

  /**
   * Runs periodic batch reconciliation for stale active subscriptions.
   */
  async reconcileStaleSubscriptions(staleThresholdHours = 24) {
    const cutoff = new Date(Date.now() - staleThresholdHours * 3600 * 1000);
    const staleSubscriptions = await Subscription.find({
      internalStatus: { $in: ['ACTIVE', 'AUTHORIZATION_PENDING', 'PAST_DUE'] },
      $or: [{ lastReconciledAt: null }, { lastReconciledAt: { $lt: cutoff } }],
    }).limit(50);

    const results = [];
    for (const sub of staleSubscriptions) {
      const res = await this.reconcileSubscription(sub.workspaceId);
      results.push(res);
    }
    return results;
  }
}

export default new BillingReconciliationService();
