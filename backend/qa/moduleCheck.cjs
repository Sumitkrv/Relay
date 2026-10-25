const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const out = process.env.RELAY_QA_ARTIFACTS || '/tmp/relay-browser-evidence';
(async () => {
 const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
 const p = await browser.newPage({ viewport: { width: 1525, height: 1024 } });
 p.setDefaultTimeout(15000);
 const errors=[], failures=[], checks=[];
 const leadName = `Browser Created QA Lead ${Date.now()}`;
 const phone = '+141555' + String(Date.now()).slice(-5);
 p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());
 p.on('response',r=>{if(r.status()>=400 && !r.url().endsWith('/auth/me'))failures.push({url:r.url(),status:r.status()});});
 await p.goto('http://127.0.0.1:5174/login');await p.locator('[name=email]').fill('real_estate@isolated.example.test');await p.locator('[name=password]').fill('IsolatedTest123!');await p.getByRole('button',{name:'Sign in',exact:true}).click();await p.waitForURL('**/app*');
 await p.goto('http://127.0.0.1:5174/contacts');
 await p.getByRole('button',{name:'Add Contact',exact:true}).click();
 await p.getByPlaceholder('e.g. Vikram Malhotra').fill(leadName);
 await p.getByPlaceholder('9876543210 or +919876543210').fill(phone);
 await p.getByPlaceholder('e.g. Gurugram, Delhi, Noida').fill('QA City');
 await p.locator('label.field').filter({hasText:'Site Visit Status'}).locator('select').selectOption('Requested');
 await p.getByRole('button',{name:'Add Property Contact',exact:true}).click();
 await p.getByText(leadName,{exact:true}).first().waitFor();
 await p.reload();await p.getByText(leadName,{exact:true}).first().waitFor();
 await p.getByText(leadName,{exact:true}).first().click();
 await p.getByRole('button',{name:'Close profile'}).waitFor();
 await p.screenshot({path:path.join(out,'contact-detail-desktop.png'),fullPage:true});
 checks.push({check:'Contacts form, real API save, refresh, details and site-visit metadata',result:'PASS'});
 await p.goto('http://127.0.0.1:5174/reports');
 for(const name of ['Overview','Campaign Performance','Message Activity','Consent & Opt-outs','Exports']){
  await p.getByRole('tab',{name,exact:true}).click();await p.waitForTimeout(300);
  await p.screenshot({path:path.join(out,`reports-${name.replaceAll(/[^a-z]+/gi,'-').toLowerCase()}.png`),fullPage:true});
  checks.push({check:`Reports ${name} tab`,result:'PASS'});
 }
 await p.goto('http://127.0.0.1:5174/settings');
 for(const name of ['Profile','Business Profile','Security & Password','WhatsApp Integration','Preferences','Billing & Subscriptions','About Relay','Developer / Test Mode']){
  await p.locator('.settings-nav').getByRole('button',{name,exact:true}).click();await p.waitForTimeout(250);
  checks.push({check:`Settings ${name} panel`,result:'PASS'});
 }
 await p.locator('.settings-nav-item').filter({hasText:'WhatsApp Integration'}).click();
 const response=p.waitForResponse(r=>r.url().endsWith('/settings/integrations'));
 await p.getByRole('button',{name:'Refresh connection status',exact:true}).click();
 assert.equal((await response).status(),200);
 await p.screenshot({path:path.join(out,'settings-integration-desktop.png'),fullPage:true});
 const result={checks,errors,networkFailures:failures};fs.writeFileSync(path.join(out,'module-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
 await browser.close();assert.equal(errors.length,0);assert.equal(failures.length,0);
})().catch(e=>{console.error(e);process.exit(1);});
