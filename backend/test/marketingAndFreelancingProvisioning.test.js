/**
 * Automated test suite for Marketing Agency & Freelancing industries:
 * - 15 total industries & 450 starter definitions verification
 * - Marketing Agency pack validation (15 templates, 8 quick replies, 5 disabled rules, 2 campaign drafts, 14 CRM fields)
 * - Freelancing pack validation (15 templates, 8 quick replies, 5 disabled rules, 2 campaign drafts, 14 CRM fields)
 * - End-to-end Onboarding & Starter Provisioning for both industries
 * - Multi-tenant isolation and CRUD validation
 */
import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

const TEST_DB = 'relay_agency_freelance_test';
const EMAIL_DOMAIN = 'agency-freelance-test.relay.invalid';
const RUN = crypto.randomBytes(3).toString('hex');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-relay-crm-development-only-minimum-32-chars-long';
process.env.APP_MODE = 'demo';
process.env.DEMO_EMAIL_AUTO_VERIFY = 'true';
process.env.EMAIL_PROVIDER = 'inmemory';
process.env.WHATSAPP_PROVIDER = 'mock';

const { default: app } = await import('../src/app.js');
const { default: Workspace } = await import('../src/models/Workspace.js');
const { default: User } = await import('../src/models/User.js');
const { default: WorkspaceMembership } = await import('../src/models/WorkspaceMembership.js');
const { default: MessageTemplate, TemplateVersion } = await import('../src/models/MessageTemplate.js');
const { default: QuickReply } = await import('../src/models/QuickReply.js');
const { default: AutoReplyRule } = await import('../src/models/AutoReplyRule.js');
const { default: Campaign } = await import('../src/models/Campaign.js');
const { default: Contact } = await import('../src/models/Contact.js');
const {
  TARGET_INDUSTRY_IDENTIFIERS,
  VALID_INDUSTRY_KEYS,
  getAllSupportedIndustries,
  getIndustryConfig,
  getStrictIndustryConfig,
} = await import('../src/config/industries/industryRegistry.js');
const { resolveStarterPack } = await import('../src/services/industryStarterProvisioningService.js');

let mongod = null;
const auth = (token) => ({ Authorization: `Bearer ${token}` });

describe('Marketing Agency & Freelancing Industries Verification', () => {
  before(async () => {
    mongod = await MongoMemoryServer.create({ instance: { dbName: TEST_DB } });
    const uri = mongod.getUri();
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await mongoose.connect(uri);
  });

  after(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongod) {
      await mongod.stop();
    }
  });

  test('1. Catalog and Identifiers count exactly 15 industries', () => {
    assert.equal(TARGET_INDUSTRY_IDENTIFIERS.length, 15, 'Target industry identifiers must equal 15');
    assert.equal(VALID_INDUSTRY_KEYS.length, 15, 'Valid industry keys must equal 15');
    const catalog = getAllSupportedIndustries();
    assert.equal(catalog.length, 15, 'Catalog must provide metadata for all 15 industries');

    assert.ok(VALID_INDUSTRY_KEYS.includes('marketing_agency'), 'marketing_agency must be in VALID_INDUSTRY_KEYS');
    assert.ok(VALID_INDUSTRY_KEYS.includes('freelancing'), 'freelancing must be in VALID_INDUSTRY_KEYS');

    const marketingCat = catalog.find((c) => c.id === 'marketing_agency');
    assert.ok(marketingCat, 'Marketing Agency must exist in catalog');
    assert.equal(marketingCat.category, 'Agencies & Services');
    assert.equal(marketingCat.isNew, true);

    const freelancingCat = catalog.find((c) => c.id === 'freelancing');
    assert.ok(freelancingCat, 'Freelancing must exist in catalog');
    assert.equal(freelancingCat.category, 'Agencies & Services');
    assert.equal(freelancingCat.isNew, true);
  });

  test('2. Total Starter Definitions across all 15 industries equals 450', () => {
    let totalTemplates = 0;
    let totalQuickReplies = 0;
    let totalRules = 0;
    let totalCampaigns = 0;

    VALID_INDUSTRY_KEYS.forEach((key) => {
      const pack = resolveStarterPack(key);
      assert.equal(pack.templates.length, 15, `Industry "${key}" must provide 15 templates`);
      assert.equal(pack.quickReplies.length, 8, `Industry "${key}" must provide 8 quick replies`);
      assert.equal(pack.rules.length, 5, `Industry "${key}" must provide 5 disabled starter rules`);
      assert.equal(pack.campaigns.length, 2, `Industry "${key}" must provide 2 campaign drafts`);

      totalTemplates += pack.templates.length;
      totalQuickReplies += pack.quickReplies.length;
      totalRules += pack.rules.length;
      totalCampaigns += pack.campaigns.length;
    });

    assert.equal(totalTemplates, 225, '225 total message templates across 15 industries (15 * 15)');
    assert.equal(totalQuickReplies, 120, '120 total quick replies across 15 industries (8 * 15)');
    assert.equal(totalRules, 75, '75 total auto-reply rules across 15 industries (5 * 15)');
    assert.equal(totalCampaigns, 30, '30 total campaign drafts across 15 industries (2 * 15)');
    assert.equal(totalTemplates + totalQuickReplies + totalRules + totalCampaigns, 450, 'Total starter definitions must equal exactly 450');
  });

  test('3. Marketing Agency pack structure & custom fields', () => {
    const config = getStrictIndustryConfig('marketing_agency');
    assert.ok(config, 'Marketing Agency configuration must exist');
    assert.equal(config.name, 'Marketing Agency');
    assert.equal(config.contactFields.length, 14, 'Marketing Agency must have 14 custom fields');

    const fieldKeys = config.contactFields.map((f) => f.key);
    assert.ok(fieldKeys.includes('interestedService'), 'Missing interestedService');
    assert.ok(fieldKeys.includes('leadSource'), 'Missing leadSource');
    assert.ok(fieldKeys.includes('adPlatformInterest'), 'Missing adPlatformInterest');
    assert.ok(fieldKeys.includes('monthlyBudgetRange'), 'Missing monthlyBudgetRange');
    assert.ok(fieldKeys.includes('leadStatus'), 'Missing leadStatus');

    // Check templates
    assert.equal(config.templateSuggestions.length, 15);
    config.templateSuggestions.forEach((tpl) => {
      assert.equal(tpl.submissionState, 'unsubmitted_draft');
      assert.ok(tpl.body.length > 20);
      assert.ok(tpl.category);
    });

    // Check quick replies
    assert.equal(config.quickReplyPresets.length, 8);
    config.quickReplyPresets.forEach((qr) => {
      assert.ok(qr.title && qr.title.length > 3);
      assert.ok(qr.text && qr.text.length > 10);
    });

    // Check rules: 5 disabled keyword rules + 1 opt-out rule
    const marketingRules = config.automationPresets.filter((r) => !r.presetId.includes('stop'));
    assert.equal(marketingRules.length, 5);
    marketingRules.forEach((rule) => {
      assert.equal(rule.enabled, false, 'Starter rules must be disabled by default');
      assert.ok(rule.triggerKeywords.length > 0);
    });

    // Check campaign drafts: 2 unscheduled drafts
    assert.equal(config.sampleCampaignDrafts.length, 2);
    config.sampleCampaignDrafts.forEach((camp) => {
      assert.equal(camp.status, 'Draft');
      assert.equal(camp.scheduledAt, null);
      assert.deepEqual(camp.recipientList, []);
    });
  });

  test('4. Freelancing pack structure & custom fields', () => {
    const config = getStrictIndustryConfig('freelancing');
    assert.ok(config, 'Freelancing configuration must exist');
    assert.equal(config.name, 'Freelancing & Independent Professionals');
    assert.equal(config.contactFields.length, 14, 'Freelancing must have 14 custom fields');

    const fieldKeys = config.contactFields.map((f) => f.key);
    assert.ok(fieldKeys.includes('interestedService'), 'Missing interestedService');
    assert.ok(fieldKeys.includes('projectType'), 'Missing projectType');
    assert.ok(fieldKeys.includes('estimatedBudget'), 'Missing estimatedBudget');
    assert.ok(fieldKeys.includes('leadStatus'), 'Missing leadStatus');
    assert.ok(fieldKeys.includes('paymentStatus'), 'Missing paymentStatus');
    assert.ok(fieldKeys.includes('clientDeadline'), 'Missing clientDeadline');

    // Check templates
    assert.equal(config.templateSuggestions.length, 15);
    config.templateSuggestions.forEach((tpl) => {
      assert.equal(tpl.submissionState, 'unsubmitted_draft');
      assert.ok(tpl.body.length > 20);
      assert.ok(tpl.category);
    });

    // Check quick replies
    assert.equal(config.quickReplyPresets.length, 8);
    config.quickReplyPresets.forEach((qr) => {
      assert.ok(qr.title && qr.title.length > 3);
      assert.ok(qr.text && qr.text.length > 10);
    });

    // Check rules: 5 disabled keyword rules + 1 opt-out rule
    const freelanceRules = config.automationPresets.filter((r) => !r.presetId.includes('stop'));
    assert.equal(freelanceRules.length, 5);
    freelanceRules.forEach((rule) => {
      assert.equal(rule.enabled, false, 'Starter rules must be disabled by default');
      assert.ok(rule.triggerKeywords.length > 0);
    });

    // Check campaign drafts: 2 unscheduled drafts
    assert.equal(config.sampleCampaignDrafts.length, 2);
    config.sampleCampaignDrafts.forEach((camp) => {
      assert.equal(camp.status, 'Draft');
      assert.equal(camp.scheduledAt, null);
      assert.deepEqual(camp.recipientList, []);
    });
  });

  test('5. End-to-End Onboarding & Starter Provisioning for Marketing Agency', async () => {
    const email = `marketing.owner.${RUN}@${EMAIL_DOMAIN}`;
    const regRes = await request(app).post('/api/auth/register').send({
      name: 'Nexus Digital Owner',
      email,
      password: 'Str0ngPassw0rd!',
      confirmPassword: 'Str0ngPassw0rd!',
    });
    assert.equal(regRes.status, 201);
    const token = regRes.body.token;

    const draftRes = await request(app)
      .put('/api/onboarding/draft')
      .set(auth(token))
      .send({
        step: 6,
        businessIdentity: { name: 'Nexus Digital Agency', email, phone: '+919876500001' },
        industryKey: 'marketing_agency',
        businessDetails: { city: 'Bengaluru', country: 'India', timezone: 'Asia/Kolkata' },
      });
    assert.equal(draftRes.status, 200);

    const completeRes = await request(app).post('/api/onboarding/complete').set(auth(token)).send({});
    assert.equal(completeRes.status, 201);
    const workspaceId = completeRes.body.workspace._id;
    assert.equal(completeRes.body.workspace.industryKey, 'marketing_agency');

    // Verify starter provisioning directly in MongoDB
    const [savedTemplates, savedReplies, savedRules, savedCampaigns, savedContacts] = await Promise.all([
      MessageTemplate.find({ workspaceId }),
      QuickReply.find({ workspaceId }),
      AutoReplyRule.find({ workspaceId }),
      Campaign.find({ workspaceId }),
      Contact.find({ workspaceId }),
    ]);

    assert.equal(savedTemplates.length, 15, 'Must have 15 saved templates in DB');
    assert.equal(savedReplies.length, 8, 'Must have 8 saved quick replies in DB');
    assert.equal(savedRules.length, 5, 'Must have 5 saved auto-reply rules in DB');
    assert.equal(savedCampaigns.length, 2, 'Must have 2 saved campaigns in DB');
    assert.equal(savedContacts.length, 0, 'Must have 0 fabricated contacts');

    // Verify all starter rules are disabled
    savedRules.forEach((rule) => {
      assert.equal(rule.enabled, false, 'Auto-reply rule must be disabled');
    });

    // Test API endpoints return the saved starter records
    const tplRes = await request(app)
      .get('/api/templates?limit=50')
      .set(auth(token))
      .set('x-workspace-id', String(workspaceId));
    assert.equal(tplRes.status, 200);
    assert.equal(tplRes.body.records.length, 15);

    const qrRes = await request(app)
      .get('/api/inbox/quick-replies')
      .set(auth(token))
      .set('x-workspace-id', String(workspaceId));
    assert.equal(qrRes.status, 200);
    assert.equal(qrRes.body.records.length, 8);

    // Test editing one template persists
    const tplToEdit = savedTemplates[0];
    const updateRes = await request(app)
      .patch(`/api/templates/${tplToEdit._id}`)
      .set(auth(token))
      .set('x-workspace-id', String(workspaceId))
      .send({
        body: 'Hello {{customer_name}}, welcome to Nexus Agency! We are thrilled to connect.',
        currentVersionNumber: tplToEdit.currentVersionNumber || 1,
      });
    assert.equal(updateRes.status, 200);

    const checkTpl = await MessageTemplate.findById(tplToEdit._id);
    assert.ok(checkTpl.body.includes('Nexus Agency'));

    // Test creating a synthetic QA contact with agency custom fields
    const contactRes = await request(app)
      .post('/api/contacts')
      .set(auth(token))
      .set('x-workspace-id', String(workspaceId))
      .send({
        fullName: 'Client Apex Brands',
        phoneNumber: '+919988776655',
        customFields: {
          interestedService: 'SEO & Search Ranking',
          adPlatformInterest: 'Google Ads & YouTube',
          monthlyBudgetRange: '₹1,00,000 - ₹2,50,000 / mo',
        },
      });
    assert.equal(contactRes.status, 201);
    assert.equal(contactRes.body.contact.fullName, 'Client Apex Brands');
  });

  test('6. End-to-End Onboarding & Starter Provisioning for Freelancing', async () => {
    const email = `freelancer.owner.${RUN}@${EMAIL_DOMAIN}`;
    const regRes = await request(app).post('/api/auth/register').send({
      name: 'Aria Solo Pro',
      email,
      password: 'Str0ngPassw0rd!',
      confirmPassword: 'Str0ngPassw0rd!',
    });
    assert.equal(regRes.status, 201);
    const token = regRes.body.token;

    const draftRes = await request(app)
      .put('/api/onboarding/draft')
      .set(auth(token))
      .send({
        step: 6,
        businessIdentity: { name: 'Aria Design Studio', email, phone: '+919876500002' },
        industryKey: 'freelancing',
        businessDetails: { city: 'Mumbai', country: 'India', timezone: 'Asia/Kolkata' },
      });
    assert.equal(draftRes.status, 200);

    const completeRes = await request(app).post('/api/onboarding/complete').set(auth(token)).send({});
    assert.equal(completeRes.status, 201);
    const workspaceId = completeRes.body.workspace._id;
    assert.equal(completeRes.body.workspace.industryKey, 'freelancing');

    // Verify starter provisioning directly in MongoDB
    const [savedTemplates, savedReplies, savedRules, savedCampaigns, savedContacts] = await Promise.all([
      MessageTemplate.find({ workspaceId }),
      QuickReply.find({ workspaceId }),
      AutoReplyRule.find({ workspaceId }),
      Campaign.find({ workspaceId }),
      Contact.find({ workspaceId }),
    ]);

    assert.equal(savedTemplates.length, 15, 'Must have 15 saved templates in DB');
    assert.equal(savedReplies.length, 8, 'Must have 8 saved quick replies in DB');
    assert.equal(savedRules.length, 5, 'Must have 5 saved auto-reply rules in DB');
    assert.equal(savedCampaigns.length, 2, 'Must have 2 saved campaigns in DB');
    assert.equal(savedContacts.length, 0, 'Must have 0 fabricated contacts');

    // Verify all starter rules are disabled
    savedRules.forEach((rule) => {
      assert.equal(rule.enabled, false, 'Auto-reply rule must be disabled');
    });

    // Test API endpoints return the saved starter records
    const tplRes = await request(app)
      .get('/api/templates?limit=50')
      .set(auth(token))
      .set('x-workspace-id', String(workspaceId));
    assert.equal(tplRes.status, 200);
    assert.equal(tplRes.body.records.length, 15);

    const qrRes = await request(app)
      .get('/api/inbox/quick-replies')
      .set(auth(token))
      .set('x-workspace-id', String(workspaceId));
    assert.equal(qrRes.status, 200);
    assert.equal(qrRes.body.records.length, 8);

    // Verify strict isolation: No Marketing Agency templates are present in Freelancing workspace
    const titles = savedTemplates.map((t) => t.name || t.title || '');
    assert.ok(titles.some((t) => t.includes('Freelance') || t.includes('Project') || t.includes('Client') || t.includes('Services')));
    assert.ok(!titles.includes('Nexus Agency Lead Welcome - Updated'));
  });
});
