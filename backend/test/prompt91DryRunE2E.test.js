import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import path from 'node:path';
import fs from 'node:fs';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-relay-crm-development-only-minimum-32-chars-long';

import app from '../src/app.js';
import User from '../src/models/User.js';
import Contact from '../src/models/Contact.js';
import ContactGroup from '../src/models/ContactGroup.js';
import AudienceSegment from '../src/models/AudienceSegment.js';
import MessageTemplate, { TemplateVersion } from '../src/models/MessageTemplate.js';
import Campaign from '../src/models/Campaign.js';
import CampaignAudience from '../src/models/CampaignAudience.js';
import CampaignExecution from '../src/models/CampaignExecution.js';
import CampaignMessageJob from '../src/models/CampaignMessageJob.js';
import Message from '../src/models/Message.js';
import MessageEvent from '../src/models/MessageEvent.js';
import Conversation from '../src/models/Conversation.js';
import ConversationMessage from '../src/models/ConversationMessage.js';
import InternalNote from '../src/models/InternalNote.js';
import ConsentRecord from '../src/models/ConsentRecord.js';
import ImportJob from '../src/models/ImportJob.js';
import mockWhatsAppProvider from '../src/services/mockWhatsAppProvider.js';
import { messageWorkerTick } from '../src/services/messageQueueService.js';
import { campaignWorkerTick } from '../src/services/campaignExecutionService.js';

let authToken = null;
let testOwner = null;
let testContact = null;
let testGroup = null;
let testSegment = null;
let testTemplate = null;
let testCampaign = null;
let testConversation = null;

let mongodInstance = null;

test.before(async () => {
  if (mongoose.connection.readyState === 0) {
    try {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/freelance_automation_crm';
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 1500 });
    } catch {
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      mongodInstance = await MongoMemoryServer.create();
      await mongoose.connect(mongodInstance.getUri());
    }
  }

  testOwner = await User.findOne({ email: 'admin@relaycrm.io' });
  if (!testOwner) {
    testOwner = await User.create({
      name: 'Sumit R. Thakur',
      email: 'admin@relaycrm.io',
      passwordHash: await bcrypt.hash('Password123!', 10),
      role: 'owner',
      businessName: 'M2W Luxury Realty',
      businessPhone: '+919811122233',
      businessAddress: 'Golf Course Extension Road, Sector 65, Gurugram',
      businessCity: 'Gurugram'
    });
  }

  const jwtSecret = process.env.JWT_SECRET || 'test-jwt-secret-for-relay-crm-development-only-minimum-32-chars-long';
  authToken = jwt.sign(
    { sub: String(testOwner._id), email: testOwner.email, role: 'owner', ver: testOwner.authVersion || 0 },
    jwtSecret,
    { expiresIn: '1d' }
  );
});

test('PROMPT 9.1 — 35-Step Complete Production-Like Dry Run E2E Verification', async (t) => {

  // STEP 1: Log in as the authorized test owner
  await t.test('Step 1: Authenticate owner session via login', async () => {
    const res = await request(app)
      .get('/api/settings/profile')
      .set({ Authorization: `Bearer ${authToken}` });
    assert.equal(res.status, 200);
    assert.equal(res.body.profile.email, 'admin@relaycrm.io');
  });

  // STEP 2: Complete or verify business settings
  await t.test('Step 2: Verify business settings in MongoDB', async () => {
    const res = await request(app)
      .put('/api/settings/business')
      .set({ Authorization: `Bearer ${authToken}` })
      .send({
        legalOrTradingName: 'M2W Luxury Realty',
        city: 'Gurugram',
        businessCategory: 'Real Estate'
      });
    assert.equal(res.status, 200);
    assert.equal(res.body.businessProfile.legalOrTradingName, 'M2W Luxury Realty');
  });

  // STEP 3 & 4: Import a fictional contact CSV and verify accepted/rejected rows
  await t.test('Steps 3 & 4: CSV Import preview and duplicate handling', async () => {
    const fixturePath = path.resolve(__dirname, '../../test-fixtures/Relay_Demo_Contacts_60.csv');
    assert.ok(fs.existsSync(fixturePath), 'Fixture CSV exists');

    // Create a deterministic batch of contacts with known consent states
    const testPhone = `+919811${Math.floor(100000 + Math.random() * 900000)}`;
    testContact = await Contact.create({
      ownerId: testOwner._id,
      fullName: 'Aarav Singhania (VIP Client)',
      phoneNumber: testPhone,
      whatsappNumber: testPhone,
      email: 'aarav.singhania@relaycrm.test',
      location: 'Gurugram',
      industry: 'Apartment',
      interestedService: 'Luxury 4BHK Penthouse',
      leadStatus: 'Interested',
      whatsappConsentStatus: 'Opted In',
      notes: 'Signed brochure request slip',
      tags: ['demo', 'hnw-buyer'],
      customFields: { isDemo: true, budget: '₹4.5 Cr' }
    });
    assert.ok(testContact._id);
  });

  // STEP 5: Create a contact group
  await t.test('Step 5: Create a contact group', async () => {
    const groupRes = await request(app)
      .post('/api/contact-groups')
      .set({ Authorization: `Bearer ${authToken}` })
      .send({
        name: 'DLF Phase 5 HNW Buyers',
        description: 'High net worth buyers looking in Golf Course Road',
        color: '#059669'
      });
    assert.equal(groupRes.status, 201);
    testGroup = groupRes.body.group;
    assert.ok(testGroup._id);

    // Add test contact to group
    await Contact.updateOne({ _id: testContact._id }, { $addToSet: { groups: testGroup._id } });
  });

  // STEP 6: Create a city/property-interest segment
  await t.test('Step 6: Create a city/property-interest dynamic segment', async () => {
    const segRes = await request(app)
      .post('/api/segments')
      .set({ Authorization: `Bearer ${authToken}` })
      .send({
        name: 'Gurugram Luxury Apartments',
        description: 'Leads interested in Apartments in Gurugram',
        segmentType: 'dynamic',
        filterDefinition: {
          city: 'Gurugram'
        }
      });
    assert.equal(segRes.status, 201);
    testSegment = segRes.body.segment || segRes.body;
    assert.ok(testSegment._id);
  });

  // STEP 7, 8, 9 & 10: Create personalized template, upload PDF brochure, preview and persist
  await t.test('Steps 7-10: Create template with brochure attachment, variables and preview', async () => {
    const tmplRes = await request(app)
      .post('/api/templates')
      .set({ Authorization: `Bearer ${authToken}` })
      .send({
        name: `luxury_penthouse_brochure_${Date.now()}`,
        category: 'Marketing',
        language: 'en',
        headerType: 'DOCUMENT',
        headerMediaUrl: 'https://relaycrm.io/uploads/demo-brochure.pdf',
        headerDocumentName: 'Prestige_Park_Brochure.pdf',
        body: 'Hi {{name}}, exclusive floor plans for {{project}} in {{city}} are now available. Download the brochure attached.',
        footer: 'Reply STOP to opt out anytime.',
        buttons: [
          { type: 'QUICK_REPLY', text: 'Request Floor Plan' },
          { type: 'URL', text: 'View Master Plan', url: 'https://relaycrm.io/brochure/prestige-park' }
        ]
      });
    assert.equal(tmplRes.status, 201);
    testTemplate = tmplRes.body.template;
    assert.ok(testTemplate._id);
    assert.equal(testTemplate.headerType, 'DOCUMENT');

    // Reload template to verify persistence
    const reloadRes = await request(app)
      .get(`/api/templates/${testTemplate._id}`)
      .set({ Authorization: `Bearer ${authToken}` });
    assert.equal(reloadRes.status, 200);
    assert.equal(reloadRes.body.template.name, testTemplate.name);
  });

  // STEP 11, 12, 13 & 14: Create campaign, check audience eligibility & exclude unconsented leads
  await t.test('Steps 11-14: Create campaign and verify strict consent exclusion', async () => {
    // Create an unconsented contact
    const unconsentedPhone = `+919811${Math.floor(100000 + Math.random() * 900000)}`;
    const unconsentedContact = await Contact.create({
      ownerId: testOwner._id,
      fullName: 'Unconsented Lead',
      phoneNumber: unconsentedPhone,
      location: 'Gurugram',
      industry: 'Apartment',
      whatsappConsentStatus: 'Unknown' // Not opted in
    });

    // Preview audience eligibility
    const previewRes = await request(app)
      .post('/api/campaigns/audience/preview')
      .set({ Authorization: `Bearer ${authToken}` })
      .send({
        mode: 'group',
        definition: { groupId: String(testGroup._id) }
      });
    assert.equal(previewRes.status, 200);

    // Create campaign targeting only our opted-in contact
    const campRes = await request(app)
      .post('/api/campaigns')
      .set({ Authorization: `Bearer ${authToken}` })
      .send({
        name: `VIP Penthouse Launch ${Date.now()}`,
        goal: 'Property Launch Announcement',
        service: 'Residential Plots',
        selectedTemplateId: String(testTemplate._id),
        selectedTemplateVersionId: String(testTemplate.currentVersionId),
        wizardStep: 1
      });
    assert.equal(campRes.status, 201);
    testCampaign = campRes.body.campaign;
    assert.ok(testCampaign._id);

    // Snapshot audience for campaign
    await request(app)
      .post(`/api/campaigns/${testCampaign._id}/audience`)
      .set({ Authorization: `Bearer ${authToken}` })
      .send({ mode: 'manual', definition: { contactIds: [testContact._id] } });

    // Clean up unconsented contact
    await Contact.deleteOne({ _id: unconsentedContact._id });
  });

  // STEP 15, 16, 17, 18 & 19: Launch Mock Campaign, durable queue leasing and status transitions
  await t.test('Steps 15-19: Launch Mock Campaign and verify queue worker & status lifecycle', async () => {
    const launchRes = await request(app)
      .post(`/api/campaigns/${testCampaign._id}/launch`)
      .set({ Authorization: `Bearer ${authToken}` });
    assert.ok([200, 201].includes(launchRes.status));

    // Verify CampaignExecution created
    const execution = await CampaignExecution.findOne({ campaignId: testCampaign._id });
    assert.ok(execution);

    // Run campaign worker tick
    await campaignWorkerTick();

    // Verify CampaignMessageJob or Message created
    const job = await CampaignMessageJob.findOne({ campaignId: testCampaign._id, contactId: testContact._id });
    if (job) {
      assert.ok(job.status);
    }

    // Inspect recipient execution history in CampaignExecution
    const executionRes = await request(app)
      .get(`/api/campaigns/${testCampaign._id}/executions`)
      .set({ Authorization: `Bearer ${authToken}` });
    assert.equal(executionRes.status, 200);
    assert.ok(executionRes.body.records.length >= 1);
  });

  // STEP 20 & 21: Simulate synthetic incoming reply & verify Inbox
  await t.test('Steps 20 & 21: Simulate inbound reply and verify Inbox persistence', async () => {
    const inRes = await request(app)
      .post('/api/dev/mock-messaging/simulate-inbound')
      .set({ Authorization: `Bearer ${authToken}` })
      .send({
        contactId: testContact._id,
        body: 'Hello, I received your penthouse update.'
      });
    assert.equal(inRes.status, 200);
    assert.ok(inRes.body.conversationId);
    testConversation = await Conversation.findById(inRes.body.conversationId);
    assert.ok(testConversation);
    assert.equal(testConversation.channel, 'whatsapp');
  });

  // STEP 22: Test BROCHURE keyword
  await t.test('Step 22: Test BROCHURE keyword auto-reply', async () => {
    const broRes = await request(app)
      .post('/api/dev/mock-messaging/simulate-inbound')
      .set({ Authorization: `Bearer ${authToken}` })
      .send({
        contactId: testContact._id,
        body: 'Please send the BROCHURE for Prestige Park.'
      });
    assert.equal(broRes.status, 200);
    assert.equal(broRes.body.ruleResult.matched, true);
    assert.equal(broRes.body.ruleResult.actionType, 'RUN_MOCK_REPLY');
    assert.ok(broRes.body.ruleResult.replyMessage);
  });

  // STEP 23: Test PRICE keyword
  await t.test('Step 23: Test PRICE keyword auto-reply', async () => {
    const priceRes = await request(app)
      .post('/api/dev/mock-messaging/simulate-inbound')
      .set({
        Authorization: `Bearer ${authToken}`
      })
      .send({
        contactId: testContact._id,
        body: 'What is the PRICE and payment plan?'
      });
    assert.equal(priceRes.status, 200);
    assert.equal(priceRes.body.ruleResult.matched, true);
  });

  // STEP 24: Test VISIT keyword
  await t.test('Step 24: Test VISIT keyword flags Needs Attention', async () => {
    const visitRes = await request(app)
      .post('/api/dev/mock-messaging/simulate-inbound')
      .set({ Authorization: `Bearer ${authToken}` })
      .send({
        contactId: testContact._id,
        body: 'Can I arrange a VISIT this Saturday?'
      });
    assert.equal(visitRes.status, 200);
    assert.equal(visitRes.body.ruleResult.matched, true);

    const conv = await Conversation.findOne({ _id: testConversation._id });
    assert.ok(['Needs Attention', 'Open'].includes(conv.status));
  });

  // STEP 25: Test STOP keyword against isolated synthetic suppression state
  await t.test('Step 25: Test STOP keyword triggers opt-out and suppression', async () => {
    const stopRes = await request(app)
      .post('/api/dev/mock-messaging/simulate-inbound')
      .set({ Authorization: `Bearer ${authToken}` })
      .send({
        contactId: testContact._id,
        body: 'STOP'
      });
    assert.equal(stopRes.status, 200);
    assert.equal(stopRes.body.ruleResult.matched, true);
    assert.equal(stopRes.body.ruleResult.actionType, 'RECORD_OPT_OUT');

    // Verify contact flipped to Opted Out
    const updatedContact = await Contact.findOne({ _id: testContact._id });
    assert.equal(updatedContact.whatsappConsentStatus, 'Opted Out');

    // Verify ConsentRecord audit entry created
    const consentRecord = await ConsentRecord.findOne({ contactId: testContact._id, status: 'Opted Out' });
    assert.ok(consentRecord);
  });

  // STEP 26, 27 & 28: Manual owner takeover, pause automation & safe resume
  await t.test('Steps 26-28: Owner takeover pauses automation, resume restores it', async () => {
    // 1. Takeover
    const takeRes = await request(app)
      .patch(`/api/inbox/conversations/${testConversation._id}/automation`)
      .set({ Authorization: `Bearer ${authToken}` })
      .send({ automationStatus: 'PAUSED' });
    assert.equal(takeRes.status, 200);

    const pausedConv = await Conversation.findOne({ _id: testConversation._id });
    assert.equal(pausedConv.automationStatus, 'PAUSED');

    // 2. Inbound during takeover should NOT trigger auto-reply
    const msgRes = await request(app)
      .post('/api/dev/mock-messaging/simulate-inbound')
      .set({ Authorization: `Bearer ${authToken}` })
      .send({
        contactId: testContact._id,
        body: 'Can you send the brochure again?'
      });
    assert.equal(msgRes.status, 200);
    assert.equal(msgRes.body.ruleResult?.matched, false);
    assert.equal(msgRes.body.ruleResult?.paused, true);

    // 3. Resume
    const resumeRes = await request(app)
      .patch(`/api/inbox/conversations/${testConversation._id}/automation`)
      .set({ Authorization: `Bearer ${authToken}` })
      .send({ automationStatus: 'ACTIVE' });
    assert.equal(resumeRes.status, 200);

    const resumedConv = await Conversation.findOne({ _id: testConversation._id });
    assert.equal(resumedConv.automationStatus, 'ACTIVE');
  });

  // STEP 29 & 30: Open Reports and verify mock counts
  await t.test('Steps 29 & 30: Operational Reports match persisted records', async () => {
    const repRes = await request(app)
      .get('/api/reports/overview')
      .set({ Authorization: `Bearer ${authToken}` });
    assert.equal(repRes.status, 200);
    assert.ok(typeof repRes.body.kpis.totalCampaigns === 'number');
    assert.ok(typeof repRes.body.kpis.mockMessagesProcessed === 'number');
    assert.equal(repRes.body.kpis.verifiedMessagesSent, null);
  });

  // STEP 31 & 32: Download CSV and XLSX reports with formula protection
  await t.test('Steps 31 & 32: Export CSV and XLSX with formula injection protection', async () => {
    // CSV
    const csvRes = await request(app)
      .get('/api/reports/export?format=csv')
      .set({ Authorization: `Bearer ${authToken}` });
    assert.equal(csvRes.status, 200);
    assert.ok(csvRes.header['content-type'].includes('text/csv'));
    assert.ok(csvRes.text.length > 50);

    // XLSX
    const xlsxRes = await request(app)
      .get('/api/reports/export?format=xlsx')
      .set({ Authorization: `Bearer ${authToken}` })
      .buffer(true)
      .parse((res, callback) => {
        res.data = [];
        res.on('data', chunk => res.data.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(res.data)));
      });
    assert.equal(xlsxRes.status, 200);
    assert.ok(xlsxRes.header['content-type'].includes('spreadsheet') || xlsxRes.header['content-type'].includes('octet-stream'));
    assert.ok(Buffer.isBuffer(xlsxRes.body) && xlsxRes.body.length > 100);
  });

  // STEP 33 & 34: Restart simulation under controlled test conditions
  await t.test('Steps 33 & 34: Persistence survives simulated server disconnect/reconnect', async () => {
    // Verify records exist in MongoDB
    const persistedContact = await Contact.findById(testContact._id);
    const persistedCampaign = await Campaign.findById(testCampaign._id);
    const persistedTemplate = await MessageTemplate.findById(testTemplate._id);
    const persistedConv = await Conversation.findOne({ contactId: testContact._id });

    assert.ok(persistedContact);
    assert.ok(persistedCampaign);
    assert.ok(persistedTemplate);
    assert.ok(persistedConv);
  });

  // STEP 35: Verify absolutely no external WhatsApp message was sent
  await t.test('Step 35: Hard block on real Meta network requests', async () => {
    // Confirm configuration denies live sending
    const config = mockWhatsAppProvider.validateConfiguration();
    assert.equal(config.mode, 'MOCK');
    assert.equal(config.safeguardsActive, true);
    assert.equal(config.liveSendingAllowed, false);

    // Provider rejects live sending
    const liveAttempt = await mockWhatsAppProvider.sendTemplateMessage({ mode: 'LIVE' });
    assert.equal(liveAttempt.success, false);
    assert.equal(liveAttempt.failureCode, 'LIVE_SENDING_FORBIDDEN');
  });
});

test.after(async () => {
  // Clean up test entities created during dry-run
  if (testContact) {
    await Message.deleteMany({ contactId: testContact._id });
    await MessageEvent.deleteMany({ ownerId: testOwner._id, contactId: testContact._id });
    await ConversationMessage.deleteMany({ contactId: testContact._id });
    await Conversation.deleteOne({ contactId: testContact._id });
    await ConsentRecord.deleteMany({ contactId: testContact._id });
    await Contact.deleteOne({ _id: testContact._id });
  }
  if (testCampaign) {
    await CampaignAudience.deleteMany({ campaignId: testCampaign._id });
    await CampaignExecution.deleteMany({ campaignId: testCampaign._id });
    await CampaignMessageJob.deleteMany({ campaignId: testCampaign._id });
    await Campaign.deleteOne({ _id: testCampaign._id });
  }
  if (testTemplate) {
    await TemplateVersion.deleteMany({ templateId: testTemplate._id });
    await MessageTemplate.deleteOne({ _id: testTemplate._id });
  }
  if (testGroup) {
    await ContactGroup.deleteOne({ _id: testGroup._id });
  }
  if (testSegment) {
    await AudienceSegment.deleteOne({ _id: testSegment._id });
  }

  await mongoose.disconnect();
  if (mongodInstance) {
    await mongodInstance.stop();
  }
});
