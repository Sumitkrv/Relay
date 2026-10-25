import fs from 'node:fs';
import { call, ws, sh } from './lib.mjs';
const creds = JSON.parse(fs.readFileSync(new URL('./qa-credentials.json', import.meta.url)));
const A = creds.accounts['real_estate:a'], H = ws(A.workspaceId), T = A.token;
const S = JSON.parse(fs.readFileSync(new URL('./qa-state.json', import.meta.url))).real_estate;
for (const id of S.contactIds) { const r = await call(T,'GET',`/contacts/${id}`,undefined,H); const c=r.j.contact||r.j; console.log(id, c.fullName, c.whatsappConsentStatus, 'suppressed=',c.isSuppressed, 'archived=',c.isArchived); const e = await call(T,'GET',`/contacts/${id}/eligibility`,undefined,H); console.log('  elig', sh(e.j,300)); }
const jobs = await call(T,'GET',`/campaigns/executions/${S.executionId}/jobs`,undefined,H);
console.log(sh(jobs.j.records.map(r=>({s:r.status,e:r.error,v:r.validationStatus})),400));
