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
import Conversation from '../src/models/Conversation.js';
import ConversationMessage from '../src/models/ConversationMessage.js';
import MessageDraft from '../src/models/MessageDraft.js';
import InternalNote from '../src/models/InternalNote.js';
import FollowUpTask from '../src/models/FollowUpTask.js';

let mongo, owner, workspace, secondary, contact, legacy, foreign, explicitForeign, headers;

before(async () => {
  process.env.JWT_SECRET = 'inbox-workspace-compatibility-isolated-test-secret';
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  owner = await User.create({ name: 'Inbox Fixture Owner', email: 'inbox-workspace@isolated.example.test', passwordHash: 'unused-test-hash' });
  const createWorkspace = (slug) => Workspace.create({ name: slug, slug, industryKey: 'real_estate', businessEmail: owner.email, businessPhone: '+14155550300', createdBy: owner._id, status: 'ACTIVE' });
  workspace = await createWorkspace('inbox-workspace-fixture');
  secondary = await createWorkspace('inbox-secondary-fixture');
  for (const item of [workspace, secondary]) await WorkspaceMembership.create({ workspaceId: item._id, userId: owner._id, role: 'OWNER', status: 'ACTIVE', isDefaultWorkspace: item === workspace });
  const token = jwt.sign({ sub: String(owner._id) }, process.env.JWT_SECRET, { expiresIn: '1h' });
  headers = { Authorization: `Bearer ${token}`, 'x-workspace-id': String(workspace._id) };
  contact = await Contact.create({ ownerId: owner._id, workspaceId: workspace._id, fullName: 'Legacy Inbox Fixture', phoneNumber: '+14155550301' });
  legacy = await Conversation.create({ ownerId: owner._id, contactId: contact._id, source: 'manual', activeWorkspaceKey: `${owner._id}:${contact._id}:manual` });
  const otherContact = await Contact.create({ ownerId: owner._id, workspaceId: secondary._id, fullName: 'Other Workspace Fixture', phoneNumber: '+14155550302' });
  foreign = await Conversation.create({ ownerId: owner._id, contactId: otherContact._id, source: 'manual' });
  explicitForeign = await Conversation.create({ ownerId: owner._id, workspaceId: secondary._id, contactId: contact._id, source: 'test' });
});

after(async () => { await mongoose.disconnect(); await mongo?.stop(); });

test('legacy Inbox list, details and messages agree on the verified contact workspace without modifying stored records', async () => {
  const related = { ownerId: owner._id, conversationId: legacy._id, contactId: contact._id };
  const message = await ConversationMessage.create({ ...related, direction: 'inbound', messageSource: 'manual', messageBody: 'Legacy fixture message' });
  await ConversationMessage.create({ ...related, workspaceId: secondary._id, direction: 'inbound', messageSource: 'manual', messageBody: 'Foreign workspace marker' });
  await MessageDraft.create({ ...related, draftText: 'Legacy fixture draft', updatedBy: owner._id });
  await InternalNote.create({ ...related, content: 'Legacy fixture note', createdBy: owner._id, updatedBy: owner._id });
  await FollowUpTask.create({ ...related, title: 'Legacy fixture follow-up', dueAt: new Date(), createdBy: owner._id });
  const before = await Conversation.findById(legacy._id).lean();

  const list = await request(app).get('/api/inbox/conversations').set(headers).expect(200);
  assert.deepEqual(list.body.records.map(row => row._id), [String(legacy._id)]);
  assert.equal(list.body.total, 1);
  assert.equal((await request(app).get('/api/inbox/stats').set(headers).expect(200)).body.stats.total, 1);
  const detail = await request(app).get(`/api/inbox/conversations/${legacy._id}`).set(headers).expect(200);
  assert.equal(detail.body.conversation._id, String(legacy._id));
  assert.equal(detail.body.contact.workspaceId, String(workspace._id));
  assert.equal(detail.body.draft.draftText, 'Legacy fixture draft');
  assert.equal(detail.body.notes[0].content, 'Legacy fixture note');
  assert.equal(detail.body.tasks[0].title, 'Legacy fixture follow-up');
  const messages = await request(app).get(`/api/inbox/conversations/${legacy._id}/messages?limit=50`).set(headers).expect(200);
  assert.deepEqual(messages.body.records.map(row => row._id), [String(message._id)]);
  assert.equal((await request(app).get('/api/inbox/conversations?q=Legacy%20fixture%20message').set(headers).expect(200)).body.total, 1);
  assert.equal((await request(app).get('/api/inbox/conversations?q=Foreign%20workspace%20marker').set(headers).expect(200)).body.total, 0);
  assert.deepEqual(await Conversation.findById(legacy._id).lean(), before, 'Reads must not backfill or change the stored conversation');

  const count = await Conversation.countDocuments({ ownerId: owner._id });
  const reopened = await request(app).post('/api/inbox/conversations').set(headers).send({ contactId: String(contact._id), source: 'manual' }).expect(201);
  assert.equal(reopened.body.conversation._id, String(legacy._id));
  assert.equal(await Conversation.countDocuments({ ownerId: owner._id }), count, 'Opening the existing legacy conversation must not create a duplicate');
  assert.deepEqual(await Conversation.findById(legacy._id).lean(), before);
});

test('legacy compatibility rejects foreign, unassigned and inconsistent tenant references and stamps new conversations', async () => {
  const unassigned = await Contact.create({ ownerId: owner._id, fullName: 'Unassigned Fixture', phoneNumber: '+14155550303' });
  const ambiguous = await Conversation.create({ ownerId: owner._id, contactId: unassigned._id });
  const badReference = await Conversation.create({ ownerId: owner._id, workspaceId: workspace._id, contactId: foreign.contactId, source: 'test' });
  for (const conversation of [foreign, explicitForeign, ambiguous, badReference]) {
    await request(app).get(`/api/inbox/conversations/${conversation._id}`).set(headers).expect(404);
    await request(app).get(`/api/inbox/conversations/${conversation._id}/messages`).set(headers).expect(404);
  }
  await request(app).get(`/api/inbox/conversations/${legacy._id}`).set({ ...headers, 'x-workspace-id': String(secondary._id) }).expect(404);
  await request(app).patch(`/api/inbox/conversations/${foreign._id}`).set(headers).send({ status: 'Resolved' }).expect(404);
  await request(app).post(`/api/inbox/conversations/${foreign._id}/mark-reviewed`).set(headers).expect(404);
  const fresh = await Contact.create({ ownerId: owner._id, workspaceId: workspace._id, fullName: 'New Inbox Fixture', phoneNumber: '+14155550304' });
  const created = await request(app).post('/api/inbox/conversations').set(headers).send({ contactId: String(fresh._id) }).expect(201);
  assert.equal(created.body.conversation.workspaceId, String(workspace._id));
  await request(app).get(`/api/inbox/conversations/${created.body.conversation._id}`).set(headers).expect(200);
  await request(app).get(`/api/inbox/conversations/${created.body.conversation._id}/messages`).set(headers).expect(200);
  await request(app).patch(`/api/inbox/conversations/${legacy._id}`).set(headers).send({ status: 'Pending' }).expect(200);
  await request(app).post(`/api/inbox/conversations/${legacy._id}/mark-unread`).set(headers).send({ count: 2 }).expect(200);
  await request(app).post(`/api/inbox/conversations/${legacy._id}/mark-reviewed`).set(headers).expect(200);
  const stored = await Conversation.findById(legacy._id).lean();
  assert.equal(stored.status, 'Pending');
  assert.equal(stored.internalUnreadCount, 0);
  assert.equal(stored.workspaceId, undefined, 'Explicit actions must not silently migrate the existing record');
});
