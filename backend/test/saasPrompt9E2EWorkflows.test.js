import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

import User from '../src/models/User.js';
import Workspace from '../src/models/Workspace.js';
import WorkspaceMembership from '../src/models/WorkspaceMembership.js';
import Contact from '../src/models/Contact.js';
import Campaign from '../src/models/Campaign.js';
import WhatsAppConnection from '../src/models/WhatsAppConnection.js';
import whatsAppConnectionService from '../src/services/whatsAppConnectionService.js';
import whatsAppOnboardingService from '../src/services/whatsAppOnboardingService.js';

let mongodInstance = null;
let m2wUser = null;
let m2wWorkspace = null;
let m2wContact = null;
let gymUser = null;
let gymWorkspace = null;
let salonUser = null;
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

  // Baseline M2W Realty Historical Data (Must remain completely untouched)
  m2wUser = await User.create({
    name: 'Sumit R. Thakur',
    email: 'admin_m2w_' + Date.now() + '@relaycrm.io',
    passwordHash: await bcrypt.hash('Password123!', 10),
    role: 'owner',
    businessName: 'M2W Luxury Realty',
  });
  m2wWorkspace = await Workspace.create({
    name: 'M2W Luxury Realty',
    slug: 'm2w-luxury-realty-' + Date.now(),
    industryKey: 'real_estate',
    businessEmail: 'contact@m2wrealty.io',
    businessPhone: '+919811122233',
    createdBy: m2wUser._id,
  });
  await WorkspaceMembership.create({
    workspaceId: m2wWorkspace._id,
    userId: m2wUser._id,
    role: 'OWNER',
    status: 'ACTIVE',
  });
  m2wContact = await Contact.create({
    workspaceId: m2wWorkspace._id,
    ownerId: m2wUser._id,
    fullName: 'Rajesh Verma (VIP Buyer)',
    phoneNumber: '+919811199999',
    leadSource: 'Portal Inquiry',
    whatsappConsentStatus: 'Opted In',
    isDemo: false,
  });
});

test.after(async () => {
  await mongoose.disconnect();
  if (mongodInstance) {
    await mongodInstance.stop();
  }
});

test('SaaS 09 — E2E Scenario A: FitZone Gym Onboarding (Existing App Coexistence)', async () => {
  // 1. Provision Gym
  gymUser = await User.create({
    name: 'Marcus Gym Owner',
    email: 'gym_marcus_' + Date.now() + '@fitzone.io',
    passwordHash: await bcrypt.hash('Password123!', 10),
    role: 'owner',
  });
  gymWorkspace = await Workspace.create({
    name: 'FitZone Gym',
    slug: 'fitzone-gym-' + Date.now(),
    industryKey: 'gym',
    businessEmail: 'contact@fitzone.io',
    businessPhone: '+919822000001',
    createdBy: gymUser._id,
  });
  await WorkspaceMembership.create({
    workspaceId: gymWorkspace._id,
    userId: gymUser._id,
    role: 'OWNER',
    status: 'ACTIVE',
  });

  // 2. Start Onboarding
  const attempt = await whatsAppOnboardingService.startOnboarding(gymWorkspace._id, gymUser, {
    requestedPhone: '+1 (555) 019-2831',
    countryCode: '+1',
    connectionMethod: 'EXISTING_APP_COEXISTENCE',
  });
  assert.equal(attempt.attemptStatus, 'STARTED');

  // 3. Choose Method: Option A
  await whatsAppOnboardingService.selectMethod(attempt._id, gymWorkspace._id, 'EXISTING_APP_COEXISTENCE');

  // 4. Advance through Steps 3 to 7
  for (let s = 3; s <= 7; s++) {
    const res = await whatsAppOnboardingService.advanceMockStep(attempt._id, gymWorkspace._id, {
      step: s,
      scenario: 'SCENARIO_A_APP_ELIGIBLE',
    });
    assert.equal(res.success, true);
  }

  // 5. Verify Final Connection State
  const gymConn = await whatsAppConnectionService.getConnection(gymWorkspace._id);
  assert.equal(gymConn.connectionStatus, 'MOCK_SIMULATED_READY');
  assert.equal(gymConn.connectionType, 'EXISTING_APP_COEXISTENCE');
  assert.equal(gymConn.mode, 'MOCK');
  assert.ok(gymConn.wabaId.startsWith('mock_waba_'));
  assert.ok(gymConn.phoneNumberId.startsWith('mock_phone_id_'));

  // 6. Verify Readiness
  const readiness = await whatsAppConnectionService.getReadiness(gymWorkspace._id);
  assert.equal(readiness.isMockReady, true);
  assert.equal(readiness.canActivateLive, false);
});

test('SaaS 09 — E2E Scenario B: Glow Salon Onboarding (New Cloud API Dedicated Number)', async () => {
  // 1. Provision Salon
  salonUser = await User.create({
    name: 'Elena Salon Owner',
    email: 'salon_elena_' + Date.now() + '@glowsalon.io',
    passwordHash: await bcrypt.hash('Password123!', 10),
    role: 'owner',
  });
  salonWorkspace = await Workspace.create({
    name: 'Glow Salon',
    slug: 'glow-salon-' + Date.now(),
    industryKey: 'salon',
    businessEmail: 'contact@glowsalon.io',
    businessPhone: '+919822000002',
    createdBy: salonUser._id,
  });
  await WorkspaceMembership.create({
    workspaceId: salonWorkspace._id,
    userId: salonUser._id,
    role: 'OWNER',
    status: 'ACTIVE',
  });

  // 2. Start Onboarding
  const attempt = await whatsAppOnboardingService.startOnboarding(salonWorkspace._id, salonUser, {
    requestedPhone: '+1 (555) 019-5555',
    countryCode: '+1',
    connectionMethod: 'NEW_CLOUD_API',
  });

  // 3. Choose Method: Option B
  await whatsAppOnboardingService.selectMethod(attempt._id, salonWorkspace._id, 'NEW_CLOUD_API');

  // 4. Advance through Steps 3 to 7
  for (let s = 3; s <= 7; s++) {
    const res = await whatsAppOnboardingService.advanceMockStep(attempt._id, salonWorkspace._id, {
      step: s,
      scenario: 'SCENARIO_C_CLOUD_API',
    });
    assert.equal(res.success, true);
  }

  // 5. Verify Final Connection State
  const salonConn = await whatsAppConnectionService.getConnection(salonWorkspace._id);
  assert.equal(salonConn.connectionStatus, 'MOCK_SIMULATED_READY');
  assert.equal(salonConn.connectionType, 'NEW_CLOUD_API');
  assert.notEqual(salonConn.phoneNumberId, 'mock_phone_id_' + gymWorkspace._id);
});

test('SaaS 09 — E2E Scenario C: M2W Realty Historical Data Preservation', async () => {
  // 1. Verify M2W contact is untouched
  const contactCheck = await Contact.findById(m2wContact._id);
  assert.ok(contactCheck);
  assert.equal(contactCheck.fullName, 'Rajesh Verma (VIP Buyer)');
  assert.equal(contactCheck.phoneNumber, '+919811199999');
  assert.equal(contactCheck.whatsappConsentStatus, 'Opted In');
  assert.equal(contactCheck.workspaceId.toString(), m2wWorkspace._id.toString());

  // 2. Verify M2W workspace has no polluted connections from Gym or Salon
  const m2wConn = await whatsAppConnectionService.getConnection(m2wWorkspace._id);
  assert.equal(m2wConn.exists, false, 'M2W connection remained independent without unrequested creation');

  // 3. Verify total contacts for M2W is exactly 1 genuine contact
  const totalM2WContacts = await Contact.countDocuments({ workspaceId: m2wWorkspace._id });
  assert.equal(totalM2WContacts, 1);
});
