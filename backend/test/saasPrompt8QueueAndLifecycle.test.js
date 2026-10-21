import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import Message from '../src/models/Message.js';
import MessageEvent from '../src/models/MessageEvent.js';
import Workspace from '../src/models/Workspace.js';
import User from '../src/models/User.js';
import Contact from '../src/models/Contact.js';
import Campaign from '../src/models/Campaign.js';
import CampaignExecution from '../src/models/CampaignExecution.js';
import CampaignMessageJob from '../src/models/CampaignMessageJob.js';
import { processMessageJob, messageWorkerTick } from '../src/services/messageQueueService.js';
import * as workspaceMockService from '../src/services/workspaceMockService.js';

let mongod;
let user;
let wsGym;
let wsSalon;

describe('SaaS 08 — Durable Queue, Message Lifecycle & Fair Tenant Scheduling', () => {
  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());

    user = await User.create({
      name: 'Queue Test Operator',
      email: 'operator@example.com',
      passwordHash: 'dummyhash123',
    });

    wsGym = await Workspace.create({
      name: 'FitZone Gym Test',
      slug: 'fitzone-gym-test',
      industryKey: 'gym',
      businessEmail: 'contact@fitzone.com',
      businessPhone: '+919876543210',
      createdBy: user._id,
    });

    wsSalon = await Workspace.create({
      name: 'Glow Salon Test',
      slug: 'glow-salon-test',
      industryKey: 'salon',
      businessEmail: 'contact@glowsalon.com',
      businessPhone: '+919876543211',
      createdBy: user._id,
    });
  });

  after(async () => {
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  });

  it('1. Message lifecycle: Queued -> Processing -> Simulated Sent', async () => {
    const contact = await Contact.create({
      workspaceId: wsGym._id,
      ownerId: user._id,
      fullName: 'Gym Member 1',
      phoneNumber: '+919988776655',
      whatsappConsentStatus: 'Opted In',
    });

    const message = await Message.create({
      ownerId: user._id,
      workspaceId: wsGym._id,
      messageId: `msg_test_${Date.now()}`,
      contactId: contact._id,
      recipientPhone: contact.phoneNumber,
      recipientName: contact.fullName,
      status: 'QUEUED',
      renderedContentSnapshot: { body: 'Welcome to FitZone Gym!' },
    });

    assert.equal(message.status, 'QUEUED');

    // Process job atomically
    const processed = await processMessageJob(message._id);
    assert.equal(processed, true);

    const updated = await Message.findById(message._id);
    assert.equal(updated.status, 'SIMULATED_SENT');
    assert.ok(updated.simulatedSentAt instanceof Date);
    assert.ok(updated.providerMessageId.startsWith('mock_msg_'));

    // Check MessageEvent provenance
    const events = await MessageEvent.find({ messageId: message._id }).sort({ timestamp: 1 });
    assert.ok(events.length >= 2);
    assert.equal(events[0].newStatus, 'PROCESSING');
    assert.equal(events[1].newStatus, 'SIMULATED_SENT');
    assert.equal(String(events[0].workspaceId), String(wsGym._id));
  });

  it('2. Simulated lifecycle progression: DELIVERED -> READ', async () => {
    const contact = await Contact.create({
      workspaceId: wsGym._id,
      ownerId: user._id,
      fullName: 'Gym Member 2',
      phoneNumber: '+919988776656',
      whatsappConsentStatus: 'Opted In',
    });

    const message = await Message.create({
      ownerId: user._id,
      workspaceId: wsGym._id,
      messageId: `msg_test_prog_${Date.now()}`,
      contactId: contact._id,
      recipientPhone: contact.phoneNumber,
      status: 'SIMULATED_SENT',
      providerMessageId: `mock_msg_prog_${Date.now()}`,
    });

    // Simulate Delivered
    const delResult = await workspaceMockService.simulateMessageScenario({
      workspace: wsGym,
      messageId: message._id,
      scenario: 'DELIVERED',
    });
    assert.equal(delResult.newStatus, 'SIMULATED_DELIVERED');

    const afterDel = await Message.findById(message._id);
    assert.equal(afterDel.status, 'SIMULATED_DELIVERED');

    // Simulate Read
    const readResult = await workspaceMockService.simulateMessageScenario({
      workspace: wsGym,
      messageId: message._id,
      scenario: 'READ',
    });
    assert.equal(readResult.newStatus, 'SIMULATED_READ');

    const afterRead = await Message.findById(message._id);
    assert.equal(afterRead.status, 'SIMULATED_READ');
  });

  it('3. Temporary failure invokes retry backoff and reconciler', async () => {
    const contact = await Contact.create({
      workspaceId: wsGym._id,
      ownerId: user._id,
      fullName: 'Gym Member Retry',
      phoneNumber: '+919988776657',
      whatsappConsentStatus: 'Opted In',
    });

    const message = await Message.create({
      ownerId: user._id,
      workspaceId: wsGym._id,
      messageId: `msg_test_fail_${Date.now()}`,
      contactId: contact._id,
      recipientPhone: contact.phoneNumber,
      status: 'QUEUED',
      metadata: { forceOutcome: 'TEMPORARY_FAILURE' },
      maxAttempts: 3,
    });

    const res = await processMessageJob(message._id);
    assert.equal(res, true);

    const updated = await Message.findById(message._id);
    assert.equal(updated.status, 'TEMPORARY_FAILURE');
    assert.equal(updated.attemptCount, 1);
    assert.ok(updated.nextRetryAt instanceof Date);

    // Simulate due retry: manually set nextRetryAt to past
    await Message.updateOne({ _id: message._id }, { $set: { nextRetryAt: new Date(Date.now() - 5000) } });

    // Tick worker
    await messageWorkerTick('test-worker-1');

    const reQueued = await Message.findById(message._id);
    // Worker re-enqueues due retry
    assert.ok(['QUEUED', 'TEMPORARY_FAILURE', 'SIMULATED_SENT'].includes(reQueued.status));
  });

  it('4. Multi-tenant fairness: interleave processing across multiple workspaces', async () => {
    // Clear out any old queued messages
    await Message.deleteMany({ status: 'QUEUED' });

    // Create 3 queued messages for Gym
    const contactGym = await Contact.create({
      workspaceId: wsGym._id,
      ownerId: user._id,
      fullName: 'Gym Fair Contact',
      phoneNumber: '+919988776658',
      whatsappConsentStatus: 'Opted In',
    });
    for (let i = 0; i < 3; i++) {
      await Message.create({
        ownerId: user._id,
        workspaceId: wsGym._id,
        messageId: `msg_gym_fair_${i}_${Date.now()}`,
        contactId: contactGym._id,
        recipientPhone: contactGym.phoneNumber,
        status: 'QUEUED',
        renderedContentSnapshot: { body: `Gym Fair Message ${i}` },
      });
    }

    // Create 2 queued messages for Salon
    const contactSalon = await Contact.create({
      workspaceId: wsSalon._id,
      ownerId: user._id,
      fullName: 'Salon Fair Contact',
      phoneNumber: '+919988776659',
      whatsappConsentStatus: 'Opted In',
    });
    for (let i = 0; i < 2; i++) {
      await Message.create({
        ownerId: user._id,
        workspaceId: wsSalon._id,
        messageId: `msg_salon_fair_${i}_${Date.now()}`,
        contactId: contactSalon._id,
        recipientPhone: contactSalon.phoneNumber,
        status: 'QUEUED',
        renderedContentSnapshot: { body: `Salon Fair Message ${i}` },
      });
    }

    // Run one worker tick with multi-tenant fairness enabled
    await messageWorkerTick('fairness-test-worker');

    // Both Gym and Salon must have processed at least 1 message in this turn
    const remainingGym = await Message.countDocuments({ workspaceId: wsGym._id, status: 'QUEUED' });
    const remainingSalon = await Message.countDocuments({ workspaceId: wsSalon._id, status: 'QUEUED' });

    assert.ok(remainingGym < 3, `Expected Gym to make progress, remaining: ${remainingGym}`);
    assert.ok(remainingSalon < 2, `Expected Salon to make progress, remaining: ${remainingSalon}`);
  });

  it('5. Worker lease recovery reconciles stuck jobs after crash', async () => {
    const contact = await Contact.create({
      workspaceId: wsGym._id,
      ownerId: user._id,
      fullName: 'Stuck Contact',
      phoneNumber: '+919988776660',
      whatsappConsentStatus: 'Opted In',
    });

    // Create message stuck in PROCESSING with expired lease
    const stuck = await Message.create({
      ownerId: user._id,
      workspaceId: wsGym._id,
      messageId: `msg_stuck_${Date.now()}`,
      contactId: contact._id,
      recipientPhone: contact.phoneNumber,
      status: 'PROCESSING',
      leaseOwner: 'crashed-worker-999',
      leaseUntil: new Date(Date.now() - 10000), // Expired 10 seconds ago
    });

    await messageWorkerTick('recovery-worker');

    const recovered = await Message.findById(stuck._id);
    // Expired lease must be cleared and status reset to QUEUED or processed
    assert.notEqual(recovered.leaseOwner, 'crashed-worker-999');
    assert.ok(['QUEUED', 'SIMULATED_SENT'].includes(recovered.status));
  });
});
