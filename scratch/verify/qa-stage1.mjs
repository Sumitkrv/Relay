// QA Stage 1 — real signup -> verify -> onboarding -> starter provisioning for every industry (persistent QA DB).
// Idempotent: re-running reuses existing QA accounts. Credentials live only in scratch/verify/qa-credentials.json (0600).
import fs from 'node:fs';
import crypto from 'node:crypto';
import { call, login, ws, sh } from './lib.mjs';

const CRED = new URL('./qa-credentials.json', import.meta.url).pathname;
const creds = fs.existsSync(CRED) ? JSON.parse(fs.readFileSync(CRED)) : { password: 'Qa!' + crypto.randomBytes(9).toString('hex'), accounts: {} };
const INDUSTRIES = ['real_estate', 'gym', 'clinic', 'education', 'salon', 'automobile', 'travel_tourism', 'restaurant_food', 'professional_services', 'generic_business', 'ecommerce_retail', 'home_services', 'hospitality'];
const out = [];
const rec = (id, ok, note = '') => { out.push({ id, ok, note }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${note ? ' — ' + note : ''}`); };

export async function ensureAccount(industry, suffix = 'a') {
  const key = `${industry}:${suffix}`;
  const email = `qa-${industry.replace(/_/g, '-')}-${suffix}@relay-qa.test`;
  const name = `QA ${industry} ${suffix}`;
  const bizName = `QA ${industry.replace(/_/g, ' ')} ${suffix.toUpperCase()} Co`;
  let L;
  const cached = creds.accounts[key];
  if (cached?.token) {
    const me = await call(cached.token, 'GET', '/auth/me');
    if (me.s === 200) L = { s: 200, token: cached.token, j: { workspaces: me.j.workspaces } };
  }
  if (!L) {
    if (!cached) {
      const reg = await call(null, 'POST', '/auth/register', { name, email, password: creds.password, confirmPassword: creds.password });
      if (![200, 201, 409].includes(reg.s)) return { error: `register ${reg.s} ${sh(reg.j)}` };
    }
    L = await login(email, creds.password);
    if (L.s !== 200) return { error: `login ${L.s} ${sh(L.j)}` };
  }
  let workspaceId = L.j.workspaces?.[0]?.id;
  let provisioned = null;
  if (!workspaceId) {
    const d = await call(L.token, 'PUT', '/onboarding/draft', {
      businessIdentity: { name: bizName, email: `hello+${industry}${suffix}@relay-qa.test`, phone: '+919811223344', description: 'Persistent QA workspace' },
      industryKey: industry,
      businessDetails: { city: 'Bengaluru', state: 'Karnataka', country: 'India', timezone: 'Asia/Kolkata' },
    });
    if (d.s !== 200) return { error: `draft ${d.s} ${sh(d.j)}` };
    const c = await call(L.token, 'POST', '/onboarding/complete');
    if (![200, 201].includes(c.s)) return { error: `complete ${c.s} ${sh(c.j)}` };
    provisioned = c.j; workspaceId = c.j.workspace._id || c.j.workspace.id;
  }
  creds.accounts[key] = { email, workspaceId, token: L.token };
  fs.writeFileSync(CRED, JSON.stringify(creds, null, 1), { mode: 0o600 });
  return { email, token: L.token, workspaceId, provisioned };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const ind of INDUSTRIES) {
    const a = await ensureAccount(ind);
    if (a.error) { rec(`${ind}:signup+onboarding`, false, a.error); continue; }
    const H = ws(a.workspaceId);
    const cur = await call(a.token, 'GET', '/workspaces/current', undefined, H);
    const [t, q, r, c, ct, cp, bp, ds] = await Promise.all(['/templates?limit=1', '/inbox/quick-replies', '/inbox/auto-reply-rules', '/campaigns?limit=1', '/contacts?limit=1', '/campaigns?limit=1', '/settings/business', '/dashboard/overview'].map(p => call(a.token, 'GET', p, undefined, H)));
    const okIndustry = cur.j?.workspace?.industryKey === ind;
    rec(`${ind}:workspace resolves to ${ind}`, okIndustry, `industryKey=${cur.j?.workspace?.industryKey}`);
    rec(`${ind}:starter templates=15`, t.j?.total === 15, `templates=${t.j?.total}`);
    rec(`${ind}:starter quick replies>=8`, (q.j?.total ?? 0) >= 8, `quick=${q.j?.total}`);
    rec(`${ind}:starter auto-reply rules (incl. protected STOP)>=6`, (r.j?.total ?? 0) >= 6, `rules=${r.j?.total}`);
    rec(`${ind}:zero fabricated contacts`, ct.j?.total === 0, `contacts=${ct.j?.total}`);
    rec(`${ind}:business profile persisted`, !!bp.j?.businessProfile, `score=${bp.j?.completenessScore}`);
    rec(`${ind}:dashboard overview contexts`, ds.s === 200 && ds.j?.templates?.total === 15, `dashTemplates=${ds.j?.templates?.total}`);
  }
  fs.writeFileSync(new URL('./qa-stage1-results.json', import.meta.url).pathname, JSON.stringify(out, null, 1));
  const fails = out.filter(o => !o.ok);
  console.log(`\nSTAGE 1: ${out.length - fails.length}/${out.length} passed`);
}
