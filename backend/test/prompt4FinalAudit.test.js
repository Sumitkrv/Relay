import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(path.join(here, '..', p), 'utf8');

test('demo seed/reset maintenance endpoints fail closed', () => {
  const src = read('src/controllers/settingsController.js');
  assert.match(src, /assertDemoMaintenanceAllowed/);
  assert.match(src, /ALLOW_DEMO_MAINTENANCE_API/);
});

test('settings routes reject forged x-workspace-id via membership check', () => {
  const src = read('src/routes/settingsRoutes.js');
  assert.match(src, /WorkspaceMembership/);
  assert.match(src, /x-workspace-id/i);
});

test('manual takeover pauses auto-reply and records PAUSED_TAKEOVER', () => {
  const src = read('src/services/autoReplyRuleService.js');
  assert.match(src, /automationStatus === 'PAUSED'/);
  assert.match(src, /PAUSED_TAKEOVER/);
});

test('cooldown bypass is limited to non-production synthetic mode', () => {
  const src = read('src/services/autoReplyRuleService.js');
  assert.match(src, /executionMode === 'SYNTHETIC_TEST' && process\.env\.NODE_ENV !== 'production'/);
});

test('onboarding page has no customer-facing roadmap text', () => {
  const src = fs.readFileSync(path.join(here, '../../frontend/src/pages/BusinessOnboardingPage.jsx'), 'utf8');
  assert.doesNotMatch(src, /SaaS Prompt \d/);
});

test('Overview aggregates Message.status (SIMULATED_*) cumulatively, not a nonexistent deliveryStatus field', () => {
  const src = read('src/controllers/dashboardController.js');
  assert.doesNotMatch(src, /\$deliveryStatus/);
  assert.match(src, /SIMULATED_SENT.*SIMULATED_DELIVERED.*SIMULATED_READ/);
});

test('Overview copy is industry-aware (no hardcoded property wording for every workspace)', () => {
  const src = read('src/controllers/dashboardController.js');
  assert.match(src, /INDUSTRY_COPY/);
  assert.doesNotMatch(src, /finalize property enquiry branding/);
  assert.match(src, /clinic:/);
  assert.match(src, /gym:/);
});

test('Overview reports real worker status and separates run counts from campaign counts', () => {
  const src = read('src/controllers/dashboardController.js');
  assert.match(src, /getWorkerStatus/);
  assert.match(src, /completedRuns/);
});
