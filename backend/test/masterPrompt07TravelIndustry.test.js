import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import connectDB from '../src/config/db.js';
import User from '../src/models/User.js';
import Workspace from '../src/models/Workspace.js';
import { getIndustryConfig, getStrictIndustryConfig } from '../src/config/industries/industryRegistry.js';
import { overview } from '../src/controllers/dashboardController.js';

test('Stage 19 — Travel & Tourism Industry Pack Assertions', async () => {
  // 1. Correct Travel Industry ID and Aliases
  const config = getIndustryConfig('travel_tourism');
  assert.ok(config, 'Travel & Tourism pack must load');
  assert.equal(config.key, 'travel_tourism');
  assert.equal(config.id, 'travel_tourism');
  assert.equal(config.name, 'Travel & Tourism');

  for (const alias of ['travel_tourism', 'travel', 'tourism', 'tours', 'holidays', 'travel_agency']) {
    const resolved = getStrictIndustryConfig(alias);
    assert.ok(resolved, `Alias "${alias}" must resolve`);
    assert.equal(resolved.key, 'travel_tourism', `Alias "${alias}" must resolve to canonical "travel_tourism"`);
  }

  // 2. Exactly 15 Complete Message Templates
  assert.equal(config.templateSuggestions.length, 15, 'Must contain exactly 15 message templates');

  const EXPECTED_TEMPLATE_TITLES = [
    'Welcome & New Travel Enquiry',
    'Domestic Holiday Package Enquiry',
    'International Holiday Package Enquiry',
    'Destination Information Request',
    'Customized Itinerary Request',
    'Travel Package Pricing Enquiry',
    'Package Availability Enquiry',
    'Travel Dates & Group Details Request',
    'Hotel & Accommodation Preferences',
    'Transportation & Airport Transfer Enquiry',
    'Travel Quotation Follow-up',
    'Booking Request Acknowledgement',
    'Booking Confirmation Message',
    'Departure Preparation Reminder',
    'Thank You & Post-Trip Feedback',
  ];

  const templateTitles = config.templateSuggestions.map((t) => t.title);
  EXPECTED_TEMPLATE_TITLES.forEach((title) => {
    assert.ok(templateTitles.includes(title), `Template "${title}" must be present in travel templates`);
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
    'Available Holiday Packages',
    'Travel Package Pricing',
    'Request an Itinerary',
    'Travel Dates & Availability',
    'Group Tour Information',
    'Hotels & Transfers',
    'Visa & Travel Documentation Enquiry',
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
    'Tour Packages',
    'Package Pricing',
    'Itinerary',
    'Travel Dates & Availability',
    'Visa & Documentation',
  ];
  const ruleNames = disabledRules.map((r) => r.displayName);
  EXPECTED_RULE_NAMES.forEach((name) => {
    assert.ok(ruleNames.includes(name), `Starter rule "${name}" must exist among disabled rules`);
  });

  const optOutRule = config.automationPresets.find((r) => r.presetId === 'travel_auto_stop');
  assert.ok(optOutRule, 'Opt-out rule must exist');
  assert.equal(optOutRule.enabled, true, 'Opt-out compliance rule must remain enabled');
  assert.equal(optOutRule.priority, 100, 'Opt-out rule must have priority 100');

  // 5. Exactly 2 Campaign Drafts
  assert.equal(config.sampleCampaignDrafts.length, 2, 'Must contain exactly 2 campaign drafts');
  const EXPECTED_CAMPAIGNS = ['Holiday Package Enquiry Follow-up', 'Travel Quotation Follow-up'];
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

test('Stage 15 — Multi-Tenant Verification: Travel, Automobile, and M2W Segregation', async () => {
  await connectDB();

  // 1. Verify Travel Owner & Workspace
  const travelUser = await User.findOne({ email: 'owner.travel@relay-demo.test' });
  assert.ok(travelUser, 'Travel user owner.travel@relay-demo.test must exist');

  const travelWorkspace = await Workspace.findOne({ _id: travelUser.defaultWorkspaceId });
  assert.ok(travelWorkspace, 'Travel workspace must exist');
  assert.equal(travelWorkspace.industryKey, 'travel_tourism', 'Workspace industryKey must be travel_tourism');

  // Test Travel Overview
  let travelOverview = null;
  await overview(
    {
      user: travelUser,
      workspace: travelWorkspace,
      workspaceId: travelWorkspace._id,
      query: {},
      get: () => travelWorkspace._id.toString(),
    },
    {
      json: (d) => { travelOverview = d; },
      status: () => ({ json: () => {} }),
    }
  );

  assert.ok(travelOverview, 'Travel overview data must be returned');
  assert.equal(travelOverview.businessContext?.businessName, travelWorkspace.name);
  assert.equal(travelOverview.businessContext?.industryKey, 'travel_tourism');
  assert.ok(travelOverview.contacts, 'Travel contacts metrics must be present');
  assert.equal(typeof travelOverview.contacts.total, 'number');

  // 2. Verify Automobile Owner & Workspace
  const autoUser = await User.findOne({ email: 'owner.automobile@relay-demo.test' });
  if (autoUser) {
    const autoWorkspace = await Workspace.findOne({ _id: autoUser.defaultWorkspaceId });
    assert.ok(autoWorkspace, 'Automobile workspace must exist');
    assert.equal(autoWorkspace.industryKey, 'automobile', 'Workspace industryKey must be automobile');
    assert.notEqual(String(travelWorkspace._id), String(autoWorkspace._id), 'Workspaces must be segregated');
  }

  // 3. Verify M2W Realty Owner & Workspace
  const m2wUser = await User.findOne({ email: 'owner.m2w@relay-demo.test' });
  if (m2wUser) {
    const m2wWorkspace = await Workspace.findOne({ _id: m2wUser.defaultWorkspaceId });
    assert.ok(m2wWorkspace, 'M2W workspace must exist');
    assert.equal(m2wWorkspace.industryKey, 'real_estate', 'M2W industryKey must be real_estate');
    assert.notEqual(String(travelWorkspace._id), String(m2wWorkspace._id), 'Workspaces must be segregated');
  }

  await mongoose.disconnect();
});
