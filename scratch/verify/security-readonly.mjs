// Read-only security probes against the working DB backend (only logins are written, as normal).
import { createRequire } from 'module';
import { call, login, ws, sh, KNOWN } from './lib.mjs';
const require = createRequire('/Users/sumitthakur/Desktop/Relay/backend/package.json');
const mongoose = require('mongoose'); await mongoose.connect('mongodb://127.0.0.1:27017');
const db = mongoose.connection.client.db('relay_demo');
const R = []; const rec = (id, ok, note='') => { R.push({id, ok, note}); console.log(`${ok?'PASS':'FAIL'}  ${id}${note?' — '+note:''}`); };
const slug = async s => String((await db.collection('workspaces').findOne({slug:s}))._id);
const gym = await login('owner.gym@relay-demo.test', KNOWN['owner.gym@relay-demo.test']);
const clinic = await login('owner.clinic@relay-demo.test', KNOWN['owner.clinic@relay-demo.test']);
const clone = await login('m2w-owner@relay-demo.test','DemoPass123!');
const adm = await login('admin@relay-demo.test','DemoPass123!');
const W = { gym: await slug('fitzone-gym'), clinic: await slug('careplus-clinic'), m2w: await slug('m2w-realty'), clone: await slug('m2w-realty-clone') };
// 1 cross-tenant header
for (const p of ['/contacts','/templates','/campaigns','/inbox/conversations','/dashboard/overview','/reports/overview','/settings/business','/inbox/quick-replies']) {
  const r = await call(gym.token,'GET',p,undefined,ws(W.clinic)); rec(`cross-workspace GET ${p} (gym token, clinic ws header) denied`, r.s===403, `status ${r.s}`);
}
// 2 same-industry (real_estate) isolation: clone owner -> M2W workspace
for (const p of ['/contacts','/templates','/campaigns','/inbox/conversations','/dashboard/overview']) {
  const r = await call(clone.token,'GET',p,undefined,ws(W.m2w)); rec(`same-industry GET ${p} (M2W clone token -> M2W ws) denied`, r.s===403, `status ${r.s}`);
}
// 2b direct object id access across workspaces
const m2wContact = await db.collection('contacts').findOne({workspaceId:new mongoose.Types.ObjectId(W.m2w), isDeleted:{$ne:true}});
const r2 = await call(clone.token,'GET',`/contacts/${m2wContact._id}`,undefined,ws(W.clone)); rec('same-industry direct contact id from other ws -> 404', r2.s===404, `status ${r2.s}`);
const m2wTpl = await db.collection('messagetemplates').findOne({workspaceId:new mongoose.Types.ObjectId(W.m2w)});
const r3 = await call(clone.token,'GET',`/templates/${m2wTpl._id}`,undefined,ws(W.clone)); rec('same-industry direct template id from other ws -> 404', r3.s===404, `status ${r3.s}`);
const r3b = await call(clone.token,'PATCH',`/templates/${m2wTpl._id}`,{name:'hijack'},ws(W.clone)); rec('same-industry cross-ws template PATCH blocked (no mutation)', [403,404].includes(r3b.s), `status ${r3b.s}`);
// 3 unauthenticated sweep
const open = [];
for (const p of ['/contacts','/templates','/campaigns','/inbox/conversations','/inbox/quick-replies','/inbox/auto-reply-rules','/dashboard/overview','/reports/overview','/settings/business','/settings/preferences','/imports','/segments','/workflows','/chatbots','/follow-ups','/notifications','/admin/overview','/agency/overview','/billing/subscription','/dev/mock-messaging/fixtures','/system/provider-status','/workspaces/current','/auth/me','/contact-groups','/contact-categories','/messages','/proposals','/sales/overview','/analytics/overview']) {
  const r = await call(null,'GET',p); if (![401,403,404].includes(r.s)) open.push(`${p}:${r.s}`); if (r.s===404) console.log('   (404 unauth)',p);
}
rec('no protected endpoint answers unauthenticated', open.length===0, open.join(', '));
// 4 invalid / malformed bearer
const bad = await call('garbage','GET','/contacts'); rec('garbage bearer -> 401', bad.s===401, `status ${bad.s}`);
// 5 non-admin on /admin
const na = await call(gym.token,'GET','/admin/workspaces'); rec('non-platform-admin blocked from /admin', na.s===403, `status ${na.s}`);
// 6 demo platform admin reach (informational)
const ad = await call(adm.token,'GET','/admin/workspaces'); 
const adNames = (ad.j?.workspaces||ad.j?.records||[]).map(w=>w.name);
console.log('INFO demo platform admin (public demo password) can list', adNames.length, 'workspaces:', adNames.join(' | ').slice(0,300), 'status', ad.s);
const adu = await call(adm.token,'GET','/admin/users'); console.log('INFO demo platform admin /admin/users status', adu.s, 'count', (adu.j?.users||adu.j?.records||[]).length);
// 7 logout revokes token
const t = await login('owner.clinic@relay-demo.test', KNOWN['owner.clinic@relay-demo.test']);
const ok1 = await call(t.token,'GET','/contacts',undefined,ws(W.clinic));
await call(t.token,'POST','/auth/logout');
const ok2 = await call(t.token,'GET','/contacts',undefined,ws(W.clinic));
rec('logout revokes the session token', ok1.s===200 && ok2.s===401, `before ${ok1.s}, after ${ok2.s}`);
// 8 independent sessions: second login unaffected by first logout
const s1 = await login('owner.clinic@relay-demo.test', KNOWN['owner.clinic@relay-demo.test']);
const s2 = await login('owner.clinic@relay-demo.test', KNOWN['owner.clinic@relay-demo.test']);
await call(s1.token,'POST','/auth/logout');
const a = await call(s1.token,'GET','/auth/me'); const b = await call(s2.token,'GET','/auth/me');
rec('independent sessions: logging out session 1 keeps session 2', a.s===401 && b.s===200, `s1 ${a.s}, s2 ${b.s}`);
await call(s2.token,'POST','/auth/logout');
import('node:fs').then(fs=>fs.writeFileSync('scratch/verify/security-readonly-results.json', JSON.stringify(R,null,2)));
await mongoose.disconnect();
