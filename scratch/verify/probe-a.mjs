import { call, login, ws, sh } from './lib.mjs';
const L = await login('education-owner@relay-demo.test','DemoPass123!'); const H = ws(L.j.workspaces[0].id);
const r = await call(L.token,'GET','/inbox/auto-reply-rules',undefined,H);
console.log(sh({total:r.j.total, legacy:r.j.legacyComplianceRuleCount, presets: r.j.presets?.length, rec:r.j.records?.map(x=>({n:x.name,id:x._id,k:x.triggerKeyword,src:x.source,sys:x.isSystem, legacy:x.legacy, ws:x.workspaceId}))}, 1200));
const G = await login('owner.gym@relay-demo.test', (await import('./lib.mjs')).KNOWN['owner.gym@relay-demo.test']);
const HG = ws(G.j.workspaces[0].id);
const c = await call(G.token,'GET','/contacts?limit=50',undefined,HG);
console.log('gym contacts api:', c.j.total, c.j.records.map(x=>x.fullName+'|'+x.phoneNumber+'|demo='+x.isDemo).join('  ;  '));
console.log(sh(Object.keys(c.j)));
