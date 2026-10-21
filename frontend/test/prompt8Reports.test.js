import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const reportsPagePath = path.resolve(__dirname, '../src/pages/ReportsPage.jsx');
const reportsServicePath = path.resolve(__dirname, '../src/services/reports.js');

test('Prompt 8 — Frontend: ReportsPage exports 5 Primary Tabs (Overview, Campaigns, Messages, Consent, Exports)', () => {
  const code = fs.readFileSync(reportsPagePath, 'utf8');
  assert.ok(code.includes("activeTab === 'overview'"), 'Must have Overview tab');
  assert.ok(code.includes("activeTab === 'campaigns'"), 'Must have Campaign Performance tab');
  assert.ok(code.includes("activeTab === 'messages'"), 'Must have Message Activity tab');
  assert.ok(code.includes("activeTab === 'consent'"), 'Must have Consent & Opt-outs tab');
  assert.ok(code.includes("activeTab === 'exports'"), 'Must have Exports tab');
});

test('Prompt 8 — Frontend: 4 Primary KPI Cards with Truthful Provider Disconnected State', () => {
  const code = fs.readFileSync(reportsPagePath, 'utf8');
  assert.ok(code.includes('Total Campaigns'), 'Must render Total Campaigns KPI card');
  assert.ok(code.includes('Scheduled / Running'), 'Must render Scheduled / Running KPI card');
  assert.ok(code.includes('Mock Messages Processed'), 'Must render Mock Messages Processed KPI card');
  assert.ok(code.includes('Verified Messages Sent'), 'Must render Verified Messages Sent KPI card');
  assert.ok(code.includes('Not Available'), 'Verified messages card must show Not Available when disconnected');
  assert.ok(code.includes('Provider Disconnected'), 'Verified card must indicate Provider Disconnected');
});

test('Prompt 8 — Frontend: Secondary Operational Metrics Breakdown', () => {
  const code = fs.readFileSync(reportsPagePath, 'utf8');
  assert.ok(code.includes('Draft Campaigns'), 'Must display Draft Campaigns count');
  assert.ok(code.includes('Completed Mock Runs'), 'Must display Completed Mock Runs count');
  assert.ok(code.includes('Failed Mock Runs'), 'Must display Failed Mock Runs count');
  assert.ok(code.includes('Excluded Recipients'), 'Must display Excluded Recipients count');
  assert.ok(code.includes('Retry Attempts'), 'Must display Retry Attempts count');
  assert.ok(code.includes('Unread Inbox Threads'), 'Must display Unread Inbox Threads count');
  assert.ok(code.includes('Recorded Opt-Outs'), 'Must display Recorded Opt-Outs count');
});

test('Prompt 8 — Frontend: Responsive Filter Toolbar (Date, Campaign, Mode, Status, Refresh, Export)', () => {
  const code = fs.readFileSync(reportsPagePath, 'utf8');
  assert.ok(code.includes('Last 30 Days'), 'Must include 30d range option');
  assert.ok(code.includes('Custom Range'), 'Must support custom date range');
  assert.ok(code.includes('All Campaigns'), 'Must support campaign filtering');
  assert.ok(code.includes('Mock Engine Only'), 'Must support Mock execution mode filter');
  assert.ok(code.includes('Verified Provider'), 'Must support Verified Provider mode filter');
  assert.ok(code.includes('Export Report'), 'Must offer primary Export Report action button');
});

test('Prompt 8 — Frontend: Recharts Visualizations & Empty States', () => {
  const code = fs.readFileSync(reportsPagePath, 'utf8');
  assert.ok(code.includes('ResponsiveContainer'), 'Must use responsive chart containers');
  assert.ok(code.includes('AreaChart'), 'Must render Message Processing Trend AreaChart');
  assert.ok(code.includes('BarChart'), 'Must render Campaign Status and Failure BarCharts');
  assert.ok(code.includes('PieChart'), 'Must render Audience Eligibility PieChart');
  assert.ok(code.includes('No mock message dispatches in this date range.'), 'Must provide empty state for charts');
});

test('Prompt 8 — Frontend: Campaign Performance Table & Multi-Campaign Comparison (2-4 Campaigns)', () => {
  const code = fs.readFileSync(reportsPagePath, 'utf8');
  assert.ok(code.includes('handleToggleCompare'), 'Must implement toggle compare selection');
  assert.ok(code.includes('compareCampaigns'), 'Must call compareCampaigns service');
  assert.ok(code.includes('Campaign Performance Comparison'), 'Must render Comparison dialog / modal');
  assert.ok(code.includes('Selected for Comparison'), 'Must display selected count indicator');
  assert.ok(code.includes('Audience Size'), 'Must compare Audience Size');
  assert.ok(code.includes('Eligible Contacts'), 'Must compare Eligible Contacts');
  assert.ok(code.includes('Mock Messages Processed'), 'Must compare Mock Messages Processed');
});

test('Prompt 8 — Frontend: Message Activity, Failures & Retry Analytics', () => {
  const code = fs.readFileSync(reportsPagePath, 'utf8');
  assert.ok(code.includes('Internal Preparation States'), 'Must display internal preparation metrics');
  assert.ok(code.includes('Mock Engine Outcomes'), 'Must display mock outcomes');
  assert.ok(code.includes('Failure & Exclusion Analysis'), 'Must render failure analysis table');
  assert.ok(code.includes('Messages Requiring Retry'), 'Must display messages requiring retry');
  assert.ok(code.includes('Total Retry Attempts'), 'Must display sum of retry attempts');
  assert.ok(code.includes('Retries Succeeded in Mock'), 'Must display retries that succeeded');
});

test('Prompt 8 — Frontend: Consent & Opt-Out Audit Reporting', () => {
  const code = fs.readFileSync(reportsPagePath, 'utf8');
  assert.ok(code.includes('Total Contacts'), 'Must display total contacts');
  assert.ok(code.includes('Recorded WhatsApp Opt-In'), 'Must display valid opt-in count');
  assert.ok(code.includes('Unknown Consent'), 'Must display unknown consent count');
  assert.ok(code.includes('Opted Out / Suppressed'), 'Must display suppression count');
  assert.ok(code.includes('Recorded Opt-Out & Suppression Events'), 'Must render opt-out events table');
  assert.ok(code.includes('Campaign Audience Exclusion Reasons'), 'Must render exclusion reason breakdown');
});

test('Prompt 8 — Frontend: Secure Export Modal Dialog & Format Selection', () => {
  const code = fs.readFileSync(reportsPagePath, 'utf8');
  assert.ok(code.includes('exportReport'), 'Must wire exportReport service');
  assert.ok(code.includes('CSV (Tabular text)'), 'Must support CSV format');
  assert.ok(code.includes('Excel (XLSX)'), 'Must support XLSX format');
  assert.ok(code.includes('campaign_summary'), 'Must support Campaign Summary report type');
  assert.ok(code.includes('campaign_recipients'), 'Must support Campaign Recipients report type');
  assert.ok(code.includes('Archived Export History'), 'Must render export history table');
});

test('Prompt 8 — Frontend: Reports Service API Client Coverage', () => {
  const code = fs.readFileSync(reportsServicePath, 'utf8');
  assert.ok(code.includes('/reports/overview'), 'Must call /reports/overview');
  assert.ok(code.includes('/reports/campaigns'), 'Must call /reports/campaigns');
  assert.ok(code.includes('/reports/campaigns/compare'), 'Must call /reports/campaigns/compare');
  assert.ok(code.includes('/reports/messages/status'), 'Must call /reports/messages/status');
  assert.ok(code.includes('/reports/messages/failures'), 'Must call /reports/messages/failures');
  assert.ok(code.includes('/reports/messages/retries'), 'Must call /reports/messages/retries');
  assert.ok(code.includes('/reports/consent'), 'Must call /reports/consent');
  assert.ok(code.includes('/reports/opt-outs'), 'Must call /reports/opt-outs');
  assert.ok(code.includes('/reports/export'), 'Must call /reports/export');
  assert.ok(code.includes('/reports/exports'), 'Must call /reports/exports');
});
