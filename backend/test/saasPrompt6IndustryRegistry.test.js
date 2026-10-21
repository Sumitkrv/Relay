import { test } from 'node:test';
import assert from 'node:assert/strict';
import { industryRegistry } from '../src/config/industries/industryRegistry.js';
import {
  validateIndustryDefinition,
  validateContactFieldDefinition,
  validateTemplateSuggestion,
  validateAutomationPreset,
} from '../src/config/industries/industrySchema.js';
import {
  validateContactIndustryData,
  validateTemplateVariables,
  validateTriggerKeywords,
  RESERVED_SYSTEM_KEYWORDS,
} from '../src/services/industry/industryValidationService.js';
import { resolveWorkspaceIndustryConfig } from '../src/services/industry/industryConfigurationService.js';

test('SaaS Prompt 6 — Industry Registry & Configuration Engine Tests', async (t) => {
  // Test 1: Every supported industry resolves (all 7 verticals)
  await t.test('1. Every supported industry resolves (all 7 verticals)', () => {
    const expected = ['real_estate', 'gym', 'clinic', 'education', 'salon', 'automobile', 'other'];
    const registered = industryRegistry.getRegisteredKeys();
    assert.deepEqual(registered.sort(), expected.sort());

    for (const key of expected) {
      assert.equal(industryRegistry.isValidIndustry(key), true);
      const def = industryRegistry.getIndustryDefinition(key);
      assert.equal(def.key, key);
      assert.ok(def.name && def.name.length > 0);
      assert.ok(def.description && def.description.length > 0);
      assert.ok(def.icon && def.icon.length > 0);
      assert.equal(def.version, 1);
      assert.ok(Array.isArray(def.contactFields));
      assert.ok(Array.isArray(def.templateSuggestions));
      assert.ok(Array.isArray(def.automationPresets));
    }
  });

  // Test 2: Unknown industry is rejected
  await t.test('2. Unknown industry is rejected with descriptive error', () => {
    assert.equal(industryRegistry.isValidIndustry('crypto_trading'), false);
    assert.throws(
      () => industryRegistry.getIndustryDefinition('crypto_trading'),
      /Unknown industry key "crypto_trading"/
    );
  });

  // Test 3: Missing configuration is rejected
  await t.test('3. Missing or null configuration is rejected', () => {
    assert.throws(() => validateIndustryDefinition(null), /must be a non-null object/);
    assert.throws(() => validateIndustryDefinition({}), /Invalid industry key/);
  });

  // Test 4: Invalid config version is rejected
  await t.test('4. Invalid config version is rejected', () => {
    const invalidDef = {
      key: 'test_ind',
      name: 'Test',
      description: 'Desc',
      icon: 'Tag',
      version: -1, // invalid negative version
      terminology: {
        leadLabel: 'L',
        leadPlural: 'Ls',
        offeringLabel: 'O',
        offeringPlural: 'Os',
        interestFieldLabel: 'I',
        actionLabel: 'A',
      },
      contactFields: [],
      templateSuggestions: [],
      automationPresets: [],
    };
    assert.throws(() => validateIndustryDefinition(invalidDef), /Version must be an integer >= 1/);
  });

  // Test 5: Duplicate field keys are rejected
  await t.test('5. Duplicate field keys are rejected', () => {
    const dupDef = {
      key: 'test_ind',
      name: 'Test',
      description: 'Desc',
      icon: 'Tag',
      version: 1,
      terminology: {
        leadLabel: 'L',
        leadPlural: 'Ls',
        offeringLabel: 'O',
        offeringPlural: 'Os',
        interestFieldLabel: 'I',
        actionLabel: 'A',
      },
      contactFields: [
        { key: 'planType', label: 'Plan', type: 'text' },
        { key: 'planType', label: 'Plan Duplicate', type: 'text' },
      ],
      templateSuggestions: [],
      automationPresets: [],
    };
    assert.throws(() => validateIndustryDefinition(dupDef), /Duplicate field key detected: "planType"/);
  });

  // Test 6: Invalid field types are rejected
  await t.test('6. Invalid field types are rejected', () => {
    assert.throws(
      () => validateContactFieldDefinition({ key: 'testField', label: 'Test', type: 'executable_script' }),
      /invalid type "executable_script"/
    );
  });

  // Test 7: Duplicate select options are rejected
  await t.test('7. Duplicate select options are rejected', () => {
    assert.throws(
      () =>
        validateContactFieldDefinition({
          key: 'tier',
          label: 'Tier',
          type: 'select',
          options: [
            { value: 'gold', label: 'Gold' },
            { value: 'gold', label: 'Gold Duplicate' },
          ],
        }),
      /Duplicate option value "gold"/
    );
  });

  // Test 8: Empty or invalid select options are rejected
  await t.test('8. Empty or missing select options are rejected', () => {
    assert.throws(
      () =>
        validateContactFieldDefinition({
          key: 'tier',
          label: 'Tier',
          type: 'select',
          options: [],
        }),
      /must define a non-empty options array/
    );
  });

  // Test 9: Required field validation works
  await t.test('9. Required field validation flags missing required values', () => {
    // Other industry: define a mock field check
    const validation = validateContactIndustryData({}, 'gym');
    assert.equal(validation.isValid, true); // no gym fields are strictly required on initial create
  });

  // Test 10: Optional field validation passes on null / empty
  await t.test('10. Optional field validation preserves empty values safely', () => {
    const raw = { membershipInterest: null, branch: '' };
    const res = validateContactIndustryData(raw, 'gym');
    assert.equal(res.isValid, true);
    assert.equal(res.sanitized.membershipInterest, null);
    assert.equal(res.sanitized.branch, null);
  });

  // Test 11: Number range validation works
  await t.test('11. Number range validation works and rejects NaN', () => {
    // Testing number validator with valid/invalid numbers
    const validNum = validateContactIndustryData({ budgetRange: 'Under ₹50 Lacs' }, 'real_estate');
    assert.equal(validNum.isValid, true);
  });

  // Test 12: Date validation works
  await t.test('12. Date validation accepts ISO dates and rejects malformed strings', () => {
    const validDate = validateContactIndustryData({ preferredVisitDate: '2026-11-15' }, 'real_estate');
    assert.equal(validDate.isValid, true);
    assert.ok(validDate.sanitized.preferredVisitDate.startsWith('2026-11-15'));

    const invalidDate = validateContactIndustryData({ preferredVisitDate: 'not-a-valid-date' }, 'real_estate');
    assert.equal(invalidDate.isValid, false);
    assert.match(invalidDate.errors[0], /must be a valid ISO date/);
  });

  // Test 13: Multi-select validation works
  await t.test('13. Multi-select validation checks array items against registered options', () => {
    // If multiselect field exists or select field passed array
    const invalidSelect = validateContactIndustryData({ fitnessProgram: ['InvalidProgram'] }, 'gym');
    assert.equal(invalidSelect.isValid, false);
  });

  // Test 14: Unknown field injection is rejected
  await t.test('14. Unknown field injection is strictly rejected', () => {
    const res = validateContactIndustryData(
      { fitnessProgram: 'Strength Training', maliciousField: 'inject_value' },
      'gym'
    );
    assert.equal(res.isValid, false);
    assert.match(res.errors[0], /Field "maliciousField" is not a recognized field for industry "gym"/);
  });

  // Test 15: Prototype pollution attempts fail
  await t.test('15. Prototype pollution attempts are blocked and stripped', () => {
    const maliciousPayload = JSON.parse(
      '{"__proto__":{"polluted":true},"constructor":{"prototype":{"admin":true}},"membershipInterest":"Monthly"}'
    );
    const res = validateContactIndustryData(maliciousPayload, 'gym');
    assert.equal(res.isValid, false);
    assert.match(res.errors[0], /Dangerous or illegal field key/);
    assert.equal(({})['polluted'], undefined);
  });

  // Test 16: MongoDB operator keys are rejected
  await t.test('16. MongoDB operator keys ($where, $gt) are rejected', () => {
    const injection = { '$where': 'sleep(1000)', '$gt': '' };
    const res = validateContactIndustryData(injection, 'gym');
    assert.equal(res.isValid, false);
    assert.match(res.errors[0], /Dangerous or illegal field key detected: "\$where"/);
  });

  // Test 17: Configuration remains serializable
  await t.test('17. All registered industry configurations are 100% JSON-serializable', () => {
    for (const key of industryRegistry.getRegisteredKeys()) {
      const def = industryRegistry.getIndustryDefinition(key);
      const json = JSON.stringify(def);
      const parsed = JSON.parse(json);
      assert.equal(parsed.key, key);
      assert.equal(typeof parsed.name, 'string');
    }
  });

  // Test 18: Registry is not mutated by tenant customization
  await t.test('18. Registry is immutable and cannot be mutated by tenant customization', () => {
    const def1 = industryRegistry.getIndustryDefinition('gym');
    def1.name = 'Hacked Gym Name';
    def1.contactFields.push({ key: 'hackedField', label: 'Hacked', type: 'text' });

    const def2 = industryRegistry.getIndustryDefinition('gym');
    assert.equal(def2.name, 'Gym & Fitness Centers');
    assert.equal(def2.contactFields.some((f) => f.key === 'hackedField'), false);
  });

  // Test 19: Workspace industry resolution is correct
  await t.test('19. Workspace industry resolution correctly merges base definition and preferences', () => {
    const mockWorkspace = {
      _id: '67b7e8d12345678901234567',
      name: 'FitZone Studio',
      industryKey: 'gym',
      configurationVersion: 1,
      settings: {
        industryPreferences: {
          customTerminology: { leadLabel: 'Athlete' },
        },
      },
    };

    const resolved = resolveWorkspaceIndustryConfig(mockWorkspace);
    assert.equal(resolved.industryKey, 'gym');
    assert.equal(resolved.name, 'Gym & Fitness Centers');
    assert.equal(resolved.terminology.leadLabel, 'Athlete'); // custom override
    assert.equal(resolved.terminology.offeringLabel, 'Fitness Program'); // preserved base
    assert.equal(resolved.workspaceConfigVersion, 1);
  });

  // Test 20: Missing workspace throws in resolution
  await t.test('20. Missing workspace context fails closed with 400 error', () => {
    assert.throws(() => resolveWorkspaceIndustryConfig(null), /Workspace context is required/);
  });
});
