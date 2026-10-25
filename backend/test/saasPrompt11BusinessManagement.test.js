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
import Contact from '../src/models/Contact.js';
import Message from '../src/models/Message.js';
import PlatformAdminGrant from '../src/models/PlatformAdminGrant.js';
import PlatformAuditLog from '../src/models/PlatformAuditLog.js';
import { processMessageJob } from '../src/services/messageQueueService.js';

let mongodInstance = null;
let adminUser = null;
let adminToken = null;
let gymOwner = null;
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

  // 1. Admin Operator
  adminUser = await User.create({
    name: 'Operator Admin',
    email: `operator_${Date.now()}@relayops.io`,
    passwordHash: await bcrypt.hash('AdminPass123!', 10),
    role: 'owner',
    accountStatus: 'ACTIVE',
    isEmailVerified: true,
  });

  await PlatformAdminGrant.create({
    userId: adminUser._id,
    role: 'PLATFORM_SUPER_ADMIN',
    status: 'ACTIVE',
    permissions: ['platform.dashboard.read', 'platform.workspaces.read', 'platform.workspaces.suspend', 'platform.workspaces.reactivate'],
    grantedBy: 'CLI_BOOTSTRAP',
  });

  adminToken = jwt.sign(
    { sub: adminUser._id.toString(), ver: adminUser.authVersion || 1 },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );

  // 2. Tenant A: FitZone Gym
  gymOwner = await User.create({
    name: 'FitZone Owner',
    email: `gym_${Date.now()}@fitzone.io`,
    passwordHash: await bcrypt.hash('GymPass123!', 10),
    role: 'owner',
    accountStatus: 'ACTIVE',
    isEmailVerified: true,
  });

  gymWorkspace = await Workspace.create({
    name: 'FitZone Gym',
    slug: `fitzone-gym-${Date.now()}`,
    industryKey: 'gym',
    businessEmail: 'contact@fitzone.io',
    businessPhone: '+919876543210',
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

  // 3. Tenant B: Glow Salon
  salonOwner = await User.create({
    name: 'Glow Salon Owner',
    email: `salon_${Date.now()}@glowsalon.io`,
    passwordHash: await bcrypt.hash('SalonPass123!', 10),
    role: 'owner',
    accountStatus: 'ACTIVE',
    isEmailVerified: true,
  });

  salonWorkspace = await Workspace.create({
    name: 'Glow Salon & Spa',
    slug: `glow-salon-${Date.now()}`,
    industryKey: 'salon',
    businessEmail: 'contact@glowsalon.io',
    businessPhone: '+919876543211',
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

test('1. Admin lists businesses with search and pagination', async () => {
  const res = await request(app)
    .get('/api/platform-admin/businesses?search=FitZone')
    .set('Authorization', `Bearer ${adminToken}`);

  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.workspaces));
  assert.equal(res.body.workspaces.length, 1);
  assert.equal(res.body.workspaces[0].name, 'FitZone Gym');
  assert.equal(res.body.workspaces[0].industryKey, 'gym');
  assert.match(res.body.workspaces[0].owner.emailMasked, /\*\*\*/); // Email masked
});

test('2. Admin filters businesses by industryKey', async () => {
  const res = await request(app)
    .get('/api/platform-admin/businesses?industry=salon')
    .set('Authorization', `Bearer ${adminToken}`);

  assert.equal(res.status, 200);
  assert.ok(res.body.workspaces.length >= 1);
  assert.equal(res.body.workspaces[0].industryKey, 'salon');
});

test('3. Admin views detailed workspace profile', async () => {
  const res = await request(app)
    .get(`/api/platform-admin/businesses/${gymWorkspace._id}`)
    .set('Authorization', `Bearer ${adminToken}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.workspace.name, 'FitZone Gym');
  assert.equal(res.body.workspace.status, 'ACTIVE');
  assert.equal(res.body.owner.name, 'FitZone Owner');
  assert.match(res.body.owner.emailMasked, /\*\*\*/);
  assert.ok(res.body.queueStats);
});

test('4. Workspace suspension fails if reason is missing or shorter than 5 chars', async () => {
  const res = await request(app)
    .post(`/api/platform-admin/businesses/${gymWorkspace._id}/suspend`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ reason: 'bad', stepUpConfirmed: true });

  assert.equal(res.status, 400);
  assert.equal(res.body.code, 'REASON_REQUIRED');
});

test('5. Workspace suspension updates status, records audit event, and preserves existing records', async () => {
  // Create sample contact to verify data remains stored
  const contact = await Contact.create({
    ownerId: gymOwner._id,
    workspaceId: gymWorkspace._id,
    fullName: 'Rahul Athlete',
    phoneNumber: '+919111222333',
    whatsappConsentStatus: 'Opted In',
  });

  const res = await request(app)
    .post(`/api/platform-admin/businesses/${gymWorkspace._id}/suspend`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ reason: 'Payment compliance investigation requested', stepUpConfirmed: true });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.workspace.status, 'SUSPENDED');

  // Verify database record
  const updatedWs = await Workspace.findById(gymWorkspace._id);
  assert.equal(updatedWs.status, 'SUSPENDED');
  assert.ok(updatedWs.suspendedAt);
  assert.equal(updatedWs.suspendedReason, 'Payment compliance investigation requested');
  assert.equal(updatedWs.suspendedBy.toString(), adminUser._id.toString());

  // Verify contact was not deleted
  const savedContact = await Contact.findById(contact._id);
  assert.ok(savedContact);
  assert.equal(savedContact.fullName, 'Rahul Athlete');

  // Verify audit log entry
  const audit = await PlatformAuditLog.findOne({
    targetResourceType: 'WORKSPACE',
    targetResourceId: gymWorkspace._id.toString(),
    actionType: 'workspace_suspended',
  });
  assert.ok(audit);
  assert.equal(audit.outcome, 'SUCCESS');
  assert.equal(audit.reason, 'Payment compliance investigation requested');
});

test('6. Suspended workspace pauses background queue dispatch without dropping jobs', async () => {
  // Enqueue a message for the suspended gym workspace
  const contact = await Contact.findOne({ workspaceId: gymWorkspace._id });
  const msg = await Message.create({
    messageId: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    ownerId: gymOwner._id,
    workspaceId: gymWorkspace._id,
    contactId: contact._id,
    recipientPhone: '+919111222333',
    content: 'Testing queue behavior on suspended workspace',
    status: 'QUEUED',
    direction: 'OUTBOUND',
  });

  // Attempt processing with worker
  const processed = await processMessageJob(msg._id, 'test-worker-1');
  assert.equal(processed, false); // Dispatch is paused!

  // Verify job remains in QUEUED status with clear failureReason, not deleted or marked completed
  const reloadedMsg = await Message.findById(msg._id);
  assert.equal(reloadedMsg.status, 'QUEUED');
  assert.match(reloadedMsg.failureReason, /Workspace is suspended/i);
});

test('7. Reactivating workspace restores ACTIVE status and audits the action', async () => {
  const res = await request(app)
    .post(`/api/platform-admin/businesses/${gymWorkspace._id}/reactivate`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ reason: 'Investigation concluded, business cleared', stepUpConfirmed: true });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.workspace.status, 'ACTIVE');

  const ws = await Workspace.findById(gymWorkspace._id);
  assert.equal(ws.status, 'ACTIVE');
  assert.ok(ws.reactivatedAt);
  assert.equal(ws.reactivationReason, 'Investigation concluded, business cleared');

  // Audit entry created
  const audit = await PlatformAuditLog.findOne({
    targetResourceType: 'WORKSPACE',
    targetResourceId: gymWorkspace._id.toString(),
    actionType: 'workspace_reactivated',
  });
  assert.ok(audit);
  assert.equal(audit.outcome, 'SUCCESS');
});

test('8. Tenant isolation: Salon workspace remained ACTIVE and completely unaffected by Gym suspension', async () => {
  const salon = await Workspace.findById(salonWorkspace._id);
  assert.equal(salon.status, 'ACTIVE');
  assert.equal(salon.suspendedAt, null);
});
