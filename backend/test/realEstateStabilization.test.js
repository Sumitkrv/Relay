import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Workspace from '../src/models/Workspace.js';
import WorkspaceMembership from '../src/models/WorkspaceMembership.js';
import MessageTemplate from '../src/models/MessageTemplate.js';
import QuickReply from '../src/models/QuickReply.js';
import AutoReplyRule from '../src/models/AutoReplyRule.js';
import Contact from '../src/models/Contact.js';
import Conversation from '../src/models/Conversation.js';
import ConsentRecord from '../src/models/ConsentRecord.js';
import RuleExecution from '../src/models/RuleExecution.js';
import { evaluateInboundMessage } from '../src/services/autoReplyRuleService.js';

let mongo;
const accounts = [];
before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'relay-isolated-stabilization-test-secret-32';
  process.env.EMAIL_PROVIDER = 'inmemory';
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  for (const industryKey of ['real_estate', 'clinic', 'gym']) {
    const user = await User.create({ name: `${industryKey} QA Owner`, email: `${industryKey}@isolated.example.test`, passwordHash: await bcrypt.hash('IsolatedTest123!', 10), isEmailVerified: true, emailVerifiedAt: new Date() });
    const workspace = await Workspace.create({ name: `${industryKey} QA Workspace`, slug: `qa-${industryKey}`, industryKey, businessEmail: user.email, businessPhone: '+14155550100', createdBy: user._id, status: 'ACTIVE' });
    await WorkspaceMembership.create({ workspaceId: workspace._id, userId: user._id, role: 'OWNER', status: 'ACTIVE', isDefaultWorkspace: true });
    accounts.push({ user, workspace, tabId: new mongoose.Types.ObjectId().toString().padEnd(32, 'a') });
  }
});
after(async () => { await mongoose.disconnect(); await mongo?.stop(); });

test('three accounts share cookies but preserve independent tab identities, refresh and logout revocation', async () => {
  const jar = request.agent(app);
  for (const account of accounts) {
    const login = await jar.post('/api/auth/login').set('x-relay-session-id', account.tabId).send({ email: account.user.email, password: 'IsolatedTest123!' });
    assert.equal(login.status, 200, login.body.message);
    account.token = login.body.token;
    assert.ok(login.headers['set-cookie'][0].startsWith(`relay_session_${account.tabId}=`));
    assert.match(login.headers['set-cookie'][0], /HttpOnly/);
  }
  for (let refresh = 0; refresh < 3; refresh++) for (const account of accounts) {
    const me = await jar.get('/api/auth/me').set('x-relay-session-id', account.tabId);
    assert.equal(me.body.user.id, String(account.user._id));
    assert.equal(me.body.workspaces[0].industryKey, account.workspace.industryKey);
  }
  const missing = await jar.get('/api/auth/me').set('x-relay-session-id', 'f'.repeat(32));
  assert.equal(missing.status, 401, 'A new tab must not inherit another cookie');
  const explicit = await jar.get('/api/auth/me').set('Cookie', `session=${accounts[2].token}`).auth(accounts[0].token, { type: 'bearer' });
  assert.equal(explicit.body.user.id, String(accounts[0].user._id));
  assert.equal((await jar.get('/api/auth/me').set('x-relay-session-id', accounts[0].tabId).set('Authorization', 'Bearer invalid')).status, 401);
  await jar.post('/api/auth/logout').set('x-relay-session-id', accounts[1].tabId).expect(200);
  await jar.get('/api/auth/me').auth(accounts[1].token, { type: 'bearer' }).expect(401);
  for (const account of [accounts[0], accounts[2]]) await jar.get('/api/auth/me').set('x-relay-session-id', account.tabId).expect(200);
});

test('industry libraries use the verified workspace, normalize draft categories and never persist on GET', async () => {
  for (const account of [accounts[0], accounts[2]]) {
    const headers = { Authorization: `Bearer ${account.token}`, 'x-workspace-id': String(account.workspace._id) };
    for (let i = 0; i < 3; i++) {
      const library = await request(app).get('/api/templates/library?industry=clinic').set(headers).expect(200);
      assert.equal(library.body.industryKey, account.workspace.industryKey);
      assert.equal(library.body.records.length, 15);
      for (const preset of library.body.records) assert.ok(['Marketing', 'Utility', 'Authentication'].includes(preset.category));
      await request(app).get('/api/inbox/quick-replies').set(headers).expect(200);
      await request(app).get('/api/inbox/auto-reply-rules').set(headers).expect(200);
    }
  }
  assert.equal(await MessageTemplate.countDocuments(), 0);
  assert.equal(await QuickReply.countDocuments(), 0);
  assert.equal(await AutoReplyRule.countDocuments(), 0);
});

test('explicit foreign tenant and invalid workspace selectors fail closed', async () => {
  const token = accounts[0].token;
  for (const route of ['/api/templates', '/api/inbox/quick-replies', '/api/contacts', '/api/reports/overview']) {
    const response = await request(app).get(route).auth(token, { type: 'bearer' }).set('x-workspace-id', String(accounts[2].workspace._id));
    assert.equal(response.status, 403, `${route}: ${response.status}`);
  }
  await request(app).get('/api/templates').auth(token, { type: 'bearer' }).set('x-workspace-id', 'bad-selector').expect(400);
});

test('presets save, reload, update and version through the scoped template API', async () => {
  const account = accounts[0];
  const headers = { Authorization: `Bearer ${account.token}`, 'x-workspace-id': String(account.workspace._id) };
  const { body: library } = await request(app).get('/api/templates/library').set(headers).expect(200);
  const { body: created } = await request(app).post('/api/templates').set(headers).send({ ...library.records[0], name: 'qa_welcome_draft' }).expect(201);
  assert.equal(created.template.workspaceId, String(account.workspace._id));
  const id = created.template._id;
  await request(app).patch(`/api/templates/${id}`).set(headers).send({ body: `${created.template.body}\nQA revision.` }).expect(200);
  const { body: reloaded } = await request(app).get(`/api/templates/${id}`).set(headers).expect(200);
  assert.match(reloaded.template.body, /QA revision/);
  assert.equal(reloaded.template.currentVersionNumber, 2);
  const secondWorkspace = await Workspace.create({ name: 'Secondary QA', slug: 'secondary-qa', industryKey: 'clinic', businessEmail: account.user.email, businessPhone: '+14155550101', createdBy: account.user._id, status: 'ACTIVE' });
  await WorkspaceMembership.create({ workspaceId: secondWorkspace._id, userId: account.user._id, role: 'OWNER', status: 'ACTIVE' });
  await request(app).get(`/api/templates/${id}`).set({ ...headers, 'x-workspace-id': String(secondWorkspace._id) }).expect(404);
  const version = jwt.sign({ sub: String(account.user._id), ver: 0 }, process.env.JWT_SECRET);
  await request(app).get('/api/auth/me').auth(version, { type: 'bearer' }).expect(401);
});

test('explicit concurrent starter installation creates eight replies and five disabled rules once, preserving reviewed states', async () => {
  const account = accounts[0];
  const headers = { Authorization: `Bearer ${account.token}`, 'x-workspace-id': String(account.workspace._id) };
  for (const route of ['quick-replies', 'auto-reply-rules']) {
    const responses = await Promise.all(Array.from({ length: 6 }, () => request(app).post(`/api/inbox/${route}/starter-pack`).set(headers)));
    assert.ok(responses.every(r => r.status === 200), responses.map(r => r.body.message).join(', '));
  }
  assert.equal(await QuickReply.countDocuments({ workspaceId: account.workspace._id }), 8);
  const rules = await AutoReplyRule.find({ workspaceId: account.workspace._id });
  assert.equal(rules.length, 5);
  assert.ok(rules.every(r => r.enabled === false));
  rules[0].enabled = true;
  await rules[0].save();
  await request(app).post('/api/inbox/auto-reply-rules/starter-pack').set(headers).expect(200);
  assert.equal((await AutoReplyRule.findById(rules[0]._id)).enabled, true);
  for (let i = 0; i < 3; i++) await request(app).get('/api/inbox/quick-replies').set(headers).expect(200);
  assert.equal(await QuickReply.countDocuments({ workspaceId: account.workspace._id }), 8);
});

test('contacts persist real estate metadata, duplicate validation and tenant context through create/update/reload', async () => {
  const account = accounts[0];
  const headers = { Authorization: `Bearer ${account.token}`, 'x-workspace-id': String(account.workspace._id) };
  const payload = { fullName: 'Isolated Metadata Lead', phoneNumber: '+14155550200', interestedProject: 'Isolated Project', industryData: { siteVisitStatus: 'Scheduled', followUpDate: '2027-01-12' } };
  const created = await request(app).post('/api/contacts').set(headers).send(payload).expect(201);
  assert.equal(created.body.contact.workspaceId, String(account.workspace._id));
  assert.equal(created.body.contact.whatsappConsentStatus, 'Unknown');
  const id = created.body.contact._id;
  await request(app).post('/api/contacts').set(headers).send(payload).expect(409);
  await request(app).patch(`/api/contacts/${id}`).set(headers).send({ industryData: { siteVisitStatus: 'Completed' }, notes: 'Isolated QA note' }).expect(200);
  const loaded = await request(app).get(`/api/contacts/${id}`).set(headers).expect(200);
  assert.equal(loaded.body.contact.industryData.siteVisitStatus, 'Completed');
  assert.ok(loaded.body.contact.industryData.followUpDate);
  assert.equal(loaded.body.contact.notes, 'Isolated QA note');
  await request(app).get(`/api/contacts/${id}`).auth(accounts[2].token, { type: 'bearer' }).set('x-workspace-id', String(accounts[2].workspace._id)).expect(404);
});

test('STOP bypasses takeover, is idempotent per inbound event, protects genuine contacts from synthetic mutation, and START does not opt in', async () => {
  const account = accounts[0];
  const contact = await Contact.create({ ownerId: account.user._id, workspaceId: account.workspace._id, fullName: 'Isolated Consent Fixture', phoneNumber: '+14155550201', isDemo: true, whatsappConsentStatus: 'Opted In' });
  const conversation = await Conversation.create({ ownerId: account.user._id, workspaceId: account.workspace._id, contactId: contact._id, automationStatus: 'PAUSED' });
  const input = { ownerId: account.user._id, workspaceId: account.workspace._id, conversationId: conversation._id, contactId: contact._id, messageBody: 'STOP', messageId: new mongoose.Types.ObjectId(), executionMode: 'SYNTHETIC_TEST', user: { businessName: account.workspace.name } };
  const results = await Promise.all(Array.from({ length: 5 }, () => evaluateInboundMessage(input)));
  assert.equal(results.filter(r => r.executed).length, 1);
  assert.equal(await ConsentRecord.countDocuments({ contactId: contact._id, status: 'Opted Out' }), 1);
  assert.equal(await RuleExecution.countDocuments({ messageId: input.messageId }), 1);
  assert.equal((await Contact.findById(contact._id)).isSuppressed, true);
  await evaluateInboundMessage({ ...input, messageId: new mongoose.Types.ObjectId(), messageBody: 'START' });
  assert.equal((await Contact.findById(contact._id)).whatsappConsentStatus, 'Opted Out');
  const genuine = await Contact.create({ ownerId: account.user._id, workspaceId: account.workspace._id, fullName: 'Genuine Contact Fixture', phoneNumber: '+14155550202', whatsappConsentStatus: 'Opted In' });
  const genuineConversation = await Conversation.create({ ownerId: account.user._id, workspaceId: account.workspace._id, contactId: genuine._id });
  const blocked = await evaluateInboundMessage({ ...input, contactId: genuine._id, conversationId: genuineConversation._id, messageId: new mongoose.Types.ObjectId() });
  assert.equal(blocked.execution.status, 'BLOCKED');
  assert.equal((await Contact.findById(genuine._id)).whatsappConsentStatus, 'Opted In');
  assert.equal(await ConsentRecord.countDocuments({ contactId: genuine._id }), 0);
});

test('workspace campaign audiences can reuse the existing owner-scoped group library without importing foreign-workspace contacts', async () => {
  const account = accounts[0];
  const headers = { Authorization: `Bearer ${account.token}`, 'x-workspace-id': String(account.workspace._id) };
  const contact = await Contact.findOne({ workspaceId: account.workspace._id });
  const secondary = await Workspace.findOne({ slug: 'secondary-qa' });
  const foreignContact = await Contact.create({ ownerId: account.user._id, workspaceId: secondary._id, fullName: 'Other Workspace Fixture', phoneNumber: '+14155550204' });
  const group = await request(app).post('/api/contact-groups').set(headers).send({ name: 'Isolated Workspace Audience', contactIds: [String(contact._id), String(foreignContact._id)] }).expect(201);
  const campaign = await request(app).post('/api/campaigns').set(headers).send({ name: 'Isolated grouped audience' }).expect(201);
  const response = await request(app).post(`/api/campaigns/${campaign.body.campaign._id}/audience`).set(headers).send({ mode: 'group', definition: { groupId: group.body.group._id } });
  assert.equal(response.status, 200, response.body.message);
  const members = await request(app).get(`/api/campaigns/${campaign.body.campaign._id}/audience`).set(headers).expect(200);
  assert.equal(members.body.records.length, 1);
  assert.equal(members.body.records[0].contact.workspaceId, String(account.workspace._id));
});
