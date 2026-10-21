import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

import User from '../src/models/User.js';
import Workspace from '../src/models/Workspace.js';
import WorkspaceMembership from '../src/models/WorkspaceMembership.js';
import WhatsAppConnection from '../src/models/WhatsAppConnection.js';
import WhatsAppOnboardingAttempt from '../src/models/WhatsAppOnboardingAttempt.js';
import whatsAppConnectionService from '../src/services/whatsAppConnectionService.js';
import whatsAppOnboardingService, { normalizePhoneNumber } from '../src/services/whatsAppOnboardingService.js';

let mongodInstance = null;
let testUser = null;
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

  // Create isolated test user & workspace
  testUser = await User.create({
    name: 'Connection Test Owner',
    email: 'conn_owner_' + Date.now() + '@relaytest.io',
    passwordHash: await bcrypt.hash('Password123!', 10),
    role: 'owner',
  });

  testWorkspace = await Workspace.create({
    name: 'Apex Test Gym',
    slug: 'apex-test-gym-' + Date.now(),
    industryKey: 'gym',
    businessEmail: 'owner@apextestgym.io',
    businessPhone: '+919811122233',
    createdBy: testUser._id,
  });

  await WorkspaceMembership.create({
    workspaceId: testWorkspace._id,
    userId: testUser._id,
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

test('SaaS 09 — Connection Manager: Phone Normalization & Validation', async () => {
  // Valid international numbers
  assert.equal(normalizePhoneNumber('9811223344', '+91'), '+919811223344');
  assert.equal(normalizePhoneNumber('+1 (555) 234-5678'), '+15552345678');
  assert.equal(normalizePhoneNumber('07911123456', '+44'), '+447911123456');
  assert.equal(normalizePhoneNumber('501234567', '+971'), '+971501234567');

  // Rejections
  assert.throws(() => normalizePhoneNumber(''), /A valid phone number string is required/);
  assert.throws(() => normalizePhoneNumber('123', '+91'), /Invalid E.164 phone number/);
  assert.throws(() => normalizePhoneNumber('abc-invalid'), /Invalid E.164 phone number/);
});

test('SaaS 09 — Connection Manager: Start Onboarding & CSRF State Reference', async () => {
  const attempt = await whatsAppOnboardingService.startOnboarding(testWorkspace._id, testUser, {
    requestedPhone: '9811223344',
    countryCode: '+91',
    connectionMethod: 'EXISTING_APP_COEXISTENCE',
  });

  assert.ok(attempt);
  assert.equal(attempt.workspaceId.toString(), testWorkspace._id.toString());
  assert.equal(attempt.attemptStatus, 'STARTED');
  assert.equal(attempt.currentStep, 1);
  assert.equal(attempt.normalizedRequestedPhone, '+919811223344');
  assert.ok(attempt.stateReferenceHash && attempt.stateReferenceHash.length === 64);
  assert.ok(attempt.expiresAt > new Date());

  // Connection should be in SETUP_STARTED
  const conn = await whatsAppConnectionService.getConnection(testWorkspace._id);
  assert.equal(conn.connectionStatus, 'SETUP_STARTED');
  assert.equal(conn.mode, 'MOCK');
});

test('SaaS 09 — Connection Manager: Select Method (Option A vs Option B)', async () => {
  const current = await whatsAppOnboardingService.getCurrentAttempt(testWorkspace._id);
  assert.ok(current);

  // Select Option A: Existing App Coexistence
  const updated = await whatsAppOnboardingService.selectMethod(
    current._id,
    testWorkspace._id,
    'EXISTING_APP_COEXISTENCE'
  );
  assert.equal(updated.connectionMethod, 'EXISTING_APP_COEXISTENCE');
  assert.equal(updated.currentStep, 2);
  assert.equal(updated.attemptStatus, 'METHOD_CHOSEN');

  const conn = await whatsAppConnectionService.getConnection(testWorkspace._id);
  assert.equal(conn.connectionStatus, 'METHOD_SELECTED');
});

test('SaaS 09 — Connection Manager: 7-Step Mock Progression to MOCK_SIMULATED_READY', async () => {
  const current = await whatsAppOnboardingService.getCurrentAttempt(testWorkspace._id);

  // Step 3: Meta Authorization (Scenario A - Eligible)
  const step3 = await whatsAppOnboardingService.advanceMockStep(current._id, testWorkspace._id, {
    step: 3,
    scenario: 'SCENARIO_A_APP_ELIGIBLE',
  });
  assert.equal(step3.success, true);
  assert.equal(step3.attempt.currentStep, 4);

  // Step 4: Number Verification & Registration
  const step4 = await whatsAppOnboardingService.advanceMockStep(current._id, testWorkspace._id, {
    step: 4,
    scenario: 'SCENARIO_A_APP_ELIGIBLE',
    payload: { otpCode: '123456' },
  });
  assert.equal(step4.success, true);
  assert.equal(step4.attempt.currentStep, 5);

  // Step 5: Customer Meta Messaging Billing
  const step5 = await whatsAppOnboardingService.advanceMockStep(current._id, testWorkspace._id, {
    step: 5,
    scenario: 'SCENARIO_A_APP_ELIGIBLE',
  });
  assert.equal(step5.success, true);
  assert.equal(step5.attempt.currentStep, 6);

  // Step 6: Relay Software Subscription Review
  const step6 = await whatsAppOnboardingService.advanceMockStep(current._id, testWorkspace._id, {
    step: 6,
    scenario: 'SCENARIO_A_APP_ELIGIBLE',
  });
  assert.equal(step6.success, true);
  assert.equal(step6.attempt.currentStep, 7);

  // Step 7: Final Mock Activation
  const step7 = await whatsAppOnboardingService.advanceMockStep(current._id, testWorkspace._id, {
    step: 7,
    scenario: 'SCENARIO_A_APP_ELIGIBLE',
  });
  assert.equal(step7.success, true);
  assert.equal(step7.attempt.attemptStatus, 'COMPLETED');
  assert.equal(step7.connection.connectionStatus, 'MOCK_SIMULATED_READY');
  assert.equal(step7.connection.mode, 'MOCK');
  assert.ok(step7.connection.wabaId.startsWith('mock_waba_'));
  assert.ok(step7.connection.phoneNumberId.startsWith('mock_phone_id_'));

  // Independent readiness check
  const readiness = await whatsAppConnectionService.getReadiness(testWorkspace._id);
  assert.equal(readiness.overallStatus, 'MOCK_SIMULATED_READY');
  assert.equal(readiness.isMockReady, true);
  assert.equal(readiness.canActivateLive, false); // Live always strictly blocked
});

test('SaaS 09 — Connection Manager: Safe Disconnect & Reconnect Flow', async () => {
  // Disconnect
  const dis = await whatsAppConnectionService.disconnectConnection(testWorkspace._id, testUser, {
    reason: 'TEST_DISCONNECT',
  });
  assert.equal(dis.success, true);
  assert.equal(dis.connection.connectionStatus, 'DISCONNECTED');
  assert.ok(dis.connection.disconnectedAt);

  // Reconnect resets connection without creating duplicate document
  const recon = await whatsAppConnectionService.reconnectConnection(testWorkspace._id, testUser);
  assert.equal(recon.success, true);
  assert.equal(recon.connection.connectionStatus, 'SETUP_STARTED');
  assert.equal(recon.connection.disconnectedAt, null);

  const count = await WhatsAppConnection.countDocuments({ workspaceId: testWorkspace._id });
  assert.equal(count, 1, 'Only one connection record per workspace permitted');
});
