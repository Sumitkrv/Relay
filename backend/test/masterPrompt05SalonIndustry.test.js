import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import connectDB from '../src/config/db.js';
import User from '../src/models/User.js';
import Workspace from '../src/models/Workspace.js';
import { getIndustryConfig, getStrictIndustryConfig } from '../src/config/industries/industryRegistry.js';
import { overview } from '../src/controllers/dashboardController.js';

test('Stage 19 — Salon Industry Pack Assertions', async () => {
  // 1. Correct Salon Industry ID and Aliases
  const config = getIndustryConfig('salon_beauty');
  assert.ok(config, 'Salon pack must load');
  assert.equal(config.key, 'salon');
  assert.equal(config.id, 'salon_beauty');
  assert.equal(config.name, 'Salon, Spa & Beauty');

  for (const alias of ['salon', 'salon_beauty', 'beauty', 'spa']) {
    const resolved = getStrictIndustryConfig(alias);
    assert.ok(resolved, `Alias "${alias}" must resolve`);
    assert.equal(resolved.key, 'salon', `Alias "${alias}" must resolve to canonical "salon"`);
  }

  // 2. Exactly 15 Complete Message Templates
  assert.equal(config.templateSuggestions.length, 15, 'Must contain exactly 15 message templates');

  const EXPECTED_TEMPLATE_TITLES = [
    'Welcome & New Service Enquiry',
    'Salon Services Menu',
    'Service Pricing Enquiry',
    'Appointment Booking Request',
    'Appointment Confirmation',
    'Appointment Reminder',
    'Appointment Rescheduling',
    'Appointment Cancellation Acknowledgement',
    'Haircut & Styling Enquiry',
    'Facial & Skincare Services',
    'Bridal Makeup Package Enquiry',
    'Spa & Wellness Services',
    'Promotional Offer Announcement Draft',
    'Post-Visit Feedback Request',
    'Thank You & Return Visit Invitation',
  ];

  const templateTitles = config.templateSuggestions.map((t) => t.title);
  EXPECTED_TEMPLATE_TITLES.forEach((title) => {
    assert.ok(templateTitles.includes(title), `Template "${title}" must be present in salon templates`);
  });

  const presetIds = new Set();
  config.templateSuggestions.forEach((t) => {
    assert.ok(t.templateId, 'Template must have a templateId');
    assert.ok(!presetIds.has(t.templateId), `Template ID "${t.templateId}" must be unique`);
    presetIds.add(t.templateId);
    assert.ok(t.body && t.body.trim().length > 10, `Template "${t.title}" must have a non-empty body`);
    assert.ok(Array.isArray(t.variables), `Template "${t.title}" must define variables`);
    assert.equal(t.approvalStatus, 'NOT_SUBMITTED', 'Starter template should be unsubmitted draft');
  });

  // 3. Exactly 8 Complete Quick Replies
  assert.equal(config.quickReplyPresets.length, 8, 'Must contain exactly 8 quick replies');
  const EXPECTED_QR_TITLES = [
    'Salon Service Menu',
    'Service Price Enquiry',
    'Book an Appointment',
    'Available Appointment Slots',
    'Bridal Makeup Services',
    'Spa & Skincare Services',
    'Salon Location & Timings',
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
    assert.ok(qr.text && qr.text.trim().length > 5, `Quick reply "${qr.title}" must have non-empty text`);
  });

  // 4. Exactly 5 Starter Keyword Rules (All Disabled) + 1 Opt-Out Rule
  assert.equal(config.automationPresets.length, 6, 'Must contain 5 keyword rules + 1 opt-out rule');
  const disabledRules = config.automationPresets.filter((r) => r.enabled === false);
  assert.equal(disabledRules.length, 5, 'Exactly 5 starter keyword rules must be disabled by default');

  const EXPECTED_RULE_NAMES = [
    'Service Pricing',
    'Appointment Booking',
    'Bridal Makeup',
    'Spa & Skincare',
    'Location & Timings',
  ];
  const ruleNames = disabledRules.map((r) => r.displayName);
  EXPECTED_RULE_NAMES.forEach((name) => {
    assert.ok(ruleNames.includes(name), `Starter rule "${name}" must exist among disabled rules`);
  });

  const optOutRule = config.automationPresets.find((r) => r.presetId === 'salon_auto_stop');
  assert.ok(optOutRule, 'Opt-out rule must exist');
  assert.equal(optOutRule.enabled, true, 'Opt-out compliance rule must remain enabled');
  assert.equal(optOutRule.priority, 100, 'Opt-out rule must have priority 100');

  // 5. Exactly 2 Campaign Drafts
  assert.equal(config.sampleCampaignDrafts.length, 2, 'Must contain exactly 2 campaign drafts');
  const EXPECTED_CAMPAIGNS = ['Service Enquiry Follow-up', 'Return Visit Invitation'];
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

  // 6. CRM Contact Field Definitions (11 Fields)
  assert.equal(config.contactFields.length, 11, 'Must define exactly 11 CRM fields');
});

test('Stage 15 — Multi-Tenant Verification: Salon, Clinic, and M2W Segregation', async () => {
  await connectDB();

  // 1. Verify Salon Owner & Workspace
  const salonUser = await User.findOne({ email: 'owner.mw@relay-demo.test' });
  assert.ok(salonUser, 'Salon user owner.mw@relay-demo.test must exist');

  const salonWorkspace = await Workspace.findOne({ _id: salonUser.defaultWorkspaceId || '6adb801b0e42d8ee8ff9d595' });
  assert.ok(salonWorkspace, 'Salon workspace must exist');
  assert.equal(salonWorkspace.industryKey, 'salon', 'Workspace industryKey must be salon');

  // Test Salon Overview
  let salonOverview = null;
  await overview(
    {
      user: salonUser,
      workspace: salonWorkspace,
      workspaceId: salonWorkspace._id,
      query: {},
      get: () => salonWorkspace._id.toString(),
    },
    {
      json: (d) => { salonOverview = d; },
      status: () => ({ json: () => {} }),
    }
  );

  assert.ok(salonOverview, 'Salon overview must return data');
  assert.equal(salonOverview.businessContext?.businessName, salonWorkspace.name);
  assert.equal(salonOverview.businessContext?.industryKey, 'salon');

  // 2. Verify M2W Realty Owner & Workspace Isolation
  const m2wUser = await User.findOne({ email: 'owner.m2w@relay-demo.test' });
  assert.ok(m2wUser, 'M2W owner must exist');
  const m2wWorkspace = await Workspace.findOne({ slug: 'm2w-realty' }) || await Workspace.findOne({ slug: 'm2w-realty-clone' });
  assert.ok(m2wWorkspace, 'M2W workspace must exist');

  let m2wOverview = null;
  await overview(
    {
      user: m2wUser,
      workspace: m2wWorkspace,
      workspaceId: m2wWorkspace._id,
      query: {},
      get: () => m2wWorkspace._id.toString(),
    },
    {
      json: (d) => { m2wOverview = d; },
      status: () => ({ json: () => {} }),
    }
  );

  assert.ok(m2wOverview, 'M2W overview must return data');
  assert.notEqual(salonOverview.businessContext?.businessName, m2wOverview.businessContext?.businessName);
  assert.notEqual(salonOverview.businessContext?.workspaceId, m2wOverview.businessContext?.workspaceId);

  await mongoose.disconnect();
});
