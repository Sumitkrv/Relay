import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Contact from '../src/models/Contact.js';
import Conversation from '../src/models/Conversation.js';
import ConversationMessage from '../src/models/ConversationMessage.js';
import MessageDraft from '../src/models/MessageDraft.js';
import InternalNote from '../src/models/InternalNote.js';
import ConsentRecord from '../src/models/ConsentRecord.js';
import QuickReply from '../src/models/QuickReply.js';
import AutoReplyRule from '../src/models/AutoReplyRule.js';
import RuleExecution from '../src/models/RuleExecution.js';
import { matchKeyword } from '../src/services/autoReplyRuleService.js';

process.env.JWT_SECRET = 'prompt7-secret-key-that-is-long-enough-for-testing';

let mongo, owner, otherOwner, ownerToken, otherToken, contact, testContact;
const auth = (token) => ({ Authorization: `Bearer ${token}` });

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());

  owner = await User.create({
    name: 'Real Estate Owner',
    email: 'owner@relayrealestate.io',
    passwordHash: 'testHash'
  });

  otherOwner = await User.create({
    name: 'Other Operator',
    email: 'other@otheragency.com',
    passwordHash: 'testHash'
  });

  ownerToken = jwt.sign({ sub: String(owner._id) }, process.env.JWT_SECRET, { expiresIn: '1h' });
  otherToken = jwt.sign({ sub: String(otherOwner._id) }, process.env.JWT_SECRET, { expiresIn: '1h' });

  contact = await Contact.create({
    ownerId: owner._id,
    fullName: 'Rohan Sharma',
    phoneNumber: '+919876543210',
    location: 'Gurugram',
    interestedService: 'Villas',
    industry: 'Luxury Villa',
    whatsappConsentStatus: 'Opted In'
  });

  testContact = await Contact.create({
    ownerId: owner._id,
    fullName: 'Synthetic Lead',
    phoneNumber: '+919876500000',
    location: 'Noida',
    interestedService: 'Prestige Park Plots',
    industry: 'Plot',
    whatsappConsentStatus: 'Unknown'
  });
});

after(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

test('Prompt 7 — 1. Keyword Matcher: Whole-word, Exact, Contains and Word-boundary Protection', () => {
  // Whole-word match should match "STOP" or "Please STOP"
  const m1 = matchKeyword('STOP', 'STOP', ['UNSUBSCRIBE'], 'WHOLE_WORD');
  assert.equal(m1.matched, true);

  const m2 = matchKeyword('Please STOP sending messages', 'STOP', ['UNSUBSCRIBE'], 'WHOLE_WORD');
  assert.equal(m2.matched, true);

  // CRITICAL SAFETY RULE: "STOP" must NEVER match "STOPWATCH" or "NONSTOP"!
  const m3 = matchKeyword('I have a STOPWATCH here', 'STOP', ['UNSUBSCRIBE'], 'WHOLE_WORD');
  assert.equal(m3.matched, false, 'STOP must not match STOPWATCH!');

  const m4 = matchKeyword('NONSTOP flights to Dubai', 'STOP', ['UNSUBSCRIBE'], 'WHOLE_WORD');
  assert.equal(m4.matched, false, 'STOP must not match NONSTOP!');

  // Exact Match
  const m5 = matchKeyword('BROCHURE', 'BROCHURE', [], 'EXACT_MATCH');
  assert.equal(m5.matched, true);
  const m6 = matchKeyword('Send BROCHURE please', 'BROCHURE', [], 'EXACT_MATCH');
  assert.equal(m6.matched, false);

  // Contains Match
  const m7 = matchKeyword('What is the PRICING for 3BHK?', 'PRICE', ['PRICING'], 'CONTAINS');
  assert.equal(m7.matched, true);
});

test('Prompt 7 — 2. Quick Reply Library CRUD, Variable Tokens & Duplicate', async () => {
  // 1. List (triggers default seeds)
  const listRes = await request(app).get('/api/inbox/quick-replies').set(auth(ownerToken));
  assert.equal(listRes.status, 200);
  assert.ok(listRes.body.records.length >= 4, 'Should have seeded default quick replies');

  // 2. Create custom quick reply
  const createRes = await request(app)
    .post('/api/inbox/quick-replies')
    .set(auth(ownerToken))
    .send({
      name: 'Custom Payment Plan',
      category: 'Pricing',
      description: 'Special 10:90 scheme for luxury floors',
      messageText: 'Hi {{first_name}}, we have a limited-period 10:90 payment plan for {{project}} in {{city}}.'
    });
  assert.equal(createRes.status, 201);
  const createdId = createRes.body.quickReply._id;

  // 3. Update quick reply
  const updateRes = await request(app)
    .patch(`/api/inbox/quick-replies/${createdId}`)
    .set(auth(ownerToken))
    .send({
      description: 'Updated 10:90 plan description'
    });
  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.body.quickReply.description, 'Updated 10:90 plan description');

  // 4. Duplicate quick reply
  const dupRes = await request(app)
    .post(`/api/inbox/quick-replies/${createdId}/duplicate`)
    .set(auth(ownerToken));
  assert.equal(dupRes.status, 201);
  assert.match(dupRes.body.quickReply.name, /Custom Payment Plan \(Copy\)/);

  // 5. Tenant isolation check
  const otherGet = await request(app)
    .get(`/api/inbox/quick-replies/${createdId}`)
    .set(auth(otherToken));
  assert.equal(otherGet.status, 404, 'Other owner cannot read quick reply');

  // 6. Delete quick reply
  const delRes = await request(app)
    .delete(`/api/inbox/quick-replies/${createdId}`)
    .set(auth(ownerToken));
  assert.equal(delRes.status, 200);
  assert.equal(delRes.body.deleted, true);
});

test('Prompt 7 — 3. Auto-Reply Keyword Rules CRUD & Priority Enforcement', async () => {
  // 1. List rules (seeds default real estate rules: STOP, BROCHURE, PRICE, VISIT)
  const listRes = await request(app).get('/api/inbox/auto-reply-rules').set(auth(ownerToken));
  assert.equal(listRes.status, 200);
  assert.ok(listRes.body.records.length >= 4);

  // Verify STOP rule has priority 1
  const stopRule = listRes.body.records.find((r) => r.triggerKeyword === 'STOP');
  assert.ok(stopRule, 'STOP rule must exist');
  assert.equal(stopRule.priority, 1, 'STOP rule must have top priority (1)');
  assert.equal(stopRule.actionType, 'RECORD_OPT_OUT');

  // 2. Test single rule tester endpoint
  const testRes = await request(app)
    .post(`/api/inbox/auto-reply-rules/${stopRule._id}/test`)
    .set(auth(ownerToken))
    .send({ text: 'Please stop sending me alerts' });
  assert.equal(testRes.status, 200);
  assert.equal(testRes.body.matched, true);
  assert.equal(testRes.body.proposedAction, 'RECORD_OPT_OUT');

  // 3. Test global match-all endpoint
  const matchAllRes = await request(app)
    .post('/api/inbox/auto-reply-rules/test-match')
    .set(auth(ownerToken))
    .send({ text: 'Can you share the project BROCHURE?' });
  assert.equal(matchAllRes.status, 200);
  assert.equal(matchAllRes.body.matched, true);
  assert.equal(matchAllRes.body.matchedRule.triggerKeyword, 'BROCHURE');
  assert.equal(matchAllRes.body.matchedRule.actionType, 'RUN_MOCK_REPLY');
});

test('Prompt 7 — 4. SCENARIO A: Inbound BROCHURE Message triggers Mock Brochure Reply', async () => {
  // Create conversation
  const convRes = await request(app)
    .post('/api/inbox/conversations')
    .set(auth(ownerToken))
    .send({ contactId: contact._id, source: 'test' });
  assert.equal(convRes.status, 201);
  const convId = convRes.body.conversation._id;

  // Send synthetic inbound BROCHURE event
  const eventRes = await request(app)
    .post(`/api/inbox/conversations/${convId}/test-events`)
    .set(auth(ownerToken))
    .send({ body: 'Hi, please send me the BROCHURE for Prestige Park' });

  assert.equal(eventRes.status, 201);
  assert.equal(eventRes.body.message.direction, 'inbound');
  assert.equal(eventRes.body.message.trustLevel, 'synthetic');

  // Rule evaluation check
  const ruleRes = eventRes.body.ruleEvaluation;
  assert.ok(ruleRes.matched, 'BROCHURE rule should match');
  assert.equal(ruleRes.action, 'RUN_MOCK_REPLY');
  assert.ok(ruleRes.replyMessage, 'A mock reply message should have been generated');
  assert.match(ruleRes.replyMessage.messageBody, /brochure/i);

  // Check timeline has both inbound and mock outbound
  const messagesRes = await request(app)
    .get(`/api/inbox/conversations/${convId}/messages`)
    .set(auth(ownerToken));
  assert.equal(messagesRes.status, 200);
  assert.equal(messagesRes.body.records.length, 2);
  assert.equal(messagesRes.body.records[0].direction, 'inbound');
  assert.equal(messagesRes.body.records[1].direction, 'outbound');
  assert.equal(messagesRes.body.records[1].simulationStatus, 'Simulated Success');
});

test('Prompt 7 — 5. SCENARIO B: Inbound PRICE Inquiry asks for configuration without inventing false prices', async () => {
  const convRes = await request(app)
    .post('/api/inbox/conversations')
    .set(auth(ownerToken))
    .send({ contactId: contact._id, source: 'test' });
  const convId = convRes.body.conversation._id;

  const eventRes = await request(app)
    .post(`/api/inbox/conversations/${convId}/test-events`)
    .set(auth(ownerToken))
    .send({ body: 'What is the PRICE of the 3BHK units?' });

  assert.equal(eventRes.status, 201);
  assert.ok(eventRes.body.ruleEvaluation.matched);
  assert.equal(eventRes.body.ruleEvaluation.action, 'RUN_MOCK_REPLY');
  assert.match(eventRes.body.ruleEvaluation.replyMessage.messageBody, /price|pricing|configuration/i);
});

test('Prompt 7 — 6. SCENARIO C: Inbound VISIT Request Marks Needs Attention and Creates Internal Note', async () => {
  const convRes = await request(app)
    .post('/api/inbox/conversations')
    .set(auth(ownerToken))
    .send({ contactId: contact._id, source: 'test' });
  const convId = convRes.body.conversation._id;

  const eventRes = await request(app)
    .post(`/api/inbox/conversations/${convId}/test-events`)
    .set(auth(ownerToken))
    .send({ body: 'I want to schedule a site VISIT this Saturday afternoon' });

  assert.equal(eventRes.status, 201);
  assert.ok(eventRes.body.ruleEvaluation.matched);
  assert.equal(eventRes.body.ruleEvaluation.action, 'MARK_NEEDS_ATTENTION');

  // Verify conversation status is updated to Needs Attention
  const updatedConv = await Conversation.findById(convId);
  assert.equal(updatedConv.status, 'Needs Attention');

  // Verify internal note was added
  const notesRes = await request(app)
    .get(`/api/inbox/conversations/${convId}/notes`)
    .set(auth(ownerToken));
  assert.equal(notesRes.status, 200);
  assert.ok(notesRes.body.records.some((n) => n.content.includes('Site Visit')));
});

test('Prompt 7 — 7. SCENARIO D: Inbound STOP Request Enforces Authoritative Opt-out & Blocks Marketing', async () => {
  const convRes = await request(app)
    .post('/api/inbox/conversations')
    .set(auth(ownerToken))
    .send({ contactId: testContact._id, source: 'test' });
  const convId = convRes.body.conversation._id;

  const eventRes = await request(app)
    .post(`/api/inbox/conversations/${convId}/test-events`)
    .set(auth(ownerToken))
    .send({ body: 'STOP' });

  assert.equal(eventRes.status, 201);
  assert.ok(eventRes.body.ruleEvaluation.matched);
  assert.equal(eventRes.body.ruleEvaluation.action, 'RECORD_OPT_OUT');

  // Verify authoritative Contact suppression
  const c = await Contact.findById(testContact._id);
  assert.equal(c.isSuppressed, true);
  assert.match(c.suppressionReason, /STOP/i);
  assert.equal(c.whatsappConsentStatus, 'Opted Out');

  // Verify durable ConsentRecord
  const consentRecord = await ConsentRecord.findOne({
    ownerId: owner._id,
    contactId: testContact._id,
    status: 'Opted Out'
  });
  assert.ok(consentRecord, 'Durable revoked consent record must be created');
});

test('Prompt 7 — 8. SCENARIO E: Owner Takeover Pauses Automation & Resume Restores It Without Replaying', async () => {
  const convRes = await request(app)
    .post('/api/inbox/conversations')
    .set(auth(ownerToken))
    .send({ contactId: contact._id, source: 'test' });
  const convId = convRes.body.conversation._id;

  // 1. Enable Manual Control (Owner Takeover)
  const pauseRes = await request(app)
    .patch(`/api/inbox/conversations/${convId}/automation`)
    .set(auth(ownerToken))
    .send({ automationStatus: 'PAUSED' });
  assert.equal(pauseRes.status, 200);
  assert.equal(pauseRes.body.automationStatus, 'PAUSED');

  // 2. Send synthetic inbound BROCHURE while paused
  const eventRes = await request(app)
    .post(`/api/inbox/conversations/${convId}/test-events`)
    .set(auth(ownerToken))
    .send({ body: 'Can you send the BROCHURE please?' });

  assert.equal(eventRes.status, 201);
  assert.equal(eventRes.body.ruleEvaluation.matched, false);
  assert.equal(eventRes.body.ruleEvaluation.paused, true, 'Auto-reply must be skipped when paused');

  // 3. Resume automation
  const resumeRes = await request(app)
    .patch(`/api/inbox/conversations/${convId}/automation`)
    .set(auth(ownerToken))
    .send({ automationStatus: 'ACTIVE' });
  assert.equal(resumeRes.status, 200);
  assert.equal(resumeRes.body.automationStatus, 'ACTIVE');

  // 4. Verify new inbound message now matches
  const newEventRes = await request(app)
    .post(`/api/inbox/conversations/${convId}/test-events`)
    .set(auth(ownerToken))
    .send({ body: 'Send BROCHURE' });
  assert.equal(newEventRes.status, 201);
  assert.equal(newEventRes.body.ruleEvaluation.matched, true);
});

test('Prompt 7 — 9. Composer Outbound Mock Send & Status Lifecycle Transitions', async () => {
  const convRes = await request(app)
    .post('/api/inbox/conversations')
    .set(auth(ownerToken))
    .send({ contactId: contact._id, source: 'manual' });
  const convId = convRes.body.conversation._id;

  // Send mock reply from composer
  const sendRes = await request(app)
    .post(`/api/inbox/conversations/${convId}/mock-reply`)
    .set(auth(ownerToken))
    .send({ body: 'Good afternoon, unit 304 is available for immediate booking.' });
  assert.equal(sendRes.status, 201);
  assert.equal(sendRes.body.message.messageSource, 'mock_simulation');
  assert.equal(sendRes.body.message.simulationStatus, 'Simulated Success');

  // Status transitions
  const statusRes = await request(app)
    .patch(`/api/inbox/conversations/${convId}/status`)
    .set(auth(ownerToken))
    .send({ status: 'Needs Attention' });
  assert.equal(statusRes.status, 200);
  assert.equal(statusRes.body.conversation.status, 'Needs Attention');

  const resolveRes = await request(app)
    .patch(`/api/inbox/conversations/${convId}/status`)
    .set(auth(ownerToken))
    .send({ status: 'Resolved' });
  assert.equal(resolveRes.status, 200);
  assert.equal(resolveRes.body.conversation.status, 'Resolved');

  // Mark Read
  const readRes = await request(app)
    .post(`/api/inbox/conversations/${convId}/mark-read`)
    .set(auth(ownerToken));
  assert.equal(readRes.status, 200);
  assert.equal(readRes.body.conversation.internalUnreadCount, 0);
});

test('Prompt 7 — 10. Multi-Tenant Owner Isolation', async () => {
  // Owner creates a conversation
  const convRes = await request(app)
    .post('/api/inbox/conversations')
    .set(auth(ownerToken))
    .send({ contactId: contact._id, source: 'manual' });
  const convId = convRes.body.conversation._id;

  // otherOwner attempts to get it
  const otherGet = await request(app)
    .get(`/api/inbox/conversations/${convId}`)
    .set(auth(otherToken));
  assert.equal(otherGet.status, 404);

  // otherOwner attempts to update it
  const otherPatch = await request(app)
    .patch(`/api/inbox/conversations/${convId}/status`)
    .set(auth(otherToken))
    .send({ status: 'Closed' });
  assert.equal(otherPatch.status, 404);
});
