import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';

import app from '../src/app.js';
import User from '../src/models/User.js';
import Workspace from '../src/models/Workspace.js';
import WorkspaceMembership from '../src/models/WorkspaceMembership.js';
import Subscription from '../src/models/Subscription.js';
import BillingPayment from '../src/models/BillingPayment.js';
import WhatsAppConnection from '../src/models/WhatsAppConnection.js';
import Message from '../src/models/Message.js';
import Contact from '../src/models/Contact.js';
import PlatformAdminGrant from '../src/models/PlatformAdminGrant.js';
import PlatformAuditLog from '../src/models/PlatformAuditLog.js';

let mongodInstance = null;
let superAdmin = null;
let superAdminToken = null;
let gymOwner = null;
let gymOwnerToken = null;
let gymWorkspace = null;
let salonOwner = null;
let salonWorkspace = null;

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

  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_prompt11_admin';

  // 1. Synthetic Platform Super Admin
  superAdmin = await User.create({
    name: 'SaaS Platform Lead',
    email: `super_e2e_${Date.now()}@relayops.io`,
    passwordHash: await bcrypt.hash('LeadSecret123!', 10),
    role: 'owner',
    accountStatus: 'ACTIVE',
    isEmailVerified: true,
  });

  await PlatformAdminGrant.create({
    userId: superAdmin._id,
    role: 'PLATFORM_SUPER_ADMIN',
    status: 'ACTIVE',
    grantedBy: 'CLI_BOOTSTRAP',
  });

  superAdminToken = jwt.sign(
    { sub: superAdmin._id.toString(), ver: superAdmin.authVersion || 1 },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );

  // 2. Tenant 1: FitZone Gym
  gymOwner = await User.create({
    name: 'Coach Vikram',
    email: `vikram_${Date.now()}@fitzone.io`,
    passwordHash: await bcrypt.hash('CoachPass123!', 10),
    role: 'owner',
    accountStatus: 'ACTIVE',
    isEmailVerified: true,
  });

  gymOwnerToken = jwt.sign(
    { sub: gymOwner._id.toString(), ver: gymOwner.authVersion || 1 },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );

  gymWorkspace = await Workspace.create({
    name: 'FitZone Gym E2E',
    slug: `fitzone-e2e-${Date.now()}`,
    industryKey: 'gym',
    businessEmail: 'coach@fitzone.io',
    businessPhone: '+919876543230',
    status: 'ACTIVE',
    onboardingStatus: 'COMPLETED',
    createdBy: gymOwner._id,
  });

  await WorkspaceMembership.create({
    workspaceId: gymWorkspace._id,
    userId: gymOwner._id,
    role: 'OWNER',
    status: 'ACTIVE',
    isDefaultWorkspace: true,
  });

  await Subscription.create({
    workspaceId: gymWorkspace._id,
    ownerUserId: gymOwner._id,
    planKey: 'starter',
    billingEnvironment: 'TEST',
    internalStatus: 'TRIALING',
    amountMinor: 79900,
    trialStartedAt: new Date(),
    trialEndsAt: new Date(Date.now() + 14 * 86400000),
  });

  await WhatsAppConnection.create({
    workspaceId: gymWorkspace._id,
    connectionType: 'MOCK_SIMULATED',
    mode: 'MOCK',
    connectionMode: 'MOCK',
    status: 'MOCK_SIMULATED_READY',
    billingStatus: 'UNVERIFIED',
    createdBy: gymOwner._id,
  });

  // 3. Tenant 2: Glow Salon
  salonOwner = await User.create({
    name: 'Pooja Stylist',
    email: `pooja_${Date.now()}@glowsalon.io`,
    passwordHash: 'dummy',
    role: 'owner',
    accountStatus: 'ACTIVE',
    isEmailVerified: true,
  });

  salonWorkspace = await Workspace.create({
    name: 'Glow Salon & Spa E2E',
    slug: `glow-salon-e2e-${Date.now()}`,
    industryKey: 'salon',
    businessEmail: 'pooja@glowsalon.io',
    businessPhone: '+919876543231',
    status: 'ACTIVE',
    onboardingStatus: 'COMPLETED',
    createdBy: salonOwner._id,
  });

  await WorkspaceMembership.create({
    workspaceId: salonWorkspace._id,
    userId: salonOwner._id,
    role: 'OWNER',
    status: 'ACTIVE',
    isDefaultWorkspace: true,
  });
});

test.after(async () => {
  if (mongodInstance) {
    await mongoose.disconnect();
    await mongodInstance.stop();
  }
});

test('Scenario A — Platform Super Admin E2E Journey', async () => {
  // 1. Check Me
  const meRes = await request(app)
    .get('/api/platform-admin/me')
    .set('Authorization', `Bearer ${superAdminToken}`);
  assert.equal(meRes.status, 200);
  assert.equal(meRes.body.admin.role, 'PLATFORM_SUPER_ADMIN');

  // 2. Open Overview
  const ovRes = await request(app)
    .get('/api/platform-admin/overview')
    .set('Authorization', `Bearer ${superAdminToken}`);
  assert.equal(ovRes.status, 200);
  assert.ok(ovRes.body.workspaces.total >= 2);
  assert.ok(ovRes.body.revenue);

  // 3. Search FitZone Gym in Business Directory
  const bizRes = await request(app)
    .get('/api/platform-admin/businesses?search=FitZone')
    .set('Authorization', `Bearer ${superAdminToken}`);
  assert.equal(bizRes.status, 200);
  assert.equal(bizRes.body.workspaces[0].name, 'FitZone Gym E2E');

  // 4. View Workspace Details
  const detRes = await request(app)
    .get(`/api/platform-admin/businesses/${gymWorkspace._id}`)
    .set('Authorization', `Bearer ${superAdminToken}`);
  assert.equal(detRes.status, 200);
  assert.equal(detRes.body.workspace.industryKey, 'gym');
  assert.equal(detRes.body.subscription.internalStatus, 'TRIALING');
  assert.equal(detRes.body.whatsappConnection.connectionType, 'MOCK_SIMULATED');

  // 5. Check Revenue (Separation check)
  const revRes = await request(app)
    .get('/api/platform-admin/revenue?environment=LIVE')
    .set('Authorization', `Bearer ${superAdminToken}`);
  assert.equal(revRes.status, 200);
  assert.equal(revRes.body.environment, 'LIVE');

  // 6. Inspect Audit Trail
  const audRes = await request(app)
    .get('/api/platform-admin/audit-logs')
    .set('Authorization', `Bearer ${superAdminToken}`);
  assert.equal(audRes.status, 200);
  assert.ok(Array.isArray(audRes.body.logs));
});

test('Scenario B — Workspace Suspension & Reactivation Safety Lifecycle', async () => {
  // 1. Suspend Gym
  const suspRes = await request(app)
    .post(`/api/platform-admin/businesses/${gymWorkspace._id}/suspend`)
    .set('Authorization', `Bearer ${superAdminToken}`)
    .send({ reason: 'Operational audit hold on workout promotion', stepUpConfirmed: true });

  assert.equal(suspRes.status, 200);
  assert.equal(suspRes.body.workspace.status, 'SUSPENDED');

  // 2. FitZone Owner attempting to access customer workspace route is rejected with 403 WORKSPACE_SUSPENDED
  const custRes = await request(app)
    .get('/api/workspaces/current')
    .set('Authorization', `Bearer ${gymOwnerToken}`)
    .set('x-workspace-id', gymWorkspace._id.toString());

  assert.equal(custRes.status, 403);
  assert.equal(custRes.body.code, 'WORKSPACE_SUSPENDED');

  // 3. Reactivate Gym under authorized policy
  const reactRes = await request(app)
    .post(`/api/platform-admin/businesses/${gymWorkspace._id}/reactivate`)
    .set('Authorization', `Bearer ${superAdminToken}`)
    .send({ reason: 'Audit concluded successfully, hold lifted', stepUpConfirmed: true });

  assert.equal(reactRes.status, 200);
  assert.equal(reactRes.body.workspace.status, 'ACTIVE');

  // 4. FitZone Owner can now access customer workspace route again
  const custRestoredRes = await request(app)
    .get('/api/workspaces/current')
    .set('Authorization', `Bearer ${gymOwnerToken}`)
    .set('x-workspace-id', gymWorkspace._id.toString());

  assert.equal(custRestoredRes.status, 200);

  // 5. Tenant Salon workspace was completely unaffected
  const salonCheck = await Workspace.findById(salonWorkspace._id);
  assert.equal(salonCheck.status, 'ACTIVE');
});

test('Scenario C — Billing Issue Triage & Provider Integrity', async () => {
  // Create past-due subscription for testing
  const pastDueSub = await Subscription.create({
    workspaceId: salonWorkspace._id,
    ownerUserId: salonOwner._id,
    planKey: 'growth',
    billingEnvironment: 'LIVE',
    internalStatus: 'PAST_DUE',
    amountMinor: 79900,
  });

  // Query subscriptions needing attention in Admin API
  const subRes = await request(app)
    .get('/api/platform-admin/subscriptions?status=PAST_DUE')
    .set('Authorization', `Bearer ${superAdminToken}`);

  assert.equal(subRes.status, 200);
  assert.ok(subRes.body.subscriptions.length >= 1);
  const found = subRes.body.subscriptions.find((s) => s.workspace.id === salonWorkspace._id.toString());
  assert.ok(found);
  assert.equal(found.internalStatus, 'PAST_DUE');

  // Trigger reconciliation
  const reconRes = await request(app)
    .post('/api/platform-admin/billing/reconcile')
    .set('Authorization', `Bearer ${superAdminToken}`)
    .send({ reason: 'Past-due subscription triage' });

  assert.equal(reconRes.status, 200);
  assert.equal(reconRes.body.success, true);
});

test('Scenario D — System Health Observability Telemetry', async () => {
  const healthRes = await request(app)
    .get('/api/platform-admin/system-health')
    .set('Authorization', `Bearer ${superAdminToken}`);

  assert.equal(healthRes.status, 200);
  assert.equal(healthRes.body.database.status, 'CONNECTED');
  assert.equal(healthRes.body.metaWhatsAppSafety.liveSendingAllowed, false);
});

test('Scenario E — Normal Business Owner Privilege Boundary Enforcement', async () => {
  // 1. Gym Owner attempts to read Platform Admin Overview -> 403
  const ovAttempt = await request(app)
    .get('/api/platform-admin/overview')
    .set('Authorization', `Bearer ${gymOwnerToken}`);
  assert.equal(ovAttempt.status, 403);
  assert.equal(ovAttempt.body.code, 'FORBIDDEN_PLATFORM_ADMIN');

  // 2. Gym Owner attempts to read Platform Revenue -> 403
  const revAttempt = await request(app)
    .get('/api/platform-admin/revenue')
    .set('Authorization', `Bearer ${gymOwnerToken}`);
  assert.equal(revAttempt.status, 403);
  assert.equal(revAttempt.body.code, 'FORBIDDEN_PLATFORM_ADMIN');

  // 3. Gym Owner attempts to suspend Salon Workspace -> 403
  const suspAttempt = await request(app)
    .post(`/api/platform-admin/businesses/${salonWorkspace._id}/suspend`)
    .set('Authorization', `Bearer ${gymOwnerToken}`)
    .send({ reason: 'Malicious suspension attempt', stepUpConfirmed: true });
  assert.equal(suspAttempt.status, 403);
  assert.equal(suspAttempt.body.code, 'FORBIDDEN_PLATFORM_ADMIN');

  // 4. Gym Owner can still access own customer dashboard normally
  const ownDash = await request(app)
    .get('/api/workspaces/current')
    .set('Authorization', `Bearer ${gymOwnerToken}`)
    .set('x-workspace-id', gymWorkspace._id.toString());
  assert.equal(ownDash.status, 200);
});
