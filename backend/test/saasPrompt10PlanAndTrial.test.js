import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

import User from '../src/models/User.js';
import Workspace from '../src/models/Workspace.js';
import WorkspaceMembership from '../src/models/WorkspaceMembership.js';
import Plan from '../src/models/Plan.js';
import Subscription from '../src/models/Subscription.js';
import TrialGrant from '../src/models/TrialGrant.js';

import planCatalogService from '../src/services/planCatalogService.js';
import trialManagementService from '../src/services/trialManagementService.js';

let mongodInstance = null;
let testOwner = null;
let testWorkspace = null;

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

  // Create isolated test owner & workspace
  testOwner = await User.create({
    name: 'Billing Test Owner',
    email: 'billing_owner_' + Date.now() + '@relaytest.io',
    passwordHash: await bcrypt.hash('Password123!', 10),
    role: 'owner',
  });

  testWorkspace = await Workspace.create({
    name: 'FitZone Billing Gym',
    slug: 'fitzone-billing-gym-' + Date.now(),
    industryKey: 'gym',
    businessEmail: 'owner@fitzonegym.io',
    businessPhone: '+919876543210',
    createdBy: testOwner._id,
  });

  await WorkspaceMembership.create({
    workspaceId: testWorkspace._id,
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

test('Plan Catalog: initializes default plans and validates launch pricing', async () => {
  const plans = await planCatalogService.initDefaultPlans();
  assert.ok(Array.isArray(plans), 'Should return an array of plans');

  const soloPlan = await planCatalogService.getPlan('relay_solo');
  assert.ok(soloPlan, 'Relay Solo plan must exist');
  assert.equal(soloPlan.planKey, 'relay_solo');
  assert.equal(soloPlan.amountMinor, 79900, 'Price must be exactly 79900 paise (₹799)');
  assert.equal(soloPlan.currency, 'INR');
  assert.equal(soloPlan.billingInterval, 'monthly');
  assert.equal(soloPlan.trialDays, 0);
  assert.equal(soloPlan.usageLimits.maxContacts, 10000);
  assert.equal(soloPlan.usageLimits.maxMonthlyCampaigns, 100);

  const freePlan = await planCatalogService.getPlan('free_exploration');
  assert.ok(freePlan, 'Free Exploration plan must exist');
  assert.equal(freePlan.amountMinor, 0);
  assert.equal(freePlan.trialDays, 14);

  const publicPlans = await planCatalogService.getPublicPlans();
  assert.ok(publicPlans.length >= 2, 'Must have at least 2 public plans');
});

test('Plan Catalog: rejects invalid or inactive plans', async () => {
  await assert.rejects(
    async () => planCatalogService.validatePlan('non_existent_plan'),
    /Invalid or inactive plan key/
  );
});

test('Trial Management: starts 14-day trial with server-authoritative timestamps', async () => {
  const result = await trialManagementService.startTrial(testWorkspace._id, testOwner._id);
  assert.equal(result.success, true);
  assert.ok(result.trialGrant, 'Should create a trial grant record');
  assert.equal(result.subscription.internalStatus, 'TRIALING');

  const trialEnds = new Date(result.trialGrant.trialEndsAt).getTime();
  const trialStarts = new Date(result.trialGrant.trialStartedAt).getTime();
  const diffDays = Math.round((trialEnds - trialStarts) / (1000 * 60 * 60 * 24));
  assert.equal(diffDays, 14, 'Trial duration must be exactly 14 days');

  // Verify trial status
  const status = await trialManagementService.getTrialStatus(testWorkspace._id);
  assert.equal(status.status, 'TRIALING');
  assert.equal(status.daysRemaining, 14);
});

test('Trial Abuse Protection: prevents starting second trial on the same workspace', async () => {
  await assert.rejects(
    async () => trialManagementService.startTrial(testWorkspace._id, testOwner._id),
    /already has an active or previous trial/
  );
});

test('Trial Abuse Protection: prevents owner from claiming trial on another workspace', async () => {
  // Create second workspace for same owner
  const secondWorkspace = await Workspace.create({
    name: 'Second Gym By Same Owner',
    slug: 'second-gym-' + Date.now(),
    industryKey: 'gym',
    businessEmail: 'owner2@fitzonegym.io',
    businessPhone: '+919876543211',
    createdBy: testOwner._id,
  });

  await WorkspaceMembership.create({
    workspaceId: secondWorkspace._id,
    userId: testOwner._id,
    role: 'OWNER',
    status: 'ACTIVE',
  });

  await assert.rejects(
    async () => trialManagementService.startTrial(secondWorkspace._id, testOwner._id),
    /Account owner has already utilized free trial eligibility/
  );
});

test('Trial Expiry: transitions expired trial without deleting customer data', async () => {
  // Manually backdate trial ends date to simulate past expiration
  const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago
  await TrialGrant.updateOne(
    { workspaceId: testWorkspace._id },
    { $set: { trialEndsAt: pastDate } }
  );
  await Subscription.updateOne(
    { workspaceId: testWorkspace._id },
    { $set: { trialEndsAt: pastDate } }
  );

  const status = await trialManagementService.getTrialStatus(testWorkspace._id);
  assert.equal(status.status, 'TRIAL_EXPIRED', 'Should detect trial expiration');
  assert.equal(status.isExpired, true);

  // Check subscription was updated to TRIAL_EXPIRED
  const sub = await Subscription.findOne({ workspaceId: testWorkspace._id });
  assert.equal(sub.internalStatus, 'TRIAL_EXPIRED');

  // Verify workspace data remains intact
  const ws = await Workspace.findById(testWorkspace._id);
  assert.ok(ws, 'Workspace must still exist');
  assert.equal(ws.name, 'FitZone Billing Gym');
});
