import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Contact from '../src/models/Contact.js';
import ConsentRecord from '../src/models/ConsentRecord.js';
import MessageTemplate, { TemplateVersion } from '../src/models/MessageTemplate.js';
import Message from '../src/models/Message.js';
import MessageEvent from '../src/models/MessageEvent.js';
import Campaign from '../src/models/Campaign.js';
import CampaignExecution from '../src/models/CampaignExecution.js';
import CampaignMessageJob from '../src/models/CampaignMessageJob.js';
import mockWhatsAppProvider from '../src/services/mockWhatsAppProvider.js';
import messagingProviderRegistry from '../src/services/messagingProviderRegistry.js';
import { prepareMessageIntent, evaluateRecipientEligibility } from '../src/services/messagePreparationService.js';
import { processMessageJob, messageWorkerTick, getQueueHealth } from '../src/services/messageQueueService.js';
import { retryMessage, cancelMessage } from '../src/services/messageService.js';

process.env.JWT_SECRET = 'test-secret-value-that-is-long-enough-for-p5-tests-32chars';
let mongo, owner, otherOwner, ownerToken, otherToken, sampleTemplate, sampleVersion;
const auth = (token) => ({ Authorization: `Bearer ${token}` });

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([
    User.init(),
    Contact.init(),
    ConsentRecord.init(),
    Campaign.init(),
    CampaignExecution.init(),
    CampaignMessageJob.init(),
    MessageTemplate.init(),
    TemplateVersion.init(),
    Message.init(),
    MessageEvent.init()
  ]);

  owner = await User.create({
    name: 'M2W Realty Lead',
    email: 'owner@m2wrealty.test',
    passwordHash: 'mock-secret-hash',
    businessName: 'M2W Luxury Realty',
    phoneNumber: '+919811122233'
  });

  otherOwner = await User.create({
    name: 'Other Operator',
    email: 'other@rivalrealty.test',
    passwordHash: 'mock-secret-hash',
    businessName: 'Rival Estates'
  });

  ownerToken = jwt.sign({ sub: owner._id.toString() }, process.env.JWT_SECRET, { expiresIn: '1h' });
  otherToken = jwt.sign({ sub: otherOwner._id.toString() }, process.env.JWT_SECRET, { expiresIn: '1h' });

  sampleTemplate = await MessageTemplate.create({
    ownerId: owner._id,
    name: 'luxury_penthouse_update',
    displayName: 'Luxury Penthouse Launch',
    category: 'Marketing',
    language: 'en',
    internalStatus: 'READY',
    providerStatus: 'Approved',
    headerType: 'TEXT',
    header: 'Exclusive Property Update',
    body: 'Hi {{name}}, we have new {{property_type}} options available in {{city}} at {{project}}.',
    footer: 'Reply STOP to unsubscribe'
  });

  sampleVersion = await TemplateVersion.create({
    ownerId: owner._id,
    templateId: sampleTemplate._id,
    versionNumber: 1,
    createdBy: owner._id,
    snapshot: {
      header: 'Exclusive Property Update',
      headerType: 'TEXT',
      body: 'Hi {{name}}, we have new {{property_type}} options available in {{city}} at {{project}}.',
      footer: 'Reply STOP to unsubscribe',
      buttons: [{ type: 'QUICK_REPLY', text: 'Schedule Visit' }]
    }
  });

  await MessageTemplate.updateOne({ _id: sampleTemplate._id }, { $set: { currentVersionId: sampleVersion._id } });
});

after(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

test('Prompt 5 - 1. Mock Provider & Registry Enforcement', async (t) => {
  await t.test('Provider Registry returns MockWhatsAppProvider for MOCK mode', () => {
    const provider = messagingProviderRegistry.getProvider('MOCK');
    assert.equal(provider.getProviderMode(), 'MOCK');
    const config = provider.validateConfiguration();
    assert.equal(config.valid, true);
    assert.equal(config.safeguardsActive, true);
    assert.equal(config.liveSendingAllowed, false);
  });

  await t.test('Provider Registry strictly rejects LIVE mode with 403', () => {
    assert.throws(
      () => messagingProviderRegistry.getProvider('LIVE'),
      (err) => {
        assert.equal(err.status, 403);
        assert.match(err.message, /Live WhatsApp Cloud API is disabled in Prompt 5/);
        return true;
      }
    );
  });

  await t.test('Provider Registry rejects invalid modes with 400', () => {
    assert.throws(
      () => messagingProviderRegistry.getProvider('TELEGRAM'),
      (err) => {
        assert.equal(err.status, 400);
        return true;
      }
    );
  });
});

test('Prompt 5 - 2. Deterministic Mock Provider Outcomes', async (t) => {
  await t.test('Simulated Success returns synthetic mock_msg ID and SIMULATED_SENT status', async () => {
    const result = await mockWhatsAppProvider.sendMessage({
      recipientPhone: '+919876543210',
      renderedContent: { body: 'Hello Luxury Buyer' }
    });

    assert.equal(result.success, true);
    assert.equal(result.status, 'SIMULATED_SENT');
    assert.match(result.providerMessageId, /^mock_msg_[a-f0-9]{16}$/);
    assert.ok(result.simulatedSentAt instanceof Date);
  });

  await t.test('Simulated Temporary Failure is retryable', async () => {
    const result = await mockWhatsAppProvider.sendMessage(
      { recipientPhone: '+919876543210' },
      { forceOutcome: 'temporary_failure' }
    );

    assert.equal(result.success, false);
    assert.equal(result.status, 'TEMPORARY_FAILURE');
    assert.equal(result.retryable, true);
    assert.equal(result.failureCode, 'MOCK_TEMPORARY_FAILURE');
  });

  await t.test('Simulated Timeout is retryable', async () => {
    const result = await mockWhatsAppProvider.sendMessage(
      { recipientPhone: '+919876543210' },
      { forceOutcome: 'timeout' }
    );

    assert.equal(result.success, false);
    assert.equal(result.retryable, true);
    assert.equal(result.failureCode, 'MOCK_TIMEOUT');
  });

  await t.test('Simulated Rate Limit is retryable', async () => {
    const result = await mockWhatsAppProvider.sendMessage(
      { recipientPhone: '+919876543210' },
      { forceOutcome: 'rate_limit' }
    );

    assert.equal(result.success, false);
    assert.equal(result.retryable, true);
    assert.equal(result.failureCode, 'MOCK_RATE_LIMIT');
  });

  await t.test('Simulated Permanent Failure is non-retryable', async () => {
    const result = await mockWhatsAppProvider.sendMessage(
      { recipientPhone: '+919876543210' },
      { forceOutcome: 'permanent_failure' }
    );

    assert.equal(result.success, false);
    assert.equal(result.status, 'PERMANENT_FAILURE');
    assert.equal(result.retryable, false);
    assert.equal(result.failureCode, 'MOCK_PERMANENT_FAILURE');
  });
});

test('Prompt 5 - 3. Recipient Eligibility, Consent Validation & Suppression', async (t) => {
  await t.test('Rejects invalid phone number format', async () => {
    const check = await evaluateRecipientEligibility(
      { phoneNumber: '9876543210', whatsappConsentStatus: 'Opted In', ownerId: owner._id },
      owner,
      { purpose: 'Luxury Penthouse Launch' }
    );

    assert.equal(check.eligible, false);
    assert.equal(check.failureCode, 'INVALID_PHONE');
  });

  await t.test('Blocks contact with Unknown consent', async () => {
    const noConsentContact = await Contact.create({
      ownerId: owner._id,
      fullName: 'Pending Consent Prospect',
      phoneNumber: '+919876500010',
      whatsappConsentStatus: 'Unknown'
    });

    const { message } = await prepareMessageIntent({
      ownerId: owner._id,
      contactId: noConsentContact._id,
      templateId: sampleTemplate._id,
      templateVersionId: sampleVersion._id,
      purpose: 'Luxury Penthouse Launch'
    });

    assert.equal(message.status, 'BLOCKED');
    assert.equal(message.failureCode, 'MISSING_CONSENT');
  });

  await t.test('Blocks contact marked Opted Out', async () => {
    const optedOutContact = await Contact.create({
      ownerId: owner._id,
      fullName: 'Opted Out Prospect',
      phoneNumber: '+919876500011',
      whatsappConsentStatus: 'Opted Out'
    });

    const { message } = await prepareMessageIntent({
      ownerId: owner._id,
      contactId: optedOutContact._id,
      templateId: sampleTemplate._id,
      templateVersionId: sampleVersion._id,
      purpose: 'Luxury Penthouse Launch'
    });

    assert.equal(message.status, 'BLOCKED');
    assert.equal(message.failureCode, 'CONTACT_OPTED_OUT');
  });

  await t.test('Blocks contact marked Do Not Contact', async () => {
    const dncContact = await Contact.create({
      ownerId: owner._id,
      fullName: 'DNC Prospect',
      phoneNumber: '+919876500012',
      isSuppressed: true,
      suppressionReason: 'Do Not Contact',
      whatsappConsentStatus: 'Opted In'
    });

    const { message } = await prepareMessageIntent({
      ownerId: owner._id,
      contactId: dncContact._id,
      templateId: sampleTemplate._id,
      templateVersionId: sampleVersion._id,
      purpose: 'Luxury Penthouse Launch'
    });

    assert.equal(message.status, 'BLOCKED');
    assert.equal(message.failureCode, 'DO_NOT_CONTACT');
  });

  await t.test('Blocks contact when consent business name does not match workspace', async () => {
    const wrongBizContact = await Contact.create({
      ownerId: owner._id,
      fullName: 'Wrong Biz Prospect',
      phoneNumber: '+919876500013',
      whatsappConsentStatus: 'Opted In'
    });

    await ConsentRecord.create({
      ownerId: owner._id,
      contactId: wrongBizContact._id,
      phoneNumber: '+919876500013',
      status: 'Opted In',
      consentSource: 'property_portal',
      evidenceReference: 'ev_wrong_biz',
      consentedBusinessName: 'Other Real Estate Broker', // Mismatch!
      consentPurpose: 'Luxury Penthouse Launch',
      consentCapturedAt: new Date(),
      recordedBy: owner._id
    });

    const { message } = await prepareMessageIntent({
      ownerId: owner._id,
      contactId: wrongBizContact._id,
      templateId: sampleTemplate._id,
      templateVersionId: sampleVersion._id,
      purpose: 'Luxury Penthouse Launch'
    });

    assert.equal(message.status, 'BLOCKED');
    assert.equal(message.failureCode, 'MISSING_CONSENT');
    assert.match(message.failureReason, /does not match active workspace/);
  });
});

test('Prompt 5 - 4. Personalization Rendering & Variable Validation', async (t) => {
  await t.test('Renders real estate CRM variables accurately and creates immutable snapshot', async () => {
    const eligibleContact = await Contact.create({
      ownerId: owner._id,
      fullName: 'Vikram Malhotra',
      phoneNumber: '+919876500020',
      city: 'Gurugram',
      interestedPropertyType: '4 BHK Luxury Penthouse',
      interestedProject: 'DLF The Camellias',
      whatsappConsentStatus: 'Opted In'
    });

    await ConsentRecord.create({
      ownerId: owner._id,
      contactId: eligibleContact._id,
      phoneNumber: '+919876500020',
      status: 'Opted In',
      consentSource: 'site_visit_form',
      evidenceReference: 'ev_site_visit_camellias',
      consentedBusinessName: 'M2W Luxury Realty',
      consentPurpose: 'Luxury Penthouse Launch and project availability',
      consentCapturedAt: new Date(),
      recordedBy: owner._id
    });

    const { message } = await prepareMessageIntent({
      ownerId: owner._id,
      contactId: eligibleContact._id,
      templateId: sampleTemplate._id,
      templateVersionId: sampleVersion._id,
      purpose: 'Luxury Penthouse Launch'
    });

    assert.equal(message.status, 'QUEUED');
    assert.ok(message.renderedContentSnapshot);
    assert.match(message.renderedContentSnapshot.body, /Hi Vikram Malhotra/);
    assert.match(message.renderedContentSnapshot.body, /4 BHK Luxury Penthouse/);
    assert.match(message.renderedContentSnapshot.body, /Gurugram/);
    assert.match(message.renderedContentSnapshot.body, /DLF The Camellias/);

    const events = await MessageEvent.find({ messageId: message._id }).sort({ timestamp: 1 });
    assert.ok(events.length >= 3);
    assert.equal(events[0].eventType, 'MESSAGE_CREATED');
    assert.equal(events[1].eventType, 'VALIDATION_COMPLETED');
    assert.equal(events[2].eventType, 'MESSAGE_QUEUED');
  });

  await t.test('Detects missing required variables and transitions to BLOCKED', async () => {
    const missingContact = await Contact.create({
      ownerId: owner._id,
      fullName: 'Anita Sharma',
      phoneNumber: '+919876500021',
      whatsappConsentStatus: 'Opted In'
    });

    await ConsentRecord.create({
      ownerId: owner._id,
      contactId: missingContact._id,
      phoneNumber: '+919876500021',
      status: 'Opted In',
      consentSource: 'landing_page',
      evidenceReference: 'ev_landing_page',
      consentedBusinessName: 'M2W Luxury Realty',
      consentPurpose: 'Luxury Penthouse Launch',
      consentCapturedAt: new Date(),
      recordedBy: owner._id
    });

    const { message } = await prepareMessageIntent({
      ownerId: owner._id,
      contactId: missingContact._id,
      templateId: sampleTemplate._id,
      templateVersionId: sampleVersion._id,
      purpose: 'Luxury Penthouse Launch'
    });

    assert.equal(message.status, 'BLOCKED');
    assert.equal(message.failureCode, 'UNRESOLVED_VARIABLE');
    assert.match(message.failureReason, /Missing required personalization variables/);
  });
});

test('Prompt 5 - 5. Idempotency & Duplicate Elimination', async (t) => {
  const eligibleContact = await Contact.create({
    ownerId: owner._id,
    fullName: 'Rohan Mehra',
    phoneNumber: '+919876500030',
    city: 'Mumbai',
    interestedPropertyType: 'Villa',
    interestedProject: 'Lodha Golflinks',
    whatsappConsentStatus: 'Opted In'
  });

  await ConsentRecord.create({
    ownerId: owner._id,
    contactId: eligibleContact._id,
    phoneNumber: '+919876500030',
    status: 'Opted In',
    consentSource: 'direct_enquiry',
    evidenceReference: 'ev_direct_enquiry_rohan',
    consentedBusinessName: 'M2W Luxury Realty',
    consentPurpose: 'Luxury Penthouse Launch',
    consentCapturedAt: new Date(),
    recordedBy: owner._id
  });

  const customKey = `idemp_test_${Date.now()}`;

  const first = await prepareMessageIntent({
    ownerId: owner._id,
    contactId: eligibleContact._id,
    templateId: sampleTemplate._id,
    templateVersionId: sampleVersion._id,
    purpose: 'Luxury Penthouse Launch',
    idempotencyKey: customKey
  });

  assert.equal(first.isExisting, false);

  const second = await prepareMessageIntent({
    ownerId: owner._id,
    contactId: eligibleContact._id,
    templateId: sampleTemplate._id,
    templateVersionId: sampleVersion._id,
    purpose: 'Luxury Penthouse Launch',
    idempotencyKey: customKey
  });

  assert.equal(second.isExisting, true);
  assert.equal(String(first.message._id), String(second.message._id));

  const count = await Message.countDocuments({ ownerId: owner._id, idempotencyKey: customKey });
  assert.equal(count, 1, 'Exactly one message record exists in MongoDB');
});

test('Prompt 5 - 6. Background Queue Worker Lease & Execution', async (t) => {
  const eligibleContact = await Contact.create({
    ownerId: owner._id,
    fullName: 'Pooja Kapoor',
    phoneNumber: '+919876500040',
    city: 'Bengaluru',
    interestedPropertyType: 'Luxury Villa',
    interestedProject: 'Sobha Lifestyle',
    whatsappConsentStatus: 'Opted In'
  });

  await ConsentRecord.create({
    ownerId: owner._id,
    contactId: eligibleContact._id,
    phoneNumber: '+919876500040',
    status: 'Opted In',
    consentSource: 'portal',
    evidenceReference: 'ev_portal_pooja',
    consentedBusinessName: 'M2W Luxury Realty',
    consentPurpose: 'Luxury Penthouse Launch',
    consentCapturedAt: new Date(),
    recordedBy: owner._id
  });

  const { message } = await prepareMessageIntent({
    ownerId: owner._id,
    contactId: eligibleContact._id,
    templateId: sampleTemplate._id,
    templateVersionId: sampleVersion._id,
    purpose: 'Luxury Penthouse Launch'
  });

  assert.equal(message.status, 'QUEUED');

  const processed = await processMessageJob(message._id, 'test-worker-1');
  assert.equal(processed, true);

  const updatedMessage = await Message.findById(message._id).lean();
  assert.equal(updatedMessage.status, 'SIMULATED_SENT');
  assert.match(updatedMessage.providerMessageId, /^mock_msg_/);
  assert.ok(updatedMessage.completedAt);
  assert.equal(updatedMessage.leaseOwner, '');
  assert.equal(updatedMessage.leaseUntil, null);

  const events = await MessageEvent.find({ messageId: message._id }).sort({ timestamp: 1 });
  const eventTypes = events.map(e => e.eventType);
  assert.ok(eventTypes.includes('PROCESSING_STARTED'));
  assert.ok(eventTypes.includes('MOCK_SEND_SUCCEEDED'));
  assert.ok(eventTypes.includes('MESSAGE_COMPLETED'));
});

test('Prompt 5 - 7. Retries, Exponential Backoff & Max Attempts', async (t) => {
  const retryContact = await Contact.create({
    ownerId: owner._id,
    fullName: 'Rajesh Khanna',
    phoneNumber: '+919876500050',
    city: 'Delhi',
    interestedPropertyType: 'Villa',
    interestedProject: 'Godrej Woods',
    whatsappConsentStatus: 'Opted In'
  });

  await ConsentRecord.create({
    ownerId: owner._id,
    contactId: retryContact._id,
    phoneNumber: '+919876500050',
    status: 'Opted In',
    consentSource: 'portal',
    evidenceReference: 'ev_rajesh_consent',
    consentedBusinessName: 'M2W Luxury Realty',
    consentPurpose: 'Luxury Penthouse Launch',
    consentCapturedAt: new Date(),
    recordedBy: owner._id
  });

  const { message } = await prepareMessageIntent({
    ownerId: owner._id,
    contactId: retryContact._id,
    templateId: sampleTemplate._id,
    templateVersionId: sampleVersion._id,
    purpose: 'Luxury Penthouse Launch',
    metadata: { forceOutcome: 'temporary_failure' }
  });

  // 1st processing attempt -> TEMPORARY_FAILURE
  await processMessageJob(message._id, 'retry-worker-1');
  let m1 = await Message.findById(message._id).lean();
  assert.equal(m1.status, 'TEMPORARY_FAILURE');
  assert.equal(m1.attemptCount, 1);
  assert.ok(m1.nextRetryAt);

  // Simulate tick where retry is due
  await Message.updateOne({ _id: message._id }, { $set: { nextRetryAt: new Date(Date.now() - 1000) } });
  await messageWorkerTick();

  let m2 = await Message.findById(message._id).lean();
  assert.equal(m2.status, 'TEMPORARY_FAILURE');
  assert.equal(m2.attemptCount, 2);

  // Force attempts to 3 (maxAttempts) and process -> PERMANENT_FAILURE
  await Message.updateOne({ _id: message._id }, { $set: { attemptCount: 2, status: 'QUEUED' } });
  await processMessageJob(message._id, 'retry-worker-1');

  let m3 = await Message.findById(message._id).lean();
  assert.equal(m3.status, 'PERMANENT_FAILURE');
  assert.equal(m3.attemptCount, 3);
  assert.equal(m3.nextRetryAt, null);
});

test('Prompt 5 - 8. Mid-Queue Opt-Out / Suppression Blocking', async (t) => {
  const volatileContact = await Contact.create({
    ownerId: owner._id,
    fullName: 'Volatile Prospect',
    phoneNumber: '+919876500060',
    city: 'Pune',
    interestedPropertyType: 'Villa',
    interestedProject: 'Panchshil Towers',
    whatsappConsentStatus: 'Opted In'
  });

  await ConsentRecord.create({
    ownerId: owner._id,
    contactId: volatileContact._id,
    phoneNumber: '+919876500060',
    status: 'Opted In',
    consentSource: 'web',
    evidenceReference: 'ev_volatile',
    consentedBusinessName: 'M2W Luxury Realty',
    consentPurpose: 'Luxury Penthouse Launch',
    consentCapturedAt: new Date(),
    recordedBy: owner._id
  });

  const { message } = await prepareMessageIntent({
    ownerId: owner._id,
    contactId: volatileContact._id,
    templateId: sampleTemplate._id,
    templateVersionId: sampleVersion._id,
    purpose: 'Luxury Penthouse Launch'
  });

  assert.equal(message.status, 'QUEUED');

  // Contact revokes consent before worker claims it
  await Contact.updateOne({ _id: volatileContact._id }, { $set: { whatsappConsentStatus: 'Opted Out' } });

  // Worker claims job
  await processMessageJob(message._id, 'worker-optout-test');

  const finalMsg = await Message.findById(message._id).lean();
  assert.equal(finalMsg.status, 'BLOCKED');
  assert.equal(finalMsg.failureCode, 'CONTACT_OPTED_OUT');
  assert.match(finalMsg.failureReason, /opted out of WhatsApp messaging before dispatch/);
});

test('Prompt 5 - 9. Scheduled Messages & Reconciliation', async (t) => {
  const contact = await Contact.create({
    ownerId: owner._id,
    fullName: 'Scheduled Buyer',
    phoneNumber: '+919876500070',
    city: 'Noida',
    interestedPropertyType: 'Villa',
    interestedProject: 'ATS Knightsbridge',
    whatsappConsentStatus: 'Opted In'
  });

  await ConsentRecord.create({
    ownerId: owner._id,
    contactId: contact._id,
    phoneNumber: '+919876500070',
    status: 'Opted In',
    consentSource: 'web',
    evidenceReference: 'ev_scheduled',
    consentedBusinessName: 'M2W Luxury Realty',
    consentPurpose: 'Luxury Penthouse Launch',
    consentCapturedAt: new Date(),
    recordedBy: owner._id
  });

  const futureTime = new Date(Date.now() + 3600000);
  const { message } = await prepareMessageIntent({
    ownerId: owner._id,
    contactId: contact._id,
    templateId: sampleTemplate._id,
    templateVersionId: sampleVersion._id,
    purpose: 'Luxury Penthouse Launch',
    scheduledAt: futureTime
  });

  assert.equal(message.status, 'SCHEDULED');
  assert.equal(new Date(message.scheduledAt).toISOString(), futureTime.toISOString());

  // Simulate time passing: update scheduledAt to past
  await Message.updateOne({ _id: message._id }, { $set: { scheduledAt: new Date(Date.now() - 5000) } });

  // Worker tick reconciles due scheduled jobs into QUEUED and processes them
  await messageWorkerTick();

  const processed = await Message.findById(message._id).lean();
  assert.equal(processed.status, 'SIMULATED_SENT');
});

test('Prompt 5 - 10. Message Cancellation & State Transition Integrity', async (t) => {
  const contact = await Contact.create({
    ownerId: owner._id,
    fullName: 'Cancel Test Contact',
    phoneNumber: '+919876500080',
    city: 'Kolkata',
    interestedPropertyType: 'Villa',
    interestedProject: 'Forum Atmos',
    whatsappConsentStatus: 'Opted In'
  });

  await ConsentRecord.create({
    ownerId: owner._id,
    contactId: contact._id,
    phoneNumber: '+919876500080',
    status: 'Opted In',
    consentSource: 'web',
    evidenceReference: 'ev_cancel',
    consentedBusinessName: 'M2W Luxury Realty',
    consentPurpose: 'Luxury Penthouse Launch',
    consentCapturedAt: new Date(),
    recordedBy: owner._id
  });

  const { message } = await prepareMessageIntent({
    ownerId: owner._id,
    contactId: contact._id,
    templateId: sampleTemplate._id,
    templateVersionId: sampleVersion._id,
    purpose: 'Luxury Penthouse Launch'
  });

  // Cancel while QUEUED
  const cancelled = await cancelMessage(message._id, owner._id, 'Lead changed mind');
  assert.equal(cancelled.status, 'CANCELLED');
  assert.equal(cancelled.failureCode, 'USER_CANCELLED');

  // Verify cannot cancel an already sent message
  const sentMsg = await Message.create({
    ownerId: owner._id,
    messageId: `msg_sent_${Date.now()}`,
    contactId: contact._id,
    recipientPhone: '+919876500080',
    status: 'SIMULATED_SENT'
  });

  await assert.rejects(
    () => cancelMessage(sentMsg._id, owner._id),
    (err) => {
      assert.equal(err.status, 409);
      assert.match(err.message, /Cannot cancel a completed message/);
      return true;
    }
  );
});

test('Prompt 5 - 11. REST API Endpoints & Multi-Tenant Isolation', async (t) => {
  // 1. GET /api/messages
  const listRes = await request(app)
    .get('/api/messages')
    .set(auth(ownerToken));

  assert.equal(listRes.status, 200);
  assert.ok(Array.isArray(listRes.body.records));
  assert.ok(listRes.body.total >= 1);

  // 2. GET /api/messages/stats
  const statsRes = await request(app)
    .get('/api/messages/stats')
    .set(auth(ownerToken));

  assert.equal(statsRes.status, 200);
  assert.ok(statsRes.body.stats);
  assert.equal(statsRes.body.health.providerMode, 'MOCK');

  // 3. GET /api/system/messaging-status
  const sysRes = await request(app)
    .get('/api/system/messaging-status')
    .set(auth(ownerToken));

  assert.equal(sysRes.status, 200);
  assert.equal(sysRes.body.applicationOnline, true);
  assert.equal(sysRes.body.databaseOnline, true);
  assert.equal(sysRes.body.queueOnline, true);
  assert.equal(sysRes.body.whatsappConnected, false); // Truthful offline provider state!

  // 4. POST /api/dev/mock-messaging/run-test
  const devRes = await request(app)
    .post('/api/dev/mock-messaging/run-test')
    .set(auth(ownerToken))
    .send({ scenario: 'success' });

  assert.equal(devRes.status, 200);
  assert.equal(devRes.body.success, true);
  assert.equal(devRes.body.status, 'SIMULATED_SENT');

  // 5. Tenant Isolation: Other owner cannot access this owner's messages
  const anyMsg = await Message.findOne({ ownerId: owner._id }).lean();

  const crossGet = await request(app)
    .get(`/api/messages/${anyMsg._id}`)
    .set(auth(otherToken));

  assert.equal(crossGet.status, 404, 'Cross-account access blocked with 404');
});
