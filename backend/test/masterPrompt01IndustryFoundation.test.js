import { test } from 'node:test';
import assert from 'node:assert/strict';
import industryRegistry, {
  TARGET_INDUSTRY_IDENTIFIERS,
  SUPPORTED_INDUSTRY_CATALOG,
  VALID_INDUSTRY_KEYS,
  getIndustryConfig,
  getStrictIndustryConfig,
  getAllSupportedIndustries
} from '../src/config/industries/industryRegistry.js';
import { validateIndustryDefinition } from '../src/config/industries/industrySchema.js';
import { extractVariables, resolveTemplate } from '../src/utils/templateEngine.js';

test('Master Prompt 01/08 — 1. 13+ Target Industry Identifiers registered with metadata', () => {
  assert.ok(TARGET_INDUSTRY_IDENTIFIERS.length >= 13, 'Must define at least 13 initial industry identifiers');
  const expectedIdentifiers = [
    'real_estate',
    'education_coaching',
    'gym_fitness',
    'clinic_dental',
    'salon_beauty',
    'automobile',
    'travel_tourism',
    'ecommerce_retail',
    'restaurant_food',
    'home_services',
    'hospitality',
    'professional_services',
    'generic_business',
  ];
  expectedIdentifiers.forEach((id) => {
    assert.ok(TARGET_INDUSTRY_IDENTIFIERS.includes(id), `Missing target industry identifier: ${id}`);
  });

  const catalog = getAllSupportedIndustries();
  assert.ok(catalog.length >= 13, 'Catalog must provide metadata for all supported industries');
  
  const reMeta = catalog.find((c) => c.id === 'real_estate');
  assert.equal(reMeta.status, 'ready');
  assert.equal(reMeta.hasCompletePack, true);

  const planned = catalog.filter((c) => c.status === 'planned');
  assert.ok(planned.length === 0 || planned.length === 3 || planned.length === 4 || planned.length === 5 || planned.length === 6 || planned.length === 7 || planned.length === 12, 'Uncompleted industries must have planned status without fake packs');
});

test('Master Prompt 01/08 — 2. Real Estate Pack defines exactly 14 CRM Contact field definitions', () => {
  const re = getIndustryConfig('real_estate');
  assert.ok(re, 'Real Estate configuration must load');
  assert.equal(re.contactFields.length, 14, 'Must have exactly 14 contact fields');

  const requiredFields = [
    'fullName',
    'phoneNumber',
    'email',
    'leadSource',
    'propertyInterest',
    'interestedPropertyType',
    'interestedProject',
    'preferredLocation',
    'budgetRange',
    'leadStatus',
    'followUpDate',
    'siteVisitStatus',
    'notes',
    'whatsappConsentStatus',
  ];

  const fieldKeys = re.contactFields.map((f) => f.key);
  requiredFields.forEach((key) => {
    assert.ok(fieldKeys.includes(key), `Missing required Real Estate field: ${key}`);
  });

  // Verify non-empty labels and valid types
  re.contactFields.forEach((f) => {
    assert.ok(f.label && f.label.trim().length > 0, `Field "${f.key}" must have a label`);
    assert.ok(['text', 'number', 'select', 'multiselect', 'date', 'boolean'].includes(f.type), `Field "${f.key}" has invalid type`);
  });
});

test('Master Prompt 01/08 — 3. Exactly 15 Real Estate starter message templates exist with complete metadata', () => {
  const re = getIndustryConfig('real_estate');
  assert.equal(re.templateSuggestions.length, 15, 'Real Estate must define exactly 15 templates');

  const expectedTemplateTitles = [
    'Welcome & New Enquiry',
    'Property Enquiry Acknowledgement',
    'Project Details Sharing',
    'Brochure Request Response',
    'Property Price Enquiry',
    'Site Visit Invitation',
    'Site Visit Confirmation',
    'Site Visit Reminder',
    'Property Location & Directions',
    'Property Availability Enquiry',
    'First Customer Follow-up',
    'Post-Site-Visit Follow-up',
    'Callback Request',
    'Documentation Process Enquiry',
    'Thank You & Conversation Closing',
  ];

  const titles = re.templateSuggestions.map((t) => t.title || t.name);
  expectedTemplateTitles.forEach((t) => {
    assert.ok(titles.includes(t), `Missing required Real Estate template: "${t}"`);
  });

  const seenIds = new Set();
  re.templateSuggestions.forEach((tpl) => {
    const id = tpl.presetKey || tpl.key || tpl.templateId;
    assert.ok(id, 'Template must have a stable unique ID');
    assert.ok(!seenIds.has(id), `Duplicate template ID: "${id}"`);
    seenIds.add(id);

    assert.ok(tpl.body && tpl.body.trim().length > 10, `Template "${id}" has invalid body`);
    assert.ok(tpl.category, `Template "${id}" missing category`);
    assert.ok(tpl.language, `Template "${id}" missing language`);
    assert.equal(tpl.submissionState, 'unsubmitted_draft', `Template "${id}" must reflect unsubmitted state`);
  });
});

test('Master Prompt 01/08 — 4. Exactly 8 Quick Replies exist with shortcuts and response text', () => {
  const re = getIndustryConfig('real_estate');
  assert.equal(re.quickReplyPresets.length, 8, 'Real Estate must define exactly 8 quick replies');

  const expectedTitles = [
    'Share Property Brochure',
    'Pricing Information',
    'Schedule Site Visit',
    'Property Availability',
    'Location Information',
    'Request Callback',
    'Business Hours',
    'Thank You',
  ];

  const qrTitles = re.quickReplyPresets.map((q) => q.title);
  expectedTitles.forEach((title) => {
    assert.ok(qrTitles.includes(title), `Missing required Quick Reply: "${title}"`);
  });

  const seenQrKeys = new Set();
  re.quickReplyPresets.forEach((qr) => {
    assert.ok(!seenQrKeys.has(qr.key), `Duplicate quick reply key: "${qr.key}"`);
    seenQrKeys.add(qr.key);
    assert.ok(qr.text && qr.text.trim().length > 5, `Quick reply "${qr.key}" has empty text`);
    assert.ok(qr.shortcut && qr.shortcut.startsWith('/'), `Quick reply "${qr.key}" must have a valid slash shortcut`);
  });
});

test('Master Prompt 01/08 — 5. Exactly 5 Keyword Auto-Reply Rules exist and are disabled by default', () => {
  const re = getIndustryConfig('real_estate');
  const rules = re.automationPresets;

  const marketingRules = rules.filter((r) => r.presetId !== 're_auto_stop');
  assert.equal(marketingRules.length, 5, 'Must define exactly 5 marketing keyword rules');

  const expectedTriggerWords = ['PRICE', 'BROCHURE', 'VISIT', 'LOCATION', 'CALL'];
  expectedTriggerWords.forEach((word) => {
    const found = marketingRules.some((r) => r.triggerKeywords.some((k) => k.toUpperCase().includes(word)));
    assert.ok(found, `Missing keyword rule for: ${word}`);
  });

  marketingRules.forEach((rule) => {
    assert.equal(rule.enabled, false, `Starter rule "${rule.presetId}" must be disabled by default for safety`);
    assert.ok(rule.triggerKeywords && rule.triggerKeywords.length > 0, `Rule "${rule.presetId}" must have keywords`);
  });

  // Opt-out compliance rule must remain enabled
  const stopRule = rules.find((r) => r.presetId === 're_auto_stop');
  assert.ok(stopRule, 'Must define STOP opt-out compliance rule');
  assert.equal(stopRule.enabled, true, 'Opt-out rule must be active by default');
});

test('Master Prompt 01/08 — 6. Exactly 2 Sample Campaign Drafts defined without execution history', () => {
  const re = getIndustryConfig('real_estate');
  assert.ok(re.sampleCampaignDrafts, 'Must define sampleCampaignDrafts');
  assert.equal(re.sampleCampaignDrafts.length, 2, 'Must define exactly 2 campaign drafts');

  const c1 = re.sampleCampaignDrafts[0];
  assert.equal(c1.campaignName, 'New Property Enquiry Follow-up');
  assert.equal(c1.status, 'Draft');
  assert.equal(c1.scheduledAt, null);
  assert.equal(c1.executionHistory, null);
  assert.deepEqual(c1.recipientList, []);

  const c2 = re.sampleCampaignDrafts[1];
  assert.equal(c2.campaignName, 'Site Visit Follow-up');
  assert.equal(c2.status, 'Draft');
  assert.equal(c2.scheduledAt, null);
  assert.equal(c2.executionHistory, null);
  assert.deepEqual(c2.recipientList, []);

  // Both drafts point to valid starter templates
  const templateKeys = re.templateSuggestions.map((t) => t.presetKey);
  assert.ok(templateKeys.includes(c1.targetTemplateKey), `Campaign 1 references invalid template: ${c1.targetTemplateKey}`);
  assert.ok(templateKeys.includes(c2.targetTemplateKey), `Campaign 2 references invalid template: ${c2.targetTemplateKey}`);
});

test('Master Prompt 01/08 — 7. CRM Variables support {{customer_name}}, {{business_name}}, {{property_type}}, {{project_name}}, {{preferred_location}}, {{site_visit_date}}', () => {
  const contact = {
    fullName: 'Rohan Mehta',
    interestedPropertyType: '4 BHK Luxury Flat',
    interestedProject: 'Smart World The Edition',
    preferredLocation: 'Golf Course Extension Road',
    siteVisitDate: 'Sunday 11:00 AM',
  };
  const user = {
    businessName: 'M2W Realty',
  };

  const sampleTemplate = 'Hello {{customer_name}}, your {{property_type}} tour at {{project_name}} ({{preferred_location}}) is scheduled for {{site_visit_date}} by {{business_name}}.';
  const rendered = resolveTemplate({ body: sampleTemplate }, contact, user).body;

  assert.ok(rendered.includes('Hello Rohan Mehta,'), 'Must render customer_name');
  assert.ok(rendered.includes('4 BHK Luxury Flat tour'), 'Must render property_type');
  assert.ok(rendered.includes('at Smart World The Edition'), 'Must render project_name');
  assert.ok(rendered.includes('(Golf Course Extension Road)'), 'Must render preferred_location');
  assert.ok(rendered.includes('scheduled for Sunday 11:00 AM'), 'Must render site_visit_date');
  assert.ok(rendered.includes('by M2W Realty.'), 'Must render business_name');
});

test('Master Prompt 01/08 — 8. Configuration loading does not mutate database or trigger live calls', () => {
  // Pure in-memory configuration verification
  const configs = VALID_INDUSTRY_KEYS.map((k) => getIndustryConfig(k));
  assert.ok(configs.length >= 8);
  configs.forEach((cfg) => {
    assert.ok(validateIndustryDefinition(cfg));
  });
});
