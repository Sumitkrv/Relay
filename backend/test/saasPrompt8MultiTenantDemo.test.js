import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import Workspace from '../src/models/Workspace.js';
import User from '../src/models/User.js';
import Contact from '../src/models/Contact.js';
import Conversation from '../src/models/Conversation.js';
import ConversationMessage from '../src/models/ConversationMessage.js';
import AutoReplyRule from '../src/models/AutoReplyRule.js';
import * as workspaceMockService from '../src/services/workspaceMockService.js';

let mongod;
let userGym;
let userSalon;
let userM2W;
let wsGym;
let wsSalon;
let wsM2W;

describe('SaaS 08 — Multi-Tenant E2E Demos & Cross-Tenant Isolation', () => {
  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());

    userGym = await User.create({
      name: 'Gym Manager',
      email: 'gym-mgr@example.com',
      passwordHash: 'dummyhash123',
    });

    userSalon = await User.create({
      name: 'Salon Stylist',
      email: 'salon@example.com',
      passwordHash: 'dummyhash123',
    });

    userM2W = await User.create({
      name: 'M2W Realty Admin',
      email: 'm2w-admin@example.com',
      passwordHash: 'dummyhash123',
    });

    wsGym = await Workspace.create({
      name: 'FitZone Gym',
      slug: 'fitzone-gym',
      industryKey: 'gym',
      businessEmail: 'gym@example.com',
      businessPhone: '+919876543210',
      createdBy: userGym._id,
    });

    wsSalon = await Workspace.create({
      name: 'Glow Salon',
      slug: 'glow-salon',
      industryKey: 'salon',
      businessEmail: 'salon@example.com',
      businessPhone: '+919876543211',
      createdBy: userSalon._id,
    });

    wsM2W = await Workspace.create({
      name: 'M2W Realty',
      slug: 'm2w-realty',
      industryKey: 'real_estate',
      businessEmail: 'm2w@example.com',
      businessPhone: '+919876543212',
      createdBy: userM2W._id,
    });

    // Seed historical genuine M2W Realty record
    await Contact.create({
      workspaceId: wsM2W._id,
      ownerId: userM2W._id,
      fullName: 'Genuine Real Estate Buyer',
      phoneNumber: '+919999900001',
      whatsappConsentStatus: 'Opted In',
      isDemo: false, // Genuine!
    });
  });

  after(async () => {
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  });

  it('1. FitZone Gym E2E: Provisions vertical demo data, executes inbound TRIAL auto-reply', async () => {
    // 1. Setup demo data
    const demoRes = await workspaceMockService.setupWorkspaceDemoData({
      workspace: wsGym,
      user: userGym,
    });

    assert.equal(demoRes.created.contactsCount, 3);

    // Verify contacts are tagged isDemo: true
    const gymContacts = await Contact.find({ workspaceId: wsGym._id, isDemo: true });
    assert.equal(gymContacts.length, 3);

    // 2. Simulate inbound TRIAL message
    const inbound = await workspaceMockService.simulateInboundMessage({
      workspace: wsGym,
      contactPhone: gymContacts[0].phoneNumber,
      contactName: gymContacts[0].fullName,
      messageBody: 'Can I get a TRIAL pass today?',
      contactId: gymContacts[0]._id,
      user: userGym,
    });

    assert.equal(inbound.success, true);
    assert.ok(inbound.autoReply);
    assert.ok(inbound.autoReply.responseBody.includes('FitZone Gym'));

    // Check mock status
    const status = await workspaceMockService.getWorkspaceMockStatus(wsGym);
    assert.ok(status.metrics.totalConversations >= 1);
  });

  it('2. Glow Salon E2E: Provisions salon demo data, executes inbound SERVICES auto-reply', async () => {
    const demoRes = await workspaceMockService.setupWorkspaceDemoData({
      workspace: wsSalon,
      user: userSalon,
    });

    assert.equal(demoRes.created.contactsCount, 3);

    const salonContacts = await Contact.find({ workspaceId: wsSalon._id, isDemo: true });
    assert.equal(salonContacts.length, 3);

    const inbound = await workspaceMockService.simulateInboundMessage({
      workspace: wsSalon,
      contactPhone: salonContacts[0].phoneNumber,
      contactName: salonContacts[0].fullName,
      messageBody: 'What are your SERVICES and packages?',
      contactId: salonContacts[0]._id,
      user: userSalon,
    });

    assert.equal(inbound.success, true);
    assert.ok(inbound.autoReply);
    assert.ok(inbound.autoReply.responseBody.includes('Glow Salon'));
  });

  it('3. Cross-Tenant Isolation: Gym cannot read or mutate Salon messages or contacts', async () => {
    // 1. Salon messages are NOT accessible under Gym workspaceId
    const salonConvs = await Conversation.find({ workspaceId: wsSalon._id });
    assert.ok(salonConvs.length > 0);

    const gymViewOfSalon = await Conversation.find({
      workspaceId: wsGym._id,
      _id: { $in: salonConvs.map((c) => c._id) },
    });
    assert.equal(gymViewOfSalon.length, 0, 'Gym must not find Salon conversations under its workspaceId');

    // 2. Gym cannot simulate a scenario on a Salon message
    const salonMsg = await ConversationMessage.findOne({ workspaceId: wsSalon._id });
    assert.ok(salonMsg);

    await assert.rejects(
      async () => {
        await workspaceMockService.simulateMessageScenario({
          workspace: wsGym, // Passing Gym workspace for a Salon message
          messageId: salonMsg._id,
          scenario: 'DELIVERED',
        });
      },
      (err) => {
        assert.ok(err.message.includes('not found') || err.message.includes('workspace'));
        return true;
      }
    );
  });

  it('4. M2W Realty Historical Data Preservation: Genuine records untouched during demo setup or reset', async () => {
    const m2wBefore = await Contact.findOne({ workspaceId: wsM2W._id, isDemo: false });
    assert.ok(m2wBefore);
    assert.equal(m2wBefore.fullName, 'Genuine Real Estate Buyer');

    // Reset demo data in Gym workspace
    const resetRes = await workspaceMockService.resetWorkspaceDemoData({
      workspace: wsGym,
      user: userGym,
    });
    assert.ok(resetRes.deleted.contacts > 0);

    // M2W genuine contact must remain completely intact
    const m2wAfter = await Contact.findOne({ workspaceId: wsM2W._id, isDemo: false });
    assert.ok(m2wAfter);
    assert.equal(m2wAfter.fullName, 'Genuine Real Estate Buyer');
    assert.equal(m2wAfter.whatsappConsentStatus, 'Opted In');

    // Also verify Salon demo contacts were NOT deleted when Gym was reset
    const salonContactsRemaining = await Contact.countDocuments({ workspaceId: wsSalon._id });
    assert.ok(salonContactsRemaining >= 3, 'Salon contacts must not be affected by Gym reset');
  });

  it('5. Safe Demo Reset: Only deletes isDemo: true records within the targeted workspace', async () => {
    // Add a genuine contact to Gym
    const genuineGymContact = await Contact.create({
      workspaceId: wsGym._id,
      ownerId: userGym._id,
      fullName: 'Real Gym Member',
      phoneNumber: '+919911223344',
      whatsappConsentStatus: 'Opted In',
      isDemo: false,
    });

    // Add a demo contact to Gym
    await Contact.create({
      workspaceId: wsGym._id,
      ownerId: userGym._id,
      fullName: 'Demo Gym Member',
      phoneNumber: '+919911223345',
      whatsappConsentStatus: 'Opted In',
      isDemo: true,
    });

    // Reset Gym demo records
    await workspaceMockService.resetWorkspaceDemoData({
      workspace: wsGym,
      user: userGym,
    });

    // Genuine contact must survive
    const survived = await Contact.findById(genuineGymContact._id);
    assert.ok(survived, 'Genuine contact must survive demo reset');
    assert.equal(survived.fullName, 'Real Gym Member');

    // Demo contact must be deleted
    const deleted = await Contact.findOne({ workspaceId: wsGym._id, isDemo: true });
    assert.equal(deleted, null, 'Demo contact must be cleaned up');
  });
});
