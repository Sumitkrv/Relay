// Real-browser verification of the Relay shared shell (Sidebar + Topbar).
// Usage: node verify.mjs   (frontend on :5173, backend on :5000)
// Reads demo passwords from ../.demo-passwords.json; never prints them.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
const passwords = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.demo-passwords.json'), 'utf8'));
const BASE = 'http://localhost:5173';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const BUSINESSES = [
  { key: 'm2w', email: 'owner.m2w@relay-demo.test', name: 'M2W Realty', industry: 'Real Estate', others: ['FitZone', 'CarePlus'] },
  { key: 'gym', email: 'owner.gym@relay-demo.test', name: 'FitZone Gym', industry: 'Gym', others: ['M2W', 'CarePlus'] },
  { key: 'clinic', email: 'owner.clinic@relay-demo.test', name: 'CarePlus Clinic', industry: 'Clinic', others: ['M2W', 'FitZone'] },
];

const results = [];
const record = (area, name, pass, detail = '') => {
  results.push({ area, name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  [${area}] ${name}${detail ? '  -> ' + detail : ''}`);
};

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 1920, height: 963 },
});

async function login(biz) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  const consoleIssues = [];
  let loggedIn = false; // pre-login /auth/me 401 is expected and not an app error
  page.on('console', (m) => {
    if (loggedIn && ['error', 'warning'].includes(m.type())) consoleIssues.push(`${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => consoleIssues.push(`pageerror: ${e.message}`));
  await page.setViewport({ width: 1920, height: 963 });
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
  await page.type('input[name=email]', biz.email);
  await page.type('input[name=password]', passwords[biz.email]);
  await Promise.all([page.waitForSelector('.rs-sidebar', { timeout: 20000 }), page.click('button.auth-submit')]);
  await page.waitForSelector('.rs-topbar');
  loggedIn = true;
  // wait until transient login toasts are gone and nothing covers the avatar button
  await sleep(1200);
  await page.waitForFunction(() => {
    if (document.querySelector('[role="status"]')) return false;
    const b = document.querySelector('.rs-avatar--btn');
    if (!b) return false;
    const r = b.getBoundingClientRect();
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!el && b.contains(el);
  }, { timeout: 15000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 500));
  return { ctx, page, consoleIssues };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const facts = (page) =>
  page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const txt = (s) => (q(s)?.innerText || '').replace(/\s+/g, ' ').trim();
    const active = [...document.querySelectorAll('.rs-nav-item.is-active')].map((a) => a.innerText.trim());
    const sb = q('.rs-sidebar')?.getBoundingClientRect();
    const foot = q('.rs-sb-foot')?.getBoundingClientRect();
    const cs = (el, p) => (el ? getComputedStyle(el)[p] : null);
    return {
      url: location.pathname,
      head: txt('.rs-sb-head'),
      workspace: txt('.rs-workspace'),
      wsImg: !!q('.rs-workspace img'),
      groups: [...document.querySelectorAll('.rs-nav-heading')].map((e) => e.innerText),
      items: [...document.querySelectorAll('.rs-nav-item')].map((e) => e.getAttribute('aria-label') || e.innerText.trim()),
      active,
      ariaCurrent: [...document.querySelectorAll('.rs-nav-item[aria-current=page]')].length,
      activeBg: cs(q('.rs-nav-item.is-active'), 'backgroundColor'),
      activeColor: cs(q('.rs-nav-item.is-active'), 'color'),
      crumbs: txt('.rs-crumbs'),
      crumbsVisible: [...document.querySelectorAll('.rs-crumb')].filter((e) => getComputedStyle(e).display !== 'none').map((e) => e.innerText.trim()),
      chip: txt('.rs-chip'),
      chipVisibleText: q('.rs-chip-text') ? getComputedStyle(q('.rs-chip-text')).position : null,
      mock: txt('.rs-mode'),
      mockVisible: q('.rs-mode') ? getComputedStyle(q('.rs-mode')).display !== 'none' : false,
      account: txt('.rs-account'),
      sbW: sb ? Math.round(sb.width) : null,
      sbLeft: sb ? Math.round(sb.left) : null,
      sbVisible: sb ? sb.right > 0 && sb.left >= 0 && getComputedStyle(q('.rs-sidebar')).visibility !== 'hidden' : false,
      topH: Math.round(q('.rs-topbar').getBoundingClientRect().height),
      topBg: cs(q('.rs-topbar'), 'backgroundColor'),
      hamburger: q('.rs-menu-btn') ? getComputedStyle(q('.rs-menu-btn')).display : 'none',
      collapseBtn: !!q('.rs-sb-head button[aria-label$="sidebar"]'),
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      footBottom: foot ? Math.round(foot.bottom) : null,
      innerH: innerHeight,
      navScrolls: q('.rs-nav') ? q('.rs-nav').scrollHeight > q('.rs-nav').clientHeight : false,
      bodyOverflow: document.body.style.overflow,
      focusLabel: document.activeElement?.getAttribute('aria-label') || document.activeElement?.tagName,
      bodyBg: cs(document.body, 'backgroundColor'),
      shellBg: cs(q('.rs-shell'), 'backgroundColor'),
      mainLeft: Math.round(q('.rs-main').getBoundingClientRect().left),
    };
  });

const shot = (page, name) => page.screenshot({ path: path.join(OUT, `${name}.png`) });

// ---------------------------------------------------------------------------
// 1. Three-business identity audit
// ---------------------------------------------------------------------------
for (const biz of BUSINESSES) {
  const { ctx, page, consoleIssues } = await login(biz);
  const f = await facts(page);
  await shot(page, `${biz.key}_desktop`);

  record(biz.key, 'brand header shows Relay only (no business name)', /relay\./i.test(f.head) && !f.head.includes(biz.name.split(' ')[0]), f.head);
  record(biz.key, 'workspace card = business name + industry', f.workspace.includes(biz.name) && f.workspace.includes(biz.industry), f.workspace);
  record(biz.key, 'no other business identity leaked in shell', biz.others.every((o) => !(f.head + f.workspace + f.account + f.crumbs).includes(o)), '');
  record(biz.key, 'account footer shows person, not business-only identity', f.account.includes('Owner') && f.account.includes(biz.email), f.account);
  record(biz.key, 'nav groups', JSON.stringify(f.groups) === JSON.stringify(['WORKSPACE', 'INSIGHTS & MANAGEMENT']) || JSON.stringify(f.groups.map((g) => g.toUpperCase())) === JSON.stringify(['WORKSPACE', 'INSIGHTS & MANAGEMENT']), f.groups.join(' | '));
  record(biz.key, 'seven nav items in order', JSON.stringify(f.items) === JSON.stringify(['Overview', 'Contacts', 'Templates', 'Campaigns', 'Inbox & Auto-reply', 'Reports', 'Settings']), f.items.join(', '));
  record(biz.key, 'only Overview active at /app', JSON.stringify(f.active) === '["Overview"]' && f.ariaCurrent === 1, `${f.active} bg=${f.activeBg} color=${f.activeColor}`);
  record(biz.key, 'sidebar 252px, topbar 68px white', f.sbW === 252 && f.topH === 68 && f.topBg === 'rgb(255, 255, 255)', `sb=${f.sbW} top=${f.topH} bg=${f.topBg}`);
  record(biz.key, 'breadcrumb "Workspace > Overview"', f.crumbs === 'Workspace Overview', f.crumbs);
  record(biz.key, 'status chip + Mock Mode badge', /System (operational|degraded|unavailable)/.test(f.chip) && f.mock === 'Mock Mode', `${f.chip} | ${f.mock}`);
  record(biz.key, 'footer fully inside viewport', f.footBottom <= f.innerH, `${f.footBottom}/${f.innerH}`);
  record(biz.key, 'no horizontal overflow', f.overflowX <= 0, String(f.overflowX));

  // Account menu: role comes from backend membership
  await page.click('.rs-avatar--btn');
  await sleep(250);
  const menu = await page.evaluate(() => (document.querySelector('.rs-popover--menu')?.innerText || '').replace(/\s+/g, ' ').trim());
  await shot(page, `${biz.key}_account_menu`);
  record(biz.key, 'account menu: name, email, backend role, Sign out', menu.includes('Owner') && menu.includes(biz.email) && /OWNER/i.test(menu) && menu.includes('Sign out'), menu);
  await page.keyboard.press('Escape');
  await sleep(150);
  record(biz.key, 'Escape closes account menu', (await page.$('.rs-popover--menu')) === null);

  // Brand identity uses a logo or blue initials fallback
  const fallback = await page.evaluate(() => {
    const el = document.querySelector('.rs-workspace .rs-ws-initials');
    return el ? { text: el.innerText, bg: getComputedStyle(el).backgroundColor } : null;
  });
  record(biz.key, 'workspace logo or blue-initials fallback', f.wsImg || (fallback && fallback.bg === 'rgb(30, 58, 138)'), f.wsImg ? 'logo image' : JSON.stringify(fallback));

  // Long-text truncation (simulated, DOM only)
  const trunc = await page.evaluate(() => {
    const longName = 'Extraordinarily Long Business Name For Real Estate And Property Management Services Pvt Ltd';
    const strong = document.querySelector('.rs-ws-text strong');
    strong.textContent = longName;
    document.querySelector('.rs-account-copy strong').textContent = 'A Very Long Personal Display Name That Should Truncate Nicely';
    document.querySelector('.rs-account-copy span').textContent = 'extremely.long.email.address.for.testing.truncation@subdomain.example-company.com';
    const sb = document.querySelector('.rs-sidebar');
    return {
      sidebarScroll: sb.scrollWidth - sb.clientWidth,
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ellipsis: getComputedStyle(strong).textOverflow,
      signOutVisible: document.querySelector('.rs-sb-foot button[aria-label="Sign out"]').getBoundingClientRect().right <= sb.getBoundingClientRect().right,
    };
  });
  record(biz.key, 'long business/user/email truncate without overflow; Sign out stays visible', trunc.sidebarScroll <= 0 && trunc.pageOverflow <= 0 && trunc.ellipsis === 'ellipsis' && trunc.signOutVisible, JSON.stringify(trunc));

  record(biz.key, 'no console errors/warnings', consoleIssues.filter((m) => !/DevTools|HMR|\[vite\]/i.test(m)).length === 0, consoleIssues.slice(0, 3).join(' || '));
  await ctx.close();
}

// ---------------------------------------------------------------------------
// 2. Routing regression + active state (M2W)
// ---------------------------------------------------------------------------
{
  const { ctx, page, consoleIssues } = await login(BUSINESSES[0]);
  const modules = [
    ['Overview', '/app', 'Workspace Overview'],
    ['Contacts', '/contacts', 'Workspace Contacts'],
    ['Templates', '/templates', 'Workspace Templates'],
    ['Campaigns', '/campaigns', 'Workspace Campaigns'],
    ['Inbox & Auto-reply', '/inbox', 'Workspace Inbox & Auto-reply'],
    ['Reports', '/reports', 'Workspace Reports'],
    ['Settings', '/settings', 'Workspace Settings'],
  ];
  const crashed = () => page.evaluate(() => /something went wrong|unexpected error/i.test(document.body.innerText));
  for (const [label, url, crumb] of modules) {
    await page.evaluate((l) => [...document.querySelectorAll('.rs-nav-item')].find((a) => a.innerText.trim() === l).click(), label);
    await sleep(900);
    const f = await facts(page);
    record('route', `${label}: url, single active item, breadcrumb`, f.url === url && JSON.stringify(f.active) === JSON.stringify([label]) && f.crumbs === crumb && !(await crashed()), `${f.url} active=${f.active} crumb="${f.crumbs}"`);
    if (label === 'Reports' || label === 'Contacts') await shot(page, `m2w_${label.toLowerCase()}`);
  }
  // Back / Forward
  await page.goBack(); await sleep(600);
  let f = await facts(page);
  record('route', 'Back -> Reports active', f.url === '/reports' && f.active[0] === 'Reports', `${f.url} ${f.active}`);
  await page.goBack(); await sleep(600);
  f = await facts(page);
  record('route', 'Back -> Inbox active', f.url === '/inbox' && f.active[0] === 'Inbox & Auto-reply', `${f.url} ${f.active}`);
  await page.goForward(); await sleep(600);
  f = await facts(page);
  record('route', 'Forward -> Reports active', f.url === '/reports' && f.active[0] === 'Reports', `${f.url} ${f.active}`);

  // Direct URL load + refresh + alias + nested
  const direct = [
    ['/templates', 'Templates', 'Workspace Templates'],
    ['/app/contacts', 'Contacts', 'Workspace Contacts'],
    ['/campaigns/new', 'Campaigns', 'Workspace Campaigns New Campaign'],
    ['/import', 'Contacts', 'Workspace Contacts Import Contacts'],
    ['/activity', 'Settings', 'Workspace Settings Activity Logs'],
  ];
  for (const [url, activeLabel, crumb] of direct) {
    await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('.rs-sidebar');
    await sleep(500);
    f = await facts(page);
    record('route', `direct load ${url}`, f.active.length === 1 && f.active[0] === activeLabel && f.crumbs === crumb, `active=${f.active} crumb="${f.crumbs}"`);
  }
  await page.reload({ waitUntil: 'networkidle2' });
  await page.waitForSelector('.rs-sidebar');
  f = await facts(page);
  record('route', 'refresh keeps session + active state', f.url === '/activity' && f.active[0] === 'Settings', `${f.url} ${f.active}`);

  // Nested real record routes using a real campaign id (read-only GET with the session's own headers)
  const campaignId = await page.evaluate(async () => {
    const h = { Authorization: `Bearer ${localStorage.getItem('relay_auth_token')}` };
    const ws = localStorage.getItem('relay_active_workspace_id');
    if (ws) h['x-workspace-id'] = ws;
    const res = await fetch('http://localhost:5000/api/campaigns', { headers: h, credentials: 'include' });
    const body = await res.json();
    const list = Array.isArray(body) ? body : body.records || body.campaigns || body.data || [];
    return list[0]?._id || null;
  });
  record('route', 'real campaign id available for nested-route test', !!campaignId, String(campaignId));
  if (campaignId) {
    await page.goto(`${BASE}/campaigns/${campaignId}`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('.rs-sidebar'); await sleep(800);
    f = await facts(page);
    record('route', 'campaign details: Campaigns active + "Workspace / Campaigns / Campaign Details"', f.active[0] === 'Campaigns' && f.active.length === 1 && f.crumbs === 'Workspace Campaigns Campaign Details' && !(await crashed()), `active=${f.active} crumb="${f.crumbs}"`);
    await shot(page, 'm2w_campaign_details');
    await page.goto(`${BASE}/campaigns/${campaignId}/edit`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('.rs-sidebar'); await sleep(800);
    f = await facts(page);
    record('route', 'campaign edit: Campaigns active + 4-level breadcrumb', f.active[0] === 'Campaigns' && f.crumbs === 'Workspace Campaigns Campaign Details Edit', `active=${f.active} crumb="${f.crumbs}"`);
  }

  record('route', 'no console errors across navigation', consoleIssues.filter((m) => !/DevTools|HMR|\[vite\]/i.test(m)).length === 0, consoleIssues.slice(0, 4).join(' || '));
  await ctx.close();
}

// ---------------------------------------------------------------------------
// 3. Responsive matrix, collapsed rail, drawer, short height, zoom (M2W)
// ---------------------------------------------------------------------------
{
  const { ctx, page } = await login(BUSINESSES[0]);
  const sizes = [[1920, 963], [1600, 900], [1440, 900], [1280, 800], [1024, 768], [768, 1024], [390, 844], [375, 812], [320, 640]];
  for (const collapsed of [false, true]) {
    await page.evaluate((c) => localStorage.setItem('relay_sidebar_collapsed_v10', String(c)), collapsed);
    for (const [w, h] of sizes) {
      await page.setViewport({ width: w, height: h });
      await page.goto(`${BASE}/app`, { waitUntil: 'networkidle2' });
      await page.waitForSelector('.rs-sidebar');
      await sleep(450);
      const f = await facts(page);
      const desktop = w >= 769;
      const expectW = desktop ? (collapsed ? 72 : 252) : null;
      const okLayout = desktop
        ? f.sbW === expectW && f.mainLeft === expectW && f.hamburger === 'none' && f.collapseBtn
        : !f.sbVisible && f.hamburger !== 'none' && !f.collapseBtn && f.mainLeft === 0;
      record('responsive', `${w}px ${collapsed ? 'collapsed' : 'expanded'}: layout`, okLayout && f.overflowX <= 0 && f.topH === 68 || (!desktop && f.overflowX <= 0 && okLayout), `sb=${f.sbW}@${f.sbLeft} vis=${f.sbVisible} main@${f.mainLeft} burger=${f.hamburger} toggle=${f.collapseBtn} overflowX=${f.overflowX} top=${f.topH}`);
      if (!collapsed && [1024, 768, 390, 320].includes(w)) await shot(page, `m2w_w${w}`);
      if (collapsed && w === 1280) await shot(page, 'm2w_collapsed_1280');
      if (desktop && collapsed) {
        const rail = await page.evaluate(() => ({
          labelsHidden: !document.querySelector('.rs-nav-label') && !document.querySelector('.rs-ws-text') && !document.querySelector('.rs-brand-word'),
          itemsCentered: [...document.querySelectorAll('.rs-nav-item')].every((a) => { const r = a.getBoundingClientRect(); return Math.abs(r.left + r.width / 2 - 36) <= 1; }),
          activeBar: !!document.querySelector('.rs-nav-item.is-active'),
          signOut: !!document.querySelector('.rs-sb-foot button[aria-label="Sign out"]'),
          avatar: !!document.querySelector('.rs-account .rs-avatar'),
          ariaLabels: [...document.querySelectorAll('.rs-nav-item')].every((a) => a.getAttribute('aria-label')),
        }));
        record('responsive', `${w}px rail: no labels, centered icons, aria-labels, signout+avatar kept`, Object.values(rail).every(Boolean), JSON.stringify(rail));
      }
    }
  }

  // Short-height + zoom emulation
  await page.evaluate(() => localStorage.setItem('relay_sidebar_collapsed_v10', 'false'));
  for (const [w, h, label] of [[1280, 520, 'short 520h'], [1366, 560, 'short 560h'], [1536, 770, 'zoom125 (1920x963/1.25)'], [2133, 1070, 'zoom90 (1920x963/0.9)']]) {
    await page.setViewport({ width: w, height: h });
    await page.goto(`${BASE}/app`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('.rs-sidebar');
    await sleep(400);
    const f = await facts(page);
    const signOut = await page.evaluate(() => { const r = document.querySelector('.rs-sb-foot button[aria-label="Sign out"]').getBoundingClientRect(); return r.bottom <= innerHeight && r.top >= 0; });
    record('responsive', `${label}: footer + Sign out reachable`, f.footBottom <= f.innerH && signOut && f.overflowX <= 0, `foot=${f.footBottom}/${f.innerH} navScrolls=${f.navScrolls} signOutVisible=${signOut}`);
    if (h === 520) await shot(page, 'm2w_short_520');
  }

  // Collapse control behavior (persist, aria, keyboard, tooltip)
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(`${BASE}/app`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('.rs-sidebar');
  await page.focus('.rs-sb-head button[aria-label="Collapse sidebar"]');
  await page.keyboard.press('Enter');
  await sleep(500);
  let f = await facts(page);
  const stored = await page.evaluate(() => localStorage.getItem('relay_sidebar_collapsed_v10'));
  record('collapse', 'keyboard Enter on header toggle collapses (aria-expanded=false, persisted)', f.sbW === 72 && stored === 'true' && (await page.$('.rs-sb-head button[aria-expanded="false"]')) !== null, `w=${f.sbW} stored=${stored}`);
  await page.hover('.rs-nav-item[aria-label="Campaigns"]');
  await sleep(250);
  const tip = await page.evaluate(() => document.querySelector('.rs-tooltip')?.innerText || null);
  record('collapse', 'rail tooltip appears on hover', tip === 'Campaigns', String(tip));
  await shot(page, 'm2w_rail_tooltip');
  await page.reload({ waitUntil: 'networkidle2' });
  await page.waitForSelector('.rs-sidebar');
  f = await facts(page);
  record('collapse', 'collapsed state survives reload', f.sbW === 72, String(f.sbW));
  await page.click('.rs-sb-head button[aria-label="Expand sidebar"]');
  await sleep(500);
  f = await facts(page);
  record('collapse', 'expand restores 252px', f.sbW === 252, String(f.sbW));
  // navigation while collapsed keeps working
  await page.click('.rs-sb-head button[aria-label="Collapse sidebar"]');
  await sleep(300);
  await page.evaluate(() => document.querySelector('.rs-nav-item[aria-label="Templates"]').click());
  await sleep(700);
  f = await facts(page);
  record('collapse', 'navigate while collapsed (Templates active, still rail)', f.url === '/templates' && f.active.length === 1 && f.sbW === 72, `${f.url} ${f.active} w=${f.sbW}`);
  await page.evaluate(() => localStorage.setItem('relay_sidebar_collapsed_v10', 'false'));

  // Mobile drawer
  await page.setViewport({ width: 390, height: 700 });
  await page.goto(`${BASE}/app`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('.rs-sidebar');
  await sleep(300);
  let closedFocusable = await page.evaluate(() => { const el = document.querySelector('.rs-sidebar'); return getComputedStyle(el).visibility; });
  record('drawer', 'closed drawer is hidden from focus/AT (visibility:hidden)', closedFocusable === 'hidden', closedFocusable);
  await page.click('.rs-menu-btn');
  await sleep(600);
  f = await facts(page);
  const drawer = await page.evaluate(() => {
    const sb = document.querySelector('.rs-sidebar');
    return {
      open: sb.classList.contains('is-open'),
      role: sb.getAttribute('role'),
      modal: sb.getAttribute('aria-modal'),
      brand: sb.querySelector('.rs-brand-word')?.innerText,
      workspace: sb.querySelector('.rs-workspace')?.innerText.replace(/\s+/g, ' '),
      links: sb.querySelectorAll('.rs-nav-item').length,
      signOut: !!sb.querySelector('button[aria-label="Sign out"]'),
      collapseHidden: !sb.querySelector('button[aria-label$="sidebar"]'),
      scrim: !!document.querySelector('.rs-scrim'),
    };
  });
  await shot(page, 'm2w_drawer_390');
  record('drawer', 'opens: dialog semantics, Relay brand, workspace, 7 links, sign out, no collapse btn', drawer.open && drawer.role === 'dialog' && drawer.modal === 'true' && drawer.links === 7 && drawer.signOut && drawer.collapseHidden && drawer.scrim && /relay/.test(drawer.brand), JSON.stringify(drawer));
  record('drawer', 'body scroll locked + focus moved into drawer + footer visible', f.bodyOverflow === 'hidden' && f.focusLabel === 'Close navigation menu' && f.footBottom <= f.innerH, `overflow=${f.bodyOverflow} focus=${f.focusLabel} foot=${f.footBottom}/${f.innerH}`);
  // Tab trap: tab through more than the number of focusables and ensure focus never leaves drawer
  let leaked = false;
  for (let i = 0; i < 16; i++) {
    await page.keyboard.press('Tab');
    const inside = await page.evaluate(() => document.querySelector('.rs-sidebar').contains(document.activeElement));
    if (!inside) leaked = true;
  }
  record('drawer', 'Tab focus is trapped inside the open drawer (16 Tabs)', !leaked);
  await page.keyboard.press('Escape');
  await sleep(500);
  f = await facts(page);
  record('drawer', 'Escape closes drawer, restores scroll, returns focus to hamburger', !f.sbVisible && f.bodyOverflow !== 'hidden' && f.focusLabel === 'Open navigation menu', `vis=${f.sbVisible} overflow="${f.bodyOverflow}" focus=${f.focusLabel}`);
  await page.click('.rs-menu-btn'); await sleep(500);
  await page.mouse.click(370, 400); // backdrop (right of 288px drawer)
  await sleep(500);
  f = await facts(page);
  record('drawer', 'backdrop click closes drawer', !f.sbVisible, `vis=${f.sbVisible}`);
  await page.click('.rs-menu-btn'); await sleep(500);
  await page.evaluate(() => [...document.querySelectorAll('.rs-sidebar .rs-nav-item')].find((a) => a.innerText.trim() === 'Contacts').click());
  await sleep(900);
  f = await facts(page);
  record('drawer', 'selecting a link navigates and closes drawer; mobile breadcrumb shows only current page', f.url === '/contacts' && !f.sbVisible && JSON.stringify(f.crumbsVisible) === '["Contacts"]', `${f.url} vis=${f.sbVisible} crumbs=${JSON.stringify(f.crumbsVisible)}`);
  // resize from mobile (open) to desktop must not leave stale drawer/scroll lock
  await page.click('.rs-menu-btn'); await sleep(400);
  await page.setViewport({ width: 1280, height: 800 });
  await sleep(600);
  f = await facts(page);
  record('drawer', 'resize to desktop with drawer open: no stale scroll lock, sidebar docked', f.bodyOverflow !== 'hidden' && f.sbW === 252 && !(await page.$('.rs-scrim')), `overflow="${f.bodyOverflow}" sb=${f.sbW}`);

  // 320px popover containment
  await page.setViewport({ width: 320, height: 640 });
  await page.goto(`${BASE}/app`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('.rs-sidebar');
  await sleep(300);
  for (const [sel, name] of [['.rs-chip', 'status'], ['.rs-top-actions .rs-pop-wrap:nth-of-type(2) button, .rs-top-actions button[aria-label^="Notifications"]', 'notifications'], ['.rs-avatar--btn', 'account']]) {
    await page.click(sel);
    await sleep(250);
    const box = await page.evaluate(() => { const p = document.querySelector('.rs-popover'); if (!p) return null; const r = p.getBoundingClientRect(); return { left: Math.round(r.left), right: Math.round(r.right), vw: innerWidth }; });
    record('responsive', `320px ${name} popover stays inside viewport`, !!box && box.left >= 0 && box.right <= box.vw, JSON.stringify(box));
    if (name === 'status') await shot(page, 'm2w_320_status_popover');
    await page.keyboard.press('Escape');
    await sleep(150);
  }
  await ctx.close();
}

// ---------------------------------------------------------------------------
// 4. Logout + protected route after logout
// ---------------------------------------------------------------------------
{
  const { ctx, page } = await login(BUSINESSES[2]);
  await page.click('.rs-sb-foot button[aria-label="Sign out"]');
  await sleep(1200);
  const url = new URL(page.url()).pathname;
  record('logout', 'sidebar Sign out returns to /login', url === '/login', url);
  await page.goto(`${BASE}/campaigns`, { waitUntil: 'networkidle2' });
  await sleep(800);
  record('logout', 'protected route redirects to /login after logout', new URL(page.url()).pathname === '/login', new URL(page.url()).pathname);
  await ctx.close();
}
{
  const { ctx, page } = await login(BUSINESSES[1]);
  await page.click('.rs-avatar--btn');
  await sleep(200);
  await page.evaluate(() => [...document.querySelectorAll('.rs-menu-item')].find((b) => /sign out/i.test(b.innerText)).click());
  await sleep(1200);
  record('logout', 'account-menu Sign out returns to /login', new URL(page.url()).pathname === '/login', new URL(page.url()).pathname);
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.pass);
console.log(`\nSUMMARY: ${results.length - failed.length}/${results.length} passed`);
fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
if (failed.length) {
  console.log('FAILED:');
  failed.forEach((r) => console.log(` - [${r.area}] ${r.name} :: ${r.detail}`));
}
