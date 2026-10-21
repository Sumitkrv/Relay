import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Navigation: AppLayout defines exactly 7 primary navigation screens', () => {
  const layoutPath = path.resolve(__dirname, '../src/layout/AppLayout.jsx');
  const code = fs.readFileSync(layoutPath, 'utf8');

  // Verify the 7 primary navigation items
  const expectedScreens = [
    { label: 'Overview', to: '/' },
    { label: 'Contacts', to: '/contacts' },
    { label: 'Templates', to: '/templates' },
    { label: 'Campaigns', to: '/campaigns' },
    { label: 'Inbox & Auto-reply', to: '/inbox' },
    { label: 'Reports', to: '/reports' },
    { label: 'Settings', to: '/settings' },
  ];

  for (const screen of expectedScreens) {
    if (screen.label === 'Overview') {
      assert.ok(
        code.includes("label: 'Overview', to: '/app'") || code.includes("label: 'Overview', to: '/'"),
        'Primary navigation must include Overview (/app or /)'
      );
    } else {
      assert.ok(
        code.includes(`label: '${screen.label}', to: '${screen.to}'`),
        `Primary navigation must include ${screen.label} (${screen.to})`
      );
    }
  }

  // Ensure legacy items are excluded from primary navigation array
  const excludedNavLabels = [
    'Sales Pipeline',
    'Import Excel',
    'Automation Workflows',
    'Chatbot Studio',
    'Follow-ups',
    'Hot Leads',
    'Activity Logs',
  ];

  for (const excluded of excludedNavLabels) {
    assert.ok(
      !code.includes(`label: '${excluded}'`),
      `Primary navigation must NOT include legacy item: ${excluded}`
    );
  }
});

test('Navigation: Single Operator workspace and brand header are configured', () => {
  const layoutPath = path.resolve(__dirname, '../src/layout/AppLayout.jsx');
  const code = fs.readFileSync(layoutPath, 'utf8');

  assert.ok(
    code.includes('Single Operator') || code.includes('Owner Workspace'),
    'AppLayout must display Single Operator / Owner workspace badge'
  );

  assert.ok(
    code.includes('Real Estate'),
    'AppLayout brand header must display Real Estate badge'
  );
});

test('Readiness Status: AppLayout checks /health and monitors backend, db, provider and mock mode', () => {
  const layoutPath = path.resolve(__dirname, '../src/layout/AppLayout.jsx');
  const code = fs.readFileSync(layoutPath, 'utf8');

  assert.ok(
    code.includes("api.get('/health')"),
    'AppLayout must query /health for live backend readiness'
  );

  assert.ok(
    code.includes('whatsappProvider'),
    'AppLayout must track WhatsApp provider state'
  );

  assert.ok(
    code.includes('mockMode'),
    'AppLayout must track mockMode status'
  );
});

test('Breadcrumbs: Breadcrumbs.jsx defines standard route labels aligned with PPT', () => {
  const crumbsPath = path.resolve(__dirname, '../src/components/Breadcrumbs.jsx');
  const code = fs.readFileSync(crumbsPath, 'utf8');

  assert.ok(code.includes("'templates': 'Templates'"), 'Breadcrumb for templates must be Templates');
  assert.ok(code.includes("'inbox': 'Inbox & Auto-reply'"), 'Breadcrumb for inbox must be Inbox & Auto-reply');
  assert.ok(code.includes("'reports': 'Reports'"), 'Breadcrumb for reports must be Reports');
  assert.ok(code.includes("'contacts': 'Contacts'"), 'Breadcrumb for contacts must be Contacts');
});

test('Import & Contacts Integration: Contacts links to import and import has back to contacts', () => {
  const contactsPath = path.resolve(__dirname, '../src/pages/ContactsPage.jsx');
  const contactsCode = fs.readFileSync(contactsPath, 'utf8');
  assert.ok(
    contactsCode.includes("navigate('/import')"),
    'ContactsPage must link directly to /import'
  );

  const importPath = path.resolve(__dirname, '../src/pages/ImportPage.jsx');
  const importCode = fs.readFileSync(importPath, 'utf8');
  assert.ok(
    importCode.includes("navigate('/contacts')"),
    'ImportPage must have navigation button back to /contacts'
  );
});
