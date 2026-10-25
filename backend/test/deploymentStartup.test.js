import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../src/app.js';
import { getWorkerStatus, getQueueHealth } from '../src/services/messageQueueService.js';
import Message from '../src/models/Message.js';
import bcrypt from 'bcryptjs';
import { MongoMemoryServer } from 'mongodb-memory-server';
import User from '../src/models/User.js';
import Workspace from '../src/models/Workspace.js';
import WorkspaceMembership from '../src/models/WorkspaceMembership.js';

test('deployment startup resolves the M2W industry catalog without connecting to MongoDB', async () => {
  assert.equal(mongoose.connection.readyState, 0);
  const result = await request(app).get('/api/industries/real_estate').expect(200);
  assert.equal(result.body.industry.key, 'real_estate');
  assert.ok(result.body.industry.contactFields.some(field => field.key === 'interestedPropertyType'));
  await request(app).get('/api/industries/unknown-industry').expect(404);
  assert.equal(mongoose.connection.readyState, 0);
  assert.equal(getWorkerStatus().running, false);
});

test('restored workspace configuration endpoints still require authentication', async () => {
  for (const path of [
    '/api/industries/workspace/current',
    '/api/workspaces/current/industry-config',
    '/api/workspaces/current/contact-field-definitions',
    '/api/workspaces/current/template-suggestions',
    '/api/workspaces/current/automation-suggestions',
    '/api/workspaces/current/starter-provisioning',
    '/api/billing/subscription',
  ]) {
    await request(app).get(path).expect(401);
  }
});

test('queue health retains both owner and workspace filters', async (t) => {
  const ownerId = new mongoose.Types.ObjectId();
  const workspaceId = new mongoose.Types.ObjectId();
  let aggregateFilter;
  let countFilter;
  t.mock.method(Message, 'aggregate', async (pipeline) => {
    aggregateFilter = pipeline[0].$match;
    return [];
  });
  t.mock.method(Message, 'countDocuments', async (filter) => {
    countFilter = filter;
    return 0;
  });
  await getQueueHealth(ownerId, workspaceId);
  assert.deepEqual(aggregateFilter, { ownerId, workspaceId });
  assert.deepEqual(countFilter, { ownerId, workspaceId, status: 'PROCESSING' });
});

test('M2W sign-in and workspace configuration work against a disposable database', async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'deployment-test-session-secret-over-32-characters';
  process.env.EMAIL_PROVIDER = 'inmemory';
  const mongo = await MongoMemoryServer.create();
  try {
    await mongoose.connect(mongo.getUri());
    const user = await User.create({
      name: 'Deployment Test Operator',
      email: 'deployment@isolated.example.test',
      passwordHash: await bcrypt.hash('DeploymentTest123!', 10),
      isEmailVerified: true,
    });
    const workspace = await Workspace.create({
      name: 'M2W Realty Test', slug: 'm2w-deployment-test', industryKey: 'real_estate',
      businessEmail: user.email, businessPhone: '+14155550100',
      createdBy: user._id, status: 'ACTIVE',
    });
    await WorkspaceMembership.create({
      userId: user._id, workspaceId: workspace._id, role: 'OWNER', status: 'ACTIVE',
    });
    const login = await request(app).post('/api/auth/login').send({
      email: user.email, password: 'DeploymentTest123!',
    }).expect(200);
    assert.equal(login.body.hasWorkspace, true);
    assert.equal(login.body.user.id, String(user._id));
    const headers = { Authorization: `Bearer ${login.body.token}`, 'x-workspace-id': String(workspace._id) };
    await request(app).get('/api/auth/me').set(headers).expect(200);
    const config = await request(app).get('/api/industries/workspace/current').set(headers).expect(200);
    assert.equal(config.body.workspaceId, String(workspace._id));
    assert.equal(config.body.industryKey, 'real_estate');
    assert.ok(config.body.ui);
  } finally {
    await mongoose.disconnect();
    await mongo.stop();
  }
});
