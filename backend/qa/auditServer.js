// Isolated persistent QA: never reads or changes the working application database.
import mongoose from 'mongoose';
import request from 'supertest';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

const database = process.env.QA_DATABASE_NAME;
if (!/^relay_demo_qa_audit_[a-z0-9_]+$/.test(database || '')) throw new Error('Explicit isolated audit database required.');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
process.env.APP_MODE = 'demo';
process.env.DEMO_EMAIL_AUTO_VERIFY = 'true';
process.env.EMAIL_PROVIDER = 'inmemory';
process.env.WHATSAPP_PROVIDER = 'mock';
const { default: app } = await import('../src/app.js');
await mongoose.connect('mongodb://127.0.0.1:27017', { dbName: database });
assert.equal(mongoose.connection.db.databaseName, database);
const { default: Contact } = await import('../src/models/Contact.js');
const { default: Template } = await import('../src/models/MessageTemplate.js');
const { getPublicIndustrySummaries } = await import('../src/config/industries/industryRegistry.js');
const existing = process.env.AUDIT_REUSE_FIXTURES === 'true' ? JSON.parse(fs.readFileSync('/tmp/relay-audit-fixtures.json', 'utf8')) : null;
if (existing) assert.equal(existing.database, database);
const accounts = existing?.accounts || [];
const password = 'IsolatedAudit123!';
const run = Date.now().toString(36);
const keys = getPublicIndustrySummaries().map(i => i.key).concat('real_estate');
for (const [index, industryKey] of (existing ? [] : keys).entries()) {
  const email = `audit-${index}-${run}@isolated.example.test`;
  const register = await request(app).post('/api/auth/register').send({ name: 'Isolated Audit Operator', email, password, confirmPassword: password }).expect(201);
  const auth = { Authorization: `Bearer ${register.body.token}` };
  await request(app).put('/api/onboarding/draft').set(auth).send({ businessIdentity: { name: `Audit ${industryKey} ${index}`, email, phone: '+14155550100' }, industryKey }).expect(200);
  const done = await request(app).post('/api/onboarding/complete').set(auth).send({}).expect(201);
  const workspace = done.body.workspace;
  const headers = { ...auth, 'x-workspace-id': workspace._id };
  const config = (await request(app).get('/api/industries/workspace/current').set(headers).expect(200)).body;
  assert.equal(config.industryKey, industryKey);
  const before = await Template.countDocuments({ workspaceId: workspace._id });
  assert.equal(before, 15);
  for (let retry = 0; retry < 3; retry++) await request(app).get('/api/templates').set(headers).expect(200);
  assert.equal(await Template.countDocuments({ workspaceId: workspace._id }), 15);
  const created = (await request(app).post('/api/contacts').set(headers).send({ fullName: `Isolated ${industryKey} Contact`, phoneNumber: `+14155550${String(index).padStart(3, '0')}` }).expect(201)).body.contact;
  await request(app).patch(`/api/contacts/${created._id}`).set(headers).send({ notes: 'Persisted audit note' }).expect(200);
  assert.equal((await Contact.findById(created._id)).notes, 'Persisted audit note');
  const tpl = (await request(app).get('/api/templates').set(headers).expect(200)).body.records[0];
  await request(app).patch(`/api/templates/${tpl._id}`).set(headers).send({ body: 'Hello {{customer_name}}, persisted audit template.' }).expect(200);
  assert.equal((await Template.findById(tpl._id)).body, 'Hello {{customer_name}}, persisted audit template.');
  const reply = (await request(app).post('/api/inbox/quick-replies').set(headers).send({ name: 'Isolated Audit Reply', messageText: 'Persisted audit reply', category: 'General' }).expect(201)).body;
  const campaign = (await request(app).post('/api/campaigns').set(headers).send({ name: 'Isolated Audit Draft', executionMode: 'MOCK' }).expect(201)).body;
  const conv = (await request(app).post('/api/inbox/conversations').set(headers).send({ contactId: created._id }).expect(201)).body.conversation;
  await request(app).post(`/api/inbox/conversations/${conv._id}/mock-reply`).set(headers).send({ body: 'Persistent isolated mock message' }).expect(201);
  const messages = (await request(app).get(`/api/inbox/conversations/${conv._id}/messages`).set(headers).expect(200)).body.records;
  assert.equal(messages[0].messageBody, 'Persistent isolated mock message');
  const dash = (await request(app).get('/api/dashboard/overview').set(headers).expect(200)).body;
  assert.equal(dash.contacts.total, 1);
  assert.equal(dash.campaigns.total, 3);
  await request(app).get('/api/reports/overview').set(headers).expect(200);
  await request(app).get('/api/settings/business').set(headers).expect(200);
  if (accounts.length) {
    await request(app).get(`/api/contacts/${accounts[0].contactId}`).set(headers).expect(404);
    await request(app).get('/api/templates').set({ ...headers, 'x-workspace-id': accounts[0].workspaceId }).expect(403);
  }
  accounts.push({ industryKey, email, password, workspaceId: workspace._id, contactId: created._id, templateId: tpl._id, conversationId: conv._id });
  console.log(`Verified persistent API flow ${index + 1}/${keys.length}: ${industryKey}`);
}
// A second authorized workspace on the first account exercises in-tab switching.
const { default: Membership } = await import('../src/models/WorkspaceMembership.js');
const { default: User } = await import('../src/models/User.js');
const firstUser = await User.findOne({ email: accounts[0].email });
if (!existing) await Membership.create({ userId: firstUser._id, workspaceId: accounts[2].workspaceId, role: 'OWNER', status: 'ACTIVE' });
fs.writeFileSync('/tmp/relay-audit-fixtures.json', JSON.stringify({ database, accounts }, null, 2), { mode: 0o600 });
const server = app.listen(5002, '127.0.0.1', () => console.log('Persistent audit API ready on port 5002.'));
async function close() { server.close(); await mongoose.disconnect(); process.exit(0); }
process.on('SIGTERM', close); process.on('SIGINT', close);
