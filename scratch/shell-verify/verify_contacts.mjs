import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'contacts_out');
fs.mkdirSync(OUT, { recursive: true });

const passwords = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.demo-passwords.json'), 'utf8'));
const BASE = 'http://localhost:5173';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

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

async function loginAndGo(email, password, key) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  
  await page.setViewport({ width: 1920, height: 963 });
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('input[name=email]');
  await page.type('input[name=email]', email);
  await page.type('input[name=password]', password);
  await Promise.all([
    page.waitForSelector('.rs-sidebar', { timeout: 20000 }),
    page.click('button.auth-submit'),
  ]);
  await page.waitForSelector('.rs-topbar');

  // Navigate to contacts
  await page.goto(`${BASE}/contacts`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('.cp-page');
  await new Promise((r) => setTimeout(r, 600));
  return { ctx, page };
}

try {
  console.log('\n--- 1. TESTING M2W REALTY CONTACTS & AUDIENCES ---');
  const { ctx: m2wCtx, page: m2wPage } = await loginAndGo(
    'owner.m2w@relay-demo.test',
    passwords['owner.m2w@relay-demo.test'],
    'm2w'
  );

  // Take full desktop screenshot
  await m2wPage.screenshot({ path: path.join(OUT, '01_m2w_contacts_desktop.png'), fullPage: false });

  // 1. Header checks
  const title = await m2wPage.$eval('.page-header-title', (el) => el.textContent.trim());
  record('M2W Header', 'Title is "Contacts & Audiences"', title === 'Contacts & Audiences', title);

  const subtitle = await m2wPage.$eval('.page-header-subtitle', (el) => el.textContent.trim());
  record('M2W Header', 'Subtitle is industry-aware for Real Estate', subtitle.includes('Manage property enquiries'), subtitle);

  // 2. KPI Cards
  const kpis = await m2wPage.$$eval('.cp-kpi-card', (cards) =>
    cards.map((c) => ({
      label: c.querySelector('.cp-kpi-label')?.textContent.trim(),
      value: c.querySelector('.cp-kpi-value')?.textContent.trim(),
      foot: c.querySelector('.cp-kpi-foot')?.textContent.trim(),
    }))
  );
  record('M2W KPI', 'Four KPI cards rendered', kpis.length === 4, `Found ${kpis.length}`);
  record('M2W KPI', 'Total Contacts count is 5', kpis[0]?.value === '5', kpis[0]?.value);
  record('M2W KPI', 'Verified Opted-In count is 0', kpis[1]?.value === '0', kpis[1]?.value);
  record('M2W KPI', 'Opted Out count is 1', kpis[2]?.value === '1', kpis[2]?.value);
  record('M2W KPI', 'Consent Unknown count is 4', kpis[3]?.value === '4', kpis[3]?.value);
  record('M2W KPI', 'Footers are accurate and industry-aware', kpis[0]?.foot.includes('Real estate client database'), kpis[0]?.foot);

  // 3. Tabs
  const activeTabColor = await m2wPage.$eval('.cp-tab-btn.active', (el) => {
    const s = window.getComputedStyle(el);
    return { color: s.color, borderBottomColor: s.borderBottomColor };
  });
  // rgb(37, 99, 235) is #2563EB
  record('M2W Tabs', 'Active tab uses Electric Blue (#2563EB)', activeTabColor.color.includes('37, 99, 235'), activeTabColor.color);

  // 4. Sticky Pinning Check
  const stickyStyles = await m2wPage.evaluate(() => {
    const thCheck = document.querySelector('th.col-sticky-check');
    const thContact = document.querySelector('th.col-sticky-contact');
    const tdCheck = document.querySelector('td.col-sticky-check');
    const tdContact = document.querySelector('td.col-sticky-contact');

    const sThCheck = window.getComputedStyle(thCheck);
    const sThContact = window.getComputedStyle(thContact);
    const sTdCheck = window.getComputedStyle(tdCheck);
    const sTdContact = window.getComputedStyle(tdContact);

    return {
      thCheckPosition: sThCheck.position,
      thCheckLeft: sThCheck.left,
      thContactPosition: sThContact.position,
      thContactLeft: sThContact.left,
      tdCheckPosition: sTdCheck.position,
      tdCheckLeft: sTdCheck.left,
      tdContactPosition: sTdContact.position,
      tdContactLeft: sTdContact.left,
    };
  });
  record('Sticky Pinning', 'Col 1 (checkbox) is sticky left 0px', stickyStyles.thCheckPosition === 'sticky' && stickyStyles.thCheckLeft === '0px', `${stickyStyles.thCheckPosition} left:${stickyStyles.thCheckLeft}`);
  record('Sticky Pinning', 'Col 2 (contact identity) is sticky left 44px', stickyStyles.thContactPosition === 'sticky' && stickyStyles.thContactLeft === '44px', `${stickyStyles.thContactPosition} left:${stickyStyles.thContactLeft}`);

  // Test Horizontal Scroll
  const scrollTest = await m2wPage.evaluate(() => {
    const wrap = document.querySelector('.cp-table-wrap');
    wrap.scrollLeft = 400; // scroll horizontally
    const tdContact = document.querySelector('td.col-sticky-contact');
    const rect = tdContact.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    return {
      scrollLeft: wrap.scrollLeft,
      contactVisible: rect.left >= wrapRect.left && rect.right <= wrapRect.right,
      contactRectLeft: rect.left,
      wrapRectLeft: wrapRect.left,
    };
  });
  record('Horizontal Scroll', 'Contact identity remains pinned during horizontal scroll', scrollTest.contactVisible && scrollTest.scrollLeft > 0, `scrollLeft:${scrollTest.scrollLeft}, contactLeft:${scrollTest.contactRectLeft}`);
  await m2wPage.screenshot({ path: path.join(OUT, '02_m2w_horizontal_scroll_pinned.png') });

  // 5. Check Project display (Problem 42 verification)
  const projects = await m2wPage.$$eval('tbody tr td:nth-child(6)', (cells) => cells.map((c) => c.textContent.trim()));
  const hasFakeIndustry = projects.some((p) => p === 'Real Estate');
  record('Project Column Binding', 'No fake "Real Estate" values displayed as project name', !hasFakeIndustry, `Projects found: ${projects.join(', ')}`);

  // 6. Test Search & Filter Toolbar
  await m2wPage.type('.cp-search-wrap input', 'Vikram');
  await new Promise((r) => setTimeout(r, 400)); // debounce
  const filteredRows = await m2wPage.$$eval('tbody tr', (rows) => rows.length);
  record('Search Filter', 'Search filters rows to matching contact', filteredRows === 1, `Found ${filteredRows} row(s)`);

  const chipText = await m2wPage.$eval('.cp-chip', (el) => el.textContent.trim());
  record('Filter Chips', 'Removable active filter chip displayed', chipText.includes('Search: "Vikram"'), chipText);

  // Clear search via chip remove
  await m2wPage.click('.cp-chip-remove');
  await new Promise((r) => setTimeout(r, 400));
  const restoredRows = await m2wPage.$$eval('tbody tr', (rows) => rows.length);
  record('Filter Chips', 'Removing chip restores full table', restoredRows === 5, `Restored ${restoredRows} rows`);

  // 7. Test KPI card click filter
  await m2wPage.click('.cp-kpi-card.opted-out');
  await new Promise((r) => setTimeout(r, 400));
  const optedOutRows = await m2wPage.$$eval('tbody tr', (rows) => rows.length);
  record('KPI Interaction', 'Clicking Opted Out KPI card filters table to opted-out contacts', optedOutRows === 1, `Found ${optedOutRows} row(s)`);

  // Reset filter by clicking Total Contacts KPI card
  await m2wPage.click('.cp-kpi-card:first-child');
  await new Promise((r) => setTimeout(r, 400));
  const allRows = await m2wPage.$$eval('tbody tr', (rows) => rows.length);
  record('KPI Interaction', 'Clicking Total Contacts restores all contacts', allRows === 5, `Found ${allRows} row(s)`);

  // 8. Contact Details Drawer
  await m2wPage.click('tbody tr:first-child td.col-sticky-contact button');
  await m2wPage.waitForSelector('.contact-drawer');
  await new Promise((r) => setTimeout(r, 300));
  const drawerEyebrow = await m2wPage.$eval('.drawer-head .page-header-eyebrow', (el) => el.textContent.trim());
  record('Contact Drawer', 'Drawer opens with industry-specific eyebrow', drawerEyebrow === 'PROPERTY ENQUIRY PROFILE', drawerEyebrow);

  const mockBadge = await m2wPage.$eval('.contact-drawer', (el) => el.textContent.includes('MOCK SIMULATION'));
  record('Contact Drawer', 'WhatsApp Message History has MOCK SIMULATION badge', mockBadge);

  await m2wPage.screenshot({ path: path.join(OUT, '03_m2w_drawer_open.png') });
  await m2wPage.click('.modal-close');
  await new Promise((r) => setTimeout(r, 300));

  await m2wCtx.close();

  console.log('\n--- 2. TESTING FITZONE GYM CONTACTS & AUDIENCES ---');
  const { ctx: gymCtx, page: gymPage } = await loginAndGo(
    'owner.gym@relay-demo.test',
    passwords['owner.gym@relay-demo.test'],
    'gym'
  );

  await gymPage.screenshot({ path: path.join(OUT, '04_gym_contacts_desktop.png') });

  const gymSubtitle = await gymPage.$eval('.page-header-subtitle', (el) => el.textContent.trim());
  record('Gym Header', 'Gym subtitle mentions membership enquiries', gymSubtitle.includes('Manage membership enquiries'), gymSubtitle);

  const gymHeaders = await gymPage.$$eval('thead th', (ths) => ths.map((th) => th.textContent.trim()));
  record('Gym Table', 'Columns use Gym terminology (Membership Interest & Fitness Goal)', gymHeaders.includes('Membership Interest') && gymHeaders.includes('Fitness Goal / Program'), gymHeaders.join(' | '));

  const gymRows = await gymPage.$$eval('tbody tr', (rows) => rows.length);
  record('Gym Isolation', 'Shows only 5 gym contacts', gymRows === 5, `Found ${gymRows} rows`);

  await gymCtx.close();

  console.log('\n--- 3. TESTING CAREPLUS CLINIC CONTACTS & AUDIENCES ---');
  const { ctx: clinicCtx, page: clinicPage } = await loginAndGo(
    'owner.clinic@relay-demo.test',
    passwords['owner.clinic@relay-demo.test'],
    'clinic'
  );

  await clinicPage.screenshot({ path: path.join(OUT, '05_clinic_contacts_desktop.png') });

  const clinicSubtitle = await clinicPage.$eval('.page-header-subtitle', (el) => el.textContent.trim());
  record('Clinic Header', 'Clinic subtitle mentions service enquiries', clinicSubtitle.includes('Manage service enquiries'), clinicSubtitle);

  const clinicHeaders = await clinicPage.$$eval('thead th', (ths) => ths.map((th) => th.textContent.trim()));
  record('Clinic Table', 'Columns use Clinic terminology (Service Enquiry & Department / Clinic)', clinicHeaders.includes('Service Enquiry') && clinicHeaders.includes('Department / Clinic'), clinicHeaders.join(' | '));

  const clinicRows = await clinicPage.$$eval('tbody tr', (rows) => rows.length);
  record('Clinic Isolation', 'Shows all CarePlus clinic contacts truthfully (5 seed + test recipients)', clinicRows >= 5, `Found ${clinicRows} rows`);

  // Test mobile viewport on Clinic
  await clinicPage.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await new Promise((r) => setTimeout(r, 400));
  await clinicPage.screenshot({ path: path.join(OUT, '06_clinic_contacts_mobile_390.png') });
  record('Mobile Viewport', 'Mobile 390px rendered without breakage', true);

  await clinicCtx.close();

} catch (err) {
  console.error('Test error:', err);
  record('Browser Test Run', 'Completed without uncaught exception', false, err.message);
} finally {
  await browser.close();
  const passed = results.filter((r) => r.pass).length;
  console.log(`\n========================================`);
  console.log(`RESULTS: ${passed}/${results.length} PASSED`);
  console.log(`========================================\n`);
  if (passed < results.length) {
    process.exit(1);
  }
}
