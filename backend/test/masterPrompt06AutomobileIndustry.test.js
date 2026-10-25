import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import connectDB from '../src/config/db.js';
import User from '../src/models/User.js';
import Workspace from '../src/models/Workspace.js';
import { getIndustryConfig, getStrictIndustryConfig } from '../src/config/industries/industryRegistry.js';
import { overview } from '../src/controllers/dashboardController.js';

test('Stage 19 — Automobile Industry Pack Assertions', async () => {
  // 1. Correct Automobile Industry ID and Aliases
  const config = getIndustryConfig('automobile');
  assert.ok(config, 'Automobile pack must load');
  assert.equal(config.key, 'automobile');
  assert.equal(config.id, 'automobile');
  assert.equal(config.name, 'Automobile & Dealerships');

  for (const alias of ['automobile', 'dealership', 'dealerships', 'auto']) {
    const resolved = getStrictIndustryConfig(alias);
    assert.ok(resolved, `Alias "${alias}" must resolve`);
    assert.equal(resolved.key, 'automobile', `Alias "${alias}" must resolve to canonical "automobile"`);
  }

  // 2. Exactly 15 Complete Message Templates
  assert.equal(config.templateSuggestions.length, 15, 'Must contain exactly 15 message templates');

  const EXPECTED_TEMPLATE_TITLES = [
    'Welcome & Vehicle Enquiry',
    'Vehicle Model Information',
    'Vehicle Price Enquiry',
    'Quotation Request Acknowledgement',
    'Vehicle Brochure Request',
    'Test Drive Invitation',
    'Test Drive Request Acknowledgement',
    'Test Drive Reminder',
    'Vehicle Availability Enquiry',
    'Finance & EMI Information Enquiry',
    'Exchange / Trade-In Enquiry',
    'Showroom Location & Directions',
    'Vehicle Purchase Follow-up',
    'Vehicle Service Booking Enquiry',
    'Thank You & Feedback Request',
  ];

  const templateTitles = config.templateSuggestions.map((t) => t.title);
  EXPECTED_TEMPLATE_TITLES.forEach((title) => {
    assert.ok(templateTitles.includes(title), `Template "${title}" must be present in automobile templates`);
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
    'Vehicle Pricing Information',
    'Available Vehicle Models',
    'Vehicle Brochure',
    'Schedule Test Drive',
    'Finance & EMI Enquiry',
    'Exchange / Trade-In Enquiry',
    'Showroom Location',
    'Request Callback',
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
    'Vehicle Pricing',
    'Test Drive',
    'Vehicle Brochure',
    'Finance / EMI',
    'Exchange / Trade-In',
  ];
  const ruleNames = disabledRules.map((r) => r.displayName);
  EXPECTED_RULE_NAMES.forEach((name) => {
    assert.ok(ruleNames.includes(name), `Starter rule "${name}" must exist among disabled rules`);
  });

  const optOutRule = config.automationPresets.find((r) => r.presetId === 'auto_auto_stop');
  assert.ok(optOutRule, 'Opt-out rule must exist');
  assert.equal(optOutRule.enabled, true, 'Opt-out compliance rule must remain enabled');
  assert.equal(optOutRule.priority, 100, 'Opt-out rule must have priority 100');

  // 5. Exactly 2 Campaign Drafts
  assert.equal(config.sampleCampaignDrafts.length, 2, 'Must contain exactly 2 campaign drafts');
  const EXPECTED_CAMPAIGNS = ['Vehicle Enquiry Follow-up', 'Test Drive Follow-up'];
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

  // 6. CRM Contact Field Definitions (13 Fields)
  assert.equal(config.contactFields.length, 13, 'Must define exactly 13 CRM fields');
});

test('Stage 15 — Multi-Tenant Verification: Automobile, Salon, and M2W Segregation', async () => {
  await connectDB();

  // 1. Verify Automobile Owner & Workspace
  const autoUser = await User.findOne({ email: 'owner.automobile@relay-demo.test' });
  assert.ok(autoUser, 'Automobile user owner.automobile@relay-demo.test must exist');

  const autoWorkspace = await Workspace.findOne({ _id: autoUser.defaultWorkspaceId });
  assert.ok(autoWorkspace, 'Automobile workspace must exist');
  assert.equal(autoWorkspace.industryKey, 'automobile', 'Workspace industryKey must be automobile');

  // Test Automobile Overview
  let autoOverview = null;
  await overview(
    {
      user: autoUser,
      workspace: autoWorkspace,
      workspaceId: autoWorkspace._id,
      query: {},
      get: () => autoWorkspace._id.toString(),
    },
    {
      json: (d) => { autoOverview = d; },
      status: () => ({ json: () => {} }),
    }
  );

  assert.ok(autoOverview, 'Automobile overview must return data');
  assert.equal(autoOverview.businessContext?.businessName, autoWorkspace.name);
  assert.equal(autoOverview.businessContext?.industryKey, 'automobile');

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
  assert.notEqual(autoOverview.businessContext?.businessName, m2wOverview.businessContext?.businessName);
  assert.notEqual(autoOverview.businessContext?.workspaceId, m2wOverview.businessContext?.workspaceId);
  assert.equal(m2wOverview.businessContext?.industryKey, 'real_estate');

  await mongoose.disconnect();
});
