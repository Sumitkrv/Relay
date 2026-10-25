import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  normalizePath,
  resolveModulePath,
  isRouteActive,
  buildBreadcrumbs,
  personInitials,
  businessInitials,
  formatIndustry,
} from '../src/layout/shellRoutes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');

const NAV = ['/app', '/contacts', '/templates', '/campaigns', '/inbox', '/reports', '/settings'];
const activeFor = (pathname) => NAV.filter((to) => isRouteActive(to, pathname));

// --------------------------------------------------------------------------
// Active-route matching
// --------------------------------------------------------------------------

test('normalizePath folds /app aliases and trailing slashes', () => {
  assert.equal(normalizePath('/app'), '/');
  assert.equal(normalizePath('/app/'), '/');
  assert.equal(normalizePath('/app/overview'), '/');
  assert.equal(normalizePath('/app/contacts'), '/contacts');
  assert.equal(normalizePath('/contacts/'), '/contacts');
  assert.equal(normalizePath('/campaigns/abc?x=1#h'), '/campaigns/abc');
});

test('Exactly one primary item is active for each of the seven modules', () => {
  const cases = {
    '/app': '/app',
    '/app/overview': '/app',
    '/contacts': '/contacts',
    '/templates': '/templates',
    '/campaigns': '/campaigns',
    '/inbox': '/inbox',
    '/reports': '/reports',
    '/settings': '/settings',
  };
  for (const [pathname, expected] of Object.entries(cases)) {
    assert.deepEqual(activeFor(pathname), [expected], `${pathname} should activate only ${expected}`);
  }
});

test('The /app/* alias routes no longer light up Overview', () => {
  assert.deepEqual(activeFor('/app/contacts'), ['/contacts']);
  assert.deepEqual(activeFor('/app/templates'), ['/templates']);
  assert.deepEqual(activeFor('/app/campaigns'), ['/campaigns']);
  assert.deepEqual(activeFor('/app/inbox'), ['/inbox']);
  assert.deepEqual(activeFor('/app/reports'), ['/reports']);
  assert.deepEqual(activeFor('/app/settings'), ['/settings']);
});

test('Nested routes keep their parent module active', () => {
  assert.deepEqual(activeFor('/contacts/64b0c0ffee64b0c0ffee1234'), ['/contacts']);
  assert.deepEqual(activeFor('/campaigns/new'), ['/campaigns']);
  assert.deepEqual(activeFor('/campaigns/64b0c0ffee64b0c0ffee1234'), ['/campaigns']);
  assert.deepEqual(activeFor('/campaigns/64b0c0ffee64b0c0ffee1234/edit'), ['/campaigns']);
  assert.deepEqual(activeFor('/settings/billing'), ['/settings']);
  assert.deepEqual(activeFor('/import'), ['/contacts']);
  assert.deepEqual(activeFor('/activity'), ['/settings']);
});

test('Prefix look-alikes do not false-match', () => {
  assert.deepEqual(activeFor('/contactsx'), []);
  assert.deepEqual(activeFor('/reports-archive'), []);
  assert.equal(resolveModulePath('/settingsfoo'), '/settingsfoo');
});

// --------------------------------------------------------------------------
// Breadcrumbs
// --------------------------------------------------------------------------

const labels = (p) => buildBreadcrumbs(p).map((c) => c.label);

test('Breadcrumb for each module is "Workspace / <Module>" and never "Relay/App"', () => {
  assert.deepEqual(labels('/app'), ['Workspace', 'Overview']);
  assert.deepEqual(labels('/contacts'), ['Workspace', 'Contacts']);
  assert.deepEqual(labels('/templates'), ['Workspace', 'Templates']);
  assert.deepEqual(labels('/campaigns'), ['Workspace', 'Campaigns']);
  assert.deepEqual(labels('/inbox'), ['Workspace', 'Inbox & Auto-reply']);
  assert.deepEqual(labels('/reports'), ['Workspace', 'Reports']);
  assert.deepEqual(labels('/settings'), ['Workspace', 'Settings']);
  for (const p of ['/app', '/contacts', '/campaigns']) {
    assert.ok(!labels(p).includes('Relay'), 'root crumb must not be the product name');
    assert.ok(!labels(p).includes('App'));
  }
});

test('Alias /app/* routes produce the same breadcrumb as canonical routes', () => {
  assert.deepEqual(labels('/app/contacts'), labels('/contacts'));
  assert.deepEqual(labels('/app/overview'), ['Workspace', 'Overview']);
});

test('Nested breadcrumbs are meaningful and only the last crumb is current', () => {
  assert.deepEqual(labels('/campaigns/64b0c0ffee64b0c0ffee1234'), ['Workspace', 'Campaigns', 'Campaign Details']);
  assert.deepEqual(labels('/campaigns/new'), ['Workspace', 'Campaigns', 'New Campaign']);
  assert.deepEqual(labels('/campaigns/64b0c0ffee64b0c0ffee1234/edit'), [
    'Workspace',
    'Campaigns',
    'Campaign Details',
    'Edit',
  ]);
  assert.deepEqual(labels('/contacts/64b0c0ffee64b0c0ffee1234'), ['Workspace', 'Contacts', 'Contact Details']);
  assert.deepEqual(labels('/import'), ['Workspace', 'Contacts', 'Import Contacts']);

  const crumbs = buildBreadcrumbs('/campaigns/64b0c0ffee64b0c0ffee1234/edit');
  assert.deepEqual(crumbs.map((c) => c.current), [false, false, false, true]);
  assert.equal(crumbs[crumbs.length - 1].to, undefined, 'current crumb is not a link');
  assert.equal(crumbs[1].to, '/campaigns');
  assert.equal(crumbs[0].to, '/app');
});

// --------------------------------------------------------------------------
// Identity helpers (business vs person)
// --------------------------------------------------------------------------

test('Person and business initials differ so avatars never read as the workspace logo', () => {
  assert.equal(personInitials('M2W Realty Owner'), 'MO');
  assert.equal(personInitials('FitZone Gym Owner'), 'FO');
  assert.equal(personInitials('CarePlus Clinic Owner'), 'CO');
  assert.equal(personInitials('Priya'), 'PR');
  assert.equal(personInitials(''), 'U');
  assert.equal(businessInitials('CarePlus Clinic'), 'CC');
  assert.equal(businessInitials('FitZone Gym'), 'FG');
  assert.equal(businessInitials('M2W Realty'), 'MR');
});

test('Industry labels are formatted from workspace data', () => {
  assert.equal(formatIndustry('real_estate'), 'Real Estate');
  assert.equal(formatIndustry('gym'), 'Gym');
  assert.equal(formatIndustry('clinic'), 'Clinic');
  assert.equal(formatIndustry(''), '');
});

// --------------------------------------------------------------------------
// Structural guarantees on the shared shell (source-level, since tests run in node)
// --------------------------------------------------------------------------

test('Shell has ONE implementation and no hardcoded business branding in the brand header', () => {
  const layout = read('../src/layout/AppLayout.jsx');
  // Brand header uses the Relay mark + "relay." wordmark only
  assert.ok(layout.includes('RelayMark'));
  assert.ok(/relay<span className="rs-brand-dot">\.<\/span>/.test(layout));
  const headStart = layout.indexOf('rs-sb-head');
  const workspaceStart = layout.indexOf('2. Workspace (business) identity');
  const headBlock = layout.slice(headStart, workspaceStart);
  assert.ok(!headBlock.includes('workspaceName'), 'brand header must not render the business name');
  assert.ok(!headBlock.includes('rawLogo'), 'brand header must not render the business logo');
  // Single shell implementation
  const files = fs.readdirSync(path.resolve(__dirname, '../src/layout'));
  assert.deepEqual(files.filter((f) => /sidebar|topbar/i.test(f)), [], 'no parallel Sidebar/Topbar files');
});

test('Role is never fabricated and the user avatar never uses the business logo', () => {
  const layout = read('../src/layout/AppLayout.jsx');
  assert.ok(!/membership\?\.role\s*\|\|\s*['"]OWNER['"]/.test(layout), "must not default role to 'OWNER'");
  assert.ok(layout.includes('membership?.role'));
  // person avatar renders initials of the user, not <img> of the workspace
  const avatarBlock = layout.slice(layout.indexOf('Account menu (person'));
  assert.ok(avatarBlock.includes('userInitials'));
  assert.ok(!avatarBlock.slice(0, avatarBlock.indexOf('rs-popover')).includes('<img'));
});

test('Collapse control lives in the sidebar header, not as a footer menu row', () => {
  const layout = read('../src/layout/AppLayout.jsx');
  const head = layout.slice(layout.indexOf('rs-sb-head'), layout.indexOf('2. Workspace (business) identity'));
  assert.ok(head.includes('toggleCollapse'));
  assert.ok(head.includes('PanelLeftClose'));
  assert.ok(!layout.includes('collapse-toggle-btn'));
});

test('Mobile drawer: scroll lock, Escape, focus trap and dialog semantics are implemented', () => {
  const layout = read('../src/layout/AppLayout.jsx');
  assert.ok(layout.includes("document.body.style.overflow = 'hidden'"));
  assert.ok(layout.includes("e.key === 'Escape'"));
  assert.ok(layout.includes("e.key !== 'Tab'"));
  assert.ok(layout.includes("'aria-modal': 'true'"));
  assert.ok(layout.includes('closeBtnRef.current?.focus()'));
  assert.ok(layout.includes('menuBtnRef.current?.focus'));
  assert.ok(layout.includes('rs-scrim'));
  // rail is desktop-only so the drawer is never a half-collapsed rail
  assert.ok(layout.includes('const rail = collapsed && isDesktop'));
});

test('Topbar: dynamic breadcrumb, compact status, Mock Mode badge, notifications, account menu', () => {
  const layout = read('../src/layout/AppLayout.jsx');
  assert.ok(layout.includes('<Breadcrumbs />'));
  assert.ok(layout.includes('System operational'));
  assert.ok(layout.includes('System unavailable'));
  assert.ok(layout.includes('Checking status'));
  assert.ok(layout.includes('Mock Mode'));
  assert.ok(layout.includes("api.get('/health')"));
  assert.ok(layout.includes('markAllNotificationsRead'));
  assert.ok(layout.includes('role="menu"') && layout.includes('role="menuitem"'));
  assert.ok(layout.includes('Sign out'));
  assert.ok(!layout.includes('Relay/App'));
});

test('A failed health check can never be rendered as Online', () => {
  const layout = read('../src/layout/AppLayout.jsx');
  const catchBlock = layout.slice(layout.indexOf('} catch {', layout.indexOf("api.get('/health')")));
  assert.ok(catchBlock.slice(0, 300).includes("backend: 'disconnected'"));
});

test('Shell stylesheet: locked palette, namespaced selectors, no green brand, no important abuse', () => {
  const css = read('../src/layout/appShell.css');
  for (const token of ['#0B1220', '#111C30', '#172338', '#26354C', '#2563EB', '#1D4ED8', '#172554', '#60A5FA', '#DBEAFE', '#E2E8F0', '#94A3B8', '#F4F7FC', '#0F172A', '#64748B']) {
    assert.ok(css.toUpperCase().includes(token), `shell tokens must include ${token}`);
  }
  // every rule selector in the shell file is namespaced
  const selectors = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(^|[{}])\s*([^{}@;][^{}]*)\{/g)]
    .map((m) => m[2].trim())
    .filter((s) => !/^(from|to|\d+%)/.test(s) && !s.startsWith('@'));
  for (const sel of selectors) {
    for (const part of sel.split(',').map((x) => x.trim())) {
      assert.ok(/^\.rs-/.test(part), `shell selector must be .rs-scoped: "${part}"`);
    }
  }
  // green only allowed for operational status
  const greenLines = css.split('\n').filter((l) => /#16A34A|rgba\(22, 163, 74/i.test(l));
  for (const l of greenLines) {
    assert.ok(/success|rs-dot--ok|rgba\(22/.test(l), `green used outside status: ${l.trim()}`);
  }
  assert.ok(!/#0D9488|#14B8A6|#2DD4BF|#0F766E/i.test(css), 'no teal in the shell');
  assert.equal((css.match(/!important/g) || []).length, 0, 'shell CSS must not use !important');
  assert.ok(/252px/.test(css) && /72px/.test(css), 'sidebar widths 252/72 are defined');
  assert.ok(/--rs-top-h: var\(--topbar-height, 68px\)/.test(css));
});

test('Legacy shell selectors are gone from styles.css (no conflicting teal/green overrides)', () => {
  const css = read('../src/styles.css');
  for (const legacy of ['.sidebar {', '.main-area {', '.topbar {', '.nav-item {', '.status-pill {', '.profile-row {', '.workspace-switch {', '.avatar-popover']) {
    assert.ok(!css.includes(legacy), `legacy selector still present: ${legacy}`);
  }
  // shared classes used by other pages are preserved
  for (const kept of ['.icon-btn {', '.text-danger {', '.brand-logo-img-lg {', '.status-pill-strip {', '.page-content {']) {
    assert.ok(css.includes(kept), `shared selector must remain: ${kept}`);
  }
});
