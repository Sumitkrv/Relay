import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Regression: listTemplates is exported from services/templates.js', () => {
  const servicePath = path.resolve(__dirname, '../src/services/templates.js');
  const serviceCode = fs.readFileSync(servicePath, 'utf8');
  assert.ok(
    serviceCode.includes('export const listTemplates'),
    'templates.js must export listTemplates function'
  );
});

test('Regression: TemplatesPage.jsx imports listTemplates from services/templates', () => {
  const pagePath = path.resolve(__dirname, '../src/pages/TemplatesPage.jsx');
  const pageCode = fs.readFileSync(pagePath, 'utf8');
  
  // Verify import statement includes listTemplates
  const importMatch = pageCode.match(/import\s*\{[^}]*listTemplates[^}]*\}\s*from\s*['"]\.\.\/services\/templates['"]/);
  assert.ok(
    importMatch,
    'TemplatesPage.jsx must explicitly import listTemplates from ../services/templates'
  );

  // Verify listTemplates is called in refresh
  assert.ok(
    pageCode.includes("listTemplates({archived:showArchived?'true':'false'})") || pageCode.includes("listTemplates({archived:'false'})"),
    'TemplatesPage.jsx must call listTemplates in refresh'
  );

  // Verify error toast uses deduplication ID to prevent duplicate toasts
  assert.ok(
    pageCode.includes("id:'template-load-error'") || pageCode.includes('id: "template-load-error"'),
    'TemplatesPage.jsx refresh error toast must use deduplication ID'
  );
});
