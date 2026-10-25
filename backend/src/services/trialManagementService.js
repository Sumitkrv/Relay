import TrialGrant from '../models/TrialGrant.js';
import Subscription from '../models/Subscription.js';
import planCatalogService from './planCatalogService.js';

class TrialManagementService {
  /**
   * Starts a 14-day Free Exploration trial for a workspace.
   * Enforces server-side one-time grant rule and prevents abuse.
   */
  async startTrial(workspaceId, user) {
    if (!workspaceId) throw new Error('Workspace ID is required.');
    const userId = user && (user._id || user);
    if (!userId) throw new Error('User context is required.');

    // 1. Abuse Check: Check existing grant for workspace
    const existingWsGrant = await TrialGrant.findOne({ workspaceId });
    if (existingWsGrant) {
      const err = new Error('This workspace already has an active or previous trial.');
      err.code = 'TRIAL_ALREADY_GRANTED';
      err.status = 409;
      throw err;
    }

    // 2. Abuse Check: Check if user already claimed trial on another workspace (strict 1 per owner)
    const existingUserGrant = await TrialGrant.findOne({ ownerUserId: userId });
    if (existingUserGrant) {
      const err = new Error('Account owner has already utilized free trial eligibility.');
      err.code = 'TRIAL_ALREADY_USED_BY_USER';
      err.status = 409;
      throw err;
    }

    // 3. Calculate 14-day window using canonical server timestamps
    const trialDays = 14;
    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);

    // 4. Record TrialGrant document
    const grant = await TrialGrant.create({
      workspaceId,
      ownerUserId: userId,
      trialStartedAt: now,
      trialEndsAt,
      trialDays,
      status: 'ACTIVE',
    });

    // 5. Upsert Subscription to TRIALING
    const freePlan = await planCatalogService.getPlan('free_exploration');
    const subscription = await Subscription.findOneAndUpdate(
      { workspaceId },
      {
        $set: {
          ownerUserId: userId,
          planKey: 'free_exploration',
          planVersion: freePlan.version || 1,
          provider: 'MOCK',
          internalStatus: 'TRIALING',
          currency: 'INR',
          amountMinor: 0,
          trialStartedAt: now,
          trialEndsAt,
          currentPeriodStart: now,
          currentPeriodEnd: trialEndsAt,
          lastReconciledAt: now,
        },
      },
      { upsert: true, new: true }
    );

    return {
      success: true,
      trialGrant: grant,
      subscription,
      message: '14-day Free Exploration trial activated successfully.',
    };
  }

  /**
   * Evaluates and updates trial status if the 14-day period has elapsed.
   */
  async checkAndExpireTrial(workspaceId) {
    const sub = await Subscription.findOne({ workspaceId });
    if (!sub) return null;

    if (sub.internalStatus === 'TRIALING' && sub.trialEndsAt && sub.trialEndsAt < new Date()) {
      sub.internalStatus = 'TRIAL_EXPIRED';
      await sub.save();

      await TrialGrant.updateOne(
        { workspaceId, status: 'ACTIVE' },
        { $set: { status: 'EXPIRED' } }
      );
    }

    return sub;
  }

  /**
   * Retrieves trial details and remaining duration for a workspace.
   */
  async getTrialDetails(workspaceId) {
    const grant = await TrialGrant.findOne({ workspaceId }).lean();
    if (!grant) {
      return { hasTrial: false, isEligible: true };
    }

    const now = Date.now();
    const endsAtTime = new Date(grant.trialEndsAt).getTime();
    const msRemaining = Math.max(0, endsAtTime - now);
    const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
    const isExpired = grant.status === 'EXPIRED' || msRemaining <= 0;

    return {
      hasTrial: true,
      status: isExpired ? 'EXPIRED' : grant.status,
      isExpired,
      daysRemaining,
      trialStartedAt: grant.trialStartedAt,
      trialEndsAt: grant.trialEndsAt,
    };
  }

  /**
   * Returns current trial status and remaining days.
   */
  async getTrialStatus(workspaceId) {
    await this.checkAndExpireTrial(workspaceId);
    const details = await this.getTrialDetails(workspaceId);
    const sub = await Subscription.findOne({ workspaceId }).lean();
    return {
      ...details,
      status: sub?.internalStatus || (details.isExpired ? 'TRIAL_EXPIRED' : (details.hasTrial ? 'TRIALING' : 'NO_SUBSCRIPTION'))
    };
  }
}

export default new TrialManagementService();
