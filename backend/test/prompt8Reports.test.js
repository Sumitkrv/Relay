import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Contact from '../src/models/Contact.js';
import Campaign from '../src/models/Campaign.js';
import CampaignExecution from '../src/models/CampaignExecution.js';
import CampaignMessageJob from '../src/models/CampaignMessageJob.js';
import CampaignAudience from '../src/models/CampaignAudience.js';
import Message from '../src/models/Message.js';
import ConsentRecord from '../src/models/ConsentRecord.js';
import Conversation from '../src/models/Conversation.js';
import RuleExecution from '../src/models/RuleExecution.js';
import MessageTemplate from '../src/models/MessageTemplate.js';
import UserPreferences from '../src/models/UserPreferences.js';

process.env.JWT_SECRET = 'prompt8-reports-test-secret-key-very-secure';
let mongo, owner, otherOwner, token, otherToken, template;
const auth = (t) => ({ Authorization: `Bearer ${t}` });

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());

  owner = await User.create({
    name: 'Relay Principal Operator',
    email: 'admin@relaycrm.io',
    passwordHash: 'hashed_pw_test'
  });

  otherOwner = await User.create({
    name: 'Competitor Operator',
    email: 'other@rivalrealty.example',
    passwordHash: 'hashed_pw_test'
  });

  await UserPreferences.create({
    ownerId: owner._id,
    timezone: 'Asia/Kolkata'
  });

  token = jwt.sign({ sub: String(owner._id) }, process.env.JWT_SECRET, { expiresIn: '1h' });
  otherToken = jwt.sign({ sub: String(otherOwner._id) }, process.env.JWT_SECRET, { expiresIn: '1h' });

  template = await MessageTemplate.create({
    ownerId: owner._id,
    name: 'Luxury Villa Welcome',
    category: 'Marketing',
    language: 'en',
    body: 'Hello {{fullName}}, welcome to our exclusive collection.'
  });
});

after(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

test('Prompt 8 — SCENARIO A: Empty Database Handling (Zero vs Unavailable Truthfulness)', async () => {
  const res = await request(app).get('/api/reports/overview?range=30d').set(auth(token));
  assert.equal(res.status, 200);

  // Authoritative zeroes
  assert.equal(res.body.kpis.totalCampaigns, 0);
  assert.equal(res.body.kpis.scheduledRunningCampaigns, 0);
  assert.equal(res.body.kpis.mockMessagesProcessed, 0);

  // CRITICAL: Provider is disconnected; verified metrics MUST be null / unavailable, NEVER 0 or fabricated rate!
  assert.equal(res.body.kpis.verifiedMessagesSent, null);
  assert.equal(res.body.kpis.measurementAvailability.verifiedMessagesSent, 'UNAVAILABLE');
  assert.equal(res.body.meta.providerStatus, 'DISCONNECTED');
  assert.equal(res.body.secondaryMetrics.verifiedCustomerReplies, null);

  // Charts empty states
  assert.deepEqual(res.body.charts.campaignStatusDistribution, []);
  assert.deepEqual(res.body.charts.messageTrend, []);
  assert.deepEqual(res.body.charts.failureBreakdown, []);
  assert.equal(res.body.charts.audienceBreakdown.totalAudienceSnapshots, 0);
});

test('Prompt 8 — SCENARIO B: Mock Campaign & Audience Aggregations', async () => {
  // Create 3 contacts: 2 eligible, 1 missing consent
  const c1 = await Contact.create({
    ownerId: owner._id,
    fullName: 'Rajesh Sharma',
    phoneNumber: '+919876543210',
    whatsappConsentStatus: 'Opted In'
  });
  const c2 = await Contact.create({
    ownerId: owner._id,
    fullName: 'Pooja Verma',
    phoneNumber: '+919876543211',
    whatsappConsentStatus: 'Opted In'
  });
  const c3 = await Contact.create({
    ownerId: owner._id,
    fullName: 'Amit Patel',
    phoneNumber: '+919876543212',
    whatsappConsentStatus: 'Unknown'
  });

  // Create Campaign
  const campaign = await Campaign.create({
    ownerId: owner._id,
    createdBy: owner._id,
    name: 'Greenfield Heights Pre-Launch',
    category: 'Villas',
    status: 'Completed',
    executionMode: 'MOCK',
    selectedTemplateId: template._id,
    audienceSnapshotVersion: 1
  });

  // Snapshot audience members
  await CampaignAudience.create([
    {
      ownerId: owner._id,
      campaignId: campaign._id,
      snapshotVersion: 1,
      contactId: c1._id,
      selectionSource: 'manual',
      eligibilityStatus: 'Eligible for Campaign Preparation'
    },
    {
      ownerId: owner._id,
      campaignId: campaign._id,
      snapshotVersion: 1,
      contactId: c2._id,
      selectionSource: 'manual',
      eligibilityStatus: 'Eligible for Campaign Preparation'
    },
    {
      ownerId: owner._id,
      campaignId: campaign._id,
      snapshotVersion: 1,
      contactId: c3._id,
      selectionSource: 'manual',
      eligibilityStatus: 'Missing Consent',
      exclusionReasons: ['No recorded WhatsApp opt-in']
    }
  ]);

  // Create execution run
  const run = await CampaignExecution.create({
    ownerId: owner._id,
    campaignId: campaign._id,
    mode: 'mock',
    status: 'completed',
    audienceSnapshotVersion: 1,
    totalJobs: 2,
    startedAt: new Date(Date.now() - 60000),
    completedAt: new Date()
  });

  // Create mock message records
  await Message.create([
    {
      ownerId: owner._id,
      messageId: `msg_${Date.now()}_1`,
      contactId: c1._id,
      recipientPhone: c1.phoneNumber,
      campaignId: campaign._id,
      campaignRunId: run._id,
      channel: 'whatsapp',
      providerMode: 'MOCK',
      status: 'SIMULATED_SENT',
      attemptCount: 1,
      simulatedSentAt: new Date(),
      completedAt: new Date()
    },
    {
      ownerId: owner._id,
      messageId: `msg_${Date.now()}_2`,
      contactId: c2._id,
      recipientPhone: c2.phoneNumber,
      campaignId: campaign._id,
      campaignRunId: run._id,
      channel: 'whatsapp',
      providerMode: 'MOCK',
      status: 'PERMANENT_FAILURE',
      failureCode: 'MOCK_PERMANENT_FAILURE',
      failureReason: 'Simulated terminal transport failure',
      attemptCount: 3,
      maxAttempts: 3,
      completedAt: new Date()
    }
  ]);

  // Verify Overview reflects actual figures
  const overviewRes = await request(app).get('/api/reports/overview?range=30d').set(auth(token));
  assert.equal(overviewRes.status, 200);
  assert.equal(overviewRes.body.kpis.totalCampaigns, 1);
  assert.equal(overviewRes.body.kpis.mockMessagesProcessed, 2);
  assert.equal(overviewRes.body.kpis.verifiedMessagesSent, null); // Still unavailable
  assert.equal(overviewRes.body.secondaryMetrics.completedMockRuns, 1);

  // Verify Campaign Performance endpoint
  const perfRes = await request(app).get('/api/reports/campaigns?range=30d').set(auth(token));
  assert.equal(perfRes.status, 200);
  assert.equal(perfRes.body.records.length, 1);
  const row = perfRes.body.records[0];
  assert.equal(row.name, 'Greenfield Heights Pre-Launch');
  assert.equal(row.audienceSize, 3);
  assert.equal(row.eligibleRecipients, 2);
  assert.equal(row.excludedRecipients, 1);
  assert.equal(row.mockMessagesProcessed, 2);
  assert.equal(row.simulatedFailures, 1);
  assert.equal(row.retryAttempts, 2); // Message 2 had attemptCount: 3, which is 2 retries
});

test('Prompt 8 — SCENARIO C: Consent & Opt-Out Reporting', async () => {
  // Create opted out and suppressed contacts
  await Contact.create({
    ownerId: owner._id,
    fullName: 'Opted Out Contact',
    phoneNumber: '+919876543299',
    whatsappConsentStatus: 'Opted Out',
    isSuppressed: true,
    suppressionReason: 'STOP received via WhatsApp'
  });

  const consentRes = await request(app).get('/api/reports/consent').set(auth(token));
  assert.equal(consentRes.status, 200);
  assert.ok(consentRes.body.totalContacts >= 4);
  assert.ok(consentRes.body.contactsOptedOut >= 1);
  assert.ok(consentRes.body.suppressedDNC >= 1);

  const optOutsRes = await request(app).get('/api/reports/opt-outs').set(auth(token));
  assert.equal(optOutsRes.status, 200);
  assert.ok(optOutsRes.body.records.length >= 1);
  const optRow = optOutsRes.body.records.find((r) => r.contactPhone === '+919876543299');
  assert.ok(optRow);
  assert.equal(optRow.consentStatus, 'Opted Out');
  assert.equal(optRow.isSuppressed, true);
});

test('Prompt 8 — SCENARIO D: Retry Analytics & Logical Message Isolation', async () => {
  const retryRes = await request(app).get('/api/reports/messages/retries?range=30d').set(auth(token));
  assert.equal(retryRes.status, 200);
  // Message 2 had attemptCount: 3
  assert.equal(retryRes.body.messagesRequiringRetry, 1);
  assert.equal(retryRes.body.totalRetryAttempts, 2);
  assert.equal(retryRes.body.retriesExhausted, 1);
});

test('Prompt 8 — SCENARIO E: Campaign Comparison (2-4 Campaigns)', async () => {
  // Create a second campaign
  const campaign2 = await Campaign.create({
    ownerId: owner._id,
    createdBy: owner._id,
    name: 'Oceanview Towers Phase 2',
    category: 'Apartments',
    status: 'Draft',
    executionMode: 'MOCK',
    selectedTemplateId: template._id
  });

  const campaignsRes = await request(app).get('/api/reports/campaigns').set(auth(token));
  const ids = campaignsRes.body.records.map((c) => c._id);
  assert.ok(ids.length >= 2);

  // Compare 2 campaigns
  const compareRes = await request(app)
    .get(`/api/reports/campaigns/compare?ids=${ids[0]},${ids[1]}`)
    .set(auth(token));
  assert.equal(compareRes.status, 200);
  assert.equal(compareRes.body.count, 2);
  assert.ok(compareRes.body.campaigns[0].name);
  assert.ok(compareRes.body.campaigns[1].name);

  // Reject < 2 or > 4 campaigns
  const invalidCompare = await request(app)
    .get(`/api/reports/campaigns/compare?ids=${ids[0]}`)
    .set(auth(token));
  assert.equal(invalidCompare.status, 400);
});

test('Prompt 8 — SCENARIO F: CSV Export Filter Matching & Formula Injection Protection', async () => {
  // Test formula injection protection
  const maliciousContact = await Contact.create({
    ownerId: owner._id,
    fullName: '=SUM(1+2)', // Formula injection attack
    phoneNumber: '+19876543200',
    whatsappConsentStatus: 'Opted In'
  });

  const maliciousCampaign = await Campaign.create({
    ownerId: owner._id,
    createdBy: owner._id,
    name: '@malicious_cmd', // Formula injection attack
    category: '+FormulaCategory',
    status: 'Ready'
  });

  await CampaignAudience.create({
    ownerId: owner._id,
    campaignId: maliciousCampaign._id,
    snapshotVersion: 1,
    contactId: maliciousContact._id,
    selectionSource: 'manual',
    eligibilityStatus: 'Eligible for Campaign Preparation'
  });

  // Export Campaign Summary CSV
  const csvRes = await request(app)
    .post('/api/reports/export')
    .set(auth(token))
    .send({
      reportType: 'campaign_summary',
      format: 'csv'
    });

  assert.equal(csvRes.status, 200);
  assert.match(csvRes.headers['content-type'], /text\/csv/);
  const csvText = csvRes.text;

  // Formula triggers must be neutralized by prefixing with a single quote (')
  assert.ok(!csvText.includes('"@malicious_cmd"'));
  assert.ok(csvText.includes("\"'@malicious_cmd\"") || csvText.includes("'@malicious_cmd"));

  // Export Recipients CSV for malicious campaign
  const recipCsvRes = await request(app)
    .post('/api/reports/export')
    .set(auth(token))
    .send({
      reportType: 'campaign_recipients',
      format: 'csv',
      filters: { campaignId: String(maliciousCampaign._id) }
    });

  assert.equal(recipCsvRes.status, 200);
  const recipCsvText = recipCsvRes.text;
  assert.ok(!recipCsvText.includes('"=SUM(1+2)"'));
  assert.ok(recipCsvText.includes("\"'=SUM(1+2)\"") || recipCsvText.includes("'=SUM(1+2)"));
});

test('Prompt 8 — SCENARIO G: XLSX (Excel) Workbook Generation', async () => {
  const xlsxRes = await request(app)
    .post('/api/reports/export')
    .set(auth(token))
    .buffer(true)
    .parse((res, callback) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => callback(null, Buffer.concat(chunks)));
    })
    .send({
      reportType: 'campaign_summary',
      format: 'xlsx'
    });

  assert.equal(xlsxRes.status, 200);
  assert.match(
    xlsxRes.headers['content-type'],
    /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/
  );
  assert.ok(Number(xlsxRes.headers['content-length']) > 500);
  assert.ok(xlsxRes.body.length > 500);
});

test('Prompt 8 — SCENARIO H: Multi-Tenant Owner Isolation', async () => {
  // otherOwner cannot see owner's campaigns in reports
  const otherCampaigns = await request(app).get('/api/reports/campaigns').set(auth(otherToken));
  assert.equal(otherCampaigns.status, 200);
  assert.equal(otherCampaigns.body.records.length, 0);

  // otherOwner cannot export or access owner's campaign recipients
  const ownerCampaign = await Campaign.findOne({ ownerId: owner._id }).lean();
  const unauthorizedRecip = await request(app)
    .get(`/api/reports/campaigns/${ownerCampaign._id}/recipients`)
    .set(auth(otherToken));
  assert.equal(unauthorizedRecip.status, 404);
});

after(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongo) {
    await mongo.stop();
  }
});

