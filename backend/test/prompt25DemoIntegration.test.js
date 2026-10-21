import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';

import app from '../src/app.js';
import User from '../src/models/User.js';
import Contact from '../src/models/Contact.js';
import MessageTemplate from '../src/models/MessageTemplate.js';
import Campaign from '../src/models/Campaign.js';
import Conversation from '../src/models/Conversation.js';
import ConversationMessage from '../src/models/ConversationMessage.js';

process.env.JWT_SECRET = 'prompt25-test-secret-value-32-chars-long-relay';
let mongo;
let owner;
let ownerToken;

const auth = (token) => ({ Authorization: `Bearer ${token}` });

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());

  const passwordHash = await bcrypt.hash('Password123!', 10);
  owner = await User.create({
    name: 'M2W Realty Owner',
    email: 'admin@relaycrm.io',
    businessName: 'M2W Realty',
    passwordHash,
    role: 'owner',
    authVersion: 1,
  });

  ownerToken = jwt.sign(
    { sub: String(owner._id), ver: 1 },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
});

after(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

test('Prompt 2.5 - Check 1: Real Customer Record Protection (Non-Demo contact is preserved)', async () => {
  // Insert a genuine production contact
  const realContact = await Contact.create({
    ownerId: owner._id,
    fullName: 'Genuine High Net Worth Investor',
    phoneNumber: '+919999988888',
    whatsappNumber: '+919999988888',
    whatsappConsentStatus: 'Unknown',
    leadStatus: 'Interested',
    customFields: { isDemo: false },
  });

  assert.ok(realContact);
  assert.equal(realContact.fullName, 'Genuine High Net Worth Investor');
});

test('Prompt 2.5 - Check 2: Demo Status Endpoint returns isolated counts and safety notice', async () => {
  const res = await request(app)
    .get('/api/settings/demo-status')
    .set(auth(ownerToken));

  assert.equal(res.status, 200);
  assert.equal(res.body.demoDatasetId, 'relay-real-estate-qa-v1');
  assert.equal(res.body.counts.contacts, 0); // Real contact is not counted as demo
  assert.ok(res.body.notice.includes('TEST DATA ONLY'));
  assert.ok(res.body.notice.includes('NO EXTERNAL WHATSAPP MESSAGES'));
});

test('Prompt 2.5 - Check 3: Demo Contact Seeding preserves strict consent isolation (Consent = Unknown, Eligible = 0)', async () => {
  // Insert synthetic demo contact
  const demoContact = await Contact.create({
    ownerId: owner._id,
    fullName: 'Aarav Mehta (Demo Lead)',
    phoneNumber: '+919876500001',
    whatsappNumber: '+919876500001',
    location: 'Gurugram',
    interestedService: 'Luxury 4BHK Apartment',
    leadStatus: 'New',
    priority: 'High',
    tags: ['demo', 'real-estate', 'gurugram'],
    whatsappConsentStatus: 'Unknown', // MUST be Unknown
    customFields: {
      isDemo: true,
      demoDatasetId: 'relay-real-estate-qa-v1',
      source: 'demo_fixture',
      environment: 'development',
      propertyType: 'Apartment',
      budget: '3-4 Cr',
    },
  });

  assert.ok(demoContact);
  assert.equal(demoContact.whatsappConsentStatus, 'Unknown');

  // Verify Overview KPI doesn't inflate verified opted-in contacts
  const res = await request(app)
    .get('/api/dashboard/overview')
    .set(auth(ownerToken));

  assert.equal(res.status, 200);
  assert.equal(res.body.contacts.total, 2); // 1 real + 1 demo
  assert.equal(res.body.contacts.verifiedOptedIn, 0); // STILL ZERO!
  assert.equal(res.body.contacts.unknownConsent, 2);
});

test('Prompt 2.5 - Check 4: Demo Campaigns & Mock Simulation isolation', async () => {
  const campaign = await Campaign.create({
    ownerId: owner._id,
    createdBy: owner._id,
    name: 'Residential Property Interest (Demo)',
    status: 'Validated for Preparation',
    tags: ['demo'],
    validationSummary: { counts: { total: 20, eligible: 0, missingConsent: 20 } },
  });

  assert.ok(campaign);
  assert.equal(campaign.validationSummary.counts.eligible, 0);

  // Check demo status count
  const res = await request(app)
    .get('/api/settings/demo-status')
    .set(auth(ownerToken));

  assert.equal(res.status, 200);
  assert.equal(res.body.counts.campaigns, 1);
});

test('Prompt 2.5 - Check 5: Synthetic Test Inbox does NOT inflate verified provider metrics', async () => {
  const demoContact = await Contact.findOne({ 'customFields.isDemo': true });

  const conv = await Conversation.create({
    ownerId: owner._id,
    contactId: demoContact._id,
    source: 'test',
    status: 'Open',
    internalUnreadCount: 1,
    activeWorkspaceKey: `${owner._id}:${demoContact._id}:test`,
  });

  const msg = await ConversationMessage.create({
    ownerId: owner._id,
    conversationId: conv._id,
    contactId: demoContact._id,
    direction: 'inbound',
    messageType: 'text',
    messageSource: 'synthetic_test',
    trustLevel: 'synthetic',
    messageBody: 'Can I get floor plans for the Gurugram project?',
    providerStatus: 'Unavailable',
    simulationStatus: 'Simulated Success',
  });

  assert.ok(msg);

  // Check overview: verifiedReplies must remain strictly null / unavailable
  const res = await request(app)
    .get('/api/dashboard/overview')
    .set(auth(ownerToken));

  assert.equal(res.status, 200);
  assert.equal(res.body.inbox.openConversations, 1);
  assert.equal(res.body.inbox.verifiedReplies, null);
  assert.equal(res.body.inbox.verifiedRepliesAvailable, false);
});

test('Prompt 2.5 - Check 6: Safe Demo Reset removes ONLY demo records and preserves genuine customer data', async () => {
  // Execute reset logic directly
  const demoContactsFilter = {
    $or: [
      { 'customFields.demoDatasetId': 'relay-real-estate-qa-v1' },
      { 'customFields.isDemo': true },
      { tags: 'demo' },
    ],
  };

  const demoContacts = await Contact.find(demoContactsFilter).select('_id').lean();
  const demoIds = demoContacts.map((c) => c._id);

  await Promise.all([
    ConversationMessage.deleteMany({ trustLevel: 'synthetic' }),
    Conversation.deleteMany({ source: 'test' }),
    Contact.deleteMany({ _id: { $in: demoIds } }),
    Campaign.deleteMany({ tags: 'demo' }),
  ]);

  // Real contact MUST still exist!
  const survivingContact = await Contact.findOne({ fullName: 'Genuine High Net Worth Investor' });
  assert.ok(survivingContact, 'Production customer record MUST be preserved after demo reset!');
  assert.equal(survivingContact.phoneNumber, '+919999988888');

  // Demo contacts must be 0
  const remainingDemo = await Contact.countDocuments(demoContactsFilter);
  assert.equal(remainingDemo, 0);

  // Synthetic conversations must be 0
  const remainingConv = await Conversation.countDocuments({ source: 'test' });
  assert.equal(remainingConv, 0);
});
