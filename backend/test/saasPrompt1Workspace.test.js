import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';

import app from '../src/app.js';
import User from '../src/models/User.js';
import Workspace, { VALID_INDUSTRIES, WORKSPACE_STATUSES } from '../src/models/Workspace.js';
import WorkspaceMembership from '../src/models/WorkspaceMembership.js';
import Contact from '../src/models/Contact.js';
import MessageTemplate from '../src/models/MessageTemplate.js';
import Campaign from '../src/models/Campaign.js';
import ConsentRecord from '../src/models/ConsentRecord.js';
import messagingProviderRegistry from '../src/services/messagingProviderRegistry.js';
import {
  toObjectId,
  buildWorkspaceScope,
  assertWorkspaceMembership,
  assertResourceWorkspaceOwnership,
  provisionWorkspaceInternal,
  WorkspaceAuthorizationError,
} from '../src/services/workspaceContextService.js';

process.env.JWT_SECRET = 'prompt1-test-secret-value-32-chars-long-relay-saas';

let mongo;
let userA;
let userB;
let legacyOwner;
let tokenA;
let tokenB;
let legacyToken;
let workspaceA;
let workspaceB;
let membershipA;
let membershipB;

const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());

  await Workspace.syncIndexes();
  await WorkspaceMembership.syncIndexes();
  await Contact.syncIndexes();

  const passwordHash = await bcrypt.hash('SecurePassword123!', 10);

  // 1. Create User A (Tenant A Owner)
  userA = await User.create({
    name: 'Alice Owner',
    email: 'alice@tenant-a.example',
    passwordHash,
    role: 'owner',
    authVersion: 1,
  });
  tokenA = jwt.sign({ sub: String(userA._id), ver: 1 }, process.env.JWT_SECRET, { expiresIn: '1h' });

  // 2. Create User B (Tenant B Owner)
  userB = await User.create({
    name: 'Bob Owner',
    email: 'bob@tenant-b.example',
    passwordHash,
    role: 'owner',
    authVersion: 1,
  });
  tokenB = jwt.sign({ sub: String(userB._id), ver: 1 }, process.env.JWT_SECRET, { expiresIn: '1h' });

  // 3. Create Legacy M2W Owner (Pre-migration reference, no workspace yet)
  legacyOwner = await User.create({
    name: 'M2W Single Operator',
    email: 'm2w@luxuryrealty.example',
    passwordHash,
    role: 'owner',
    businessName: 'M2W Luxury Realty',
    authVersion: 1,
  });
  legacyToken = jwt.sign({ sub: String(legacyOwner._id), ver: 1 }, process.env.JWT_SECRET, { expiresIn: '1h' });

  // 4. Seed legacy M2W records with ownerId only (simulating pre-migration state)
  const legacyContact = await Contact.create({
    ownerId: legacyOwner._id,
    fullName: 'Legacy M2W Buyer',
    phoneNumber: '+919811001122',
    interestedProject: 'Prestige Park',
    whatsappConsentStatus: 'Opted In',
  });

  await ConsentRecord.create({
    ownerId: legacyOwner._id,
    contactId: legacyContact._id,
    status: 'Opted In',
    consentPurpose: 'Property updates and project brochures',
    consentSource: 'web_form',
    evidenceReference: 'https://m2wrealty.example/optin/1234',
    consentCapturedAt: new Date(),
    recordedBy: legacyOwner._id,
  });

  await MessageTemplate.create({
    ownerId: legacyOwner._id,
    name: 'Legacy M2W Brochure Template',
    body: 'Hi {{name}}, here is your brochure.',
  });

  // 5. Provision Workspace A for User A
  const provA = await provisionWorkspaceInternal({
    ownerId: userA._id,
    name: 'FitZone Gym',
    slug: 'fitzone-gym',
    industryKey: 'gym',
    businessEmail: 'contact@fitzone.example',
    businessPhone: '+919811223344',
    city: 'Mumbai',
  });
  workspaceA = provA.workspace;
  membershipA = provA.membership;

  // 6. Provision Workspace B for User B
  const provB = await provisionWorkspaceInternal({
    ownerId: userB._id,
    name: 'CarePlus Health',
    slug: 'careplus-health',
    industryKey: 'clinic',
    businessEmail: 'support@careplus.example',
    businessPhone: '+919877665544',
    city: 'Bengaluru',
  });
  workspaceB = provB.workspace;
  membershipB = provB.membership;
});

after(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

// =========================================================================
// SECTION 1: WORKSPACE MODEL TESTS (Section 36)
// =========================================================================

test('1. Workspace Model: successfully creates valid workspace with required fields', async () => {
  const ws = await Workspace.create({
    name: 'Elite Auto Dealers',
    slug: 'elite-auto-dealers',
    industryKey: 'automobile',
    businessEmail: 'sales@eliteauto.example',
    businessPhone: '+919812345678',
    country: 'India',
    city: 'Delhi',
    timezone: 'Asia/Kolkata',
    currency: 'INR',
    createdBy: userA._id,
  });

  assert.equal(ws.name, 'Elite Auto Dealers');
  assert.equal(ws.slug, 'elite-auto-dealers');
  assert.equal(ws.industryKey, 'automobile');
  assert.equal(ws.status, 'ACTIVE');
  assert.ok(ws.createdAt instanceof Date);
  assert.ok(ws.updatedAt instanceof Date);
});

test('2. Workspace Model: rejects missing required name', async () => {
  await assert.rejects(
    async () => {
      await Workspace.create({
        slug: 'noname-ws',
        industryKey: 'gym',
        businessEmail: 'test@example.com',
        businessPhone: '+919812345678',
        createdBy: userA._id,
      });
    },
    /Workspace name is required/i
  );
});

test('3. Workspace Model: rejects invalid industryKey', async () => {
  await assert.rejects(
    async () => {
      await Workspace.create({
        name: 'Invalid Industry Corp',
        slug: 'invalid-industry-corp',
        industryKey: 'crypto_mining', // Not in VALID_INDUSTRIES
        businessEmail: 'crypto@example.com',
        businessPhone: '+919812345678',
        createdBy: userA._id,
      });
    },
    /Invalid industry key/i
  );
});

test('4. Workspace Model: normalizes slug by lowercasing, trimming, and replacing non-alphanumerics', async () => {
  const ws = await Workspace.create({
    name: 'Glow & Glam Salon !!',
    slug: '  Glow & Glam Salon 2026 !!  ',
    industryKey: 'salon',
    businessEmail: 'info@glowglam.example',
    businessPhone: '+919812345678',
    createdBy: userA._id,
  });

  assert.equal(ws.slug, 'glow-glam-salon-2026');
});

test('5. Workspace Model: rejects duplicate slug (unique index enforcement)', async () => {
  await assert.rejects(
    async () => {
      await Workspace.create({
        name: 'Duplicate FitZone',
        slug: 'fitzone-gym', // Already created in before()
        industryKey: 'gym',
        businessEmail: 'dup@example.com',
        businessPhone: '+919812345678',
        createdBy: userB._id,
      });
    },
    (err) => err.code === 11000 || /duplicate/i.test(err.message)
  );
});

test('6. Workspace Model: validates valid IANA timezone and rejects invalid timezone', async () => {
  // Valid
  const validWs = await Workspace.create({
    name: 'NYC Branch',
    slug: 'nyc-branch-edu',
    industryKey: 'education',
    businessEmail: 'nyc@edu.example',
    businessPhone: '+12125551234',
    timezone: 'America/New_York',
    createdBy: userA._id,
  });
  assert.equal(validWs.timezone, 'America/New_York');

  // Invalid
  await assert.rejects(
    async () => {
      await Workspace.create({
        name: 'Bad Timezone WS',
        slug: 'bad-tz-ws',
        industryKey: 'education',
        businessEmail: 'bad@edu.example',
        businessPhone: '+919812345678',
        timezone: 'Mars/Phobos_Station',
        createdBy: userA._id,
      });
    },
    /Invalid IANA timezone/i
  );
});

test('7. Workspace Model: rejects invalid status value', async () => {
  await assert.rejects(
    async () => {
      await Workspace.create({
        name: 'Bad Status WS',
        slug: 'bad-status-ws',
        industryKey: 'other',
        businessEmail: 'bad@ws.example',
        businessPhone: '+919812345678',
        status: 'DELETED_PERMANENTLY_NOW',
        createdBy: userA._id,
      });
    },
    /Invalid workspace status/i
  );
});

test('8. Workspace Model: persists custom settings and preserves timestamps', async () => {
  const ws = await Workspace.create({
    name: 'Settings Test WS',
    slug: 'settings-test-ws',
    industryKey: 'other',
    businessEmail: 'settings@test.example',
    businessPhone: '+919812345678',
    settings: {
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00',
      customWelcomeMessage: 'Welcome to our workspace!',
    },
    createdBy: userA._id,
  });

  assert.equal(ws.settings.quietHoursStart, '22:00');
  assert.equal(ws.settings.customWelcomeMessage, 'Welcome to our workspace!');
  assert.ok(ws.createdAt instanceof Date);
  assert.ok(ws.updatedAt instanceof Date);
});

test('9. Workspace Model: rejects unsupported extra fields (strict: "throw")', async () => {
  await assert.rejects(
    async () => {
      await Workspace.create({
        name: 'Strict Test WS',
        slug: 'strict-test-ws',
        industryKey: 'other',
        businessEmail: 'strict@test.example',
        businessPhone: '+919812345678',
        createdBy: userA._id,
        unsupportedBackdoorField: 'malicious-payload',
      });
    },
    /Field `unsupportedBackdoorField` is not in schema/i
  );
});

// =========================================================================
// SECTION 2: WORKSPACE MEMBERSHIP TESTS (Section 37)
// =========================================================================

test('10. Membership Model: successfully creates OWNER membership', async () => {
  const mem = await WorkspaceMembership.create({
    workspaceId: workspaceA._id,
    userId: userB._id, // Add userB as ADMIN to workspaceA
    role: 'ADMIN',
    status: 'ACTIVE',
    isDefaultWorkspace: false,
  });

  assert.equal(mem.role, 'ADMIN');
  assert.equal(mem.status, 'ACTIVE');
  assert.equal(mem.isDefaultWorkspace, false);
});

test('11. Membership Model: rejects duplicate membership for same user and workspace', async () => {
  await assert.rejects(
    async () => {
      await WorkspaceMembership.create({
        workspaceId: workspaceA._id,
        userId: userA._id, // userA is already OWNER of workspaceA
        role: 'MEMBER',
      });
    },
    (err) => err.code === 11000 || /duplicate/i.test(err.message)
  );
});

test('12. Membership Model: rejects invalid user or workspace references', async () => {
  await assert.rejects(
    async () => {
      await WorkspaceMembership.create({
        workspaceId: workspaceA._id,
        // Missing userId
        role: 'OWNER',
      });
    },
    /User ID reference is required/i
  );

  await assert.rejects(
    async () => {
      await WorkspaceMembership.create({
        userId: userA._id,
        // Missing workspaceId
        role: 'OWNER',
      });
    },
    /Workspace ID reference is required/i
  );
});

test('13. Membership Model: rejects invalid membership role', async () => {
  await assert.rejects(
    async () => {
      await WorkspaceMembership.create({
        workspaceId: workspaceB._id,
        userId: userA._id,
        role: 'SUPER_GOD_ADMIN',
      });
    },
    /Invalid membership role/i
  );
});

test('14. Membership Model: supports one user having memberships across multiple workspaces', async () => {
  // userA is already OWNER in workspaceA. Now add userA as MEMBER in workspaceB
  const memB = await WorkspaceMembership.create({
    workspaceId: workspaceB._id,
    userId: userA._id,
    role: 'MEMBER',
    status: 'ACTIVE',
    isDefaultWorkspace: false,
  });

  assert.equal(memB.role, 'MEMBER');

  const userAMemberships = await WorkspaceMembership.find({ userId: userA._id, status: 'ACTIVE' });
  assert.equal(userAMemberships.length, 2, 'userA should have memberships in both Workspace A and B');
});

// =========================================================================
// SECTION 3: AUTHORIZATION & MIDDLEWARE TESTS (Section 38)
// =========================================================================

test('15. Auth: unauthenticated request to /api/workspaces/current returns 401', async () => {
  const res = await request(app).get('/api/workspaces/current');
  assert.equal(res.status, 401);
  assert.match(res.body.message, /Authentication required/i);
});

test('16. Auth: request with invalid or expired token returns 401', async () => {
  const res = await request(app)
    .get('/api/workspaces/current')
    .set(authHeader('invalid.jwt.token'));
  assert.equal(res.status, 401);
});

test('17. Authorization: User A successfully accesses Workspace A via header', async () => {
  const res = await request(app)
    .get('/api/workspaces/current')
    .set(authHeader(tokenA))
    .set('x-workspace-id', String(workspaceA._id));

  assert.equal(res.status, 200);
  assert.equal(res.body.workspace.name, 'FitZone Gym');
  assert.equal(res.body.membership.role, 'OWNER');
});

test('18. Multi-Tenant Isolation: User B cannot access Workspace A (returns 403 Forbidden)', async () => {
  // Remove userB from workspaceA if previously added for testing
  await WorkspaceMembership.deleteOne({ workspaceId: workspaceA._id, userId: userB._id });

  const res = await request(app)
    .get('/api/workspaces/current')
    .set(authHeader(tokenB))
    .set('x-workspace-id', String(workspaceA._id));

  assert.equal(res.status, 403);
  assert.equal(res.body.code, 'FORBIDDEN_WORKSPACE_ACCESS');
});

test('19. Forged Tenant Header: non-existent or random workspace ID returns 403 Forbidden', async () => {
  const randomWsId = new mongoose.Types.ObjectId();
  const res = await request(app)
    .get('/api/workspaces/current')
    .set(authHeader(tokenA))
    .set('x-workspace-id', String(randomWsId));

  assert.equal(res.status, 403);
  assert.equal(res.body.code, 'FORBIDDEN_WORKSPACE_ACCESS');
});

test('20. Malformed Tenant Header: non-ObjectId format returns 400 Bad Request', async () => {
  const res = await request(app)
    .get('/api/workspaces/current')
    .set(authHeader(tokenA))
    .set('x-workspace-id', 'invalid-slug-not-objectid');

  assert.equal(res.status, 400);
  assert.equal(res.body.code, 'INVALID_WORKSPACE_ID');
});

test('21. Membership Revocation: REVOKED membership blocks subsequent access with 403', async () => {
  // Create temporary test user & workspace
  const tempUser = await User.create({
    name: 'Temp User',
    email: 'temp@example.com',
    passwordHash: 'dummy',
    role: 'owner',
  });
  const tempToken = jwt.sign({ sub: String(tempUser._id), ver: 1 }, process.env.JWT_SECRET);

  const { workspace, membership } = await provisionWorkspaceInternal({
    ownerId: tempUser._id,
    name: 'Revoke Test WS',
    slug: 'revoke-test-ws',
    businessEmail: 'revoke@example.com',
    businessPhone: '+919812345678',
  });

  // Access works initially
  const okRes = await request(app)
    .get('/api/workspaces/current')
    .set(authHeader(tempToken))
    .set('x-workspace-id', String(workspace._id));
  assert.equal(okRes.status, 200);

  // Now revoke membership
  membership.status = 'REVOKED';
  membership.revokedAt = new Date();
  await membership.save();

  // Subsequent access rejected with 403
  const blockedRes = await request(app)
    .get('/api/workspaces/current')
    .set(authHeader(tempToken))
    .set('x-workspace-id', String(workspace._id));

  assert.equal(blockedRes.status, 403);
  assert.equal(blockedRes.body.code, 'MEMBERSHIP_INACTIVE');
});

test('22. Workspace Status: SUSPENDED workspace blocks access with 403 WORKSPACE_SUSPENDED', async () => {
  const suspendedWs = await Workspace.create({
    name: 'Suspended WS',
    slug: 'suspended-ws-test',
    industryKey: 'other',
    businessEmail: 'suspended@example.com',
    businessPhone: '+919812345678',
    status: 'SUSPENDED',
    createdBy: userA._id,
  });

  await WorkspaceMembership.create({
    workspaceId: suspendedWs._id,
    userId: userA._id,
    role: 'OWNER',
    status: 'ACTIVE',
  });

  const res = await request(app)
    .get('/api/workspaces/current')
    .set(authHeader(tokenA))
    .set('x-workspace-id', String(suspendedWs._id));

  assert.equal(res.status, 403);
  assert.equal(res.body.code, 'WORKSPACE_SUSPENDED');
});

test('23. Workspace List: /api/workspaces/my-workspaces returns only authorized workspaces', async () => {
  const res = await request(app)
    .get('/api/workspaces/my-workspaces')
    .set(authHeader(tokenB));

  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.workspaces));
  const names = res.body.workspaces.map((w) => w.name);
  assert.ok(names.includes('CarePlus Health'));
  assert.ok(!names.includes('FitZone Gym'), 'User B must not see FitZone Gym in their workspaces');
});

// =========================================================================
// SECTION 4: QUERY HELPER & DATA ISOLATION CONTRACT TESTS (Section 40)
// =========================================================================

test('24. Query Helper: buildWorkspaceScope validates workspaceId and fails closed on undefined', () => {
  // Valid
  const scope = buildWorkspaceScope(workspaceA._id);
  assert.ok(scope.workspaceId instanceof mongoose.Types.ObjectId);
  assert.equal(scope.workspaceId.toString(), String(workspaceA._id));

  // Undefined fails closed
  assert.throws(() => buildWorkspaceScope(undefined), /Tenant boundary violation/);
  assert.throws(() => buildWorkspaceScope(null), /Tenant boundary violation/);
  assert.throws(() => buildWorkspaceScope('malformed-id'), /malformed identifier/);
});

test('25. Query Helper: assertResourceWorkspaceOwnership prevents cross-tenant enumeration', () => {
  const resourceOfWsA = { _id: new mongoose.Types.ObjectId(), workspaceId: workspaceA._id, title: 'Item A' };

  // Matching workspace succeeds
  assert.equal(assertResourceWorkspaceOwnership(resourceOfWsA, workspaceA._id), true);

  // Mismatched workspace throws 404 (does NOT reveal existence of another tenant's resource)
  assert.throws(
    () => assertResourceWorkspaceOwnership(resourceOfWsA, workspaceB._id),
    (err) => err.status === 404 && err.code === 'RESOURCE_NOT_FOUND'
  );
});

// =========================================================================
// SECTION 5: LEGACY M2W COMPATIBILITY TESTS (Section 39)
// =========================================================================

test('26. Legacy Compatibility: existing M2W owner can authenticate and fetch profile (/api/auth/me)', async () => {
  const res = await request(app)
    .get('/api/auth/me')
    .set(authHeader(legacyToken));

  assert.equal(res.status, 200);
  assert.equal(res.body.user.email, 'm2w@luxuryrealty.example');
  assert.equal(res.body.user.businessName, 'M2W Luxury Realty');
});

test('27. Legacy Compatibility: existing single-owner routes continue working via ownerId', async () => {
  const res = await request(app)
    .get('/api/contacts')
    .set(authHeader(legacyToken));

  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.records));
  assert.ok(res.body.records.some((c) => c.fullName === 'Legacy M2W Buyer'));
});

test('28. Legacy Compatibility: User A (new workspace) CANNOT read legacy M2W contacts', async () => {
  const res = await request(app)
    .get('/api/contacts')
    .set(authHeader(tokenA));

  assert.equal(res.status, 200);
  // User A should not see M2W buyer
  assert.ok(Array.isArray(res.body.records));
  assert.ok(
    !res.body.records.some((c) => c.fullName === 'Legacy M2W Buyer'),
    'User A must never see legacy M2W contacts'
  );
});

test('29. Legacy Protection: M2W records retain ownerId and have not been automatically mutated', async () => {
  const contact = await Contact.findOne({ fullName: 'Legacy M2W Buyer' });
  assert.ok(contact, 'Legacy M2W contact must exist');
  assert.equal(String(contact.ownerId), String(legacyOwner._id));
  assert.equal(contact.workspaceId, undefined, 'workspaceId must NOT be backfilled in Prompt 1');
});

test('30. Safety Guard: Meta WhatsApp Cloud API live mode remains strictly blocked with 403', () => {
  assert.equal(messagingProviderRegistry.isLiveEnabled(), false);
  assert.throws(
    () => messagingProviderRegistry.getProvider('LIVE'),
    (err) => err.status === 403 && err.code === 'LIVE_MODE_DISABLED'
  );
});
