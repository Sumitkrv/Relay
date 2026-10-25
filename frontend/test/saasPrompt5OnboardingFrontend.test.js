import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPublicIndustrySummaries } from '../../backend/src/config/industries/industryRegistry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('SaaS Prompt 5 — 1. Route Registry & Onboarding Entry Points in App.jsx', () => {
  const appPath = path.resolve(__dirname, '../src/App.jsx');
  const code = fs.readFileSync(appPath, 'utf8');

  assert.ok(code.includes('/onboarding'), 'App.jsx must declare /onboarding route');
  assert.ok(code.includes('/app/getting-started'), 'App.jsx must declare /app/getting-started route');
  assert.ok(code.includes('BusinessOnboardingPage'), 'App.jsx must import BusinessOnboardingPage');
  assert.ok(code.includes('WorkspaceGettingStartedPage'), 'App.jsx must import WorkspaceGettingStartedPage');
});

test('SaaS Prompt 5 — 2. Frontend Onboarding Service API Surface', () => {
  const servicePath = path.resolve(__dirname, '../src/services/onboarding.js');
  const code = fs.readFileSync(servicePath, 'utf8');

  assert.ok(code.includes('getOnboardingStatus'), 'Must export getOnboardingStatus');
  assert.ok(code.includes('getOnboardingDraft'), 'Must export getOnboardingDraft');
  assert.ok(code.includes('updateOnboardingDraft'), 'Must export updateOnboardingDraft');
  assert.ok(code.includes('uploadOnboardingLogo'), 'Must export uploadOnboardingLogo');
  assert.ok(code.includes('deleteOnboardingLogo'), 'Must export deleteOnboardingLogo');
  assert.ok(code.includes('completeOnboarding'), 'Must export completeOnboarding');
});

test('SaaS Prompt 5 — 3. All 13 Supported Industries Configuration', () => {
  const pagePath = path.resolve(__dirname, '../src/pages/BusinessOnboardingPage.jsx');
  const code = fs.readFileSync(pagePath, 'utf8');

  const requiredIndustries = [
    'real_estate',
    'gym',
    'clinic',
    'education',
    'salon',
    'automobile',
    'travel_tourism',
    'ecommerce_retail',
    'restaurant_food',
    'home_services',
    'hospitality',
    'professional_services',
    'generic_business',
  ];

  for (const ind of requiredIndustries) {
    assert.ok(getPublicIndustrySummaries().some(item => item.key === ind), `Industry API must support "${ind}"`);
  }
  assert.equal(getPublicIndustrySummaries().length, 13, 'No alias duplicates in onboarding');
  assert.ok(code.includes('getIndustrySummaries()') && code.includes('industries.map'), 'Render the API catalog');
  assert.ok(code.includes('retryStarterProvisioning'), 'Step 6 must offer a real backend retry for unfinished starter provisioning');
});

test('SaaS Prompt 5 — 4. Business Identity Form Validation & Inputs', () => {
  const pagePath = path.resolve(__dirname, '../src/pages/BusinessOnboardingPage.jsx');
  const code = fs.readFileSync(pagePath, 'utf8');

  assert.ok(code.includes('name="name"'), 'Step 1 must have business name input');
  assert.ok(code.includes('name="email"'), 'Step 1 must have business email input');
  assert.ok(code.includes('name="phone"'), 'Step 1 must have business phone input');
  assert.ok(code.includes('name="website"'), 'Step 1 must have business website input');
  assert.ok(code.includes('name="description"'), 'Step 1 must have business description input');
  assert.ok(code.includes('validateStep1'), 'Must include client-side validation for Step 1');
});

test('SaaS Prompt 5 — 5. Branding & Logo Upload Security UI', () => {
  const pagePath = path.resolve(__dirname, '../src/pages/BusinessOnboardingPage.jsx');
  const code = fs.readFileSync(pagePath, 'utf8');

  assert.ok(code.includes('image/png') && code.includes('image/jpeg') && code.includes('image/webp'), 'Must allow PNG, JPEG, WEBP');
  assert.ok(code.includes('2 * 1024 * 1024') || code.includes('2 MB'), 'Must enforce 2 MB size limit');
  assert.ok(code.includes('handleLogoUpload'), 'Must have logo upload handler');
  assert.ok(code.includes('handleRemoveLogo'), 'Must have logo remove handler');
  assert.ok(code.includes('Replace Logo') || code.includes('Replace'), 'Must support replacing logo');
});

test('SaaS Prompt 5 — 6. Review & Provisioning Step Integration', () => {
  const pagePath = path.resolve(__dirname, '../src/pages/BusinessOnboardingPage.jsx');
  const code = fs.readFileSync(pagePath, 'utf8');

  assert.ok(code.includes('Review & Confirm Setup'), 'Must have review confirmation screen');
  assert.ok(code.includes('Create Business Workspace'), 'Must have Create Business Workspace action');
  assert.ok(code.includes('handleProvisionWorkspace'), 'Must call provisioning handler');
  assert.ok(code.includes('Workspace Provisioned Successfully'), 'Must show successful completion state');
  assert.ok(code.includes('/app'), 'Completion must link to dashboard /app');
});

test('SaaS Prompt 5 — 7. Workspace Getting Started Post-Onboarding Screen', () => {
  const pagePath = path.resolve(__dirname, '../src/pages/WorkspaceGettingStartedPage.jsx');
  const code = fs.readFileSync(pagePath, 'utf8');

  assert.ok(code.includes('Workspace Authorized') || code.includes('Workspace Hub'), 'Must indicate authorized workspace');
  assert.ok(code.includes('currentWorkspace'), 'Must read currentWorkspace from context');
  assert.ok(code.includes('Tenant Isolation') || code.includes('Isolated Workspace Scope'), 'Must emphasize tenant isolation');
  assert.ok(code.includes('Sign Out') || code.includes('handleLogout'), 'Must offer safe sign out');
  assert.ok(!code.includes('SaaS Prompt 6'), 'Must not leak internal prompt numbers to customer');
});

test('SaaS Prompt 5 & Emergency Fix — 8. Full Dashboard Access for All Workspaces', () => {
  const dashPath = path.resolve(__dirname, '../src/pages/Dashboard.jsx');
  const code = fs.readFileSync(dashPath, 'utf8');

  assert.ok(code.includes('PageHeader'), 'Dashboard must render full PageHeader');
  assert.ok(code.includes('getDashboardOverview'), 'Dashboard must fetch genuine overview metrics');
  assert.ok(!code.includes('WorkspaceGettingStartedPage'), 'Must not gate non-m2w workspaces to getting started screen');
});
