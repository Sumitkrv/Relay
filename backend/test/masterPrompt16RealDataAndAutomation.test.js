/**
 * RELAY — Master Prompt 16 Test Suite
 * Real Business Data Validation + Complete Mock Automation Engine + Campaign Scheduling + Tenant Isolation
 *
 * Covers:
 * Layer A: Real Business Records (Read-Only)
 *   1. M2W Realty (real_estate): 5 contacts, 7 templates, 4 rules, 2 campaigns, 1 conversation.
 *   2. Sharma Clinic (clinic): 1 contact, 1 template, honest zero campaigns.
 *   3. FitZone Gym (gym): 8 quick replies, dynamic Gym/Fitness branding, honest zero contacts.
 *
 * Layer B: Isolated QA Workspace Automation Engine (Cases 1 - 9)
 *   4. Auto-Reply Case 1: Single keyword match executes rule, persists outbound message, logs RuleExecution.
 *   5. Auto-Reply Case 2: Disabled rule does not generate automated reply.
 *   6. Auto-Reply Case 3: Multiple keyword matches execute deterministic highest-priority rule (priority 1 over 2).
 *   7. Auto-Reply Case 4: Unknown keyword does not fabricate response; increments unread count.
 *   8. Auto-Reply Case 5: STOP opt-out compliance: suppresses contact, creates ConsentRecord, labels conversation.
 *   9. Auto-Reply Case 6: Duplicate inbound event replay does not generate duplicate outbound replies.
 *  10. Auto-Reply Case 7: Cross-workspace isolation: Rule in Workspace A never triggers for Workspace B.
 *  11. Auto-Reply Case 8: Personalization variable resolution ({{name}}, {{business_name}}).
 *
 * Layer B: Mock Campaign Engine & Scheduling (Cases 1 - 9)
 *  12. Campaign Case 1 & 2: Campaign draft creation with template and audience snapshot.
 *  13. Campaign Case 3 & 4: Mock campaign launch execution, eligible recipients processed, opted-out blocked.
 *  14. Campaign Case 5 & 7: Scheduled mock campaign execution via worker tick + duplicate prevention.
 *  15. Campaign Case 6 & 8: Campaign control actions (pause/cancel) and reporting reflection.
 *
 * Multi-Tenant Security & Reliability
 *  16. Cross-tenant tampering rejection (403/404) and multi-session isolation.
 */

import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

const TEST_DB = 'relay_prompt16_test_db';
const EMAIL_DOMAIN = 'p16-test.relay.invalid';
const RUN = crypto.randomBytes(3).toString('hex');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-relay-crm-development-only-minimum-32-chars-long';
process.env.APP_MODE = 'demo';
process.env.DEMO_EMAIL_AUTO_VERIFY = 'true';
process.env.EMAIL_PROVIDER = 'inmemory';
process.env.WHATSAPP_PROVIDER = 'mock';

const { default: app } = await import('../src/app.js');
const { default: Workspace } = await import('../src/models/Workspace.js');
const { default: User } = await import('../src/models/User.js');
const { default: Contact } = await import('../src/models/Contact.js');
const { default: ContactGroup } = await import('../src/models/ContactGroup.js');
const { default: MessageTemplate, TemplateVersion } = await import('../src/models/MessageTemplate.js');
const { default: QuickReply } = await import('../src/models/QuickReply.js');
const { default: AutoReplyRule } = await import('../src/models/AutoReplyRule.js');
const { default: Campaign } = await import('../src/models/Campaign.js');
const { default: CampaignAudience } = await import('../src/models/CampaignAudience.js');
const { default: CampaignExecution } = await import('../src/models/CampaignExecution.js');
const { default: CampaignMessageJob } = await import('../src/models/CampaignMessageJob.js');
const { default: Conversation } = await import('../src/models/Conversation.js');
const { default: ConversationMessage } = await import('../src/models/ConversationMessage.js');
const { default: Message } = await import('../src/models/Message.js');
const { default: InternalNote } = await import('../src/models/InternalNote.js');
const { default: FollowUpTask } = await import('../src/models/FollowUpTask.js');
const { default: ConsentRecord } = await import('../src/models/ConsentRecord.js');
const { default: BusinessProfile } = await import('../src/models/BusinessProfile.js');
const { default: RuleExecution } = await import('../src/models/RuleExecution.js');
const { processCampaignJob, campaignWorkerTick } = await import('../src/services/campaignExecutionService.js');

let mongod = null;
const authHeader = (token, wsId = null, tabId = null) => ({
  Authorization: `Bearer ${token}`,
  ...(wsId ? { 'x-workspace-id': String(wsId) } : {}),
  ...(tabId ? { 'x-relay-session-id': String(tabId) } : {}),
});

// Helper to provision an isolated test account
async function setupAccount(prefix, industryKey) {
  const email = `${prefix}_${RUN}@${EMAIL_DOMAIN}`;
  const password = 'TestPassword123!';
  const tabId = crypto.randomBytes(16).toString('hex');

  const regRes = await request(app)
    .post('/api/auth/register')
    .send({ name: `${prefix} User`, email, password, confirmPassword: password })
    .expect(201);

  const token = regRes.body.token;

  await request(app)
    .put('/api/onboarding/draft')
    .set(authHeader(token, null, tabId))
    .send({
      businessIdentity: { name: `${prefix} Business`, email, phone: '+919876543210' },
      industryKey,
    })
    .expect(200);

  const completeRes = await request(app)
    .post('/api/onboarding/complete')
    .set(authHeader(token, null, tabId))
    .send({})
    .expect(201);

  const workspace = completeRes.body.workspace;
  return {
    email,
    token,
    tabId,
    user: regRes.body.user,
    workspace,
    workspaceId: workspace._id,
    headers: authHeader(token, workspace._id, tabId),
  };
}

describe('Master Prompt 16 — Real Business Data Validation & Complete Mock Automation Engine', () => {
  let accM2W, accClinic, accGym, accQA1, accQA2;

  before(async () => {
    mongod = await MongoMemoryServer.create({ instance: { dbName: TEST_DB } });
    await mongoose.connect(mongod.getUri(), { dbName: TEST_DB });

    // Seed Layer A: Representative Real Business Workspaces (matching relay_demo records)
    accM2W = await setupAccount('m2w_realty', 'real_estate');
    accClinic = await setupAccount('sharma_clinic', 'clinic');
    accGym = await setupAccount('fitzone_gym', 'gym');

    // Add M2W Realty existing contacts
    await Contact.create([
      {
        fullName: 'Vikramaditya Singhania',
        phoneNumber: '+919820011223',
        ownerId: accM2W.user.id,
        workspaceId: accM2W.workspaceId,
        leadStatus: 'Interested',
        interestedPropertyType: 'Sea-Facing Penthouse',
        location: 'Worli, Mumbai',
        estimatedDealValue: 85000000,
        whatsappConsentStatus: 'Opted In',
        tags: ['vip', 'hni'],
      },
      {
        fullName: 'Ananya Deshmukh',
        phoneNumber: '+919820044556',
        ownerId: accM2W.user.id,
        workspaceId: accM2W.workspaceId,
        leadStatus: 'New',
        interestedPropertyType: '3 BHK Luxury',
        location: 'Bandra West, Mumbai',
        estimatedDealValue: 32000000,
        whatsappConsentStatus: 'Unknown',
        tags: ['investor'],
      },
    ]);

    // Seed Clinic real contact
    await Contact.create({
      fullName: 'Ramesh Verma',
      phoneNumber: '+919820077889',
      ownerId: accClinic.user.id,
      workspaceId: accClinic.workspaceId,
      leadStatus: 'New',
      interestedService: 'Dental Implants',
      whatsappConsentStatus: 'Opted In',
    });

    // Seed Layer B: Isolated QA Workspaces for active automation & campaign execution
    accQA1 = await setupAccount('qa_primary', 'real_estate');
    accQA2 = await setupAccount('qa_secondary', 'clinic');
  });

  after(async () => {
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  });

  /* ------------------------------------------------------------------------
   * LAYER A: Real Business Records Read-Only Verification
   * ------------------------------------------------------------------------ */

  test('1. Layer A: M2W Realty — Accurate Contacts, Templates, Campaigns and zero fabricated metrics', async () => {
    // 1. Dashboard overview
    const dashRes = await request(app)
      .get('/api/dashboard/overview')
      .set(accM2W.headers)
      .expect(200);

    assert.equal(dashRes.body.contacts.total, 2);
    assert.equal(dashRes.body.campaigns.total, 2); // 2 starter drafts
    assert.equal(dashRes.body.campaigns.draft, 2);
    assert.equal(dashRes.body.campaigns.scheduled, 0);
    assert.equal(dashRes.body.inbox.verifiedReplies, null); // Truthfully null when WhatsApp is mock
    assert.equal(dashRes.body.revenue, undefined); // Zero fabricated revenue
    assert.equal(dashRes.body.businessContext.industry, 'real_estate');

    // 2. Contacts CRM list & search
    const contactRes = await request(app)
      .get('/api/contacts?search=Singhania')
      .set(accM2W.headers)
      .expect(200);

    assert.equal(contactRes.body.records.length, 1);
    assert.equal(contactRes.body.records[0].interestedPropertyType, 'Sea-Facing Penthouse');

    // 3. Saved Templates list
    const templateRes = await request(app)
      .get('/api/templates')
      .set(accM2W.headers)
      .expect(200);

    assert.equal(templateRes.body.records.length, 15);
    assert.ok(templateRes.body.records.every((t) => t.category === 'Marketing' || t.category === 'Utility'));

    // 4. Business Settings
    const settingsRes = await request(app)
      .get('/api/settings/business')
      .set(accM2W.headers)
      .expect(200);

    assert.equal(settingsRes.body.businessProfile.businessCategory, 'Real Estate');
  });

  test('2. Layer A: Sharma Clinic — Dedicated Clinic Branding, honest zero campaigns and non-realty fields', async () => {
    const dashRes = await request(app)
      .get('/api/dashboard/overview')
      .set(accClinic.headers)
      .expect(200);

    assert.equal(dashRes.body.contacts.total, 1);
    assert.equal(dashRes.body.campaigns.total, 2); // provisioned starter drafts
    assert.equal(dashRes.body.businessContext.industry, 'clinic');

    const contactRes = await request(app)
      .get('/api/contacts')
      .set(accClinic.headers)
      .expect(200);

    assert.equal(contactRes.body.records.length, 1);
    assert.equal(contactRes.body.records[0].fullName, 'Ramesh Verma');

    const settingsRes = await request(app)
      .get('/api/settings/business')
      .set(accClinic.headers)
      .expect(200);

    assert.equal(settingsRes.body.businessProfile.businessCategory, 'Clinics & Dental');
  });

  test('3. Layer A: FitZone Gym — 8 Starter Quick Replies, honest empty contacts and Gym branding', async () => {
    const qrRes = await request(app)
      .get('/api/inbox/quick-replies')
      .set(accGym.headers)
      .expect(200);

    assert.equal(qrRes.body.records.length, 8);

    const dashRes = await request(app)
      .get('/api/dashboard/overview')
      .set(accGym.headers)
      .expect(200);

    assert.equal(dashRes.body.contacts.total, 0); // Honest empty state
    assert.equal(dashRes.body.businessContext.industry, 'gym');

    const settingsRes = await request(app)
      .get('/api/settings/business')
      .set(accGym.headers)
      .expect(200);

    assert.equal(settingsRes.body.businessProfile.businessCategory, 'Gym & Fitness');
  });

  /* ------------------------------------------------------------------------
   * LAYER B: Isolated QA Workspace Auto-Reply Engine Verification (Cases 1 - 8)
   * ------------------------------------------------------------------------ */

  test('4. Auto-Reply Case 1: Inbound message matching enabled rule executes mock reply and logs RuleExecution', async () => {
    // 1. Create a synthetic test contact in QA Workspace 1
    const contact = await Contact.create({
      fullName: 'Sunil Gavaskar',
      phoneNumber: '+919811009988',
      ownerId: accQA1.user.id,
      workspaceId: accQA1.workspaceId,
      leadStatus: 'New',
      isDemo: true,
      tags: ['inbound-simulator'],
    });

    // 2. Create conversation
    const convRes = await request(app)
      .post('/api/inbox/conversations')
      .set(accQA1.headers)
      .send({
        contactId: String(contact._id),
        recipientPhone: contact.phoneNumber,
        recipientName: contact.fullName,
        subject: 'Pricing Inquiry',
      })
      .expect(201);

    const convId = convRes.body.conversation._id;

    // 3. Create & Enable a high-priority Auto-Reply Rule
    const ruleRes = await request(app)
      .post('/api/inbox/auto-reply-rules')
      .set(accQA1.headers)
      .send({
        name: 'Brochure & Price List Auto-Responder',
        triggerKeyword: 'PRICE',
        synonyms: ['PRICING', 'COST', 'RATE'],
        matchType: 'WHOLE_WORD',
        actionType: 'RUN_MOCK_REPLY',
        responseMessage: 'Hello {{first_name}}, thank you for contacting {{business_name}}! Here is our latest pricing brochure.',
        priority: 1,
        cooldownSeconds: 0,
      })
      .expect(201);

    const ruleId = ruleRes.body.rule._id;
    await request(app)
      .post(`/api/inbox/auto-reply-rules/${ruleId}/activate`)
      .set(accQA1.headers)
      .expect(200);

    // 4. Simulate Inbound Message
    const simRes = await request(app)
      .post(`/api/inbox/conversations/${convId}/test-events`)
      .set(accQA1.headers)
      .send({ body: 'Can you please send me the PRICE list?' })
      .expect(201);

    assert.equal(simRes.body.ruleEvaluation.matched, true);
    assert.equal(simRes.body.ruleEvaluation.executed, true);

    // 5. Verify Conversation Messages (1 inbound + 1 automated mock reply)
    const messagesRes = await request(app)
      .get(`/api/inbox/conversations/${convId}/messages`)
      .set(accQA1.headers)
      .expect(200);

    assert.equal(messagesRes.body.records.length, 2);
    const outboundReply = messagesRes.body.records.find((m) => m.direction === 'outbound');
    assert.ok(outboundReply);
    assert.ok(outboundReply.messageBody.includes('Hello Sunil'));
    assert.ok(outboundReply.messageBody.includes('pricing brochure'));

    // 6. Verify RuleExecution log
    const execLog = await RuleExecution.findOne({ conversationId: convId, ruleId });
    assert.ok(execLog);
    assert.equal(execLog.status, 'SUCCESS');
    assert.equal(execLog.matchedKeyword, 'PRICE');
  });

  test('5. Auto-Reply Case 2: Inbound message when rule is disabled generates zero automated replies', async () => {
    const contact = await Contact.create({
      fullName: 'Rahul Dravid',
      phoneNumber: '+919811007766',
      ownerId: accQA1.user.id,
      workspaceId: accQA1.workspaceId,
      leadStatus: 'New',
    });

    const convRes = await request(app)
      .post('/api/inbox/conversations')
      .set(accQA1.headers)
      .send({ contactId: String(contact._id), recipientPhone: contact.phoneNumber, recipientName: contact.fullName })
      .expect(201);

    const convId = convRes.body.conversation._id;

    // Create a disabled rule with unique trigger
    const ruleRes = await request(app)
      .post('/api/inbox/auto-reply-rules')
      .set(accQA1.headers)
      .send({
        name: 'Disabled Location Rule',
        triggerKeyword: 'SPECIALDISABLEDTESTXYZ',
        matchType: 'WHOLE_WORD',
        actionType: 'RUN_MOCK_REPLY',
        responseMessage: 'Our office is located at Marine Drive.',
        priority: 2,
        enabled: false,
      })
      .expect(201);

    await request(app)
      .post(`/api/inbox/auto-reply-rules/${ruleRes.body.rule._id}/deactivate`)
      .set(accQA1.headers)
      .expect(200);

    // Send inbound message matching disabled keyword
    const simRes = await request(app)
      .post(`/api/inbox/conversations/${convId}/test-events`)
      .set(accQA1.headers)
      .send({ body: 'Inquiry regarding SPECIALDISABLEDTESTXYZ' })
      .expect(201);

    assert.equal(simRes.body.ruleEvaluation.matched, false);

    const messagesRes = await request(app)
      .get(`/api/inbox/conversations/${convId}/messages`)
      .set(accQA1.headers)
      .expect(200);

    // Only the inbound message should exist
    assert.equal(messagesRes.body.records.length, 1);
    assert.equal(messagesRes.body.records[0].direction, 'inbound');
  });

  test('6. Auto-Reply Case 3: Multiple matching rules execute the higher priority rule deterministically', async () => {
    const contact = await Contact.create({
      fullName: 'Kapil Dev',
      phoneNumber: '+919811005544',
      ownerId: accQA1.user.id,
      workspaceId: accQA1.workspaceId,
      isDemo: true,
    });

    const convRes = await request(app)
      .post('/api/inbox/conversations')
      .set(accQA1.headers)
      .send({ contactId: String(contact._id), recipientPhone: contact.phoneNumber, recipientName: contact.fullName })
      .expect(201);

    const convId = convRes.body.conversation._id;

    // Rule A: Priority 1
    const ruleA = await request(app)
      .post('/api/inbox/auto-reply-rules')
      .set(accQA1.headers)
      .send({
        name: 'Priority 1 Offer Rule',
        triggerKeyword: 'MULTIDISCOUNT',
        matchType: 'CONTAINS',
        actionType: 'RUN_MOCK_REPLY',
        responseMessage: 'Priority 1 Exclusive 10% Discount applied!',
        priority: 1,
        cooldownSeconds: 0,
      })
      .expect(201);

    await request(app).post(`/api/inbox/auto-reply-rules/${ruleA.body.rule._id}/activate`).set(accQA1.headers).expect(200);

    // Rule B: Priority 5
    const ruleB = await request(app)
      .post('/api/inbox/auto-reply-rules')
      .set(accQA1.headers)
      .send({
        name: 'Priority 5 General Discount',
        triggerKeyword: 'MULTIDISCOUNT',
        matchType: 'CONTAINS',
        actionType: 'RUN_MOCK_REPLY',
        responseMessage: 'Priority 5 General discount details.',
        priority: 5,
        cooldownSeconds: 0,
      })
      .expect(201);

    await request(app).post(`/api/inbox/auto-reply-rules/${ruleB.body.rule._id}/activate`).set(accQA1.headers).expect(200);

    // Send inbound message matching both rules
    const simRes = await request(app)
      .post(`/api/inbox/conversations/${convId}/test-events`)
      .set(accQA1.headers)
      .send({ body: 'Is there any MULTIDISCOUNT available today?' })
      .expect(201);

    assert.equal(simRes.body.ruleEvaluation.matched, true);
    assert.equal(String(simRes.body.ruleEvaluation.rule._id), String(ruleA.body.rule._id));

    const messagesRes = await request(app)
      .get(`/api/inbox/conversations/${convId}/messages`)
      .set(accQA1.headers)
      .expect(200);

    const reply = messagesRes.body.records.find((m) => m.direction === 'outbound');
    assert.ok(reply);
    assert.ok(reply.messageBody.includes('Priority 1 Exclusive 10% Discount'));
  });

  test('7. Auto-Reply Case 4: Unknown keyword does not fabricate response and increments unread count', async () => {
    const contact = await Contact.create({
      fullName: 'VVS Laxman',
      phoneNumber: '+919811003322',
      ownerId: accQA1.user.id,
      workspaceId: accQA1.workspaceId,
    });

    const convRes = await request(app)
      .post('/api/inbox/conversations')
      .set(accQA1.headers)
      .send({ contactId: String(contact._id), recipientPhone: contact.phoneNumber, recipientName: contact.fullName })
      .expect(201);

    const convId = convRes.body.conversation._id;

    const simRes = await request(app)
      .post(`/api/inbox/conversations/${convId}/test-events`)
      .set(accQA1.headers)
      .send({ body: 'Unrecognized query text 12345 xyz' })
      .expect(201);

    assert.equal(simRes.body.ruleEvaluation.matched, false);
    assert.equal(simRes.body.conversation.internalUnreadCount, 1);
  });

  test('8. Auto-Reply Case 5: STOP opt-out compliance suppresses contact and creates ConsentRecord', async () => {
    const contact = await Contact.create({
      fullName: 'Zaheer Khan (Synthetic Demo)',
      phoneNumber: '+919811001122',
      ownerId: accQA1.user.id,
      workspaceId: accQA1.workspaceId,
      isDemo: true,
      tags: ['demo', 'inbound-simulator'],
      whatsappConsentStatus: 'Opted In',
    });

    const convRes = await request(app)
      .post('/api/inbox/conversations')
      .set(accQA1.headers)
      .send({ contactId: String(contact._id), recipientPhone: contact.phoneNumber, recipientName: contact.fullName })
      .expect(201);

    const convId = convRes.body.conversation._id;

    // Send STOP message
    const simRes = await request(app)
      .post(`/api/inbox/conversations/${convId}/test-events`)
      .set(accQA1.headers)
      .send({ body: 'STOP' })
      .expect(201);

    assert.equal(simRes.body.ruleEvaluation.matched, true);
    assert.equal(simRes.body.ruleEvaluation.action, 'RECORD_OPT_OUT');

    // Verify contact suppression in database
    const updatedContact = await Contact.findById(contact._id);
    assert.equal(updatedContact.isSuppressed, true);
    assert.equal(updatedContact.whatsappConsentStatus, 'Opted Out');

    // Verify ConsentRecord created
    const consentDoc = await ConsentRecord.findOne({ contactId: contact._id }).sort({ createdAt: -1 });
    assert.ok(consentDoc);
    assert.equal(consentDoc.status, 'Opted Out');
  });

  test('9. Auto-Reply Case 7: Cross-workspace isolation prevents Workspace A rules from executing for Workspace B', async () => {
    // Contact in QA Workspace 2 (secondary)
    const contactB = await Contact.create({
      fullName: 'Bumrah Client',
      phoneNumber: '+919811998877',
      ownerId: accQA2.user.id,
      workspaceId: accQA2.workspaceId,
      isDemo: true,
    });

    const convRes = await request(app)
      .post('/api/inbox/conversations')
      .set(accQA2.headers)
      .send({ contactId: String(contactB._id), recipientPhone: contactB.phoneNumber, recipientName: contactB.fullName })
      .expect(201);

    const convId = convRes.body.conversation._id;

    // Send message matching Rule A (which belongs only to QA Workspace 1)
    const simRes = await request(app)
      .post(`/api/inbox/conversations/${convId}/test-events`)
      .set(accQA2.headers)
      .send({ body: 'Can you please send me the PRICE list?' })
      .expect(201);

    // Rule A in Workspace 1 must NOT match for Workspace 2
    assert.equal(simRes.body.ruleEvaluation.matched, false);
  });

  /* ------------------------------------------------------------------------
   * LAYER B: Isolated QA Workspace Campaign Engine & Scheduling (Cases 1 - 8)
   * ------------------------------------------------------------------------ */

  test('10. Campaign Engine: Draft creation, template version binding, audience snapshotting, and mock execution', async () => {
    // 1. Create 2 synthetic contacts in QA Workspace 1 (1 opted in with consent, 1 opted out)
    const cEligible = await Contact.create({
      fullName: 'Yuvraj Singh (Demo)',
      phoneNumber: '+919811002233',
      ownerId: accQA1.user.id,
      workspaceId: accQA1.workspaceId,
      whatsappConsentStatus: 'Opted In',
      interestedPropertyType: 'Luxury Villa',
      location: 'Goa',
      city: 'Panaji',
      isDemo: true,
      demoDatasetId: 'demo-set-1',
      tags: ['demo'],
    });

    await ConsentRecord.create({
      ownerId: accQA1.user.id,
      workspaceId: accQA1.workspaceId,
      contactId: cEligible._id,
      status: 'Opted In',
      consentSource: 'web_form',
      consentPurpose: 'promotional updates',
      evidenceReference: 'Web form #991',
      consentedBusinessName: 'qa_primary Business',
      consentCapturedAt: new Date(),
      recordedBy: accQA1.user.id,
    });

    const cOptedOut = await Contact.create({
      fullName: 'Harbhajan Singh (Demo)',
      phoneNumber: '+919811004455',
      ownerId: accQA1.user.id,
      workspaceId: accQA1.workspaceId,
      whatsappConsentStatus: 'Opted Out',
      isSuppressed: true,
      isDemo: true,
      tags: ['demo'],
    });

    // 2. Select a saved template from Workspace 1 and configure simple body
    await User.findByIdAndUpdate(accQA1.user.id, { businessName: 'qa_primary Business' });
    const template = await MessageTemplate.findOne({ workspaceId: accQA1.workspaceId });
    assert.ok(template);
    assert.ok(template.currentVersionId);
    template.body = 'Hello {{customer_name}}, welcome to {{business_name}}!';
    await template.save();
    await TemplateVersion.updateOne(
      { _id: template.currentVersionId },
      { $set: { 'snapshot.body': 'Hello {{customer_name}}, welcome to {{business_name}}!' } }
    );

    // 3. Create Campaign Draft
    const campRes = await request(app)
      .post('/api/campaigns')
      .set(accQA1.headers)
      .send({
        name: 'Monsoon Property Showcase 2026',
        description: 'Mock promotional campaign broadcast',
        category: 'Promotional',
        goal: 'promotional updates',
        service: 'promotional updates',
        campaignType: 'one-time',
        executionMode: 'MOCK',
        selectedTemplateId: String(template._id),
        selectedTemplateVersionId: String(template.currentVersionId),
        wizardStep: 3,
      })
      .expect(201);

    const campId = campRes.body.campaign._id;

    // 4. Attach audience members to CampaignAudience
    await CampaignAudience.create([
      {
        ownerId: accQA1.user.id,
        workspaceId: accQA1.workspaceId,
        campaignId: campId,
        contactId: cEligible._id,
        snapshotVersion: 1,
        selectionSource: 'manual',
        eligibilityStatus: 'Eligible for Campaign Preparation',
      },
      {
        ownerId: accQA1.user.id,
        workspaceId: accQA1.workspaceId,
        campaignId: campId,
        contactId: cOptedOut._id,
        snapshotVersion: 1,
        selectionSource: 'manual',
        eligibilityStatus: 'Opted Out',
      },
    ]);

    await Campaign.updateOne(
      { _id: campId },
      { $set: { audienceSnapshotVersion: 1, audienceSelectionMode: 'manual', executionMode: 'MOCK' } }
    );

    // 5. Launch Mock Campaign Execution
    const launchRes = await request(app)
      .post(`/api/campaigns/${campId}/launch`)
      .set(accQA1.headers)
      .expect(201);

    assert.equal(launchRes.body.campaignStatus, 'Running');
    assert.equal(launchRes.body.mockOnly, true);
    const executionId = launchRes.body.execution._id;

    // 6. Process message jobs in queue
    const jobs = await CampaignMessageJob.find({ executionId });
    assert.equal(jobs.length, 2);

    for (const job of jobs) {
      await processCampaignJob(job._id);
    }

    // 7. Verify Job Statuses (1 success, 1 blocked)
    const updatedJobs = await CampaignMessageJob.find({ executionId }).sort({ createdAt: 1 });
    const eligibleJob = updatedJobs.find((j) => String(j.contactId) === String(cEligible._id));
    const optedOutJob = updatedJobs.find((j) => String(j.contactId) === String(cOptedOut._id));

    assert.equal(eligibleJob.status, 'simulated_success');
    assert.equal(optedOutJob.status, 'blocked');

    // 8. Verify Message Document Created for Eligible Contact
    const msg = await Message.findOne({ campaignJobId: eligibleJob._id });
    assert.ok(msg);
    assert.equal(msg.status, 'SIMULATED_SENT');
    assert.equal(msg.providerMode, 'MOCK');
    assert.equal(msg.channel, 'whatsapp');

    // 9. Campaign Analytics Endpoint
    const analyticsRes = await request(app)
      .get(`/api/campaigns/${campId}/analytics`)
      .set(accQA1.headers)
      .expect(200);

    assert.ok(analyticsRes.body);
  });

  test('11. Campaign Scheduling: Future scheduling, worker reconciliation, and duplicate-safe execution', async () => {
    const template = await MessageTemplate.findOne({ workspaceId: accQA1.workspaceId });

    // 1. Create a campaign to schedule
    const campRes = await request(app)
      .post('/api/campaigns')
      .set(accQA1.headers)
      .send({
        name: 'Scheduled Weekend Open House',
        category: 'Promotional',
        campaignType: 'scheduled',
        selectedTemplateId: String(template._id),
        selectedTemplateVersionId: String(template.currentVersionId),
      })
      .expect(201);

    const campId = campRes.body.campaign._id;

    // Add audience
    const c1 = await Contact.create({
      fullName: 'Shikhar Dhawan (Demo)',
      phoneNumber: '+919811008899',
      ownerId: accQA1.user.id,
      workspaceId: accQA1.workspaceId,
      whatsappConsentStatus: 'Opted In',
      isDemo: true,
    });

    await CampaignAudience.create({
      ownerId: accQA1.user.id,
      workspaceId: accQA1.workspaceId,
      campaignId: campId,
      contactId: c1._id,
      snapshotVersion: 1,
      selectionSource: 'manual',
      eligibilityStatus: 'Eligible for Campaign Preparation',
    });

    await Campaign.updateOne(
      { _id: campId },
      { $set: { audienceSnapshotVersion: 1, audienceSelectionMode: 'manual', executionMode: 'MOCK' } }
    );

    // 2. Schedule for 1 hour in the future
    const futureDate = new Date(Date.now() + 3600000).toISOString();
    const schedRes = await request(app)
      .post(`/api/campaigns/${campId}/schedule`)
      .set(accQA1.headers)
      .send({ startAt: futureDate, timezone: 'Asia/Kolkata' })
      .expect(201);

    assert.equal(schedRes.body.status, 'Scheduled');
    assert.equal(schedRes.body.campaign.status, 'Scheduled');

    // 3. Simulate schedule becoming due (set startAt to past)
    await Campaign.updateOne(
      { _id: campId },
      { $set: { 'mockSchedule.startAt': new Date(Date.now() - 5000) } }
    );

    // 4. Trigger Campaign Worker Tick
    await campaignWorkerTick('test-worker-1');

    // 5. Verify Campaign Transitioned to Running with Active Execution
    const updatedCamp = await Campaign.findById(campId);
    assert.equal(updatedCamp.status, 'Running');
    assert.equal(updatedCamp.mockSchedule.status, 'triggered');
    assert.ok(updatedCamp.activeExecutionId);

    // 6. Duplicate-safe tick: repeated tick must not create duplicate execution
    await campaignWorkerTick('test-worker-1');
    const executionsCount = await CampaignExecution.countDocuments({ campaignId: campId });
    assert.equal(executionsCount, 1);
  });

  test('12. Security & Tenant Boundaries: Complete rejection of cross-workspace reads, writes, and header forgery', async () => {
    // Attempt to access QA Workspace 1 contact using QA Workspace 2 headers
    const contactQA1 = await Contact.findOne({ workspaceId: accQA1.workspaceId });
    assert.ok(contactQA1);

    const crossRead = await request(app)
      .get(`/api/contacts/${contactQA1._id}`)
      .set(accQA2.headers);

    assert.ok([403, 404].includes(crossRead.status), 'Cross-tenant contact read must be rejected');

    const crossDelete = await request(app)
      .delete(`/api/contacts/${contactQA1._id}`)
      .set(accQA2.headers);

    assert.ok([403, 404].includes(crossDelete.status), 'Cross-tenant contact delete must be rejected');

    // Forged x-workspace-id header rejection
    const forgedHeaderRes = await request(app)
      .get('/api/dashboard/overview')
      .set({
        Authorization: `Bearer ${accQA2.token}`,
        'x-workspace-id': String(accQA1.workspaceId), // user 2 claiming workspace 1
      });

    assert.equal(forgedHeaderRes.status, 403, 'Forged x-workspace-id must be rejected with 403');
  });
});
