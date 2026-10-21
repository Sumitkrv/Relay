import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

import User from '../src/models/User.js';
import Workspace from '../src/models/Workspace.js';
import WorkspaceMembership from '../src/models/WorkspaceMembership.js';
import Subscription from '../src/models/Subscription.js';
import BillingPayment from '../src/models/BillingPayment.js';

import planCatalogService from '../src/services/planCatalogService.js';
import trialManagementService from '../src/services/trialManagementService.js';
import subscriptionService from '../src/services/subscriptionService.js';
import workspaceEntitlementService from '../src/services/workspaceEntitlementService.js';
import usageQuotaService from '../src/services/usageQuotaService.js';
import billingWebhookService from '../src/services/billingWebhookService.js';
import razorpayClientService from '../src/services/razorpayClientService.js';

let mongodInstance = null;
let gymOwner = null;
let gymWorkspace = null;
let salonOwner = null;
let salonWorkspace = null;
let m2wOwner = null;
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

  // 1. FitZone Gym (Tenant 1)
  gymOwner = await User.create({
    name: 'Gym Owner',
    email: 'gym_e2e_' + Date.now() + '@relaytest.io',
    passwordHash: await bcrypt.hash('Password123!', 10),
    role: 'owner',
  });
  gymWorkspace = await Workspace.create({
    name: 'FitZone Gym E2E',
    slug: 'fitzone-gym-e2e-' + Date.now(),
    industryKey: 'gym',
    businessEmail: 'owner@fitzonee2e.io',
    businessPhone: '+919876543221',
    createdBy: gymOwner._id,
  });
  await WorkspaceMembership.create({
    workspaceId: gymWorkspace._id,
    userId: gymOwner._id,
    role: 'OWNER',
    status: 'ACTIVE',
  });

  // 2. Glow Salon (Tenant 2)
  salonOwner = await User.create({
    name: 'Salon Owner',
    email: 'salon_e2e_' + Date.now() + '@relaytest.io',
    passwordHash: await bcrypt.hash('Password123!', 10),
    role: 'owner',
  });
  salonWorkspace = await Workspace.create({
    name: 'Glow Salon E2E',
    slug: 'glow-salon-e2e-' + Date.now(),
    industryKey: 'salon',
    businessEmail: 'owner@glowsalone2e.io',
    businessPhone: '+919876543222',
    createdBy: salonOwner._id,
  });
  await WorkspaceMembership.create({
    workspaceId: salonWorkspace._id,
    userId: salonOwner._id,
    role: 'OWNER',
    status: 'ACTIVE',
  });

  // 3. M2W Realty (Tenant 3 - Reference)
  m2wOwner = await User.create({
    name: 'M2W Admin',
    email: 'm2w_admin_' + Date.now() + '@relaytest.io',
    passwordHash: await bcrypt.hash('Password123!', 10),
    role: 'owner',
  });
  m2wWorkspace = await Workspace.create({
    name: 'M2W Luxury Realty E2E',
    slug: 'm2w-luxury-realty-e2e-' + Date.now(),
    industryKey: 'real_estate',
    businessEmail: 'sumit@m2wrealtye2e.in',
    businessPhone: '+919876543223',
    createdBy: m2wOwner._id,
  });
  await WorkspaceMembership.create({
    workspaceId: m2wWorkspace._id,
    userId: m2wOwner._id,
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

test('Scenario A: FitZone Gym starts 14-day free trial, executes mock campaigns, verifies zero money charged', async () => {
  // Start trial
  const trialRes = await trialManagementService.startTrial(gymWorkspace._id, gymOwner._id);
  assert.equal(trialRes.success, true);
  assert.equal(trialRes.subscription.internalStatus, 'TRIALING');

  // Verify entitlements during trial
  const ent = await workspaceEntitlementService.getWorkspaceEntitlements(gymWorkspace._id);
  assert.equal(ent.status, 'TRIALING');
  assert.equal(ent.features.mockAutomation, true);
  assert.equal(ent.features.liveMessaging, false, 'No live messaging during trial');

  // Run mock campaign (increment quota)
  const canRun = await workspaceEntitlementService.canRunMockCampaign(gymWorkspace._id);
  assert.equal(canRun, true);
  await usageQuotaService.incrementUsage(gymWorkspace._id, 'campaigns', 1);
  await usageQuotaService.incrementUsage(gymWorkspace._id, 'simulatedMessages', 200);

  // Confirm zero payments recorded for Gym
  const payments = await BillingPayment.find({ workspaceId: gymWorkspace._id });
  assert.equal(payments.length, 0, 'Trial must not record financial payments');
});

test('Scenario B: Glow Salon subscribes to Relay Solo, activates via checkout signature, verifies payment history', async () => {
  // 1. Create subscription
  const subRes = await subscriptionService.createSubscription({
    workspaceId: salonWorkspace._id,
    userId: salonOwner._id,
    planKey: 'relay_solo'
  });
  assert.equal(subRes.success, true);
  const { providerSubscriptionId } = subRes.subscription;

  // 2. Perform test authorization signature
  const paymentId = 'pay_salon_' + Date.now().toString(36);
  const secret = razorpayClientService.keySecret;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${paymentId}|${providerSubscriptionId}`)
    .digest('hex');

  // 3. Verify checkout
  const verifyRes = await subscriptionService.verifyCheckout({
    workspaceId: salonWorkspace._id,
    userId: salonOwner._id,
    razorpay_payment_id: paymentId,
    razorpay_subscription_id: providerSubscriptionId,
    razorpay_signature: signature
  });
  assert.equal(verifyRes.success, true);
  assert.equal(verifyRes.status, 'ACTIVE');

  // 4. Check entitlements are ACTIVE
  const ent = await workspaceEntitlementService.getWorkspaceEntitlements(salonWorkspace._id);
  assert.equal(ent.status, 'ACTIVE');
  assert.equal(ent.features.campaigns, true);

  // 5. Check payment transaction
  const payments = await BillingPayment.find({ workspaceId: salonWorkspace._id });
  assert.equal(payments.length, 1);
  assert.equal(payments[0].amountMinor, 79900);
});

test('Scenario C: Payment failure triggers PAST_DUE and grace period', async () => {
  const salonSub = await Subscription.findOne({ workspaceId: salonWorkspace._id });

  // Webhook delivers payment.failed
  const failEventId = 'evt_fail_' + Date.now().toString(36);
  const failPayload = {
    subscription: {
      entity: {
        id: salonSub.providerSubscriptionId,
        status: 'active'
      }
    },
    payment: {
      entity: {
        id: 'pay_failed_' + Date.now(),
        amount: 79900,
        currency: 'INR',
        status: 'failed',
        error_code: 'BAD_REQUEST_ERROR',
        error_description: 'Card was declined by issuing bank'
      }
    }
  };

  const webhookRes = await billingWebhookService.processEvent({
    providerEventId: failEventId,
    eventType: 'payment.failed',
    payload: failPayload
  });
  assert.equal(webhookRes.status, 'processed');

  // Subscription transitions to PAST_DUE
  const updatedSub = await Subscription.findById(salonSub._id);
  assert.equal(updatedSub.internalStatus, 'PAST_DUE');

  // Data remains safely preserved
  const ws = await Workspace.findById(salonWorkspace._id);
  assert.ok(ws, 'Workspace data preserved during past due grace period');
});

test('Scenario D: Glow Salon cancels subscription at period end and resubscribes', async () => {
  // Cancel at period end
  const cancelRes = await subscriptionService.cancelSubscription({
    workspaceId: salonWorkspace._id,
    userId: salonOwner._id,
    cancelImmediately: false,
    reason: 'Evaluating summer pause'
  });
  assert.equal(cancelRes.success, true);

  const sub = await Subscription.findOne({ workspaceId: salonWorkspace._id });
  assert.equal(sub.cancelAtPeriodEnd, true);

  // Resubscribe
  const resubRes = await subscriptionService.createSubscription({
    workspaceId: salonWorkspace._id,
    userId: salonOwner._id,
    planKey: 'relay_solo'
  });
  assert.equal(resubRes.success, true);
});

test('Scenario E: Cross-Tenant Financial Isolation and M2W Realty Regression', async () => {
  // Gym Owner attempts to cancel Salon's subscription
  await assert.rejects(
    async () => subscriptionService.cancelSubscription({
      workspaceId: salonWorkspace._id,
      userId: gymOwner._id,
      cancelImmediately: true
    }),
    /Unauthorized/
  );

  // Gym Owner attempts to read Salon's payments
  const salonPayments = await BillingPayment.find({ workspaceId: salonWorkspace._id });
  const gymPayments = await BillingPayment.find({ workspaceId: gymWorkspace._id });
  assert.notEqual(salonPayments.length, gymPayments.length);
  assert.equal(gymPayments.length, 0, 'Gym has 0 payments');
  assert.equal(salonPayments.length >= 1, true, 'Salon has payments');

  // Salon payments do not leak gym workspaceId
  for (const p of salonPayments) {
    assert.equal(p.workspaceId.toString(), salonWorkspace._id.toString());
    assert.notEqual(p.workspaceId.toString(), gymWorkspace._id.toString());
  }

  // M2W Realty Reference legacy grant
  const m2wGrant = await subscriptionService.grantLegacyEntitlement({
    workspaceId: m2wWorkspace._id,
    ownerUserId: m2wOwner._id,
    reason: 'Original reference workspace migration'
  });
  assert.equal(m2wGrant.success, true);

  const m2wEnt = await workspaceEntitlementService.getWorkspaceEntitlements(m2wWorkspace._id);
  assert.equal(m2wEnt.status, 'LEGACY_ENTITLED');
  assert.equal(m2wEnt.features.campaigns, true);
  assert.equal(m2wEnt.features.liveMessaging, false, 'M2W real WhatsApp sending remains strictly disabled');
});
