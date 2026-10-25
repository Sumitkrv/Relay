// Writes only to the explicitly isolated persistent audit database; no workers or live providers.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import request from 'supertest';
const fixtures = JSON.parse(fs.readFileSync('/tmp/relay-audit-fixtures.json', 'utf8'));
assert.match(fixtures.database, /^relay_demo_qa_audit_[a-z0-9_]+$/);
assert.equal(process.env.QA_DATABASE_NAME, fixtures.database);
process.env.NODE_ENV = 'test'; process.env.APP_MODE = 'demo';
process.env.EMAIL_PROVIDER = 'inmemory'; process.env.WHATSAPP_PROVIDER = 'mock';
process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
const { default: app } = await import('../src/app.js');
await mongoose.connect('mongodb://127.0.0.1:27017', { dbName: fixtures.database, autoIndex: false });
const db = mongoose.connection.db;
const results = [];
try {
 for (const [index, account] of fixtures.accounts.entries()) {
  const workspaceId = new mongoose.Types.ObjectId(account.workspaceId);
  const user = await db.collection('users').findOne({ email: account.email });
  const headers = { Authorization: `Bearer ${jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET)}`, 'x-workspace-id': account.workspaceId };
  const scope = { ownerId: user._id, workspaceId };
  const stamp = Date.now();
  const rule = (await request(app).post('/api/inbox/auto-reply-rules').set(headers).send({ name: `Audit persistence ${stamp}`, triggerKeyword: `AUDIT${stamp}`, actionType: 'RUN_MOCK_REPLY', responseMessage: 'Hello {{customer_name}}', enabled: false }).expect(201)).body.rule;
  await request(app).post(`/api/inbox/auto-reply-rules/${rule._id}/activate`).set(headers).expect(200);
  assert.equal((await db.collection('autoreplyrules').findOne({ _id: new mongoose.Types.ObjectId(rule._id), ...scope })).enabled, true);
  await request(app).post(`/api/inbox/auto-reply-rules/${rule._id}/deactivate`).set(headers).expect(200);
  assert.equal((await request(app).get(`/api/inbox/auto-reply-rules/${rule._id}`).set(headers).expect(200)).body.rule.enabled, false);
  const note = (await request(app).post(`/api/inbox/conversations/${account.conversationId}/notes`).set(headers).send({ content: 'Persistent isolated audit note' }).expect(201)).body.note;
  assert.equal((await db.collection('internalnotes').findOne({ _id: new mongoose.Types.ObjectId(note._id), ...scope })).content, 'Persistent isolated audit note');
  const task = (await request(app).post('/api/follow-ups').set(headers).send({ contactId: account.contactId, taskType: 'call', title: 'Isolated audit follow-up', dueAt: new Date(Date.now() + 86400000).toISOString() }).expect(201)).body.task;
  assert.ok(await db.collection('followuptasks').findOne({ _id: new mongoose.Types.ObjectId(task._id), ...scope }));
  await request(app).get(`/api/follow-ups/${task._id}`).set(headers).expect(200);
  const settings = (await request(app).get('/api/settings/business').set(headers).expect(200)).body.businessProfile;
  await request(app).put('/api/settings/business').set(headers).send({ ...settings, address: 'Isolated audit address' }).expect(200);
  assert.equal((await request(app).get('/api/settings/business').set(headers).expect(200)).body.businessProfile.address, 'Isolated audit address');
  assert.equal((await db.collection('businessprofiles').findOne(scope)).address, 'Isolated audit address');
  const reply = (await request(app).post('/api/inbox/quick-replies').set(headers).send({ name: `Audit removable ${stamp}`, messageText: 'Isolated reply' }).expect(201)).body.quickReply;
  assert.ok(reply?._id);
  await request(app).delete(`/api/inbox/quick-replies/${reply._id}`).set(headers).expect(200);
  await request(app).get(`/api/inbox/quick-replies/${reply._id}`).set(headers).expect(404);
  const dashboard = (await request(app).get('/api/dashboard/overview').set(headers).expect(200)).body;
  assert.equal(dashboard.contacts.total, await db.collection('contacts').countDocuments({ ...scope, isDeleted: false }));
  const report = (await request(app).get('/api/reports/overview').set(headers).expect(200)).body;
  assert.equal(report.kpis.totalCampaigns, await db.collection('campaigns').countDocuments({ ...scope, status: { $ne: 'Archived' } }));
  const foreign = fixtures.accounts[index === 0 ? fixtures.accounts.length - 1 : 0];
  await request(app).get(`/api/templates/${foreign.templateId}`).set(headers).expect(404);
  await request(app).patch(`/api/templates/${foreign.templateId}`).set(headers).send({ name: 'Must not change' }).expect(404);
  await request(app).get(`/api/inbox/conversations/${foreign.conversationId}`).set(headers).expect(404);
  results.push({ industry: account.industryKey, rule: 'PASS', note: 'PASS', followup: 'PASS', settings: 'PASS', deleteQAReply: 'PASS', metricsVsDatabase: 'PASS', foreignRecordReadAndWrite: 'PASS' });
  console.log(`Persistent supplemental checks ${index + 1}/14: ${account.industryKey}`);
 }
 fs.writeFileSync('/tmp/relay-audit-persistence-results.json', JSON.stringify(results, null, 2));
} finally { await mongoose.disconnect(); }
