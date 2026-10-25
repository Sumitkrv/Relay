// Stage 5: same-industry isolation (two real_estate accounts), duplicates, cancel fix, logout/login persistence.
import fs from 'node:fs';
import { call, login, ws, sh } from './lib.mjs';
import { ensureAccount } from './qa-stage1.mjs';
const creds = () => JSON.parse(fs.readFileSync(new URL('./qa-credentials.json', import.meta.url)));
const state = JSON.parse(fs.readFileSync(new URL('./qa-state.json', import.meta.url))); const S = state.real_estate;
const out=[]; const rec=(id,ok,note='')=>{out.push({id,ok,note});console.log(`${ok?'PASS':'FAIL'}  ${id}${note?' — '+note:''}`)};
const a = await ensureAccount('real_estate','a'); const b = await ensureAccount('real_estate','b');
rec('second same-industry account provisioned', !b.error, b.error||`ws=${b.workspaceId}`);
rec('A and B have distinct workspaces', a.workspaceId!==b.workspaceId);
const HA=ws(a.workspaceId), HB=ws(b.workspaceId);
const bContacts = await call(b.token,'GET','/contacts?limit=50',undefined,HB);
rec('B starts with zero contacts (no fabricated data, no A data)', bContacts.j.total===0, `total=${bContacts.j.total}`);
const bT = await call(b.token,'GET','/templates?limit=50',undefined,HB); const aT = await call(a.token,'GET','/templates?limit=50',undefined,HA);
const aIds = new Set(aT.j.records.map(x=>x._id)); rec('B template list contains none of A templates', bT.j.records.every(x=>!aIds.has(x._id)), `A=${aT.j.total} B=${bT.j.total}`);
// B tries A's ids under both headers
const cid = S.contactIds[1];
for (const [lbl,h] of [['B workspace',HB],['A workspace header (forged)',HA]]) {
  const r = await call(b.token,'GET',`/contacts/${cid}`,undefined,h); rec(`B cannot read A contact via ${lbl}`, [403,404].includes(r.s), `status ${r.s}`);
}
const patch = await call(b.token,'PATCH',`/contacts/${cid}`,{notes:'hacked'},HB); rec('B cannot patch A contact', [403,404].includes(patch.s), `status ${patch.s}`);
const camp = await call(b.token,'GET',`/campaigns/${S.campaignId}`,undefined,HB); rec('B cannot read A campaign', [403,404].includes(camp.s), `status ${camp.s}`);
const conv = await call(b.token,'GET',`/inbox/conversations/${S.conversationId}`,undefined,HB); rec('B cannot read A conversation', [403,404].includes(conv.s), `status ${conv.s}`);
const ex = await call(b.token,'GET',`/campaigns/executions/${S.executionId}`,undefined,HB); rec('B cannot read A campaign execution', [403,404].includes(ex.s), `status ${ex.s}`);
// B can create the same phone as A's contact (separate business) but A cannot create duplicate within own workspace
const aContact = await call(a.token,'GET',`/contacts/${cid}`,undefined,HA); const phone = (aContact.j.contact||aContact.j).phoneNumber;
const bDup = await call(b.token,'POST','/contacts',{fullName:'B Same Number',phoneNumber:phone},HB); rec('same phone allowed in a different business workspace', bDup.s===201, `status ${bDup.s} ${bDup.s!==201?sh(bDup.j):''}`);
const aDup = await call(a.token,'POST','/contacts',{fullName:'A Dup',phoneNumber:phone},HA); rec('duplicate phone inside same workspace rejected', aDup.s===409, `status ${aDup.s}`);
// duplicate signup
const dupReg = await call(null,'POST','/auth/register',{name:'dup',email:a.email,password:creds().password,confirmPassword:creds().password}); rec('duplicate signup email rejected', [400,409].includes(dupReg.s), `status ${dupReg.s}`);
// campaign cancel fix: schedule + cancel new campaign, check DB-visible state through dashboard
const tpl = await call(a.token,'GET',`/templates/${S.templateId}`,undefined,HA); const vId = tpl.j.template.currentVersionId;
const nc = await call(a.token,'POST','/campaigns',{name:'QA cancel check '+Date.now().toString().slice(-5),goal:'Lead follow-up',selectedTemplateId:S.templateId,selectedTemplateVersionId:vId},HA);
const id=nc.j.campaign._id; await call(a.token,'POST',`/campaigns/${id}/audience`,{mode:'manual',definition:{contactIds:S.campaignContactIds}},HA);
await call(a.token,'POST',`/campaigns/${id}/schedule`,{startAt:new Date(Date.now()+86400e3).toISOString()},HA);
await call(a.token,'POST',`/campaigns/${id}/cancel`,{},HA);
const st = await call(a.token,'GET','/campaigns/stats',undefined,HA);
const dbRow = await call(a.token,'GET',`/campaigns/${id}`,undefined,HA);
rec('cancelled campaign no longer carries scheduled state', dbRow.j.campaign.status==='Cancelled' && dbRow.j.campaign.mockSchedule?.status==='cancelled', `status=${dbRow.j.campaign.status} mockSchedule=${sh(dbRow.j.campaign.mockSchedule)}`);
// logout / login persistence for A
const lo = await call(a.token,'POST','/auth/logout',{},HA); rec('logout', [200,204].includes(lo.s), `status ${lo.s}`);
const stale = await call(a.token,'GET','/contacts?limit=1',undefined,HA); rec('old token rejected after logout', stale.s===401, `status ${stale.s}`);
const L = await login(a.email, creds().password); rec('login again', L.s===200, `status ${L.s}`);
const c2 = creds(); c2.accounts['real_estate:a'].token = L.token; fs.writeFileSync(new URL('./qa-credentials.json', import.meta.url), JSON.stringify(c2,null,1), {mode:0o600});
const after = await call(L.token,'GET','/contacts?limit=50',undefined,HA); rec('data present after logout/login', after.j.total>=7, `contacts=${after.j.total}`);
fs.writeFileSync(new URL('./qa-stage5-results.json', import.meta.url), JSON.stringify(out,null,1));
console.log(`\n${out.filter(x=>x.ok).length}/${out.length} pass`);
