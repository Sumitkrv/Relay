import { test } from 'node:test';
import assert from 'node:assert/strict';
import industryRegistry, {
  TARGET_INDUSTRY_IDENTIFIERS,
  SUPPORTED_INDUSTRY_CATALOG,
  VALID_INDUSTRY_KEYS,
  getIndustryConfig,
  getStrictIndustryConfig,
  getAllSupportedIndustries,
  getAllIndustryConfigs,
} from '../src/config/industries/industryRegistry.js';
import { validateIndustryDefinition } from '../src/config/industries/industrySchema.js';
import { extractVariables, resolveTemplate, validateTemplate } from '../src/utils/templateEngine.js';

const COMPLETED_INDUSTRIES = [
  'real_estate',
  'education',
  'gym',
  'clinic',
  'salon',
  'automobile',
];

const COMPLETED_CATALOG_IDS = [
  'real_estate',
  'education_coaching',
  'gym_fitness',
  'clinic_dental',
  'salon_beauty',
  'automobile',
  'travel_tourism',
  'restaurant_food',
  'professional_services',
  'generic_business',
  // Completed in Master Prompt 14 (previously planned and silently resolved to Generic).
  'ecommerce_retail',
  'home_services',
  'hospitality',
];

const PLANNED_CATALOG_IDS = [];

test('Master Prompt 02/08 — 1. Registry loads all completed industry packs and identifies planned industries', () => {
  const catalog = getAllSupportedIndustries();
  assert.equal(catalog.length, 13, 'Catalog must provide metadata for all 13 industries');

  const readyPacks = catalog.filter((c) => c.status === 'ready');
  assert.equal(readyPacks.length, 13, 'All 13 industries must be completed ready packs');

  COMPLETED_CATALOG_IDS.forEach((id) => {
    const entry = catalog.find((c) => c.id === id);
    assert.ok(entry, `Ready entry for "${id}" must exist in catalog`);
    assert.equal(entry.status, 'ready', `Entry "${id}" status must be ready`);
    assert.equal(entry.hasCompletePack, true, `Entry "${id}" hasCompletePack must be true`);
    assert.equal(entry.packVersion, '1.1.0', `Entry "${id}" packVersion must be 1.1.0`);
  });

  const plannedPacks = catalog.filter((c) => c.status === 'planned');
  assert.equal(plannedPacks.length, 0, 'No planned industries remain');

  PLANNED_CATALOG_IDS.forEach((id) => {
    const entry = catalog.find((c) => c.id === id);
    assert.ok(entry, `Planned entry for "${id}" must exist in catalog`);
    assert.equal(entry.status, 'planned', `Entry "${id}" status must be planned`);
    assert.equal(entry.hasCompletePack, false, `Entry "${id}" hasCompletePack must be false`);
  });
});

test('Master Prompt 02/08 — 2. All 5 new industry packs (and Real Estate) load successfully with schema validation', () => {
  COMPLETED_INDUSTRIES.forEach((key) => {
    const config = getIndustryConfig(key);
    assert.ok(config, `Config for "${key}" must load successfully`);
    assert.equal(config.key, key, `Config key must match "${key}"`);
    assert.equal(config.packVersion, '1.1.0', `Pack version for "${key}" must be 1.1.0`);
    assert.ok(validateIndustryDefinition(config), `Config for "${key}" must pass schema validation`);
  });
});

test('Master Prompt 02/08 — 3. Every pack contains exactly 15 message templates (90 total)', () => {
  let totalTemplates = 0;
  COMPLETED_INDUSTRIES.forEach((key) => {
    const config = getIndustryConfig(key);
    assert.ok(config.templateSuggestions, `"${key}" must have templateSuggestions`);
    assert.equal(
      config.templateSuggestions.length,
      15,
      `"${key}" must have exactly 15 message templates (found ${config.templateSuggestions.length})`
    );
    totalTemplates += config.templateSuggestions.length;

    config.templateSuggestions.forEach((tpl) => {
      assert.ok(tpl.presetKey || tpl.key, `Template in "${key}" missing unique ID`);
      assert.ok(tpl.title || tpl.name, `Template "${tpl.presetKey}" missing name`);
      assert.ok(tpl.body && tpl.body.trim().length > 15, `Template "${tpl.presetKey}" has too short or empty body`);
      assert.ok(tpl.category, `Template "${tpl.presetKey}" missing category`);
      assert.ok(tpl.language, `Template "${tpl.presetKey}" missing language`);
      assert.equal(tpl.submissionState, 'unsubmitted_draft', `Template "${tpl.presetKey}" must be unsubmitted_draft`);

      const val = validateTemplate(tpl);
      assert.equal(val.errors.length, 0, `Template "${tpl.presetKey}" validation failed: ${val.errors.join(', ')}`);
    });
  });

  assert.equal(totalTemplates, 90, 'All 6 completed industries must provide exactly 90 templates (15 * 6)');
});

test('Master Prompt 02/08 — 4. Every pack contains exactly 8 Quick Replies (48 total)', () => {
  let totalQuickReplies = 0;
  COMPLETED_INDUSTRIES.forEach((key) => {
    const config = getIndustryConfig(key);
    assert.ok(config.quickReplyPresets, `"${key}" must have quickReplyPresets`);
    assert.equal(
      config.quickReplyPresets.length,
      8,
      `"${key}" must have exactly 8 Quick Replies (found ${config.quickReplyPresets.length})`
    );
    totalQuickReplies += config.quickReplyPresets.length;

    config.quickReplyPresets.forEach((qr) => {
      assert.ok(qr.key, `Quick Reply in "${key}" missing key`);
      assert.ok(qr.title, `Quick Reply "${qr.key}" missing title`);
      assert.ok(qr.shortcut && qr.shortcut.startsWith('/'), `Quick Reply "${qr.key}" missing slash shortcut`);
      assert.ok(qr.text && qr.text.trim().length > 10, `Quick Reply "${qr.key}" has empty or too short text`);
    });
  });

  assert.equal(totalQuickReplies, 48, 'All 6 completed industries must provide exactly 48 Quick Replies (8 * 6)');
});

test('Master Prompt 02/08 — 5. Every pack contains exactly 5 Keyword Auto-Reply Rules disabled by default (+ 1 opt-out compliance rule)', () => {
  let totalMarketingRules = 0;
  COMPLETED_INDUSTRIES.forEach((key) => {
    const config = getIndustryConfig(key);
    assert.ok(config.automationPresets, `"${key}" must have automationPresets`);

    const marketingRules = config.automationPresets.filter((r) => !r.presetId.includes('stop'));
    assert.equal(
      marketingRules.length,
      5,
      `"${key}" must have exactly 5 marketing keyword rules (found ${marketingRules.length})`
    );
    totalMarketingRules += marketingRules.length;

    marketingRules.forEach((rule) => {
      assert.equal(rule.enabled, false, `Starter rule "${rule.presetId}" must be disabled by default`);
      assert.ok(rule.triggerKeywords && rule.triggerKeywords.length > 0, `Rule "${rule.presetId}" missing keywords`);
      assert.ok(rule.matchType, `Rule "${rule.presetId}" missing matchType`);
      const resp = rule.responseMessage || rule.suggestedResponse || rule.replyMessage;
      assert.ok(resp && resp.trim().length > 10, `Rule "${rule.presetId}" has empty response message`);
    });

    // Check opt-out STOP rule
    const stopRule = config.automationPresets.find((r) => r.presetId.includes('stop'));
    assert.ok(stopRule, `"${key}" must have a STOP opt-out compliance rule`);
    assert.equal(stopRule.enabled, true, `STOP rule in "${key}" must be enabled for compliance`);
  });

  assert.equal(totalMarketingRules, 30, 'All 6 completed industries must provide exactly 30 marketing rules (5 * 6)');
});

test('Master Prompt 02/08 — 6. Every pack contains exactly 2 Sample Campaign Drafts (12 total, Draft status, no recipients)', () => {
  let totalCampaigns = 0;
  COMPLETED_INDUSTRIES.forEach((key) => {
    const config = getIndustryConfig(key);
    assert.ok(config.sampleCampaignDrafts, `"${key}" must have sampleCampaignDrafts`);
    assert.equal(
      config.sampleCampaignDrafts.length,
      2,
      `"${key}" must have exactly 2 campaign drafts (found ${config.sampleCampaignDrafts.length})`
    );
    totalCampaigns += config.sampleCampaignDrafts.length;

    const templateKeys = config.templateSuggestions.map((t) => t.presetKey || t.key);

    config.sampleCampaignDrafts.forEach((camp) => {
      assert.ok(camp.campaignId, `Campaign in "${key}" missing campaignId`);
      assert.ok(camp.campaignName, `Campaign in "${key}" missing campaignName`);
      assert.equal(camp.status, 'Draft', `Campaign "${camp.campaignId}" status must be "Draft"`);
      assert.equal(camp.scheduledAt, null, `Campaign "${camp.campaignId}" scheduledAt must be null`);
      assert.equal(camp.executionHistory, null, `Campaign "${camp.campaignId}" executionHistory must be null`);
      assert.deepEqual(camp.recipientList, [], `Campaign "${camp.campaignId}" recipientList must be empty`);
      assert.ok(
        templateKeys.includes(camp.targetTemplateKey),
        `Campaign "${camp.campaignId}" references unknown template "${camp.targetTemplateKey}"`
      );
    });
  });

  assert.equal(totalCampaigns, 12, 'All 6 completed industries must provide exactly 12 campaign drafts (2 * 6)');
});

test('Master Prompt 02/08 — 7. All 90 Template IDs across all 6 packs are globally unique', () => {
  const globalTemplateIds = new Set();
  const duplicateIds = [];

  COMPLETED_INDUSTRIES.forEach((key) => {
    const config = getIndustryConfig(key);
    config.templateSuggestions.forEach((tpl) => {
      const id = tpl.presetKey || tpl.key;
      if (globalTemplateIds.has(id)) {
        duplicateIds.push(id);
      }
      globalTemplateIds.add(id);
    });
  });

  assert.equal(duplicateIds.length, 0, `Duplicate template IDs found: ${duplicateIds.join(', ')}`);
  assert.equal(globalTemplateIds.size, 90, 'All 90 templates must have distinct unique IDs');
});

test('Master Prompt 02/08 — 8. Variable Resolution works accurately for each industry with standard and custom tokens', () => {
  // 1. Education
  const eduTemplate = 'Hello {{customer_name}}, welcome to {{business_name}}! Inquire about {{course_name}} batch on {{batch_date}} at our {{branch_name}} campus.';
  const eduResolved = resolveTemplate(
    { body: eduTemplate },
    { fullName: 'Ananya Roy', courseName: 'Full Stack Web Dev', batchDate: 'Nov 1st', branchName: 'North Campus' },
    { businessName: 'Apex Academy' }
  ).body;
  assert.ok(eduResolved.includes('Hello Ananya Roy,'), 'Must render student name');
  assert.ok(eduResolved.includes('Apex Academy'), 'Must render business name');
  assert.ok(eduResolved.includes('Full Stack Web Dev'), 'Must render course name');
  assert.ok(eduResolved.includes('Nov 1st'), 'Must render batch date');
  assert.ok(eduResolved.includes('North Campus'), 'Must render branch name');

  // 2. Gym
  const gymTemplate = 'Hi {{customer_name}}, your {{membership_plan}} trial at {{business_name}} ({{branch_name}}) is on {{trial_date}}.';
  const gymResolved = resolveTemplate(
    { body: gymTemplate },
    { fullName: 'Karan Mehra', membershipPlan: 'Annual VIP Gold Plan', branchName: 'Downtown Hub', trialDate: 'Tomorrow 10 AM' },
    { businessName: 'FitZone Club' }
  ).body;
  assert.ok(gymResolved.includes('Hi Karan Mehra,'), 'Must render customer name');
  assert.ok(gymResolved.includes('Annual VIP Gold Plan'), 'Must render membership plan');
  assert.ok(gymResolved.includes('FitZone Club'), 'Must render gym name');
  assert.ok(gymResolved.includes('Downtown Hub'), 'Must render branch name');
  assert.ok(gymResolved.includes('Tomorrow 10 AM'), 'Must render trial date');

  // 3. Clinic
  const clinicTemplate = 'Dear {{customer_name}}, your appointment at {{business_name}} ({{branch_name}}) for {{service_name}} is on {{appointment_date}}.';
  const clinicResolved = resolveTemplate(
    { body: clinicTemplate },
    { fullName: 'Priya Nair', serviceName: 'Dental Checkup', branchName: 'Main Wellness Center', appointmentDate: 'Oct 25th 11 AM' },
    { businessName: 'CarePlus Dental' }
  ).body;
  assert.ok(clinicResolved.includes('Dear Priya Nair,'), 'Must render patient name');
  assert.ok(clinicResolved.includes('CarePlus Dental'), 'Must render clinic name');
  assert.ok(clinicResolved.includes('Main Wellness Center'), 'Must render clinic branch');
  assert.ok(clinicResolved.includes('Dental Checkup'), 'Must render service name');
  assert.ok(clinicResolved.includes('Oct 25th 11 AM'), 'Must render appointment date');

  // 4. Salon
  const salonTemplate = 'Hello {{customer_name}}, booking request at {{business_name}} ({{branch_name}}) for {{service_name}} on {{appointment_date}}.';
  const salonResolved = resolveTemplate(
    { body: salonTemplate },
    { fullName: 'Neha Sen', serviceName: 'Hydra Facial', branchName: 'Mall Road Studio', appointmentDate: 'Sunday 3 PM' },
    { businessName: 'Luxe Salon' }
  ).body;
  assert.ok(salonResolved.includes('Hello Neha Sen,'), 'Must render customer name');
  assert.ok(salonResolved.includes('Luxe Salon'), 'Must render salon name');
  assert.ok(salonResolved.includes('Mall Road Studio'), 'Must render salon branch');
  assert.ok(salonResolved.includes('Hydra Facial'), 'Must render service name');
  assert.ok(salonResolved.includes('Sunday 3 PM'), 'Must render appointment date');

  // 5. Automobile
  const autoTemplate = 'Hi {{customer_name}}, {{business_name}} invites you to test drive the {{vehicle_model}} at {{branch_name}} on {{test_drive_date}}.';
  const autoResolved = resolveTemplate(
    { body: autoTemplate },
    { fullName: 'Sanjay Dutt', vehicleModel: 'EV Neo SUV', branchName: 'South City Showroom', testDriveDate: 'Saturday 2 PM' },
    { businessName: 'Speedway Motors' }
  ).body;
  assert.ok(autoResolved.includes('Hi Sanjay Dutt,'), 'Must render customer name');
  assert.ok(autoResolved.includes('Speedway Motors'), 'Must render dealership name');
  assert.ok(autoResolved.includes('EV Neo SUV'), 'Must render vehicle model');
  assert.ok(autoResolved.includes('South City Showroom'), 'Must render showroom branch');
  assert.ok(autoResolved.includes('Saturday 2 PM'), 'Must render test drive date');
});

test('Master Prompt 02/08 — 9. Strict Healthcare safety compliance for Clinics & Dental pack', () => {
  const clinic = getIndustryConfig('clinic');
  assert.ok(clinic);

  // Field verification: strictly administrative only
  clinic.contactFields.forEach((field) => {
    const k = field.key.toLowerCase();
    assert.ok(!k.includes('diagnosis'), `Field "${field.key}" must not contain diagnosis`);
    assert.ok(!k.includes('medical_history'), `Field "${field.key}" must not contain medical_history`);
    assert.ok(!k.includes('prescription'), `Field "${field.key}" must not contain prescription`);
    assert.ok(!k.includes('treatment_notes'), `Field "${field.key}" must not contain treatment_notes`);
    assert.ok(!k.includes('lab_result'), `Field "${field.key}" must not contain lab_result`);
  });

  // Template inspection: ensure no clinical assumptions or invented treatments
  clinic.templateSuggestions.forEach((tpl) => {
    const b = tpl.body.toLowerCase();
    assert.ok(!b.includes('diagnosis:'), 'Templates must not invent diagnosis records');
    assert.ok(!b.includes('mg '), 'Templates must not invent drug dosages');
    assert.ok(!b.includes('prescription:'), 'Templates must not invent prescription lists');
  });
});

test('Master Prompt 02/08 — 10. Alias resolution works for all 5 new industry keys', () => {
  const edu1 = getIndustryConfig('education');
  const edu2 = getIndustryConfig('education_coaching');
  assert.equal(edu1.key, edu2.key);

  const gym1 = getIndustryConfig('gym');
  const gym2 = getIndustryConfig('gym_fitness');
  assert.equal(gym1.key, gym2.key);

  const clinic1 = getIndustryConfig('clinic');
  const clinic2 = getIndustryConfig('clinic_dental');
  assert.equal(clinic1.key, clinic2.key);

  const salon1 = getIndustryConfig('salon');
  const salon2 = getIndustryConfig('salon_beauty');
  assert.equal(salon1.key, salon2.key);

  const auto1 = getIndustryConfig('automobile');
  assert.ok(auto1);
  assert.equal(auto1.key, 'automobile');
});

test('Master Prompt 02/08 — 11. Every catalog industry resolves to its OWN pack (no silent Generic/Real Estate substitution)', () => {
  const catalog = getAllSupportedIndustries();
  assert.equal(catalog.filter((c) => c.status === 'planned').length, 0);
  const expectedKey = { education_coaching: 'education', gym_fitness: 'gym', clinic_dental: 'clinic', salon_beauty: 'salon' };
  catalog.forEach((entry) => {
    const strict = getStrictIndustryConfig(entry.id);
    assert.ok(strict, `"${entry.id}" must resolve via strict resolver`);
    assert.equal(strict.key, expectedKey[entry.id] || entry.id, `"${entry.id}" must not be substituted by another pack`);
  });
  assert.equal(getStrictIndustryConfig('spaceship_dealer'), null, 'Unknown industries stay unresolved in strict mode');
  assert.notEqual(getIndustryConfig('spaceship_dealer').key, 'real_estate', 'Never fall back to Real Estate');
});
