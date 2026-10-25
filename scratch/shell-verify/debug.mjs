import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.demo-passwords.json'), 'utf8'));
const BASE = 'http://localhost:5173';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 963 });
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
await page.type('input[name=email]', 'owner.m2w@relay-demo.test');
await page.type('input[name=password]', pw['owner.m2w@relay-demo.test']);
await Promise.all([page.waitForSelector('.rs-sidebar'), page.click('button.auth-submit')]);
await sleep(1500);
const info = await page.evaluate(() => {
  const b = document.querySelector('.rs-avatar--btn');
  const r = b.getBoundingClientRect();
  const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return { rect: [r.left, r.top, r.width, r.height], topEl: top?.className || top?.tagName, expanded: b.getAttribute('aria-expanded') };
});
console.log('before', JSON.stringify(info));
await page.click('.rs-avatar--btn');
await sleep(500);
console.log('after', await page.evaluate(() => ({ expanded: document.querySelector('.rs-avatar--btn').getAttribute('aria-expanded'), pop: !!document.querySelector('.rs-popover'), popCount: document.querySelectorAll('.rs-popover').length })));
// try dispatching click directly
await page.evaluate(() => document.querySelector('.rs-avatar--btn').click());
await sleep(500);
console.log('after js click', await page.evaluate(() => ({ expanded: document.querySelector('.rs-avatar--btn').getAttribute('aria-expanded'), pop: !!document.querySelector('.rs-popover') })));

// svg overflow culprit at 320
await page.setViewport({ width: 320, height: 640 });
await page.goto(`${BASE}/app`, { waitUntil: 'networkidle2' });
await sleep(900);
console.log(JSON.stringify(await page.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const res = [];
  document.querySelectorAll('svg').forEach((s) => {
    const r = s.getBoundingClientRect();
    if (r.right > vw + 0.5 && !s.closest('.rs-sidebar')) {
      const chain = [];
      let e = s.parentElement;
      for (let i = 0; i < 5 && e; i++, e = e.parentElement) chain.push(`${e.tagName.toLowerCase()}.${String(e.className).slice(0, 30)}`);
      res.push({ right: Math.round(r.right), chain });
    }
  });
  const topbar = document.querySelector('.rs-topbar-inner');
  return { svgs: res, topbarScroll: topbar.scrollWidth - topbar.clientWidth, shellScroll: document.querySelector('.rs-shell').scrollWidth, mainScroll: document.querySelector('.rs-main').scrollWidth, pageContent: document.querySelector('.page-content').scrollWidth };
}), null, 1));
await browser.close();
