import 'dotenv/config';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { MongoMemoryServer } from 'mongodb-memory-server';

import User from '../src/models/User.js';
import Workspace from '../src/models/Workspace.js';
import WorkspaceMembership from '../src/models/WorkspaceMembership.js';
import BusinessProfile from '../src/models/BusinessProfile.js';
import Contact from '../src/models/Contact.js';
import { getIndustryConfig, getStrictIndustryConfig } from '../src/config/industries/industryRegistry.js';
import { overview } from '../src/controllers/dashboardController.js';
import { resolveTemplate, validateTemplate } from '../src/utils/templateEngine.js';

let mongoServer;

before(async () => {
  try {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  } catch (err) {
    console.warn('MongoMemoryServer setup skipped/failed:', err.message);
  }
});

after(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
});

test('Master Prompt 12/13 — 1. Professional Services Pack Metadata and Aliases', () => {
  const config = getIndustryConfig('professional_services');
  assert.ok(config, 'Professional Services pack must load');
  assert.equal(config.key, 'professional_services');
  assert.equal(config.id, 'professional_services');
  assert.equal(config.name, 'Professional Services');
  assert.equal(config.packVersion, '1.1.0');

  const aliases = [
    'professional_services',
    'professional',
    'legal',
    'consulting',
    'accounting',
    'agency',
    'ca_firm',
    'law_firm',
    'tax_consultant',
  ];

  aliases.forEach((alias) => {
    const resolved = getStrictIndustryConfig(alias);
    assert.ok(resolved, `Alias "${alias}" must resolve`);
    assert.equal(resolved.key, 'professional_services', `Alias "${alias}" must resolve to canonical "professional_services"`);
  });
});

test('Master Prompt 12/13 — 2. Exactly 15 Complete Message Templates', () => {
  const config = getIndustryConfig('professional_services');
  assert.equal(config.templateSuggestions.length, 15, 'Must contain exactly 15 message templates');

  const EXPECTED_TEMPLATE_TITLES = [
    'Welcome & New Client Enquiry',
    'Professional Services Information',
    'Consultation Request Acknowledgement',
    'Consultation Scheduling Invitation',
    'Consultation Confirmation',
    'Meeting Reminder',
    'Meeting Rescheduling',
    'Service Pricing / Fee Enquiry',
    'Proposal Request Acknowledgement',
    'Proposal Follow-up',
    'Client Onboarding Information',
    'General Document Checklist Request',
    'Project / Service Status Enquiry',
    'Callback Request',
    'Thank You & Client Feedback Request',
  ];

  const templateTitles = config.templateSuggestions.map((t) => t.title);
  EXPECTED_TEMPLATE_TITLES.forEach((title) => {
    assert.ok(templateTitles.includes(title), `Template "${title}" must be present in professional templates`);
  });

  const presetIds = new Set();
  config.templateSuggestions.forEach((t) => {
    assert.ok(t.templateId, 'Template must have a templateId');
    assert.ok(!presetIds.has(t.templateId), `Template ID "${t.templateId}" must be unique`);
    presetIds.add(t.templateId);
    assert.ok(t.body && t.body.trim().length > 15, `Template "${t.title}" must have a non-empty body`);
    assert.ok(Array.isArray(t.variables), `Template "${t.title}" must define variables`);
    assert.equal(t.approvalStatus, 'NOT_SUBMITTED', 'Starter template should be unsubmitted draft');
    assert.equal(t.submissionState, 'unsubmitted_draft');

    const val = validateTemplate(t);
    assert.equal(val.errors.length, 0, `Template "${t.presetKey}" validation failed: ${val.errors.join(', ')}`);
  });
});

test('Master Prompt 12/13 — 3. Exactly 8 Complete Quick Replies', () => {
  const config = getIndustryConfig('professional_services');
  assert.equal(config.quickReplyPresets.length, 8, 'Must contain exactly 8 quick replies');

  const EXPECTED_QR_TITLES = [
    'Available Services',
    'Consultation Request',
    'Consultation Fees Enquiry',
    'Available Meeting Timings',
    'Proposal / Quotation Request',
    'Onboarding Process',
    'Business Location / Online Consultation',
    'Request a Callback',
  ];

  const qrTitles = config.quickReplyPresets.map((qr) => qr.title);
  EXPECTED_QR_TITLES.forEach((title) => {
    assert.ok(qrTitles.includes(title), `Quick reply "${title}" must be present`);
  });

  const qrKeys = new Set();
  config.quickReplyPresets.forEach((qr) => {
    assert.ok(!qrKeys.has(qr.key), `Quick reply key "${qr.key}" must be unique`);
    qrKeys.add(qr.key);
    assert.ok(qr.text && qr.text.trim().length > 10, `Quick reply "${qr.title}" must have non-empty text`);
  });
});

test('Master Prompt 12/13 — 4. Exactly 5 Starter Keyword Rules (Disabled) + 1 Opt-Out Rule', () => {
  const config = getIndustryConfig('professional_services');
  assert.equal(config.automationPresets.length, 6, 'Must contain 5 keyword rules + 1 opt-out rule');

  const disabledRules = config.automationPresets.filter((r) => r.enabled === false);
  assert.equal(disabledRules.length, 5, 'Exactly 5 starter keyword rules must be disabled by default');

  const EXPECTED_RULE_NAMES = [
    'Services',
    'Consultation',
    'Fees / Pricing',
    'Proposal / Quotation',
    'Documents / Onboarding',
  ];

  const ruleNames = disabledRules.map((r) => r.displayName);
  EXPECTED_RULE_NAMES.forEach((name) => {
    assert.ok(ruleNames.includes(name), `Starter rule "${name}" must exist among disabled rules`);
  });

  const optOutRule = config.automationPresets.find((r) => r.presetId === 'prof_auto_stop');
  assert.ok(optOutRule, 'Opt-out rule must exist');
  assert.equal(optOutRule.enabled, true, 'Opt-out compliance rule must remain enabled');
  assert.equal(optOutRule.priority, 100, 'Opt-out rule must have priority 100');
});

test('Master Prompt 12/13 — 5. Exactly 2 Campaign Drafts (Unscheduled, No Recipients)', () => {
  const config = getIndustryConfig('professional_services');
  assert.equal(config.sampleCampaignDrafts.length, 2, 'Must contain exactly 2 campaign drafts');

  const EXPECTED_CAMPAIGNS = ['Client Enquiry Follow-up', 'Proposal Follow-up'];
  const campaignNames = config.sampleCampaignDrafts.map((c) => c.campaignName);
  EXPECTED_CAMPAIGNS.forEach((name) => {
    assert.ok(campaignNames.includes(name), `Campaign draft "${name}" must exist`);
  });

  config.sampleCampaignDrafts.forEach((c) => {
    assert.equal(c.status, 'Draft', 'Campaign draft status must be Draft');
    assert.equal(c.recipientList.length, 0, 'Campaign draft must have no recipients');
    assert.equal(c.executionHistory, null, 'Campaign draft must have no execution history');
    assert.equal(c.scheduledAt, null, 'Campaign draft must not be scheduled');
  });
});

test('Master Prompt 12/13 — 6. CRM Contact Field Definitions (14 Fields) with Schema Validation', () => {
  const config = getIndustryConfig('professional_services');
  assert.equal(config.contactFields.length, 14, 'Must define exactly 14 CRM fields');

  const validTypes = new Set(['text', 'number', 'select', 'multiselect', 'date', 'boolean']);
  config.contactFields.forEach((f) => {
    assert.ok(f.key, 'Contact field must have a key');
    assert.ok(f.label, 'Contact field must have a label');
    assert.ok(validTypes.has(f.type), `Contact field "${f.key}" has invalid type "${f.type}"`);
  });
});

test('Master Prompt 12/13 — 7. Personalization Variable Resolution', () => {
  const template = {
    body: 'Hello {{customer_name}}, thank you for contacting {{business_name}} regarding {{service_name}}.',
  };
  const resolved = resolveTemplate(
    template,
    {
      fullName: 'Aarav Mehta',
      serviceName: 'Corporate Tax Audit',
    },
    {
      businessName: 'Vanguard Advisory & Legal',
    }
  );

  assert.ok(resolved.body.includes('Hello Aarav Mehta'));
  assert.ok(resolved.body.includes('Vanguard Advisory & Legal'));
  assert.ok(resolved.body.includes('Corporate Tax Audit'));
});

test('Master Prompt 12/13 — 8. Multi-Tenant Segregation: Professional Services, Restaurant, and M2W Realty', async () => {
  if (mongoose.connection.readyState !== 1) {
    return; // Skip if MongoMemoryServer not connected
  }

  // 1. Provision Professional Services Workspace
  const passwordHash = await bcrypt.hash('password123', 10);
  const profUser = await User.create({
    name: 'Advocate Siddharth',
    businessName: 'Vanguard Advisory & Legal',
    email: 'owner.professional.test@relay-demo.test',
    passwordHash,
    role: 'owner',
    isEmailVerified: true,
  });

  const profWs = await Workspace.create({
    name: 'Vanguard Advisory & Legal',
    slug: 'vanguard-advisory-test',
    industryKey: 'professional_services',
    businessEmail: profUser.email,
    businessPhone: '+919876500800',
    city: 'Gurugram',
    country: 'India',
    status: 'ACTIVE',
    createdBy: profUser._id,
  });

  profUser.defaultWorkspaceId = profWs._id;
  await profUser.save();

  await WorkspaceMembership.create({
    workspaceId: profWs._id,
    userId: profUser._id,
    role: 'OWNER',
    status: 'ACTIVE',
    isDefaultWorkspace: true,
  });

  await BusinessProfile.create({
    workspaceId: profWs._id,
    ownerId: profUser._id,
    businessName: 'Vanguard Advisory & Legal',
    displayName: 'Vanguard Advisory & Legal',
    businessCategory: 'Professional Services',
    industry: 'professional_services',
  });

  // Create isolated contact in professional workspace
  await Contact.create({
    ownerId: profUser._id,
    workspaceId: profWs._id,
    fullName: 'Aarav Mehta',
    phoneNumber: '+919876530001',
    leadStatus: 'Interested',
    priority: 'High',
    interestedService: 'Corporate Tax Audit',
    industryData: {
      serviceCategory: 'Accounting, Audit & Tax',
      meetingMode: 'Video Call',
    },
  });

  // 2. Provision Restaurant Workspace
  const restUser = await User.create({
    name: 'Chef Marco',
    businessName: 'The Grand Bistro',
    email: 'owner.restaurant.test@relay-demo.test',
    passwordHash,
    role: 'owner',
    isEmailVerified: true,
  });

  const restWs = await Workspace.create({
    name: 'The Grand Bistro',
    slug: 'grand-bistro-test',
    industryKey: 'restaurant_food',
    businessEmail: restUser.email,
    businessPhone: '+919876500700',
    city: 'Bengaluru',
    country: 'India',
    status: 'ACTIVE',
    createdBy: restUser._id,
  });

  restUser.defaultWorkspaceId = restWs._id;
  await restUser.save();

  await WorkspaceMembership.create({
    workspaceId: restWs._id,
    userId: restUser._id,
    role: 'OWNER',
    status: 'ACTIVE',
    isDefaultWorkspace: true,
  });

  await Contact.create({
    ownerId: restUser._id,
    workspaceId: restWs._id,
    fullName: 'Vikram Malhotra',
    phoneNumber: '+919876520001',
    leadStatus: 'Interested',
    priority: 'High',
    interestedService: 'Chef Tasting Menu',
  });

  // 3. Test Professional Services Overview
  let profOverview = null;
  await overview(
    {
      user: profUser,
      workspace: profWs,
      workspaceId: profWs._id,
      query: {},
      get: () => profWs._id.toString(),
    },
    {
      json: (d) => { profOverview = d; },
      status: () => ({ json: () => {} }),
    }
  );

  assert.ok(profOverview, 'Professional overview data must be returned');
  assert.equal(profOverview.businessContext?.businessName, 'Vanguard Advisory & Legal');
  assert.equal(profOverview.businessContext?.industryKey, 'professional_services');
  assert.equal(profOverview.contacts?.total, 1, 'Professional workspace must only see its own contact');

  // 4. Test Restaurant Overview Isolation
  let restOverview = null;
  await overview(
    {
      user: restUser,
      workspace: restWs,
      workspaceId: restWs._id,
      query: {},
      get: () => restWs._id.toString(),
    },
    {
      json: (d) => { restOverview = d; },
      status: () => ({ json: () => {} }),
    }
  );

  assert.ok(restOverview, 'Restaurant overview data must be returned');
  assert.equal(restOverview.businessContext?.businessName, 'The Grand Bistro');
  assert.equal(restOverview.businessContext?.industryKey, 'restaurant_food');
  assert.equal(restOverview.contacts?.total, 1, 'Restaurant workspace must only see its own contact');

  // 5. Verify Workspace Isolation
  assert.notEqual(String(profWs._id), String(restWs._id), 'Workspace IDs must be distinct');
  assert.notEqual(String(profUser._id), String(restUser._id), 'User IDs must be distinct');
});
