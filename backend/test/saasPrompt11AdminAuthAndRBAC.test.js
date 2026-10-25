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
import PlatformAdminGrant from '../src/models/PlatformAdminGrant.js';
import PlatformAuditLog from '../src/models/PlatformAuditLog.js';

let mongodInstance = null;
let adminUser = null;
let adminToken = null;
let normalUser = null;
let normalToken = null;
let suspendedUser = null;
let suspendedToken = null;
let limitedAdminUser = null;
let limitedAdminToken = null;

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

  // 1. Platform Super Admin User
  adminUser = await User.create({
    name: 'Super Admin Operator',
    email: `super_admin_${Date.now()}@relayops.io`,
    passwordHash: await bcrypt.hash('AdminPassword123!', 10),
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

  // 2. Normal Business Owner (No Platform Admin grant)
  normalUser = await User.create({
    name: 'FitZone Owner',
    email: `gym_owner_${Date.now()}@fitzone.io`,
    passwordHash: await bcrypt.hash('GymPassword123!', 10),
    role: 'owner',
    accountStatus: 'ACTIVE',
    isEmailVerified: true,
  });

  normalToken = jwt.sign(
    { sub: normalUser._id.toString(), ver: normalUser.authVersion || 1 },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );

  // 3. Suspended User (Has an admin grant record, but account is suspended)
  suspendedUser = await User.create({
    name: 'Suspended Admin',
    email: `suspended_admin_${Date.now()}@relayops.io`,
    passwordHash: await bcrypt.hash('Pass123!', 10),
    role: 'owner',
    accountStatus: 'SUSPENDED',
    isEmailVerified: true,
  });

  await PlatformAdminGrant.create({
    userId: suspendedUser._id,
    role: 'PLATFORM_SUPER_ADMIN',
    status: 'ACTIVE',
    grantedBy: 'CLI_BOOTSTRAP',
  });

  suspendedToken = jwt.sign(
    { sub: suspendedUser._id.toString(), ver: suspendedUser.authVersion || 1 },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );

  // 4. Limited Role Admin (Read-only dashboard, no suspend permission)
  limitedAdminUser = await User.create({
    name: 'Support Agent',
    email: `support_agent_${Date.now()}@relayops.io`,
    passwordHash: await bcrypt.hash('SupportPass123!', 10),
    role: 'owner',
    accountStatus: 'ACTIVE',
    isEmailVerified: true,
  });

  await PlatformAdminGrant.create({
    userId: limitedAdminUser._id,
    role: 'PLATFORM_SUPPORT',
    status: 'ACTIVE',
    permissions: ['platform.dashboard.read', 'platform.workspaces.read', 'platform.support.cases.read'],
    grantedBy: 'CLI_BOOTSTRAP',
  });

  limitedAdminToken = jwt.sign(
    { sub: limitedAdminUser._id.toString(), ver: limitedAdminUser.authVersion || 1 },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );
});

test.after(async () => {
  if (mongodInstance) {
    await mongoose.disconnect();
    await mongodInstance.stop();
  }
});

test('1. Unauthenticated request to /api/platform-admin/overview returns 401', async () => {
  const res = await request(app).get('/api/platform-admin/overview');
  assert.equal(res.status, 401);
  assert.match(res.body.message, /Authentication required/i);
});

test('2. Normal workspace business owner is rejected with 403 FORBIDDEN_PLATFORM_ADMIN', async () => {
  const res = await request(app)
    .get('/api/platform-admin/overview')
    .set('Authorization', `Bearer ${normalToken}`);

  assert.equal(res.status, 403);
  assert.equal(res.body.code, 'FORBIDDEN_PLATFORM_ADMIN');
});

test('3. Client-supplied forged flags (role: superadmin, isAdmin: true) are completely ignored', async () => {
  const res = await request(app)
    .get('/api/platform-admin/overview')
    .set('Authorization', `Bearer ${normalToken}`)
    .set('x-is-admin', 'true')
    .set('x-platform-role', 'PLATFORM_SUPER_ADMIN')
    .send({ isAdmin: true, role: 'PLATFORM_SUPER_ADMIN' });

  assert.equal(res.status, 403);
  assert.equal(res.body.code, 'FORBIDDEN_PLATFORM_ADMIN');
});

test('4. Suspended account is rejected with 403 ACCOUNT_SUSPENDED even if grant exists', async () => {
  const res = await request(app)
    .get('/api/platform-admin/overview')
    .set('Authorization', `Bearer ${suspendedToken}`);

  assert.equal(res.status, 403);
  assert.equal(res.body.code, 'ACCOUNT_SUSPENDED');
});

test('5. Active Platform Super Admin is accepted with 200 and authorized data', async () => {
  const res = await request(app)
    .get('/api/platform-admin/overview')
    .set('Authorization', `Bearer ${adminToken}`);

  assert.equal(res.status, 200);
  assert.ok(res.body.workspaces);
  assert.ok(res.body.subscriptions);
  assert.ok(res.body.revenue);
  assert.ok(res.body.queue);
  assert.equal(res.body.whatsapp.officialLiveSupported, false);
});

test('6. GET /api/platform-admin/me returns admin identity and permissions', async () => {
  const res = await request(app)
    .get('/api/platform-admin/me')
    .set('Authorization', `Bearer ${adminToken}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.admin.role, 'PLATFORM_SUPER_ADMIN');
  assert.ok(Array.isArray(res.body.admin.permissions));
});

test('7. Granular permission enforcement: limited support role without suspend permission is rejected', async () => {
  // Support agent has platform.workspaces.read, so reading businesses succeeds
  const readRes = await request(app)
    .get('/api/platform-admin/businesses')
    .set('Authorization', `Bearer ${limitedAdminToken}`);
  assert.equal(readRes.status, 200);

  // But trying to suspend a workspace requires platform.workspaces.suspend -> rejected with 403
  const fakeWsId = new mongoose.Types.ObjectId().toString();
  const suspendRes = await request(app)
    .post(`/api/platform-admin/businesses/${fakeWsId}/suspend`)
    .set('Authorization', `Bearer ${limitedAdminToken}`)
    .send({ reason: 'Testing permission boundaries', stepUpConfirmed: true });

  assert.equal(suspendRes.status, 403);
  assert.equal(suspendRes.body.code, 'INSUFFICIENT_ADMIN_PERMISSIONS');
});

test('8. Revoking an admin grant terminates access immediately', async () => {
  // Revoke admin grant for adminUser
  await PlatformAdminGrant.updateOne(
    { userId: adminUser._id },
    { $set: { status: 'REVOKED', revokedAt: new Date(), revocationReason: 'Administrative audit review' } }
  );

  const res = await request(app)
    .get('/api/platform-admin/overview')
    .set('Authorization', `Bearer ${adminToken}`);

  assert.equal(res.status, 403);
  assert.equal(res.body.code, 'FORBIDDEN_PLATFORM_ADMIN');

  // Restore grant for subsequent tests
  await PlatformAdminGrant.updateOne(
    { userId: adminUser._id },
    { $set: { status: 'ACTIVE', revokedAt: null } }
  );
});
