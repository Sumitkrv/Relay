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
import ConsentRecord from '../src/models/ConsentRecord.js';
import Campaign from '../src/models/Campaign.js';
import CampaignExecution from '../src/models/CampaignExecution.js';
import Conversation from '../src/models/Conversation.js';
import ConversationMessage from '../src/models/ConversationMessage.js';
import BusinessProfile from '../src/models/BusinessProfile.js';
import UserPreferences from '../src/models/UserPreferences.js';

process.env.JWT_SECRET = 'prompt2-test-secret-value-32-chars-long-relay';
let mongo;
let ownerA;
let tokenA;
let ownerB;
let tokenB;

const auth = (token) => ({ Authorization: `Bearer ${token}` });

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());

  const passwordHash = await bcrypt.hash('Password123!', 10);
  ownerA = await User.create({
    name: 'M2W Realty Owner',
    email: 'm2w@relaycrm.io',
    businessName: 'M2W Realty',
    passwordHash,
    role: 'owner',
    authVersion: 1,
  });

  tokenA = jwt.sign(
    { sub: String(ownerA._id), ver: 1 },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  ownerB = await User.create({
    name: 'Other Broker',
    email: 'other@brokerage.example',
    businessName: 'Other Brokerage',
    passwordHash,
    role: 'owner',
    authVersion: 1,
  });

  tokenB = jwt.sign(
    { sub: String(ownerB._id), ver: 1 },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
});

after(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

test('Prompt 2 - SCENARIO A: Empty database for test owner produces zero counts, no fake data, and honest provider offline state', async () => {
  const res = await request(app)
    .get('/api/dashboard/overview')
    .set(auth(tokenA));

  assert.equal(res.status, 200);
  const { contacts, campaigns, upcomingCampaigns, inbox, provider, system, onboarding } = res.body;

  // Contact metrics
  assert.equal(contacts.total, 0);
  assert.equal(contacts.verifiedOptedIn, 0);
  assert.equal(contacts.optedOut, 0);
  assert.equal(contacts.unknownConsent, 0);

  // Campaign metrics
  assert.equal(campaigns.total, 0);
  assert.equal(campaigns.scheduled, 0);
  assert.equal(campaigns.running, 0);
  assert.equal(campaigns.completed, 0);
  assert.equal(campaigns.recent.length, 0);
  assert.equal(upcomingCampaigns.length, 0);

  // Inbox metrics: verifiedReplies is strictly null, not misleading 0
  assert.equal(inbox.openConversations, 0);
  assert.equal(inbox.verifiedReplies, null);
  assert.equal(inbox.verifiedRepliesAvailable, false);
  assert.ok(inbox.readinessNotice.includes('Connect WhatsApp'));

  // Truthful Provider state
  assert.equal(provider.providerName, 'Official WhatsApp Cloud API');
  assert.equal(provider.connectionStatus, 'Disconnected');
  assert.equal(provider.executionMode, 'Mock Mode (Safe)');
  assert.equal(provider.businessNumber, null);

  // System status
  assert.equal(system.backendHealth, 'CRM Online');
  assert.equal(system.databaseHealth, 'MongoDB Connected');
  assert.ok(['Mock Engine Active', 'Worker Not Running'].includes(system.workerHealth));

  // Onboarding guidance
  assert.ok(onboarding);
  assert.equal(onboarding.isComplete, false);
  assert.ok(onboarding.steps.length >= 6);
});

test('Prompt 2 - SCENARIO B: Contacts exist without consent records (Total counts, Verified Opted-In remains 0)', async () => {
  await Contact.create({
    ownerId: ownerA._id,
    fullName: 'Rahul Sharma',
    phoneNumber: '+919876543210',
    whatsappNumber: '+919876543210',
    whatsappConsentStatus: 'Unknown',
    leadStatus: 'New',
  });

  const res = await request(app)
    .get('/api/dashboard/overview')
    .set(auth(tokenA));

  assert.equal(res.status, 200);
  assert.equal(res.body.contacts.total, 1);
  assert.equal(res.body.contacts.verifiedOptedIn, 0);
  assert.equal(res.body.contacts.unknownConsent, 1);
  assert.equal(res.body.contacts.optedOut, 0);
});

test('Prompt 2 - SCENARIO C: Verified consent vs Opted-out exclusion follows strict evidence rules', async () => {
  // Contact 2: Valid affirmative consent
  const contactEligible = await Contact.create({
    ownerId: ownerA._id,
    fullName: 'Priya Patel',
    phoneNumber: '+919876543211',
    whatsappNumber: '+919876543211',
    whatsappConsentStatus: 'Opted In',
    leadStatus: 'Interested',
  });

  await ConsentRecord.create({
    ownerId: ownerA._id,
    contactId: contactEligible._id,
    status: 'Opted In',
    consentPurpose: 'Property updates and pricing brochures',
    consentSource: 'Website enquiry form',
    evidenceReference: 'Form submission #9921 on landing page',
    consentCapturedAt: new Date(),
    recordedBy: ownerA._id,
  });

  // Contact 3: Explicitly Opted Out
  await Contact.create({
    ownerId: ownerA._id,
    fullName: 'Vikram Singh',
    phoneNumber: '+919876543212',
    whatsappNumber: '+919876543212',
    whatsappConsentStatus: 'Opted Out',
    leadStatus: 'Not Interested',
  });

  const res = await request(app)
    .get('/api/dashboard/overview')
    .set(auth(tokenA));

  assert.equal(res.status, 200);
  assert.equal(res.body.contacts.total, 3);
  assert.equal(res.body.contacts.verifiedOptedIn, 1);
  assert.equal(res.body.contacts.optedOut, 1);
  assert.equal(res.body.contacts.unknownConsent, 1);
});

test('Prompt 2 - SCENARIO D & E: Campaign lifecycle, scheduled mock runs sorting and mock simulation safety', async () => {
  const futureSchedule1 = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // in 2 days
  const futureSchedule2 = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000); // in 5 days

  // Draft campaign
  await Campaign.create({
    ownerId: ownerA._id,
    createdBy: ownerA._id,
    name: 'Draft Villa Showcase',
    status: 'Draft',
  });

  // Scheduled campaign 1 (sooner)
  await Campaign.create({
    ownerId: ownerA._id,
    createdBy: ownerA._id,
    name: 'Weekend Open House Preview',
    status: 'Validated for Preparation',
    mockSchedule: {
      startAt: futureSchedule1,
      timezone: 'Asia/Kolkata',
      status: 'scheduled',
      createdAt: new Date(),
    },
    validationSummary: { counts: { total: 42, eligible: 38 } },
  });

  // Scheduled campaign 2 (later)
  await Campaign.create({
    ownerId: ownerA._id,
    createdBy: ownerA._id,
    name: 'Luxury Penthouses VIP Launch',
    status: 'Validated for Preparation',
    mockSchedule: {
      startAt: futureSchedule2,
      timezone: 'Asia/Kolkata',
      status: 'scheduled',
      createdAt: new Date(),
    },
    validationSummary: { counts: { total: 15, eligible: 15 } },
  });

  // Mock execution completed
  await CampaignExecution.create({
    ownerId: ownerA._id,
    campaignId: new mongoose.Types.ObjectId(),
    mode: 'mock',
    trigger: 'manual',
    status: 'completed',
    audienceSnapshotVersion: 1,
    totalJobs: 25,
  });

  const res = await request(app)
    .get('/api/dashboard/overview')
    .set(auth(tokenA));

  assert.equal(res.status, 200);
  const { campaigns, upcomingCampaigns } = res.body;

  assert.equal(campaigns.total, 3);
  assert.equal(campaigns.draft, 1);
  assert.equal(campaigns.scheduled, 2);
  assert.equal(campaigns.completed, 1);

  // Upcoming campaigns: must be sorted by startAt ascending (soonest first)
  assert.equal(upcomingCampaigns.length, 2);
  assert.equal(upcomingCampaigns[0].name, 'Weekend Open House Preview');
  assert.equal(upcomingCampaigns[0].audienceSize, 42);
  assert.equal(upcomingCampaigns[0].executionMode, 'Mock Simulation');
  assert.equal(upcomingCampaigns[1].name, 'Luxury Penthouses VIP Launch');
  assert.equal(upcomingCampaigns[1].audienceSize, 15);
});

test('Prompt 2 - SCENARIO F: Internal CRM inbox notes & synthetic test replies do not falsify provider metrics', async () => {
  const contact = await Contact.findOne({ ownerId: ownerA._id });

  const conv = await Conversation.create({
    ownerId: ownerA._id,
    contactId: contact._id,
    status: 'Open',
    internalUnreadCount: 2,
    source: 'manual',
  });

  // Synthetic test reply
  await ConversationMessage.create({
    ownerId: ownerA._id,
    conversationId: conv._id,
    contactId: contact._id,
    direction: 'inbound',
    messageType: 'text',
    messageSource: 'synthetic_test',
    trustLevel: 'synthetic',
    messageBody: 'I am interested in 3BHK villas.',
    providerStatus: 'Unavailable',
    simulationStatus: 'Simulated Success',
  });

  const res = await request(app)
    .get('/api/dashboard/overview')
    .set(auth(tokenA));

  assert.equal(res.status, 200);
  const { inbox } = res.body;

  assert.equal(inbox.openConversations, 1);
  assert.equal(inbox.internalUnread, 2);
  // Verified WhatsApp replies MUST remain strictly null or unavailable
  assert.equal(inbox.verifiedReplies, null);
  assert.equal(inbox.verifiedRepliesAvailable, false);
});

test('Prompt 2 - SCENARIO G: Operational Alerts ("Needs Attention") and Business Profile completeness', async () => {
  const res = await request(app)
    .get('/api/dashboard/overview')
    .set(auth(tokenA));

  assert.equal(res.status, 200);
  const { alerts, businessContext } = res.body;

  assert.equal(businessContext.businessName, 'M2W Realty');

  // Profile incomplete alert and Provider disconnected alert
  const bpAlert = alerts.find((a) => a.id === 'alert_bp_incomplete');
  assert.ok(bpAlert, 'Must alert on incomplete business profile');
  assert.equal(bpAlert.module, 'Settings');
  assert.ok(bpAlert.actionPath.includes('/settings'));

  const providerAlert = alerts.find((a) => a.id === 'alert_provider_disconnected');
  assert.ok(providerAlert, 'Must alert on disconnected WhatsApp provider');
});

test('Prompt 2 - SCENARIO H: Tenant Data Isolation (No cross-account leakage)', async () => {
  // Owner B accesses dashboard
  const resB = await request(app)
    .get('/api/dashboard/overview')
    .set(auth(tokenB));

  assert.equal(resB.status, 200);
  // Owner B must have 0 contacts and 0 campaigns despite Owner A having data
  assert.equal(resB.body.contacts.total, 0);
  assert.equal(resB.body.contacts.verifiedOptedIn, 0);
  assert.equal(resB.body.campaigns.total, 0);
  assert.equal(resB.body.upcomingCampaigns.length, 0);
  assert.equal(resB.body.inbox.openConversations, 0);
});
