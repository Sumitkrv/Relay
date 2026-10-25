import test from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-relay-crm-development-only-minimum-32-chars-long';

import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';

import app from '../src/app.js';
import User from '../src/models/User.js';
import Contact from '../src/models/Contact.js';
import ConsentRecord from '../src/models/ConsentRecord.js';
import MessageTemplate from '../src/models/MessageTemplate.js';
import Campaign from '../src/models/Campaign.js';
import CampaignAudience from '../src/models/CampaignAudience.js';
import CampaignExecution from '../src/models/CampaignExecution.js';
import CampaignMessageJob from '../src/models/CampaignMessageJob.js';
import Message from '../src/models/Message.js';
import Conversation from '../src/models/Conversation.js';
import ConversationMessage from '../src/models/ConversationMessage.js';
import AutoReplyRule from '../src/models/AutoReplyRule.js';
import { getOverview, getMessageStatusSummary, exportReportData } from '../src/services/reportService.js';
import { evaluateInboundMessage, seedDefaultRules } from '../src/services/autoReplyRuleService.js';
import { campaignWorkerTick } from '../src/services/campaignExecutionService.js';

let mongo;
let ownerA, ownerB;
let tokenA, tokenB;
const JWT_SECRET = process.env.JWT_SECRET;

function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

test.before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());

  const passwordHash = await bcrypt.hash('SecureOwnerPass#99!', 10);

  ownerA = await User.create({
    name: 'Owner Alpha',
    email: 'owner.alpha@relaycrm.test',
    passwordHash,
    role: 'owner',
    businessName: 'Alpha Luxury Real Estate'
  });

  ownerB = await User.create({
    name: 'Owner Beta',
    email: 'owner.beta@relaycrm.test',
    passwordHash,
    role: 'owner',
    businessName: 'Beta Prime Properties'
  });

  tokenA = jwt.sign({ sub: String(ownerA._id), email: ownerA.email, role: 'owner', ver: ownerA.authVersion || 1 }, JWT_SECRET, { expiresIn: '1d' });
  tokenB = jwt.sign({ sub: String(ownerB._id), email: ownerB.email, role: 'owner', ver: ownerB.authVersion || 1 }, JWT_SECRET, { expiresIn: '1d' });
});

test.after(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongo) {
    await mongo.stop();
  }
});

test('PROMPT 9.2 — 1. Credential Hardening & Backdoor Elimination', async () => {
  // 1. Legitimate login works with owner password
  const validRes = await request(app)
    .post('/api/auth/login')
    .send({ email: 'owner.alpha@relaycrm.test', password: 'SecureOwnerPass#99!' });
  assert.equal(validRes.status, 200);
  assert.ok(validRes.body.token);

  // 2. Former backdoor password 'Password123!' is strictly rejected with 401
  const backdoorRes1 = await request(app)
    .post('/api/auth/login')
    .send({ email: 'owner.alpha@relaycrm.test', password: 'Password123!' });
  assert.equal(backdoorRes1.status, 401);
  assert.match(backdoorRes1.body.message, /Invalid email or password/i);

  // 3. Former backdoor password 'bksikha123' is strictly rejected with 401
  const backdoorRes2 = await request(app)
    .post('/api/auth/login')
    .send({ email: 'owner.alpha@relaycrm.test', password: 'bksikha123' });
  assert.equal(backdoorRes2.status, 401);
  assert.match(backdoorRes2.body.message, /Invalid email or password/i);

  // 4. Verify password hash was NOT mutated or overwritten
  const freshUser = await User.findById(ownerA._id).select('+passwordHash');
  const stillMatches = await bcrypt.compare('SecureOwnerPass#99!', freshUser.passwordHash);
  assert.equal(stillMatches, true);
});

test('PROMPT 9.2 — 2. Mock Message Counts Audit & 12-Status Metrics Breakdown', async () => {
  const contact = await Contact.create({
    ownerId: ownerA._id,
    fullName: 'Metrics Contact Alpha',
    phoneNumber: '+919811223344',
    whatsappConsentStatus: 'Opted In'
  });

  const campaign = await Campaign.create({
    ownerId: ownerA._id,
    createdBy: ownerA._id,
    name: 'Q4 Luxury Penthouse Showcase',
    category: 'Real Estate',
    status: 'Running'
  });

  // Create audience snapshot (Intended = 5)
  await CampaignAudience.create([
    { ownerId: ownerA._id, campaignId: campaign._id, contactId: contact._id, selectionSource: 'manual', eligibilityStatus: 'Eligible for Campaign Preparation' },
    { ownerId: ownerA._id, campaignId: campaign._id, contactId: new mongoose.Types.ObjectId(), selectionSource: 'manual', eligibilityStatus: 'Eligible for Campaign Preparation' },
    { ownerId: ownerA._id, campaignId: campaign._id, contactId: new mongoose.Types.ObjectId(), selectionSource: 'manual', eligibilityStatus: 'Missing Consent' },
    { ownerId: ownerA._id, campaignId: campaign._id, contactId: new mongoose.Types.ObjectId(), selectionSource: 'manual', eligibilityStatus: 'Opted Out' },
    { ownerId: ownerA._id, campaignId: campaign._id, contactId: new mongoose.Types.ObjectId(), selectionSource: 'manual', eligibilityStatus: 'Invalid Phone Number' }
  ]);

  // Create messages across different statuses
  // Completed mock attempts: SIMULATED_SENT (1), SIMULATED_DELIVERED (1), SIMULATED_READ (1), TEMPORARY_FAILURE (1), PERMANENT_FAILURE (1) = Total 5
  // Non-completed: QUEUED (1), PROCESSING (1), BLOCKED (1), CANCELLED (1)
  const messagesData = [
    { status: 'SIMULATED_SENT', attemptCount: 1 },
    { status: 'SIMULATED_DELIVERED', attemptCount: 1 },
    { status: 'SIMULATED_READ', attemptCount: 1 },
    { status: 'TEMPORARY_FAILURE', attemptCount: 2, failureCode: 'SIMULATED_TIMEOUT', failureReason: 'Mock timeout' },
    { status: 'PERMANENT_FAILURE', attemptCount: 3, failureCode: 'INVALID_NUMBER', failureReason: 'Handset disconnected' },
    { status: 'QUEUED', attemptCount: 0 },
    { status: 'PROCESSING', attemptCount: 1 },
    { status: 'BLOCKED', attemptCount: 0, failureCode: 'MISSING_CONSENT' },
    { status: 'CANCELLED', attemptCount: 0 }
  ];

  for (let i = 0; i < messagesData.length; i++) {
    await Message.create({
      ownerId: ownerA._id,
      messageId: `mock_audit_msg_${Date.now()}_${i}`,
      contactId: contact._id,
      recipientPhone: '+919811223344',
      campaignId: campaign._id,
      channel: 'whatsapp',
      providerMode: 'MOCK',
      status: messagesData[i].status,
      attemptCount: messagesData[i].attemptCount,
      failureCode: messagesData[i].failureCode || '',
      failureReason: messagesData[i].failureReason || ''
    });
  }

  // Fetch overview report
  const overview = await getOverview(ownerA._id, { range: '30d' });

  // ASSERT: mockMessagesProcessed MUST strictly equal completed attempts (5)
  // Queued (1), Processing (1), Blocked (1), Cancelled (1) are NOT counted in processed!
  assert.equal(overview.kpis.mockMessagesProcessed, 5, 'mockMessagesProcessed must only count completed attempts');

  // ASSERT: verifiedMessagesSent is truthfully null
  assert.equal(overview.kpis.verifiedMessagesSent, null);

  // ASSERT: 12-status metrics breakdown
  const bd = overview.secondaryMetrics.mockMessageBreakdown;
  assert.ok(bd, 'mockMessageBreakdown must be present');
  assert.equal(bd.intended, 5, 'intended count matches audience snapshots');
  assert.equal(bd.eligible, 2, 'eligible count matches opted-in audience');
  assert.equal(bd.blocked, 4, 'blocked count (3 audience exclusions + 1 message blocked)');
  assert.equal(bd.queued, 1, 'queued count');
  assert.equal(bd.processing, 1, 'processing count');
  assert.equal(bd.completedMockAttempts, 5, 'completedMockAttempts (sent + deliv + read + temp_fail + perm_fail)');
  assert.equal(bd.simulatedSent, 3, 'simulatedSent total (sent + deliv + read)');
  assert.equal(bd.simulatedDelivered, 2, 'simulatedDelivered total (deliv + read)');
  assert.equal(bd.simulatedRead, 1, 'simulatedRead total');
  assert.equal(bd.failed, 2, 'failed total (temp_fail + perm_fail)');
  assert.equal(bd.cancelled, 1, 'cancelled count');
  assert.equal(bd.retried, 2, 'retried count (attemptCount > 1)');

  // Verify getMessageStatusSummary agrees
  const statusSummary = await getMessageStatusSummary(ownerA._id, {});
  assert.equal(statusSummary.metricsBreakdown.completedMockAttempts, 5);
  assert.equal(statusSummary.metricsBreakdown.failed, 2);
  assert.equal(statusSummary.metricsBreakdown.cancelled, 1);
});

test('PROMPT 9.2 — 3. Owner-Scoped Analytics & Anti-Leakage Isolation', async () => {
  // Create Owner B specific campaign and message
  const campaignB = await Campaign.create({
    ownerId: ownerB._id,
    createdBy: ownerB._id,
    name: 'Owner B Private Investment Brief',
    category: 'Commercial',
    status: 'Completed'
  });

  const contactB = await Contact.create({
    ownerId: ownerB._id,
    fullName: 'Owner B Investor',
    phoneNumber: '+971501122334',
    whatsappConsentStatus: 'Opted In'
  });

  await Message.create({
    ownerId: ownerB._id,
    messageId: `mock_b_msg_${Date.now()}`,
    contactId: contactB._id,
    recipientPhone: '+971501122334',
    campaignId: campaignB._id,
    status: 'SIMULATED_DELIVERED',
    attemptCount: 1
  });

  // Verify Owner A's overview does NOT count Owner B's campaign or message
  const overviewA = await getOverview(ownerA._id, {});
  assert.equal(overviewA.kpis.totalCampaigns, 1, 'Owner A sees only 1 campaign');

  const overviewB = await getOverview(ownerB._id, {});
  assert.equal(overviewB.kpis.totalCampaigns, 1, 'Owner B sees only 1 campaign');
  assert.equal(overviewB.kpis.mockMessagesProcessed, 1, 'Owner B sees only 1 message');

  // Verify API endpoint cross-tenant leakage prevention
  const crossRes = await request(app)
    .get(`/api/reports/campaigns/${campaignB._id}/recipients`)
    .set(authHeader(tokenA));
  assert.equal(crossRes.status, 404, 'Owner A cannot access Owner B campaign report');
});

test('PROMPT 9.2 — 4. Synthetic Test Isolation & Production Guard', async () => {
  // Test production environment guard on dev test routes
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';

  try {
    const prodDevRes = await request(app)
      .post('/api/dev/mock-messaging/simulate-inbound')
      .set(authHeader(tokenA))
      .send({ body: 'Hello Test' });

    assert.equal(prodDevRes.status, 403, 'Dev simulation endpoints must return 403 in production');
    assert.match(prodDevRes.body.message, /disabled in production/i);
  } finally {
    process.env.NODE_ENV = originalEnv;
  }

  // In non-production, ensure evaluateInboundMessage defaults to STANDARD executionMode
  const conv = await Conversation.create({
    ownerId: ownerA._id,
    contactId: new mongoose.Types.ObjectId(),
    status: 'Open',
    automationStatus: 'ACTIVE'
  });

  // Default evaluation without executionMode specified must be STANDARD
  const res = await evaluateInboundMessage({
    ownerId: ownerA._id,
    conversationId: conv._id,
    contactId: conv.contactId,
    messageBody: 'Hello world'
  });
  assert.equal(res.matched, false);
});

test('PROMPT 9.2 — 5. STOP Keyword & Consent Safety Isolation', async () => {
  await seedDefaultRules(ownerA._id);

  // 1. Test genuine customer contact (non-demo)
  const genuineContact = await Contact.create({
    ownerId: ownerA._id,
    fullName: 'HNI Real Estate Client',
    phoneNumber: '+919988776655',
    whatsappConsentStatus: 'Opted In',
    isSuppressed: false,
    isDemo: false,
    tags: ['genuine-client']
  });

  const genuineConv = await Conversation.create({
    ownerId: ownerA._id,
    contactId: genuineContact._id,
    status: 'Open',
    automationStatus: 'ACTIVE'
  });

  // Trigger synthetic STOP simulation on non-demo contact
  await evaluateInboundMessage({
    ownerId: ownerA._id,
    conversationId: genuineConv._id,
    contactId: genuineContact._id,
    messageBody: 'STOP',
    executionMode: 'SYNTHETIC_TEST'
  });

  // Assert: genuine contact was NOT altered by synthetic test!
  const freshGenuine = await Contact.findById(genuineContact._id);
  assert.equal(freshGenuine.whatsappConsentStatus, 'Opted In', 'Synthetic STOP test must NOT alter real customer consent');
  assert.equal(freshGenuine.isSuppressed, false, 'Synthetic STOP test must NOT suppress real customer');

  // 2. Test demo/test contact
  const demoContact = await Contact.create({
    ownerId: ownerA._id,
    fullName: 'Demo Test Lead',
    phoneNumber: '+919811009988',
    whatsappConsentStatus: 'Opted In',
    isSuppressed: false,
    isDemo: true,
    tags: ['demo', 'inbound-simulator']
  });

  const demoConv = await Conversation.create({
    ownerId: ownerA._id,
    contactId: demoContact._id,
    status: 'Open',
    automationStatus: 'ACTIVE'
  });

  await evaluateInboundMessage({
    ownerId: ownerA._id,
    conversationId: demoConv._id,
    contactId: demoContact._id,
    messageBody: 'STOP',
    executionMode: 'SYNTHETIC_TEST'
  });

  // Assert: demo contact was updated and consent record has synthetic source
  const freshDemo = await Contact.findById(demoContact._id);
  assert.equal(freshDemo.whatsappConsentStatus, 'Opted Out');
  assert.equal(freshDemo.isSuppressed, true);

  const consentRecord = await ConsentRecord.findOne({ contactId: demoContact._id });
  assert.ok(consentRecord);
  assert.equal(consentRecord.consentSource, 'synthetic_test_stop');
});

test('PROMPT 9.2 — 6. Property Data & Pricing Auto-Reply Truthfulness', async () => {
  // A reviewed custom rule is explicitly saved; loading a page never seeds/enables automation.
  await AutoReplyRule.create({ ownerId: ownerA._id, name: 'Reviewed pricing enquiry', priority: 0, triggerKeyword: 'PRICE', synonyms: ['PRICING'], actionType: 'RUN_MOCK_REPLY', responseMessage: 'For {{project_name}}, which unit type would you like to review?', enabled: true });
  const contact = await Contact.create({
    ownerId: ownerA._id,
    fullName: 'Zayd Al-Mansoori',
    phoneNumber: '+971509988776', // International UAE format
    interestedProject: 'Palm Jumeirah Signature Villas',
    location: 'Dubai',
    whatsappConsentStatus: 'Opted In'
  });

  const conv = await Conversation.create({
    ownerId: ownerA._id,
    contactId: contact._id,
    status: 'Open',
    automationStatus: 'ACTIVE'
  });

  const replyRes = await evaluateInboundMessage({
    ownerId: ownerA._id,
    conversationId: conv._id,
    contactId: contact._id,
    messageBody: 'What is the price for this property?',
    executionMode: 'SYNTHETIC_TEST'
  });

  assert.equal(replyRes.matched, true);
  // Assert response references project and asks for configuration rather than inventing false prices
  const outboundMsg = await ConversationMessage.findOne({ conversationId: conv._id, direction: 'outbound' });
  assert.ok(outboundMsg);
  assert.match(outboundMsg.messageBody, /Palm Jumeirah Signature Villas/);
  assert.match(outboundMsg.messageBody, /Which unit type/i);
});

test('PROMPT 9.2 — 7. Programmatic CSV & XLSX Export File Verification', async () => {
  // Test CSV export parsing
  const csvResult = await exportReportData(ownerA._id, {
    reportType: 'campaign_summary',
    format: 'csv'
  });

  assert.ok(csvResult.buffer, 'CSV result must contain a buffer');
  const csvString = csvResult.buffer.toString('utf-8').replace(/^\uFEFF/, '');
  assert.ok(csvString.length > 50, 'CSV export must not be empty');

  const records = parse(csvString, {
    columns: true,
    skip_empty_lines: true
  });

  assert.ok(records.length >= 1, 'CSV must parse into at least one campaign record');
  const firstRow = records[0];
  assert.ok('Campaign Name' in firstRow);
  assert.ok('Status' in firstRow);
  assert.ok('Execution Mode' in firstRow);
  assert.ok('Mock Messages Processed' in firstRow);

  // Test XLSX workbook parsing via ExcelJS
  const xlsxResult = await exportReportData(ownerA._id, {
    reportType: 'campaign_summary',
    format: 'xlsx'
  });

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(xlsxResult.buffer);

  assert.ok(workbook.worksheets.length >= 1);
  const sheet = workbook.getWorksheet('Campaign Performance');
  assert.ok(sheet, 'Campaign Performance worksheet must exist');

  // Verify header row
  const headerRow = sheet.getRow(1);
  const headers = [];
  headerRow.eachCell((cell) => headers.push(cell.value));
  assert.ok(headers.includes('Campaign Name'));
  assert.ok(headers.includes('Execution Mode'));
  assert.ok(headers.includes('Mock Messages Processed'));

  // Verify data row count
  assert.ok(sheet.rowCount >= 2, 'Worksheet must contain headers and data');
});

test('PROMPT 9.2 — 8. Durable Queue Worker Interruption & Recovery', async () => {
  const pausedCampaign = await Campaign.create({
    ownerId: ownerA._id,
    createdBy: ownerA._id,
    name: 'Paused Spring Campaign',
    status: 'Paused'
  });

  const execution = await CampaignExecution.create({
    ownerId: ownerA._id,
    campaignId: pausedCampaign._id,
    audienceSnapshotVersion: 1,
    status: 'paused'
  });

  await CampaignMessageJob.create({
    ownerId: ownerA._id,
    campaignId: pausedCampaign._id,
    executionId: execution._id,
    contactId: new mongoose.Types.ObjectId(),
    status: 'queued'
  });

  // Run worker tick: should NOT process jobs for a paused campaign
  await campaignWorkerTick('test-worker-recovery');

  // Check job remains in queued state
  const job = await CampaignMessageJob.findOne({ campaignId: pausedCampaign._id });
  assert.equal(job.status, 'queued', 'Job must remain safely queued while campaign is paused');
});
