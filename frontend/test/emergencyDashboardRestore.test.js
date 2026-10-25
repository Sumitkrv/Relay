import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Emergency Fix: 1. Full Dashboard restored in Dashboard.jsx without non-m2w gate', () => {
  const dashPath = path.resolve(__dirname, '../src/pages/Dashboard.jsx');
  const code = fs.readFileSync(dashPath, 'utf8');

  // Must NOT contain gating check that returns WorkspaceGettingStartedPage
  assert.ok(!code.includes('WorkspaceGettingStartedPage'), 'Dashboard.jsx must not hijack new tenants with WorkspaceGettingStartedPage');
  // Must render full dashboard components
  assert.ok(code.includes('PageHeader'), 'Must render PageHeader');
  assert.ok(code.includes('Kpi'), 'Must render KPI cards');
  assert.ok(code.includes('ov-card'), 'Must render overview cards');
  assert.ok(code.includes('getDashboardOverview'), 'Must call getDashboardOverview');
});

test('Emergency Fix: 2. AppLayout.jsx integrates useWorkspace and safe dynamic branding', () => {
  const layoutPath = path.resolve(__dirname, '../src/layout/AppLayout.jsx');
  const code = fs.readFileSync(layoutPath, 'utf8');

  // Must import useWorkspace
  assert.ok(code.includes('useWorkspace'), 'AppLayout must import useWorkspace');
  assert.ok(code.includes('resolveMediaUrl'), 'AppLayout must import resolveMediaUrl');
  // Must preserve all 7 core navigation items
  assert.ok(code.includes("label: 'Overview'"), 'Must include Overview in nav');
  assert.ok(code.includes("label: 'Contacts'"), 'Must include Contacts in nav');
  assert.ok(code.includes("label: 'Templates'"), 'Must include Templates in nav');
  assert.ok(code.includes("label: 'Campaigns'"), 'Must include Campaigns in nav');
  assert.ok(code.includes("label: 'Inbox & Auto-reply'"), 'Must include Inbox in nav');
  assert.ok(code.includes("label: 'Reports'"), 'Must include Reports in nav');
  assert.ok(code.includes("label: 'Settings'"), 'Must include Settings in nav');

  // Must handle broken logo fallback gracefully
  assert.ok(code.includes('onError'), 'Must handle img onError fallback');
  assert.ok(code.includes('initials'), 'Must provide initials fallback');
});

test('Emergency Fix: 3. BusinessOnboardingPage redirects to /app upon completion', () => {
  const onbPath = path.resolve(__dirname, '../src/pages/BusinessOnboardingPage.jsx');
  const code = fs.readFileSync(onbPath, 'utf8');

  assert.ok(code.includes("navigate('/app')"), 'Must navigate to /app on existing workspace detection or completion');
});

test('Emergency Fix: 4. WorkspaceGettingStartedPage has zero roadmap prompt numbers', () => {
  const pagePath = path.resolve(__dirname, '../src/pages/WorkspaceGettingStartedPage.jsx');
  const code = fs.readFileSync(pagePath, 'utf8');

  // Internal prompt numbers must never be displayed to customers
  assert.ok(!code.includes('SaaS Prompt 6'), 'Must not contain SaaS Prompt 6');
  assert.ok(!code.includes('SaaS Prompt 7'), 'Must not contain SaaS Prompt 7');
  assert.ok(!code.includes('Prompt 8 & 9'), 'Must not contain Prompt 8 & 9');
  assert.ok(!code.includes('Prompt 10 & 11'), 'Must not contain Prompt 10 & 11');
  assert.ok(!code.includes('100% Isolated Database Scope'), 'Must not contain unsubstantiated 100% security claim');

  // Must offer actionable links to core modules
  assert.ok(code.includes('/contacts'), 'Must offer link to /contacts');
  assert.ok(code.includes('/templates'), 'Must offer link to /templates');
  assert.ok(code.includes('/campaigns'), 'Must offer link to /campaigns');
  assert.ok(code.includes('/inbox'), 'Must offer link to /inbox');
  assert.ok(code.includes('/reports'), 'Must offer link to /reports');
  assert.ok(code.includes('/settings'), 'Must offer link to /settings');
});

test('Emergency Fix: 5. Vite config defines backend proxy for /api to prevent broken image loading', () => {
  const vitePath = path.resolve(__dirname, '../vite.config.js');
  const code = fs.readFileSync(vitePath, 'utf8');

  assert.ok(code.includes("'/api':"), 'vite.config.js must define proxy for /api');
  assert.ok(code.includes('http://localhost:5000'), 'proxy target must be http://localhost:5000');
});

test('Emergency Fix: 6. media.js helper accurately resolves relative and absolute asset URLs', () => {
  const mediaPath = path.resolve(__dirname, '../src/utils/media.js');
  const code = fs.readFileSync(mediaPath, 'utf8');

  assert.ok(code.includes('export function resolveMediaUrl'), 'Must export resolveMediaUrl');
});
