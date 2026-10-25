import Subscription from '../models/Subscription.js';
import BillingPayment from '../models/BillingPayment.js';
import Workspace from '../models/Workspace.js';
import planCatalogService from './planCatalogService.js';
import razorpayClientService from './razorpayClientService.js';
import trialManagementService from './trialManagementService.js';
import workspaceEntitlementService from './workspaceEntitlementService.js';
import usageQuotaService from './usageQuotaService.js';
import billingNotificationService from './billingNotificationService.js';

class SubscriptionService {
  _parseArgs(arg1, arg2, arg3) {
    if (typeof arg1 === 'object' && arg1 !== null && !arg1._bsontype && arg1.workspaceId) {
      const workspaceId = arg1.workspaceId;
      const user = arg1.user || (arg1.userId ? { _id: arg1.userId } : null);
      return { workspaceId, user, options: arg1 };
    }
    const user = arg2 && (arg2._id ? arg2 : { _id: arg2 });
    return {
      workspaceId: arg1,
      user,
      options: arg3 || {}
    };
  }

  /**
   * Creates a Razorpay subscription checkout session for a workspace.
   */
  async createSubscription(arg1, arg2, arg3) {
    const { workspaceId, user, options } = this._parseArgs(arg1, arg2, arg3);
    const planKey = options.planKey || 'relay_solo';

    if (!workspaceId) throw new Error('Workspace ID is required.');
    if (!user || !user._id) throw new Error('User context is required.');

    const plan = await planCatalogService.getPlan(planKey);
    if (!plan || !plan.isActive) {
      const err = new Error(`Selected plan "${planKey}" is not available for purchase.`);
      err.status = 400;
      err.code = 'INVALID_PLAN';
      throw err;
    }

    // Check existing subscription
    let subscription = await Subscription.findOne({ workspaceId });
    if (subscription && subscription.internalStatus === 'ACTIVE') {
      return {
        alreadyActive: true,
        message: 'Workspace already has an active subscription.',
        subscription,
      };
    }

    const providerPlanId = plan.providerPlanIdTest || 'plan_test_solo_799';

    // Call Razorpay API to generate provider subscription
    const rzpSub = await razorpayClientService.createSubscription({
      planId: providerPlanId,
      totalCount: 12, // 12 monthly recurring cycles
      customerNotify: 1,
      notes: {
        workspaceId: workspaceId.toString(),
        ownerUserId: user._id.toString(),
        planKey: plan.planKey,
      },
    });

    // Upsert local pending subscription
    subscription = await Subscription.findOneAndUpdate(
      { workspaceId },
      {
        $set: {
          ownerUserId: user._id,
          planKey: plan.planKey,
          planVersion: plan.version || 1,
          provider: 'RAZORPAY',
          providerSubscriptionId: rzpSub.id,
          providerPlanId,
          billingEnvironment: 'TEST',
          providerStatus: 'created',
          internalStatus: 'CHECKOUT_PENDING',
          currency: plan.currency,
          amountMinor: plan.amountMinor,
          taxTreatment: plan.taxTreatment,
          cancelAtPeriodEnd: false,
          lastReconciledAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    const keyId = razorpayClientService.getPublicConfig().keyId;
    const subObj = subscription.toObject ? subscription.toObject() : subscription;
    subObj.keyId = keyId;

    return {
      success: true,
      subscriptionId: rzpSub.id,
      amountMinor: plan.amountMinor,
      currency: plan.currency,
      planName: plan.displayName,
      keyId,
      subscription: subObj,
    };
  }

  /**
   * Verifies the client authorization callback from Razorpay Subscriptions checkout.
   */
  async verifyCheckout(arg1, arg2, arg3) {
    const { workspaceId, user, options } = this._parseArgs(arg1, arg2, arg3);
    const paymentId = options.paymentId || options.razorpay_payment_id;
    const subscriptionId = options.subscriptionId || options.razorpay_subscription_id;
    const signature = options.signature || options.razorpay_signature;

    if (!paymentId || !subscriptionId || !signature) {
      const err = new Error('Missing paymentId, subscriptionId, or signature.');
      err.status = 400;
      throw err;
    }

    // 1. Authoritative ownership check
    const subscription = await Subscription.findOne({ workspaceId, providerSubscriptionId: subscriptionId });
    if (!subscription) {
      const err = new Error('Subscription ID does not match the active workspace record. Cross-tenant tampering blocked.');
      err.status = 403;
      err.code = 'WORKSPACE_MISMATCH';
      throw err;
    }

    // 2. Cryptographic signature check
    const isValid = razorpayClientService.verifySubscriptionSignature({
      paymentId,
      subscriptionId,
      signature,
    });

    if (!isValid) {
      const err = new Error('Invalid payment authorization signature.');
      err.status = 400;
      err.code = 'INVALID_CHECKOUT_SIGNATURE';
      throw err;
    }

    // 3. Mark Subscription Active
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    subscription.internalStatus = 'ACTIVE';
    subscription.providerStatus = 'active';
    subscription.startedAt = subscription.startedAt || now;
    subscription.currentPeriodStart = now;
    subscription.currentPeriodEnd = periodEnd;
    subscription.lastPaidAt = now;
    subscription.cancelAtPeriodEnd = false;
    subscription.lastReconciledAt = now;
    await subscription.save();

    // 4. Record captured payment
    await BillingPayment.findOneAndUpdate(
      { providerPaymentId: paymentId },
      {
        $setOnInsert: {
          workspaceId,
          subscriptionId: subscription._id,
          providerPaymentId: paymentId,
          amountMinor: subscription.amountMinor,
          currency: subscription.currency,
          status: 'captured',
          paymentMethod: 'mandate',
          paidAt: now,
          billingPeriodStart: now,
          billingPeriodEnd: periodEnd,
          billingEnvironment: 'TEST',
        },
      },
      { upsert: true }
    );

    // 5. Send receipt notice
    const workspace = await Workspace.findById(workspaceId).lean();
    if (user?.email) {
      await billingNotificationService.sendPaymentSuccessNotification({
        email: user.email,
        businessName: workspace?.name || 'Your Business',
        amountMinor: subscription.amountMinor,
        planName: 'Relay Solo',
        invoiceId: `inv_${paymentId}`,
      });
    }

    return {
      success: true,
      status: 'ACTIVE',
      subscription,
      message: 'Payment verified and Relay Solo subscription activated.',
    };
  }

  /**
   * Cancels a subscription safely.
   */
  async cancelSubscription(arg1, arg2, arg3) {
    const { workspaceId, user, options } = this._parseArgs(arg1, arg2, arg3);
    const cancelAtPeriodEnd = options.cancelAtPeriodEnd !== false && !options.cancelImmediately;
    const reason = options.reason || 'USER_CANCELLED';

    const subscription = await Subscription.findOne({ workspaceId });
    if (!subscription) {
      const err = new Error('No active subscription found to cancel.');
      err.status = 404;
      throw err;
    }

    if (user && subscription.ownerUserId && subscription.ownerUserId.toString() !== (user._id || user).toString()) {
      const err = new Error('Unauthorized: Only the workspace owner can cancel this subscription.');
      err.status = 403;
      throw err;
    }

    if (subscription.providerSubscriptionId) {
      await razorpayClientService.cancelSubscription(subscription.providerSubscriptionId, cancelAtPeriodEnd);
    }

    const now = new Date();
    if (cancelAtPeriodEnd) {
      subscription.cancelAtPeriodEnd = true;
      subscription.internalStatus = 'CANCEL_AT_PERIOD_END';
      subscription.cancellationRequestedAt = now;
      subscription.cancellationReason = reason;
      await subscription.save();
    } else {
      subscription.internalStatus = 'CANCELLED';
      subscription.cancelledAt = now;
      subscription.cancellationReason = reason;
      await subscription.save();
    }

    const workspace = await Workspace.findById(workspaceId).lean();
    if (user?.email) {
      await billingNotificationService.sendCancellationConfirmedNotification({
        email: user.email,
        businessName: workspace?.name || 'Your Business',
        accessEndsAt: subscription.currentPeriodEnd || now,
      });
    }

    return {
      success: true,
      subscription,
      message: cancelAtPeriodEnd
        ? 'Subscription scheduled for cancellation at end of billing cycle. Access remains active until paid-through date.'
        : 'Subscription cancelled immediately.',
    };
  }

  /**
   * Re-subscribes a cancelled or expired workspace.
   */
  async resubscribe(arg1, arg2, arg3) {
    return this.createSubscription(arg1, arg2, arg3);
  }

  /**
   * Grants an explicit legacy entitlement for migration baseline workspaces (e.g. M2W Realty).
   */
  async grantLegacyEntitlement(arg1, arg2, arg3) {
    const { workspaceId, user, options } = this._parseArgs(arg1, arg2, arg3);
    const reason = options.reason || 'M2W_MIGRATION_REFERENCE';
    const userId = user && (user._id || user);

    const sub = await Subscription.findOneAndUpdate(
      { workspaceId },
      {
        $set: {
          ownerUserId: userId,
          planKey: 'relay_solo',
          provider: 'LEGACY_MIGRATION',
          internalStatus: 'LEGACY_ENTITLED',
          providerStatus: 'legacy_active',
          currency: 'INR',
          amountMinor: 0,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          lastReconciledAt: new Date(),
          metadata: { grantReason: reason },
        },
      },
      { upsert: true, new: true }
    );

    return {
      success: true,
      subscription: sub,
      message: 'Legacy reference entitlement granted successfully.',
    };
  }

  /**
   * Aggregates billing overview data for the customer billing portal.
   */
  async getBillingOverview(workspaceId) {
    const [entitlement, usage, payments, trialDetails] = await Promise.all([
      workspaceEntitlementService.getWorkspaceEntitlements(workspaceId),
      usageQuotaService.getUsage(workspaceId),
      BillingPayment.find({ workspaceId }).sort({ paidAt: -1 }).limit(10).lean(),
      trialManagementService.getTrialDetails(workspaceId),
    ]);

    const subscription = await Subscription.findOne({ workspaceId }).lean();

    return {
      workspaceId,
      entitlement,
      usage,
      trialDetails,
      subscription,
      payments,
      publicConfig: razorpayClientService.getPublicConfig(),
    };
  }
}

export default new SubscriptionService();
