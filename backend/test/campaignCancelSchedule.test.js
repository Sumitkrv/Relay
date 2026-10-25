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
import Campaign from '../src/models/Campaign.js';

let mongo, owner, workspace, headers;

before(async () => {
  process.env.JWT_SECRET = 'campaign-cancel-schedule-isolated-test-secret-0123456789';
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  owner = await User.create({ name: 'Cancel Owner', email: 'cancel-schedule@isolated.example.test', passwordHash: 'unused-test-hash' });
  workspace = await Workspace.create({ name: 'cancel-schedule', slug: 'cancel-schedule', industryKey: 'real_estate', businessEmail: owner.email, businessPhone: '+14155550500', createdBy: owner._id, status: 'ACTIVE' });
  await WorkspaceMembership.create({ workspaceId: workspace._id, userId: owner._id, role: 'OWNER', status: 'ACTIVE', isDefaultWorkspace: true });
  const token = jwt.sign({ sub: String(owner._id) }, process.env.JWT_SECRET, { expiresIn: '1h' });
  headers = { Authorization: `Bearer ${token}`, 'x-workspace-id': String(workspace._id) };
});

after(async () => { await mongoose.disconnect(); await mongo?.stop(); });

test('cancelling a scheduled campaign persists mockSchedule.status=cancelled so the scheduler can never launch it', async () => {
  const startAt = new Date(Date.now() + 86400000);
  const campaign = await Campaign.create({ ownerId: owner._id, workspaceId: workspace._id, createdBy: owner._id, name: 'Cancel me', goal: 'Lead follow-up', status: 'Scheduled', mockSchedule: { startAt, timezone: 'Asia/Kolkata', status: 'scheduled' } });
  const res = await request(app).post(`/api/campaigns/${campaign._id}/cancel`).set(headers);
  assert.equal(res.status, 200, res.body.message);
  const stored = await Campaign.findById(campaign._id).lean();
  assert.equal(stored.status, 'Cancelled');
  assert.equal(stored.mockSchedule.status, 'cancelled', 'the nested Mixed field must be persisted');
  assert.equal(await Campaign.countDocuments({ _id: campaign._id, 'mockSchedule.status': 'scheduled' }), 0);
});
