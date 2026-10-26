import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CRM_TOKEN_REGEX,
  extractCrmTokens,
  resolveCrmVariables,
  resolveContactVariables,
  resolveSampleContext
} from '../src/utils/crmVariables.js';

import { getAllIndustryConfigs, getStrictIndustryConfig } from '../../backend/src/config/industries/industryRegistry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Frontend Universal Industry — 1. crmVariables exports structured catalog and helper methods', () => {
  const CRM_VARIABLES = getAllIndustryConfigs().flatMap(c => c.supportedVariables || []);
  const CRM_VARIABLE_KEYS = CRM_VARIABLES.map(v => v.token);
  assert.ok(Array.isArray(CRM_VARIABLES), 'CRM_VARIABLES must be an array');
  assert.ok(CRM_VARIABLES.length >= 10, 'CRM_VARIABLES should list at least 10 core & industry variables');
  assert.ok(Array.isArray(CRM_VARIABLE_KEYS), 'CRM_VARIABLE_KEYS must be an array');
  assert.ok(CRM_VARIABLE_KEYS.includes('customer_name'), 'Must include customer_name');
  assert.ok(CRM_VARIABLE_KEYS.includes('business_name'), 'Must include business_name');
  assert.ok(CRM_VARIABLE_KEYS.includes('property_type'), 'Must include property_type');
  assert.ok(CRM_VARIABLE_KEYS.includes('membership_type'), 'Must include membership_type');
  assert.ok(CRM_VARIABLE_KEYS.includes('service_name'), 'Must include service_name');
  assert.ok(CRM_VARIABLE_KEYS.includes('appointment_date'), 'Must include appointment_date');
});

test('Frontend Universal Industry — 2. extractCrmTokens accurately finds template tokens', () => {
  const sample = 'Hello {{customer_name}}, welcome to {{business_name}}! Interested in {{property_type}}?';
  const tokens = extractCrmTokens(sample);
  assert.deepEqual(tokens, ['customer_name', 'business_name', 'property_type']);
});

test('Frontend Universal Industry — 3. resolveCrmVariables replaces known variables and handles missing with fallback brackets', () => {
  const sample = 'Hi {{customer_name}}, your {{service_name}} appointment is at {{city}}. Unknown: {{missing_token}}.';
  const context = {
    customer_name: 'Dr. Sarah',
    service_name: 'Physiotherapy Consultation',
    city: 'Mumbai'
  };
  const resolved = resolveCrmVariables(sample, context);
  assert.ok(resolved.includes('Hi Dr. Sarah,'), 'Must resolve customer_name');
  assert.ok(resolved.includes('your Physiotherapy Consultation appointment'), 'Must resolve service_name');
  assert.ok(resolved.includes('at Mumbai.'), 'Must resolve city');
  assert.ok(resolved.includes('[missing token]'), 'Must provide safe readable fallback for unprovided variables');
});

test('Frontend Universal Industry — 4. resolveSampleContext generates safe previews per industry', () => {
  for (const key of ['real_estate', 'gym', 'clinic']) {
    const config = getStrictIndustryConfig(key);
    assert.deepEqual(resolveSampleContext(config), config.syntheticDemoContacts?.[0] || {});
  }
  assert.deepEqual(resolveSampleContext(null), {}, 'Unavailable catalogs must not invent example contacts');
  assert.equal(resolveCrmVariables('{{city}} {{business_name}}'), '[city] [business name]');

});

test('Frontend Universal Industry — 5. services/industries.js exports public and workspace industry APIs', () => {
  const servicePath = path.resolve(__dirname, '../src/services/industries.js');
  assert.ok(fs.existsSync(servicePath), 'industries.js service must exist');
  const code = fs.readFileSync(servicePath, 'utf8');

  assert.ok(code.includes('getIndustrySummaries'), 'Must export getIndustrySummaries');
  assert.ok(code.includes('getIndustryDetails'), 'Must export getIndustryDetails');
  assert.ok(code.includes('getWorkspaceIndustryConfig'), 'Must export getWorkspaceIndustryConfig');
});

test('Frontend Universal Industry — 6. IndustryPreviewPage.jsx displays read-only banner and covers all tabs', () => {
  const pagePath = path.resolve(__dirname, '../src/pages/IndustryPreviewPage.jsx');
  assert.ok(fs.existsSync(pagePath), 'IndustryPreviewPage.jsx must exist');
  const code = fs.readFileSync(pagePath, 'utf8');

  assert.ok(code.includes('Industry Pack Preview — Not Provisioned'), 'Must prominently display the non-provisioned warning banner');
  assert.ok(code.includes('Starter Templates') && code.includes('Contact Schema Fields'), 'Must include navigation tabs');
  assert.ok(code.includes('Quick Replies') && code.includes('Keyword Rules'), 'Must include tabs for quick replies and rules');
  assert.ok(code.includes('Sample Campaign') && code.includes('CRM Variables'), 'Must include campaign draft and variables tabs');
  assert.ok(!code.includes('axios.post') && !code.includes('api.post'), 'Must NOT trigger write mutations to database');
});

test('Frontend Universal Industry — 7. App.jsx mounts /dev/industry-preview and DeveloperTestingCenter links to it', () => {
  const appPath = path.resolve(__dirname, '../src/App.jsx');
  const appCode = fs.readFileSync(appPath, 'utf8');
  assert.ok(appCode.includes('/dev/industry-preview'), 'App.jsx must mount /dev/industry-preview route');

  const devCenterPath = path.resolve(__dirname, '../src/components/DeveloperTestingCenter.jsx');
  const devCode = fs.readFileSync(devCenterPath, 'utf8');
  assert.ok(devCode.includes('/dev/industry-preview'), 'DeveloperTestingCenter must link to /dev/industry-preview');
});

test('Frontend Universal Industry — 8. Null-safety regression: resolveCrmVariables and resolveContactVariables never throw on null contact or workspace', () => {
  const text = 'Hello {{customer_name}}, welcome to {{business_name}}! Service: {{service_name}}.';
  // Must not throw with null/undefined contact
  assert.doesNotThrow(() => {
    const res = resolveContactVariables(text, null, null);
    assert.ok(typeof res === 'string');
    assert.ok(res.includes('{{customer_name}}')); // Preserves missing in contact resolution
  });

  // Must not throw with null definitions
  assert.doesNotThrow(() => {
    const res = resolveCrmVariables(text, null, null, null);
    assert.ok(typeof res === 'string');
    assert.ok(res.includes('[customer name]')); // Bracket fallback
  });

  // Valid resolution with partial contact
  const resPartial = resolveContactVariables(text, { name: 'Alex' }, { name: 'Agency Prime' });
  assert.ok(resPartial.includes('Hello Alex'));
  assert.ok(resPartial.includes('welcome to Agency Prime'));
});
