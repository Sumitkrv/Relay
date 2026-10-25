import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dash = fs.readFileSync(path.resolve(__dirname, '../src/pages/Dashboard.jsx'), 'utf8');
const css = fs.readFileSync(path.resolve(__dirname, '../src/overview.css'), 'utf8');

test('Overview CSS is scoped: every selector starts with .ov-', () => {
  const body = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const re = /(?:^|[};])\s*([^{};@]+?)\s*\{/g;
  let m;
  let checked = 0;
  while ((m = re.exec(body))) {
    const group = m[1].trim();
    if (/^(from|to|\d+%)$/.test(group) || /^[\w-]+\s*:/.test(group)) continue;
    for (const sel of group.split(',').map((x) => x.trim()).filter(Boolean)) {
      checked += 1;
      assert.ok(sel.startsWith('.ov-'), `Unscoped selector: ${sel}`);
    }
  }
  assert.ok(checked > 40);
});

test('Overview palette uses Electric Blue and Midnight Navy tokens', () => {
  for (const hex of ['#0F172A', '#2563EB', '#1D4ED8', '#EFF6FF', '#F4F7FC', '#E2E8F0', '#64748B']) {
    assert.ok(css.toUpperCase().includes(hex), `missing ${hex}`);
  }
  assert.ok(!/#0D9488|#0F766E/i.test(css), 'No teal/green primary accents in overview.css');
});

test('Overview keeps all header actions, quick actions and routes', () => {
  for (const s of ['to="/import"', 'to="/campaigns/new"', "to: '/templates'", "to: '/inbox'", 'Refresh', 'Import contacts', 'New campaign']) {
    assert.ok(dash.includes(s), `missing ${s}`);
  }
  for (const s of ['Total Contacts', 'Verified Opted-in Contacts', 'Scheduled / Active Campaigns', 'Open Conversations',
    'Simulated Sent', 'Simulated Delivered', 'Simulated Read', 'Mock Failures', 'Auto-Reply Executions']) {
    assert.ok(dash.includes(s), `missing KPI ${s}`);
  }
});

test('Overview has no hardcoded industry terms and uses centralized industry copy', () => {
  assert.ok(dash.includes('industryConfig.ui.dashboard'));
  assert.ok(!/patient/i.test(dash), 'no patient terminology');
  assert.ok(!dash.includes('INDUSTRY_COPY') && !dash.includes('real_estate:'), 'industry copy must come from the authorized API');
});

test('Overview status is honest: unknown state when data unavailable, mock labelled', () => {
  assert.ok(dash.includes("'Unavailable'"));
  assert.ok(dash.includes('Mock Simulation'));
  assert.ok(dash.includes('Not connected'));
  assert.ok(dash.includes('system.workerRunning'));
});

test('Checklist is accessible and uses real onboarding data', () => {
  assert.ok(dash.includes('aria-expanded'));
  assert.ok(dash.includes('role="progressbar"'));
  assert.ok(dash.includes('onboarding.completedCount'));
});

test('Completed runs are labelled as mock runs, not campaigns', () => {
  assert.ok(dash.includes('Completed mock runs'));
});
