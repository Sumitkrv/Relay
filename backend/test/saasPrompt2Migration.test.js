import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import jwt from 'jsonwebtoken';
import request from 'supertest';

import app from '../src/app.js';
import User from '../src/models/User.js';
import Workspace from '../src/models/Workspace.js';
import WorkspaceMembership from '../src/models/WorkspaceMembership.js';
import BusinessProfile from '../src/models/BusinessProfile.js';
import Contact from '../src/models/Contact.js';
import ConsentRecord from '../src/models/ConsentRecord.js';
import MessageTemplate, { TemplateVersion } from '../src/models/MessageTemplate.js';
import Campaign from '../src/models/Campaign.js';
import Message from '../src/models/Message.js';
import Conversation from '../src/models/Conversation.js';
import CampaignMessageJob from '../src/models/CampaignMessageJob.js';
import MigrationCheckpoint from '../src/models/MigrationCheckpoint.js';

import {
  resolveM2WOwner,
  getOrCreateM2WWorkspace,
  getOrCreateM2WMembership,
  validateParentChildRelationships,
  runM2WMigration,
  rollbackM2WMigration,
  verifyM2WMigration,
} from '../src/services/m2wMigrationService.js';
import { createDatabaseBackup, verifyDatabaseBackup } from '../src/services/databaseBackupService.js';
import messagingProviderRegistry from '../src/services/messagingProviderRegistry.js';

let mongod;
let ownerA; // M2W owner
let ownerB; // Independent Tenant owner
let tokenA;
let tokenB;

describe('SAAS PROMPT 2 — Comprehensive M2W Migration & Zero-Data-Loss Test Suite', () => {
  before(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-chars-long';

    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);

    // 1. Create M2W Legacy Owner (User A)
    ownerA = await User.create({
      name: 'Sumit R. Thakur',
      email: 'm2w_owner@example.com',
      passwordHash: '$2a$12$fakePasswordHashForTestingOnly1234567890',
      role: 'owner',
      businessName: 'M2W Luxury Realty',
      authVersion: 1,
    });

    // 2. Create M2W Business Profile
    await BusinessProfile.create({
      ownerId: ownerA._id,
      displayName: 'M2W Luxury Realty',
      legalOrTradingName: 'M2W Luxury Realty Pvt Ltd',
      businessCategory: 'Real Estate',
      city: 'Gurugram',
      country: 'India',
      email: 'contact@m2wrealty.example',
      phone: '+919810123456',
    });

    // 3. Create Second Independent Owner (User B - Gym Owner)
    ownerB = await User.create({
      name: 'Gym Operator',
      email: 'gym_owner@example.com',
      passwordHash: '$2a$12$fakePasswordHashForTestingOnly1234567890',
      role: 'owner',
      businessName: 'Iron Fitness Club',
      authVersion: 1,
    });

    // Generate JWT tokens
    tokenA = jwt.sign({ sub: ownerA._id, ver: 1 }, process.env.JWT_SECRET, { expiresIn: '1h' });
    tokenB = jwt.sign({ sub: ownerB._id, ver: 1 }, process.env.JWT_SECRET, { expiresIn: '1h' });

    // 4. Seed Legacy M2W Records (without workspaceId)
    const contactA = await Contact.create({
      ownerId: ownerA._id,
      fullName: 'VIP Buyer One',
      phoneNumber: '+919810000001',
      tags: ['luxury-buyer'],
    });

    await ConsentRecord.create({
      ownerId: ownerA._id,
      contactId: contactA._id,
      status: 'Opted In',
      consentPurpose: 'Property alerts & brochures',
      consentSource: 'In-person site visit form',
      consentCapturedAt: new Date('2026-01-15T10:00:00Z'),
      recordedBy: ownerA._id,
    });

    const templateA = await MessageTemplate.create({
      ownerId: ownerA._id,
      name: 'Luxury Villa Brochure',
      category: 'Marketing',
    });

    await Campaign.create({
      ownerId: ownerA._id,
      name: 'M2W Weekend Showcase',
      status: 'Draft',
      selectedTemplateId: templateA._id,
      createdBy: ownerA._id,
    });

    await Message.create({
      ownerId: ownerA._id,
      messageId: 'mock_msg_m2w_001',
      contactId: contactA._id,
      recipientPhone: '+919810000001',
      content: 'Exclusive Golf Course Villa Preview',
      source: 'campaign',
      provider: 'none',
      status: 'SIMULATED_SENT',
    });

    await Conversation.create({
      ownerId: ownerA._id,
      contactId: contactA._id,
      status: 'Open',
    });

    // 5. Seed Legacy User B Records (Must NOT be touched during M2W migration)
    const contactB = await Contact.create({
      ownerId: ownerB._id,
      fullName: 'Gym Member John',
      phoneNumber: '+919820000002',
      tags: ['annual-pass'],
    });

    await ConsentRecord.create({
      ownerId: ownerB._id,
      contactId: contactB._id,
      status: 'Opted In',
      consentPurpose: 'Membership renewal notices',
      consentSource: 'Front desk paper sign-up',
      consentCapturedAt: new Date('2026-02-01T12:00:00Z'),
      recordedBy: ownerB._id,
    });
  });

  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  // 1. Authoritative Owner Resolution
  test('1. Authoritative Owner Resolution: resolves M2W owner dynamically via BusinessProfile', async () => {
    const resolution = await resolveM2WOwner();
    assert.equal(resolution.owner._id.toString(), ownerA._id.toString());
    assert.equal(resolution.source, 'AUTHORITATIVE_BUSINESS_PROFILE');
  });

  test('2. Owner Resolution: rejects non-existent explicit ownerId', async () => {
    await assert.rejects(
      async () => resolveM2WOwner({ ownerId: new mongoose.Types.ObjectId() }),
      /not found in database/
    );
  });

  // 2. Database Backup & Restore Verification
  test('3. Database Backup Service: creates and verifies durable database backup', async () => {
    const backup = await createDatabaseBackup();
    assert.ok(backup.backupFolder);
    assert.ok(backup.collectionCount > 0);
    assert.ok(backup.totalDocuments > 0);

    const verification = await verifyDatabaseBackup(backup.backupFolder);
    assert.equal(verification.verified, true);
    assert.equal(verification.collectionsVerified, backup.collectionCount);
    assert.equal(verification.documentsVerified, backup.totalDocuments);
  });

  // 3. Dry-Run Immutability
  test('4. Migration Dry-Run: plans migration with zero writes to database', async () => {
    const dryRunResult = await runM2WMigration({ mode: 'DRY_RUN', skipBackup: true });

    assert.equal(dryRunResult.mode, 'DRY_RUN');
    assert.ok(dryRunResult.totals.eligible > 0);
    assert.equal(dryRunResult.totals.migrated, 0); // 0 writes

    // Verify workspace does NOT exist yet in DB
    const wsInDb = await Workspace.findOne({ slug: 'm2w-realty' });
    assert.equal(wsInDb, null);

    // Verify documents still have no workspaceId
    const c = await Contact.findOne({ ownerId: ownerA._id });
    assert.equal(c.workspaceId, undefined);
  });

  // 4. Controlled Execution & Idempotent Workspace Creation
  test('5. Migration Execution: provisions authoritative M2W workspace and OWNER membership', async () => {
    const execResult = await runM2WMigration({ mode: 'EXECUTE', skipBackup: true });

    assert.equal(execResult.mode, 'EXECUTE');
    assert.equal(execResult.status, 'SUCCESS');
    assert.ok(execResult.totals.migrated > 0);

    // Verify Workspace exists in DB
    const ws = await Workspace.findOne({ slug: 'm2w-realty' });
    assert.ok(ws);
    assert.equal(ws.status, 'ACTIVE');
    assert.equal(ws.industryKey, 'real_estate');
    assert.equal(ws.createdBy.toString(), ownerA._id.toString());

    // Verify OWNER Membership exists
    const mem = await WorkspaceMembership.findOne({ workspaceId: ws._id, userId: ownerA._id });
    assert.ok(mem);
    assert.equal(mem.role, 'OWNER');
    assert.equal(mem.status, 'ACTIVE');

    // Verify Checkpoint was saved
    const cp = await MigrationCheckpoint.findOne({ migrationId: execResult.migrationId });
    assert.ok(cp);
    assert.equal(cp.status, 'COMPLETED');
    assert.equal(cp.totals.migrated, execResult.totals.migrated);
  });

  // 5. Backfill Integrity & Isolation
  test('6. Ownership Backfill: assigns workspaceId while strictly preserving original ownerId', async () => {
    const ws = await Workspace.findOne({ slug: 'm2w-realty' });

    // Verify Contact
    const contact = await Contact.findOne({ ownerId: ownerA._id });
    assert.ok(contact);
    assert.equal(contact.workspaceId.toString(), ws._id.toString());
    assert.equal(contact.ownerId.toString(), ownerA._id.toString());
    assert.equal(contact.fullName, 'VIP Buyer One');

    // Verify Template
    const template = await MessageTemplate.findOne({ ownerId: ownerA._id });
    assert.ok(template);
    assert.equal(template.workspaceId.toString(), ws._id.toString());
    assert.equal(template.ownerId.toString(), ownerA._id.toString());

    // Verify Campaign
    const campaign = await Campaign.findOne({ ownerId: ownerA._id });
    assert.ok(campaign);
    assert.equal(campaign.workspaceId.toString(), ws._id.toString());
    assert.equal(campaign.ownerId.toString(), ownerA._id.toString());

    // Verify Message
    const msg = await Message.findOne({ ownerId: ownerA._id });
    assert.ok(msg);
    assert.equal(msg.workspaceId.toString(), ws._id.toString());
    assert.equal(msg.ownerId.toString(), ownerA._id.toString());
  });

  // 6. Strict Tenant Isolation (User B documents untouched)
  test('7. Tenant Isolation: User B documents were NOT touched or migrated to M2W', async () => {
    const contactB = await Contact.findOne({ ownerId: ownerB._id });
    assert.ok(contactB);
    assert.equal(contactB.workspaceId, undefined);
    assert.equal(contactB.ownerId.toString(), ownerB._id.toString());

    const consentB = await ConsentRecord.findOne({ ownerId: ownerB._id });
    assert.ok(consentB);
    assert.equal(consentB.workspaceId, undefined);
  });

  // 7. Consent Immutability
  test('8. Consent Immutability: consent status, purpose, timestamp, evidence are preserved', async () => {
    const ws = await Workspace.findOne({ slug: 'm2w-realty' });
    const consent = await ConsentRecord.findOne({ ownerId: ownerA._id });
    assert.ok(consent);
    assert.equal(consent.workspaceId.toString(), ws._id.toString());
    assert.equal(consent.status, 'Opted In');
    assert.equal(consent.consentPurpose, 'Property alerts & brochures');
    assert.equal(consent.consentSource, 'In-person site visit form');
    assert.equal(consent.consentCapturedAt.toISOString(), '2026-01-15T10:00:00.000Z');
    assert.equal(consent.recordedBy.toString(), ownerA._id.toString());
  });

  // 8. Migration Idempotency (Second Execution)
  test('9. Migration Idempotency: second execution does not duplicate workspace or re-migrate records', async () => {
    const wsCountBefore = await Workspace.countDocuments({ slug: 'm2w-realty' });
    const memCountBefore = await WorkspaceMembership.countDocuments();

    const secondRun = await runM2WMigration({ mode: 'EXECUTE', skipBackup: true });

    assert.equal(secondRun.status, 'SUCCESS');
    assert.equal(secondRun.totals.migrated, 0); // 0 new records migrated
    assert.ok(secondRun.totals.alreadyMigrated > 0);

    const wsCountAfter = await Workspace.countDocuments({ slug: 'm2w-realty' });
    const memCountAfter = await WorkspaceMembership.countDocuments();

    assert.equal(wsCountAfter, wsCountBefore);
    assert.equal(memCountAfter, memCountBefore);
  });

  // 9. Post-Migration Verification Service
  test('10. Verification Service: confirms 100% migrated records and intact consent', async () => {
    const verification = await verifyM2WMigration({ ownerId: ownerA._id });
    assert.equal(verification.verified, true);
    assert.equal(verification.allMigrated, true);
    assert.equal(verification.consentValid, true);
  });

  // 10. Parent-Child Relationship Validation & Conflict Detection
  test('11. Parent-Child Consistency: flags cross-owner conflict and refuses invalid assignment', async () => {
    // Create conflicting job: owned by ownerA but pointing to contact of ownerB
    const contactB = await Contact.findOne({ ownerId: ownerB._id });
    const conflictJob = await CampaignMessageJob.create({
      ownerId: ownerA._id,
      campaignId: new mongoose.Types.ObjectId(),
      executionId: new mongoose.Types.ObjectId(),
      contactId: contactB._id, // cross-owner contact!
      status: 'queued',
    });

    const validation = await validateParentChildRelationships(ownerA._id, mongoose.connection.db);
    assert.ok(validation.conflicts.length > 0);
    assert.equal(validation.conflicts[0].collection, 'campaignmessagejobs');
    assert.equal(validation.conflicts[0].id.toString(), conflictJob._id.toString());

    // Clean up
    await CampaignMessageJob.deleteOne({ _id: conflictJob._id });
  });

  // 11. Cross-Tenant API Authorization & Security Isolation
  test('12. API Security: User B cannot access M2W Workspace via /api/workspaces/current (403)', async () => {
    const ws = await Workspace.findOne({ slug: 'm2w-realty' });

    // User B tries to use M2W workspace ID in x-workspace-id header
    const res = await request(app)
      .get('/api/workspaces/current')
      .set('Authorization', `Bearer ${tokenB}`)
      .set('x-workspace-id', ws._id.toString());

    assert.equal(res.status, 403);
    assert.equal(res.body.code, 'FORBIDDEN_WORKSPACE_ACCESS');
  });

  test('13. API Security: M2W Owner successfully accesses M2W Workspace context (200)', async () => {
    const ws = await Workspace.findOne({ slug: 'm2w-realty' });

    const res = await request(app)
      .get('/api/workspaces/current')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-workspace-id', ws._id.toString());

    assert.equal(res.status, 200);
    assert.equal(res.body.workspace.slug, 'm2w-realty');
    assert.equal(res.body.membership.role, 'OWNER');
  });

  // 12. Safety Guard: Disconnected WhatsApp Provider Protection
  test('14. Safety Guard: Meta WhatsApp Cloud API live mode remains strictly 403-blocked', async () => {
    assert.throws(
      () => messagingProviderRegistry.getProvider('LIVE'),
      /Live WhatsApp Cloud API is disabled/
    );
  });

  // 13. Contact Partial Unique Index Enforcement
  test('15. Index Compatibility: same phone number allowed across different workspaces', async () => {
    await Contact.syncIndexes();
    const wsA = await Workspace.findOne({ slug: 'm2w-realty' });

    // Create a new workspace for User B
    const wsB = await Workspace.create({
      name: 'Iron Fitness',
      slug: 'iron-fitness',
      industryKey: 'gym',
      businessEmail: 'gym@example.com',
      businessPhone: '+919899000000',
      createdBy: ownerB._id,
    });

    // Create contact in Workspace B with the same phone number as contact in Workspace A
    const contactSamePhone = await Contact.create({
      ownerId: ownerB._id,
      workspaceId: wsB._id,
      fullName: 'VIP Buyer One in Gym',
      phoneNumber: '+919810000001', // Identical to Contact in Workspace A
    });

    assert.ok(contactSamePhone);
    assert.equal(contactSamePhone.phoneNumber, '+919810000001');

    // But duplicate phone WITHIN the same workspace must be rejected by partial index
    await assert.rejects(
      async () =>
        Contact.create({
          ownerId: ownerA._id,
          workspaceId: wsA._id,
          fullName: 'Duplicate in same workspace',
          phoneNumber: '+919810000001',
        }),
      /duplicate key error/
    );
  });

  // 14. Verifiable Rollback
  test('16. Rollback: successfully unsets workspaceId on all migrated documents', async () => {
    const ws = await Workspace.findOne({ slug: 'm2w-realty' });

    const rbResult = await rollbackM2WMigration({
      ownerId: ownerA._id,
    });

    assert.equal(rbResult.status, 'ROLLED_BACK');
    assert.ok(rbResult.totalRecordsReverted > 0);

    // Verify Contact no longer has workspaceId
    const c = await Contact.findOne({ ownerId: ownerA._id });
    assert.equal(c.workspaceId, undefined);
    assert.equal(c.ownerId.toString(), ownerA._id.toString()); // ownerId preserved!

    // Verify Campaign no longer has workspaceId
    const camp = await Campaign.findOne({ ownerId: ownerA._id });
    assert.equal(camp.workspaceId, undefined);

    // Verify Checkpoint updated
    const cp = await MigrationCheckpoint.findOne({ migrationId: rbResult.migrationId });
    assert.equal(cp.status, 'ROLLED_BACK');
    assert.equal(cp.rollbackStatus, 'COMPLETED');
  });

  // 15. Re-Execution after Rollback
  test('17. Re-Execution after Rollback: re-migrates records cleanly and idempotently', async () => {
    const reMigrateResult = await runM2WMigration({ mode: 'EXECUTE', skipBackup: true });
    assert.equal(reMigrateResult.status, 'SUCCESS');
    assert.ok(reMigrateResult.totals.migrated > 0);

    const c = await Contact.findOne({ ownerId: ownerA._id });
    assert.ok(c.workspaceId);
  });
});
