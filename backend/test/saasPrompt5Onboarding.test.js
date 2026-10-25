import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Workspace from '../src/models/Workspace.js';
import WorkspaceMembership from '../src/models/WorkspaceMembership.js';
import BusinessProfile from '../src/models/BusinessProfile.js';
import OnboardingDraft from '../src/models/OnboardingDraft.js';
import Contact from '../src/models/Contact.js';
import Campaign from '../src/models/Campaign.js';
import ConsentRecord from '../src/models/ConsentRecord.js';
import { LOGOS_DIR } from '../src/services/workspaceProvisioningService.js';
import { MongoMemoryServer } from 'mongodb-memory-server';

describe('SaaS Prompt 5 — Complete Business Onboarding & Workspace Provisioning Test Suite', () => {
  const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-relay-crm-development-only-minimum-32-chars-long';
  let mongod;

  let m2wOwnerUser;
  let m2wWorkspace;
  let m2wToken;

  let verifiedUser;
  let verifiedToken;

  let unverifiedUser;
  let unverifiedToken;

  let otherVerifiedUser;
  let otherVerifiedToken;

  function makeToken(user) {
    return jwt.sign(
      { sub: user._id.toString(), id: user._id.toString(), ver: user.authVersion || 1 },
      JWT_SECRET,
      { expiresIn: '1d' }
    );
  }

  // Sample valid PNG (1x1 transparent PNG)
  const validPngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );

  // Spoofed image: declared as PNG but contains plain text
  const spoofedBuffer = Buffer.from('NOT_AN_IMAGE_THIS_IS_PLAIN_TEXT_PAYLOAD');

  before(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = JWT_SECRET;

    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());

    // 1. Establish Legacy M2W Realty Owner & Workspace
    m2wOwnerUser = await User.findOne({ email: 'm2w_prompt5_owner@test.io' });
    if (!m2wOwnerUser) {
      m2wOwnerUser = await User.create({
        name: 'M2W Realty Owner',
        email: 'm2w_prompt5_owner@test.io',
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890123456789012345678',
        accountStatus: 'ACTIVE',
        emailVerifiedAt: new Date(),
        authVersion: 1,
      });
    }

    m2wWorkspace = await Workspace.findOne({ slug: 'm2w-realty-prompt5' });
    if (!m2wWorkspace) {
      m2wWorkspace = await Workspace.create({
        name: 'M2W Realty',
        slug: 'm2w-realty-prompt5',
        industryKey: 'real_estate',
        businessEmail: 'm2w_prompt5_owner@test.io',
        businessPhone: '+919811223344',
        country: 'India',
        city: 'Gurugram',
        timezone: 'Asia/Kolkata',
        status: 'ACTIVE',
        onboardingStatus: 'COMPLETED',
        createdBy: m2wOwnerUser._id,
      });

      await WorkspaceMembership.create({
        workspaceId: m2wWorkspace._id,
        userId: m2wOwnerUser._id,
        role: 'OWNER',
        status: 'ACTIVE',
        isDefaultWorkspace: true,
      });

      // Create an isolated M2W contact to test cross-tenant protection
      await Contact.create({
        workspaceId: m2wWorkspace._id,
        ownerId: m2wOwnerUser._id,
        fullName: 'Secret M2W Buyer',
        phoneNumber: '+919800099999',
        leadStatus: 'New',
      });
    }

    m2wToken = makeToken(m2wOwnerUser);

    // 2. Establish Verified New Customer (No Workspace yet)
    verifiedUser = await User.create({
      name: 'Gym Owner Alice',
      email: 'alice_gym_p5@test.io',
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890123456789012345678',
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      authVersion: 1,
    });
    verifiedToken = makeToken(verifiedUser);

    // 3. Establish Unverified Customer
    unverifiedUser = await User.create({
      name: 'Unverified Bob',
      email: 'bob_unverified_p5@test.io',
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890123456789012345678',
      accountStatus: 'PENDING_EMAIL_VERIFICATION',
      isEmailVerified: false,
      emailVerifiedAt: null,
      authVersion: 1,
    });
    unverifiedToken = makeToken(unverifiedUser);

    // 4. Establish Second Verified Customer for isolation testing
    otherVerifiedUser = await User.create({
      name: 'Clinic Owner Carol',
      email: 'carol_clinic_p5@test.io',
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890123456789012345678',
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      authVersion: 1,
    });
    otherVerifiedToken = makeToken(otherVerifiedUser);
  });

  after(async () => {
    await mongoose.disconnect();
    if (mongod) {
      await mongod.stop();
    }
  });

  // =========================================================================
  // GROUP 1: Access Controls & Eligibility
  // =========================================================================
  describe('Group 1: Access Controls & Eligibility', () => {
    test('1. Unauthenticated onboarding request blocked (401)', async () => {
      const res = await request(app).get('/api/onboarding/status');
      assert.equal(res.status, 401);
    });

    test('2. Unverified account blocked from starting onboarding (403 EMAIL_VERIFICATION_REQUIRED)', async () => {
      const res = await request(app)
        .get('/api/onboarding/status')
        .set('Authorization', `Bearer ${unverifiedToken}`);

      assert.equal(res.status, 403);
      assert.equal(res.body.code, 'EMAIL_VERIFICATION_REQUIRED');
    });

    test('3. Verified account allowed to access onboarding status (200)', async () => {
      const res = await request(app)
        .get('/api/onboarding/status')
        .set('Authorization', `Bearer ${verifiedToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.hasWorkspace, false);
      assert.equal(res.body.currentStep, 1);
    });

    test('4. Existing M2W owner shows hasWorkspace: true on status', async () => {
      const res = await request(app)
        .get('/api/onboarding/status')
        .set('Authorization', `Bearer ${m2wToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.hasWorkspace, true);
      assert.equal(res.body.workspace.slug, 'm2w-realty-prompt5');
    });
  });

  // =========================================================================
  // GROUP 2: Draft Persistence & Validation
  // =========================================================================
  describe('Group 2: Draft Persistence & Validation', () => {
    test('5. Draft created automatically if not existing (GET /api/onboarding/draft)', async () => {
      const res = await request(app)
        .get('/api/onboarding/draft')
        .set('Authorization', `Bearer ${verifiedToken}`);

      assert.equal(res.status, 200);
      assert.ok(res.body.draft);
      assert.equal(res.body.draft.businessIdentity.email, verifiedUser.email);
    });

    test('6. Draft saved and updated via PUT /api/onboarding/draft', async () => {
      const res = await request(app)
        .put('/api/onboarding/draft')
        .set('Authorization', `Bearer ${verifiedToken}`)
        .send({
          step: 2,
          businessIdentity: {
            name: 'FitZone Gym',
            phone: '+919811223344',
            website: 'https://fitzone.io',
            description: 'Premier fitness and CrossFit center.',
          },
          industryKey: 'gym',
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.draft.businessIdentity.name, 'FitZone Gym');
      assert.equal(res.body.draft.industryKey, 'gym');
      assert.equal(res.body.draft.step, 2);
    });

    test('7. Draft resumed on subsequent GET /api/onboarding/draft', async () => {
      const res = await request(app)
        .get('/api/onboarding/draft')
        .set('Authorization', `Bearer ${verifiedToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.draft.businessIdentity.name, 'FitZone Gym');
      assert.equal(res.body.draft.industryKey, 'gym');
      assert.equal(res.body.draft.step, 2);
    });

    test('8. Draft owned by correct user (cannot read another user draft)', async () => {
      const res = await request(app)
        .get('/api/onboarding/draft')
        .set('Authorization', `Bearer ${otherVerifiedToken}`);

      assert.equal(res.status, 200);
      // Other user draft has their own email, not FitZone Gym
      assert.notEqual(res.body.draft.businessIdentity.name, 'FitZone Gym');
      assert.equal(res.body.draft.businessIdentity.email, otherVerifiedUser.email);
    });

    test('9. Invalid industry key rejected (400 INVALID_INDUSTRY)', async () => {
      const res = await request(app)
        .put('/api/onboarding/draft')
        .set('Authorization', `Bearer ${verifiedToken}`)
        .send({ industryKey: 'invalid_crypto_casino' });

      assert.equal(res.status, 400);
      assert.equal(res.body.code, 'INVALID_INDUSTRY');
    });

    test('10. Valid industry keys accepted (all 7 verticals)', async () => {
      const valid = ['real_estate', 'gym', 'clinic', 'education', 'salon', 'automobile', 'other'];
      for (const k of valid) {
        const res = await request(app)
          .put('/api/onboarding/draft')
          .set('Authorization', `Bearer ${verifiedToken}`)
          .send({ industryKey: k });
        assert.equal(res.status, 200);
        assert.equal(res.body.draft.industryKey, k);
      }
    });

    test('11. Invalid metadata rejected (prototype pollution and $ operators stripped)', async () => {
      const res = await request(app)
        .put('/api/onboarding/draft')
        .set('Authorization', `Bearer ${verifiedToken}`)
        .send({
          businessDetails: {
            city: 'Bengaluru',
            industryMetadata: {
              safeField: 'Strength Training',
              $where: 'function() { return true; }',
              __proto__: { polluted: true },
            },
          },
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.draft.businessDetails.industryMetadata.safeField, 'Strength Training');
      assert.equal(res.body.draft.businessDetails.industryMetadata.$where, undefined);
      assert.equal({}.polluted, undefined);
    });

    test('12. Timezone validated (valid IANA timezone accepted, invalid rejected)', async () => {
      // Valid IANA
      const validRes = await request(app)
        .put('/api/onboarding/draft')
        .set('Authorization', `Bearer ${verifiedToken}`)
        .send({ businessDetails: { timezone: 'Asia/Kolkata' } });
      assert.equal(validRes.status, 200);

      // Invalid
      const invalidRes = await request(app)
        .put('/api/onboarding/draft')
        .set('Authorization', `Bearer ${verifiedToken}`)
        .send({ businessDetails: { timezone: 'Mars/Curiosity_Rover' } });
      assert.equal(invalidRes.status, 400);
      assert.equal(invalidRes.body.code, 'INVALID_TIMEZONE');
    });
  });

  // =========================================================================
  // GROUP 3: Logo Upload Security
  // =========================================================================
  describe('Group 3: Logo Upload Security', () => {
    test('13. Valid PNG logo upload accepted (200)', async () => {
      const res = await request(app)
        .post('/api/onboarding/logo')
        .set('Authorization', `Bearer ${verifiedToken}`)
        .attach('logo', validPngBuffer, 'brand_logo.png');

      assert.equal(res.status, 200);
      assert.ok(res.body.logoUrl);
      assert.ok(res.body.filename);
      assert.equal(res.body.mimeType, 'image/png');
    });

    test('14. Spoofed image rejected (magic bytes content mismatch: 400)', async () => {
      const res = await request(app)
        .post('/api/onboarding/logo')
        .set('Authorization', `Bearer ${verifiedToken}`)
        .attach('logo', spoofedBuffer, 'spoofed.png');

      assert.equal(res.status, 400);
      assert.equal(res.body.code, 'SPOOFED_FILE_CONTENT');
    });

    test('15. Oversized logo rejected (> 2 MB: 413)', async () => {
      const hugeBuffer = Buffer.alloc(2.5 * 1024 * 1024); // 2.5 MB
      const res = await request(app)
        .post('/api/onboarding/logo')
        .set('Authorization', `Bearer ${verifiedToken}`)
        .attach('logo', hugeBuffer, 'huge.png');

      assert.ok(res.status === 413 || res.status === 400);
    });

    test('16. Logo replaced cleanly with fresh upload', async () => {
      const res = await request(app)
        .post('/api/onboarding/logo')
        .set('Authorization', `Bearer ${verifiedToken}`)
        .attach('logo', validPngBuffer, 'updated_logo.png');

      assert.equal(res.status, 200);
      assert.ok(res.body.logoUrl);
    });

    test('17. Safe logo serving (GET /api/onboarding/logo/:filename) with nosniff header', async () => {
      const draftRes = await request(app)
        .get('/api/onboarding/draft')
        .set('Authorization', `Bearer ${verifiedToken}`);

      const filename = draftRes.body.draft.branding.logoFilename;
      assert.ok(filename);

      const serveRes = await request(app).get(`/api/onboarding/logo/${filename}`);
      assert.equal(serveRes.status, 200);
      assert.equal(serveRes.headers['x-content-type-options'], 'nosniff');
      assert.equal(serveRes.headers['content-type'], 'image/png');
    });

    test('18. Path traversal attempt in logo filename rejected (400)', async () => {
      const res = await request(app).get('/api/onboarding/logo/%2e%2e%2f%2e%2e%2fetc%2fpasswd');
      assert.ok(res.status === 400 || res.status === 404);
    });

    test('19. Logo deletion (DELETE /api/onboarding/logo) clears branding', async () => {
      const res = await request(app)
        .delete('/api/onboarding/logo')
        .set('Authorization', `Bearer ${verifiedToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.draft.branding.logoUrl, '');
      assert.equal(res.body.draft.branding.logoFilename, '');
    });
  });

  // =========================================================================
  // GROUP 4: Automatic Workspace Provisioning & Idempotency
  // =========================================================================
  describe('Group 4: Automatic Workspace Provisioning & Idempotency', () => {
    test('20. Provisioning fails if business name is missing or too short', async () => {
      // Clear name
      await request(app)
        .put('/api/onboarding/draft')
        .set('Authorization', `Bearer ${verifiedToken}`)
        .send({ businessIdentity: { name: 'A' } });

      const res = await request(app)
        .post('/api/onboarding/complete')
        .set('Authorization', `Bearer ${verifiedToken}`);

      assert.equal(res.status, 400);
      assert.equal(res.body.code, 'INVALID_BUSINESS_NAME');
    });

    test('21. Valid provisioning creates Workspace, OWNER Membership and BusinessProfile', async () => {
      // Set valid draft
      await request(app)
        .put('/api/onboarding/draft')
        .set('Authorization', `Bearer ${verifiedToken}`)
        .send({
          businessIdentity: {
            name: 'FitZone Athletics',
            email: 'contact@fitzoneathletics.com',
            phone: '+919811223344',
            website: 'https://fitzoneathletics.com',
            description: 'Leading fitness club.',
          },
          industryKey: 'gym',
          businessDetails: {
            city: 'Bengaluru',
            state: 'Karnataka',
            country: 'India',
            timezone: 'Asia/Kolkata',
            industryMetadata: {
              gymType: 'CrossFit Studio',
            },
          },
        });

      const res = await request(app)
        .post('/api/onboarding/complete')
        .set('Authorization', `Bearer ${verifiedToken}`);

      assert.equal(res.status, 201);
      assert.ok(res.body.workspace);
      assert.equal(res.body.workspace.name, 'FitZone Athletics');
      assert.equal(res.body.workspace.industryKey, 'gym');
      assert.equal(res.body.workspace.status, 'ACTIVE');

      assert.ok(res.body.membership);
      assert.equal(res.body.membership.role, 'OWNER');
      assert.equal(res.body.membership.status, 'ACTIVE');

      assert.ok(res.body.businessProfile);
      assert.equal(res.body.businessProfile.legalOrTradingName, 'FitZone Athletics');
      assert.equal(res.body.businessProfile.businessCategory, 'gym');
    });

    test('22. Zero fabricated records in new workspace (zero contacts, campaigns, consent)', async () => {
      const ws = await Workspace.findOne({ name: 'FitZone Athletics' });
      assert.ok(ws);

      const contactCount = await Contact.countDocuments({ workspaceId: ws._id });
      const campaignCount = await Campaign.countDocuments({ workspaceId: ws._id });
      const consentCount = await ConsentRecord.countDocuments({ workspaceId: ws._id });

      assert.equal(contactCount, 0, 'New workspace must have 0 fabricated contacts');
      // Master Prompt 14: the only campaigns are the 2 provisioned industry starter Drafts
      // (unscheduled, unexecuted, no recipients) — never fabricated activity.
      assert.equal(campaignCount, 2, 'New workspace has exactly the 2 starter draft campaigns');
      const drafts = await Campaign.find({ workspaceId: ws._id }).lean();
      assert.ok(drafts.every((c) => c.status === 'Draft' && c.starterPresetKey && !c.activeExecutionId && !c.mockSchedule));
      assert.equal(consentCount, 0, 'New workspace must have 0 fabricated consent records');
    });

    test('23. Repeat provisioning is idempotent (returns 200 and existing workspace)', async () => {
      const res = await request(app)
        .post('/api/onboarding/complete')
        .set('Authorization', `Bearer ${verifiedToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.message, 'Existing business workspace matched.');
      assert.equal(res.body.workspace.name, 'FitZone Athletics');
      assert.equal(res.body.membership.role, 'OWNER');
    });

    test('24. Status endpoint reflects completed onboarding state', async () => {
      const res = await request(app)
        .get('/api/onboarding/status')
        .set('Authorization', `Bearer ${verifiedToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.hasWorkspace, true);
      assert.equal(res.body.workspace.name, 'FitZone Athletics');
      assert.equal(res.body.membership.role, 'OWNER');
    });

    test('25. Slug collision handled cleanly (appends unique suffix)', async () => {
      // Set other user with identical business name
      await request(app)
        .put('/api/onboarding/draft')
        .set('Authorization', `Bearer ${otherVerifiedToken}`)
        .send({
          businessIdentity: {
            name: 'FitZone Athletics', // Same name!
            email: 'carol@fitzone.com',
            phone: '+919877665544',
          },
          industryKey: 'gym',
        });

      const res = await request(app)
        .post('/api/onboarding/complete')
        .set('Authorization', `Bearer ${otherVerifiedToken}`);

      assert.equal(res.status, 201);
      assert.equal(res.body.workspace.name, 'FitZone Athletics');
      // Slug should be suffixed and distinct
      assert.notEqual(res.body.workspace.slug, 'fitzone-athletics');
      assert.ok(res.body.workspace.slug.startsWith('fitzone-athletics-'));
    });
  });

  // =========================================================================
  // GROUP 5: Tenant Isolation & Adversarial Security
  // =========================================================================
  describe('Group 5: Tenant Isolation & Adversarial Security', () => {
    test('26. New workspace cannot access M2W workspace via forged x-workspace-id (403)', async () => {
      const res = await request(app)
        .get('/api/workspaces/current')
        .set('Authorization', `Bearer ${verifiedToken}`)
        .set('x-workspace-id', m2wWorkspace._id.toString());

      assert.equal(res.status, 403);
    });

    test('27. New workspace cannot access M2W contacts even if querying directly', async () => {
      const res = await request(app)
        .get('/api/contacts')
        .set('Authorization', `Bearer ${verifiedToken}`)
        .set('x-workspace-id', m2wWorkspace._id.toString());

      assert.equal(res.status, 403);
      const records = res.body.records || res.body.contacts || [];
      assert.equal(records.length, 0, 'New user must receive 0 contacts');
      assert.ok(!JSON.stringify(res.body).includes('Secret M2W Buyer'), 'M2W contacts must never be leaked');
    });

    test('28. Forged role injection in complete request ignored (server enforces OWNER)', async () => {
      const res = await request(app)
        .post('/api/onboarding/complete')
        .set('Authorization', `Bearer ${verifiedToken}`)
        .send({ role: 'SUPER_ADMIN', membershipRole: 'PLATFORM_SUPERUSER' });

      assert.equal(res.body.membership.role, 'OWNER');
    });

    test('29. M2W owner retains full dashboard and workspace access', async () => {
      const res = await request(app)
        .get('/api/workspaces/current')
        .set('Authorization', `Bearer ${m2wToken}`)
        .set('x-workspace-id', m2wWorkspace._id.toString());

      assert.equal(res.status, 200);
      assert.equal(res.body.workspace.slug, 'm2w-realty-prompt5');
    });

    test('30. Real Meta WhatsApp sending remains strictly 403-blocked', async () => {
      const providerRegistry = (await import('../src/services/messagingProviderRegistry.js')).default;
      const mockWhatsAppProvider = (await import('../src/services/mockWhatsAppProvider.js')).default;

      assert.throws(
        () => providerRegistry.getProvider('LIVE'),
        (err) => err.status === 403 && (err.code === 'LIVE_MODE_DISABLED' || err.code === 'PROD_FORBIDDEN')
      );

      const result = await mockWhatsAppProvider.sendMessage({
        mode: 'LIVE',
        to: '+919999999999',
        text: 'Live probe',
      });
      assert.equal(result.failureCode, 'LIVE_SENDING_FORBIDDEN');
    });
  });
});
