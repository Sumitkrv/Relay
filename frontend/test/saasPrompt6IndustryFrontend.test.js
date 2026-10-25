import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('SaaS Prompt 6 — 1. Industry Context & Hook Architecture', () => {
  const ctxPath = path.resolve(__dirname, '../src/context/IndustryContext.jsx');
  assert.ok(fs.existsSync(ctxPath), 'IndustryContext.jsx must exist');
  const code = fs.readFileSync(ctxPath, 'utf8');

  assert.ok(code.includes('export function IndustryProvider'), 'Must export IndustryProvider');
  assert.ok(code.includes('export function useIndustryConfig'), 'Must export useIndustryConfig');
  assert.ok(code.includes('effectiveConfig'), 'Context must expose effectiveConfig');
  assert.ok(code.includes('terminology'), 'Context must expose terminology');
  assert.ok(code.includes('fieldDefinitions'), 'Context must expose fieldDefinitions');
  assert.ok(code.includes('filterDefinitions'), 'Context must expose filterDefinitions');
  assert.ok(code.includes('tableColumns'), 'Context must expose tableColumns');
  assert.ok(code.includes('installTemplateDraft'), 'Context must expose installTemplateDraft');
  assert.ok(code.includes('installAutomationDraft'), 'Context must expose installAutomationDraft');
});

test('SaaS Prompt 6 — 2. Industry Context Mounting in main.jsx', () => {
  const mainPath = path.resolve(__dirname, '../src/main.jsx');
  const code = fs.readFileSync(mainPath, 'utf8');

  assert.ok(code.includes('IndustryProvider'), 'main.jsx must import IndustryProvider');
  assert.ok(code.includes('<IndustryProvider>'), 'main.jsx must mount <IndustryProvider>');
});

test('SaaS Prompt 6 — 3. Frontend Industry Service API Surface', () => {
  const srvPath = path.resolve(__dirname, '../src/services/industries.js');
  assert.ok(fs.existsSync(srvPath), 'services/industries.js must exist');
  const code = fs.readFileSync(srvPath, 'utf8');

  const requiredFns = [
    'getPublicIndustries',
    'getPublicIndustry',
    'getWorkspaceIndustryConfig',
    'getWorkspaceContactFieldDefinitions',
    'getWorkspaceTemplateSuggestions',
    'getWorkspaceAutomationSuggestions',
    'createWorkspaceTemplateDraft',
    'createWorkspaceAutomationDraft',
    'updateWorkspaceIndustryPreferences',
    'validateWorkspaceDynamicFields',
  ];

  for (const fn of requiredFns) {
    assert.ok(code.includes(`export async function ${fn}`), `Must export ${fn}`);
  }
});

test('SaaS Prompt 6 — 4. Reusable Dynamic Field Renderer Component', () => {
  const rendererPath = path.resolve(__dirname, '../src/components/industry/DynamicFieldRenderer.jsx');
  assert.ok(fs.existsSync(rendererPath), 'DynamicFieldRenderer.jsx must exist');
  const code = fs.readFileSync(rendererPath, 'utf8');

  // Verify all supported data types are handled
  const supportedTypes = ['text', 'number', 'select', 'multiselect', 'date', 'boolean', 'phone', 'url'];
  for (const t of supportedTypes) {
    assert.ok(code.includes(`'${t}'`), `Renderer must support type '${t}'`);
  }

  // Accessibility checks
  assert.ok(code.includes('aria-invalid'), 'Must support aria-invalid for accessibility');
  assert.ok(code.includes('aria-describedby'), 'Must support aria-describedby for errors');
  assert.ok(code.includes('role="alert"'), 'Error messages must use role="alert"');
});

test('SaaS Prompt 6 — 5. Dynamic Contact Fields Form Grouping', () => {
  const fieldsPath = path.resolve(__dirname, '../src/components/industry/DynamicContactFields.jsx');
  assert.ok(fs.existsSync(fieldsPath), 'DynamicContactFields.jsx must exist');
  const code = fs.readFileSync(fieldsPath, 'utf8');

  assert.ok(code.includes('businessInterest'), 'Must render business interest group');
  assert.ok(code.includes('qualification'), 'Must render qualification group');
  assert.ok(code.includes('DynamicFieldRenderer'), 'Must use DynamicFieldRenderer');
});

test('SaaS Prompt 6 — 6. Template Suggestion Cards with Draft Creation Safety', () => {
  const tplPath = path.resolve(__dirname, '../src/components/industry/IndustryTemplateSuggestions.jsx');
  assert.ok(fs.existsSync(tplPath), 'IndustryTemplateSuggestions.jsx must exist');
  const code = fs.readFileSync(tplPath, 'utf8');

  assert.ok(code.includes('Draft Only'), 'Must display Draft Only badge');
  assert.ok(code.includes('NOT live Meta-approved'), 'Must clearly state presets are not live Meta-approved');
  assert.ok(code.includes('installTemplateDraft'), 'Must invoke draft installation');
});

test('SaaS Prompt 6 — 7. Automation Suggestion Cards with Inactive Default and Opt-Out Banner', () => {
  const autoPath = path.resolve(__dirname, '../src/components/industry/IndustryAutomationSuggestions.jsx');
  assert.ok(fs.existsSync(autoPath), 'IndustryAutomationSuggestions.jsx must exist');
  const code = fs.readFileSync(autoPath, 'utf8');

  assert.ok(code.includes('Disabled By Default'), 'Must explicitly display Disabled by default');
  assert.ok(code.includes('STOP') && code.includes('UNSUBSCRIBE'), 'Must reference STOP/UNSUBSCRIBE compliance');
  assert.ok(code.includes('installAutomationDraft'), 'Must invoke automation draft creation');
});

test('SaaS Prompt 6 — 8. Unified Industry Config Hub Component', () => {
  const hubPath = path.resolve(__dirname, '../src/components/industry/IndustryConfigHub.jsx');
  assert.ok(fs.existsSync(hubPath), 'IndustryConfigHub.jsx must exist');
  const code = fs.readFileSync(hubPath, 'utf8');

  assert.ok(code.includes('fields'), 'Hub must have fields tab');
  assert.ok(code.includes('templates'), 'Hub must have templates tab');
  assert.ok(code.includes('automations'), 'Hub must have automations tab');
  assert.ok(code.includes('terminology'), 'Hub must have terminology tab');
  assert.ok(code.includes('IndustryBadge'), 'Hub must use IndustryBadge');
});

test('SaaS Prompt 6 — 9. Safe Integration in WorkspaceGettingStartedPage', () => {
  const pagePath = path.resolve(__dirname, '../src/pages/WorkspaceGettingStartedPage.jsx');
  const code = fs.readFileSync(pagePath, 'utf8');

  assert.ok(code.includes('IndustryConfigHub'), 'WorkspaceGettingStartedPage must embed IndustryConfigHub');
  assert.ok(code.includes('Active & Ready'), 'Step 1 must be marked Active & Ready');
});

test('SaaS Prompt 6 — 10. Safe Integration in SettingsPage Business Profile', () => {
  const pagePath = path.resolve(__dirname, '../src/pages/SettingsPage.jsx');
  const code = fs.readFileSync(pagePath, 'utf8');

  assert.ok(code.includes('IndustryConfigHub'), 'SettingsPage must embed IndustryConfigHub');
  assert.ok(code.includes('activeTab === \'business\''), 'Must be embedded under business tab');
});

test('SaaS Prompt 6 — 11. No Disparate Dashboard Routing (Zero Vertical Duplication)', () => {
  const appPath = path.resolve(__dirname, '../src/App.jsx');
  const code = fs.readFileSync(appPath, 'utf8');

  // Verify no separate vertical dashboard routes
  assert.ok(!code.includes('/gym-dashboard'), 'App must not have /gym-dashboard route');
  assert.ok(!code.includes('/salon-dashboard'), 'App must not have /salon-dashboard route');
  assert.ok(!code.includes('/clinic-dashboard'), 'App must not have /clinic-dashboard route');
  assert.ok(!code.includes('/real-estate-dashboard'), 'App must not have /real-estate-dashboard route');

  // Verify core navigation modules preserved
  const coreModules = ['/app/overview', '/app/contacts', '/app/templates', '/app/campaigns', '/app/inbox', '/app/reports', '/app/settings'];
  for (const mod of coreModules) {
    assert.ok(code.includes(mod), `App must preserve core module route ${mod}`);
  }
});
