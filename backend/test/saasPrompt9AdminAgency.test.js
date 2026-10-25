import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import app from '../src/app.js';
import User from '../src/models/User.js';
import Workspace from '../src/models/Workspace.js';
import WorkspaceMembership from '../src/models/WorkspaceMembership.js';
import WorkspaceSubscription from '../src/models/WorkspaceSubscription.js';
import Contact from '../src/models/Contact.js';
import Message from '../src/models/Message.js';
import Agency from '../src/models/Agency.js';
import AgencyMembership from '../src/models/AgencyMembership.js';
import AgencyClientRelation from '../src/models/AgencyClientRelation.js';
import SecurityAuditLog from '../src/models/SecurityAuditLog.js';

let mongod;
let superAdminUser;
let superAdminToken;
let businessOwnerUser;
let businessOwnerToken;
let agencyOwnerUser;
let agencyOwnerToken;
let otherAgencyOwnerUser;
let otherAgencyOwnerToken;
let demoWorkspace1;
let demoWorkspace2;
let demoAgency;
let otherAgency;

describe('SaaS Prompt 09 — Platform Super Admin, Agency & White-Label Isolation Suite', () => {
  before(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-jwt-secret-prompt-9-relay-32chars-minimum!!';
    process.env.EMAIL_PROVIDER = 'inmemory';

    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());

    const passwordHash = await bcrypt.hash('DemoPass123!', 10);

    // 1. Super Admin User
    superAdminUser = await User.create({
      name: 'Super Admin',
      email: 'admin@relay-platform.test',
      passwordHash,
      role: 'admin',
      isPlatformAdmin: true,
      accountStatus: 'ACTIVE',
      isEmailVerified: true,
      authVersion: 1,
    });
    superAdminToken = jwt.sign({ sub: superAdminUser._id, ver: 1 }, process.env.JWT_SECRET, { expiresIn: '1d' });

    // 2. Business Owner User
    businessOwnerUser = await User.create({
      name: 'M2W Owner',
      email: 'm2w@realty.test',
      passwordHash,
      role: 'owner',
      isPlatformAdmin: false,
      accountStatus: 'ACTIVE',
      isEmailVerified: true,
      authVersion: 1,
    });
    businessOwnerToken = jwt.sign({ sub: businessOwnerUser._id, ver: 1 }, process.env.JWT_SECRET, { expiresIn: '1d' });

    // 3. Workspaces
    demoWorkspace1 = await Workspace.create({
      name: 'M2W Realty Flagship',
      slug: 'm2w-realty-flagship',
      industryKey: 'real_estate',
      businessEmail: 'm2w@realty.test',
      businessPhone: '+919811223344',
      status: 'ACTIVE',
      createdBy: businessOwnerUser._id,
    });

    await WorkspaceMembership.create({
      workspaceId: demoWorkspace1._id,
      userId: businessOwnerUser._id,
      role: 'OWNER',
      status: 'ACTIVE',
      isDefaultWorkspace: true,
    });

    await WorkspaceSubscription.create({
      workspaceId: demoWorkspace1._id,
      planId: 'solo_799',
      planName: 'Solo Growth Plan',
      amount: 799,
      status: 'ACTIVE',
      isMock: true,
    });

    // Confidential CRM contact with sensitive phone & private notes
    await Contact.create({
      ownerId: businessOwnerUser._id,
      workspaceId: demoWorkspace1._id,
      fullName: 'Confidential Client HighNetWorth',
      phoneNumber: '+919999988888',
      whatsappConsentStatus: 'Opted In',
      customFields: { privateMedicalOrFinancialNote: 'Secret Budget ₹10Cr' },
    });

    demoWorkspace2 = await Workspace.create({
      name: 'FitZone Gym Client',
      slug: 'fitzone-gym-client',
      industryKey: 'gym',
      businessEmail: 'gym@fitzone.test',
      businessPhone: '+919822334455',
      status: 'ACTIVE',
      createdBy: businessOwnerUser._id,
    });

    // 4. Agency Owner 1
    agencyOwnerUser = await User.create({
      name: 'Spark Agency Owner',
      email: 'owner@sparkagency.test',
      passwordHash,
      role: 'owner',
      isPlatformAdmin: false,
      accountStatus: 'ACTIVE',
      isEmailVerified: true,
      authVersion: 1,
    });
    agencyOwnerToken = jwt.sign({ sub: agencyOwnerUser._id, ver: 1 }, process.env.JWT_SECRET, { expiresIn: '1d' });

    demoAgency = await Agency.create({
      name: 'Spark Digital Agency',
      slug: 'spark-digital',
      ownerId: agencyOwnerUser._id,
      branding: {
        companyName: 'Spark Digital',
        brandColor: '#2563EB',
        portalTitle: 'Spark Portal',
        customDomain: 'crm.sparkagency.test',
        domainStatus: 'DNS_PENDING',
      },
      status: 'ACTIVE',
    });

    await AgencyMembership.create({
      agencyId: demoAgency._id,
      userId: agencyOwnerUser._id,
      role: 'AGENCY_OWNER',
      status: 'ACTIVE',
    });

    // Delegate FitZone Gym to Spark Digital Agency
    await AgencyClientRelation.create({
      agencyId: demoAgency._id,
      clientWorkspaceId: demoWorkspace2._id,
      status: 'ACTIVE',
      delegatedPermissions: ['contacts:read', 'campaigns:manage', 'inbox:reply'],
    });

    // 5. Agency Owner 2 (For cross-agency isolation verification)
    otherAgencyOwnerUser = await User.create({
      name: 'Apex Agency Owner',
      email: 'owner@apexagency.test',
      passwordHash,
      role: 'owner',
      isPlatformAdmin: false,
      accountStatus: 'ACTIVE',
      isEmailVerified: true,
      authVersion: 1,
    });
    otherAgencyOwnerToken = jwt.sign({ sub: otherAgencyOwnerUser._id, ver: 1 }, process.env.JWT_SECRET, { expiresIn: '1d' });

    otherAgency = await Agency.create({
      name: 'Apex Growth Agency',
      slug: 'apex-growth',
      ownerId: otherAgencyOwnerUser._id,
      status: 'ACTIVE',
    });

    await AgencyMembership.create({
      agencyId: otherAgency._id,
      userId: otherAgencyOwnerUser._id,
      role: 'AGENCY_OWNER',
      status: 'ACTIVE',
    });
  });

  after(async () => {
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  });

  // =========================================================================
  // 1. PLATFORM SUPER ADMIN AUTHORIZATION & RBAC
  // =========================================================================
  test('1. Unauthenticated request to Platform Admin is rejected with 401', async () => {
    const res = await request(app).get('/api/admin/overview');
    assert.equal(res.status, 401);
  });

  test('2. Business owner without isPlatformAdmin is rejected with 403 Forbidden', async () => {
    const res = await request(app)
      .get('/api/admin/overview')
      .set('Authorization', `Bearer ${businessOwnerToken}`);

    assert.equal(res.status, 403);
    assert.equal(res.body.code, 'FORBIDDEN_ADMIN_ACCESS');
  });

  test('3. Agency owner without isPlatformAdmin is rejected with 403 Forbidden', async () => {
    const res = await request(app)
      .get('/api/admin/overview')
      .set('Authorization', `Bearer ${agencyOwnerToken}`);

    assert.equal(res.status, 403);
    assert.equal(res.body.code, 'FORBIDDEN_ADMIN_ACCESS');
  });

  test('4. Authorized Platform Admin receives 200 with platform telemetry and metrics', async () => {
    const res = await request(app)
      .get('/api/admin/overview')
      .set('Authorization', `Bearer ${superAdminToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.metrics.totalWorkspaces >= 2);
    assert.ok(res.body.metrics.totalUsers >= 4);
    assert.ok(res.body.metrics.totalAgencies >= 2);
    assert.equal(res.body.metrics.activeSubscriptions, 1);
    // Explicit honest financial labeling verification
    assert.equal(res.body.metrics.simulatedRevenue, 799);
    assert.equal(res.body.metrics.liveRevenue, 0);
    assert.ok(res.body.metrics.liveRevenueUnavailableReason.includes('Offline Mock Billing Mode'));
    // System health check
    assert.equal(res.body.systemHealth.status, 'HEALTHY');
    assert.equal(res.body.systemHealth.database, 'CONNECTED');
    assert.equal(res.body.systemHealth.mockWhatsAppEngine, 'ACTIVE');
    assert.equal(res.body.systemHealth.metaWhatsAppProvider, 'DISCONNECTED');
  });

  // =========================================================================
  // 2. WORKSPACE DIRECTORY, DETAILS & PRIVACY PROTECTION
  // =========================================================================
  test('5. Admin can list workspaces with search and filters', async () => {
    const res = await request(app)
      .get('/api/admin/workspaces?search=Flagship')
      .set('Authorization', `Bearer ${superAdminToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.workspaces.length, 1);
    assert.equal(res.body.workspaces[0].slug, 'm2w-realty-flagship');
    assert.equal(res.body.workspaces[0].owner?.email, 'm2w@realty.test');
  });

  test('6. Workspace details endpoint returns operational metadata but ZERO private CRM contacts or message bodies', async () => {
    const res = await request(app)
      .get(`/api/admin/workspaces/${demoWorkspace1._id}`)
      .set('Authorization', `Bearer ${superAdminToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.workspace.name, 'M2W Realty Flagship');
    assert.ok(res.body.subscription);
    assert.ok(res.body.memberships.length >= 1);

    // CRITICAL SECURITY ASSERTION: Platform admin must NOT leak contacts or messages
    assert.equal(res.body.contacts, undefined, 'Admin workspace endpoint must never return private contacts list');
    assert.equal(res.body.messages, undefined, 'Admin workspace endpoint must never return private message bodies');
  });

  test('7. Admin can suspend and reactivate a workspace with audit logs', async () => {
    // 1. Suspend
    const suspendRes = await request(app)
      .post(`/api/admin/workspaces/${demoWorkspace1._id}/suspend`)
      .set('Authorization', `Bearer ${superAdminToken}`);

    assert.equal(suspendRes.status, 200);
    assert.equal(suspendRes.body.workspace.status, 'SUSPENDED');

    // Verify audit log created
    const auditLog = await SecurityAuditLog.findOne({
      action: 'workspace_suspended_by_admin',
      'metadata.targetWorkspaceId': demoWorkspace1._id,
    });
    assert.ok(auditLog, 'Audit log must record suspension');

    // 2. Reactivate
    const reactivateRes = await request(app)
      .post(`/api/admin/workspaces/${demoWorkspace1._id}/reactivate`)
      .set('Authorization', `Bearer ${superAdminToken}`);

    assert.equal(reactivateRes.status, 200);
    assert.equal(reactivateRes.body.workspace.status, 'ACTIVE');
  });

  // =========================================================================
  // 3. PLATFORM USERS & SUBSCRIPTIONS DIRECTORY
  // =========================================================================
  test('8. Admin can list platform users without exposing password hashes or reset secrets', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${superAdminToken}`);

    assert.equal(res.status, 200);
    assert.ok(res.body.users.length >= 4);

    // Verify security: No password hashes leaked
    for (const u of res.body.users) {
      assert.equal(u.passwordHash, undefined, 'Password hash must never be returned');
      assert.equal(u.resetPasswordToken, undefined, 'Reset tokens must never be returned');
      assert.ok(Array.isArray(u.workspaces), 'User memberships summary must be returned');
    }
  });

  test('9. Admin can list subscriptions and verify offline mock mode tags', async () => {
    const res = await request(app)
      .get('/api/admin/subscriptions')
      .set('Authorization', `Bearer ${superAdminToken}`);

    assert.equal(res.status, 200);
    assert.ok(res.body.subscriptions.length >= 1);
    assert.equal(res.body.subscriptions[0].isMock, true);
    assert.equal(res.body.subscriptions[0].billingMode, 'Offline Mock Billing');
  });

  test('10. Admin can query platform agencies and view client relationship counts', async () => {
    const res = await request(app)
      .get('/api/admin/agencies')
      .set('Authorization', `Bearer ${superAdminToken}`);

    assert.equal(res.status, 200);
    assert.ok(res.body.agencies.length >= 2);
    const spark = res.body.agencies.find((a) => a.slug === 'spark-digital');
    assert.ok(spark);
    assert.equal(spark.clientCount, 1);
  });

  // =========================================================================
  // 4. AGENCY MANAGEMENT, CLIENT DELEGATION & WHITE-LABEL BRANDING
  // =========================================================================
  test('11. Agency Owner can retrieve agency context and client list', async () => {
    const res = await request(app)
      .get('/api/agency/context')
      .set('Authorization', `Bearer ${agencyOwnerToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.agency.slug, 'spark-digital');
    assert.equal(res.body.role, 'AGENCY_OWNER');
    assert.equal(res.body.totalClients, 1);
    assert.equal(res.body.clients[0].workspace?.name, 'FitZone Gym Client');
  });

  test('12. Cross-Agency Isolation: Apex Agency cannot see Spark Agency clients', async () => {
    const res = await request(app)
      .get('/api/agency/clients')
      .set('Authorization', `Bearer ${otherAgencyOwnerToken}`);

    assert.equal(res.status, 200);
    // Apex has 0 delegated clients; must NEVER leak FitZone Gym
    assert.equal(res.body.clients.length, 0);
  });

  test('13. Agency Owner can update white-label branding and DNS instructions', async () => {
    const res = await request(app)
      .put('/api/agency/branding')
      .set('Authorization', `Bearer ${agencyOwnerToken}`)
      .send({
        companyName: 'Spark Digital Enterprise',
        brandColor: '#1D4ED8',
        portalTitle: 'Spark VIP Automation Hub',
        customDomain: 'crm.sparkvip.test',
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.branding.companyName, 'Spark Digital Enterprise');
    assert.equal(res.body.branding.brandColor, '#1D4ED8');
    assert.equal(res.body.branding.customDomain, 'crm.sparkvip.test');
    assert.equal(res.body.branding.domainStatus, 'DNS_PENDING');
    assert.ok(res.body.branding.dnsTxtRecord.includes('_relay-verification.crm.sparkvip.test'));
  });

  test('14. Agency Owner can simulate custom domain verification lifecycle', async () => {
    // Step 1: DNS_PENDING -> VERIFIED
    const res1 = await request(app)
      .post('/api/agency/domains/verify')
      .set('Authorization', `Bearer ${agencyOwnerToken}`);

    assert.equal(res1.status, 200);
    assert.equal(res1.body.domainStatus, 'VERIFIED');

    // Step 2: VERIFIED -> ACTIVE
    const res2 = await request(app)
      .post('/api/agency/domains/verify')
      .set('Authorization', `Bearer ${agencyOwnerToken}`);

    assert.equal(res2.status, 200);
    assert.equal(res2.body.domainStatus, 'ACTIVE');
  });

  test('15. Agency Owner can invite and remove staff with role assignments', async () => {
    // 1. Invite Staff
    const inviteRes = await request(app)
      .post('/api/agency/staff/invite')
      .set('Authorization', `Bearer ${agencyOwnerToken}`)
      .send({
        email: 'staff.colleague@sparkagency.test',
        role: 'AGENCY_MANAGER',
      });

    assert.equal(inviteRes.status, 200);
    assert.ok(inviteRes.body.membership);
    assert.equal(inviteRes.body.membership.role, 'AGENCY_MANAGER');

    // 2. Remove Staff
    const removeRes = await request(app)
      .delete(`/api/agency/staff/${inviteRes.body.membership._id}`)
      .set('Authorization', `Bearer ${agencyOwnerToken}`);

    assert.equal(removeRes.status, 200);
    assert.equal(removeRes.body.success, true);
  });

  test('16. Agency client delegation revocation terminates access safely', async () => {
    const relation = await AgencyClientRelation.findOne({
      agencyId: demoAgency._id,
      clientWorkspaceId: demoWorkspace2._id,
    });
    assert.ok(relation);

    const revokeRes = await request(app)
      .delete(`/api/agency/clients/${relation._id}`)
      .set('Authorization', `Bearer ${agencyOwnerToken}`);

    assert.equal(revokeRes.status, 200);

    const updated = await AgencyClientRelation.findById(relation._id);
    assert.equal(updated.status, 'REVOKED');
  });
});
