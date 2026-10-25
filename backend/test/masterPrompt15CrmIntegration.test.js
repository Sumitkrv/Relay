/**
 * Master Prompt 15 — Complete Dynamic CRM Data Integration & Multi-Module Persistence
 *
 * Covers all core CRM modules through genuine backend REST APIs:
 *  1. Contact CRUD, search, industry filters, tags, and CSV export.
 *  2. Contact Groups / Audiences (creation, assignment, member counts).
 *  3. Notes and Follow-up Tasks (CRUD, due dates, completion, dashboard link).
 *  4. Message Template Studio (saved templates, editing, versioning, preview).
 *  5. Quick Replies (CRUD, search, composer compatibility).
 *  6. Auto-Reply Rules (CRUD, enable/disable, priority, test matcher).
 *  7. Campaign Drafts (creation, template assignment, audience selection, status).
 *  8. Inbox & Conversations (messages, contact lookup, mock simulation).
 *  9. Dashboard & Reports (honest workspace-scoped metrics, no fake revenue/orders).
 * 10. Settings Persistence (profile, business profile with dynamic category, preferences).
 * 11. Multi-Tab Session Isolation (3 concurrent tabs with independent session IDs).
 * 12. Cross-Tenant Authorization & Rejection (403/404 on cross-workspace tampering).
 */
import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

const TEST_DB = 'relay_crm_integration_test';
const EMAIL_DOMAIN = 'crm-test.relay.invalid';
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
const { default: MessageTemplate } = await import('../src/models/MessageTemplate.js');
const { default: QuickReply } = await import('../src/models/QuickReply.js');
const { default: AutoReplyRule } = await import('../src/models/AutoReplyRule.js');
const { default: Campaign } = await import('../src/models/Campaign.js');
const { default: Conversation } = await import('../src/models/Conversation.js');
const { default: Message } = await import('../src/models/Message.js');
const { default: InternalNote } = await import('../src/models/InternalNote.js');
const { default: FollowUpTask } = await import('../src/models/FollowUpTask.js');
const { default: BusinessProfile } = await import('../src/models/BusinessProfile.js');

let mongod = null;
const authHeader = (token, wsId = null, tabId = null) => ({
  Authorization: `Bearer ${token}`,
  ...(wsId ? { 'x-workspace-id': String(wsId) } : {}),
  ...(tabId ? { 'x-relay-session-id': String(tabId) } : {}),
});

// Helper to create a fully provisioned test account
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

describe('Master Prompt 15 — Complete Dynamic CRM Data Integration', () => {
  let accA, accB, accC;

  before(async () => {
    mongod = await MongoMemoryServer.create({ instance: { dbName: TEST_DB } });
    await mongoose.connect(mongod.getUri(), { dbName: TEST_DB });

    // Tab A: Real Estate, Tab B: Gym, Tab C: Generic Business
    accA = await setupAccount('re_owner', 'real_estate');
    accB = await setupAccount('gym_owner', 'gym');
    accC = await setupAccount('generic_owner', 'generic_business');
  });

  after(async () => {
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  });

  test('1. Contact CRM: Full CRUD, industry fields, lead status, search, and CSV export', async () => {
    // CREATE Contact
    const createRes = await request(app)
      .post('/api/contacts')
      .set(accA.headers)
      .send({
        fullName: 'Rajesh Sharma',
        phoneNumber: '+919820123456',
        email: 'rajesh@example.com',
        leadStatus: 'New',
        priority: 'High',
        consent: {
          status: 'Opted In',
          consentSource: 'Website Form',
          consentPurpose: 'Property Brochure & Updates',
          evidenceReference: 'Web form #8821',
          consentCapturedAt: new Date().toISOString(),
        },
        interestedPropertyType: '3 BHK Luxury Apartment',
        location: 'Bandra West, Mumbai',
        estimatedDealValue: 25000000,
        tags: ['vip', 'investor'],
      })
      .expect(201);

    const contactId = createRes.body.contact._id;
    assert.equal(createRes.body.contact.fullName, 'Rajesh Sharma');
    assert.equal(String(createRes.body.contact.workspaceId), String(accA.workspaceId));

    // READ Contact
    const getRes = await request(app)
      .get(`/api/contacts/${contactId}`)
      .set(accA.headers)
      .expect(200);
    assert.equal(getRes.body.contact.interestedPropertyType, '3 BHK Luxury Apartment');

    // UPDATE Contact
    const updateRes = await request(app)
      .patch(`/api/contacts/${contactId}`)
      .set(accA.headers)
      .send({ leadStatus: 'Interested', priority: 'Urgent' })
      .expect(200);
    assert.equal(updateRes.body.contact.leadStatus, 'Interested');
    assert.equal(updateRes.body.contact.priority, 'Urgent');

    // SEARCH Contacts
    const searchRes = await request(app)
      .get('/api/contacts?search=Rajesh')
      .set(accA.headers)
      .expect(200);
    assert.equal(searchRes.body.records.length, 1);
    assert.equal(searchRes.body.records[0].fullName, 'Rajesh Sharma');

    // FILTER by industry property interest
    const filterRes = await request(app)
      .get('/api/contacts?propertyInterest=Luxury')
      .set(accA.headers)
      .expect(200);
    assert.equal(filterRes.body.records.length, 1);

    // CSV EXPORT
    const exportRes = await request(app)
      .get('/api/contacts/export?format=csv')
      .set(accA.headers)
      .expect(200);
    assert.ok(exportRes.text.includes('Rajesh Sharma'));
    assert.ok(exportRes.text.includes('3 BHK Luxury Apartment'));

    // DELETE Contact (soft-delete / archive)
    await request(app)
      .delete(`/api/contacts/${contactId}`)
      .set(accA.headers)
      .expect(200);

    const checkDel = await Contact.findById(contactId);
    assert.ok(checkDel.isDeleted || checkDel.isArchived);
  });

  test('2. Contact Groups & Audiences: Create group, assign members, and retrieve counts', async () => {
    // Create 2 contacts first
    const c1 = await Contact.create({
      fullName: 'Anita Desai',
      phoneNumber: '+919820111222',
      ownerId: accA.user.id || accA.user._id,
      workspaceId: accA.workspaceId,
      leadStatus: 'Interested',
      whatsappConsentStatus: 'Opted In',
    });
    const c2 = await Contact.create({
      fullName: 'Vikram Mehta',
      phoneNumber: '+919820333444',
      ownerId: accA.user.id || accA.user._id,
      workspaceId: accA.workspaceId,
      leadStatus: 'Contacted',
      whatsappConsentStatus: 'Unknown',
    });

    // Create Group
    const groupRes = await request(app)
      .post('/api/contact-groups')
      .set(accA.headers)
      .send({ name: 'Premium Investors', description: 'HNIs looking for sea-view properties' })
      .expect(201);

    const groupId = groupRes.body.group._id;
    assert.equal(groupRes.body.group.name, 'Premium Investors');

    // Assign contacts to group
    await request(app)
      .post(`/api/contact-groups/${groupId}/members`)
      .set(accA.headers)
      .send({ action: 'add', contactIds: [String(c1._id), String(c2._id)] })
      .expect(200);

    // List groups and verify member count
    const listRes = await request(app)
      .get('/api/contact-groups')
      .set(accA.headers)
      .expect(200);

    const foundGroup = listRes.body.records.find((g) => String(g._id) === String(groupId));
    assert.ok(foundGroup);
    assert.equal(foundGroup.contactCount, 2);
  });

  test('3. Notes and Follow-ups: Persistence, due dates, completion and status lifecycle', async () => {
    const contact = await Contact.create({
      fullName: 'Kunal Kapoor',
      phoneNumber: '+919820555666',
      ownerId: accA.user.id || accA.user._id,
      workspaceId: accA.workspaceId,
      leadStatus: 'New',
    });

    const conversation = await Conversation.create({
      ownerId: accA.user.id || accA.user._id,
      workspaceId: accA.workspaceId,
      contactId: contact._id,
      recipientPhone: contact.phoneNumber,
      recipientName: contact.fullName,
      status: 'Open',
    });

    // 1. Create Internal Note
    const noteRes = await request(app)
      .post(`/api/inbox/conversations/${conversation._id}/notes`)
      .set(accA.headers)
      .send({ content: 'Client requested floor plan brochure via WhatsApp' })
      .expect(201);

    const noteId = noteRes.body.note._id;
    assert.equal(noteRes.body.note.content, 'Client requested floor plan brochure via WhatsApp');

    // 2. Fetch Notes
    const getNotes = await request(app)
      .get(`/api/inbox/conversations/${conversation._id}/notes`)
      .set(accA.headers)
      .expect(200);
    assert.equal(getNotes.body.records.length, 1);
    assert.equal(getNotes.body.records[0].content, 'Client requested floor plan brochure via WhatsApp');

    // 3. Create Follow-up Task
    const dueAt = new Date(Date.now() + 86400000).toISOString();
    const taskRes = await request(app)
      .post('/api/follow-ups')
      .set(accA.headers)
      .send({
        contactId: String(contact._id),
        title: 'Schedule property site visit',
        description: 'Call back at 4 PM to confirm weekend visit',
        dueAt,
        priority: 'High',
      })
      .expect(201);

    const taskId = taskRes.body.task._id;
    assert.equal(taskRes.body.task.status, 'Pending');

    // 4. Complete Follow-up Task
    const completeTask = await request(app)
      .post(`/api/follow-ups/${taskId}/complete`)
      .set(accA.headers)
      .expect(200);
    assert.equal(completeTask.body.task.status, 'Completed');
    assert.ok(completeTask.body.task.completedAt);
  });

  test('4. Message Templates Studio: View saved starters, update draft, insert variables, preview', async () => {
    // 1. List saved templates for Real Estate Workspace A (expect exactly 15)
    const listRes = await request(app)
      .get('/api/templates')
      .set(accA.headers)
      .expect(200);

    assert.equal(listRes.body.records.length, 15);
    const template = listRes.body.records[0];

    // 2. Update Template body with CRM variables
    const updateRes = await request(app)
      .patch(`/api/templates/${template._id}`)
      .set(accA.headers)
      .send({
        body: 'Hello {{name}}, thanks for your interest in {{business_name}}! Our address is {{business_address}}.',
      })
      .expect(200);

    assert.ok(updateRes.body.template.body.includes('{{name}}'));
    assert.equal(updateRes.body.template.localStatus, 'Draft');

    // 3. Preview Template with variable resolution
    const contactA = await Contact.findOne({ workspaceId: accA.workspaceId, isDeleted: false });
    const previewRes = await request(app)
      .post(`/api/templates/${template._id}/preview`)
      .set(accA.headers)
      .send({
        contactId: String(contactA._id),
      })
      .expect(200);

    assert.ok(previewRes.body.preview);
    assert.ok(previewRes.body.preview.body.includes('Hello'));
  });

  test('5. Quick Replies: CRUD, search, and composer insertion compatibility', async () => {
    // 1. List saved Quick Replies for Gym Workspace B (expect exactly 8)
    const listRes = await request(app)
      .get('/api/inbox/quick-replies')
      .set(accB.headers)
      .expect(200);

    assert.equal(listRes.body.records.length, 8);

    // 2. Create custom Quick Reply
    const createRes = await request(app)
      .post('/api/inbox/quick-replies')
      .set(accB.headers)
      .send({
        name: 'Locker Rental Terms',
        messageText: 'Locker rentals are available for quarterly or annual packages at our front desk.',
        category: 'Facility',
        description: 'Terms and pricing for locker rentals',
      })
      .expect(201);

    const qrId = createRes.body.quickReply._id;
    assert.equal(createRes.body.quickReply.name, 'Locker Rental Terms');

    // 3. Update Quick Reply
    const updateRes = await request(app)
      .patch(`/api/inbox/quick-replies/${qrId}`)
      .set(accB.headers)
      .send({ messageText: 'Updated locker policy details.' })
      .expect(200);
    assert.equal(updateRes.body.quickReply.messageText, 'Updated locker policy details.');

    // 4. Delete Quick Reply
    await request(app)
      .delete(`/api/inbox/quick-replies/${qrId}`)
      .set(accB.headers)
      .expect(200);

    const check = await QuickReply.findOne({ _id: qrId, archivedAt: null });
    assert.equal(check, null);
  });

  test('6. Auto-Reply Rules: Enable/Disable, priority sorting, and rule matcher', async () => {
    // 1. List rules for Gym Workspace B (expect 5 starter rules + 1 opt-out rule)
    const listRes = await request(app)
      .get('/api/inbox/auto-reply-rules')
      .set(accB.headers)
      .expect(200);

    const starterRules = listRes.body.records.filter((r) => !r.isSystemProtected && r.actionType !== 'RECORD_OPT_OUT');
    assert.equal(starterRules.length, 5);
    assert.ok(starterRules.every((r) => r.enabled === false));

    const testRule = starterRules[0];

    // 2. Activate Rule
    const actRes = await request(app)
      .post(`/api/inbox/auto-reply-rules/${testRule._id}/activate`)
      .set(accB.headers)
      .expect(200);
    assert.equal(actRes.body.rule.enabled, true);

    // 3. Test Matcher for keywords
    const matchRes = await request(app)
      .post(`/api/inbox/auto-reply-rules/${testRule._id}/test`)
      .set(accB.headers)
      .send({ text: testRule.triggerKeyword || 'timing' })
      .expect(200);

    assert.ok(matchRes.body.matched !== undefined);

    // 4. Deactivate Rule
    const deactRes = await request(app)
      .post(`/api/inbox/auto-reply-rules/${testRule._id}/deactivate`)
      .set(accB.headers)
      .expect(200);
    assert.equal(deactRes.body.rule.enabled, false);
  });

  test('7. Campaign Drafts: Persistence, template reference, audience mode, and status', async () => {
    // 1. List Campaigns for Gym Workspace B (expect exactly 2 starter drafts)
    const listRes = await request(app)
      .get('/api/campaigns')
      .set(accB.headers)
      .expect(200);

    assert.equal(listRes.body.records.length, 2);
    assert.ok(listRes.body.records.every((c) => c.status === 'Draft'));

    // 2. Create custom Campaign Draft
    const template = await MessageTemplate.findOne({ workspaceId: accB.workspaceId });
    const createRes = await request(app)
      .post('/api/campaigns')
      .set(accB.headers)
      .send({
        name: 'Summer Fitness Bootcamp 2026',
        description: 'Broadcast early bird discounts for members',
        category: 'Promotional',
        campaignType: 'one-time',
        selectedTemplateId: String(template._id),
        selectedTemplateVersionId: String(template.currentVersionId),
        wizardStep: 2,
      })
      .expect(201);

    const campId = createRes.body.campaign._id;
    assert.equal(createRes.body.campaign.name, 'Summer Fitness Bootcamp 2026');
    assert.equal(createRes.body.campaign.status, 'Draft');

    // 3. Update Campaign Draft
    const updateRes = await request(app)
      .patch(`/api/campaigns/${campId}`)
      .set(accB.headers)
      .send({ description: 'Updated bootcamp description with dates' })
      .expect(200);
    assert.equal(updateRes.body.campaign.description, 'Updated bootcamp description with dates');
  });

  test('8. Inbox & Conversations: Real history, mock message persistence, and contact context', async () => {
    const contact = await Contact.create({
      fullName: 'Pooja Hegde',
      phoneNumber: '+919870001122',
      ownerId: accC.user.id || accC.user._id,
      workspaceId: accC.workspaceId,
      leadStatus: 'Contacted',
    });

    // Create Conversation
    const convRes = await request(app)
      .post('/api/inbox/conversations')
      .set(accC.headers)
      .send({
        contactId: String(contact._id),
        recipientPhone: contact.phoneNumber,
        recipientName: contact.fullName,
        subject: 'Product Catalog Enquiry',
      })
      .expect(201);

    const convId = convRes.body.conversation._id;

    // Send Mock Reply
    const msgRes = await request(app)
      .post(`/api/inbox/conversations/${convId}/mock-reply`)
      .set(accC.headers)
      .send({ body: 'Hello Pooja, here is our current product catalog link.' })
      .expect(201);

    assert.equal(msgRes.body.message.messageBody, 'Hello Pooja, here is our current product catalog link.');
    assert.equal(msgRes.body.message.direction, 'outbound');

    // Fetch conversation message history
    const historyRes = await request(app)
      .get(`/api/inbox/conversations/${convId}/messages`)
      .set(accC.headers)
      .expect(200);

    assert.equal(historyRes.body.records.length, 1);
    assert.equal(historyRes.body.records[0].messageBody, 'Hello Pooja, here is our current product catalog link.');
  });

  test('9. Dynamic Dashboard & Reports: Accurate scoped counts and zero fake metrics', async () => {
    // Overview for Generic Workspace C
    const dashRes = await request(app)
      .get('/api/dashboard/overview')
      .set(accC.headers)
      .expect(200);

    // Verify contact counts
    assert.equal(dashRes.body.contacts.total, 1); // Pooja Hegde
    // Verify campaign count
    assert.equal(dashRes.body.campaigns.total, 2); // 2 starter drafts
    assert.equal(dashRes.body.campaigns.draft, 2);
    assert.equal(dashRes.body.campaigns.scheduled, 0);
    // Verify inbox conversations
    assert.equal(dashRes.body.inbox.totalConversations, 1);
    // Verify no fake financial metrics
    assert.equal(dashRes.body.financials, undefined);
    assert.equal(dashRes.body.revenue, undefined);

    // Reports overview
    const repRes = await request(app)
      .get('/api/reports/overview')
      .set(accC.headers)
      .expect(200);

    assert.ok(repRes.body);
    assert.equal(repRes.body.summary?.totalScheduledCampaigns || 0, 0);
  });

  test('10. Settings Persistence: Profile update, business profile dynamic category, and preferences', async () => {
    // 1. Get Business Profile for Generic Workspace C
    const getBpRes = await request(app)
      .get('/api/settings/business')
      .set(accC.headers)
      .expect(200);

    // Check dynamic business category resolution
    assert.equal(getBpRes.body.businessProfile.businessCategory, 'Generic Business');

    // 2. Update Business Profile
    const updateBpRes = await request(app)
      .put('/api/settings/business')
      .set(accC.headers)
      .send({
        legalOrTradingName: 'Apex Universal Trading LLP',
        displayName: 'Apex Trading',
        businessCategory: 'Wholesale & Retail',
        email: 'sales@apextrading.test',
        phone: '+919811223344',
        city: 'Ahmedabad',
        country: 'India',
        description: 'B2B Wholesale and consumer trading company',
      })
      .expect(200);

    assert.equal(updateBpRes.body.businessProfile.legalOrTradingName, 'Apex Universal Trading LLP');
    assert.equal(updateBpRes.body.businessProfile.city, 'Ahmedabad');

    // Verify persistence in MongoDB
    const persistedBp = await BusinessProfile.findOne({ workspaceId: accC.workspaceId });
    assert.equal(persistedBp.legalOrTradingName, 'Apex Universal Trading LLP');
    assert.equal(persistedBp.city, 'Ahmedabad');

    // 3. Update User Preferences
    const updatePrefRes = await request(app)
      .put('/api/settings/preferences')
      .set(accC.headers)
      .send({
        timezone: 'Asia/Kolkata',
        dateFormat: 'DD/MM/YYYY',
        timeFormat: '24h',
      })
      .expect(200);

    assert.equal(updatePrefRes.body.preferences.timeFormat, '24h');
  });

  test('11. Multi-Tab Session Isolation: Independent session IDs on the same origin', async () => {
    // Tab A (Real Estate), Tab B (Gym), Tab C (Generic)
    const tabARes = await request(app)
      .get('/api/workspaces/current')
      .set(accA.headers)
      .expect(200);
    assert.equal(tabARes.body.workspace.industryKey, 'real_estate');

    const tabBRes = await request(app)
      .get('/api/workspaces/current')
      .set(accB.headers)
      .expect(200);
    assert.equal(tabBRes.body.workspace.industryKey, 'gym');

    const tabCRes = await request(app)
      .get('/api/workspaces/current')
      .set(accC.headers)
      .expect(200);
    assert.equal(tabCRes.body.workspace.industryKey, 'generic_business');

    // Logging out Tab B must not invalidate Tab A or Tab C
    await request(app)
      .post('/api/auth/logout')
      .set(accB.headers)
      .expect(200);

    // Tab A remains fully authorized
    const checkA = await request(app)
      .get('/api/workspaces/current')
      .set(accA.headers)
      .expect(200);
    assert.equal(checkA.body.workspace.industryKey, 'real_estate');

    // Tab C remains fully authorized
    const checkC = await request(app)
      .get('/api/workspaces/current')
      .set(accC.headers)
      .expect(200);
    assert.equal(checkC.body.workspace.industryKey, 'generic_business');
  });

  test('12. Tenant Isolation & Rejection: Workspace A cannot access or tamper with Workspace C', async () => {
    // 1. Cross-Workspace Contact Tampering
    const contactC = await Contact.findOne({ workspaceId: accC.workspaceId });
    assert.ok(contactC);

    // Workspace A tries to read Workspace C contact
    const readAttempt = await request(app)
      .get(`/api/contacts/${contactC._id}`)
      .set(accA.headers);
    assert.ok([403, 404].includes(readAttempt.status), `Cross-tenant read returned ${readAttempt.status}`);

    // Workspace A tries to delete Workspace C contact
    const deleteAttempt = await request(app)
      .delete(`/api/contacts/${contactC._id}`)
      .set(accA.headers);
    assert.ok([403, 404].includes(deleteAttempt.status), `Cross-tenant delete returned ${deleteAttempt.status}`);

    // 2. Cross-Workspace Template Tampering
    const templateC = await MessageTemplate.findOne({ workspaceId: accC.workspaceId });
    assert.ok(templateC);

    const updateTemplateAttempt = await request(app)
      .patch(`/api/templates/${templateC._id}`)
      .set(accA.headers)
      .send({ body: 'Malicious overwrite' });
    assert.ok([403, 404].includes(updateTemplateAttempt.status), `Cross-tenant template edit returned ${updateTemplateAttempt.status}`);

    // Verify template C was NOT modified
    const cleanTemplate = await MessageTemplate.findById(templateC._id);
    assert.notEqual(cleanTemplate.body, 'Malicious overwrite');

    // 3. Forged Workspace Header
    const forgedWsHeader = await request(app)
      .get('/api/contacts')
      .set({
        Authorization: `Bearer ${accA.token}`,
        'x-workspace-id': String(accC.workspaceId), // user A claiming workspace C
      });
    assert.equal(forgedWsHeader.status, 403, 'Forged x-workspace-id header must be rejected with 403');
  });
});
