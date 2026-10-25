// QA Stage 3 — campaigns, mock dispatch, schedule, dashboard/reports vs DB. Persistent QA DB via real HTTP API.
import fs from 'node:fs';
import { call, ws, sh } from './lib.mjs';
const creds = JSON.parse(fs.readFileSync(new URL('./qa-credentials.json', import.meta.url)));
const IND = process.argv[2] || 'real_estate';
const A = creds.accounts[`${IND}:a`], H = ws(A.workspaceId), T = A.token;
const state = JSON.parse(fs.readFileSync(new URL('./qa-state.json', import.meta.url)));
const S = state[IND]; const out = [];
const rec = (id, ok, note='') => { out.push({id,ok,note}); console.log(`${ok?'PASS':'FAIL'}  ${id}${note?' — '+note:''}`); };
const api = (m,p,b) => call(T,m,p,b,H);
const sleep = ms => new Promise(r=>setTimeout(r,ms));
const RUN = Date.now().toString().slice(-6);
const tpl = await api('GET', `/templates/${S.templateId}`);
const vId = tpl.j.template?.currentVersionId || tpl.j.template?.versions?.[0]?._id;
rec('stage3: template + version resolved', !!vId, `tpl status ${tpl.s} versionId=${vId} localStatus=${tpl.j.template?.localStatus}`);
const me = await api('GET','/auth/me'); const biz = (me.j.user||me.j).businessName;
rec('stage3: QA user has businessName for consent matching', !!biz, `businessName=${biz}`);
const ph = n => `+9198763${RUN.slice(-3)}${String(n).padStart(2,'0')}`;
const mkC = async n => (await api('POST','/contacts',{ fullName:`QA Camp Contact ${RUN}-${n}`, phoneNumber:ph(n), email:`campc${RUN}${n}@relay-qa.test`, city:'Pune', consent:{ status:'Opted In', consentSource:'QA web form', consentPurpose:'Lead follow-up and property updates', consentedBusinessName:biz, evidenceReference:`QA-CAMP-${RUN}-${n}`, consentCapturedAt:new Date(Date.now()-3600e3).toISOString() } })).j.contact?._id;
const opted = [await mkC(1), await mkC(2)]; S.campaignContactIds = opted;
rec('stage3: two consent-evidenced contacts created', opted.every(Boolean));
const unknown = S.contactIds[2];
// create
const cr = await api('POST','/campaigns',{ name:`QA Campaign ${RUN}`, description:'QA persistent campaign', goal:'Lead follow-up', category:'Lead Follow-up', selectedTemplateId:S.templateId, selectedTemplateVersionId:vId });
rec('campaign: create draft', cr.s===201, `status ${cr.s} ${cr.s!==201?sh(cr.j):''}`);
const cid = cr.j.campaign?._id; S.campaignId = cid;
// audience: manual (2 opted-in + 1 unknown)
const au = await api('POST',`/campaigns/${cid}/audience`,{ mode:'manual', definition:{ contactIds:[...opted, unknown] } });
rec('campaign: manual audience snapshot', au.s===200, `status ${au.s} ${sh(au.j?.audience,200)}`);
const v = await api('POST',`/campaigns/${cid}/validate`,{});
const vs = v.j?.validation||{};
rec('campaign: validation flags non-consented contact', v.s===200 && (vs.counts?.missingConsent>=1 || vs.counts?.eligible===2), `status ${v.s} counts=${sh(vs.counts,260)}`);
const pv = await api('POST',`/campaigns/${cid}/preview`,{});
const firstPreview = pv.j?.records?.[0]?.preview;
rec('campaign: preview resolves variables from real contact', pv.s===200 && firstPreview && !/\{\{[^}]+\}\}/.test(firstPreview.body||''), `status ${pv.s} body=${sh(firstPreview?.body,140)}`);
rec('campaign: audience list endpoint', (await api('GET',`/campaigns/${cid}/audience`)).j.total===3);
// group audience & filters audience on a second campaign
const g = await api('POST',`/campaigns/${cid}/audience`,{ mode:'group', definition:{ groupId:S.groupId } });
rec('campaign: group audience selection', g.s===200, `status ${g.s} ${sh(g.j?.audience||g.j,160)}`);
const f = await api('POST',`/campaigns/${cid}/audience`,{ mode:'filters', definition:{ filters:{ consent:'Opted In' } } });
rec('campaign: filter audience selection', f.s===200, `status ${f.s} ${sh(f.j?.audience||f.j,160)}`);
// back to manual opted-in only
const au2 = await api('POST',`/campaigns/${cid}/audience`,{ mode:'manual', definition:{ contactIds:opted } });
const v2 = await api('POST',`/campaigns/${cid}/validate`,{});
rec('campaign: opted-in-only audience validates', v2.s===200 && v2.j?.validation?.counts?.eligible===2, `status ${v2.s} eligible=${v2.j?.validation?.counts?.eligible} campaignStatus=${v2.j?.campaign?.status} issues=${sh(v2.j?.validation?.issues,200)}`);
// schedule / reschedule / unschedule
const t1 = new Date(Date.now()+3600e3*24).toISOString(), t2 = new Date(Date.now()+3600e3*48).toISOString();
const sc = await api('POST',`/campaigns/${cid}/schedule`,{ startAt:t1, timezone:'Asia/Kolkata' });
rec('campaign: schedule future', sc.s===201 && sc.j.status==='Scheduled', `status ${sc.s} ${sc.s!==201?sh(sc.j):''}`);
const past = await api('POST',`/campaigns/${cid}/schedule`,{ startAt:new Date(Date.now()-60e3).toISOString() });
rec('campaign: past schedule rejected', past.s===400, `status ${past.s}`);
const rs = await api('POST',`/campaigns/${cid}/reschedule`,{ startAt:t2 });
rec('campaign: reschedule', rs.s===200, `status ${rs.s}`);
const un = await api('DELETE',`/campaigns/${cid}/schedule`);
rec('campaign: unschedule', un.s===200, `status ${un.s} ${un.s!==200?sh(un.j):''}`);
// mock launch
const la = await api('POST',`/campaigns/${cid}/launch`,{});
rec('campaign: mock launch accepted', la.s===201, `status ${la.s} ${la.s!==201?sh(la.j):''}`);
const exId = la.j?.execution?._id; S.executionId = exId;
let ex; for(let i=0;i<60;i++){ await sleep(500); ex=(await api('GET',`/campaigns/executions/${exId}`)).j; if(['completed','failed','cancelled','completed_with_errors'].includes(ex?.execution?.status)) break; }
rec('campaign: execution reaches terminal state', ex?.execution?.status==='completed', `status=${ex?.execution?.status} counts=${sh(ex?.counts)} progress=${ex?.progressPercentage}`);
const jobs = await api('GET',`/campaigns/executions/${exId}/jobs`);
rec('campaign: jobs simulated_success (no real send)', jobs.j.total===2 && jobs.j.records.every(r=>r.status==='simulated_success'), `total=${jobs.j.total} statuses=${sh(jobs.j.records?.map(r=>r.status))}`);
rec('campaign: execution flagged mockOnly', ex?.mockOnly===true);
// conversation/messages persisted for campaign dispatch?
const msgs = await api('GET',`/campaigns/${cid}/messages`);
rec('campaign: persisted campaign messages endpoint', msgs.s===200, `status ${msgs.s} ${sh(msgs.j,160)}`);
const an = await api('GET',`/campaigns/${cid}/analytics`);
rec('campaign: analytics endpoint', an.s===200, `status ${an.s} ${sh(an.j,200)}`);
const relaunch = await api('POST',`/campaigns/${cid}/launch`,{});
rec('campaign: re-launch of completed campaign behaves safely', [201,409,400].includes(relaunch.s), `status ${relaunch.s}`);
// pause/cancel on 2nd campaign
const c2 = await api('POST','/campaigns',{ name:`QA Campaign ${RUN} B`, goal:'Lead follow-up', category:'Lead Follow-up', selectedTemplateId:S.templateId, selectedTemplateVersionId:vId });
await api('POST',`/campaigns/${c2.j.campaign._id}/audience`,{ mode:'manual', definition:{ contactIds:opted } });
await api('POST',`/campaigns/${c2.j.campaign._id}/validate`,{});
const sc2 = await api('POST',`/campaigns/${c2.j.campaign._id}/schedule`,{ startAt:t1 });
const cn = await api('POST',`/campaigns/${c2.j.campaign._id}/cancel`,{});
rec('campaign: cancel scheduled campaign', [200,201].includes(cn.s), `status ${cn.s} ${sh(cn.j,160)}`);
S.campaign2Id = c2.j.campaign._id;
// list + stats
const ls = await api('GET','/campaigns'); const st = await api('GET','/campaigns/stats');
rec('campaigns list & stats', ls.s===200 && st.s===200, `list=${ls.j.total} stats=${sh(st.j,200)}`);
fs.writeFileSync(new URL('./qa-state.json', import.meta.url), JSON.stringify({ ...state, [IND]: { ...S, run3: RUN } }, null, 1));
fs.writeFileSync(new URL(`./qa-stage3-${IND}-results.json`, import.meta.url), JSON.stringify(out,null,1));
console.log(`\n${out.filter(x=>x.ok).length}/${out.length} pass`);
