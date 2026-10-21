import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const inboxPagePath = path.resolve(__dirname, '../src/pages/InboxPage.jsx');
const inboxServicePath = path.resolve(__dirname, '../src/services/inbox.js');

test('Prompt 7 — Frontend: InboxPage exports 3 Primary Tabs (Conversations, Auto-reply Rules, Quick Replies)', () => {
  const code = fs.readFileSync(inboxPagePath, 'utf8');
  assert.ok(code.includes("activeTab === 'conversations'"), 'Must have Conversations tab');
  assert.ok(code.includes("activeTab === 'rules'"), 'Must have Auto-reply Rules tab');
  assert.ok(code.includes("activeTab === 'quickreplies'"), 'Must have Quick Replies tab');
});

test('Prompt 7 — Frontend: Rebuilt 3-Panel Workspace Layout Structure', () => {
  const code = fs.readFileSync(inboxPagePath, 'utf8');
  assert.ok(code.includes('inbox-workspace'), 'Must render .inbox-workspace grid');
  assert.ok(code.includes('inbox-list-panel'), 'Must render left conversation list panel');
  assert.ok(code.includes('inbox-chat-panel'), 'Must render center active chat panel');
  assert.ok(code.includes('inbox-contact-panel'), 'Must render right contact details panel');
});

test('Prompt 7 — Frontend: Truthful Provider Disconnected Status Banner', () => {
  const code = fs.readFileSync(inboxPagePath, 'utf8');
  assert.ok(code.includes('WhatsApp Disconnected (Mock Mode)'), 'Must truthfully declare WhatsApp Disconnected');
  assert.ok(code.includes('WhatsApp Cloud API Disconnected · Internal CRM simulation mode'), 'Must declare simulation mode in chat timeline banner');
});

test('Prompt 7 — Frontend: Owner Takeover & Manual Control Automation Controls', () => {
  const code = fs.readFileSync(inboxPagePath, 'utf8');
  assert.ok(code.includes('toggleTakeover'), 'Must define toggleTakeover function');
  assert.ok(code.includes('Manual Control'), 'Must display Manual Control button/state');
  assert.ok(code.includes('Auto-Reply Active'), 'Must display Auto-Reply Active status');
  assert.ok(code.includes('inbox-takeover-banner'), 'Must render prominent takeover banner when paused');
});

test('Prompt 7 — Frontend: Message Timeline, Internal Notes & Campaign Traceability', () => {
  const code = fs.readFileSync(inboxPagePath, 'utf8');
  assert.ok(code.includes('inbox-message-scroll'), 'Must render scrollable message timeline');
  assert.ok(code.includes('inbox-note-bubble'), 'Must visually distinguish internal notes');
  assert.ok(code.includes('inbox-campaign-chip'), 'Must display campaign traceability chip for campaign mock messages');
});

test('Prompt 7 — Frontend: Message Composer with Quick Replies, Templates & Mock Send', () => {
  const code = fs.readFileSync(inboxPagePath, 'utf8');
  assert.ok(code.includes('Quick Replies'), 'Must provide Quick Replies button in composer');
  assert.ok(code.includes('insertTemplate'), 'Must support template insertion');
  assert.ok(code.includes('Save Draft'), 'Must provide Save Draft button');
  assert.ok(code.includes('Send Mock Reply'), 'Must provide Send Mock Reply button for simulated messaging');
});

test('Prompt 7 — Frontend: Inbound Synthetic Test Simulator with Real Estate Presets', () => {
  const code = fs.readFileSync(inboxPagePath, 'utf8');
  assert.ok(code.includes('Simulate Inbound'), 'Must offer Simulate Inbound trigger');
  assert.ok(code.includes('BROCHURE'), 'Must offer BROCHURE preset test');
  assert.ok(code.includes('PRICE'), 'Must offer PRICE preset test');
  assert.ok(code.includes('VISIT'), 'Must offer VISIT preset test');
  assert.ok(code.includes('STOP (Opt-out)'), 'Must offer STOP opt-out preset test');
});

test('Prompt 7 — Frontend: Auto-Reply Rules Tab with Interactive Rule Match Tester & History', () => {
  const code = fs.readFileSync(inboxPagePath, 'utf8');
  assert.ok(code.includes('Keyword Automation Rules'), 'Must render Keyword Automation Rules heading');
  assert.ok(code.includes('Interactive Rule Match Tester'), 'Must render Interactive Rule Match Tester');
  assert.ok(code.includes('Recent Auto-reply Audit History'), 'Must render recent audit history table');
  assert.ok(code.includes('inbox-rule-card'), 'Must render rule cards');
});

test('Prompt 7 — Frontend: Quick Reply Library with Category Pills & Token Support', () => {
  const code = fs.readFileSync(inboxPagePath, 'utf8');
  assert.ok(code.includes('Quick Reply Library'), 'Must render Quick Reply Library heading');
  assert.ok(code.includes('New Quick Reply'), 'Must support creating new quick reply');
  assert.ok(code.includes('inbox-quick-reply-card'), 'Must render quick reply cards');
  assert.ok(code.includes('Insert in Chat'), 'Must support inserting quick reply into chat');
});

test('Prompt 7 — Frontend: Services API Surface in inbox.js', () => {
  const serviceCode = fs.readFileSync(inboxServicePath, 'utf8');
  assert.ok(serviceCode.includes('listQuickReplies'), 'Must export listQuickReplies');
  assert.ok(serviceCode.includes('createQuickReply'), 'Must export createQuickReply');
  assert.ok(serviceCode.includes('updateQuickReply'), 'Must export updateQuickReply');
  assert.ok(serviceCode.includes('deleteQuickReply'), 'Must export deleteQuickReply');
  assert.ok(serviceCode.includes('duplicateQuickReply'), 'Must export duplicateQuickReply');
  assert.ok(serviceCode.includes('listAutoReplyRules'), 'Must export listAutoReplyRules');
  assert.ok(serviceCode.includes('createAutoReplyRule'), 'Must export createAutoReplyRule');
  assert.ok(serviceCode.includes('testAutoReplyRule'), 'Must export testAutoReplyRule');
  assert.ok(serviceCode.includes('testMatchAllRules'), 'Must export testMatchAllRules');
  assert.ok(serviceCode.includes('getRuleExecutionHistory'), 'Must export getRuleExecutionHistory');
  assert.ok(serviceCode.includes('toggleConversationAutomation'), 'Must export toggleConversationAutomation');
  assert.ok(serviceCode.includes('sendMockReply'), 'Must export sendMockReply');
  assert.ok(serviceCode.includes('createSyntheticTestEvent'), 'Must export createSyntheticTestEvent');
});
