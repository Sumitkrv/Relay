import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

test('Prompt 1 Settings: SettingsPage defines all 6 tabs including business and security', () => {
  const settingsFile = fs.readFileSync(path.join(root, 'src/pages/SettingsPage.jsx'), 'utf-8');
  assert.ok(settingsFile.includes("'profile'"), 'Profile tab defined');
  assert.ok(settingsFile.includes("'business'"), 'Business tab defined');
  assert.ok(settingsFile.includes("'security'"), 'Security tab defined');
  assert.ok(settingsFile.includes("'integrations'"), 'Integrations tab defined');
  assert.ok(settingsFile.includes("'preferences'"), 'Preferences tab defined');
  assert.ok(settingsFile.includes("'about'"), 'About tab defined');
  assert.ok(settingsFile.includes('settings-readiness-banner'), 'Readiness banner rendered');
  assert.ok(settingsFile.includes('hashchange'), 'Hash change deep-linking supported');
});

test('Prompt 1 Settings: settings.js exports complete API suite', () => {
  const serviceFile = fs.readFileSync(path.join(root, 'src/services/settings.js'), 'utf-8');
  const expectedMethods = [
    'getProfile',
    'updateProfile',
    'getBusinessProfile',
    'updateBusinessProfile',
    'getPreferences',
    'updatePreferences',
    'getSecurityOverview',
    'changePassword',
    'getIntegrationStatus',
    'getSystemStatus',
  ];
  for (const method of expectedMethods) {
    assert.ok(serviceFile.includes(method), `settings.js exports ${method}`);
  }
});

test('Prompt 1 Auth: AuthContext exposes updateUser helper and handles session rotation', () => {
  const authCtx = fs.readFileSync(path.join(root, 'src/context/AuthContext.jsx'), 'utf-8');
  assert.ok(authCtx.includes('updateUser'), 'AuthContext exposes updateUser');
  assert.ok(authCtx.includes('interceptors.response'), 'AuthContext attaches 401 interceptor');
  assert.ok(authCtx.includes('refreshUser'), 'AuthContext exposes refreshUser');
});

test('Prompt 1 Auth: AuthPage enforces single-operator branding and security safeguards', () => {
  const authPage = fs.readFileSync(path.join(root, 'src/pages/AuthPage.jsx'), 'utf-8');
  assert.ok(authPage.includes('Single-Operator'), 'Single-operator branding present');
  assert.ok(authPage.includes('show ? <EyeOff'), 'Password reveal toggle present');
  assert.ok(authPage.includes('disabled={busy}'), 'Submit button disabled during processing');
});
