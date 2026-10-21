import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

import User from '../src/models/User.js';
import Workspace from '../src/models/Workspace.js';
import WorkspaceMembership from '../src/models/WorkspaceMembership.js';
import Subscription from '../src/models/Subscription.js';
import UsageCounter from '../src/models/UsageCounter.js';

import planCatalogService from '../src/services/planCatalogService.js';
import workspaceEntitlementService from '../src/services/workspaceEntitlementService.js';
import usageQuotaService from '../src/services/usageQuotaService.js';
import subscriptionService from '../src/services/subscriptionService.js';

let mongodInstance = null;
let testOwner = null;
let testWorkspace = null;
let m2wWorkspace = null;

test.before(async () => {
  if (mongoose.connection.readyState === 0) {
    try {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/relay_saas_test';
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 1500 });
    } catch {
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      mongodInstance = await MongoMemoryServer.create();
      await mongoose.connect(mongodInstance.getUri());
    }
  }

  await planCatalogService.initDefaultPlans();

  testOwner = await User.create({
    name: 'Entitlement Test Owner',
    email: 'entitlement_owner_' + Date.now() + '@relaytest.io',
    passwordHash: await bcrypt.hash('Password123!', 10),
    role: 'owner',
  });

  testWorkspace = await Workspace.create({
    name: 'Glow Salon Entitlements',
    slug: 'glow-salon-entitlements-' + Date.now(),
    industryKey: 'salon',
    businessEmail: 'owner@glowsalon.io',
    businessPhone: '+919876543231',
    createdBy: testOwner._id,
  });

  await WorkspaceMembership.create({
    workspaceId: testWorkspace._id,
    userId: testOwner._id,
    role: 'OWNER',
    status: 'ACTIVE',
  });

  // Create M2W Luxury Realty Reference Workspace
  m2wWorkspace = await Workspace.create({
    name: 'M2W Luxury Realty Reference',
    slug: 'm2w-luxury-realty-' + Date.now(),
    industryKey: 'real_estate',
    businessEmail: 'sumit@m2wrealty.in',
    businessPhone: '+919876543232',
    createdBy: testOwner._id,
  });

  await WorkspaceMembership.create({
    workspaceId: m2wWorkspace._id,
    userId: testOwner._id,
    role: 'OWNER',
    status: 'ACTIVE',
  });
});

test.after(async () => {
  await mongoose.disconnect();
  if (mongodInstance) {
    await mongodInstance.stop();
  }
});

test('Workspace Entitlements: grants full Mock mode access during active subscription', async () => {
  // Create active subscription for testWorkspace
  await Subscription.create({
    workspaceId: testWorkspace._id,
    ownerUserId: testOwner._id,
    planKey: 'relay_solo',
    provider: 'RAZORPAY',
    providerSubscriptionId: 'sub_active_' + Date.now(),
    billingEnvironment: 'TEST',
    internalStatus: 'ACTIVE',
    currency: 'INR',
    amountMinor: 79900,
    startedAt: new Date(),
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  const ent = await workspaceEntitlementService.getWorkspaceEntitlements(testWorkspace._id);
  assert.equal(ent.status, 'ACTIVE');
  assert.equal(ent.features.mockAutomation, true);
  assert.equal(ent.features.campaigns, true);
  assert.equal(ent.features.inbox, true);
  assert.equal(ent.features.templates, true);
  assert.equal(ent.features.reports, true);

  const canRunCampaign = await workspaceEntitlementService.canRunMockCampaign(testWorkspace._id);
  assert.equal(canRunCampaign, true);
});

test('CRITICAL RULE: Live Meta WhatsApp messaging remains strictly disabled', async () => {
  // Even though subscription is ACTIVE
  const canLive = await workspaceEntitlementService.canUseLiveMessaging(testWorkspace._id);
  assert.equal(canLive, false, 'Live Meta WhatsApp sending MUST remain false in Prompt 10');

  const ent = await workspaceEntitlementService.getWorkspaceEntitlements(testWorkspace._id);
  assert.equal(ent.features.liveMessaging, false, 'Live messaging entitlement must be false');
});

test('Workspace Entitlements: trial expiry restricts campaign creation but preserves data', async () => {
  // Create expired workspace
  const expiredWorkspace = await Workspace.create({
    name: 'Expired Trial Dental',
    slug: 'expired-dental-' + Date.now(),
    industryKey: 'clinic',
    businessEmail: 'doc@dental.io',
    businessPhone: '+919876543212',
    createdBy: testOwner._id,
  });

  await Subscription.create({
    workspaceId: expiredWorkspace._id,
    ownerUserId: testOwner._id,
    planKey: 'free_exploration',
    provider: 'MOCK',
    billingEnvironment: 'TEST',
    internalStatus: 'TRIAL_EXPIRED',
    currency: 'INR',
    amountMinor: 0,
    trialStartedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    trialEndsAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  });

  const ent = await workspaceEntitlementService.getWorkspaceEntitlements(expiredWorkspace._id);
  assert.equal(ent.status, 'TRIAL_EXPIRED');
  assert.equal(ent.features.campaigns, false, 'Cannot run new campaigns when trial expired');

  const canRun = await workspaceEntitlementService.canRunMockCampaign(expiredWorkspace._id);
  assert.equal(canRun, false);

  // Read-only access remains permitted
  assert.equal(ent.features.readOnlyAccess, true);
  assert.equal(ent.features.reports, true);
});

test('M2W Luxury Realty: legacy entitlement policy allows full features without payment charge', async () => {
  const legacyResult = await subscriptionService.grantLegacyEntitlement({
    workspaceId: m2wWorkspace._id,
    ownerUserId: testOwner._id,
    reason: 'Original reference workspace migration'
  });

  assert.equal(legacyResult.success, true);
  assert.equal(legacyResult.subscription.internalStatus, 'LEGACY_ENTITLED');

  const ent = await workspaceEntitlementService.getWorkspaceEntitlements(m2wWorkspace._id);
  assert.equal(ent.status, 'LEGACY_ENTITLED');
  assert.equal(ent.features.campaigns, true);
  assert.equal(ent.features.mockAutomation, true);
  assert.equal(ent.features.reports, true);

  // Live messaging still disabled
  assert.equal(ent.features.liveMessaging, false);
});

test('Usage Quota Engine: enforces resource limits and increments atomically', async () => {
  // Check remaining quota
  const check = await usageQuotaService.checkQuota(testWorkspace._id, 'campaigns', 1);
  assert.equal(check.allowed, true);
  assert.ok(check.remaining > 0);

  // Increment usage atomically
  const incRes = await usageQuotaService.incrementUsage(testWorkspace._id, 'campaigns', 1);
  assert.equal(incRes.campaigns, 1);

  // Increment simulated messages
  const msgRes = await usageQuotaService.incrementUsage(testWorkspace._id, 'simulatedMessages', 150);
  assert.equal(msgRes.simulatedMessages, 150);

  // Verify usage record in DB
  const counter = await UsageCounter.findOne({ workspaceId: testWorkspace._id });
  assert.ok(counter);
  assert.equal(counter.campaigns, 1);
  assert.equal(counter.simulatedMessages, 150);

  // Test quota exceeded rejection
  await assert.rejects(
    async () => usageQuotaService.checkQuota(testWorkspace._id, 'campaigns', 100),
    /Monthly quota exceeded for campaigns/
  );
});
