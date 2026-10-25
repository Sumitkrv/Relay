import { call, login, ws } from './lib.mjs';
const adm = await login('admin@relay-demo.test','DemoPass123!');
for (const p of ['/admin/overview','/admin/workspaces','/admin/users','/admin/audit-logs']) { const r = await call(adm.token,'GET',p); console.log(p, r.s, r.j?.code||''); }
const wsList = adm.j.workspaces; console.log('demo admin own workspace still usable:', (await call(adm.token,'GET','/contacts?limit=1',undefined,ws(wsList[0].id))).s);
