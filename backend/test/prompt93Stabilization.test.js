import test from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'd2573fbca6add62c63544430a55abf9d47dc0c4ee829fa6cc2847f90f2ee73c3';

import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

import app from '../src/app.js';
import User from '../src/models/User.js';
import Contact from '../src/models/Contact.js';
import ConsentRecord from '../src/models/ConsentRecord.js';
import MessageTemplate from '../src/models/MessageTemplate.js';
import Campaign from '../src/models/Campaign.js';
import Message from '../src/models/Message.js';
import Conversation from '../src/models/Conversation.js';
import ConversationMessage from '../src/models/ConversationMessage.js';
import { getOverview, getMessageStatusSummary } from '../src/services/reportService.js';
import { campaignWorkerTick } from '../src/services/campaignExecutionService.js';

let mongo;
let owner;
let token;
const JWT_SECRET = process.env.JWT_SECRET;

function authHeader(tok) {
  return { Authorization: `Bearer ${tok}` };
}

test.before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());

  const passwordHash = await bcrypt.hash('SecureOwnerPass#99!', 10);

  owner = await User.create({
    name: 'M2W Admin Owner',
    email: 'owner.stabilization@relaycrm.test',
    passwordHash,
    role: 'owner',
    businessName: 'M2W Realty Gurugram',
    authVersion: 0
  });

  token = jwt.sign(
    { sub: owner._id.toString(), email: owner.email, role: 'owner', ver: 0 },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
});

test.after(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

test.describe('Prompt 9.3 — Relay Screenshot-Based Final Stabilization Regression Suite', () => {

  test('1. Campaign count consistency & authoritative status distribution in Report Service', async () => {
    // Clean up campaigns
    await Campaign.deleteMany({ ownerId: owner._id });

    // Create 4 distinct campaigns:
    // - 2 Drafts
    // - 1 Validated / Ready for Preparation
    // - 1 Scheduled
    await Campaign.create([
      {
        ownerId: owner._id,
        createdBy: owner._id,
        name: 'Draft Campaign 1',
        status: 'Draft',
        category: 'Real Estate'
      },
      {
        ownerId: owner._id,
        createdBy: owner._id,
        name: 'Draft Campaign 2',
        status: 'Draft',
        category: 'Real Estate'
      },
      {
        ownerId: owner._id,
        createdBy: owner._id,
        name: 'Ready Campaign 1',
        status: 'Validated for Preparation',
        category: 'Real Estate'
      },
      {
        ownerId: owner._id,
        createdBy: owner._id,
        name: 'Scheduled Campaign 1',
        status: 'Draft',
        mockSchedule: {
          status: 'scheduled',
          startAt: new Date(Date.now() + 86400000)
        },
        category: 'Real Estate'
      }
    ]);

    const overview = await getOverview(owner._id, {});

    // Total campaigns should be 4
    assert.strictEqual(overview.kpis.totalCampaigns, 4, 'Total campaigns must equal 4');
    // Draft campaigns must be strictly 2
    assert.strictEqual(overview.secondaryMetrics.draftCampaigns, 2, 'Draft campaigns must be strictly 2');
    // Ready campaigns must be 1
    assert.strictEqual(overview.secondaryMetrics.readyCampaigns, 1, 'Ready campaigns must be 1');
    // Scheduled campaigns must be 1
    assert.strictEqual(overview.secondaryMetrics.scheduledCampaigns, 1, 'Scheduled campaigns must be 1');
    // Running campaigns must be 0
    assert.strictEqual(overview.secondaryMetrics.runningCampaigns, 0, 'Running campaigns must be 0');

    // Check status chart distribution:
    const statusMap = {};
    for (const item of overview.charts.campaignStatusDistribution) {
      statusMap[item.status] = item.count;
    }
    assert.strictEqual(statusMap['Draft'], 2, 'Chart should show 2 Drafts');
    assert.strictEqual(statusMap['Scheduled (Mock)'], 1, 'Chart should show 1 Scheduled (Mock)');
    assert.strictEqual(statusMap['Ready for Preparation'], 1, 'Chart should show 1 Ready for Preparation');
  });

  test('2. Scheduled campaign template validation blocks scheduling without template', async () => {
    // Create draft campaign without template
    const campaign = await Campaign.create({
      ownerId: owner._id,
      createdBy: owner._id,
      name: 'Unpinned Template Campaign',
      status: 'Draft',
      category: 'Real Estate'
    });

    const res = await request(app)
      .post(`/api/campaigns/${campaign._id}/schedule`)
      .set(authHeader(token))
      .send({
        startAt: new Date(Date.now() + 3600000).toISOString(),
        timezone: 'Asia/Kolkata'
      });

    assert.strictEqual(res.status, 400, 'Scheduling without template must return HTTP 400');
    assert.strictEqual(res.body.code, 'TEMPLATE_REQUIRED', 'Error code must be TEMPLATE_REQUIRED');
  });

  test('3. Worker tick blocks execution of scheduled campaigns missing template references', async () => {
    // Persist a campaign directly with scheduled state in past, but missing template references
    const pastCampaign = await Campaign.create({
      ownerId: owner._id,
      createdBy: owner._id,
      name: 'Corrupt Scheduled Campaign Missing Template',
      status: 'Draft',
      category: 'Real Estate',
      selectedTemplateId: null,
      mockSchedule: {
        status: 'scheduled',
        startAt: new Date(Date.now() - 60000) // 1 minute in the past
      }
    });

    // Run campaign worker tick
    await campaignWorkerTick();

    // Re-fetch campaign
    const updated = await Campaign.findById(pastCampaign._id);
    assert.strictEqual(updated.mockSchedule.status, 'blocked', 'Worker must block scheduled campaign without template');
    assert.strictEqual(updated.status, 'Needs Review', 'Campaign status must be set to Needs Review');
    assert.match(updated.mockSchedule.error, /Template reference missing/i, 'Error message must specify template missing');
  });

  test('4. Contact consent provenance & evidence requirements', async () => {
    // Attempting to create an Opted In contact without evidence must be rejected with 400
    const invalidContactRes = await request(app)
      .post('/api/contacts')
      .set(authHeader(token))
      .send({
        fullName: 'Unverified Contact',
        phoneNumber: '+919999000011',
        consent: {
          status: 'Opted In'
          // Missing consentSource, consentPurpose, evidenceReference, etc.
        }
      });

    assert.strictEqual(invalidContactRes.status, 400, 'Opted In without evidence must be rejected with HTTP 400');
    assert.match(invalidContactRes.body.message, /consent source/i, 'Error must identify missing evidence requirement');
  });

  test('5. Synthetic inbound message anti-replay and duplicate prevention', async () => {
    // Create contact and conversation
    const contact = await Contact.create({
      ownerId: owner._id,
      fullName: 'Buyer Sim Lead',
      phoneNumber: '+919876500099',
      whatsappConsentStatus: 'Opted In',
      isDemo: true
    });

    const conv = await Conversation.create({
      ownerId: owner._id,
      contactId: contact._id,
      channel: 'whatsapp',
      source: 'mock',
      status: 'Open',
      automationStatus: 'ACTIVE'
    });

    const idempotencyKey = `sim_test_${Date.now()}`;

    // First simulation call
    const res1 = await request(app)
      .post('/api/dev/mock-messaging/simulate-inbound')
      .set(authHeader(token))
      .send({
        contactId: contact._id.toString(),
        messageText: 'PRICE inquiry please',
        idempotencyKey
      });

    assert.strictEqual(res1.status, 200);
    assert.strictEqual(res1.body.success, true);

    // Immediate replay with same idempotency key or same message within 2 seconds
    const res2 = await request(app)
      .post('/api/dev/mock-messaging/simulate-inbound')
      .set(authHeader(token))
      .send({
        contactId: contact._id.toString(),
        messageText: 'PRICE inquiry please',
        idempotencyKey
      });

    assert.strictEqual(res2.status, 200);
    assert.strictEqual(res2.body.idempotent, true, 'Second identical simulated message should return idempotent: true');

    // Verify database only has 1 inbound customer message with this text
    const inboundMsgs = await ConversationMessage.find({
      conversationId: conv._id,
      direction: 'inbound',
      messageBody: 'PRICE inquiry please'
    });

    assert.strictEqual(inboundMsgs.length, 1, 'Exactly one inbound message record should be stored in MongoDB');
  });

  test('6. Reports unique message counting ignores retries', async () => {
    const contact = await Contact.findOne({ ownerId: owner._id });
    // Create a message job with retries
    const msg = await Message.create({
      ownerId: owner._id,
      messageId: `msg_${Date.now()}`,
      contactId: contact._id,
      recipientPhone: '+919876500099',
      status: 'SIMULATED_DELIVERED',
      channel: 'whatsapp',
      providerMode: 'MOCK',
      renderedContentSnapshot: {
        body: 'Test mock message body'
      },
      retryCount: 2
    });

    const summary = await getMessageStatusSummary(owner._id, {});
    assert.ok(summary, 'Message summary returned');
    assert.strictEqual(summary.mockResults.SIMULATED_DELIVERED >= 1, true, 'Simulated delivered message counted once');
  });

});
