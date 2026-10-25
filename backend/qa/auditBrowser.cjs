const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const fixtures = JSON.parse(fs.readFileSync('/tmp/relay-audit-fixtures.json', 'utf8'));
const out = process.env.RELAY_QA_ARTIFACTS || '/tmp/relay-audit-browser';
fs.mkdirSync(out, { recursive: true });
const origin = 'http://127.0.0.1:5174';
(async () => {
 const browser = await chromium.launch({ headless: true });
 const context = await browser.newContext({ viewport: { width: 1525, height: 1024 } });
 const errors = [], checks = [], layout = [], pages = [];
 async function api(page, route) { return page.evaluate(async route => { const res = await fetch('http://127.0.0.1:5002/api' + route, { credentials: 'include', headers: { 'x-relay-session-id': sessionStorage.getItem('relay_tab_session_id'), 'x-workspace-id': sessionStorage.getItem('relay_active_workspace_id') } }); return { status: res.status, body: await res.json() }; }, route); }
 for (const industry of ['real_estate','clinic','gym','generic_business','ecommerce_retail','home_services','hospitality']) {
  const account = fixtures.accounts.find(a => a.industryKey === industry);
  const page = await context.newPage(); pages.push({page, account});
  page.on('pageerror',e=>errors.push({industry,message:e.message}));
  await page.goto(origin+'/login');
  await page.locator('[name=email]').fill(account.email);
  await page.locator('[name=password]').fill(account.password);
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.waitForURL('**/app*');
  await page.getByRole('link',{name:/Total Contacts:/}).waitFor();
  assert.equal((await api(page, '/industries/workspace/current')).body.industryKey,industry);
  for (const route of ['/contacts','/templates','/campaigns','/inbox','/reports','/settings']) {
   await page.goto(origin+route);await page.waitForLoadState('networkidle');
   assert.equal(await page.getByText("Something didn't load quite right").count(),0, route + ' must render without a React boundary failure');
   assert.equal(await page.getByRole('button',{name:'Retry workspace'}).count(),0);
  }
  await page.goto(origin+'/templates');await page.getByRole('button',{name:/Preset Library/}).click();
  await page.locator('.tp-preset-card').first().waitFor();assert.equal(await page.locator('.tp-preset-card').count(),15);
  await page.reload(); await page.getByRole('button',{name:/Preset Library/}).waitFor();
  assert.equal((await api(page, '/auth/me')).body.user.email,account.email);
  checks.push({check:industry+' six module loads, correct industry, preset count, refresh',result:'PASS'});
  console.log('Browser industry verified:',industry);
 }
 const {page,account}=pages[0];
 const contactName = 'Browser Audit Contact ' + Date.now();
 // Same browser cookie jar: signing in additional tabs must not change earlier sessions.
 for (const item of pages) {await item.page.reload();await item.page.waitForLoadState('networkidle');assert.equal((await api(item.page,'/auth/me')).body.user.email,item.account.email);}
 checks.push({check:'Seven accounts in one browser profile retain independent tab sessions',result:'PASS'});
 await page.goto(origin+'/contacts');await page.getByRole('button',{name:'Add Contact',exact:true}).click();
 await page.getByRole('dialog').waitFor();
 const dialog=page.getByRole('dialog');
 await dialog.getByPlaceholder('e.g. Vikram Malhotra').fill(contactName);
 await dialog.getByPlaceholder('9876543210 or +919876543210').fill('+141555' + String(Date.now()).slice(-5));
 await dialog.locator('label.field').filter({hasText:/^Property Type/}).locator('select').selectOption('3 BHK Apartment');
 await dialog.locator('label.field').filter({hasText:/^Site Visit Status/}).locator('select').selectOption({index:1});
 await dialog.getByRole('button',{name:'Add Contact',exact:true}).click();
 await dialog.waitFor({state:'hidden'}); await page.reload();
 await page.getByText(contactName,{exact:true}).first().waitFor();
 checks.push({check:'Metadata-driven contact form saves and survives refresh',result:'PASS'});
 const widths=[1920,1525,1440,1366,1280,1024,768,430,390,375];
 for (const route of ['/app','/contacts','/templates','/campaigns/new','/inbox','/reports','/settings']) {
  await page.goto(origin+route);await page.waitForLoadState('networkidle');
  for (const width of widths) {
   await page.setViewportSize({width,height:width<500?932:width===1280?800:1024});
   await page.waitForTimeout(80);
   const overflow=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:window.innerWidth}));
   layout.push({route,width,...overflow,pass:overflow.scroll<=width+1});
   if ([1525,1280,430,375].includes(width)) await page.screenshot({path:path.join(out,route.replaceAll('/','_')+'-'+width+'.png'),fullPage:true});
  }
 }
 await page.setViewportSize({width:1525,height:1024});
 // Configuration outage must not produce a generic / real-estate fallback.
 await page.route('**/industries/workspace/current',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Industry configuration temporarily unavailable'})}));
 await page.reload();await page.getByRole('button',{name:'Retry workspace'}).waitFor();
 assert.equal(await page.locator('.tp-preset-card').count(),0);
 await page.screenshot({path:path.join(out,'industry-unavailable.png'),fullPage:true});
 await page.unroute('**/industries/workspace/current');await page.getByRole('button',{name:'Retry workspace'}).click();await page.waitForLoadState('networkidle');
 checks.push({check:'Industry API failure is visible and retry restores API data',result:'PASS'});
 // Switching the current tab to another authorized industry reloads all module state.
 const gym=fixtures.accounts.find(a=>a.industryKey==='gym');
 await page.evaluate(id=>sessionStorage.setItem('relay_active_workspace_id',id),gym.workspaceId);
 await page.reload();await page.waitForLoadState('networkidle');assert.equal((await api(page,'/industries/workspace/current')).body.industryKey,'gym');
 await page.goto(origin+'/templates');await page.getByRole('button',{name:/Gym.*Preset Library/}).waitFor();
 checks.push({check:'Authorized workspace switch reloads correct industry',result:'PASS'});
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({checks,layout,errors},null,2));
 console.log(JSON.stringify({checks:checks.length,layout:layout.length,overflow:layout.filter(x=>!x.pass),errors}));
 await browser.close();assert.equal(errors.length,0);assert.equal(layout.filter(x=>!x.pass).length,0);
})().catch(e=>{console.error(e);process.exit(1)});
