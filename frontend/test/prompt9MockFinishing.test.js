import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_SRC = path.resolve(__dirname, '../src');

test('Prompt 9 — Frontend: Developer Testing Center & Mock Finishing', async (t) => {
  await t.test('1. SettingsPage.jsx defines "developer" in VALID_TABS', () => {
    const file = fs.readFileSync(path.join(FRONTEND_SRC, 'pages/SettingsPage.jsx'), 'utf8');
    assert.match(file, /VALID_TABS\s*=\s*\[[^\]]*'developer'[^\]]*\]/);
  });

  await t.test('2. SettingsPage.jsx renders Developer / Test Mode navigation button', () => {
    const file = fs.readFileSync(path.join(FRONTEND_SRC, 'pages/SettingsPage.jsx'), 'utf8');
    assert.match(file, /switchTab\('developer'\)/);
    assert.match(file, /Developer \/ Test Mode/);
  });

  await t.test('3. SettingsPage.jsx mounts DeveloperTestingCenter when activeTab === "developer"', () => {
    const file = fs.readFileSync(path.join(FRONTEND_SRC, 'pages/SettingsPage.jsx'), 'utf8');
    assert.match(file, /import DeveloperTestingCenter from '\.\.\/components\/DeveloperTestingCenter'/);
    assert.match(file, /activeTab\s*===\s*'developer'[\s\S]*?<DeveloperTestingCenter/);
  });

  await t.test('4. DeveloperTestingCenter.jsx exists and has zero dead buttons', () => {
    const file = fs.readFileSync(path.join(FRONTEND_SRC, 'components/DeveloperTestingCenter.jsx'), 'utf8');
    assert.ok(file.includes('RELAY MOCK TESTING CENTER'));
    assert.ok(file.includes('Simulate Customer Inbound Reply'));
    assert.ok(file.includes('Simulate Delivery / Read Status Events'));
    assert.ok(file.includes('Template Mock Approval Simulator'));
    assert.ok(file.includes('Demo Dataset & Fixtures Manager'));
    assert.ok(file.includes('Deterministic Mock Provider Diagnostic Scenarios'));
    assert.ok(file.includes('Master Subsystem Completion'));

    // Check that every button has an onClick or type="submit"
    const buttonMatches = file.match(/<button[\s\S]*?<\/button>/g) || [];
    assert.ok(buttonMatches.length >= 10, 'Expected at least 10 action buttons in DeveloperTestingCenter');
    for (const btn of buttonMatches) {
      const hasAction = btn.includes('onClick=') || btn.includes('type="submit"');
      assert.ok(hasAction, `Found dead button without onClick or submit: ${btn.slice(0, 60)}...`);
    }
  });

  await t.test('5. messages.js exports complete mock simulator API client surface', () => {
    const file = fs.readFileSync(path.join(FRONTEND_SRC, 'services/messages.js'), 'utf8');
    assert.match(file, /export const simulateInboundReply/);
    assert.match(file, /export const simulateStatusEvent/);
    assert.match(file, /export const simulateOutageToggle/);
    assert.match(file, /export const getFixturesStatus/);
    assert.match(file, /export const loadTestFixtures/);
    assert.match(file, /export const resetDemoData/);
    assert.match(file, /export const runCampaignWorkerNow/);
    assert.match(file, /export const getSystemTestMatrix/);
    assert.match(file, /export const simulateTemplateApproval/);
  });

  await t.test('6. AppLayout preserves strict 7 primary navigation screens (Developer is in Settings)', () => {
    const file = fs.readFileSync(path.join(FRONTEND_SRC, 'layout/AppLayout.jsx'), 'utf8');
    // Ensure primary navigation items count is 7
    const navItems = [
      { path: '/', label: 'Overview' },
      { path: '/contacts', label: 'Contacts' },
      { path: '/templates', label: 'Templates' },
      { path: '/campaigns', label: 'Campaigns' },
      { path: '/inbox', label: 'Inbox' },
      { path: '/reports', label: 'Reports' },
      { path: '/settings', label: 'Settings' }
    ];
    for (const item of navItems) {
      assert.ok(file.includes(item.path), `AppLayout missing route ${item.path}`);
    }
    // Verify no 8th primary nav link
    assert.ok(!file.includes('/developer'), 'Developer tab must NOT be an 8th primary nav route; it lives inside Settings');
  });
});
