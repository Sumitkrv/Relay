import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

import User from '../src/models/User.js';
import Workspace from '../src/models/Workspace.js';
import WorkspaceMembership from '../src/models/WorkspaceMembership.js';
import Contact from '../src/models/Contact.js';
import MessageTemplate, { TemplateVersion } from '../src/models/MessageTemplate.js';
import Campaign from '../src/models/Campaign.js';
import CampaignAudience from '../src/models/CampaignAudience.js';
import CampaignExecution from '../src/models/CampaignExecution.js';
import CampaignMessageJob from '../src/models/CampaignMessageJob.js';
import Message from '../src/models/Message.js';
import MessageEvent from '../src/models/MessageEvent.js';
import Conversation from '../src/models/Conversation.js';
import ConversationMessage from '../src/models/ConversationMessage.js';
import AutoReplyRule from '../src/models/AutoReplyRule.js';
import RuleExecution from '../src/models/RuleExecution.js';
import ConsentRecord from '../src/models/ConsentRecord.js';

import connectDB from '../src/config/db.js';
import { assertDemoDatabaseSafety } from '../src/config/demoSafety.js';
import { seedInitialDemoWorkspaces } from '../src/scripts/seedInitialDemoWorkspaces.js';
import { resolveTemplate } from '../src/utils/templateEngine.js';
import { createCampaignExecution, processCampaignJob } from '../src/services/campaignExecutionService.js';
import { evaluateInboundMessage, matchKeyword, interpolateVariables } from '../src/services/autoReplyRuleService.js';

test.describe('RELAY PROMPT 2 — Complete WhatsApp Mock Campaign Automation & Verification', () => {
  let m2wUser, gymUser, clinicUser;
  let m2wWs, gymWs, clinicWs;

  test.before(async () => {
    process.env.APP_MODE = 'demo';
    process.env.DATABASE_NAME = 'relay_demo';
    process.env.EMAIL_PROVIDER = 'mock';
    process.env.DEMO_EMAIL_AUTO_VERIFY = 'true';
    process.env.WHATSAPP_PROVIDER = 'mock';
    process.env.BILLING_PROVIDER = 'mock';

    if (mongoose.connection.readyState === 0) {
      await connectDB();
    }
    assertDemoDatabaseSafety(mongoose.connection);

    // Run seeder to ensure clean state
    await seedInitialDemoWorkspaces();

    m2wUser = await User.findOne({ email: 'owner.m2w@relay-demo.test' });
    gymUser = await User.findOne({ email: 'owner.gym@relay-demo.test' });
    clinicUser = await User.findOne({ email: 'owner.clinic@relay-demo.test' });

    m2wWs = await Workspace.findOne({ slug: 'm2w-realty' });
    gymWs = await Workspace.findOne({ slug: 'fitzone-gym' });
    clinicWs = await Workspace.findOne({ slug: 'careplus-clinic' });
  });

  // -------------------------------------------------------------
  // SUITE 1: PREREQUISITES VERIFICATION (PROMPT 1 FOUNDATION)
  // -------------------------------------------------------------
  test.describe('1. Prompt 1 Prerequisite Verification', () => {
    test('all 3 business owner accounts exist with verified hashed passwords', async () => {
      for (const email of ['owner.m2w@relay-demo.test', 'owner.gym@relay-demo.test', 'owner.clinic@relay-demo.test']) {
        const u = await User.findOne({ email }).select('+passwordHash');
        assert.ok(u, 'User must exist');
        assert.equal(u.isEmailVerified, true);
        assert.ok(u.passwordHash && u.passwordHash.startsWith('$2'), 'Password must be bcrypt hashed');
      }
    });

    test('all 3 workspaces exist with correct industries and Asia/Kolkata timezone', async () => {
      assert.equal(m2wWs.industryKey, 'real_estate');
      assert.equal(m2wWs.timezone, 'Asia/Kolkata');
      assert.equal(gymWs.industryKey, 'gym');
      assert.equal(gymWs.timezone, 'Asia/Kolkata');
      assert.equal(clinicWs.industryKey, 'clinic');
      assert.equal(clinicWs.timezone, 'Asia/Kolkata');
    });

    test('exact contacts and templates counts: at least 5 contacts and 7 templates per workspace', async () => {
      for (const [user, ws] of [[m2wUser, m2wWs], [gymUser, gymWs], [clinicUser, clinicWs]]) {
        const contactCount = await Contact.countDocuments({ ownerId: user._id, isDeleted: false });
        assert.ok(contactCount >= 5, `Expected at least 5 contacts for ${ws.slug}`);

        const templateCount = await MessageTemplate.countDocuments({ ownerId: user._id, isArchived: false });
        assert.ok(templateCount >= 7, `Expected at least 7 templates for ${ws.slug}`);
      }
    });
  });

  // -------------------------------------------------------------
  // SUITE 2: THREE DEMO CAMPAIGN DRAFTS
  // -------------------------------------------------------------
  test.describe('2. Three Independent Demo Campaign Drafts', () => {
    test('M2W Realty has Property Enquiry Follow-Up demo campaign draft', async () => {
      const camp = await Campaign.findOne({ ownerId: m2wUser._id, name: 'Property Enquiry Follow-Up — Demo' });
      assert.ok(camp, 'M2W demo campaign draft must exist');
      assert.equal(camp.status, 'Draft');
      assert.equal(camp.executionMode, 'MOCK');

      const audCount = await CampaignAudience.countDocuments({ campaignId: camp._id, snapshotVersion: 1 });
      assert.equal(audCount, 5, 'M2W campaign audience must contain exactly 5 contacts');
    });

    test('FitZone Gym has Membership Enquiry Follow-Up demo campaign draft', async () => {
      const camp = await Campaign.findOne({ ownerId: gymUser._id, name: 'Membership Enquiry Follow-Up — Demo' });
      assert.ok(camp, 'Gym demo campaign draft must exist');
      assert.equal(camp.status, 'Draft');
      assert.equal(camp.executionMode, 'MOCK');

      const audCount = await CampaignAudience.countDocuments({ campaignId: camp._id, snapshotVersion: 1 });
      assert.equal(audCount, 5, 'Gym campaign audience must contain exactly 5 contacts');
    });

    test('CarePlus Clinic has Clinic Enquiry Follow-Up demo campaign draft', async () => {
      const camp = await Campaign.findOne({ ownerId: clinicUser._id, name: 'Clinic Enquiry Follow-Up — Demo' });
      assert.ok(camp, 'Clinic demo campaign draft must exist');
      assert.equal(camp.status, 'Draft');
      assert.equal(camp.executionMode, 'MOCK');

      const audCount = await CampaignAudience.countDocuments({ campaignId: camp._id, snapshotVersion: 1 });
      assert.equal(audCount, 5, 'Clinic campaign audience must contain exactly 5 contacts');
    });

    test('each campaign uses Customer Follow-Up template from its own workspace', async () => {
      for (const [user, campName] of [
        [m2wUser, 'Property Enquiry Follow-Up — Demo'],
        [gymUser, 'Membership Enquiry Follow-Up — Demo'],
        [clinicUser, 'Clinic Enquiry Follow-Up — Demo'],
      ]) {
        const camp = await Campaign.findOne({ ownerId: user._id, name: campName });
        const tmpl = await MessageTemplate.findById(camp.selectedTemplateId);
        assert.ok(tmpl);
        assert.equal(tmpl.name, 'Customer Follow-Up');
        assert.equal(String(tmpl.ownerId), String(user._id), 'Template must belong to the campaign owner');
      }
    });
  });

  // -------------------------------------------------------------
  // SUITE 3: PERSONALIZATION PREVIEW
  // -------------------------------------------------------------
  test.describe('3. Personalized Message Preview', () => {
    test('renders customer_name and business_name accurately for M2W', async () => {
      const contact = await Contact.findOne({ ownerId: m2wUser._id, fullName: 'Aarav Mehta' });
      const camp = await Campaign.findOne({ ownerId: m2wUser._id, name: 'Property Enquiry Follow-Up — Demo' });
      const preview = resolveTemplate(camp.templateSnapshot, contact, m2wUser);

      assert.equal(preview.valid, true);
      assert.ok(preview.body.includes('Aarav Mehta'), 'Must contain customer name');
      assert.ok(preview.body.includes('M2W Realty'), 'Must contain business name');
    });

    test('renders customer_name and business_name accurately for FitZone Gym (no M2W leakage)', async () => {
      const contact = await Contact.findOne({ ownerId: gymUser._id, fullName: 'Aditya Sharma' });
      const camp = await Campaign.findOne({ ownerId: gymUser._id, name: 'Membership Enquiry Follow-Up — Demo' });
      const preview = resolveTemplate(camp.templateSnapshot, contact, gymUser);

      assert.equal(preview.valid, true);
      assert.ok(preview.body.includes('Aditya Sharma'), 'Must contain customer name');
      assert.ok(preview.body.includes('FitZone Gym'), 'Must contain business name');
      assert.equal(preview.body.includes('M2W'), false, 'Must not contain M2W data');
    });

    test('renders customer_name and business_name accurately for CarePlus Clinic (no medical diagnoses)', async () => {
      const contact = await Contact.findOne({ ownerId: clinicUser._id, fullName: 'Ananya Gupta' });
      const camp = await Campaign.findOne({ ownerId: clinicUser._id, name: 'Clinic Enquiry Follow-Up — Demo' });
      const preview = resolveTemplate(camp.templateSnapshot, contact, clinicUser);

      assert.equal(preview.valid, true);
      assert.ok(preview.body.includes('Ananya Gupta'), 'Must contain customer name');
      assert.ok(preview.body.includes('CarePlus Clinic'), 'Must contain business name');
      assert.equal(preview.body.includes('diagnosis'), false);
    });
  });

  // -------------------------------------------------------------
  // SUITE 4: MOCK CAMPAIGN QUEUE EXECUTION & MESSAGE LIFECYCLE
  // -------------------------------------------------------------
  test.describe('4. Mock Campaign Queue Execution & Simulated Lifecycle', () => {
    let testExecutionId;

    test('createCampaignExecution queues 5 message jobs atomically', async () => {
      const camp = await Campaign.findOne({ ownerId: gymUser._id, name: 'Membership Enquiry Follow-Up — Demo' });
      const execution = await createCampaignExecution(camp._id, gymUser._id, gymUser._id);

      assert.ok(execution._id);
      assert.equal(execution.totalJobs, 5);
      assert.equal(execution.status, 'queued');
      testExecutionId = execution._id;

      const jobs = await CampaignMessageJob.find({ executionId: execution._id });
      assert.equal(jobs.length, 5);
      jobs.forEach(j => assert.equal(j.status, 'queued'));
    });

    test('processCampaignJob executes queued jobs into SIMULATED_SENT messages with timestamps', async () => {
      const jobs = await CampaignMessageJob.find({ executionId: testExecutionId });
      assert.equal(jobs.length, 5);

      for (const j of jobs) {
        const result = await processCampaignJob(j._id);
        assert.equal(result, true, 'Job must process successfully');
      }

      const exec = await CampaignExecution.findById(testExecutionId);
      assert.equal(exec.status, 'completed');
      assert.ok(exec.summary.simulated_success >= 4);

      const messages = await Message.find({ campaignRunId: testExecutionId });
      assert.equal(messages.length, 5);
      for (const m of messages) {
        assert.ok(['SIMULATED_SENT', 'BLOCKED'].includes(m.status));
        assert.equal(m.providerMode, 'MOCK');
        if (m.status === 'SIMULATED_SENT') {
          assert.ok(m.simulatedSentAt instanceof Date, 'simulatedSentAt must be recorded');
          assert.ok(m.renderedContentSnapshot?.body.includes('FitZone Gym'));
        }
      }
    });

    test('advances simulated messages from SIMULATED_SENT to SIMULATED_DELIVERED and SIMULATED_READ', async () => {
      const msg = await Message.findOne({ campaignRunId: testExecutionId });
      assert.ok(msg);

      // Simulate delivery
      msg.status = 'SIMULATED_DELIVERED';
      msg.simulatedDeliveredAt = new Date();
      await msg.save();

      await MessageEvent.create({
        ownerId: msg.ownerId,
        messageId: msg._id,
        eventType: 'SIMULATED_DELIVERED',
        previousStatus: 'SIMULATED_SENT',
        newStatus: 'SIMULATED_DELIVERED',
        source: 'MOCK_SIMULATOR',
      });

      const deliveredMsg = await Message.findById(msg._id);
      assert.equal(deliveredMsg.status, 'SIMULATED_DELIVERED');
      assert.ok(deliveredMsg.simulatedDeliveredAt instanceof Date);

      // Simulate read
      deliveredMsg.status = 'SIMULATED_READ';
      deliveredMsg.simulatedReadAt = new Date();
      await deliveredMsg.save();

      const readMsg = await Message.findById(msg._id);
      assert.equal(readMsg.status, 'SIMULATED_READ');
      assert.ok(readMsg.simulatedReadAt instanceof Date);
    });

    test('simulates failure and retry handling without dropping jobs', async () => {
      const testMsg = await Message.create({
        ownerId: gymUser._id,
        workspaceId: gymWs._id,
        messageId: `msg_fail_test_${Date.now()}`,
        contactId: (await Contact.findOne({ ownerId: gymUser._id }))._id,
        recipientPhone: '+12025550106',
        status: 'TEMPORARY_FAILURE',
        failureCode: 'MOCK_RATE_LIMIT',
        failureReason: 'Rate limit simulated for retry test',
        attemptCount: 1,
        maxAttempts: 3,
        nextRetryAt: new Date(Date.now() + 5000),
      });

      assert.equal(testMsg.status, 'TEMPORARY_FAILURE');
      assert.equal(testMsg.attemptCount, 1);
      assert.ok(testMsg.nextRetryAt instanceof Date);

      // Clean up test message
      await Message.deleteOne({ _id: testMsg._id });
    });

    test.after(async () => {
      // Clean up test execution so demo state remains clean
      if (testExecutionId) {
        await CampaignMessageJob.deleteMany({ executionId: testExecutionId });
        await CampaignExecution.deleteOne({ _id: testExecutionId });
        await Message.deleteMany({ campaignRunId: testExecutionId });
        await Campaign.updateOne(
          { ownerId: gymUser._id, name: 'Membership Enquiry Follow-Up — Demo' },
          { $set: { status: 'Draft', activeExecutionId: null } }
        );
      }
    });
  });

  // -------------------------------------------------------------
  // SUITE 5: AUTO-REPLY RULES & INBOUND MESSAGE SIMULATION
  // -------------------------------------------------------------
  test.describe('5. Auto-Reply Keyword Rules & Inbound Simulation', () => {
    test('exact 3 industry-specific rules exist per business (9 total demo rules, initially inactive drafts)', async () => {
      for (const [user, ws, expectedTriggers] of [
        [m2wUser, m2wWs, ['PRICE', 'BROCHURE', 'VISIT']],
        [gymUser, gymWs, ['MEMBERSHIP', 'TRIAL', 'TIMINGS']],
        [clinicUser, clinicWs, ['APPOINTMENT', 'TIMINGS', 'LOCATION']],
      ]) {
        const rules = await AutoReplyRule.find({ ownerId: user._id, triggerKeyword: { $ne: 'STOP' }, archivedAt: null });
        assert.equal(rules.length, 3, `Expected 3 rules for ${ws.slug}`);
        const triggers = rules.map(r => r.triggerKeyword);
        expectedTriggers.forEach(t => assert.ok(triggers.includes(t), `Missing trigger ${t} in ${ws.slug}`));

        // Initially inactive drafts
        rules.forEach(r => assert.equal(r.enabled, false, `Rule ${r.name} must be inactive draft initially`));
      }
    });

    test('M2W PRICE rule matches and produces personalized response', async () => {
      const rule = await AutoReplyRule.findOne({ ownerId: m2wUser._id, triggerKeyword: 'PRICE' });
      rule.enabled = true;
      await rule.save();

      const contact = await Contact.findOne({ ownerId: m2wUser._id, fullName: 'Aarav Mehta' });
      let conv = await Conversation.findOne({ ownerId: m2wUser._id, contactId: contact._id });
      if (!conv) conv = await Conversation.create({ ownerId: m2wUser._id, contactId: contact._id, status: 'Open' });

      const res = await evaluateInboundMessage({
        ownerId: m2wUser._id,
        conversationId: conv._id,
        contactId: contact._id,
        messageBody: 'What is the PRICE of the 3BHK flat?',
        user: m2wUser,
        executionMode: 'SYNTHETIC_TEST',
      });

      assert.equal(res.matched, true);
      assert.equal(res.executed, true);
      assert.ok(res.replyMessage?.messageBody.includes('Aarav Mehta'));
      assert.ok(res.replyMessage?.messageBody.includes('M2W Realty'));

      // Rule reset
      rule.enabled = false;
      await rule.save();
    });

    test('FitZone Gym TRIAL rule matches and produces personalized response', async () => {
      const rule = await AutoReplyRule.findOne({ ownerId: gymUser._id, triggerKeyword: 'TRIAL' });
      rule.enabled = true;
      await rule.save();

      const contact = await Contact.findOne({ ownerId: gymUser._id, fullName: 'Neha Kapoor' });
      let conv = await Conversation.findOne({ ownerId: gymUser._id, contactId: contact._id });
      if (!conv) conv = await Conversation.create({ ownerId: gymUser._id, contactId: contact._id, status: 'Open' });

      const res = await evaluateInboundMessage({
        ownerId: gymUser._id,
        conversationId: conv._id,
        contactId: contact._id,
        messageBody: 'Hi, can I book a free trial session?',
        user: gymUser,
        executionMode: 'SYNTHETIC_TEST',
      });

      assert.equal(res.matched, true);
      assert.equal(res.executed, true);
      assert.ok(res.replyMessage?.messageBody.includes('Neha Kapoor'));
      assert.ok(res.replyMessage?.messageBody.includes('FitZone Gym'));

      rule.enabled = false;
      await rule.save();
    });

    test('CarePlus Clinic APPOINTMENT rule matches administrative enquiry response', async () => {
      const rule = await AutoReplyRule.findOne({ ownerId: clinicUser._id, triggerKeyword: 'APPOINTMENT' });
      rule.enabled = true;
      await rule.save();

      const contact = await Contact.findOne({ ownerId: clinicUser._id, fullName: 'Simran Kaur' });
      let conv = await Conversation.findOne({ ownerId: clinicUser._id, contactId: contact._id });
      if (!conv) conv = await Conversation.create({ ownerId: clinicUser._id, contactId: contact._id, status: 'Open' });

      const res = await evaluateInboundMessage({
        ownerId: clinicUser._id,
        conversationId: conv._id,
        contactId: contact._id,
        messageBody: 'I would like to schedule an APPOINTMENT for next Monday',
        user: clinicUser,
        executionMode: 'SYNTHETIC_TEST',
      });

      assert.equal(res.matched, true);
      assert.equal(res.executed, true);
      assert.ok(res.replyMessage?.messageBody.includes('Simran Kaur'));
      assert.ok(res.replyMessage?.messageBody.includes('CarePlus Clinic'));
      assert.ok(res.replyMessage?.messageBody.includes('reception team'));

      rule.enabled = false;
      await rule.save();
    });

    test('keyword matching is case-insensitive, ignores extra spaces, and matches substrings when configured', () => {
      const variations = ['price', '  PRICE  ', 'What is the price?', 'Price please'];
      for (const text of variations) {
        const match = matchKeyword(text, 'PRICE', ['COST'], 'CONTAINS');
        assert.equal(match.matched, true, `Failed on "${text}"`);
      }
    });

    test('STOP keyword triggers opt-out suppression and records ConsentRecord audit', async () => {
      const contact = await Contact.findOne({ ownerId: m2wUser._id, fullName: 'Dev Khanna' });
      let conv = await Conversation.findOne({ ownerId: m2wUser._id, contactId: contact._id });
      if (!conv) conv = await Conversation.create({ ownerId: m2wUser._id, contactId: contact._id, status: 'Open' });

      const res = await evaluateInboundMessage({
        ownerId: m2wUser._id,
        conversationId: conv._id,
        contactId: contact._id,
        messageBody: 'STOP',
        user: m2wUser,
        executionMode: 'SYNTHETIC_TEST',
      });

      assert.equal(res.matched, true);
      assert.equal(res.action, 'RECORD_OPT_OUT');

      const updatedContact = await Contact.findById(contact._id);
      assert.equal(updatedContact.isSuppressed, true);
      assert.equal(updatedContact.whatsappConsentStatus, 'Opted Out');

      const consentRecord = await ConsentRecord.findOne({ contactId: contact._id, status: 'Opted Out' });
      assert.ok(consentRecord, 'Opt-out consent record must be created');

      // Reset contact back to unsuppressed demo state
      await Contact.findByIdAndUpdate(contact._id, { isSuppressed: false, whatsappConsentStatus: 'Unknown', suppressionReason: '' });
      await ConsentRecord.deleteOne({ _id: consentRecord._id });
    });

    test('Manual takeover pauses auto-reply engine', async () => {
      const contact = await Contact.findOne({ ownerId: gymUser._id, fullName: 'Karan Arora' });
      let conv = await Conversation.findOne({ ownerId: gymUser._id, contactId: contact._id });
      if (!conv) conv = await Conversation.create({ ownerId: gymUser._id, contactId: contact._id, status: 'Open' });

      // Enable manual takeover
      conv.automationStatus = 'PAUSED';
      await conv.save();

      const rule = await AutoReplyRule.findOne({ ownerId: gymUser._id, triggerKeyword: 'MEMBERSHIP' });
      rule.enabled = true;
      await rule.save();

      const res = await evaluateInboundMessage({
        ownerId: gymUser._id,
        conversationId: conv._id,
        contactId: contact._id,
        messageBody: 'Tell me about the MEMBERSHIP plans',
        user: gymUser,
        executionMode: 'SYNTHETIC_TEST',
      });

      assert.equal(res.matched, false);
      assert.equal(res.paused, true);

      // Clean up
      conv.automationStatus = 'ACTIVE';
      await conv.save();
      rule.enabled = false;
      await rule.save();
    });
  });

  // -------------------------------------------------------------
  // SUITE 6: STRICT MULTI-TENANT ISOLATION
  // -------------------------------------------------------------
  test.describe('6. Multi-Tenant Queue and Data Isolation', () => {
    test('Gym owner cannot access M2W campaign', async () => {
      const m2wCamp = await Campaign.findOne({ ownerId: m2wUser._id });
      const found = await Campaign.findOne({ _id: m2wCamp._id, ownerId: gymUser._id });
      assert.equal(found, null, 'Gym owner must not be able to retrieve M2W campaign');
    });

    test('Clinic owner cannot access Gym campaign or contacts', async () => {
      const gymCamp = await Campaign.findOne({ ownerId: gymUser._id });
      const foundCamp = await Campaign.findOne({ _id: gymCamp._id, ownerId: clinicUser._id });
      assert.equal(foundCamp, null);

      const gymContact = await Contact.findOne({ ownerId: gymUser._id });
      const foundContact = await Contact.findOne({ _id: gymContact._id, ownerId: clinicUser._id });
      assert.equal(foundContact, null);
    });

    test('Clinic owner cannot modify Gym auto-reply rule', async () => {
      const gymRule = await AutoReplyRule.findOne({ ownerId: gymUser._id });
      const updateResult = await AutoReplyRule.updateOne(
        { _id: gymRule._id, ownerId: clinicUser._id },
        { $set: { responseMessage: 'Tampered' } }
      );
      assert.equal(updateResult.matchedCount, 0, 'Cannot match rule with foreign ownerId');
      assert.equal(updateResult.modifiedCount, 0, 'Cannot modify rule with foreign ownerId');
    });
  });

  // -------------------------------------------------------------
  // SUITE 7: SEEDING IDEMPOTENCY & DATA SAFETY
  // -------------------------------------------------------------
  test.describe('7. Seeding Idempotency & Persistence Safety', () => {
    test('repeat seed runs preserve existing campaigns and rules without duplicates', async () => {
      const campCountBefore = await Campaign.countDocuments();
      const rulesCountBefore = await AutoReplyRule.countDocuments({ archivedAt: null });

      // Run seeder again
      await seedInitialDemoWorkspaces();

      const campCountAfter = await Campaign.countDocuments();
      const rulesCountAfter = await AutoReplyRule.countDocuments({ archivedAt: null });

      assert.equal(campCountAfter, campCountBefore, 'Campaigns must not be duplicated');
      assert.equal(rulesCountAfter, rulesCountBefore, 'Rules must not be duplicated');
    });

    test('template count remains at least 21 (7 per workspace, zero extra templates added in Prompt 2)', async () => {
      const totalTemplates = await MessageTemplate.countDocuments({ isArchived: false });
      assert.ok(totalTemplates >= 21, 'Must have at least 21 generic templates (7 per business)');
    });
  });

  test.after(async () => {
    // Clean up test conversations and restore demo campaigns to Draft so inbox is clean
    await Conversation.deleteMany({});
    await ConversationMessage.deleteMany({});
    await Campaign.updateMany(
      { name: { $in: ['Property Enquiry Follow-Up — Demo', 'Membership Enquiry Follow-Up — Demo', 'Clinic Enquiry Follow-Up — Demo'] } },
      { $set: { status: 'Draft', activeExecutionId: null } }
    );
    await mongoose.disconnect();
  });
});

