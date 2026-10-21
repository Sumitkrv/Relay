import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Prompt 4 - Frontend Templates Service API Surface', () => {
  const servicePath = path.resolve(__dirname, '../src/services/templates.js');
  const code = fs.readFileSync(servicePath, 'utf8');

  const requiredExports = [
    'listTemplates',
    'getTemplate',
    'createTemplate',
    'updateTemplate',
    'deleteTemplate',
    'duplicateTemplate',
    'archiveTemplate',
    'restoreTemplate',
    'getTemplateHistory',
    'getTemplateCampaigns',
    'previewTemplate',
    'bulkPreview',
    'getTemplateVersions',
    'previewTemplateVersion',
    'restoreTemplateVersion',
    'validateTemplate',
    'getTemplateLibrary',
    'getTemplateVariables',
    'getTemplateCategories',
    'uploadTemplateMedia',
    'deleteTemplateMedia',
  ];

  for (const fn of requiredExports) {
    assert.ok(
      code.includes(`export const ${fn}=`) || code.includes(`export const ${fn} =`),
      `templates.js must export ${fn}`
    );
  }
});

test('Prompt 4 - Template Studio 3-Panel Layout & Responsive Design', () => {
  const pagePath = path.resolve(__dirname, '../src/pages/TemplatesPage.jsx');
  const code = fs.readFileSync(pagePath, 'utf8');

  // Verify 3 panels exist
  assert.ok(code.includes('template-list-panel'), 'Template library left panel must exist');
  assert.ok(code.includes('template-editor-panel'), 'Template editor center panel must exist');
  assert.ok(code.includes('template-preview-column'), 'Template preview right column must exist');

  // Verify responsive drawer and mobile segment toggles
  assert.ok(code.includes('template-mobile-segments'), 'Mobile segment navigation must exist');
  assert.ok(code.includes('showPreviewDrawer'), 'Preview drawer collapse/expand toggle must exist');
});

test('Prompt 4 - Header Media Upload & Brochure Support', () => {
  const pagePath = path.resolve(__dirname, '../src/pages/TemplatesPage.jsx');
  const code = fs.readFileSync(pagePath, 'utf8');

  // Verify supported header types
  assert.ok(code.includes("'NONE'"), 'Header type NONE must be supported');
  assert.ok(code.includes("'TEXT'"), 'Header type TEXT must be supported');
  assert.ok(code.includes("'IMAGE'"), 'Header type IMAGE must be supported');
  assert.ok(code.includes("'VIDEO'"), 'Header type VIDEO must be supported');
  assert.ok(code.includes("'DOCUMENT'"), 'Header type DOCUMENT (PDF Brochure) must be supported');

  // Verify media upload integration
  assert.ok(code.includes('uploadTemplateMedia'), 'Must call uploadTemplateMedia API');
  assert.ok(code.includes('uploadProgress'), 'Must track upload progress');
  assert.ok(code.includes('headerMediaUrl'), 'Must bind header media URL');
  assert.ok(code.includes('headerMediaName'), 'Must bind header media filename');
  assert.ok(code.includes('removeHeaderMedia'), 'Must allow removing attached media');
});

test('Prompt 4 - Real Estate Variable Toolbar & Personalization Tokens', () => {
  const pagePath = path.resolve(__dirname, '../src/pages/TemplatesPage.jsx');
  const code = fs.readFileSync(pagePath, 'utf8');

  // Verify variable groups
  assert.ok(code.includes('Contact Profile'), 'Contact Profile group must exist');
  assert.ok(code.includes('Real Estate Preferences'), 'Real Estate group must exist');
  assert.ok(code.includes('M2W Realty Business'), 'Business profile group must exist');

  // Verify specific real estate tokens
  const realEstateTokens = ['property_type', 'project', 'preferred_location', 'budget'];
  for (const token of realEstateTokens) {
    assert.ok(code.includes(`key: '${token}'`), `Toolbar must provide ${token} variable chip`);
  }

  // Verify token insertion logic
  assert.ok(code.includes('insertVariable'), 'insertVariable handler must exist');
});

test('Prompt 4 - Interactive Buttons Builder & Mutual Exclusion Validation', () => {
  const pagePath = path.resolve(__dirname, '../src/pages/TemplatesPage.jsx');
  const code = fs.readFileSync(pagePath, 'utf8');

  // Verify supported button types
  assert.ok(code.includes('QUICK_REPLY'), 'QUICK_REPLY must be supported');
  assert.ok(code.includes('URL'), 'URL Call-to-Action must be supported');
  assert.ok(code.includes('PHONE_NUMBER'), 'PHONE_NUMBER Call-to-Action must be supported');

  // Verify button modal / configuration
  assert.ok(code.includes('Configure Action Button'), 'Button builder interface must exist');
  assert.ok(code.includes('handleAddButton'), 'Button addition validator must exist');
  assert.ok(code.includes('removeButton'), 'Button removal must exist');
});

test('Prompt 4 - WhatsApp Preview & Truthful Meta Approval Status', () => {
  const pagePath = path.resolve(__dirname, '../src/pages/TemplatesPage.jsx');
  const code = fs.readFileSync(pagePath, 'utf8');

  // Verify WhatsApp chat bubble rendering
  assert.ok(code.includes('whatsapp-preview'), 'WhatsApp preview container must exist');
  assert.ok(code.includes('wa-bubble'), 'WhatsApp message bubble must exist');

  // Verify truthful readiness badges (Never fake approved)
  assert.ok(code.includes('TEMPLATE PREVIEW · NOT SENT'), 'Must show TEMPLATE PREVIEW · NOT SENT banner');
  assert.ok(
    code.includes('Meta Status: Not Submitted (Mock Mode)') || code.includes('Not Submitted (Offline Mock)'),
    'Must truthfully display Meta Status: Not Submitted'
  );
  assert.ok(!code.includes('Meta Approved ✓'), 'Must NEVER claim unverified Meta approval');
});

test('Prompt 4 - Version History, Audit Snapshots & Campaign Pinned References', () => {
  const pagePath = path.resolve(__dirname, '../src/pages/TemplatesPage.jsx');
  const code = fs.readFileSync(pagePath, 'utf8');

  assert.ok(code.includes('Template Version History'), 'Version history modal must exist');
  assert.ok(code.includes('restoreVersionToDraft'), 'Restore historical version action must exist');
  assert.ok(code.includes('getTemplateCampaigns') || code.includes('campaignUsage'), 'Campaign references must be displayed');
  assert.ok(code.includes('duplicateTemplate'), 'Duplicate template action must exist');
  assert.ok(code.includes('handleArchiveToggle'), 'Archive / restore toggle must exist');
});
