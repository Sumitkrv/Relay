import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Design Tokens: tokens.js defines Midnight Slate × Jade palette', async () => {
  const tokensPath = path.resolve(__dirname, '../src/theme/tokens.js');
  const tokensModule = await import(`file://${tokensPath}`);
  const tokens = tokensModule.tokens || tokensModule.default;

  assert.equal(tokens.colors.bg, '#F5F7FA', 'Background canvas must be #F5F7FA');
  assert.equal(tokens.colors.surface, '#FFFFFF', 'Surface must be #FFFFFF');
  assert.equal(tokens.colors.sidebar.bg, '#111827', 'Sidebar background must be Midnight Slate #111827');
  assert.equal(tokens.colors.sidebar.active, '#263A3E', 'Sidebar active state must be #263A3E');
  assert.equal(tokens.colors.primary.default, '#0D9488', 'Primary brand must be Jade #0D9488');
  assert.equal(tokens.layout.sidebarExpandedWidth, 252, 'Sidebar expanded width must be 252px');
  assert.equal(tokens.layout.sidebarCollapsedWidth, 72, 'Sidebar collapsed width must be 72px');
  assert.equal(tokens.layout.headerHeight, 68, 'Topbar height must be 68px');
});

test('Shared Components: PageHeader is exported and standardized', () => {
  const compPath = path.resolve(__dirname, '../src/components/PageHeader.jsx');
  assert.ok(fs.existsSync(compPath), 'PageHeader.jsx must exist');
  const code = fs.readFileSync(compPath, 'utf8');
  assert.ok(code.includes('page-header'), 'Must contain page-header container class');
  assert.ok(code.includes('page-header-title'), 'Must contain page-header-title class');
  assert.ok(code.includes('page-header-actions'), 'Must contain page-header-actions class');
});

test('Overview: Dashboard displays exact 4 primary KPIs and quick actions', () => {
  const pagePath = path.resolve(__dirname, '../src/pages/Dashboard.jsx');
  const code = fs.readFileSync(pagePath, 'utf8');

  assert.ok(code.includes('label="Total Contacts"'), 'Must display Total Contacts KPI');
  assert.ok(code.includes('label="Verified Opted-in Contacts"'), 'Must display Verified Opted-in Contacts KPI');
  assert.ok(code.includes('label="Scheduled / Active Campaigns"'), 'Must display Scheduled / Active Campaigns KPI');
  assert.ok(code.includes('label="Verified Customer Replies"'), 'Must display Customer Replies with Mock state context');
  assert.ok(code.includes('quick-actions-bar'), 'Must display Quick Actions bar');
  assert.ok(code.includes('Import Contacts'), 'Must include Import Contacts quick action');
  assert.ok(code.includes('Create Template'), 'Must include Create Template quick action');
  assert.ok(code.includes('Create Campaign'), 'Must include Create Campaign quick action');
  assert.ok(code.includes('Open Inbox'), 'Must include Open Inbox quick action');
});

test('Inbox: Rebuilt layout with dedicated Auto-reply rules and non-overlapping controls', () => {
  const pagePath = path.resolve(__dirname, '../src/pages/InboxPage.jsx');
  const code = fs.readFileSync(pagePath, 'utf8');

  assert.ok(code.includes('inbox-workspace'), 'Must define inbox-workspace');
  assert.ok(code.includes('Auto-reply Rules') || code.includes('autoReplyRules'), 'Must support Auto-reply rules tab');
  assert.ok(code.includes('BROCHURE'), 'Must support real estate BROCHURE auto-reply keyword');
  assert.ok(code.includes('PRICE'), 'Must support real estate PRICE auto-reply keyword');
  assert.ok(code.includes('VISIT'), 'Must support real estate VISIT auto-reply keyword');
  assert.ok(code.includes('STOP'), 'Must support real estate STOP auto-reply keyword');
  assert.ok(code.includes('inbox-chat-panel'), 'Must define center active conversation panel');
  assert.ok(code.includes('inbox-contact-panel'), 'Must define collapsible contact details panel');
});

test('Campaigns: Defines 4 primary cards and compact status summary', () => {
  const pagePath = path.resolve(__dirname, '../src/pages/CampaignsPage.jsx');
  const code = fs.readFileSync(pagePath, 'utf8');

  assert.ok(code.includes('Total Campaigns'), 'Must display Total Campaigns primary card');
  assert.ok(code.includes('Scheduled'), 'Must display Scheduled primary card');
  assert.ok(code.includes('Running'), 'Must display Running primary card');
  assert.ok(code.includes('Completed'), 'Must display Completed primary card');
  assert.ok(code.includes('Status Breakdown:'), 'Must display compact status breakdown pills');
});

test('Settings: Supports hash deep-linking and single-operator role mapping', () => {
  const pagePath = path.resolve(__dirname, '../src/pages/SettingsPage.jsx');
  const code = fs.readFileSync(pagePath, 'utf8');

  assert.ok(code.includes('window.location.hash'), 'Must synchronize with URL hash');
  assert.ok(code.includes("'profile'"), 'Must include profile tab');
  assert.ok(code.includes("'security'"), 'Must include security tab');
  assert.ok(code.includes("'integrations'"), 'Must include integrations tab');
  assert.ok(code.includes("'preferences'"), 'Must include preferences tab');
  assert.ok(code.includes("'about'"), 'Must include about tab');
  assert.ok(code.includes('Owner / Single Operator'), 'Must display Owner / Single Operator role');
});
