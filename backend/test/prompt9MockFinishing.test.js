import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app.js';
import mockWhatsAppProvider from '../src/services/mockWhatsAppProvider.js';
import providerRegistry from '../src/services/messagingProviderRegistry.js';
import User from '../src/models/User.js';
import Contact from '../src/models/Contact.js';
import MessageTemplate from '../src/models/MessageTemplate.js';
import Conversation from '../src/models/Conversation.js';
import ConversationMessage from '../src/models/ConversationMessage.js';
import Message from '../src/models/Message.js';
import MessageEvent from '../src/models/MessageEvent.js';
import ConsentRecord from '../src/models/ConsentRecord.js';
import { getFixturesStatus, seedDemoDataForOwner, resetDemoDataForOwner } from '../src/services/demoDataService.js';

import jwt from 'jsonwebtoken';

let authToken = null;
let testOwner = null;

test.before(async () => {
  if (mongoose.connection.readyState === 0) {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/freelance_automation_crm';
    await mongoose.connect(mongoUri);
  }

  testOwner = await User.findOne({ email: 'admin@relaycrm.io' });
  if (!testOwner) {
    testOwner = await User.create({
      name: 'Sumit Thakur',
      email: 'admin@relaycrm.io',
      passwordHash: 'hashed_pw_test',
      role: 'owner',
      businessName: 'M2W Luxury Realty',
      businessPhone: '+919811122233',
      businessAddress: 'Golf Course Extension Road, Sector 65, Gurugram',
      businessCity: 'Gurugram'
    });
  }

  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-relay-crm-development-only-minimum-32-chars-long';
  authToken = jwt.sign(
    { sub: String(testOwner._id), email: testOwner.email, role: testOwner.role || 'owner', ver: testOwner.authVersion || 0 },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );
});


test('Prompt 9 — 1. MockWhatsAppProvider Contract (All 13 Methods)', async (t) => {
  await t.test('validateConfiguration returns MOCK mode and active safeguards', () => {
    const config = mockWhatsAppProvider.validateConfiguration();
    assert.equal(config.valid, true);
    assert.equal(config.mode, 'MOCK');
    assert.equal(config.safeguardsActive, true);
    assert.equal(config.liveSendingAllowed, false);
  });

  await t.test('getConnectionStatus truthfully reports official Meta disconnected', () => {
    const status = mockWhatsAppProvider.getConnectionStatus();
    assert.equal(status.connected, false);
    assert.equal(status.officialMetaConnected, false);
    assert.equal(status.mockEngineReady, true);
    assert.equal(status.mode, 'MOCK');
  });

  await t.test('getProviderCapabilities reports template and session messaging support', () => {
    const caps = mockWhatsAppProvider.getProviderCapabilities();
    assert.equal(caps.supportsTemplates, true);
    assert.equal(caps.supportsQuickReplies, true);
    assert.equal(caps.supportsDocumentHeaders, true);
    assert.equal(caps.supportsSessionMessages, true);
    assert.equal(caps.liveMetaSending, false);
  });

  await t.test('mapProviderMessageId produces recognizable mock_msg_ prefix', () => {
    const id = mockWhatsAppProvider.mapProviderMessageId();
    assert.ok(id.startsWith('mock_msg_'), `Expected mock_msg_ prefix, got ${id}`);
  });

  await t.test('prepareTemplatePayload shapes valid WhatsApp Cloud API structure', () => {
    const payload = mockWhatsAppProvider.prepareTemplatePayload({
      template: {
        name: 'luxury_villa_launch',
        category: 'Marketing',
        headerType: 'TEXT',
        header: 'New Launch',
        body: 'Hi {{name}}, explore {{project}} in {{city}}.',
        footer: 'Reply STOP to opt out'
      },
      contact: {
        fullName: 'Vikram Malhotra',
        phoneNumber: '+919811223344',
        location: 'Gurugram'
      },
      variables: {
        name: 'Vikram Malhotra',
        project: 'The Camellias',
        city: 'Gurugram'
      }
    });

    assert.equal(payload.valid, true);
    assert.equal(payload.messaging_product, 'whatsapp');
    assert.equal(payload.to.replace(/^\+/, ''), '919811223344');
    assert.equal(payload.template.name, 'luxury_villa_launch');
    assert.ok(payload.providerMessageId.startsWith('mock_msg_'));
  });

  await t.test('validateTemplatePayload validates required body component', () => {
    const invalid = mockWhatsAppProvider.validateTemplatePayload({ template: {} });
    assert.equal(invalid.valid, false);

    const valid = mockWhatsAppProvider.validateTemplatePayload({
      to: '+919811223344',
      template: {
        name: 'valid_template',
        components: [{ type: 'body', parameters: [{ type: 'text', text: 'Hello' }] }]
      }
    });
    assert.equal(valid.valid, true);
  });

  await t.test('prepareMedia handles image and pdf without inventing Meta IDs', () => {
    const docMedia = mockWhatsAppProvider.prepareMedia({
      mediaType: 'DOCUMENT',
      url: '/uploads/brochure.pdf',
      filename: 'Prestige_Brochure.pdf'
    });
    assert.equal(docMedia.type, 'document');
    assert.equal(docMedia.isMockReference, true);
    assert.equal(docMedia.verifiedMetaMediaId, null);
  });

  await t.test('normalizeInboundMessage wraps synthetic incoming WhatsApp text', () => {
    const normalized = mockWhatsAppProvider.normalizeInboundMessage({
      from: '+919811223344',
      body: 'What is the price?'
    });
    assert.equal(normalized.direction, 'inbound');
    assert.equal(normalized.body, 'What is the price?');
    assert.equal(normalized.source, 'SYNTHETIC_TEST');
    assert.ok(normalized.providerMessageId.startsWith('mock_msg_'));
  });

  await t.test('normalizeStatusEvent maps delivery and read events', () => {
    const delivered = mockWhatsAppProvider.normalizeStatusEvent({
      status: 'delivered',
      providerMessageId: 'mock_msg_12345'
    });
    assert.equal(delivered.status, 'SIMULATED_DELIVERED');
    assert.equal(delivered.providerMessageId, 'mock_msg_12345');
  });

  await t.test('normalizeProviderError produces structured failure classifications', () => {
    const rateLimitErr = mockWhatsAppProvider.normalizeProviderError({
      error: { code: 130429, message: 'Rate limit hit' }
    });
    assert.equal(rateLimitErr.failureCode, 'RATE_LIMIT_EXCEEDED');
    assert.equal(rateLimitErr.retryable, true);
  });

  await t.test('verifyInboundEventSource flags synthetic source in sandbox mode', () => {
    const verified = mockWhatsAppProvider.verifyInboundEventSource({});
    assert.equal(verified.verified, true);
    assert.equal(verified.source, 'SYNTHETIC_TEST');
  });

  await t.test('sendSessionMessage enforces 24-hour customer service window', async () => {
    // Recent conversation (< 24 hours)
    const allowed = await mockWhatsAppProvider.sendSessionMessage({
      recipientPhone: '+919811223344',
      messageText: 'Thank you for contacting M2W Realty!',
      conversation: {
        lastCustomerMessageAt: new Date(Date.now() - 3600000) // 1 hour ago
      }
    });
    assert.equal(allowed.success, true);
    assert.equal(allowed.status, 'SIMULATED_SENT');

    // Expired conversation (> 24 hours)
    const blocked = await mockWhatsAppProvider.sendSessionMessage({
      recipientPhone: '+919811223344',
      messageText: 'Checking in on your property search',
      conversation: {
        lastCustomerMessageAt: new Date(Date.now() - 90000000) // 25 hours ago
      }
    });
    assert.equal(blocked.success, false);
    assert.equal(blocked.failureCode, 'SESSION_WINDOW_EXPIRED');
  });
});

test('Prompt 9 — 2. Hard Block on Real LIVE Sending', async (t) => {
  await t.test('Provider Registry strictly forbids LIVE mode with 403', () => {
    assert.throws(
      () => providerRegistry.getProvider('LIVE'),
      (err) => err.status === 403 && (err.code === 'LIVE_MODE_DISABLED' || err.code === 'PROD_FORBIDDEN')
    );
  });

  await t.test('mockWhatsAppProvider rejects any live sending attempt', async () => {
    const result = await mockWhatsAppProvider.sendMessage(
      { to: '+919811223344', body: 'Test' },
      { mode: 'LIVE' }
    );
    assert.equal(result.success, false);
    assert.equal(result.failureCode, 'LIVE_SENDING_FORBIDDEN');
  });
});

test('Prompt 9 — 3. Simulated Outage and Recovery', async (t) => {
  mockWhatsAppProvider.setSimulatedOutage(true);
  const outageStatus = mockWhatsAppProvider.getConnectionStatus();
  assert.equal(outageStatus.mockEngineReady, false);
  assert.equal(outageStatus.status, 'OUTAGE_SIMULATED');

  const sendDuringOutage = await mockWhatsAppProvider.sendMessage({
    to: '+919811223344',
    body: 'Outage test'
  });
  assert.equal(sendDuringOutage.success, false);
  assert.equal(sendDuringOutage.failureCode, 'MOCK_PROVIDER_UNAVAILABLE');

  // Recover
  mockWhatsAppProvider.setSimulatedOutage(false);
  const recoveryStatus = mockWhatsAppProvider.getConnectionStatus();
  assert.equal(recoveryStatus.mockEngineReady, true);
  assert.equal(recoveryStatus.status, 'SANDBOX_READY');
});

test('Prompt 9 — 4. Template Mock Approval Lifecycle (POST /:id/mock-approval)', async (t) => {
  const template = await MessageTemplate.create({
    ownerId: testOwner._id,
    name: `Mock_Approval_Test_${Date.now()}`,
    description: 'Test template for mock approval lifecycle',
    category: 'Marketing',
    language: 'en',
    headerType: 'NONE',
    body: 'Hi {{name}}, this is a mock approval test.',
    localStatus: 'Ready for Submission',
    providerStatus: 'Not Submitted',
    mockProviderApprovalStatus: 'Not Submitted'
  });

  // 1. Submit for simulated review
  const submitRes = await request(app)
    .post(`/api/templates/${template._id}/mock-approval`)
    .set({ Authorization: `Bearer ${authToken}` })
    .send({ status: 'Simulated Submission' });

  assert.equal(submitRes.status, 200);
  assert.equal(submitRes.body.template.mockProviderApprovalStatus, 'Simulated Submission');
  assert.equal(submitRes.body.template.providerStatus, 'Not Submitted'); // Real status untouched

  // 2. Simulated Approval
  const approveRes = await request(app)
    .post(`/api/templates/${template._id}/mock-approval`)
    .set({ Authorization: `Bearer ${authToken}` })
    .send({ status: 'Simulated Approved' });

  assert.equal(approveRes.status, 200);
  assert.equal(approveRes.body.template.mockProviderApprovalStatus, 'Simulated Approved');

  // Clean up
  await MessageTemplate.deleteOne({ _id: template._id });
});

test('Prompt 9 — 5. Simulated Inbound Pipeline & Keyword Automation (POST /api/dev/mock-messaging/simulate-inbound)', async (t) => {
  // Create an isolated test contact
  const contact = await Contact.create({
    ownerId: testOwner._id,
    fullName: 'Rohan Deshmukh (Test Lead)',
    phoneNumber: `+91981199${Math.floor(1000 + Math.random() * 9000)}`,
    email: 'rohan.deshmukh@relay-realestate.test',
    location: 'Gurugram',
    industry: 'Apartment',
    leadStatus: 'Interested',
    whatsappConsentStatus: 'Opted In',
    tags: ['demo', 'pipeline-test']
  });

  // A. Trigger BROCHURE rule
  const brochureRes = await request(app)
    .post('/api/dev/mock-messaging/simulate-inbound')
    .set({ Authorization: `Bearer ${authToken}` })
    .send({
      contactId: contact._id,
      body: 'Hi, please send the BROCHURE for Prestige Park.'
    });

  assert.equal(brochureRes.status, 200);
  assert.equal(brochureRes.body.success, true);
  assert.equal(brochureRes.body.ruleResult.matched, true);
  assert.equal(brochureRes.body.ruleResult.actionType, 'RUN_MOCK_REPLY');
  assert.ok(brochureRes.body.ruleResult.replyMessage);

  // B. Trigger PRICE rule
  const priceRes = await request(app)
    .post('/api/dev/mock-messaging/simulate-inbound')
    .set({ Authorization: `Bearer ${authToken}` })
    .send({
      contactId: contact._id,
      body: 'What is the PRICE and payment plan?'
    });

  assert.equal(priceRes.status, 200);
  assert.equal(priceRes.body.ruleResult.matched, true);
  assert.equal(priceRes.body.ruleResult.actionType, 'RUN_MOCK_REPLY');

  // C. Trigger VISIT rule -> Marks Needs Attention
  const visitRes = await request(app)
    .post('/api/dev/mock-messaging/simulate-inbound')
    .set({ Authorization: `Bearer ${authToken}` })
    .send({
      contactId: contact._id,
      body: 'Can I VISIT the property this Saturday?'
    });

  assert.equal(visitRes.status, 200);
  assert.equal(visitRes.body.ruleResult.matched, true);
  assert.equal(visitRes.body.ruleResult.actionType, 'MARK_NEEDS_ATTENTION');

  // Verify conversation status is Needs Attention
  const conv = await Conversation.findById(visitRes.body.conversationId);
  assert.equal(conv.status, 'Needs Attention');

  // D. Trigger STOP rule -> Authoritative Opt-Out
  const stopRes = await request(app)
    .post('/api/dev/mock-messaging/simulate-inbound')
    .set({ Authorization: `Bearer ${authToken}` })
    .send({
      contactId: contact._id,
      body: 'STOP'
    });

  assert.equal(stopRes.status, 200);
  assert.equal(stopRes.body.ruleResult.matched, true);
  assert.equal(stopRes.body.ruleResult.actionType, 'RECORD_OPT_OUT');

  // Verify Contact is Opted Out
  const updatedContact = await Contact.findById(contact._id);
  assert.equal(updatedContact.whatsappConsentStatus, 'Opted Out');

  // Clean up
  await Contact.deleteOne({ _id: contact._id });
  await Conversation.deleteOne({ _id: conv._id });
  await ConversationMessage.deleteMany({ conversationId: conv._id });
});

test('Prompt 9 — 6. Simulated Status Transitions (POST /api/dev/mock-messaging/simulate-status)', async (t) => {
  const contact = await Contact.create({
    ownerId: testOwner._id,
    fullName: 'Test Status Prospect',
    phoneNumber: `+91981188${Math.floor(1000 + Math.random() * 9000)}`,
    whatsappConsentStatus: 'Opted In'
  });

  const msg = await Message.create({
    ownerId: testOwner._id,
    messageId: `msg_test_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    idempotencyKey: `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    contactId: contact._id,
    recipientPhone: contact.phoneNumber,
    direction: 'outbound',
    status: 'SIMULATED_SENT',
    providerMessageId: `mock_msg_stat_${Date.now()}`
  });

  // 1. Simulate Delivered
  const deliveredRes = await request(app)
    .post('/api/dev/mock-messaging/simulate-status')
    .set({ Authorization: `Bearer ${authToken}` })
    .send({ messageId: msg._id, status: 'delivered' });

  assert.equal(deliveredRes.status, 200);
  assert.equal(deliveredRes.body.newStatus, 'SIMULATED_DELIVERED');

  // 2. Simulate Read
  const readRes = await request(app)
    .post('/api/dev/mock-messaging/simulate-status')
    .set({ Authorization: `Bearer ${authToken}` })
    .send({ messageId: msg._id, status: 'read' });

  assert.equal(readRes.status, 200);
  assert.equal(readRes.body.newStatus, 'SIMULATED_READ');

  // Clean up
  await Message.deleteOne({ _id: msg._id });
  await Contact.deleteOne({ _id: contact._id });
});

test('Prompt 9 — 7. Fixtures Status & Safe Demo Reset', async (t) => {
  const fixtureStatus = await getFixturesStatus(testOwner._id);
  assert.equal(typeof fixtureStatus.fixturesAvailable, 'boolean');
  assert.ok(fixtureStatus.files.length >= 3);
  assert.ok(fixtureStatus.files.some(f => f.name === 'Relay_Demo_Contacts_60.csv'));

  const resetResult = await resetDemoDataForOwner(testOwner._id);
  assert.equal(resetResult.success, true);
  assert.ok(typeof resetResult.deleted.contacts === 'number');
});

test('Prompt 9 — 8. System Matrix (GET /api/dev/mock-messaging/system-matrix)', async (t) => {
  const matrixRes = await request(app)
    .get('/api/dev/mock-messaging/system-matrix')
    .set({ Authorization: `Bearer ${authToken}` });

  assert.equal(matrixRes.status, 200);
  assert.equal(matrixRes.body.overallStatus, 'ALL_PASS_API_FREE');
  assert.equal(matrixRes.body.providerMode, 'MOCK');
  assert.equal(matrixRes.body.officialMetaConnected, false);
  assert.equal(matrixRes.body.subsystems.length, 16);
  assert.ok(matrixRes.body.subsystems.every(s => s.status === 'PASS'));
});

test.after(async () => {
  await mongoose.disconnect();
});

