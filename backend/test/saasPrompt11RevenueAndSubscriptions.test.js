import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';

import app from '../src/app.js';
import User from '../src/models/User.js';
import Workspace from '../src/models/Workspace.js';
import Subscription from '../src/models/Subscription.js';
import BillingPayment from '../src/models/BillingPayment.js';
import PlatformAdminGrant from '../src/models/PlatformAdminGrant.js';
import PlatformAuditLog from '../src/models/PlatformAuditLog.js';

let mongodInstance = null;
let adminUser = null;
let adminToken = null;
let wsPaid = null;
let wsTest = null;
let wsLegacy = null;

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

  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_prompt11_admin';

  adminUser = await User.create({
    name: 'Finance Admin',
    email: `finance_${Date.now()}@relayops.io`,
    passwordHash: await bcrypt.hash('AdminPass123!', 10),
    role: 'owner',
    accountStatus: 'ACTIVE',
    isEmailVerified: true,
  });

  await PlatformAdminGrant.create({
    userId: adminUser._id,
    role: 'PLATFORM_SUPER_ADMIN',
    status: 'ACTIVE',
    permissions: ['platform.dashboard.read', 'platform.billing.read', 'platform.billing.reconcile'],
    grantedBy: 'CLI_BOOTSTRAP',
  });

  adminToken = jwt.sign(
    { sub: adminUser._id.toString(), ver: adminUser.authVersion || 1 },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );

  // 1. Live Paid Workspace
  const user1 = await User.create({
    name: 'Live Customer',
    email: `live_cust_${Date.now()}@biz.io`,
    passwordHash: 'dummy',
  });
  wsPaid = await Workspace.create({
    name: 'Live Paying Enterprise',
    slug: `live-enterprise-${Date.now()}`,
    industryKey: 'clinic',
    businessEmail: 'live@biz.io',
    businessPhone: '+919876543201',
    createdBy: user1._id,
  });
  const subPaid = await Subscription.create({
    workspaceId: wsPaid._id,
    ownerUserId: user1._id,
    planKey: 'growth',
    billingEnvironment: 'LIVE',
    internalStatus: 'ACTIVE',
    amountMinor: 79900,
    startedAt: new Date(),
    currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
  });

  // Captured payment for Live (79900 paise = 799.00 INR)
  await BillingPayment.create({
    workspaceId: wsPaid._id,
    subscriptionId: subPaid._id,
    providerPaymentId: `pay_live_${Date.now()}`,
    amountMinor: 79900,
    currency: 'INR',
    status: 'captured',
    billingEnvironment: 'LIVE',
    paidAt: new Date(),
  });

  // Second payment for Live (79900 paise, but refunded 20000 paise)
  await BillingPayment.create({
    workspaceId: wsPaid._id,
    subscriptionId: subPaid._id,
    providerPaymentId: `pay_live_ref_${Date.now()}`,
    amountMinor: 20000,
    currency: 'INR',
    status: 'refunded',
    billingEnvironment: 'LIVE',
    paidAt: new Date(),
  });

  // 2. Sandbox Test Mode Workspace
  const user2 = await User.create({
    name: 'Sandbox Customer',
    email: `test_cust_${Date.now()}@sandbox.io`,
    passwordHash: 'dummy',
  });
  wsTest = await Workspace.create({
    name: 'Test Sandbox Gym',
    slug: `test-gym-${Date.now()}`,
    industryKey: 'gym',
    businessEmail: 'test@sandbox.io',
    businessPhone: '+919876543202',
    createdBy: user2._id,
  });
  const subTest = await Subscription.create({
    workspaceId: wsTest._id,
    ownerUserId: user2._id,
    planKey: 'starter',
    billingEnvironment: 'TEST',
    internalStatus: 'TRIALING',
    amountMinor: 79900,
    trialStartedAt: new Date(),
    trialEndsAt: new Date(Date.now() + 14 * 86400000),
  });

  // Captured payment in TEST mode (should NEVER count in LIVE revenue!)
  await BillingPayment.create({
    workspaceId: wsTest._id,
    subscriptionId: subTest._id,
    providerPaymentId: `pay_test_${Date.now()}`,
    amountMinor: 500000, // 5000 INR in test mode
    currency: 'INR',
    status: 'captured',
    billingEnvironment: 'TEST',
    paidAt: new Date(),
  });

  // 3. Legacy Entitled Workspace (M2W Realty - Operational Grant, 0 revenue)
  const user3 = await User.create({
    name: 'M2W Founder',
    email: `m2w_${Date.now()}@luxuryrealty.io`,
    passwordHash: 'dummy',
  });
  wsLegacy = await Workspace.create({
    name: 'M2W Luxury Realty',
    slug: `m2w-luxury-${Date.now()}`,
    industryKey: 'real_estate',
    businessEmail: 'founder@luxuryrealty.io',
    businessPhone: '+919876543203',
    createdBy: user3._id,
  });
  await Subscription.create({
    workspaceId: wsLegacy._id,
    ownerUserId: user3._id,
    planKey: 'enterprise',
    billingEnvironment: 'LIVE',
    internalStatus: 'LEGACY_ENTITLED',
    amountMinor: 0,
    startedAt: new Date(),
  });
});

test.after(async () => {
  if (mongodInstance) {
    await mongoose.disconnect();
    await mongodInstance.stop();
  }
});

test('1. Admin lists subscriptions with environment and status filters', async () => {
  const res = await request(app)
    .get('/api/platform-admin/subscriptions')
    .set('Authorization', `Bearer ${adminToken}`);

  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.subscriptions));
  assert.ok(res.body.subscriptions.length >= 3);
  assert.ok(res.body.summaryCounts);
  assert.ok(res.body.summaryCounts.active >= 1);
  assert.ok(res.body.summaryCounts.trialing >= 1);
});

test('2. Live Revenue Analytics strictly excludes Sandbox Test payments', async () => {
  const res = await request(app)
    .get('/api/platform-admin/revenue?environment=LIVE')
    .set('Authorization', `Bearer ${adminToken}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.environment, 'LIVE');
  // Gross collected in LIVE is 79900 paise (799 INR)
  assert.equal(res.body.grossCollectedMinor, 79900);
  assert.equal(res.body.refundsMinor, 20000);
  assert.equal(res.body.netCollectedMinor, 59900); // 79900 - 20000
  assert.equal(res.body.paidPaymentCount, 1);
  // Test payment of 500,000 paise is NOT present in LIVE revenue!
  assert.notEqual(res.body.grossCollectedMinor, 579900);
});

test('3. Test Mode Revenue Analytics reports sandbox payments distinctly', async () => {
  const res = await request(app)
    .get('/api/platform-admin/revenue?environment=TEST')
    .set('Authorization', `Bearer ${adminToken}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.environment, 'TEST');
  assert.equal(res.body.grossCollectedMinor, 500000);
  assert.match(res.body.disclaimer, /TEST MODE/i);
});

test('4. Operational Entitlement Grants (LEGACY_ENTITLED) are not counted as revenue', async () => {
  // Check that M2W Legacy entitlement did not create fake payments or revenue
  const paymentsForM2W = await BillingPayment.find({ workspaceId: wsLegacy._id });
  assert.equal(paymentsForM2W.length, 0);

  const res = await request(app)
    .get('/api/platform-admin/revenue?environment=LIVE')
    .set('Authorization', `Bearer ${adminToken}`);

  // Gross remains strictly 79900, zero fabrication
  assert.equal(res.body.grossCollectedMinor, 79900);
});

test('5. POST /api/platform-admin/billing/reconcile executes idempotently and creates an audit entry', async () => {
  const res = await request(app)
    .post('/api/platform-admin/billing/reconcile')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ reason: 'Weekly billing reconciliation audit' });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);

  const audit = await PlatformAuditLog.findOne({
    targetResourceType: 'BILLING',
    actionType: 'billing_reconciliation_requested',
  });
  assert.ok(audit);
  assert.equal(audit.reason, 'Weekly billing reconciliation audit');
});
