import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import Workspace from '../src/models/Workspace.js';
import User from '../src/models/User.js';
import Contact from '../src/models/Contact.js';
import Conversation from '../src/models/Conversation.js';
import ConversationMessage from '../src/models/ConversationMessage.js';
import AutoReplyRule from '../src/models/AutoReplyRule.js';
import ConsentRecord from '../src/models/ConsentRecord.js';
import RuleExecution from '../src/models/RuleExecution.js';
import * as workspaceMockService from '../src/services/workspaceMockService.js';

let mongod;
let user;
let wsGym;

describe('SaaS 08 — Two-Way Inbox Simulation, Auto-Replies & STOP Compliance', () => {
  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());

    user = await User.create({
      name: 'Gym Operator',
      email: 'gym-op@example.com',
      passwordHash: 'dummyhash123',
    });

    wsGym = await Workspace.create({
      name: 'PowerFit Gym',
      slug: 'powerfit-gym',
      industryKey: 'gym',
      businessEmail: 'contact@powerfit.com',
      businessPhone: '+919876543210',
      createdBy: user._id,
    });
  });

  after(async () => {
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  });

  it('1. Inbound simulation routes to workspace conversation with synthetic tagging', async () => {
    const res = await workspaceMockService.simulateInboundMessage({
      workspace: wsGym,
      contactPhone: '+919123456780',
      contactName: 'Inbound Customer',
      messageBody: 'Hello, what are your workout timings?',
      user,
    });

    assert.equal(res.success, true);
    assert.equal(String(res.workspaceId), String(wsGym._id));
    assert.ok(res.conversationId);
    assert.ok(res.inboundMessageId);

    const msg = await ConversationMessage.findById(res.inboundMessageId);
    assert.equal(msg.direction, 'inbound');
    assert.equal(msg.messageSource, 'synthetic_test');
    assert.equal(msg.trustLevel, 'synthetic');
    assert.equal(String(msg.workspaceId), String(wsGym._id));
  });

  it('2. Keyword auto-reply triggers correctly with case and whitespace normalization', async () => {
    // Create an active Gym AutoReplyRule for TRIAL
    await AutoReplyRule.create({
      ownerId: user._id,
      workspaceId: wsGym._id,
      name: 'Gym Free Trial Auto-Reply',
      triggerKeyword: 'TRIAL',
      synonyms: ['PASS', 'DEMO'],
      matchType: 'CONTAINS',
      actionType: 'RUN_MOCK_REPLY',
      responseMessage: 'Hi {{customer_name}}, welcome to {{business_name}}! Here is your free 1-day pass.',
      priority: 10,
      enabled: true,
    });

    // Inbound with extra whitespace and lowercase
    const res = await workspaceMockService.simulateInboundMessage({
      workspace: wsGym,
      contactPhone: '+919123456781',
      contactName: 'Amit Patel',
      messageBody: '   can i get a free trial pass?   ',
      user,
    });

    assert.equal(res.success, true);
    assert.ok(res.autoReply);
    assert.equal(res.autoReply.ruleName, 'Gym Free Trial Auto-Reply');
    assert.ok(res.autoReply.responseBody.includes('Amit Patel'));
    assert.ok(res.autoReply.responseBody.includes('PowerFit Gym'));

    // Check that outbound ConversationMessage was created
    const replyMsg = await ConversationMessage.findOne({
      conversationId: res.conversationId,
      direction: 'outbound',
    });
    assert.ok(replyMsg);
    assert.equal(replyMsg.simulationStatus, 'Simulated Success');
    assert.equal(String(replyMsg.workspaceId), String(wsGym._id));
  });

  it('3. STOP keyword enforces affirmative opt-out and suppresses promotional auto-replies', async () => {
    const contactPhone = '+919123456782';
    const res = await workspaceMockService.simulateInboundMessage({
      workspace: wsGym,
      contactPhone,
      contactName: 'Stop Tester',
      messageBody: 'STOP',
      user,
    });

    assert.equal(res.success, true);
    assert.equal(res.suppressionOutcome, 'OPTED_OUT');
    assert.equal(res.autoReply, null, 'STOP must NOT trigger any promotional auto-reply');

    // Verify contact suppression status in DB
    const contact = await Contact.findOne({ phoneNumber: contactPhone, workspaceId: wsGym._id });
    assert.equal(contact.whatsappConsentStatus, 'Opted Out');

    // Verify ConsentRecord audit trail
    const consent = await ConsentRecord.findOne({ contactId: contact._id, ownerId: user._id });
    assert.ok(consent);
    assert.equal(consent.status, 'Opted Out');
    assert.ok(consent.consentSource.toLowerCase().includes('stop'));
  });

  it('4. Manual takeover suspends automated auto-replies', async () => {
    // Setup contact and conversation
    const contact = await Contact.create({
      workspaceId: wsGym._id,
      ownerId: user._id,
      fullName: 'Takeover User',
      phoneNumber: '+919123456783',
      whatsappConsentStatus: 'Opted In',
    });

    const conv = await Conversation.create({
      workspaceId: wsGym._id,
      ownerId: user._id,
      contactId: contact._id,
      status: 'Open',
      automationStatus: 'PAUSED', // Manual takeover active!
    });

    const res = await workspaceMockService.simulateInboundMessage({
      workspace: wsGym,
      contactPhone: contact.phoneNumber,
      contactName: contact.fullName,
      messageBody: 'I want a TRIAL pass',
      contactId: contact._id,
      user,
    });

    assert.equal(res.success, true);
    assert.equal(res.autoReply, null, 'Manual takeover must suppress auto-replies');

    const ruleExec = await RuleExecution.findOne({
      conversationId: conv._id,
      actionType: 'PAUSED_TAKEOVER',
    });
    assert.ok(ruleExec);
    assert.equal(ruleExec.status, 'PAUSED_TAKEOVER');
  });

  it('5. Dry run automation test evaluates without database side-effects', async () => {
    const evalRes = await workspaceMockService.dryRunAutomationTest({
      workspace: wsGym,
      messageBody: 'TRIAL',
    });

    assert.equal(evalRes.matchFound, true);
    assert.equal(evalRes.triggeredKeyword, 'TRIAL');
    assert.ok(evalRes.renderedReply.includes('PowerFit Gym'));
    assert.ok(evalRes.trace.length > 0);

    // Verify dry run did NOT create any conversation or message
    const msgs = await ConversationMessage.find({ messageBody: 'TRIAL' });
    assert.equal(msgs.length, 0);
  });
});
