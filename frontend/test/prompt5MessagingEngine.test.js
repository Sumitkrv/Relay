import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Prompt 5 - Frontend Messages Service API Surface', () => {
  const servicePath = path.resolve(__dirname, '../src/services/messages.js');
  const code = fs.readFileSync(servicePath, 'utf8');

  const requiredExports = [
    'listMessages',
    'getMessageStats',
    'getMessage',
    'getMessageEvents',
    'prepareMessage',
    'retryMessage',
    'cancelMessage',
    'getSystemMessagingStatus',
    'runMockDiagnostic',
    'getMockDiagnosticResults',
    'getCampaignMessages',
    'getCampaignQueueStatus'
  ];

  for (const fn of requiredExports) {
    assert.ok(
      code.includes(`export const ${fn} =`) || code.includes(`export const ${fn}=`),
      `messages.js must export ${fn}`
    );
  }
});

test('Prompt 5 - Message Modal Components Exist and Conform', () => {
  const payloadModalPath = path.resolve(__dirname, '../src/components/MessagePayloadModal.jsx');
  const eventsModalPath = path.resolve(__dirname, '../src/components/MessageEventsModal.jsx');

  assert.ok(fs.existsSync(payloadModalPath), 'MessagePayloadModal component must exist');
  assert.ok(fs.existsSync(eventsModalPath), 'MessageEventsModal component must exist');

  const payloadCode = fs.readFileSync(payloadModalPath, 'utf8');
  assert.ok(payloadCode.includes('MOCK SIMULATION'), 'Must display MOCK SIMULATION badge');
  assert.ok(payloadCode.includes('renderedContentSnapshot'), 'Must display rendered snapshot');
  assert.ok(payloadCode.includes('idempotencyKey'), 'Must display idempotencyKey for auditability');

  const eventsCode = fs.readFileSync(eventsModalPath, 'utf8');
  assert.ok(eventsCode.includes('Message Execution Audit Trail'), 'Must display execution audit trail title');
  assert.ok(eventsCode.includes('getMessageEvents'), 'Must load events from backend message event service');
});

test('Prompt 5 - Campaigns Page Message Execution & Queue Integration', () => {
  const pagePath = path.resolve(__dirname, '../src/pages/CampaignsPage.jsx');
  const code = fs.readFileSync(pagePath, 'utf8');

  // Verify MOCK badge and Progress
  assert.ok(code.includes('MOCK SIMULATION'), 'Campaigns page must clearly identify MOCK SIMULATION mode');
  assert.ok(code.includes('getCampaignQueueStatus'), 'Campaigns page must integrate with getCampaignQueueStatus');
  assert.ok(code.includes('getCampaignMessages'), 'Campaigns page must fetch execution messages via getCampaignMessages');
  assert.ok(code.includes('retryMessage'), 'Campaigns page must allow retrying eligible message failures');
  assert.ok(code.includes('cancelMessage'), 'Campaigns page must allow cancelling pending messages');
  assert.ok(code.includes('MessagePayloadModal'), 'Campaigns page must render MessagePayloadModal');
  assert.ok(code.includes('MessageEventsModal'), 'Campaigns page must render MessageEventsModal');
});

test('Prompt 5 - Contacts Page Detail Drawer Message History Section', () => {
  const pagePath = path.resolve(__dirname, '../src/pages/ContactsPage.jsx');
  const code = fs.readFileSync(pagePath, 'utf8');

  assert.ok(code.includes('WhatsApp Message History'), 'Contact drawer must include Section 5 WhatsApp Message History');
  assert.ok(code.includes('MOCK SIMULATION'), 'Contact drawer message history must display MOCK SIMULATION badge');
  assert.ok(code.includes('listMessages'), 'Contact drawer must call listMessages with contactId');
  assert.ok(code.includes('MessagePayloadModal'), 'Contact drawer must integrate MessagePayloadModal');
  assert.ok(code.includes('MessageEventsModal'), 'Contact drawer must integrate MessageEventsModal');
});

test('Prompt 5 - Settings WhatsApp Integration Diagnostics & Queue Health', () => {
  const pagePath = path.resolve(__dirname, '../src/pages/SettingsPage.jsx');
  const code = fs.readFileSync(pagePath, 'utf8');

  assert.ok(code.includes('Durable Message Queue & Worker Health') || code.includes('Durable Message Queue &amp; Worker Health'), 'Must display queue health section');
  assert.ok(code.includes('Developer Mock Messaging Diagnostic Harness'), 'Must display developer simulation test harness');
  assert.ok(code.includes('runMockDiagnostic'), 'Must call runMockDiagnostic');
  assert.ok(code.includes('getSystemMessagingStatus'), 'Must call getSystemMessagingStatus');
  assert.ok(code.includes('Worker Active'), 'Must show worker active status');
});

test('Prompt 5 - Strict 7-Screen Scope & Sidebar Preservation', () => {
  const navPath = path.resolve(__dirname, '../src/layout/AppLayout.jsx');
  const code = fs.readFileSync(navPath, 'utf8');

  // Verify NO new sidebar primary links added
  assert.ok(!code.includes("path: '/queue'"), 'Must NOT add a Message Queue primary sidebar screen');
  assert.ok(!code.includes("path: '/workers'"), 'Must NOT add a Worker Management primary sidebar screen');
  assert.ok(!code.includes("path: '/billing'"), 'Must NOT add billing');
});
