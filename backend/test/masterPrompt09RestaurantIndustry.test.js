import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import connectDB from '../src/config/db.js';
import User from '../src/models/User.js';
import Workspace from '../src/models/Workspace.js';
import { getIndustryConfig, getStrictIndustryConfig } from '../src/config/industries/industryRegistry.js';
import { overview } from '../src/controllers/dashboardController.js';

test('Stage 19 — Restaurants & Food Industry Pack Assertions', async () => {
  // 1. Correct Restaurant Industry ID and Aliases
  const config = getIndustryConfig('restaurant_food');
  assert.ok(config, 'Restaurants & Food pack must load');
  assert.equal(config.key, 'restaurant_food');
  assert.equal(config.id, 'restaurant_food');
  assert.equal(config.name, 'Restaurants & Food');

  for (const alias of [
    'restaurants_food',
    'restaurant_food',
    'restaurant',
    'restaurants',
    'food',
    'cafe',
    'catering',
    'bakery',
    'cloud_kitchen',
    'food_beverage',
  ]) {
    const resolved = getStrictIndustryConfig(alias);
    assert.ok(resolved, `Alias "${alias}" must resolve`);
    assert.equal(resolved.key, 'restaurant_food', `Alias "${alias}" must resolve to canonical "restaurant_food"`);
  }

  // 2. Exactly 15 Complete Message Templates
  assert.equal(config.templateSuggestions.length, 15, 'Must contain exactly 15 message templates');

  const EXPECTED_TEMPLATE_TITLES = [
    'Welcome & Customer Enquiry',
    'Menu Information Request',
    'Food Item & Pricing Enquiry',
    'Item Availability Enquiry',
    'Table Reservation Request Acknowledgement',
    'Table Reservation Confirmation',
    'Reservation Reminder',
    'Takeaway Enquiry',
    'Delivery Enquiry',
    'Order Enquiry Acknowledgement',
    'Order Status Information',
    'Catering & Event Enquiry',
    'Restaurant Location & Opening Hours',
    'Dietary & Allergen Information Enquiry',
    'Thank You & Customer Feedback Request',
  ];

  const templateTitles = config.templateSuggestions.map((t) => t.title);
  EXPECTED_TEMPLATE_TITLES.forEach((title) => {
    assert.ok(templateTitles.includes(title), `Template "${title}" must be present in restaurant templates`);
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
    'Menu & Food Categories',
    'Restaurant Opening Hours',
    'Location & Directions',
    'Table Reservation Request',
    'Takeaway Information',
    'Delivery Availability Enquiry',
    'Dietary & Allergen Enquiry',
    'Catering & Events',
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
    'Menu',
    'Opening Hours',
    'Table Reservation',
    'Delivery / Takeaway',
    'Catering / Events',
  ];
  const ruleNames = disabledRules.map((r) => r.displayName);
  EXPECTED_RULE_NAMES.forEach((name) => {
    assert.ok(ruleNames.includes(name), `Starter rule "${name}" must exist among disabled rules`);
  });

  const optOutRule = config.automationPresets.find((r) => r.presetId === 'restaurant_auto_stop');
  assert.ok(optOutRule, 'Opt-out rule must exist');
  assert.equal(optOutRule.enabled, true, 'Opt-out compliance rule must remain enabled');
  assert.equal(optOutRule.priority, 100, 'Opt-out rule must have priority 100');

  // 5. Exactly 2 Campaign Drafts
  assert.equal(config.sampleCampaignDrafts.length, 2, 'Must contain exactly 2 campaign drafts');
  const EXPECTED_CAMPAIGNS = ['Menu Enquiry Follow-up', 'Catering Enquiry Follow-up'];
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

  // 6. CRM Contact Field Definitions (14 Fields)
  assert.equal(config.contactFields.length, 14, 'Must define exactly 14 CRM fields');
});

test('Stage 15 — Multi-Tenant Verification: Restaurant, Travel, Automobile, and M2W Segregation', async () => {
  await connectDB();

  // 1. Verify Restaurant Owner & Workspace
  const restUser = await User.findOne({ email: 'owner.restaurant@relay-demo.test' });
  assert.ok(restUser, 'Restaurant user owner.restaurant@relay-demo.test must exist');

  const restWorkspace = await Workspace.findOne({ _id: restUser.defaultWorkspaceId });
  assert.ok(restWorkspace, 'Restaurant workspace must exist');
  assert.equal(restWorkspace.industryKey, 'restaurant_food', 'Workspace industryKey must be restaurant_food');

  // Test Restaurant Overview
  let restOverview = null;
  await overview(
    {
      user: restUser,
      workspace: restWorkspace,
      workspaceId: restWorkspace._id,
      query: {},
      get: () => restWorkspace._id.toString(),
    },
    {
      json: (d) => { restOverview = d; },
      status: () => ({ json: () => {} }),
    }
  );

  assert.ok(restOverview, 'Restaurant overview data must be returned');
  assert.equal(restOverview.businessContext?.businessName, restWorkspace.name);
  assert.equal(restOverview.businessContext?.industryKey, 'restaurant_food');
  assert.ok(restOverview.contacts, 'Restaurant contacts metrics must be present');
  assert.equal(typeof restOverview.contacts.total, 'number');

  // 2. Verify Travel Owner & Workspace
  const travelUser = await User.findOne({ email: 'owner.travel@relay-demo.test' });
  if (travelUser) {
    const travelWorkspace = await Workspace.findOne({ _id: travelUser.defaultWorkspaceId });
    assert.ok(travelWorkspace, 'Travel workspace must exist');
    assert.equal(travelWorkspace.industryKey, 'travel_tourism', 'Workspace industryKey must be travel_tourism');
    assert.notEqual(String(restWorkspace._id), String(travelWorkspace._id), 'Workspaces must be segregated');
  }

  // 3. Verify Automobile Owner & Workspace
  const autoUser = await User.findOne({ email: 'owner.automobile@relay-demo.test' });
  if (autoUser) {
    const autoWorkspace = await Workspace.findOne({ _id: autoUser.defaultWorkspaceId });
    assert.ok(autoWorkspace, 'Automobile workspace must exist');
    assert.equal(autoWorkspace.industryKey, 'automobile', 'Workspace industryKey must be automobile');
    assert.notEqual(String(restWorkspace._id), String(autoWorkspace._id), 'Workspaces must be segregated');
  }

  // 4. Verify M2W Realty Owner & Workspace
  const m2wUser = await User.findOne({ email: 'owner.m2w@relay-demo.test' });
  if (m2wUser) {
    const m2wWorkspace = await Workspace.findOne({ _id: m2wUser.defaultWorkspaceId });
    assert.ok(m2wWorkspace, 'M2W workspace must exist');
    assert.equal(m2wWorkspace.industryKey, 'real_estate', 'M2W industryKey must be real_estate');
    assert.notEqual(String(restWorkspace._id), String(m2wWorkspace._id), 'Workspaces must be segregated');
  }

  await mongoose.disconnect();
});
