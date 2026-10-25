import test from 'node:test';
import assert from 'node:assert/strict';
import industryRegistry, {
  getIndustryConfig,
  getStrictIndustryConfig,
  getAllIndustryConfigs,
  getPublicIndustrySummaries,
  VALID_INDUSTRY_KEYS,
} from '../src/config/industries/industryRegistry.js';
import { validateTemplate, resolveTemplate } from '../src/utils/templateEngine.js';

test('Universal Industry Packs — 1. Registry loads all industries with valid stable keys and versions', () => {
  const allConfigs = getAllIndustryConfigs();
  assert.ok(allConfigs.length >= 7, 'All registered industries must be loaded');

  const requiredKeys = ['real_estate', 'gym', 'clinic', 'other'];
  requiredKeys.forEach((key) => {
    const config = getIndustryConfig(key);
    assert.ok(config, `Industry config for "${key}" must exist`);
    assert.ok(config.key === key || (key === 'other' && config.key === 'generic_business'), `Config key must match "${key}"`);
    assert.ok(config.name && config.name.length > 2, `Config "${key}" must have a name`);
    assert.ok(config.description && config.description.length > 10, `Config "${key}" must have a description`);
    assert.equal(config.version, 1, `Config "${key}" must have version 1`);
    assert.ok(config.icon && typeof config.icon === 'string', `Config "${key}" must have an icon identifier`);
    assert.ok(config.terminology && typeof config.terminology === 'object', `Config "${key}" must have terminology`);
  });
});

test('Universal Industry Packs — 2. Real Estate pack defines required fields, 10 templates, 5+ quick replies, keyword rules, and campaign', () => {
  const re = getIndustryConfig('real_estate');
  assert.ok(re);

  // Field definitions: Exactly 14 fields (Task 3)
  const fieldKeys = re.contactFields.map((f) => f.key);
  assert.equal(re.contactFields.length, 14, 'Real Estate must define exactly 14 contact fields');
  assert.ok(fieldKeys.includes('fullName'), 'Must include fullName');
  assert.ok(fieldKeys.includes('phoneNumber'), 'Must include phoneNumber');
  assert.ok(fieldKeys.includes('email'), 'Must include email');
  assert.ok(fieldKeys.includes('leadSource'), 'Must include leadSource');
  assert.ok(fieldKeys.includes('propertyInterest'), 'Must include propertyInterest');
  assert.ok(fieldKeys.includes('interestedPropertyType'), 'Must include interestedPropertyType');
  assert.ok(fieldKeys.includes('interestedProject'), 'Must include interestedProject');
  assert.ok(fieldKeys.includes('preferredLocation'), 'Must include preferredLocation');
  assert.ok(fieldKeys.includes('budgetRange'), 'Must include budgetRange');
  assert.ok(fieldKeys.includes('leadStatus'), 'Must include leadStatus');
  assert.ok(fieldKeys.includes('followUpDate'), 'Must include followUpDate');
  assert.ok(fieldKeys.includes('siteVisitStatus'), 'Must include siteVisitStatus');
  assert.ok(fieldKeys.includes('notes'), 'Must include notes');
  assert.ok(fieldKeys.includes('whatsappConsentStatus'), 'Must include whatsappConsentStatus');

  // Exactly 15 starter templates (Task 4)
  assert.equal(re.templateSuggestions.length, 15, 'Real Estate must define exactly 15 starter templates');
  const templateKeys = re.templateSuggestions.map((t) => t.presetKey);
  assert.ok(templateKeys.includes('re_welcome'), 'Must include re_welcome');
  assert.ok(templateKeys.includes('re_enquiry_ack'), 'Must include re_enquiry_ack');
  assert.ok(templateKeys.includes('re_property_details'), 'Must include re_property_details');
  assert.ok(templateKeys.includes('re_brochure_request'), 'Must include re_brochure_request');
  assert.ok(templateKeys.includes('re_pricing_enquiry'), 'Must include re_pricing_enquiry');
  assert.ok(templateKeys.includes('re_site_visit_invite'), 'Must include re_site_visit_invite');
  assert.ok(templateKeys.includes('re_site_visit_confirmation'), 'Must include re_site_visit_confirmation');
  assert.ok(templateKeys.includes('re_site_visit_reminder'), 'Must include re_site_visit_reminder');
  assert.ok(templateKeys.includes('re_location_directions'), 'Must include re_location_directions');
  assert.ok(templateKeys.includes('re_property_availability'), 'Must include re_property_availability');
  assert.ok(templateKeys.includes('re_customer_followup'), 'Must include re_customer_followup');
  assert.ok(templateKeys.includes('re_post_visit_followup'), 'Must include re_post_visit_followup');
  assert.ok(templateKeys.includes('re_callback_request'), 'Must include re_callback_request');
  assert.ok(templateKeys.includes('re_documentation_process'), 'Must include re_documentation_process');
  assert.ok(templateKeys.includes('re_thank_you'), 'Must include re_thank_you');

  // Every template must pass validateTemplate()
  re.templateSuggestions.forEach((tpl) => {
    const val = validateTemplate(tpl);
    assert.equal(val.errors.length, 0, `Template "${tpl.presetKey}" has validation errors: ${val.errors.join(', ')}`);
  });

  // Exactly 8 quick replies (Task 5)
  assert.equal(re.quickReplyPresets.length, 8, 'Real Estate must define exactly 8 quick replies');
  const qrKeys = re.quickReplyPresets.map((q) => q.key);
  assert.ok(qrKeys.includes('qr_re_brochure'), 'Must have brochure quick reply');
  assert.ok(qrKeys.includes('qr_re_pricing'), 'Must have pricing quick reply');
  assert.ok(qrKeys.includes('qr_re_site_visit'), 'Must have site visit quick reply');
  assert.ok(qrKeys.includes('qr_re_availability'), 'Must have availability quick reply');
  assert.ok(qrKeys.includes('qr_re_location'), 'Must have location quick reply');
  assert.ok(qrKeys.includes('qr_re_callback'), 'Must have callback quick reply');
  assert.ok(qrKeys.includes('qr_re_business_hours'), 'Must have business hours quick reply');
  assert.ok(qrKeys.includes('qr_re_thank_you'), 'Must have thank you quick reply');

  // Keyword rules: Exactly 5 disabled marketing rules + 1 opt-out compliance rule (Task 6)
  const rules = re.automationPresets;
  const marketingRules = rules.filter((r) => r.presetId !== 're_auto_stop');
  assert.equal(marketingRules.length, 5, 'Must define exactly 5 marketing keyword rules');
  marketingRules.forEach((rule) => {
    assert.equal(rule.enabled, false, `Marketing rule "${rule.presetId}" must be disabled by default`);
  });

  const stopRule = rules.find((r) => r.presetId === 're_auto_stop');
  assert.ok(stopRule, 'Must define STOP opt-out compliance rule');
  assert.equal(stopRule.enabled, true, 'Opt-out rule must be active by default');
  assert.equal(stopRule.intendedAction, 'RECORD_OPT_OUT');

  // Exactly 2 sample campaign drafts (Task 7)
  assert.ok(re.sampleCampaignDrafts, 'Must define sample campaign drafts array');
  assert.equal(re.sampleCampaignDrafts.length, 2, 'Must define exactly 2 campaign drafts');
  assert.equal(re.sampleCampaignDrafts[0].campaignName, 'New Property Enquiry Follow-up');
  assert.equal(re.sampleCampaignDrafts[0].status, 'Draft');
  assert.equal(re.sampleCampaignDrafts[1].campaignName, 'Site Visit Follow-up');
  assert.equal(re.sampleCampaignDrafts[1].status, 'Draft');
});

test('Universal Industry Packs — 3. Gym / Fitness pack defines required fields, 10 templates, 5+ quick replies, and campaign', () => {
  const gym = getIndustryConfig('gym');
  assert.ok(gym);

  const fieldKeys = gym.contactFields.map((f) => f.key);
  assert.ok(fieldKeys.includes('fullName'));
  assert.ok(fieldKeys.includes('phoneNumber'));
  assert.ok(fieldKeys.includes('membershipType'));
  assert.ok(fieldKeys.includes('fitnessProgram'));
  assert.ok(fieldKeys.includes('trialSessionInterest'));
  assert.ok(fieldKeys.includes('whatsappConsentStatus'));

  assert.ok(gym.templateSuggestions.length === 10 || gym.templateSuggestions.length === 15, 'Gym must define starter templates');
  gym.templateSuggestions.forEach((tpl) => {
    const val = validateTemplate(tpl);
    assert.equal(val.errors.length, 0, `Gym template "${tpl.presetKey}" failed validation: ${val.errors.join(', ')}`);
  });

  assert.ok(gym.quickReplyPresets && gym.quickReplyPresets.length >= 5, 'Gym must have 5+ quick replies');
  assert.ok(gym.sampleCampaignDraft, 'Gym must have sample campaign draft');
  assert.ok(gym.sampleCampaignDraft.campaignName.includes('Membership Enquiry Follow-up'));
});

test('Universal Industry Packs — 4. Clinic pack defines non-sensitive administrative fields, 10 templates, and privacy compliance', () => {
  const clinic = getIndustryConfig('clinic');
  assert.ok(clinic);

  const fieldKeys = clinic.contactFields.map((f) => f.key);
  assert.ok(fieldKeys.includes('fullName'));
  assert.ok(fieldKeys.includes('phoneNumber'));
  assert.ok(fieldKeys.includes('serviceCategory'));
  assert.ok(fieldKeys.includes('preferredEnquiryTime'));
  assert.ok(fieldKeys.includes('whatsappConsentStatus'));

  // Privacy compliance: strictly no medical diagnosis or health history fields
  clinic.contactFields.forEach((field) => {
    assert.ok(!field.key.toLowerCase().includes('diagnosis'), 'Must not have diagnosis field');
    assert.ok(!field.key.toLowerCase().includes('medical_history'), 'Must not have medical_history field');
    assert.ok(!field.key.toLowerCase().includes('treatment_notes'), 'Must not have treatment_notes field');
  });

  assert.ok(clinic.templateSuggestions.length === 10 || clinic.templateSuggestions.length === 15, 'Clinic must define starter templates');
  clinic.templateSuggestions.forEach((tpl) => {
    const val = validateTemplate(tpl);
    assert.equal(val.errors.length, 0, `Clinic template "${tpl.presetKey}" failed validation: ${val.errors.join(', ')}`);
  });

  assert.ok(clinic.quickReplyPresets && clinic.quickReplyPresets.length >= 5, 'Clinic must have 5+ quick replies');
  assert.ok(clinic.sampleCampaignDraft, 'Clinic must have sample campaign draft');
  assert.equal(clinic.sampleCampaignDraft.campaignName, 'Appointment Enquiry Follow-up');
});

test('Universal Industry Packs — 5. Generic Business pack defines 10 templates, 5+ quick replies, and campaign', () => {
  const other = getIndustryConfig('other');
  assert.ok(other);

  const fieldKeys = other.contactFields.map((f) => f.key);
  assert.ok(fieldKeys.includes('fullName'));
  assert.ok(fieldKeys.includes('phoneNumber'));
  assert.ok(fieldKeys.includes('serviceInterest') || fieldKeys.includes('productServiceInterest'), 'Must include product or service interest field');
  assert.ok(fieldKeys.includes('enquiryType'));
  assert.ok(fieldKeys.includes('whatsappConsentStatus'));

  assert.ok(other.templateSuggestions.length === 10 || other.templateSuggestions.length === 15, 'Generic must define starter templates');
  other.templateSuggestions.forEach((tpl) => {
    const val = validateTemplate(tpl);
    assert.equal(val.errors.length, 0, `Generic template "${tpl.presetKey}" failed validation: ${val.errors.join(', ')}`);
  });

  assert.ok(other.quickReplyPresets && other.quickReplyPresets.length >= 5, 'Generic must have 5+ quick replies');
  assert.ok(other.sampleCampaignDraft, 'Generic must have sample campaign draft');
  assert.ok(
    other.sampleCampaignDraft.campaignName === 'New Enquiry Follow-up' ||
    other.sampleCampaignDraft.campaignName === 'Customer Enquiry Follow-up',
    'Generic must have valid sample campaign draft name'
  );
});

test('Universal Industry Packs — 6. Fallback and alias resolution works for unknown or aliased keys', () => {
  // Alias 'generic' -> 'generic_business' / 'other'
  const genericConfig = getIndustryConfig('generic');
  assert.ok(genericConfig.key === 'other' || genericConfig.key === 'generic_business', 'Alias "generic" must resolve to generic pack');

  // Alias 'fitness' -> 'gym'
  const fitnessConfig = getIndustryConfig('fitness');
  assert.equal(fitnessConfig.key, 'gym', 'Alias "fitness" must resolve to "gym"');

  // Completely unknown key falls back to generic_business / 'other'
  const unknownConfig = getIndustryConfig('crypto_currency_trading');
  assert.ok(unknownConfig.key === 'other' || unknownConfig.key === 'generic_business', 'Unknown key must fall back to generic pack');

  // Strict resolver returns null for unknown
  const strictUnknown = getStrictIndustryConfig('crypto_currency_trading');
  assert.equal(strictUnknown, null, 'Strict resolver must return null for unsupported key');
});

test('Universal Industry Packs — 7. Template variable resolution works across industries without errors', () => {
  const contact = {
    _id: '507f1f77bcf86cd799439011',
    fullName: 'Aarav Sharma',
    companyName: 'Sharma Holdings',
    city: 'Gurugram',
    phoneNumber: '+919811223344',
    interestedPropertyType: '3 BHK Luxury Flat',
    interestedProject: 'DLF The Arbour',
    preferredLocation: 'Golf Course Extension Road',
    budgetRange: '₹1.5 Cr - ₹2.5 Cr',
    membershipType: 'Annual Membership',
    fitnessProgram: 'Strength Training',
    serviceCategory: 'General Consultation',
    preferredEnquiryTime: 'Morning (9:00 AM - 1:00 PM)',
    serviceInterest: 'Corporate IT Consulting',
  };

  const user = {
    name: 'M2W Admin',
    businessName: 'M2W Realty',
    businessPhone: '+919811122233',
  };

  const reTpl = {
    header: 'Welcome to {{business_name}}',
    body: 'Hi {{customer_name}}, thank you for inquiring about {{project_name}} ({{property_type}} in {{budget_range}}).',
    footer: '',
    buttons: [],
  };

  const reRes = resolveTemplate(reTpl, contact, user);
  assert.ok(reRes.valid, 'Real estate template must resolve valid');
  assert.ok(reRes.body.includes('Aarav Sharma'));
  assert.ok(reRes.body.includes('DLF The Arbour'));
  assert.ok(reRes.body.includes('3 BHK Luxury Flat'));

  const gymTpl = {
    header: 'Workout at {{business_name}}',
    body: 'Hi {{customer_name}}, your {{membership_type}} for {{fitness_program}} is ready.',
    footer: '',
    buttons: [],
  };

  const gymRes = resolveTemplate(gymTpl, contact, user);
  assert.ok(gymRes.valid, 'Gym template must resolve valid');
  assert.ok(gymRes.body.includes('Annual Membership'));
  assert.ok(gymRes.body.includes('Strength Training'));
});
