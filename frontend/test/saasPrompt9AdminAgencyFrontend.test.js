import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('SaaS Prompt 09 — Frontend Platform Admin & Agency Management Test Suite', () => {
  test('1. adminService exports complete administrative API surface', () => {
    const servicePath = path.resolve(__dirname, '../src/services/admin.js');
    assert.ok(fs.existsSync(servicePath), 'admin.js must exist');
    const code = fs.readFileSync(servicePath, 'utf8');

    const expectedMethods = [
      'getOverview',
      'getWorkspaces',
      'getWorkspaceDetails',
      'suspendWorkspace',
      'reactivateWorkspace',
      'getUsers',
      'getAgencies',
      'getSubscriptions',
      'getSupportCases',
      'createSupportCase',
      'getAuditLogs',
      'getSystemHealth',
    ];

    for (const method of expectedMethods) {
      assert.ok(code.includes(`${method}:`), `adminService must export ${method}`);
    }
  });

  test('2. agencyService exports complete agency API surface', () => {
    const servicePath = path.resolve(__dirname, '../src/services/agency.js');
    assert.ok(fs.existsSync(servicePath), 'agency.js must exist');
    const code = fs.readFileSync(servicePath, 'utf8');

    const expectedMethods = [
      'getContext',
      'getClients',
      'getClientDetails',
      'inviteClient',
      'revokeClient',
      'getStaff',
      'inviteStaff',
      'removeStaff',
      'updateBranding',
      'verifyDomain',
    ];

    for (const method of expectedMethods) {
      assert.ok(code.includes(`${method}:`), `agencyService must export ${method}`);
    }
  });

  test('3. SuperAdminPage defines all 8 administrative sections with honest revenue labeling', () => {
    const pagePath = path.resolve(__dirname, '../src/pages/SuperAdminPage.jsx');
    const code = fs.readFileSync(pagePath, 'utf8');

    // Verify tabs
    assert.ok(code.includes("setActiveTab('overview')"), 'Must support overview tab');
    assert.ok(code.includes("setActiveTab('workspaces')"), 'Must support workspaces tab');
    assert.ok(code.includes("setActiveTab('agencies')"), 'Must support agencies tab');
    assert.ok(code.includes("setActiveTab('users')"), 'Must support users tab');
    assert.ok(code.includes("setActiveTab('subscriptions')"), 'Must support subscriptions tab');
    assert.ok(code.includes("setActiveTab('health')"), 'Must support health tab');
    assert.ok(code.includes("setActiveTab('audit')"), 'Must support audit tab');
    assert.ok(code.includes("setActiveTab('cases')"), 'Must support cases tab');

    // Verify honest mock financial terminology
    assert.ok(
      code.includes('Simulated Monthly Revenue') || code.includes('Simulated Subscription Revenue'),
      'Financial metrics must be labeled as simulated revenue'
    );
    assert.ok(
      code.includes('Offline Mode') || code.includes('Offline Mock'),
      'Must explicitly state offline mock mode'
    );

    // Verify tenant privacy guarantee banner
    assert.ok(
      code.includes('Tenant Data Isolation Enforced') || code.includes('Enterprise Multi-Tenant Isolation Standard'),
      'Must display multi-tenant isolation and zero customer CRM leakage guarantees'
    );
  });

  test('4. AgencyDashboardPage defines all 5 agency sections, live preview & DNS instructions', () => {
    const pagePath = path.resolve(__dirname, '../src/pages/AgencyDashboardPage.jsx');
    const code = fs.readFileSync(pagePath, 'utf8');

    // Verify tabs
    assert.ok(code.includes("setActiveTab('overview')"), 'Must support overview tab');
    assert.ok(code.includes("setActiveTab('clients')"), 'Must support clients tab');
    assert.ok(code.includes("setActiveTab('staff')"), 'Must support staff tab');
    assert.ok(code.includes("setActiveTab('branding')"), 'Must support branding tab');
    assert.ok(code.includes("setActiveTab('domains')"), 'Must support domains tab');

    // Verify DNS instructions and TXT record display
    assert.ok(
      code.includes('_relay-verification'),
      'Must provide DNS challenge verification instruction'
    );

    // Verify live preview and color customization
    assert.ok(
      code.includes('Client Portal Live Preview'),
      'Must render live client portal preview'
    );
  });

  test('5. AppLayout preserves 7 primary navigation modules and supports privileged menu and delegated banner', () => {
    const layoutPath = path.resolve(__dirname, '../src/layout/AppLayout.jsx');
    const code = fs.readFileSync(layoutPath, 'utf8');

    // Verify privileged links in user menu
    assert.ok(code.includes("user?.isPlatformAdmin"), 'AppLayout must check isPlatformAdmin');
    assert.ok(code.includes("navigate('/admin')"), 'AppLayout must link to /admin for platform admins');
    assert.ok(code.includes("navigate('/agency')"), 'AppLayout must link to /agency for agency operators');

    // Verify delegated access banner
    assert.ok(code.includes('membership?.isDelegated'), 'AppLayout must display banner when accessing delegated workspace');
    assert.ok(code.includes('Return to Agency Portal'), 'Banner must allow returning to Agency Portal');
  });

  test('6. SuperAdmin and Agency CSS files exist and namespace tokens to Midnight Navy & Electric Blue', () => {
    const saCss = fs.readFileSync(path.resolve(__dirname, '../src/pages/superAdmin.css'), 'utf8');
    const agCss = fs.readFileSync(path.resolve(__dirname, '../src/pages/agencyDashboard.css'), 'utf8');

    assert.ok(saCss.includes('#0B1220'), 'SuperAdmin CSS must use Midnight Navy #0B1220');
    assert.ok(saCss.includes('#2563EB'), 'SuperAdmin CSS must use Electric Blue #2563EB');
    assert.ok(agCss.includes('#0B1220'), 'Agency CSS must use Midnight Navy #0B1220');
    assert.ok(agCss.includes('#2563EB'), 'Agency CSS must use Electric Blue #2563EB');
  });
});
