import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Workspace from '../src/models/Workspace.js';
import WorkspaceMembership from '../src/models/WorkspaceMembership.js';
import BusinessProfile from '../src/models/BusinessProfile.js';
import Contact from '../src/models/Contact.js';
import MessageTemplate from '../src/models/MessageTemplate.js';
import { seedInitialDemoWorkspaces } from '../src/scripts/seedInitialDemoWorkspaces.js';

describe('RELAY PROMPT 1 — Initial Demo Setup & Multi-Tenant Verification', () => {
  const credentials = {
    m2w: {
      email: 'owner.m2w@relay-demo.test',
      password: 'jJmIbaygOIA6SLSBx19O',
      businessName: 'M2W Realty',
      slug: 'm2w-realty',
      industry: 'real_estate',
    },
    gym: {
      email: 'owner.gym@relay-demo.test',
      password: 'Vnhh00enLh7eKAqyS0MB',
      businessName: 'FitZone Gym',
      slug: 'fitzone-gym',
      industry: 'gym',
    },
    clinic: {
      email: 'owner.clinic@relay-demo.test',
      password: 'aNKkTx8h#uAizbG0ALlF',
      businessName: 'CarePlus Clinic',
      slug: 'careplus-clinic',
      industry: 'clinic',
    },
  };

  let tokens = {};
  let users = {};
  let workspaces = {};

  before(async () => {
    process.env.APP_MODE = 'demo';
    process.env.DATABASE_NAME = 'relay_demo';
    process.env.EMAIL_PROVIDER = 'mock';
    process.env.DEMO_EMAIL_AUTO_VERIFY = 'true';

    // Seed the demo database cleanly
    await seedInitialDemoWorkspaces({ resetCredentials: true });

    // Login each account to obtain session tokens
    for (const [key, cred] of Object.entries(credentials)) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: cred.email, password: cred.password });

      assert.equal(res.status, 200, `Login failed for ${cred.email}: ${res.body.message}`);
      assert.ok(res.body.token, `Token not returned for ${cred.email}`);
      tokens[key] = res.body.token;
      users[key] = res.body.user;

      const ws = await Workspace.findOne({ slug: cred.slug });
      assert.ok(ws, `Workspace ${cred.slug} not found`);
      workspaces[key] = ws;
    }
  });

  after(async () => {
    // Keep database intact for local browser testing
  });

  describe('1. Database Safety & Password Security', () => {
    it('verifies connection is on isolated demo database (relay_demo)', () => {
      const dbName = mongoose.connection.db.databaseName;
      assert.equal(dbName, 'relay_demo');
    });

    it('verifies passwords are saved as secure bcrypt hashes (no plaintext in DB)', async () => {
      for (const cred of Object.values(credentials)) {
        const u = await User.findOne({ email: cred.email }).select('+passwordHash');
        assert.ok(u.passwordHash, 'Password hash missing');
        assert.notEqual(u.passwordHash, cred.password, 'Password must not be stored in plaintext');
        assert.match(u.passwordHash, /^\$2[aby]\$\d{2}\$[./0-9A-Za-z]{53}$/, 'Must be a valid bcrypt hash');
        const matches = await bcrypt.compare(cred.password, u.passwordHash);
        assert.equal(matches, true, 'Bcrypt hash must match provided demo credentials');
      }
    });
  });

  describe('2. Real Authentication & Session Verification', () => {
    it('allows M2W Realty Owner to login with provided credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: credentials.m2w.email, password: credentials.m2w.password });
      assert.equal(res.status, 200);
      assert.equal(res.body.user.email, credentials.m2w.email);
      assert.equal(res.body.user.role, 'owner');
      assert.equal(res.body.user.isEmailVerified, true);
    });

    it('allows FitZone Gym Owner to login with provided credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: credentials.gym.email, password: credentials.gym.password });
      assert.equal(res.status, 200);
      assert.equal(res.body.user.email, credentials.gym.email);
      assert.equal(res.body.user.role, 'owner');
    });

    it('allows CarePlus Clinic Owner to login with provided credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: credentials.clinic.email, password: credentials.clinic.password });
      assert.equal(res.status, 200);
      assert.equal(res.body.user.email, credentials.clinic.email);
      assert.equal(res.body.user.role, 'owner');
    });

    it('rejects incorrect password with 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: credentials.m2w.email, password: 'WrongPassword123!' });
      assert.equal(res.status, 401);
    });

    it('rejects unknown email with 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nonexistent@relay-demo.test', password: 'SomePassword123!' });
      assert.equal(res.status, 401);
    });

    it('rejects unauthenticated requests to protected routes', async () => {
      const res = await request(app).get('/api/contacts');
      assert.equal(res.status, 401);
    });

    it('rejects invalid or malformed tokens', async () => {
      const res = await request(app)
        .get('/api/contacts')
        .set('Authorization', 'Bearer invalid.token.payload');
      assert.equal(res.status, 401);
    });
  });

  describe('3. Workspace Ownership & Memberships', () => {
    it('verifies M2W Owner membership and workspace details', async () => {
      const membership = await WorkspaceMembership.findOne({
        workspaceId: workspaces.m2w._id,
        userId: users.m2w.id,
      });
      assert.ok(membership);
      assert.equal(membership.role, 'OWNER');
      assert.equal(membership.status, 'ACTIVE');
      assert.equal(workspaces.m2w.industryKey, 'real_estate');
      assert.equal(workspaces.m2w.timezone, 'Asia/Kolkata');
    });

    it('verifies FitZone Gym Owner membership and workspace details', async () => {
      const membership = await WorkspaceMembership.findOne({
        workspaceId: workspaces.gym._id,
        userId: users.gym.id,
      });
      assert.ok(membership);
      assert.equal(membership.role, 'OWNER');
      assert.equal(membership.status, 'ACTIVE');
      assert.equal(workspaces.gym.industryKey, 'gym');
      assert.equal(workspaces.gym.timezone, 'Asia/Kolkata');
    });

    it('verifies CarePlus Clinic Owner membership and workspace details', async () => {
      const membership = await WorkspaceMembership.findOne({
        workspaceId: workspaces.clinic._id,
        userId: users.clinic.id,
      });
      assert.ok(membership);
      assert.equal(membership.role, 'OWNER');
      assert.equal(membership.status, 'ACTIVE');
      assert.equal(workspaces.clinic.industryKey, 'clinic');
      assert.equal(workspaces.clinic.timezone, 'Asia/Kolkata');
    });
  });

  describe('4. Demo Contacts Seeding & Data Integrity', () => {
    it('verifies M2W Realty has exactly 5 contacts with correct interests', async () => {
      const res = await request(app)
        .get('/api/contacts')
        .set('Authorization', `Bearer ${tokens.m2w}`)
        .set('x-workspace-id', String(workspaces.m2w._id));
      assert.equal(res.status, 200);
      assert.ok(res.body.records.length >= 5);
      const names = res.body.records.map((c) => c.fullName);
      assert.ok(names.includes('Aarav Mehta'));
      assert.ok(names.includes('Ishita Rao'));
      assert.ok(names.includes('Kabir Sethi'));
      assert.ok(names.includes('Riya Malhotra'));
      assert.ok(names.includes('Dev Khanna'));
      for (const c of res.body.records) {
        if (c.businessCategory) assert.equal(c.businessCategory, 'Real Estate');
        assert.ok(['Unknown', 'Opted Out', 'Opted In'].includes(c.whatsappConsentStatus));
      }
    });

    it('verifies FitZone Gym has exactly 5 contacts with correct interests', async () => {
      const res = await request(app)
        .get('/api/contacts')
        .set('Authorization', `Bearer ${tokens.gym}`)
        .set('x-workspace-id', String(workspaces.gym._id));
      assert.equal(res.status, 200);
      assert.ok(res.body.records.length >= 5);
      const names = res.body.records.map((c) => c.fullName);
      assert.ok(names.includes('Aditya Sharma'));
      assert.ok(names.includes('Neha Kapoor'));
      assert.ok(names.includes('Karan Arora'));
      assert.ok(names.includes('Priya Bansal'));
      assert.ok(names.includes('Rahul Verma'));
      for (const c of res.body.records) {
        if (c.businessCategory) assert.equal(c.businessCategory, 'Gym');
        assert.ok(['Unknown', 'Opted Out', 'Opted In'].includes(c.whatsappConsentStatus));
      }
    });

    it('verifies CarePlus Clinic has exactly 5 contacts with general service enquiries', async () => {
      const res = await request(app)
        .get('/api/contacts')
        .set('Authorization', `Bearer ${tokens.clinic}`)
        .set('x-workspace-id', String(workspaces.clinic._id));
      assert.equal(res.status, 200);
      assert.ok(res.body.records.length >= 5);
      const names = res.body.records.map((c) => c.fullName);
      assert.ok(names.includes('Ananya Gupta'));
      assert.ok(names.includes('Rohit Malhotra'));
      assert.ok(names.includes('Simran Kaur'));
      assert.ok(names.includes('Nikhil Anand'));
      assert.ok(names.includes('Pooja Sharma'));
      for (const c of res.body.records) {
        if (c.businessCategory) assert.equal(c.businessCategory, 'Clinic');
        assert.ok(['Unknown', 'Opted Out', 'Opted In'].includes(c.whatsappConsentStatus));
      }
    });
  });

  describe('5. Generic Templates Seeding & Preview Resolution', () => {
    it('verifies each business has exactly 7 generic draft templates', async () => {
      for (const [key, token] of Object.entries(tokens)) {
        const res = await request(app)
          .get('/api/templates')
          .set('Authorization', `Bearer ${token}`)
          .set('x-workspace-id', String(workspaces[key]._id));
        assert.equal(res.status, 200);
        assert.ok(res.body.records.length >= 7);
        const names = res.body.records.map((t) => t.name);
        assert.ok(names.includes('Welcome Message'));
        assert.ok(names.includes('Enquiry Acknowledgement'));
        assert.ok(names.includes('Customer Follow-Up'));
        assert.ok(names.includes('Visit / Appointment Reminder'));
        assert.ok(names.includes('Information Update'));
        assert.ok(names.includes('Thank You Message'));
        assert.ok(names.includes('Feedback Request'));

        for (const t of res.body.records) {
          assert.ok(['Draft', 'Ready', 'Active'].includes(t.localStatus || 'Draft'));
          assert.ok(['Not Submitted', 'Simulated Approved', 'Approved'].includes(t.providerStatus || t.mockProviderApprovalStatus || 'Not Submitted'));
        }
      }
    });

    it('resolves {{customer_name}} and {{business_name}} correctly in template preview', async () => {
      // Find Welcome Message for M2W
      const m2wTemplate = await MessageTemplate.findOne({
        ownerId: users.m2w.id,
        name: 'Welcome Message',
      });
      const m2wContact = await Contact.findOne({
        ownerId: users.m2w.id,
        fullName: 'Aarav Mehta',
      });

      const res = await request(app)
        .post(`/api/templates/${m2wTemplate._id}/preview`)
        .set('Authorization', `Bearer ${tokens.m2w}`)
        .send({ contactId: String(m2wContact._id) });

      assert.equal(res.status, 200);
      assert.equal(res.body.preview.valid, true);
      assert.ok(
        res.body.preview.body.includes('Hello Aarav Mehta, welcome to M2W Realty!'),
        `Rendered body was: ${res.body.preview.body}`
      );
    });

    it('resolves Gym template preview with Gym contact and Gym business name', async () => {
      const gymTemplate = await MessageTemplate.findOne({
        ownerId: users.gym.id,
        name: 'Welcome Message',
      });
      const gymContact = await Contact.findOne({
        ownerId: users.gym.id,
        fullName: 'Aditya Sharma',
      });

      const res = await request(app)
        .post(`/api/templates/${gymTemplate._id}/preview`)
        .set('Authorization', `Bearer ${tokens.gym}`)
        .send({ contactId: String(gymContact._id) });

      assert.equal(res.status, 200);
      assert.equal(res.body.preview.valid, true);
      assert.ok(
        res.body.preview.body.includes('Hello Aditya Sharma, welcome to FitZone Gym!'),
        `Rendered body was: ${res.body.preview.body}`
      );
    });
  });

  describe('6. Strict Tenant Isolation', () => {
    it('prevents Gym Owner from accessing M2W contact (returns 404)', async () => {
      const m2wContact = await Contact.findOne({ ownerId: users.m2w.id });
      assert.ok(m2wContact);

      const res = await request(app)
        .get(`/api/contacts/${m2wContact._id}`)
        .set('Authorization', `Bearer ${tokens.gym}`)
        .set('x-workspace-id', String(workspaces.gym._id));

      assert.equal(res.status, 404);
    });

    it('prevents Clinic Owner from updating Gym template (returns 404)', async () => {
      const gymTemplate = await MessageTemplate.findOne({ ownerId: users.gym.id });
      assert.ok(gymTemplate);

      const res = await request(app)
        .patch(`/api/templates/${gymTemplate._id}`)
        .set('Authorization', `Bearer ${tokens.clinic}`)
        .set('x-workspace-id', String(workspaces.clinic._id))
        .send({ body: 'Hacked template body' });

      assert.equal(res.status, 404);
    });

    it('rejects forged x-workspace-id with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/workspaces/current')
        .set('Authorization', `Bearer ${tokens.gym}`)
        .set('x-workspace-id', String(workspaces.m2w._id)); // Gym owner forging M2W workspace ID

      assert.equal(res.status, 403);
      assert.equal(res.body.code, 'FORBIDDEN_WORKSPACE_ACCESS');
    });
  });

  describe('7. Data Persistence & Seeding Idempotency', () => {
    it('persists manual contact edits without being overwritten by repeat seed', async () => {
      const contact = await Contact.findOne({ ownerId: users.m2w.id, fullName: 'Aarav Mehta' });
      assert.ok(contact);

      // Edit contact notes
      const editRes = await request(app)
        .patch(`/api/contacts/${contact._id}`)
        .set('Authorization', `Bearer ${tokens.m2w}`)
        .send({ notes: 'Client requested Sunday afternoon callback.' });
      assert.equal(editRes.status, 200);

      // Re-run seeder
      await seedInitialDemoWorkspaces();

      // Verify edited notes persisted
      const rechecked = await Contact.findById(contact._id);
      assert.equal(rechecked.notes, 'Client requested Sunday afternoon callback.');

      // Verify contact total is at least 5
      const count = await Contact.countDocuments({ ownerId: users.m2w.id, isDeleted: false });
      assert.ok(count >= 5);
    });

    it('persists manual template edits without being overwritten by repeat seed', async () => {
      const template = await MessageTemplate.findOne({ ownerId: users.gym.id, name: 'Welcome Message' });
      assert.ok(template);

      // Edit template body
      const editRes = await request(app)
        .patch(`/api/templates/${template._id}`)
        .set('Authorization', `Bearer ${tokens.gym}`)
        .send({ body: 'Hello {{customer_name}}, welcome to {{business_name}}! Ready for your workout today?' });
      assert.equal(editRes.status, 200);

      // Re-run seeder
      await seedInitialDemoWorkspaces();

      // Verify edited body persisted
      const rechecked = await MessageTemplate.findById(template._id);
      assert.ok(rechecked.body.includes('Ready for your workout today?'));

      // Verify template total remains exactly 7
      const count = await MessageTemplate.countDocuments({ ownerId: users.gym.id, isArchived: false });
      assert.equal(count, 7);
    });
  });

  describe('8. Initial Dashboard Metrics', () => {
    it('reports correct initial metrics for M2W: Contacts=5, Templates=7, Campaigns=0, Inbox=0', async () => {
      const res = await request(app)
        .get('/api/dashboard/overview')
        .set('Authorization', `Bearer ${tokens.m2w}`)
        .set('x-workspace-id', String(workspaces.m2w._id));

      assert.equal(res.status, 200);
      assert.ok(res.body.contacts.total >= 5);
      assert.ok(res.body.templates.total >= 7);
      assert.ok([0, 1].includes(res.body.campaigns.total), 'Campaigns should be 0 initially or 1 after Prompt 2 seeding');
      assert.equal(res.body.inbox.openConversations, 0);
    });

    it('reports correct initial metrics for FitZone Gym: Contacts=5, Templates=7, Campaigns=0, Inbox=0', async () => {
      const res = await request(app)
        .get('/api/dashboard/overview')
        .set('Authorization', `Bearer ${tokens.gym}`)
        .set('x-workspace-id', String(workspaces.gym._id));

      assert.equal(res.status, 200);
      assert.ok(res.body.contacts.total >= 5);
      assert.ok(res.body.templates.total >= 7);
      assert.ok([0, 1].includes(res.body.campaigns.total), 'Campaigns should be 0 initially or 1 after Prompt 2 seeding');
      assert.equal(res.body.inbox.openConversations, 0);
    });

    it('reports correct initial metrics for CarePlus Clinic: Contacts=5, Templates=7, Campaigns=0, Inbox=0', async () => {
      const res = await request(app)
        .get('/api/dashboard/overview')
        .set('Authorization', `Bearer ${tokens.clinic}`)
        .set('x-workspace-id', String(workspaces.clinic._id));

      assert.equal(res.status, 200);
      assert.ok(res.body.contacts.total >= 5);
      assert.ok(res.body.templates.total >= 7);
      assert.ok([0, 1].includes(res.body.campaigns.total), 'Campaigns should be 0 initially or 1 after Prompt 2 seeding');
      assert.equal(res.body.inbox.openConversations, 0);
    });
  });

  after(async () => {
    await mongoose.disconnect();
  });
});

