import { call, login, KNOWN, ws, sh } from './lib.mjs';
const email = 'owner.gym@relay-demo.test';
const L = await login(email, KNOWN[email]);
console.log('login', L.s, Object.keys(L.j||{}), 'workspaces:', sh(L.j.workspaces));
const W = L.j.workspaces[0].id;
for (const p of ['/auth/me','/workspaces/current','/contacts?limit=5','/templates','/inbox/quick-replies','/inbox/rules','/inbox/auto-reply-rules','/campaigns','/inbox/conversations','/settings/business','/settings/preferences','/dashboard/overview','/reports/overview?range=30d','/templates/ai/status','/settings/integrations','/settings/demo-status']) {
  const r = await call(L.token, 'GET', p, undefined, ws(W));
  console.log(String(r.s), p, '=>', typeof r.j==='object' ? Object.keys(r.j).join(',') : String(r.j).slice(0,80));
}
