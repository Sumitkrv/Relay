import UsageCounter from '../models/UsageCounter.js';
import workspaceEntitlementService from './workspaceEntitlementService.js';

class UsageQuotaService {
  _getPeriodKey(date = new Date()) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  /**
   * Retrieves current monthly usage and remaining quotas for a workspace.
   */
  async getUsage(workspaceId) {
    const periodKey = this._getPeriodKey();
    const entitlement = await workspaceEntitlementService.getWorkspaceEntitlements(workspaceId);

    const counter = await UsageCounter.findOne({ workspaceId, periodKey }).lean();
    const limits = entitlement.usageLimits || {};

    const usage = {
      periodKey,
      contacts: {
        used: counter?.contactsCount || 0,
        limit: limits.maxContacts || 0,
        remaining: Math.max(0, (limits.maxContacts || 0) - (counter?.contactsCount || 0)),
      },
      campaigns: {
        used: counter?.monthlyCampaignsCount || 0,
        limit: limits.maxMonthlyCampaigns || 0,
        remaining: Math.max(0, (limits.maxMonthlyCampaigns || 0) - (counter?.monthlyCampaignsCount || 0)),
      },
      simulatedMessages: {
        used: counter?.simulatedMessagesCount || 0,
        limit: limits.maxSimulatedMessages || 0,
        remaining: Math.max(0, (limits.maxSimulatedMessages || 0) - (counter?.simulatedMessagesCount || 0)),
      },
      templates: {
        used: counter?.templatesCount || 0,
        limit: limits.maxTemplates || 0,
        remaining: Math.max(0, (limits.maxTemplates || 0) - (counter?.templatesCount || 0)),
      },
      automationRules: {
        used: counter?.automationRulesCount || 0,
        limit: limits.maxAutomationRules || 0,
        remaining: Math.max(0, (limits.maxAutomationRules || 0) - (counter?.automationRulesCount || 0)),
      },
    };

    return usage;
  }

  /**
   * Enforces and atomically increments a usage quota category.
   * Throws HTTP 403 if the limit would be exceeded.
   */
  async checkAndIncrementQuota(workspaceId, category, incrementBy = 1) {
    const periodKey = this._getPeriodKey();
    const entitlement = await workspaceEntitlementService.getWorkspaceEntitlements(workspaceId);
    const limits = entitlement.usageLimits || {};

    const limitMapping = {
      contacts: { field: 'contactsCount', limit: limits.maxContacts },
      campaigns: { field: 'monthlyCampaignsCount', limit: limits.maxMonthlyCampaigns },
      simulatedMessages: { field: 'simulatedMessagesCount', limit: limits.maxSimulatedMessages },
      templates: { field: 'templatesCount', limit: limits.maxTemplates },
      automationRules: { field: 'automationRulesCount', limit: limits.maxAutomationRules },
    };

    const quotaConfig = limitMapping[category];
    if (!quotaConfig) {
      throw new Error(`Unknown quota category: "${category}".`);
    }

    const { field, limit } = quotaConfig;

    // Check existing usage
    const counter = await UsageCounter.findOne({ workspaceId, periodKey });
    const currentUsed = counter ? counter[field] : 0;

    if (limit && currentUsed + incrementBy > limit) {
      const err = new Error(
        `Quota Exceeded: You have utilized ${currentUsed}/${limit} for ${category}. Please upgrade your subscription to expand limits.`
      );
      err.code = 'QUOTA_EXCEEDED';
      err.status = 403;
      err.category = category;
      err.limit = limit;
      err.currentUsed = currentUsed;
      throw err;
    }

    // Atomic increment
    const updated = await UsageCounter.findOneAndUpdate(
      { workspaceId, periodKey },
      { $inc: { [field]: incrementBy } },
      { upsert: true, new: true }
    );

    return {
      success: true,
      category,
      used: updated[field],
      limit,
    };
  }

  /**
   * Validates available quota without mutating the counter.
   */
  async checkQuota(workspaceId, category, amount = 1) {
    const periodKey = this._getPeriodKey();
    const entitlement = await workspaceEntitlementService.getWorkspaceEntitlements(workspaceId);
    const limits = entitlement.usageLimits || {};

    const limitMapping = {
      contacts: { field: 'contactsCount', limit: limits.maxContacts || 10000 },
      campaigns: { field: 'monthlyCampaignsCount', limit: limits.maxMonthlyCampaigns || 50 },
      simulatedMessages: { field: 'simulatedMessagesCount', limit: limits.maxSimulatedMessages || 25000 },
      templates: { field: 'templatesCount', limit: limits.maxTemplates || 50 },
      automationRules: { field: 'automationRulesCount', limit: limits.maxAutomationRules || 10 },
    };

    const quotaConfig = limitMapping[category];
    const { field, limit } = quotaConfig || { field: category, limit: 1000 };
    const counter = await UsageCounter.findOne({ workspaceId, periodKey });
    const currentUsed = counter ? (counter[field] || 0) : 0;

    if (limit && currentUsed + amount > limit) {
      const err = new Error(`Monthly quota exceeded for ${category}: requested ${amount}, available ${Math.max(0, limit - currentUsed)}.`);
      err.code = 'QUOTA_EXCEEDED';
      err.status = 403;
      throw err;
    }

    return {
      allowed: true,
      remaining: Math.max(0, limit - (currentUsed + amount)),
      currentUsed,
      limit,
    };
  }

  /**
   * Atomically increments usage and returns the counter document.
   */
  async incrementUsage(workspaceId, category, incrementBy = 1) {
    const periodKey = this._getPeriodKey();
    const limitMapping = {
      contacts: 'contactsCount',
      campaigns: 'monthlyCampaignsCount',
      simulatedMessages: 'simulatedMessagesCount',
      templates: 'templatesCount',
      automationRules: 'automationRulesCount',
    };
    const field = limitMapping[category] || category;
    const updated = await UsageCounter.findOneAndUpdate(
      { workspaceId, periodKey },
      { $inc: { [field]: incrementBy } },
      { upsert: true, new: true }
    );
    return updated.toJSON ? updated.toJSON() : updated;
  }
}

export default new UsageQuotaService();
