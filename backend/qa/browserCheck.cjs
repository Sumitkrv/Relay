// Run only against qa/fixtureServer.js. PLAYWRIGHT_MODULE and CHROMIUM_EXECUTABLE may point to an existing local installation.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const origin = 'http://127.0.0.1:5174';
const out = process.env.RELAY_QA_ARTIFACTS || '/tmp/relay-browser-evidence';
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
  const context = await browser.newContext({ viewport: { width: 1525, height: 1024 } });
  context.setDefaultTimeout(15000);
  const errors = [], networkFailures = [], checks = [], layout = [];
  const pages = [];
  const api = (page, route, method = 'GET', body) => page.evaluate(async ({ route, method, body }) => {
    const response = await fetch(`http://127.0.0.1:5001/api${route}`, {
      method, credentials: 'include', headers: { 'Content-Type': 'application/json', 'x-relay-session-id': sessionStorage.getItem('relay_tab_session_id'), 'x-workspace-id': sessionStorage.getItem('relay_active_workspace_id') },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
  }, { route, method, body });
  for (const [index, industry] of ['real_estate', 'clinic', 'gym'].entries()) {
    const page = await context.newPage(); pages.push(page);
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    page.on('response', response => { if (response.status() >= 400 && !response.url().endsWith('/auth/me')) networkFailures.push({ status: response.status(), url: response.url() }); });
    await page.goto(`${origin}/login`);
    await page.locator('[name=email]').fill(`${industry}@isolated.example.test`);
    await page.locator('[name=password]').fill('IsolatedTest123!');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.waitForURL('**/app*');
    await page.waitForFunction(() => document.title.endsWith(' | Relay'));
    console.log('Browser checkpoint', checks.length + 1);
    checks.push({ check: `${industry} browser login`, result: 'PASS' });
    // Each page shares this browser profile's cookie jar.
    for (let refresh = 0; refresh < 2; refresh++) {
      await page.reload(); await page.waitForFunction(() => document.title.endsWith(' | Relay'));
      const me = await api(page, '/auth/me');
      assert.equal(me.body.user.email, `${industry}@isolated.example.test`);
    }
    await page.goto(`${origin}/templates`);
    await page.getByRole('button', { name: /Preset Library/ }).click();
    await page.getByRole('button', { name: 'Load Template Preset' }).first().waitFor();
    assert.equal(await page.locator('.tp-preset-card').count(), 15);
    if (index !== 0) assert.equal(await page.getByText('Real Estate Preset Library', { exact: true }).count(), 0);
    console.log('Browser checkpoint', checks.length + 1);
    checks.push({ check: `${industry} independent refresh and correct pack`, result: 'PASS' });
  }
  const templateName = `qa_browser_${Date.now()}`;
  const page = pages[0];
  await page.bringToFront();
  await page.goto(`${origin}/templates`);
  await page.getByRole('button', { name: /Real Estate Preset Library/ }).click();
  await page.getByRole('button', { name: 'Load Template Preset' }).first().click();
  const name = page.locator('input[value="re_welcome_draft"]');
  await name.fill(templateName);
  const editor = page.locator('.tp-body-textarea');
  await editor.fill((await editor.inputValue()) + '\nBrowser persistence verification.');
  await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
  await page.getByText('Template draft saved in MongoDB.', { exact: true }).waitFor();
  await page.reload();
  await page.locator('.template-list-panel').getByText(templateName, { exact: true }).click();
  assert.match(await editor.inputValue(), /Browser persistence verification/);
  await editor.fill((await editor.inputValue()) + '\nSecond saved revision.');
  await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
  await page.getByText('Template draft saved in MongoDB.', { exact: true }).waitFor();
  const templates = await api(page, '/templates');
  const saved = templates.body.records.find(t => t.name === templateName);
  assert.equal(saved.currentVersionNumber, 2);
  console.log('Browser checkpoint', checks.length + 1);
    checks.push({ check: 'Preset selection, editor, explicit save, refresh, update and versioning', result: 'PASS' });
  await page.screenshot({ path: path.join(out, 'templates-desktop.png'), fullPage: true, animations: 'disabled' });
  await page.goto(`${origin}/campaigns`);
  await page.getByText(/Real Estate starter drafts/).click();
  await page.getByRole('button', { name: 'Use starter draft' }).first().click();
  await page.getByRole('button', { name: 'Save Draft & Exit' }).waitFor();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Save Draft & Exit' }).click();
  await page.waitForURL('**/campaigns');
  const campaigns = await api(page, '/campaigns');
  assert.ok(campaigns.body.records.some(c => c.status === 'Draft' && /Property Enquiry/.test(c.name)));
  assert.ok(campaigns.body.records.every(c => !c.mockSchedule));
  console.log('Browser checkpoint', checks.length + 1);
    checks.push({ check: 'Campaign starter opens wizard, saves a draft and never schedules/sends automatically', result: 'PASS' });
  await page.goto(`${origin}/inbox`);
  await page.getByText('Isolated QA enquiry', { exact: true }).first().waitFor();
  await page.getByRole('button', { name: /Auto-reply Rules/i }).click();
  await page.getByText(/Review industry starter rules/).click();
  await page.getByRole('button', { name: 'Save missing starter rules' }).click();
  await page.getByText('Starter rules saved disabled.', { exact: true }).waitFor();
  const rules = await api(page, '/inbox/auto-reply-rules');
  assert.equal(rules.body.records.filter(r => !r.isProtected).length, 5);
  assert.ok(rules.body.records.filter(r => !r.isProtected).every(r => r.enabled === false));
  await page.getByRole('button', { name: /Quick Replies/ }).first().click();
  await page.getByText(/Review industry starter replies/).click();
  await page.getByRole('button', { name: 'Save missing starter replies' }).click();
  await page.getByText('Starter replies saved.', { exact: true }).waitFor();
  const replyIds = (await api(page, '/inbox/quick-replies')).body.records.map(r => r._id).sort();
  assert.equal(replyIds.length, 8);
  await page.reload();
  assert.deepEqual((await api(page, '/inbox/quick-replies')).body.records.map(r => r._id).sort(), replyIds);
  console.log('Browser checkpoint', checks.length + 1);
    checks.push({ check: 'Eight quick replies, five disabled rules, protected STOP and refresh without duplicate IDs', result: 'PASS' });
  for (const route of ['/app', '/contacts', '/templates', '/campaigns', '/inbox', '/reports', '/settings']) {
    await page.setViewportSize({ width: 1525, height: 1024 });
    await page.goto(`${origin}${route}`); await page.waitForTimeout(450);
    assert.ok((await page.title()).startsWith('M2W Realty (isolated QA)'));
    for (const width of [1920, 1525, 1440, 1366, 1280, 1024, 768, 430, 390, 375]) {
      const height = width === 1525 ? 1024 : width >= 1024 ? 800 : width >= 768 ? 1024 : 932;
      await page.setViewportSize({ width, height }); await page.waitForTimeout(300);
      const dimensions = await page.evaluate(() => ({ documentWidth: document.documentElement.scrollWidth, viewport: innerWidth, title: document.querySelector('h1')?.textContent }));
      layout.push({ route, width, height, ...dimensions });
      await page.screenshot({ path: path.join(out, `${route.replaceAll('/', '-')}-${width}.png`), fullPage: true, animations: 'disabled' });
    }
    await page.reload(); await page.waitForTimeout(150);
  }
  await page.setViewportSize({ width: 1366, height: 800 });
  await page.goto(`${origin}/templates`);
  await page.getByRole('button', { name: 'Show Preview', exact: true }).click();
  await page.getByRole('button', { name: 'Close preview', exact: true }).click();
  await page.locator('.template-preview-column').waitFor({ state: 'hidden' });
  checks.push({ check: 'Compact preview drawer opens and closes through reachable controls', result: 'PASS' });
  await page.setViewportSize({ width: 375, height: 932 });
  await page.goto(`${origin}/templates`);
  await page.getByRole('button', { name: 'Live Preview', exact: true }).click();
  await page.locator('.template-preview-column').waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Editor', exact: true }).click();
  await page.locator('.template-editor-panel').waitFor({ state: 'visible' });
  checks.push({ check: 'Mobile editor and preview controls', result: 'PASS' });
  await pages[1].getByRole('button', { name: 'Sign out', exact: true }).first().click();
  await pages[1].waitForURL('**/login');
  for (const [p, industry] of [[pages[0], 'real_estate'], [pages[2], 'gym']]) {
    await p.reload(); await p.waitForFunction(() => document.title.endsWith(' | Relay'));
    assert.equal((await api(p, '/auth/me')).body.user.email, `${industry}@isolated.example.test`);
  }
  console.log('Browser checkpoint', checks.length + 1);
    checks.push({ check: 'Independent logout in one shared browser context', result: 'PASS' });
  const overflow = layout.filter(r => r.documentWidth > r.width + 1);
  const result = { checks, layoutChecks: layout.length, overflow, errors, networkFailures, layout };
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ checks, layoutChecks: layout.length, overflow, errors, networkFailures }, null, 2));
  await browser.close();
  assert.equal(errors.length, 0, 'No uncaught browser exceptions');
  assert.equal(networkFailures.length, 0, 'No unexpected API failures');
  assert.equal(overflow.length, 0, 'No document overflow across the viewport matrix');
})().catch(error => { console.error(error); process.exit(1); });
