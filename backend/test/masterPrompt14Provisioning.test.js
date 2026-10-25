/**
 * Master Prompt 14 — Multi-tenant automatic industry provisioning (10-account E2E).
 *
 * Database selection (never touches an application database):
 *  - PROVISIONING_TEST_URI set  -> that server, database forced to "relay_provisioning_test"
 *  - otherwise                  -> throwaway MongoMemoryServer (used by `npm test`)
 *
 * Every account goes through the real HTTP signup → onboarding → provisioning flow,
 * then saved records are verified both through the authorized API and directly in MongoDB.
 */
import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

const TEST_DB = 'relay_provisioning_test';
const EMAIL_DOMAIN = 'provisioning-test.relay.invalid';
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
const { default: WorkspaceMembership } = await import('../src/models/WorkspaceMembership.js');
const { default: MessageTemplate, TemplateVersion } = await import('../src/models/MessageTemplate.js');
const { default: QuickReply } = await import('../src/models/QuickReply.js');
const { default: AutoReplyRule } = await import('../src/models/AutoReplyRule.js');
const { default: Campaign } = await import('../src/models/Campaign.js');
const { default: Contact } = await import('../src/models/Contact.js');
const { default: Conversation } = await import('../src/models/Conversation.js');
const { default: Message } = await import('../src/models/Message.js');
const { getStrictIndustryConfig } = await import('../src/config/industries/industryRegistry.js');
const { provisionWorkspaceStarterData, resolveStarterPack } = await import('../src/services/industryStarterProvisioningService.js');

const MATRIX = [
  ['re_a', 'Real Estate Business A', 'real_estate'],
  ['re_b', 'Real Estate Business B', 'real_estate'],
  ['gym', 'Gym Business', 'gym'],
  ['clinic', 'Clinic Business', 'clinic'],
  ['edu', 'Education Business', 'education'],
  ['salon', 'Salon Business', 'salon'],
  ['auto', 'Automobile Business', 'automobile'],
  ['travel', 'Travel Business', 'travel_tourism'],
  ['ecom', 'E-commerce Business', 'ecommerce_retail'],
  ['generic', 'Generic Business', 'generic_business'],
];

let mongod = null;
const accounts = {};
const auth = (token) => ({ Authorization: `Bearer ${token}` });

async function cleanupPreviousTestFixtures() {
  // Restricted to the dedicated test database and to fixtures owned by test-domain users.
  assert.equal(mongoose.connection.db.databaseName, TEST_DB, 'Refusing to clean anything outside the isolated test database.');
  const users = await User.find({ email: new RegExp(`@${EMAIL_DOMAIN.replace(/\./g, '\\.')}$`) }).select('_id').lean();
  const userIds = users.map((u) => u._id);
  if (!userIds.length) return;
  const workspaceIds = (await Workspace.find({ createdBy: { $in: userIds } }).select('_id').lean()).map((w) => w._id);
  const scoped = { $or: [{ workspaceId: { $in: workspaceIds } }, { ownerId: { $in: userIds } }] };
  await Promise.all([MessageTemplate, TemplateVersion, QuickReply, AutoReplyRule, Campaign, Contact].map((M) => M.deleteMany(scoped)));
  await WorkspaceMembership.deleteMany({ userId: { $in: userIds } });
  await mongoose.connection.db.collection('businessprofiles').deleteMany({ ownerId: { $in: userIds } });
  await mongoose.connection.db.collection('onboardingdrafts').deleteMany({ userId: { $in: userIds } });
  await mongoose.connection.db.collection('authsessions').deleteMany({ userId: { $in: userIds } });
  await Workspace.deleteMany({ _id: { $in: workspaceIds } });
  await User.deleteMany({ _id: { $in: userIds } });
}

async function signup(slug, businessName, industryKey) {
  const email = `owner.${slug}.${RUN}@${EMAIL_DOMAIN}`;
  const reg = await request(app).post('/api/auth/register').send({ name: `${businessName} Owner`, email, password: 'Str0ngPassw0rd!', confirmPassword: 'Str0ngPassw0rd!' });
  assert.equal(reg.status, 201, `register ${slug}: ${JSON.stringify(reg.body)}`);
  const token = reg.body.token;
  const draft = await request(app).put('/api/onboarding/draft').set(auth(token)).send({
    step: 6,
    businessIdentity: { name: `${businessName} ${RUN}`, email, phone: '+919800000001' },
    industryKey,
    businessDetails: { city: 'Pune', country: 'India', timezone: 'Asia/Kolkata' },
  });
  assert.equal(draft.status, 200, `draft ${slug}: ${JSON.stringify(draft.body)}`);
  const done = await request(app).post('/api/onboarding/complete').set(auth(token)).send({});
  assert.equal(done.status, 201, `complete ${slug}: ${JSON.stringify(done.body)}`);
  return { slug, email, token, industryKey, userId: reg.body.user._id || reg.body.user.id, workspaceId: done.body.workspace._id, provisioning: done.body.starterProvisioning, workspace: done.body.workspace };
}

async function apiCounts(acc) {
  const [tpl, qr, rules, camps, contacts] = await Promise.all([
    request(app).get('/api/templates?limit=100').set(auth(acc.token)),
    request(app).get('/api/inbox/quick-replies').set(auth(acc.token)),
    request(app).get('/api/inbox/auto-reply-rules').set(auth(acc.token)),
    request(app).get('/api/campaigns?limit=50').set(auth(acc.token)),
    request(app).get('/api/contacts').set(auth(acc.token)),
  ]);
  for (const r of [tpl, qr, rules, camps, contacts]) assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 300));
  const savedRules = rules.body.records.filter((r) => r._id && r.actionType !== 'RECORD_OPT_OUT' && !r.isProtected && !r.protected);
  const campaignRecords = camps.body.records || camps.body.campaigns || [];
  return {
    templates: tpl.body.records,
    templateTotal: tpl.body.total,
    quickReplies: qr.body.records,
    rules: savedRules,
    campaigns: campaignRecords,
    contactsTotal: contacts.body.total ?? (contacts.body.records || contacts.body.contacts || []).length,
  };
}

async function dbCounts(workspaceId) {
  const q = { workspaceId };
  const [templates, quickReplies, rules, campaigns, contacts, conversations, messages] = await Promise.all([
    MessageTemplate.countDocuments(q), QuickReply.countDocuments(q), AutoReplyRule.countDocuments(q),
    Campaign.countDocuments(q), Contact.countDocuments(q), Conversation.countDocuments(q), Message.countDocuments(q),
  ]);
  return { templates, quickReplies, rules, campaigns, contacts, conversations, messages };
}

describe('Master Prompt 14 — Automatic industry provisioning (10 accounts)', () => {
  before(async () => {
    if (process.env.PROVISIONING_TEST_URI) {
      await mongoose.connect(process.env.PROVISIONING_TEST_URI, { dbName: TEST_DB, serverSelectionTimeoutMS: 15000 });
    } else {
      mongod = await MongoMemoryServer.create();
      await mongoose.connect(mongod.getUri(), { dbName: TEST_DB });
    }
    assert.equal(mongoose.connection.db.databaseName, TEST_DB);
    await Promise.all([MessageTemplate, QuickReply, AutoReplyRule, Campaign, User, Workspace].map((M) => M.init()));
    await cleanupPreviousTestFixtures();
  });

  after(async () => {
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  });

  test('1. Ten businesses sign up (8 sequential + 2 concurrent) and each is provisioned', async () => {
    for (const [slug, name, industry] of MATRIX.slice(0, 8)) accounts[slug] = await signup(slug, name, industry);
    const concurrent = await Promise.all(MATRIX.slice(8).map(([slug, name, industry]) => signup(slug, name, industry)));
    concurrent.forEach((acc) => { accounts[acc.slug] = acc; });

    const userIds = new Set(Object.values(accounts).map((a) => String(a.userId)));
    const wsIds = new Set(Object.values(accounts).map((a) => String(a.workspaceId)));
    assert.equal(userIds.size, 10, 'distinct users');
    assert.equal(wsIds.size, 10, 'distinct workspaces');
    for (const acc of Object.values(accounts)) {
      assert.equal(acc.provisioning?.status, 'COMPLETED', `${acc.slug} provisioning: ${JSON.stringify(acc.provisioning)}`);
      const ws = await Workspace.findById(acc.workspaceId).lean();
      assert.equal(ws.industryKey, acc.industryKey);
      assert.equal(String(ws.createdBy), String(acc.userId));
      assert.equal(ws.starterProvisioning.status, 'COMPLETED');
      assert.deepEqual({ ...ws.starterProvisioning.counts }, { templates: 15, quickReplies: 8, rules: 5, campaigns: 2 });
    }
  });

  test('2. Each workspace exposes exactly 15/8/5/2 saved records via the API and MongoDB; 0 contacts/conversations/messages', async () => {
    for (const acc of Object.values(accounts)) {
      const api = await apiCounts(acc);
      assert.equal(api.templateTotal, 15, `${acc.slug} templates`);
      assert.equal(api.quickReplies.length, 8, `${acc.slug} quick replies`);
      assert.equal(api.rules.length, 5, `${acc.slug} rules`);
      assert.equal(api.campaigns.length, 2, `${acc.slug} campaigns`);
      assert.equal(api.contactsTotal, 0, `${acc.slug} contacts`);
      assert.ok(api.rules.every((r) => r.enabled === false), `${acc.slug} rules disabled`);
      assert.ok(api.campaigns.every((c) => c.status === 'Draft' && !c.mockSchedule && !c.activeExecutionId), `${acc.slug} drafts`);
      assert.ok(api.templates.every((t) => t.providerStatus === 'Not Submitted' && t.mockProviderApprovalStatus === 'Not Submitted' && t.localStatus === 'Draft'), `${acc.slug} templates not approved`);
      const db = await dbCounts(acc.workspaceId);
      assert.deepEqual(db, { templates: 15, quickReplies: 8, rules: 5, campaigns: 2, contacts: 0, conversations: 0, messages: 0 }, acc.slug);
    }
  });

  test('3. Ten-account totals are exactly 150 / 80 / 50 / 20 = 300 records, all correctly owned', async () => {
    const wsIds = Object.values(accounts).map((a) => new mongoose.Types.ObjectId(a.workspaceId));
    const q = { workspaceId: { $in: wsIds } };
    const totals = {
      templates: await MessageTemplate.countDocuments(q),
      quickReplies: await QuickReply.countDocuments(q),
      rules: await AutoReplyRule.countDocuments(q),
      campaigns: await Campaign.countDocuments(q),
    };
    assert.deepEqual(totals, { templates: 150, quickReplies: 80, rules: 50, campaigns: 20 });
    for (const acc of Object.values(accounts)) {
      const foreignOwner = { workspaceId: acc.workspaceId, ownerId: { $ne: new mongoose.Types.ObjectId(acc.userId) } };
      for (const M of [MessageTemplate, QuickReply, AutoReplyRule, Campaign]) assert.equal(await M.countDocuments(foreignOwner), 0);
    }
  });

  test('4. Cross-industry content is correct (no Real Estate fallback; each workspace gets its own pack)', async () => {
    for (const acc of Object.values(accounts)) {
      const pack = resolveStarterPack(acc.industryKey);
      const expectedKeys = new Set(pack.templates.map((t) => t.presetKey || t.key));
      const saved = await MessageTemplate.find({ workspaceId: acc.workspaceId }).select('starterPresetKey').lean();
      assert.ok(saved.every((t) => expectedKeys.has(t.starterPresetKey)), `${acc.slug} got foreign templates`);
      if (acc.industryKey !== 'real_estate') assert.ok(saved.every((t) => !t.starterPresetKey.startsWith('re_')), `${acc.slug} received Real Estate content`);
    }
    const clinicKeys = (await MessageTemplate.find({ workspaceId: accounts.clinic.workspaceId }).lean()).map((t) => t.starterPresetKey);
    const gymKeys = (await MessageTemplate.find({ workspaceId: accounts.gym.workspaceId }).lean()).map((t) => t.starterPresetKey);
    assert.ok(clinicKeys.every((k) => !gymKeys.includes(k)), 'clinic and gym share no starter keys');
    const ecom = await MessageTemplate.find({ workspaceId: accounts.ecom.workspaceId }).lean();
    assert.ok(ecom.every((t) => t.starterPresetKey.startsWith('ecom_')), 'e-commerce receives its own pack (not Generic)');
    const generic = await MessageTemplate.find({ workspaceId: accounts.generic.workspaceId }).lean();
    assert.ok(generic.every((t) => t.starterPresetKey.startsWith('generic_')), 'generic receives Generic pack');
  });

  test('5. Same-industry isolation: Business A edit does not affect Business B or the immutable pack', async () => {
    const a = accounts.re_a;
    const b = accounts.re_b;
    const key = 're_welcome';
    const tplA = await MessageTemplate.findOne({ workspaceId: a.workspaceId, starterPresetKey: key }).lean();
    const tplB = await MessageTemplate.findOne({ workspaceId: b.workspaceId, starterPresetKey: key }).lean();
    assert.notEqual(String(tplA._id), String(tplB._id));
    const packBodyBefore = getStrictIndustryConfig('real_estate').templateSuggestions.find((t) => (t.presetKey || t.key) === key).body;

    const edited = 'Thank you for contacting ABC Realty. Our team will reply shortly.';
    const upd = await request(app).patch(`/api/templates/${tplA._id}`).set(auth(a.token)).send({ body: edited, currentVersionNumber: tplA.currentVersionNumber });
    assert.equal(upd.status, 200, JSON.stringify(upd.body));

    assert.equal((await MessageTemplate.findById(tplA._id).lean()).body, edited);
    assert.equal((await MessageTemplate.findById(tplB._id).lean()).body, tplB.body);
    assert.equal(getStrictIndustryConfig('real_estate').templateSuggestions.find((t) => (t.presetKey || t.key) === key).body, packBodyBefore);

    // Direct cross-tenant access is rejected server-side.
    assert.equal((await request(app).get(`/api/templates/${tplA._id}`).set(auth(b.token))).status, 404);
    assert.equal((await request(app).patch(`/api/templates/${tplA._id}`).set(auth(b.token)).send({ body: 'hijack' })).status, 404);
    assert.equal((await request(app).get('/api/templates').set(auth(b.token)).set('x-workspace-id', String(a.workspaceId))).status, 403);
    assert.equal((await request(app).get('/api/inbox/quick-replies').set(auth(b.token)).set('x-workspace-id', String(a.workspaceId))).status, 403);
    assert.equal((await MessageTemplate.findById(tplA._id).lean()).body, edited);
  });

  test('6. Repeated completes, retries, install-starter calls and re-provisioning create zero duplicates and keep edits', async () => {
    for (const acc of Object.values(accounts)) {
      for (let i = 0; i < 3; i += 1) {
        const again = await request(app).post('/api/onboarding/complete').set(auth(acc.token)).send({});
        assert.equal(again.status, 200);
      }
      const retry = await request(app).post('/api/workspaces/current/starter-provisioning/retry').set(auth(acc.token));
      assert.equal(retry.status, 200);
      assert.equal(retry.body.skipped, true);
      await request(app).post('/api/inbox/quick-replies/starter-pack').set(auth(acc.token));
      await request(app).post('/api/inbox/auto-reply-rules/starter-pack').set(auth(acc.token));
      await provisionWorkspaceStarterData({ workspaceId: acc.workspaceId, ownerId: acc.userId, industryKey: acc.industryKey, force: true });
      const db = await dbCounts(acc.workspaceId);
      assert.deepEqual({ t: db.templates, q: db.quickReplies, r: db.rules, c: db.campaigns }, { t: 15, q: 8, r: 5, c: 2 }, acc.slug);
      assert.equal(await WorkspaceMembership.countDocuments({ userId: acc.userId }), 1, `${acc.slug} single workspace`);
    }
    const edited = await MessageTemplate.findOne({ workspaceId: accounts.re_a.workspaceId, starterPresetKey: 're_welcome' }).lean();
    assert.match(edited.body, /ABC Realty/, 'user edit survived forced re-provisioning');
  });

  test('7. Rule enable state persists and is never reset by provisioning', async () => {
    const acc = accounts.gym;
    const rule = await AutoReplyRule.findOne({ workspaceId: acc.workspaceId }).lean();
    const act = await request(app).post(`/api/inbox/auto-reply-rules/${rule._id}/activate`).set(auth(acc.token));
    assert.equal(act.status, 200, JSON.stringify(act.body));
    await provisionWorkspaceStarterData({ workspaceId: acc.workspaceId, ownerId: acc.userId, industryKey: acc.industryKey, force: true });
    assert.equal((await AutoReplyRule.findById(rule._id).lean()).enabled, true);
    await request(app).post(`/api/inbox/auto-reply-rules/${rule._id}/deactivate`).set(auth(acc.token));
    assert.equal((await AutoReplyRule.findById(rule._id).lean()).enabled, false);
  });

  test('8. Partial failure recovers by inserting only missing records (edits preserved)', async () => {
    const owner = await User.create({ name: 'Partial Owner', email: `partial.${RUN}@${EMAIL_DOMAIN}`, passwordHash: 'x'.repeat(60), accountStatus: 'ACTIVE', isEmailVerified: true, emailVerifiedAt: new Date() });
    const ws = await Workspace.create({ name: `Partial Salon ${RUN}`, slug: `partial-salon-${RUN}`, industryKey: 'salon', businessEmail: owner.email, businessPhone: '+919800000002', createdBy: owner._id, starterProvisioning: { status: 'PENDING', industryKey: 'salon', packVersion: '1.1.0' } });
    await WorkspaceMembership.create({ workspaceId: ws._id, userId: owner._id, role: 'OWNER', status: 'ACTIVE', isDefaultWorkspace: true, joinedAt: new Date() });

    await assert.rejects(provisionWorkspaceStarterData({ workspaceId: ws._id, ownerId: owner._id, industryKey: 'salon', _failAfter: 2 }), /Simulated/);
    let state = await Workspace.findById(ws._id).lean();
    assert.equal(state.starterProvisioning.status, 'FAILED');
    let db = await dbCounts(ws._id);
    assert.deepEqual({ t: db.templates, q: db.quickReplies, r: db.rules, c: db.campaigns }, { t: 15, q: 0, r: 0, c: 0 });

    const one = await MessageTemplate.findOne({ workspaceId: ws._id });
    one.body = 'Customised before retry';
    await one.save();

    const result = await provisionWorkspaceStarterData({ workspaceId: ws._id, ownerId: owner._id, industryKey: 'salon' });
    assert.equal(result.status, 'COMPLETED');
    db = await dbCounts(ws._id);
    assert.deepEqual({ t: db.templates, q: db.quickReplies, r: db.rules, c: db.campaigns }, { t: 15, q: 8, r: 5, c: 2 });
    assert.equal((await MessageTemplate.findById(one._id).lean()).body, 'Customised before retry');
    state = await Workspace.findById(ws._id).lean();
    assert.equal(state.starterProvisioning.status, 'COMPLETED');
    assert.ok(state.starterProvisioning.attempts >= 2);
  });

  test('9. Concurrent provisioning of one workspace is race-safe (unique ids + indexes)', async () => {
    const owner = await User.create({ name: 'Race Owner', email: `race.${RUN}@${EMAIL_DOMAIN}`, passwordHash: 'x'.repeat(60), accountStatus: 'ACTIVE', isEmailVerified: true, emailVerifiedAt: new Date() });
    const ws = await Workspace.create({ name: `Race Hotel ${RUN}`, slug: `race-hotel-${RUN}`, industryKey: 'hospitality', businessEmail: owner.email, businessPhone: '+919800000003', createdBy: owner._id, starterProvisioning: { status: 'PENDING', industryKey: 'hospitality', packVersion: '1.1.0' } });
    const results = await Promise.allSettled(Array.from({ length: 6 }, () => provisionWorkspaceStarterData({ workspaceId: ws._id, ownerId: owner._id, industryKey: 'hospitality', force: true })));
    assert.ok(results.every((r) => r.status === 'fulfilled'), JSON.stringify(results.filter((r) => r.status === 'rejected').map((r) => r.reason?.message)));
    const db = await dbCounts(ws._id);
    assert.deepEqual({ t: db.templates, q: db.quickReplies, r: db.rules, c: db.campaigns }, { t: 15, q: 8, r: 5, c: 2 });
    assert.equal(await TemplateVersion.countDocuments({ workspaceId: ws._id }), 15);
  });

  test('10. Concurrent duplicate onboarding submissions create exactly one workspace', async () => {
    const email = `dupe.${RUN}@${EMAIL_DOMAIN}`;
    const reg = await request(app).post('/api/auth/register').send({ name: 'Dupe Owner', email, password: 'Str0ngPassw0rd!' });
    const token = reg.body.token;
    await request(app).put('/api/onboarding/draft').set(auth(token)).send({ businessIdentity: { name: `Dupe Home ${RUN}`, email, phone: '+919800000004' }, industryKey: 'home_services' });
    const responses = await Promise.all(Array.from({ length: 4 }, () => request(app).post('/api/onboarding/complete').set(auth(token)).send({})));
    assert.ok(responses.some((r) => r.status === 201));
    assert.ok(responses.every((r) => [200, 201, 409].includes(r.status)), responses.map((r) => r.status).join(','));
    const userId = reg.body.user._id || reg.body.user.id;
    assert.equal(await Workspace.countDocuments({ createdBy: userId }), 1);
    const ws = await Workspace.findOne({ createdBy: userId }).lean();
    const db = await dbCounts(ws._id);
    assert.deepEqual({ t: db.templates, q: db.quickReplies, r: db.rules, c: db.campaigns }, { t: 15, q: 8, r: 5, c: 2 });
  });

  test('11. Invalid industry is rejected; legacy workspaces are never auto-seeded', async () => {
    const email = `invalid.${RUN}@${EMAIL_DOMAIN}`;
    const reg = await request(app).post('/api/auth/register').send({ name: 'Invalid Owner', email, password: 'Str0ngPassw0rd!' });
    const bad = await request(app).put('/api/onboarding/draft').set(auth(reg.body.token)).send({ industryKey: 'spaceship_dealer' });
    assert.equal(bad.status, 400);
    assert.throws(() => resolveStarterPack('spaceship_dealer'), /Unsupported industry/);

    const owner = await User.findOne({ email });
    const legacy = await Workspace.create({ name: `Legacy Clinic ${RUN}`, slug: `legacy-clinic-${RUN}`, industryKey: 'clinic', businessEmail: email, businessPhone: '+919800000005', createdBy: owner._id });
    await WorkspaceMembership.create({ workspaceId: legacy._id, userId: owner._id, role: 'OWNER', status: 'ACTIVE', isDefaultWorkspace: true, joinedAt: new Date() });
    await User.updateOne({ _id: owner._id }, { defaultWorkspaceId: legacy._id });
    const retry = await request(app).post('/api/workspaces/current/starter-provisioning/retry').set(auth(reg.body.token));
    assert.equal(retry.status, 409);
    assert.equal(retry.body.code, 'LEGACY_WORKSPACE');
    const status = await request(app).get('/api/workspaces/current/starter-provisioning').set(auth(reg.body.token));
    assert.equal(status.status, 200);
    assert.equal(status.body.starterProvisioning, null);
    for (let i = 0; i < 3; i += 1) {
      await request(app).get('/api/templates').set(auth(reg.body.token));
      await request(app).get('/api/campaigns').set(auth(reg.body.token));
    }
    const db = await dbCounts(legacy._id);
    assert.deepEqual({ t: db.templates, c: db.campaigns }, { t: 0, c: 0 }, 'opening pages never provisions');
  });

  test('12. Importing the registry / provisioning service performs no database writes', async () => {
    const before = await MessageTemplate.estimatedDocumentCount();
    await import('../src/config/industries/industryRegistry.js?again');
    await import('../src/services/industryStarterProvisioningService.js?again');
    assert.equal(await MessageTemplate.estimatedDocumentCount(), before);
  });
});
