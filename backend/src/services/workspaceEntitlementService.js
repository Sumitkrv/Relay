import Subscription from '../models/Subscription.js';
import Workspace from '../models/Workspace.js';
import planCatalogService from './planCatalogService.js';
import trialManagementService from './trialManagementService.js';

class WorkspaceEntitlementService {
  /**
   * Resolves the comprehensive entitlement state for a workspace.
   */
  async getWorkspaceEntitlements(workspaceId) {
    if (!workspaceId) throw new Error('Workspace ID is required.');

    // Auto-expire trial if overdue
    await trialManagementService.checkAndExpireTrial(workspaceId);

    const subscription = await Subscription.findOne({ workspaceId }).lean();
    const workspace = await Workspace.findById(workspaceId).lean();

    // Default: Unsubscribed state
    if (!subscription) {
      return {
        workspaceId,
        hasActiveAccess: false,
        planKey: 'none',
        displayName: 'No Subscription',
        internalStatus: 'NO_SUBSCRIPTION',
        isTrial: false,
        canCreateCampaign: false,
        canRunMockCampaign: false,
        canScheduleCampaign: false,
        canExportReports: false,
        canUseLiveMessaging: false,
        usageLimits: {
          maxContacts: 0,
          maxMonthlyCampaigns: 0,
          maxSimulatedMessages: 0,
          maxTemplates: 0,
          maxAutomationRules: 0,
          allowLiveMessaging: false,
        },
        message: 'No active subscription or free trial found.',
      };
    }

    const { internalStatus, planKey } = subscription;
    const now = new Date();

    // Active access conditions:
    // 1. ACTIVE paid plan
    // 2. CANCEL_AT_PERIOD_END while still before period end
    // 3. TRIALING while still before trial end
    // 4. LEGACY_ENTITLED (e.g. M2W Realty migration baseline)
    const isPaidActive = internalStatus === 'ACTIVE';
    const isCancelAtPeriodEnd = internalStatus === 'CANCEL_AT_PERIOD_END' && subscription.currentPeriodEnd > now;
    const isTrialActive = internalStatus === 'TRIALING' && subscription.trialEndsAt > now;
    const isLegacyEntitled = internalStatus === 'LEGACY_ENTITLED';

    const hasActiveAccess = isPaidActive || isCancelAtPeriodEnd || isTrialActive || isLegacyEntitled;

    // Load plan limits
    let plan = null;
    try {
      plan = await planCatalogService.getPlan(planKey);
    } catch {
      plan = { usageLimits: {} };
    }

    return {
      workspaceId,
      hasActiveAccess,
      planKey: subscription.planKey,
      displayName: plan?.displayName || subscription.planKey,
      status: internalStatus,
      internalStatus,
      isTrial: isTrialActive,
      isTrialExpired: internalStatus === 'TRIAL_EXPIRED',
      isPastDue: internalStatus === 'PAST_DUE',
      isLegacyEntitled,
      currentPeriodEnd: subscription.currentPeriodEnd,
      trialEndsAt: subscription.trialEndsAt,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      canCreateCampaign: hasActiveAccess && internalStatus !== 'TRIAL_EXPIRED',
      canRunMockCampaign: hasActiveAccess && internalStatus !== 'TRIAL_EXPIRED',
      canScheduleCampaign: hasActiveAccess && !isTrialActive && internalStatus !== 'TRIAL_EXPIRED', // Scheduling requires paid plan
      canExportReports: hasActiveAccess,
      canUseLiveMessaging: false, // Strictly guarded: Phase 10 does NOT enable live messaging
      features: {
        mockAutomation: hasActiveAccess,
        campaigns: hasActiveAccess && internalStatus !== 'TRIAL_EXPIRED',
        inbox: hasActiveAccess,
        templates: hasActiveAccess,
        reports: true,
        liveMessaging: false,
        readOnlyAccess: true,
      },
      usageLimits: plan?.usageLimits || {},
      message: hasActiveAccess ? 'Workspace is actively entitled.' : 'Subscription or trial has expired.',
    };
  }

  /**
   * Helper methods for direct capability checks.
   */
  async canAccessFeature(workspaceId, feature) {
    const ent = await this.getWorkspaceEntitlements(workspaceId);
    return Boolean(ent.features?.[feature] || ent[feature]);
  }

  async canCreateCampaign(workspaceId) {
    const ent = await this.getWorkspaceEntitlements(workspaceId);
    return Boolean(ent.canCreateCampaign);
  }

  async canRunMockCampaign(workspaceId) {
    const ent = await this.getWorkspaceEntitlements(workspaceId);
    return Boolean(ent.canRunMockCampaign);
  }

  async canScheduleCampaign(workspaceId) {
    const ent = await this.getWorkspaceEntitlements(workspaceId);
    return Boolean(ent.canScheduleCampaign);
  }

  async canUseLiveMessaging(_workspaceId) {
    // Phase 10 non-negotiable guard: Live messaging remains disabled
    return false;
  }

  /**
   * Asserts whether a workspace has permission to access a specific capability.
   * Throws HTTP 403 error if not entitled.
   */
  async assertEntitlement(workspaceId, capability = 'general_access') {
    const entitlement = await this.getWorkspaceEntitlements(workspaceId);

    if (!entitlement.hasActiveAccess) {
      if (entitlement.isTrialExpired) {
        const err = new Error('Your 14-day Free Exploration trial has expired. Please upgrade to Relay Solo to continue.');
        err.code = 'TRIAL_EXPIRED';
        err.status = 403;
        throw err;
      }
      if (entitlement.isPastDue) {
        const err = new Error('Your subscription payment is past due. Please update your payment method to restore access.');
        err.code = 'SUBSCRIPTION_PAST_DUE';
        err.status = 403;
        throw err;
      }
      const err = new Error('An active subscription or free trial is required to perform this action.');
      err.code = 'SUBSCRIPTION_REQUIRED';
      err.status = 403;
      throw err;
    }

    if (capability === 'live_messaging' && !entitlement.canUseLiveMessaging) {
      const err = new Error('Live WhatsApp messaging is disabled in this phase.');
      err.code = 'LIVE_MESSAGING_DISABLED';
      err.status = 403;
      throw err;
    }

    if (capability === 'schedule_campaign' && !entitlement.canScheduleCampaign) {
      const err = new Error('Scheduling campaigns requires an active Relay Solo subscription.');
      err.code = 'UPGRADE_REQUIRED';
      err.status = 403;
      throw err;
    }

    return entitlement;
  }
}

export default new WorkspaceEntitlementService();
