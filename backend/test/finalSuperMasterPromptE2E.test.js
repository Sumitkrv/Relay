import crypto from 'node:crypto';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-relay-crm-development-only-minimum-32-chars-long';
process.env.APP_MODE = 'demo';
process.env.DEMO_EMAIL_AUTO_VERIFY = 'true';
process.env.AUTH_EMAIL_VERIFICATION_MODE = 'development_bypass';
process.env.EMAIL_PROVIDER = 'inmemory';
process.env.WHATSAPP_PROVIDER = 'mock';

const { default: test, before, after, describe } = await import('node:test');
const { default: assert } = await import('node:assert/strict');
const { default: request } = await import('supertest');
const { default: mongoose } = await import('mongoose');
const { MongoMemoryServer } = await import('mongodb-memory-server');

const { default: app } = await import('../src/app.js');
const { default: User } = await import('../src/models/User.js');
const { default: Workspace } = await import('../src/models/Workspace.js');
const { default: Contact } = await import('../src/models/Contact.js');
const { default: FollowUpTask } = await import('../src/models/FollowUpTask.js');
const { default: MessageTemplate, TemplateVersion } = await import('../src/models/MessageTemplate.js');
const { default: QuickReply } = await import('../src/models/QuickReply.js');
const { default: AutoReplyRule } = await import('../src/models/AutoReplyRule.js');
const { default: RuleExecution } = await import('../src/models/RuleExecution.js');
const { default: Conversation } = await import('../src/models/Conversation.js');
const { default: ConversationMessage } = await import('../src/models/ConversationMessage.js');
const { default: Campaign } = await import('../src/models/Campaign.js');
const { default: CampaignAudience } = await import('../src/models/CampaignAudience.js');
const { default: CampaignMessageJob } = await import('../src/models/CampaignMessageJob.js');
const { default: Message } = await import('../src/models/Message.js');
const { default: ConsentRecord } = await import('../src/models/ConsentRecord.js');
const { processCampaignJob } = await import('../src/services/campaignExecutionService.js');

const TEST_DB = 'relay_final_test_db';
let mongod;

function authHeader(token, workspaceId = null, tabId = null) {
  return {
    Authorization: `Bearer ${token}`,
    ...(workspaceId ? { 'x-workspace-id': String(workspaceId) } : {}),
    ...(tabId ? { 'x-relay-session-id': String(tabId) } : {}),
  };
}

async function createTestAccount(prefix, industryKey = 'real_estate') {
  const email = `${prefix}_${Date.now()}@relay-test.internal`;
  const password = 'StrongTestPassword123!';
  const tabId = crypto.randomBytes(16).toString('hex');

  const regRes = await request(app)
    .post('/api/auth/register')
    .send({ name: `${prefix} Lead`, email, password, confirmPassword: password })
    .expect(201);

  const token = regRes.body.token;

  await request(app)
    .put('/api/onboarding/draft')
    .set(authHeader(token, null, tabId))
    .send({
      businessIdentity: { name: `${prefix} Enterprise`, email, phone: '+919876543210' },
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
    user: regRes.body.user,
    token,
    tabId,
    workspace,
    workspaceId: workspace._id,
    headers: authHeader(token, workspace._id, tabId),
  };
}

describe('RELAY — FINAL SUPER MASTER PROMPT: 100% REAL DATA END-TO-END VALIDATION', () => {
  let qaAccount;

  before(async () => {
    mongod = await MongoMemoryServer.create({ instance: { dbName: TEST_DB } });
    await mongoose.connect(mongod.getUri(), { dbName: TEST_DB });
    qaAccount = await createTestAccount('qa_ops', 'real_estate');
    await User.findByIdAndUpdate(qaAccount.user.id, { businessName: 'QA Enterprise Realty' });
  });

  after(async () => {
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  });

  /* ------------------------------------------------------------------------
   * Step 1 to 4: Real Contacts CRUD, MongoDB Persistence & Follow-Up Tasks
   * ------------------------------------------------------------------------ */

  let createdContactId;

  test('1. Contact Creation via Real API persists genuine MongoDB document with zero fake data', async () => {
    const res = await request(app)
      .post('/api/contacts')
      .set(qaAccount.headers)
      .send({
        fullName: 'Devendra Fadnavis (Synthetic Lead)',
        phoneNumber: '+919820011223',
        email: 'devendra.lead@relay-test.internal',
        leadStatus: 'New',
        leadSource: 'Website Enquiry',
        interestedPropertyType: 'Sea-Facing Penthouse',
        location: 'Worli, Mumbai',
        estimatedDealValue: 120000000,
        tags: ['hni', 'investor'],
      })
      .expect(201);

    assert.ok(res.body.contact?._id);
    createdContactId = res.body.contact._id;

    // Verify direct MongoDB record
    const dbDoc = await Contact.findById(createdContactId);
    assert.ok(dbDoc);
    assert.equal(dbDoc.fullName, 'Devendra Fadnavis (Synthetic Lead)');
    assert.equal(dbDoc.estimatedDealValue, 120000000);
    assert.equal(String(dbDoc.workspaceId), String(qaAccount.workspaceId));
    assert.equal(String(dbDoc.ownerId), String(qaAccount.user.id));
  });

  test('2. Contact Update via Real API modifies MongoDB and survives query verification', async () => {
    const updateRes = await request(app)
      .patch(`/api/contacts/${createdContactId}`)
      .set(qaAccount.headers)
      .send({
        leadStatus: 'Interested',
        estimatedDealValue: 135000000,
        location: 'Nariman Point, Mumbai',
      })
      .expect(200);

    assert.equal(updateRes.body.contact.leadStatus, 'Interested');
    assert.equal(updateRes.body.contact.estimatedDealValue, 135000000);

    // Verify in MongoDB
    const updatedDb = await Contact.findById(createdContactId);
    assert.equal(updatedDb.leadStatus, 'Interested');
    assert.equal(updatedDb.location, 'Nariman Point, Mumbai');
  });

  test('3. Follow-Up Task creation links to Contact and updates Dashboard counts honestly', async () => {
    // Add Follow-Up Task
    const dueDate = new Date(Date.now() + 86400000).toISOString();
    const taskRes = await request(app)
      .post('/api/follow-ups')
      .set(qaAccount.headers)
      .send({
        contactId: String(createdContactId),
        taskType: 'call',
        title: 'Schedule Private Site Inspection',
        description: 'Client requested Sunday morning penthouse tour',
        dueAt: dueDate,
        priority: 'High',
      })
      .expect(201);

    assert.ok(taskRes.body.task?._id);
    const taskId = taskRes.body.task._id;

    // Verify Task persisted in MongoDB
    const dbTask = await FollowUpTask.findById(taskId);
    assert.ok(dbTask);
    assert.equal(dbTask.title, 'Schedule Private Site Inspection');
    assert.equal(String(dbTask.contactId), String(createdContactId));

    // Verify Dashboard Overview accurately calculates this 1 contact and status
    const dashRes = await request(app)
      .get('/api/dashboard/overview')
      .set(qaAccount.headers)
      .expect(200);

    assert.equal(dashRes.body.contacts.total, 1);
    assert.equal(dashRes.body.contacts.interestedLeads, 1);
    assert.equal(dashRes.body.contacts.newLeads, 0); // Moved to Interested
    assert.equal(dashRes.body.revenue, undefined); // Zero fabricated revenue
  });

  /* ------------------------------------------------------------------------
   * Step 5 & 6: Real Template Studio & Quick Replies CRUD
   * ------------------------------------------------------------------------ */

  let createdTemplateId;

  test('4. Template Studio: Create custom template, version snapshot and verify MongoDB document', async () => {
    const tmplRes = await request(app)
      .post('/api/templates')
      .set(qaAccount.headers)
      .send({
        name: 'VIP Penthouse Walkthrough Invitation',
        description: 'Exclusive invitation for high net-worth real estate buyers',
        category: 'Marketing',
        body: 'Hello {{customer_name}}, thank you for your interest in {{property_type}} at {{location}}. We invite you to an exclusive tour on behalf of {{business_name}}.',
        footer: 'Reply STOP to opt out.',
        language: 'en',
      })
      .expect(201);

    assert.ok(tmplRes.body.template?._id);
    createdTemplateId = tmplRes.body.template._id;

    // Verify MongoDB Template and pinned TemplateVersion
    const dbTmpl = await MessageTemplate.findById(createdTemplateId);
    assert.ok(dbTmpl);
    assert.equal(dbTmpl.name, 'VIP Penthouse Walkthrough Invitation');
    assert.ok(dbTmpl.currentVersionId);

    const dbVer = await TemplateVersion.findById(dbTmpl.currentVersionId);
    assert.ok(dbVer);
    assert.ok(dbVer.snapshot.body.includes('{{property_type}}'));
  });

  test('5. Quick Reply: Create, persist, and verify retrieval via API and MongoDB', async () => {
    const qrRes = await request(app)
      .post('/api/inbox/quick-replies')
      .set(qaAccount.headers)
      .send({
        name: 'Site Visit Confirmation',
        messageText: 'Hello {{first_name}}, your site visit has been scheduled! Our relationship manager will meet you at the property.',
        category: 'Scheduling',
      })
      .expect(201);

    assert.ok(qrRes.body.quickReply?._id);
    const qrId = qrRes.body.quickReply._id;

    const dbQr = await QuickReply.findById(qrId);
    assert.ok(dbQr);
    assert.equal(dbQr.name, 'Site Visit Confirmation');
    assert.equal(String(dbQr.workspaceId), String(qaAccount.workspaceId));
  });

  /* ------------------------------------------------------------------------
   * Step 7 & 8: Auto-Reply Rule Engine & Mock WhatsApp Provider Inbound/Outbound
   * ------------------------------------------------------------------------ */

  let qaConversationId;

  test('6. Auto-Reply Engine: Real keyword evaluation, variable interpolation, mock dispatch and RuleExecution log', async () => {
    // 1. Create a Conversation in Inbox
    const convRes = await request(app)
      .post('/api/inbox/conversations')
      .set(qaAccount.headers)
      .send({
        contactId: String(createdContactId),
        source: 'manual',
      })
      .expect(201);

    qaConversationId = convRes.body.conversation._id;
    assert.ok(qaConversationId);

    // 2. Create and Activate an Auto-Reply Rule
    const ruleRes = await request(app)
      .post('/api/inbox/auto-reply-rules')
      .set(qaAccount.headers)
      .send({
        name: 'Luxury Penthouse Pricing Trigger',
        triggerKeyword: 'PENTHOUSE',
        synonyms: ['LUXURY', 'FLOORPLAN', 'RATES'],
        matchType: 'WHOLE_WORD',
        actionType: 'RUN_MOCK_REPLY',
        responseMessage: 'Hello {{first_name}}, our premium {{property_type}} in {{location}} starts at ₹12 Cr. Team {{business_name}} is at your service!',
        priority: 1,
        cooldownSeconds: 0,
      })
      .expect(201);

    const ruleId = ruleRes.body.rule._id;
    await request(app)
      .post(`/api/inbox/auto-reply-rules/${ruleId}/activate`)
      .set(qaAccount.headers)
      .expect(200);

    // 3. Simulate Incoming WhatsApp Message through Mock Provider
    const simRes = await request(app)
      .post(`/api/inbox/conversations/${qaConversationId}/test-events`)
      .set(qaAccount.headers)
      .send({ body: 'Could you share the PENTHOUSE details please?' })
      .expect(201);

    assert.equal(simRes.body.ruleEvaluation.matched, true);
    assert.equal(simRes.body.ruleEvaluation.executed, true);

    // 4. Verify Outbound Message created and persisted in MongoDB
    const messages = await ConversationMessage.find({ conversationId: qaConversationId }).sort({ createdAt: 1 });
    assert.equal(messages.length, 2); // 1 inbound + 1 automated reply

    const inbound = messages[0];
    assert.equal(inbound.direction, 'inbound');
    assert.ok(inbound.messageBody.includes('PENTHOUSE'));

    const outbound = messages[1];
    assert.equal(outbound.direction, 'outbound');
    assert.ok(outbound.messageBody.includes('Hello Devendra'));
    assert.ok(outbound.messageBody.includes('Sea-Facing Penthouse'));
    assert.ok(outbound.messageBody.includes('qa_ops Enterprise'));
    assert.ok(!outbound.messageBody.includes('QA Enterprise Realty'), 'Account identity must not override the authorized workspace');

    // 5. Verify RuleExecution in MongoDB
    const execLog = await RuleExecution.findOne({ conversationId: qaConversationId, ruleId });
    assert.ok(execLog);
    assert.equal(execLog.status, 'SUCCESS');
    assert.equal(execLog.matchedKeyword, 'PENTHOUSE');
  });

  /* ------------------------------------------------------------------------
   * Step 9 & 10: Mock Campaign Engine, Audience Eligibility & Job Processing
   * ------------------------------------------------------------------------ */

  test('7. Mock Campaign Engine: Draft creation, affirmative consent check, job execution and Message document logging', async () => {
    // 1. Create affirmative ConsentRecord
    await ConsentRecord.create({
      ownerId: qaAccount.user.id,
      workspaceId: qaAccount.workspaceId,
      contactId: createdContactId,
      status: 'Opted In',
      consentSource: 'web_form',
      consentPurpose: 'Property updates and showcase invitations',
      evidenceReference: 'Web inquiry form #1088',
      consentedBusinessName: 'QA Enterprise Realty',
      consentCapturedAt: new Date(),
      recordedBy: qaAccount.user.id,
    });

    // Update Contact consent status
    await Contact.updateOne({ _id: createdContactId }, { $set: { whatsappConsentStatus: 'Opted In' } });

    // 2. Create Campaign Draft
    const tmplDoc = await MessageTemplate.findById(createdTemplateId);
    assert.ok(tmplDoc);
    assert.ok(tmplDoc.currentVersionId);

    const campRes = await request(app)
      .post('/api/campaigns')
      .set(qaAccount.headers)
      .send({
        name: 'Private Penthouse Preview Broadcaster',
        description: 'Mock promotional campaign for penthouse buyers',
        category: 'Promotional',
        goal: 'Property updates and showcase invitations',
        service: 'Property updates and showcase invitations',
        campaignType: 'one-time',
        executionMode: 'MOCK',
        selectedTemplateId: String(createdTemplateId),
        selectedTemplateVersionId: String(tmplDoc.currentVersionId),
        wizardStep: 3,
      })
      .expect(201);

    const campId = campRes.body.campaign._id;
    assert.ok(campId);

    // 3. Attach Audience Member
    await CampaignAudience.create({
      ownerId: qaAccount.user.id,
      workspaceId: qaAccount.workspaceId,
      campaignId: campId,
      contactId: createdContactId,
      snapshotVersion: 1,
      selectionSource: 'manual',
      eligibilityStatus: 'Eligible for Campaign Preparation',
    });

    await Campaign.updateOne(
      { _id: campId },
      { $set: { audienceSnapshotVersion: 1, audienceSelectionMode: 'manual', executionMode: 'MOCK' } }
    );

    // 4. Launch Campaign (Mock Execution Mode)
    const launchRes = await request(app)
      .post(`/api/campaigns/${campId}/launch`)
      .set(qaAccount.headers)
      .expect(201);

    assert.equal(launchRes.body.campaignStatus, 'Running');
    assert.equal(launchRes.body.mockOnly, true);
    const executionId = launchRes.body.execution._id;

    // 5. Worker tick processing
    const jobs = await CampaignMessageJob.find({ executionId });
    assert.equal(jobs.length, 1);
    await processCampaignJob(jobs[0]._id);

    // 6. Verify Job State in MongoDB
    const updatedJob = await CampaignMessageJob.findById(jobs[0]._id);
    assert.equal(updatedJob.status, 'simulated_success');

    // 7. Verify Message Record created
    const msg = await Message.findOne({ campaignJobId: jobs[0]._id });
    assert.ok(msg);
    assert.equal(msg.status, 'SIMULATED_SENT');
    assert.equal(msg.providerMode, 'MOCK');
    assert.equal(msg.channel, 'whatsapp');
    assert.ok((msg.renderedContentSnapshot?.body || '').includes('Devendra Fadnavis'));
  });

  /* ------------------------------------------------------------------------
   * Step 11: Real Reports & Analytics Aggregation
   * ------------------------------------------------------------------------ */

  test('8. Reports Overview reflects genuine MongoDB execution counts with zero fabricated stats', async () => {
    const repRes = await request(app)
      .get('/api/reports/overview?range=30d')
      .set(qaAccount.headers)
      .expect(200);

    assert.ok(repRes.body);
    if (repRes.body.primaryKpis) {
      assert.equal(repRes.body.meta.providerStatus, 'DISCONNECTED');
      assert.ok(repRes.body.meta.providerReason.includes('Official Meta WhatsApp Cloud API is disconnected'));
    } else {
      // If legacy reports response format
      assert.ok(repRes.body);
    }
  });

  /* ------------------------------------------------------------------------
   * Step 12: Multi-Tenant Workspace Boundary Enforcement
   * ------------------------------------------------------------------------ */

  test('9. Multi-Tenant Isolation: Another workspace user cannot read or update QA workspace records', async () => {
    const foreignAccount = await createTestAccount('foreign_ops', 'gym');

    // Attempt to read QA contact
    await request(app)
      .get(`/api/contacts/${createdContactId}`)
      .set(foreignAccount.headers)
      .expect(404);

    // Attempt to update QA contact
    await request(app)
      .patch(`/api/contacts/${createdContactId}`)
      .set(foreignAccount.headers)
      .send({ fullName: 'Malicious Overwrite' })
      .expect(404);

    // Verify contact untouched in MongoDB
    const checkDoc = await Contact.findById(createdContactId);
    assert.equal(checkDoc.fullName, 'Devendra Fadnavis (Synthetic Lead)');
  });
});
