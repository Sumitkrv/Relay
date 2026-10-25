import { call, login, ws, sh, KNOWN } from './lib.mjs';
for (const e of ['owner.gym@relay-demo.test','gym-owner@relay-demo.test']) {
const L = await login(e, KNOWN[e] || 'DemoPass123!'); const H = ws(L.j.workspaces[0].id);
const d = (await call(L.token,'GET','/dashboard/overview',undefined,H)).j;
const c = (await call(L.token,'GET','/contacts?limit=1',undefined,H)).j;
const st = (await call(L.token,'GET','/contacts/stats',undefined,H)).j;
const t = (await call(L.token,'GET','/templates?limit=1',undefined,H)).j;
const cp = (await call(L.token,'GET','/campaigns?limit=1',undefined,H)).j;
const rp = (await call(L.token,'GET','/reports/overview?range=30d',undefined,H)).j;
console.log(e, '| list total', c.total, '| dashboard contacts.total', d.contacts?.total, '| /contacts/stats', st.stats?.totalContacts, '| templates list', t.total, 'dash', d.templates?.total, '| campaigns list', cp.total, 'dash', d.campaigns?.total, '| report totalCampaigns', rp.kpis?.totalCampaigns);
}
