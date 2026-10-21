import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import mockWhatsAppProvider from '../src/services/mockWhatsAppProvider.js';
import * as workspaceMockService from '../src/services/workspaceMockService.js';
import Workspace from '../src/models/Workspace.js';
import User from '../src/models/User.js';

let mongod;

describe('SaaS 08 — Mock WhatsApp Provider Contract & Safety Gate', () => {
  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  });

  after(async () => {
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  });

  it('1. Provider identifies authoritatively as MOCK and never claims Meta verification', async () => {
    const status = await mockWhatsAppProvider.getConnectionStatus();
    assert.equal(status.mode, 'MOCK');
    assert.equal(status.officialMetaConnected, false);
    assert.equal(status.mockEngineReady, true);
    assert.ok(status.message.toLowerCase().includes('mock') || status.message.toLowerCase().includes('sandbox') || status.message.toLowerCase().includes('disconnected'));
  });

  it('2. Message dispatch generates purely synthetic IDs and metadata', async () => {
    const res = await mockWhatsAppProvider.sendMessage({
      recipientPhone: '+919876543210',
      recipientName: 'Test Recipient',
      renderedContent: {
        body: 'Hello from Relay Simulator!'
      }
    });

    assert.equal(res.success, true);
    assert.equal(res.status, 'SIMULATED_SENT');
    assert.ok(res.providerMessageId.startsWith('mock_msg_'), `Expected mock_msg_ prefix, got: ${res.providerMessageId}`);
    assert.ok(res.simulatedSentAt instanceof Date);
  });

  it('3. normalizeStatusEvent correctly normalizes DELIVERED and READ status events', async () => {
    const resDelivered = mockWhatsAppProvider.normalizeStatusEvent({
      providerMessageId: 'mock_msg_test_123',
      status: 'delivered',
    });
    assert.equal(resDelivered.status, 'SIMULATED_DELIVERED');
    assert.equal(resDelivered.providerMessageId, 'mock_msg_test_123');

    const resRead = mockWhatsAppProvider.normalizeStatusEvent({
      providerMessageId: 'mock_msg_test_123',
      status: 'read',
    });
    assert.equal(resRead.status, 'SIMULATED_READ');
  });

  it('4. normalizeProviderError correctly categorizes retryable vs permanent errors', async () => {
    const tempFail = mockWhatsAppProvider.normalizeProviderError({
      failureCode: 'TEMPORARY_FAILURE',
      message: 'Temporary provider timeout',
    });
    assert.equal(tempFail.failureCode, 'TEMPORARY_FAILURE');
    assert.equal(tempFail.retryable, true);

    const permFail = mockWhatsAppProvider.normalizeProviderError({
      failureCode: 'PERMANENT_FAILURE',
      message: 'Unrecoverable recipient error',
    });
    assert.equal(permFail.failureCode, 'PERMANENT_FAILURE');
    assert.equal(permFail.retryable, false);
  });

  it('5. Each workspace gets an isolated synthetic sender identifier', async () => {
    const user = await User.create({
      name: 'Owner Gym',
      email: 'gym-owner@example.com',
      passwordHash: 'dummyhash123',
    });

    const gymWorkspace = await Workspace.create({
      name: 'FitZone Gym',
      slug: 'fitzone-gym',
      industryKey: 'gym',
      businessEmail: 'contact@fitzone.com',
      businessPhone: '+919876543211',
      createdBy: user._id,
    });

    const salonWorkspace = await Workspace.create({
      name: 'Glow Salon',
      slug: 'glow-salon',
      industryKey: 'salon',
      businessEmail: 'contact@glowsalon.com',
      businessPhone: '+919876543212',
      createdBy: user._id,
    });

    const gymStatus = await workspaceMockService.getWorkspaceMockStatus(gymWorkspace);
    const salonStatus = await workspaceMockService.getWorkspaceMockStatus(salonWorkspace);

    assert.notEqual(gymStatus.senderIdentifier, salonStatus.senderIdentifier);
    assert.ok(gymStatus.senderIdentifier.includes(String(gymWorkspace._id)));
    assert.ok(salonStatus.senderIdentifier.includes(String(salonWorkspace._id)));
    assert.equal(gymStatus.mode, 'MOCK');
    assert.equal(salonStatus.mode, 'MOCK');
  });

  it('6. Live Meta connection attempt is strictly rejected by workspaceMockService', async () => {
    const user = await User.create({
      name: 'Tester',
      email: 'tester@example.com',
      passwordHash: 'dummyhash123',
    });

    const ws = await Workspace.create({
      name: 'Test Business',
      slug: 'test-business',
      industryKey: 'other',
      businessEmail: 'contact@testbiz.com',
      businessPhone: '+919876543213',
      createdBy: user._id,
    });

    // Attempting to toggle to LIVE or connecting live provider must fail
    await assert.rejects(
      async () => {
        await workspaceMockService.toggleWorkspaceMockConnection(ws, 'LIVE');
      },
      (err) => {
        assert.ok(err.message.includes('MOCK_ACTIVE') || err.message.includes('MOCK_PAUSED'));
        return true;
      }
    );
  });
});
