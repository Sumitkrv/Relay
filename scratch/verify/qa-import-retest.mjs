import fs from 'node:fs';
import { call, ws, sh } from './lib.mjs';
const creds = JSON.parse(fs.readFileSync(new URL('./qa-credentials.json', import.meta.url)));
const IND = process.argv[2] || 'real_estate';
const A = creds.accounts[`${IND}:a`], H = ws(A.workspaceId), T = A.token;
const api = (m, p, b) => call(T, m, p, b, H);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const RUN = Date.now().toString().slice(-6);
const out = [];
const rec = (id, ok, note='') => { out.push({id,ok,note}); console.log(`${ok?'PASS':'FAIL'}  ${id}${note?' — '+note:''}`); };
const ph = n => `+9198764${RUN.slice(-3)}${String(n).padStart(2,'0')}`;
const rows = ['Full Name,Phone,Email,City', `QA Imp2 ${RUN} A,${ph(20)},a${RUN}@relay-qa.test,Pune`, `QA Imp2 ${RUN} B,${ph(21)},b${RUN}@relay-qa.test,Delhi`, `Bad Row,12,,`].join('\n');
const run = async (csv, name) => {
  const fd = new FormData(); fd.append('file', new Blob([csv], {type:'text/csv'}), name);
  const up = await fetch((process.env.RELAY_API||'http://localhost:5000/api')+'/imports/upload',{method:'POST',headers:{Authorization:'Bearer '+T,...H},body:fd});
  const upj = await up.json(); const id = upj.job?._id;
  const v = await api('POST', `/imports/${id}/validate`, {});
  const ex = await api('POST', `/imports/${id}/execute`, {});
  let job; for (let i=0;i<40;i++){ await sleep(400); job=(await api('GET',`/imports/${id}/status`)).j.job; if(['Completed','Completed With Errors','Failed'].includes(job.status)) break; }
  return { up, upj, id, v, ex, job };
};
const r1 = await run(rows, `qa-imp2-${RUN}.csv`);
rec('import job stamped with workspaceId', String(r1.upj.job.workspaceId)===String(A.workspaceId), `job.workspaceId=${r1.upj.job.workspaceId}`);
rec('import completes', ['Completed','Completed With Errors'].includes(r1.job.status), `status=${r1.job.status} created=${r1.job.createdCount} skipped=${r1.job.skippedCount}`);
const list = await api('GET', `/contacts?search=${encodeURIComponent('QA Imp2 '+RUN)}&limit=50`);
rec('imported contacts visible in Contacts list', list.j.total===2, `visible=${list.j.total}`);
const stats = await api('GET','/contacts/stats');
rec('contacts stats endpoint responds', stats.s===200, sh(stats.j,200));
const hist = await api('GET','/imports/history');
rec('import appears in workspace history', (hist.j.jobs||[]).some(j=>String(j._id)===r1.id), `jobs=${hist.j.total}`);
// duplicate import (same phones) must be skipped
const r2 = await run(rows.replace(/QA Imp2/g,'QA Imp2dup'), `qa-imp2dup-${RUN}.csv`);
const list2 = await api('GET', `/contacts?search=${encodeURIComponent('QA Imp2dup '+RUN)}&limit=50`);
rec('re-import of same phones creates no duplicates', list2.j.total===0, `dupVisible=${list2.j.total} skipped=${r2.job.skippedCount} status=${r2.job.status}`);
const all = await api('GET', `/contacts?search=${encodeURIComponent(RUN)}&limit=50`);
rec('phone uniqueness: exactly 2 contacts for the run', all.j.total===2, `total=${all.j.total}`);
// cross-workspace: other-industry account cannot read the job
const B = creds.accounts['gym:a'];
if (B) { const x = await call(B.token,'GET',`/imports/${r1.id}/status`,undefined,ws(B.workspaceId)); rec('other workspace cannot read import job', x.s===404, `status ${x.s}`); }
fs.writeFileSync(new URL('./qa-import-retest-results.json', import.meta.url), JSON.stringify(out,null,1));
