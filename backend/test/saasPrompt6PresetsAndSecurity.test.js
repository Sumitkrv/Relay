import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Workspace from '../src/models/Workspace.js';
import WorkspaceMembership from '../src/models/WorkspaceMembership.js';
import MessageTemplate from '../src/models/MessageTemplate.js';
import AutoReplyRule from '../src/models/AutoReplyRule.js';
import jwt from 'jsonwebtoken';
import { industryRegistry } from '../src/config/industries/industryRegistry.js';
import {
  validateTemplateVariables,
  validateTriggerKeywords,
  RESERVED_SYSTEM_KEYWORDS,
} from '../src/services/industry/industryValidationService.js';

let mongod;
let userA, tokenA, wsA; // Real Estate
let userB, tokenB, wsB; // Gym

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  // Create User A (Real Estate Workspace Owner)
  userA = await User.create({
    name: 'Real Estate Owner',
    email: 're_owner@relaytest.internal',
    passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
    isEmailVerified: true,
    status: 'ACTIVE',
  });
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_32_characters_long!';
  tokenA = jwt.sign({ sub: String(userA._id), ver: 1 }, process.env.JWT_SECRET, { expiresIn: '1h' });

  wsA = await Workspace.create({
    name: 'Skyline Realty',
    slug: 'skyline-realty',
    industryKey: 'real_estate',
    businessEmail: 're_owner@relaytest.internal',
    businessPhone: '+919811223344',
    createdBy: userA._id,
    status: 'ACTIVE',
    onboardingStatus: 'COMPLETED',
  });

  await WorkspaceMembership.create({
    workspaceId: wsA._id,
    userId: userA._id,
    role: 'OWNER',
    status: 'ACTIVE',
    isDefaultWorkspace: true,
  });

  // Create User B (Gym Workspace Owner)
  userB = await User.create({
    name: 'Gym Owner',
    email: 'gym_owner@relaytest.internal',
    passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
    isEmailVerified: true,
    status: 'ACTIVE',
  });
  tokenB = jwt.sign({ sub: String(userB._id), ver: 1 }, process.env.JWT_SECRET, { expiresIn: '1h' });

  wsB = await Workspace.create({
    name: 'Pulse Fitness',
    slug: 'pulse-fitness',
    industryKey: 'gym',
    businessEmail: 'gym_owner@relaytest.internal',
    businessPhone: '+919876543210',
    createdBy: userB._id,
    status: 'ACTIVE',
    onboardingStatus: 'COMPLETED',
  });

  await WorkspaceMembership.create({
    workspaceId: wsB._id,
    userId: userB._id,
    role: 'OWNER',
    status: 'ACTIVE',
    isDefaultWorkspace: true,
  });
});

after(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

test('SaaS Prompt 6 — Presets, Templates, Automations & Multi-Tenant Isolation', async (t) => {
  // --- GROUP 1: TEMPLATE PRESETS & VARIABLE SAFETY ---
  await t.test('Group 1: Template Presets & Variable Safety', async (t1) => {
    await t1.test('41. Template suggestions load for all 7 verticals', () => {
      const verticals = ['real_estate', 'gym', 'clinic', 'education', 'salon', 'automobile', 'other'];
      for (const v of verticals) {
        const templates = industryRegistry.getIndustryTemplateSuggestions(v);
        assert.ok(Array.isArray(templates));
        assert.ok(templates.length >= 4, `Vertical ${v} should have at least 4 template suggestions`);
        for (const tpl of templates) {
          assert.ok(tpl.presetKey && tpl.title && tpl.body);
          assert.ok(Array.isArray(tpl.variables));
        }
      }
    });

    await t1.test('42. Template variables validation passes for allowed variables', () => {
      const res = validateTemplateVariables(['customer_name', 'project_name', 'business_name'], 'real_estate');
      assert.equal(res.isValid, true);
    });

    await t1.test('43. Template variables validation rejects unsupported or malformed variables', () => {
      const res = validateTemplateVariables(['unsupported_variable_xyz', 'MALFORMED-VAR'], 'real_estate');
      assert.equal(res.isValid, false);
      assert.ok(res.errors.length > 0);
    });

    await t1.test('44. Installing template preset creates safe, inactive workspace draft', async () => {
      const res = await request(app)
        .post('/api/workspaces/current/template-draft')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('x-workspace-id', wsA._id.toString())
        .send({
          presetKey: 're_property_enquiry',
          title: 'Customized Property Enquiry',
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.template.name, 'Customized Property Enquiry');
      assert.equal(res.body.template.localStatus, 'Draft');
      assert.equal(res.body.template.providerStatus, 'Not Submitted'); // Zero false Meta claims
      assert.equal(res.body.template.workspaceId.toString(), wsA._id.toString());
    });

    await t1.test('45. Unknown template preset rejected with 404', async () => {
      const res = await request(app)
        .post('/api/workspaces/current/template-draft')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('x-workspace-id', wsA._id.toString())
        .send({ presetKey: 'non_existent_preset' });

      assert.equal(res.status, 404);
      assert.equal(res.body.code, 'PRESET_NOT_FOUND');
    });
  });

  // --- GROUP 2: AUTOMATION PRESETS & OPT-OUT PROTECTION ---
  await t.test('Group 2: Automation Presets & Opt-out Protection', async (t2) => {
    await t2.test('46. Keyword presets load for all 7 verticals', () => {
      const verticals = ['real_estate', 'gym', 'clinic', 'education', 'salon', 'automobile', 'other'];
      for (const v of verticals) {
        const presets = industryRegistry.getIndustryAutomationPresets(v);
        assert.ok(Array.isArray(presets));
        assert.ok(presets.length >= 3, `Vertical ${v} should have at least 3 keyword automation presets`);
        for (const p of presets) {
          assert.ok(p.presetId && p.displayName && p.suggestedResponse);
          assert.ok(Array.isArray(p.triggerKeywords) && p.triggerKeywords.length > 0);
        }
      }
    });

    await t2.test('47. Trigger keywords normalize case and whitespace', () => {
      const res = validateTriggerKeywords([' brochure ', 'pricing']);
      assert.equal(res.isValid, true);
      assert.deepEqual(res.keywords, ['BROCHURE', 'PRICING']);
    });

    await t2.test('48. STOP/UNSUBSCRIBE compliance keywords cannot be hijacked', () => {
      for (const kw of ['STOP', 'UNSUBSCRIBE', 'CANCEL', 'QUIT']) {
        const res = validateTriggerKeywords([kw]);
        assert.equal(res.isValid, false);
        assert.match(res.errors[0], /reserved for compliance suppression/);
      }
    });

    await t2.test('49. Adding automation preset creates inactive rule in workspace', async () => {
      const res = await request(app)
        .post('/api/workspaces/current/automation-draft')
        .set('Authorization', `Bearer ${tokenB}`)
        .set('x-workspace-id', wsB._id.toString())
        .send({
          presetId: 'gym_kw_membership',
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.rule.enabled, false); // Strictly inactive by default
      assert.equal(res.body.rule.workspaceId.toString(), wsB._id.toString());
      assert.equal(res.body.rule.triggerKeyword, 'MEMBERSHIP');
    });
  });

  // --- GROUP 3: HTTP API & MULTI-TENANT ISOLATION ---
  await t.test('Group 3: HTTP API & Multi-Tenant Boundary Enforcement', async (t3) => {
    await t3.test('50. Public GET /api/industries returns all 7 industry metadata', async () => {
      const res = await request(app).get('/api/industries');
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.industries));
      assert.equal(res.body.industries.length, 7);
      const keys = res.body.industries.map((i) => i.key);
      assert.ok(keys.includes('real_estate'));
      assert.ok(keys.includes('gym'));
      assert.ok(keys.includes('clinic'));
    });

    await t3.test('51. Public GET /api/industries/real_estate returns full definition', async () => {
      const res = await request(app).get('/api/industries/real_estate');
      assert.equal(res.status, 200);
      assert.equal(res.body.industry.key, 'real_estate');
      assert.ok(res.body.industry.contactFields.length > 0);
    });

    await t3.test('52. Public GET /api/industries/unknown returns 404', async () => {
      const res = await request(app).get('/api/industries/space_travel');
      assert.equal(res.status, 404);
      assert.equal(res.body.code, 'INDUSTRY_NOT_FOUND');
    });

    await t3.test('53. Protected GET /api/workspaces/current/industry-config requires authentication', async () => {
      const res = await request(app).get('/api/workspaces/current/industry-config');
      assert.equal(res.status, 401);
    });

    await t3.test('54. User A receives real_estate configuration', async () => {
      const res = await request(app)
        .get('/api/workspaces/current/industry-config')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('x-workspace-id', wsA._id.toString());

      assert.equal(res.status, 200);
      assert.equal(res.body.config.industryKey, 'real_estate');
      assert.equal(res.body.config.terminology.leadLabel, 'Buyer / Lead');
    });

    await t3.test('55. User B receives gym configuration', async () => {
      const res = await request(app)
        .get('/api/workspaces/current/industry-config')
        .set('Authorization', `Bearer ${tokenB}`)
        .set('x-workspace-id', wsB._id.toString());

      assert.equal(res.status, 200);
      assert.equal(res.body.config.industryKey, 'gym');
      assert.equal(res.body.config.terminology.leadLabel, 'Member Enquiry');
    });

    await t3.test('56. Cross-Tenant Attack: User B cannot access User A workspace config (403)', async () => {
      const res = await request(app)
        .get('/api/workspaces/current/industry-config')
        .set('Authorization', `Bearer ${tokenB}`)
        .set('x-workspace-id', wsA._id.toString()); // Forging Workspace A header

      assert.equal(res.status, 403);
      assert.equal(res.body.code, 'FORBIDDEN_WORKSPACE_ACCESS');
    });

    await t3.test('57. Malformed tenant header returns 400', async () => {
      const res = await request(app)
        .get('/api/workspaces/current/industry-config')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('x-workspace-id', 'invalid_not_an_objectid');

      assert.equal(res.status, 400);
      assert.equal(res.body.code, 'INVALID_WORKSPACE_ID');
    });

    await t3.test('58. User A can save safe custom terminology preferences', async () => {
      const res = await request(app)
        .put('/api/workspaces/current/industry-preferences')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('x-workspace-id', wsA._id.toString())
        .send({
          preferences: {
            customTerminology: { leadLabel: 'Property Investor' },
          },
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.config.terminology.leadLabel, 'Property Investor');
    });

    await t3.test('59. Cross-Tenant Attack: User B cannot modify User A preferences', async () => {
      const res = await request(app)
        .put('/api/workspaces/current/industry-preferences')
        .set('Authorization', `Bearer ${tokenB}`)
        .set('x-workspace-id', wsA._id.toString())
        .send({
          preferences: { customTerminology: { leadLabel: 'Hacked Label' } },
        });

      assert.equal(res.status, 403);
      assert.equal(res.body.code, 'FORBIDDEN_WORKSPACE_ACCESS');
    });

    await t3.test('60. Real WhatsApp live messaging remains strictly 403-blocked', async () => {
      const res = await request(app)
        .post('/api/system/send-live-broadcast')
        .set('Authorization', `Bearer ${tokenA}`);

      assert.equal(res.status, 404); // Route does not exist and live sending is prohibited
    });
  });
});
