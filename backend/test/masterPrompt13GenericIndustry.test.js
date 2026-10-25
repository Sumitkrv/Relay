import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import {
  getIndustryConfig,
  getStrictIndustryConfig,
  getAllSupportedIndustries,
} from '../src/config/industries/industryRegistry.js';
import { validateIndustryDefinition } from '../src/config/industries/industrySchema.js';
import { validateTemplate, resolveTemplate } from '../src/utils/templateEngine.js';
import Workspace from '../src/models/Workspace.js';
import Contact from '../src/models/Contact.js';

test('Stage 04 & 14 — Generic Business Industry Pack Validation', () => {
  const generic = getIndustryConfig('generic_business');
  assert.ok(generic, 'Generic Business pack must exist in registry');
  assert.equal(generic.key, 'generic_business', 'Canonical industry key must be generic_business');
  assert.equal(generic.name, 'Generic Business', 'Display name must be Generic Business');
  assert.equal(generic.packVersion, '1.1.0', 'Pack version must be 1.1.0');
  assert.ok(validateIndustryDefinition(generic), 'Generic pack must satisfy industry definition schema');

  // Verify catalog status
  const catalog = getAllSupportedIndustries();
  const catEntry = catalog.find((c) => c.id === 'generic_business');
  assert.ok(catEntry, 'generic_business entry must exist in supported catalog');
  assert.equal(catEntry.status, 'ready', 'Catalog entry status must be ready');
  assert.equal(catEntry.hasCompletePack, true, 'hasCompletePack must be true');
});

test('Stage 07 — Exactly 15 Message Templates for Generic Business', () => {
  const generic = getIndustryConfig('generic_business');
  const tpls = generic.templateSuggestions;
  assert.equal(tpls.length, 15, 'Must have exactly 15 message templates');

  const expectedTemplateKeys = [
    'generic_welcome_enquiry',
    'generic_product_service_info',
    'generic_business_intro',
    'generic_pricing_ack',
    'generic_quote_ack',
    'generic_quote_followup',
    'generic_meeting_request_ack',
    'generic_meeting_confirmation',
    'generic_meeting_reminder',
    'generic_callback_request',
    'generic_customer_followup',
    'generic_hours_location',
    'generic_support_response',
    'generic_feedback_request',
    'generic_thank_you_closure',
  ];

  expectedTemplateKeys.forEach((key) => {
    const t = tpls.find((item) => (item.presetKey || item.key) === key);
    assert.ok(t, `Template "${key}" must be defined`);
    assert.ok(t.title && t.title.length > 3, `Template "${key}" must have a title`);
    assert.ok(t.body && t.body.trim().length > 25, `Template "${key}" body must be non-empty`);
    assert.ok(t.category, `Template "${key}" must have a category`);
    assert.equal(t.submissionState, 'unsubmitted_draft', `Template "${key}" must be unsubmitted_draft`);
    assert.equal(t.approvalStatus, 'NOT_SUBMITTED', `Template "${key}" approval status must be NOT_SUBMITTED`);

    const val = validateTemplate(t);
    assert.equal(val.errors.length, 0, `Template "${key}" validation errors: ${val.errors.join(', ')}`);
  });

  // Verify template variable interpolation
  const sample = tpls.find((t) => t.presetKey === 'generic_welcome_enquiry');
  const resolved = resolveTemplate(sample, {
    fullName: 'Rajesh',
  }, {
    businessName: 'Apex Commercial Traders',
  });
  assert.ok(resolved.body.includes('Rajesh'), 'Template must interpolate customer_name');
  assert.ok(resolved.body.includes('Apex Commercial Traders'), 'Template must interpolate business_name');
  assert.ok(!resolved.body.includes('{{customer_name}}'), 'Variables must be resolved');
});

test('Stage 08 — Exactly 8 Quick Replies for Generic Business', () => {
  const generic = getIndustryConfig('generic_business');
  const qrs = generic.quickReplyPresets;
  assert.equal(qrs.length, 8, 'Must have exactly 8 Quick Replies');

  const expectedQrKeys = [
    'generic_qr_products_services',
    'generic_qr_pricing_info',
    'generic_qr_working_hours',
    'generic_qr_location',
    'generic_qr_request_quotation',
    'generic_qr_schedule_meeting',
    'generic_qr_request_callback',
    'generic_qr_thank_you_support',
  ];

  expectedQrKeys.forEach((key) => {
    const q = qrs.find((item) => (item.presetKey || item.key) === key);
    assert.ok(q, `Quick Reply "${key}" must be defined`);
    assert.ok(q.title && q.title.length > 2, `Quick Reply "${key}" must have a title`);
    assert.ok(q.body && q.body.trim().length > 15, `Quick Reply "${key}" body must be non-empty`);
    assert.ok(q.category, `Quick Reply "${key}" must have a category`);
  });
});

test('Stage 09 — Exactly 5 Disabled Starter Auto-Reply Rules + 1 Opt-Out Rule', () => {
  const generic = getIndustryConfig('generic_business');
  const rules = generic.autoReplyRules;
  assert.equal(rules.length, 6, 'Must have 6 auto-reply rules (5 starter + 1 opt-out)');

  const starterRules = rules.filter((r) => r.key !== 'generic_auto_stop');
  assert.equal(starterRules.length, 5, 'Must have exactly 5 starter rules');

  starterRules.forEach((rule) => {
    assert.equal(rule.enabled, false, `Starter rule "${rule.name}" must be disabled by default`);
    assert.ok(rule.keywords && rule.keywords.length > 0, `Rule "${rule.name}" must have keywords`);
    assert.ok(rule.responseBody && rule.responseBody.trim().length > 15, `Rule "${rule.name}" response must be non-empty`);
  });

  const optOut = rules.find((r) => r.key === 'generic_auto_stop');
  assert.ok(optOut, 'Protected opt-out rule must exist');
  assert.equal(optOut.enabled, true, 'Opt-out rule must be enabled');
  assert.ok(optOut.keywords.includes('STOP'), 'Opt-out rule must handle STOP');
});

test('Stage 10 — Exactly 2 Unexecuted Campaign Drafts', () => {
  const generic = getIndustryConfig('generic_business');
  assert.ok(generic.campaignDrafts, 'Campaign drafts must exist');
  assert.equal(generic.campaignDrafts.length, 2, 'Must have exactly 2 campaign drafts');

  generic.campaignDrafts.forEach((camp) => {
    assert.ok(camp.title, 'Campaign draft must have a title');
    assert.equal(camp.status, 'draft', 'Campaign draft must remain draft');
    assert.equal(camp.executed, false, 'Campaign draft must be unexecuted');
    assert.ok(camp.templateId, 'Campaign draft must reference a valid template');
  });
});

test('Stage 06 — 14 CRM Contact Field Definitions for Generic Business', () => {
  const generic = getIndustryConfig('generic_business');
  assert.equal(generic.contactFields.length, 14, 'Must define exactly 14 CRM contact fields');

  const expectedFields = [
    'fullName',
    'phoneNumber',
    'email',
    'companyName',
    'productServiceInterest',
    'enquiryType',
    'leadSource',
    'leadStatus',
    'priority',
    'preferredContactMethod',
    'followUpDate',
    'callbackRequested',
    'notes',
    'whatsappConsentStatus',
  ];

  expectedFields.forEach((fieldKey) => {
    const f = generic.contactFields.find((item) => item.key === fieldKey);
    assert.ok(f, `Field "${fieldKey}" must be defined`);
    assert.ok(f.label, `Field "${fieldKey}" must have a label`);
    assert.ok(f.type, `Field "${fieldKey}" must have a type`);
  });
});

test('Stage 04 — Alias and Fallback Logic for Generic Business', () => {
  const aliases = [
    'generic_business',
    'generic',
    'other',
    'general',
    'general_business',
    'standard',
    'default',
    'misc',
    'commercial',
  ];

  aliases.forEach((alias) => {
    const resolved = getIndustryConfig(alias);
    assert.ok(resolved, `Alias "${alias}" must resolve`);
    assert.ok(
      resolved.key === 'generic_business' || resolved.key === 'other',
      `Alias "${alias}" must resolve to generic_business`
    );
  });

  // Unknown industry must fall back to generic_business (never real_estate)
  const unknown = getIndustryConfig('space_mining_enterprise');
  assert.ok(unknown, 'Unknown industry must resolve to fallback');
  assert.equal(unknown.key, 'generic_business', 'Unknown industry must fall back to generic_business');
  assert.notEqual(unknown.key, 'real_estate', 'Must NEVER fall back to real_estate');

  // Valid specialized industry must NOT fall back to generic
  const clinic = getIndustryConfig('clinic');
  assert.equal(clinic.key, 'clinic', 'Specialized industry must resolve its own pack');
});

test('Stage 15 — Multi-Tenant Isolation: Same-Industry & Cross-Industry Isolation', async (t) => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/relay_demo';
  let connected = false;
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 2000 });
    connected = true;
  } catch (err) {
    t.skip('MongoDB not reachable for integration test');
    return;
  }

  try {
    const wsA = await Workspace.findOne({ slug: 'apex-commercial' });
    const wsB = await Workspace.findOne({ slug: 'zenith-wholesale' });
    const wsM2W = await Workspace.findOne({ slug: 'm2w-realty' });

    if (!wsA || !wsB) {
      t.skip('Generic demo workspaces not found in MongoDB');
      return;
    }

    // Both A and B are Generic Business
    assert.equal(wsA.industryKey, 'generic_business');
    assert.equal(wsB.industryKey, 'generic_business');

    // Query contacts scoped to Workspace A
    const contactsA = await Contact.find({ workspaceId: wsA._id });
    assert.ok(contactsA.length >= 3, 'Workspace A must have at least 3 contacts');

    // Query contacts scoped to Workspace B
    const contactsB = await Contact.find({ workspaceId: wsB._id });
    assert.ok(contactsB.length >= 1, 'Workspace B must have at least 1 contact');

    // Verify complete data isolation: None of B\'s contacts exist in A
    const idsA = new Set(contactsA.map((c) => c._id.toString()));
    const idsB = new Set(contactsB.map((c) => c._id.toString()));

    contactsB.forEach((c) => {
      assert.ok(!idsA.has(c._id.toString()), `Contact ${c._id} of Workspace B leaked into Workspace A`);
    });

    contactsA.forEach((c) => {
      assert.ok(!idsB.has(c._id.toString()), `Contact ${c._id} of Workspace A leaked into Workspace B`);
    });

    // If M2W Realty exists, verify cross-industry isolation
    if (wsM2W) {
      assert.equal(wsM2W.industryKey, 'real_estate');
      const contactsM2W = await Contact.find({ workspaceId: wsM2W._id });
      contactsM2W.forEach((c) => {
        assert.ok(!idsA.has(c._id.toString()), `M2W contact ${c._id} leaked into Generic Workspace A`);
        assert.ok(!idsB.has(c._id.toString()), `M2W contact ${c._id} leaked into Generic Workspace B`);
      });
    }
  } finally {
    await mongoose.disconnect();
  }
});
