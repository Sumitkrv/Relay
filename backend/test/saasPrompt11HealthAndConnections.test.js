import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';

import app from '../src/app.js';
import User from '../src/models/User.js';
import Workspace from '../src/models/Workspace.js';
import WhatsAppConnection from '../src/models/WhatsAppConnection.js';
import Message from '../src/models/Message.js';
import SupportCase from '../src/models/SupportCase.js';
import PlatformAdminGrant from '../src/models/PlatformAdminGrant.js';
import PlatformAuditLog from '../src/models/PlatformAuditLog.js';
import Contact from '../src/models/Contact.js';

let mongodInstance = null;
let adminUser = null;
let adminToken = null;
let sampleWorkspace = null;

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

  adminUser = await User.create({
    name: 'Ops Admin',
    email: `ops_${Date.now()}@relayops.io`,
    passwordHash: await bcrypt.hash('AdminPass123!', 10),
    role: 'owner',
    accountStatus: 'ACTIVE',
    isEmailVerified: true,
  });

  await PlatformAdminGrant.create({
    userId: adminUser._id,
    role: 'PLATFORM_SUPER_ADMIN',
    status: 'ACTIVE',
    permissions: [
      'platform.dashboard.read',
      'platform.connections.read',
      'platform.health.read',
      'platform.workers.read',
      'platform.audit.read',
      'platform.support.cases.read',
      'platform.support.cases.write',
    ],
    grantedBy: 'CLI_BOOTSTRAP',
  });

  adminToken = jwt.sign(
    { sub: adminUser._id.toString(), ver: adminUser.authVersion || 1 },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );

  const u = await User.create({
    name: 'Clinic User',
    email: `clinic_${Date.now()}@med.io`,
    passwordHash: 'dummy',
  });

  sampleWorkspace = await Workspace.create({
    name: 'CarePlus Clinic',
    slug: `careplus-clinic-${Date.now()}`,
    industryKey: 'clinic',
    businessEmail: 'care@med.io',
    businessPhone: '+919876543209',
    createdBy: u._id,
  });

  // Create WhatsApp connection
  await WhatsAppConnection.create({
    workspaceId: sampleWorkspace._id,
    connectionType: 'MOCK_SIMULATED',
    mode: 'MOCK',
    connectionMode: 'MOCK',
    status: 'MOCK_SIMULATED_READY',
    billingStatus: 'UNVERIFIED',
    webhookStatus: 'VERIFIED',
    phoneVerificationStatus: 'VERIFIED',
    createdBy: u._id,
  });

  const contact = await Contact.create({
    ownerId: u._id,
    workspaceId: sampleWorkspace._id,
    fullName: 'Patient Sneha',
    phoneNumber: '+919876500001',
    whatsappConsentStatus: 'Opted In',
  });

  // Seed sample message
  await Message.create({
    messageId: `msg_health_${Date.now()}`,
    ownerId: u._id,
    workspaceId: sampleWorkspace._id,
    contactId: contact._id,
    recipientPhone: '+919876500001',
    content: 'Appointment reminder message',
    status: 'SIMULATED_SENT',
    direction: 'OUTBOUND',
  });
});

test.after(async () => {
  if (mongodInstance) {
    await mongoose.disconnect();
    await mongodInstance.stop();
  }
});

test('1. Admin lists WhatsApp connections with verified safety indicators', async () => {
  const res = await request(app)
    .get('/api/platform-admin/whatsapp-connections')
    .set('Authorization', `Bearer ${adminToken}`);

  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.connections));
  assert.ok(res.body.connections.length >= 1);
  const conn = res.body.connections.find((c) => c.workspace.id === sampleWorkspace._id.toString());
  assert.ok(conn);
  assert.equal(conn.connectionType, 'MOCK_SIMULATED');
  assert.equal(conn.connectionMode, 'MOCK');
  assert.equal(conn.billingStatus, 'UNVERIFIED');
});

test('2. System Health telemetry reports database, queue, worker, and Meta lock states', async () => {
  const res = await request(app)
    .get('/api/platform-admin/system-health')
    .set('Authorization', `Bearer ${adminToken}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.database.status, 'CONNECTED');
  assert.ok(res.body.queue);
  assert.ok(res.body.worker);
  assert.equal(res.body.metaWhatsAppSafety.liveSendingAllowed, false);
  assert.match(res.body.metaWhatsAppSafety.reason, /Meta LIVE sending remains strictly disabled/i);
});

test('3. Registered worker processes endpoint returns active telemetry without message leakage', async () => {
  const res = await request(app)
    .get('/api/platform-admin/workers')
    .set('Authorization', `Bearer ${adminToken}`);

  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.workers));
  assert.ok(res.body.workers.length >= 1);
  assert.equal(res.body.workers[0].type, 'MOCK_WHATSAPP_DISPATCH');
  // Confirm no private message content is returned
  assert.equal(res.body.content, undefined);
  assert.equal(res.body.recipientPhone, undefined);
});

test('4. Support case creation and listing works with internal notes', async () => {
  const createRes = await request(app)
    .post('/api/platform-admin/support/cases')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      workspaceId: sampleWorkspace._id.toString(),
      issueCategory: 'WHATSAPP_CONNECTION',
      priority: 'HIGH',
      summary: 'Customer enquiry regarding simulated template preview',
      initialNote: 'Investigated mock template rendering; working as intended.',
    });

  assert.equal(createRes.status, 201);
  assert.equal(createRes.body.success, true);
  assert.ok(createRes.body.case.caseNumber.startsWith('CASE-'));
  assert.equal(createRes.body.case.status, 'OPEN');

  const listRes = await request(app)
    .get('/api/platform-admin/support/cases')
    .set('Authorization', `Bearer ${adminToken}`);

  assert.equal(listRes.status, 200);
  assert.ok(listRes.body.cases.length >= 1);
  const found = listRes.body.cases.find((c) => c.caseNumber === createRes.body.case.caseNumber);
  assert.ok(found);
  assert.equal(found.issueCategory, 'WHATSAPP_CONNECTION');
  assert.equal(found.notesCount, 1);
});

test('5. Automatic audit metadata sanitization strips passwords and API secrets', async () => {
  const audit = await PlatformAuditLog.create({
    adminUserId: adminUser._id,
    platformRole: 'PLATFORM_SUPER_ADMIN',
    actionType: 'security_test_redaction',
    targetResourceType: 'SYSTEM',
    reason: 'Sanitization test',
    outcome: 'SUCCESS',
    metadata: {
      safeField: 'diagnostic_check',
      password: 'SuperSecretPassword!',
      sessionToken: 'jwt.token.here',
      key_secret: 'razorpay_secret_key',
      messageText: 'Private confidential customer chat body',
    },
  });

  const saved = await PlatformAuditLog.findById(audit._id);
  assert.equal(saved.metadata.safeField, 'diagnostic_check');
  assert.equal(saved.metadata.password, '[REDACTED]');
  assert.equal(saved.metadata.sessionToken, '[REDACTED]');
  assert.equal(saved.metadata.key_secret, '[REDACTED]');
  assert.equal(saved.metadata.messageText, '[REDACTED]');
});
