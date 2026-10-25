import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

import User from '../src/models/User.js';
import Workspace from '../src/models/Workspace.js';
import WorkspaceMembership from '../src/models/WorkspaceMembership.js';
import WhatsAppConnection from '../src/models/WhatsAppConnection.js';
import whatsAppBillingReadinessService from '../src/services/whatsAppBillingReadinessService.js';
import whatsAppCredentialService from '../src/services/whatsAppCredentialService.js';
import whatsAppWebhookRoutingService from '../src/services/whatsAppWebhookRoutingService.js';
import whatsAppConnectionService from '../src/services/whatsAppConnectionService.js';

let mongodInstance = null;
let userGym = null;
let workspaceGym = null;
let userSalon = null;
let workspaceSalon = null;

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

  // Provision Tenant A: FitZone Gym
  userGym = await User.create({
    name: 'Gym Owner',
    email: 'gym_' + Date.now() + '@relaytest.io',
    passwordHash: await bcrypt.hash('Password123!', 10),
    role: 'owner',
  });
  workspaceGym = await Workspace.create({
    name: 'FitZone Gym',
    slug: 'fitzone-gym-' + Date.now(),
    industryKey: 'gym',
    businessEmail: 'owner@fitzonegym.io',
    businessPhone: '+919811000001',
    createdBy: userGym._id,
  });
  await WorkspaceMembership.create({
    workspaceId: workspaceGym._id,
    userId: userGym._id,
    role: 'OWNER',
    status: 'ACTIVE',
  });

  // Provision Tenant B: Glow Salon
  userSalon = await User.create({
    name: 'Salon Owner',
    email: 'salon_' + Date.now() + '@relaytest.io',
    passwordHash: await bcrypt.hash('Password123!', 10),
    role: 'owner',
  });
  workspaceSalon = await Workspace.create({
    name: 'Glow Salon',
    slug: 'glow-salon-' + Date.now(),
    industryKey: 'salon',
    businessEmail: 'owner@glowsalon.io',
    businessPhone: '+919811000002',
    createdBy: userSalon._id,
  });
  await WorkspaceMembership.create({
    workspaceId: workspaceSalon._id,
    userId: userSalon._id,
    role: 'OWNER',
    status: 'ACTIVE',
  });

  // Create connections
  await WhatsAppConnection.create({
    workspaceId: workspaceGym._id,
    connectionStatus: 'MOCK_SIMULATED_READY',
    mode: 'MOCK',
    normalizedPhoneNumber: '+15550001111',
    phoneNumberId: 'phone_id_gym_123',
    wabaId: 'waba_id_gym_123',
    billingStatus: 'CUSTOMER_DIRECT_VERIFIED',
    createdBy: userGym._id,
  });

  await WhatsAppConnection.create({
    workspaceId: workspaceSalon._id,
    connectionStatus: 'MOCK_SIMULATED_READY',
    mode: 'MOCK',
    normalizedPhoneNumber: '+15550002222',
    phoneNumberId: 'phone_id_salon_456',
    wabaId: 'waba_id_salon_456',
    billingStatus: 'UNVERIFIED',
    createdBy: userSalon._id,
  });
});

test.after(async () => {
  await mongoose.disconnect();
  if (mongodInstance) {
    await mongodInstance.stop();
  }
});

test('SaaS 09 — Security & Billing: Customer-Direct Billing & Zero Partner Credit Sharing', () => {
  // 1. Assert zero partner credit line sharing
  assert.equal(whatsAppBillingReadinessService.assertZeroPartnerCreditSharing({}), true);
  assert.throws(
    () => whatsAppBillingReadinessService.assertZeroPartnerCreditSharing({ partnerCredit: true }),
    /FINANCIAL SECURITY VIOLATION/
  );
  assert.throws(
    () => whatsAppBillingReadinessService.assertZeroPartnerCreditSharing({ creditLineId: 'credit_123' }),
    /FINANCIAL SECURITY VIOLATION/
  );

  // 2. Unverified billing blocks live activation
  const salonConn = { billingStatus: 'UNVERIFIED', mode: 'MOCK' };
  const salonBilling = whatsAppBillingReadinessService.evaluateBillingReadiness(salonConn);
  assert.equal(salonBilling.isVerified, false);
  assert.equal(salonBilling.canActivateLive, false);
  assert.equal(salonBilling.partnerCreditAttached, false);

  // 3. Verified customer-direct billing
  const gymConn = { billingStatus: 'CUSTOMER_DIRECT_VERIFIED', mode: 'MOCK' };
  const gymBilling = whatsAppBillingReadinessService.evaluateBillingReadiness(gymConn);
  assert.equal(gymBilling.isVerified, true);
  assert.equal(gymBilling.billingResponsibility, 'CUSTOMER');
});

test('SaaS 09 — Security: Credential Service AES-256-GCM Encryption & Key Rotation', () => {
  const secretData = {
    accessToken: 'EAAG_test_mock_token_secret_12345',
    tokenExpiry: 1729500000,
    wabaId: 'waba_test_999',
  };

  // 1. Encryption
  const envelope = whatsAppCredentialService.encryptCredential(secretData);
  assert.ok(envelope.ciphertext && envelope.ciphertext.length > 0);
  assert.ok(envelope.iv && envelope.iv.length === 24); // 12 bytes hex = 24 chars
  assert.ok(envelope.authTag && envelope.authTag.length === 32); // 16 bytes hex = 32 chars
  assert.equal(envelope.keyVersion, 1);

  // 2. Decryption
  const decrypted = whatsAppCredentialService.decryptCredential(envelope);
  assert.equal(decrypted.accessToken, secretData.accessToken);
  assert.equal(decrypted.wabaId, secretData.wabaId);

  // 3. Tamper resistance: corrupted ciphertext or authTag fails
  const tamperedEnvelope = { ...envelope, authTag: '00'.repeat(16) };
  assert.throws(() => whatsAppCredentialService.decryptCredential(tamperedEnvelope));

  // 4. Key rotation
  const rotated = whatsAppCredentialService.rotateCredential(envelope);
  assert.ok(rotated.ciphertext);
  const decryptedRotated = whatsAppCredentialService.decryptCredential(rotated);
  assert.equal(decryptedRotated.accessToken, secretData.accessToken);
});

test('SaaS 09 — Security: Webhook Signature Verification & Fail-Closed Routing', async () => {
  const appSecret = 'relay_meta_app_secret_test_2026';
  const rawBody = JSON.stringify({ entry: [{ id: 'waba_123', changes: [] }] });

  // 1. Valid HMAC-SHA256 signature
  const validHmac = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const validSigHeader = `sha256=${validHmac}`;
  assert.equal(
    whatsAppWebhookRoutingService.verifySignature(rawBody, validSigHeader, appSecret),
    true
  );

  // 2. Invalid / tampered signature rejected
  assert.equal(
    whatsAppWebhookRoutingService.verifySignature(rawBody, 'sha256=invalid_hex_signature', appSecret),
    false
  );
  assert.equal(
    whatsAppWebhookRoutingService.verifySignature(rawBody, '', appSecret),
    false
  );

  // 3. Authoritative sender routing maps to Gym workspace
  const resolvedGym = await whatsAppWebhookRoutingService.resolveSenderContext({
    phoneNumberId: 'phone_id_gym_123',
  });
  assert.equal(resolvedGym.workspaceId._id.toString(), workspaceGym._id.toString());

  // 4. Authoritative sender routing maps to Salon workspace
  const resolvedSalon = await whatsAppWebhookRoutingService.resolveSenderContext({
    phoneNumberId: 'phone_id_salon_456',
  });
  assert.equal(resolvedSalon.workspaceId._id.toString(), workspaceSalon._id.toString());

  // 5. Unknown sender identity FAILS CLOSED (404)
  await assert.rejects(
    () => whatsAppWebhookRoutingService.resolveSenderContext({ phoneNumberId: 'unknown_sender_999' }),
    /UNKNOWN_SENDER_REJECTED/
  );

  // 6. Inactive connection FAILS CLOSED (403)
  await WhatsAppConnection.updateOne(
    { workspaceId: workspaceSalon._id },
    { $set: { connectionStatus: 'DISCONNECTED' } }
  );
  await assert.rejects(
    () => whatsAppWebhookRoutingService.resolveSenderContext({ phoneNumberId: 'phone_id_salon_456' }),
    /CONNECTION_INACTIVE/
  );
  // Restore
  await WhatsAppConnection.updateOne(
    { workspaceId: workspaceSalon._id },
    { $set: { connectionStatus: 'MOCK_SIMULATED_READY' } }
  );
});

test('SaaS 09 — Security: Cross-Tenant Isolation Guarantees', async () => {
  // Gym owner querying their connection gets Gym connection
  const gymConn = await whatsAppConnectionService.getConnection(workspaceGym._id);
  assert.equal(gymConn.workspaceId.toString(), workspaceGym._id.toString());
  assert.equal(gymConn.phoneNumberId, 'phone_id_gym_123');

  // Salon owner querying their connection gets Salon connection
  const salonConn = await whatsAppConnectionService.getConnection(workspaceSalon._id);
  assert.equal(salonConn.workspaceId.toString(), workspaceSalon._id.toString());
  assert.equal(salonConn.phoneNumberId, 'phone_id_salon_456');

  // Assert no cross-tenant leakage of identifiers
  assert.notEqual(gymConn.phoneNumberId, salonConn.phoneNumberId);
  assert.notEqual(gymConn.wabaId, salonConn.wabaId);
});
