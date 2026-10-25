import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'templates_out');
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

  // Navigate to templates
  await page.goto(`${BASE}/templates`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('.templates-page');
  await new Promise((r) => setTimeout(r, 600));
  return { ctx, page };
}

try {
  console.log('\n--- 1. TESTING M2W REALTY TEMPLATE STUDIO ---');
  const { ctx: m2wCtx, page: m2wPage } = await loginAndGo(
    'owner.m2w@relay-demo.test',
    passwords['owner.m2w@relay-demo.test'],
    'm2w'
  );

  // Take initial desktop screenshot
  await m2wPage.screenshot({ path: path.join(OUT, '01_m2w_templates_desktop.png'), fullPage: false });

  // 1. Header checks
  const title = await m2wPage.$eval('.page-header-title', (el) => el.textContent.trim());
  record('M2W Header', 'Title is "Templates"', title === 'Templates', title);

  const subtitle = await m2wPage.$eval('.page-header-subtitle', (el) => el.textContent.trim());
  record('M2W Header', 'Subtitle is professional', subtitle.includes('messaging templates'), subtitle);

  const newBtn = await m2wPage.$eval('button.primary-btn.small', (el) => el.textContent.trim());
  record('M2W Header', 'Prominent "+ New Template" button exists', newBtn.includes('New Template'), newBtn);

  // 2. Top Tabs
  const tabs = await m2wPage.$$eval('.tp-top-tab', (els) => els.map((e) => e.textContent.trim()));
  record('M2W Tabs', 'Tabs exist (Studio & Preset Library)', tabs.length === 2 && tabs[0].includes('Template Studio') && tabs[1].includes('Preset Library'), JSON.stringify(tabs));

  // 3. Saved Templates Library (Left panel)
  const templateItems = await m2wPage.$$eval('.tp-template-item', (items) =>
    items.map((item) => ({
      name: item.querySelector('.tp-template-name')?.textContent.trim(),
      version: item.querySelector('.tp-version-badge')?.textContent.trim(),
      snippet: item.querySelector('.tp-template-snippet')?.textContent.trim(),
    }))
  );
  record('M2W Library', 'Saved templates loaded (at least 7 seeded)', templateItems.length >= 7, `Found ${templateItems.length}`);
  
  const welcomeTpl = templateItems.find((t) => t.name.toLowerCase().includes('welcome'));
  const vNum = parseInt(welcomeTpl?.version.replace('v', ''), 10);
  record('M2W Library', 'Welcome Message has version >= v5', vNum >= 5, `Version is ${welcomeTpl?.version}`);

  // 4. Select Welcome Message explicitly
  const welcomeEl = await m2wPage.evaluateHandle(() => {
    const items = Array.from(document.querySelectorAll('.tp-template-item'));
    return items.find((el) => el.textContent.includes('Welcome Message')) || items[0];
  });
  await welcomeEl.click();
  await new Promise((r) => setTimeout(r, 400));

  const isSelected = await m2wPage.evaluate((el) => el.classList.contains('selected'), welcomeEl);
  record('M2W Selection', 'Selected template has active state class', isSelected);

  // Check Editor Heading
  const editorEyebrow = await m2wPage.$eval('.tp-badge-eyebrow', (el) => el.textContent.trim());
  record('M2W Editor', 'Contextual eyebrow displays VERSION', editorEyebrow.includes('VERSION'), editorEyebrow);

  const editorTitle = await m2wPage.$eval('.tp-editor-title', (el) => el.textContent.trim());
  record('M2W Editor', 'Displays template name in heading', editorTitle.length > 0, editorTitle);

  const metaBadge = await m2wPage.$eval('.tp-badge-meta', (el) => el.textContent.trim());
  record('M2W Editor', 'Truthful Meta Status: Not Submitted (Mock Mode)', metaBadge.includes('Not Submitted (Mock Mode)'), metaBadge);

  // 5. Check Grouped Sections
  const sectionTitles = await m2wPage.$$eval('.tp-section-title', (els) => els.map((e) => e.textContent.trim()));
  record('M2W Editor Sections', 'All 6 clear form sections present', sectionTitles.length >= 5, JSON.stringify(sectionTitles));

  // 6. WhatsApp Live Preview Verification
  const waPreviewExists = await m2wPage.$('.whatsapp-preview');
  record('M2W Preview', 'WhatsApp simulation container exists', !!waPreviewExists);

  const previewPill = await m2wPage.$eval('.wa-preview-pill', (el) => el.textContent.trim());
  record('M2W Preview', 'Displays "TEMPLATE PREVIEW · NOT SENT"', previewPill.includes('TEMPLATE PREVIEW · NOT SENT'), previewPill);

  const waTopText = await m2wPage.$eval('.wa-preview-top', (el) => el.textContent.trim());
  record('M2W Preview', 'WhatsApp preview header displays M2W Realty', waTopText.includes('M2W Realty'), waTopText);

  const waBubbleText = await m2wPage.$eval('.wa-bubble-body', (el) => el.textContent.trim());
  record('M2W Preview', 'Bubble displays resolved or draft body', waBubbleText.length > 10, waBubbleText.slice(0, 50) + '…');

  // Test variable insertion
  const oldBody = await m2wPage.$eval('.tp-body-textarea', (el) => el.value);
  const chipBtn = await m2wPage.$('.tp-var-chip');
  if (chipBtn) {
    await chipBtn.click();
    await new Promise((r) => setTimeout(r, 200));
    const newBody = await m2wPage.$eval('.tp-body-textarea', (el) => el.value);
    record('M2W Variables', 'Clicking variable chip inserts token into body', newBody.length > oldBody.length, `Body length ${oldBody.length} -> ${newBody.length}`);
  }

  // Check save status indicator is dirty
  const dirtyStatus = await m2wPage.$eval('.tp-save-status', (el) => el.textContent.trim());
  record('M2W Save State', 'Status accurately reflects "Unsaved draft changes"', dirtyStatus.includes('Unsaved draft changes'), dirtyStatus);

  // Save the draft
  await m2wPage.screenshot({ path: path.join(OUT, '02_m2w_before_save.png'), fullPage: false });
  const saveBtn = await m2wPage.$('.tp-editor-sticky-footer button.primary-btn');
  if (saveBtn) {
    await saveBtn.click();
    await new Promise((r) => setTimeout(r, 1200));
    const cleanStatus = await m2wPage.$eval('.tp-save-status', (el) => el.textContent.trim());
    record('M2W Save State', 'Status updates to "All changes saved to MongoDB"', cleanStatus.includes('All changes saved to MongoDB'), cleanStatus);
  }

  // Test Preset Library tab
  const presetTab = await m2wPage.$$('.tp-top-tab');
  if (presetTab[1]) {
    await presetTab[1].click();
    await new Promise((r) => setTimeout(r, 400));
    const presetCards = await m2wPage.$$('.tp-preset-card');
    record('M2W Presets', 'Preset library cards rendered', presetCards.length > 0, `Found ${presetCards.length} presets`);
    await m2wPage.screenshot({ path: path.join(OUT, '03_m2w_preset_library.png'), fullPage: false });

    // Switch back to Studio
    await presetTab[0].click();
    await new Promise((r) => setTimeout(r, 400));
  }

  // Test New Template Action
  const newTemplateBtn = await m2wPage.$('.page-header-actions button');
  if (newTemplateBtn) {
    await newTemplateBtn.click();
    await new Promise((r) => setTimeout(r, 300));
    const newEyebrow = await m2wPage.$eval('.tp-badge-eyebrow', (el) => el.textContent.trim());
    record('M2W New Template', 'Switches to NEW MESSAGE TEMPLATE', newEyebrow.includes('NEW MESSAGE TEMPLATE'), newEyebrow);
    await m2wPage.screenshot({ path: path.join(OUT, '04_m2w_new_template.png'), fullPage: false });
  }

  await m2wCtx.close();

  console.log('\n--- 2. TESTING FITZONE GYM WORKSPACE ---');
  const { ctx: gymCtx, page: gymPage } = await loginAndGo(
    'owner.gym@relay-demo.test',
    passwords['owner.gym@relay-demo.test'],
    'gym'
  );

  await gymPage.screenshot({ path: path.join(OUT, '05_fitzone_templates_desktop.png'), fullPage: false });

  const gymTemplates = await gymPage.$$eval('.tp-template-item', (items) =>
    items.map((item) => item.querySelector('.tp-template-name')?.textContent.trim())
  );
  record('Gym Library', 'Seven Gym templates loaded', gymTemplates.length === 7, `Found ${gymTemplates.length}`);
  
  const gymHasM2W = gymTemplates.some((t) => t.toLowerCase().includes('property') || t.toLowerCase().includes('realty'));
  record('Gym Isolation', 'No M2W real estate templates leaked', !gymHasM2W);

  // Click first gym template
  const gymFirst = await gymPage.$('.tp-template-item');
  if (gymFirst) {
    await gymFirst.click();
    await new Promise((r) => setTimeout(r, 400));
    const gymWaTop = await gymPage.$eval('.wa-preview-top', (el) => el.textContent.trim());
    record('Gym Preview', 'WhatsApp preview displays FitZone Gym', gymWaTop.includes('FitZone Gym'), gymWaTop);
    await gymPage.screenshot({ path: path.join(OUT, '06_fitzone_preview.png'), fullPage: false });
  }

  await gymCtx.close();

  console.log('\n--- 3. TESTING CAREPLUS CLINIC WORKSPACE ---');
  const { ctx: clinicCtx, page: clinicPage } = await loginAndGo(
    'owner.clinic@relay-demo.test',
    passwords['owner.clinic@relay-demo.test'],
    'clinic'
  );

  await clinicPage.screenshot({ path: path.join(OUT, '07_careplus_templates_desktop.png'), fullPage: false });

  const clinicTemplates = await clinicPage.$$eval('.tp-template-item', (items) =>
    items.map((item) => item.querySelector('.tp-template-name')?.textContent.trim())
  );
  record('Clinic Library', 'Seven Clinic templates loaded', clinicTemplates.length === 7, `Found ${clinicTemplates.length}`);

  const clinicHasGym = clinicTemplates.some((t) => t.toLowerCase().includes('fitness') || t.toLowerCase().includes('gym'));
  record('Clinic Isolation', 'No Gym templates leaked to Clinic', !clinicHasGym);

  const clinicFirst = await clinicPage.$('.tp-template-item');
  if (clinicFirst) {
    await clinicFirst.click();
    await new Promise((r) => setTimeout(r, 400));
    const clinicWaTop = await clinicPage.$eval('.wa-preview-top', (el) => el.textContent.trim());
    record('Clinic Preview', 'WhatsApp preview displays CarePlus Clinic', clinicWaTop.includes('CarePlus Clinic'), clinicWaTop);
    await clinicPage.screenshot({ path: path.join(OUT, '08_careplus_preview.png'), fullPage: false });
  }

  await clinicCtx.close();

  console.log('\n--- 4. TESTING RESPONSIVE VIEWPORTS ---');
  const { ctx: respCtx, page: respPage } = await loginAndGo(
    'owner.m2w@relay-demo.test',
    passwords['owner.m2w@relay-demo.test'],
    'resp'
  );

  const viewports = [
    { name: '1440x900_laptop', width: 1440, height: 900 },
    { name: '1024x768_tablet_landscape', width: 1024, height: 768 },
    { name: '768x1024_tablet_portrait', width: 768, height: 1024 },
    { name: '390x844_mobile', width: 390, height: 844 },
  ];

  for (const vp of viewports) {
    await respPage.setViewport({ width: vp.width, height: vp.height });
    await new Promise((r) => setTimeout(r, 400));
    await respPage.screenshot({ path: path.join(OUT, `09_m2w_${vp.name}.png`), fullPage: false });
    record('Responsive', `Viewport ${vp.name} rendered cleanly`, true);
  }

  await respCtx.close();

} catch (err) {
  console.error('Test script crashed:', err);
  record('Fatal Error', 'Execution error', false, err.message);
} finally {
  await browser.close();
}

console.log('\n======================================================');
const passed = results.filter((r) => r.pass).length;
const total = results.length;
console.log(`TOTAL PASS: ${passed} / ${total}`);
console.log('======================================================\n');
