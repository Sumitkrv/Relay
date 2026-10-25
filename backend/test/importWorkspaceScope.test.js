import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Workspace from '../src/models/Workspace.js';
import WorkspaceMembership from '../src/models/WorkspaceMembership.js';
import Contact from '../src/models/Contact.js';

let mongo, owner, wsA, wsB, hA, hB;

before(async () => {
  process.env.JWT_SECRET = 'import-workspace-scope-isolated-test-secret-0123456789';
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Contact.init();
  owner = await User.create({ name: 'Import Scope Owner', email: 'import-scope@isolated.example.test', passwordHash: 'unused-test-hash' });
  const mk = (slug) => Workspace.create({ name: slug, slug, industryKey: 'real_estate', businessEmail: owner.email, businessPhone: '+14155550400', createdBy: owner._id, status: 'ACTIVE' });
  wsA = await mk('import-scope-a');
  wsB = await mk('import-scope-b');
  for (const w of [wsA, wsB]) await WorkspaceMembership.create({ workspaceId: w._id, userId: owner._id, role: 'OWNER', status: 'ACTIVE', isDefaultWorkspace: w === wsA });
  const token = jwt.sign({ sub: String(owner._id) }, process.env.JWT_SECRET, { expiresIn: '1h' });
  hA = { Authorization: `Bearer ${token}`, 'x-workspace-id': String(wsA._id) };
  hB = { Authorization: `Bearer ${token}`, 'x-workspace-id': String(wsB._id) };
});

after(async () => { await mongoose.disconnect(); await mongo?.stop(); });

async function runImport(headers, csv) {
  const up = await request(app).post('/api/imports/upload').set(headers).attach('file', Buffer.from(csv), { filename: 'scope.csv', contentType: 'text/csv' });
  assert.equal(up.status, 201, up.body.message);
  const id = up.body.job._id;
  const v = await request(app).post(`/api/imports/${id}/validate`).set(headers);
  assert.equal(v.status, 200, v.body.message);
  const ex = await request(app).post(`/api/imports/${id}/execute`).set(headers);
  assert.equal(ex.status, 202, ex.body.message);
  let st;
  for (let i = 0; i < 100; i += 1) {
    await new Promise((r) => setTimeout(r, 20));
    st = await request(app).get(`/api/imports/${id}/status`).set(headers);
    if (['Completed', 'Completed With Errors', 'Failed'].includes(st.body.job.status)) break;
  }
  return { id, job: st.body.job, upload: up.body.job };
}

test('workspace import stamps workspaceId so imported contacts are visible, scoped and not cross-listed', async () => {
  const csv = 'Full Name,Phone Number\nScope Import One,+919876510001\nScope Import Two,+919876510002\n';
  const { id, job, upload } = await runImport(hA, csv);
  assert.equal(String(upload.workspaceId), String(wsA._id));
  assert.equal(job.status, 'Completed');
  assert.equal(job.createdCount, 2);

  const stored = await Contact.find({ phoneNumber: { $in: ['+919876510001', '+919876510002'] } }).lean();
  assert.equal(stored.length, 2);
  for (const c of stored) assert.equal(String(c.workspaceId), String(wsA._id), 'imported contact must carry the active workspaceId');

  const listA = await request(app).get('/api/contacts?search=Scope%20Import').set(hA);
  assert.equal(listA.body.total, 2, 'imported contacts must appear in the importing workspace');
  const listB = await request(app).get('/api/contacts?search=Scope%20Import').set(hB);
  assert.equal(listB.body.total, 0, 'imported contacts must not appear in another workspace');

  const histA = await request(app).get('/api/imports/history').set(hA);
  assert.ok(histA.body.jobs.some((j) => j._id === id));
  const histB = await request(app).get('/api/imports/history').set(hB);
  assert.ok(!histB.body.jobs.some((j) => j._id === id));
  const foreign = await request(app).get(`/api/imports/${id}/status`).set(hB);
  assert.equal(foreign.status, 404);
});

test('re-importing the same phone into the same workspace is skipped, never duplicated', async () => {
  const csv = 'Full Name,Phone Number\nScope Shared Phone,+919876510009\n';
  const a = await runImport(hA, csv);
  assert.equal(a.job.createdCount, 1);
  const again = await runImport(hA, csv);
  assert.equal(again.job.createdCount, 0);
  assert.equal(again.job.skippedCount, 1);
  assert.equal(await Contact.countDocuments({ phoneNumber: '+919876510009' }), 1);
});
