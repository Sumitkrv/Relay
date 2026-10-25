import Plan from '../models/Plan.js';

export const DEFAULT_PLANS = [
  {
    planKey: 'free_exploration',
    displayName: 'Free Exploration',
    description: '14-day offline mock sandbox with full access to all 7 modules and simulated WhatsApp engine.',
    currency: 'INR',
    amountMinor: 0,
    billingInterval: 'trial',
    billingIntervalCount: 1,
    trialDays: 14,
    includedFeatures: [
      '14-Day Free Exploration Trial',
      '1 Authorized Business Workspace',
      '1 Primary Business Owner Account',
      'Access to All 7 Dashboard Modules',
      'Offline Mock WhatsApp Simulator',
      'Inbound Simulation & Auto-Replies',
      'Up to 100 Contacts & Dynamic Segments',
      'Up to 5 Mock Campaigns per Month',
      'Up to 500 Simulated Messages',
      'Up to 5 Saved Templates',
      'Up to 3 Active Keyword Rules',
      '50 MB Media Storage',
      'Zero Payment Card Required',
    ],
    usageLimits: {
      maxContacts: 100,
      maxMonthlyCampaigns: 5,
      maxSimulatedMessages: 500,
      maxTemplates: 5,
      maxAutomationRules: 3,
      maxStorageMb: 50,
      allowLiveMessaging: false,
    },
    isPublic: true,
    isActive: true,
    version: 1,
    providerPlanIdTest: '',
    providerPlanIdLive: '',
    taxTreatment: 'exclusive',
  },
  {
    planKey: 'relay_solo',
    displayName: 'Relay Solo',
    description: 'Everything a single-operator business needs to automate WhatsApp campaigns and customer conversations.',
    currency: 'INR',
    amountMinor: 79900, // ₹799 in paise (integer minor units)
    billingInterval: 'monthly',
    billingIntervalCount: 1,
    trialDays: 0,
    includedFeatures: [
      '1 Dedicated Business Workspace',
      '1 Primary Business Owner Account',
      'Connect 1 Primary WhatsApp Business Sender',
      'Option A: WhatsApp Business App Coexistence',
      'Option B: Dedicated WhatsApp Cloud API Number',
      'Up to 10,000 Contacts & Groups',
      'Unlimited Dynamic Segments & Tags',
      'Up to 100 Campaigns per Month',
      'Up to 50,000 Messages per Month',
      'Up to 50 Custom Templates with PDF Media',
      'Up to 25 Active Keyword Auto-Reply Rules',
      '500 MB Media Storage',
      'CSV & Excel Data Export',
      'Full Reporting & Analytics',
      'Direct Meta messaging fees (zero Relay markup)',
    ],
    usageLimits: {
      maxContacts: 10000,
      maxMonthlyCampaigns: 100,
      maxSimulatedMessages: 50000,
      maxTemplates: 50,
      maxAutomationRules: 25,
      maxStorageMb: 500,
      allowLiveMessaging: false, // Live messaging strictly guarded by readiness
    },
    isPublic: true,
    isActive: true,
    version: 1,
    providerPlanIdTest: process.env.RAZORPAY_SOLO_PLAN_ID_TEST || 'plan_test_relay_solo_799',
    providerPlanIdLive: process.env.RAZORPAY_SOLO_PLAN_ID_LIVE || '',
    taxTreatment: 'exclusive',
  },
];

class PlanCatalogService {
  /**
   * Initializes default plans in MongoDB idempotently.
   */
  async initializePlans() {
    for (const planDef of DEFAULT_PLANS) {
      await Plan.findOneAndUpdate(
        { planKey: planDef.planKey },
        { $setOnInsert: planDef },
        { upsert: true, new: true }
      );
    }
  }

  /**
   * Alias for initializePlans returning array of plans.
   */
  async initDefaultPlans() {
    await this.initializePlans();
    return Plan.find({ isActive: true }).lean();
  }

  /**
   * Returns all active public plans for pricing display.
   */
  async getPublicPlans() {
    await this.initializePlans();
    return Plan.find({ isPublic: true, isActive: true }).sort({ amountMinor: 1 }).lean();
  }

  /**
   * Retrieves authoritative plan definition by key.
   */
  async getPlan(planKey) {
    if (!planKey) {
      throw new Error('Plan key is required.');
    }
    const normalizedKey = String(planKey).trim().toLowerCase();
    await this.initializePlans();

    const plan = await Plan.findOne({ planKey: normalizedKey, isActive: true }).lean();
    if (!plan) {
      const err = new Error(`Invalid or inactive plan key: "${planKey}".`);
      err.status = 404;
      err.code = 'PLAN_NOT_FOUND';
      throw err;
    }
    return plan;
  }

  /**
   * Validates whether a planKey exists and is active.
   */
  async validatePlanKey(planKey) {
    const plan = await this.getPlan(planKey);
    return Boolean(plan);
  }

  /**
   * Alias for validatePlanKey.
   */
  async validatePlan(planKey) {
    return this.validatePlanKey(planKey);
  }
}

export default new PlanCatalogService();
