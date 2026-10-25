// Live HTTP audit of the 3-business demo against the running backend + relay_demo DB.
// Usage: node scratch/final-audit.mjs   (reads scratch/.demo-passwords.json; never prints passwords)
import fs from 'node:fs';

const BASE = process.env.API || 'http://localhost:5000/api';
const pw = JSON.parse(fs.readFileSync(new URL('./.demo-passwords.json', import.meta.url)));
const BIZ = {
  m2w: { email: 'owner.m2w@relay-demo.test', name: 'M2W Realty', industry: 'real_estate' },
  gym: { email: 'owner.gym@relay-demo.test', name: 'FitZone Gym', industry: 'gym' },
  clinic: { email: 'owner.clinic@relay-demo.test', name: 'CarePlus Clinic', industry: 'clinic' },
};
const results = [];
const rec = (id, ok, note = '') => { results.push({ id, ok, note }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${note ? ' — ' + note : ''}`); };

async function call(token, ws, method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (ws) headers['x-workspace-id'] = ws;
  const r = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, body: j };
}

const S = {};
for (const [k, b] of Object.entries(BIZ)) {
  const r = await call(null, null, 'POST', '/auth/login', { email: b.email, password: pw[b.email] });
  const token = r.body?.token || r.body?.accessToken;
  rec(`login:${k}`, r.status === 200 && !!token, `status ${r.status}`);
  S[k] = { token };
  const me = await call(token, null, 'GET', '/auth/me');
  S[k].me = me.body?.user || me.body;
  const wl = await call(token, null, 'GET', '/workspaces/current');
  const w = wl.body?.workspace;
  S[k].ws = String(w?._id || '');
  rec(`workspace:${k}`, w?.name === b.name && w?.industryKey === b.industry && w?.status === 'ACTIVE' && w?.onboardingStatus === 'COMPLETED', `${w?.name}/${w?.industryKey}/${w?.onboardingStatus}`);
}
// negative login
let r = await call(null, null, 'POST', '/auth/login', { email: BIZ.gym.email, password: 'wrong-password' });
rec('login:wrong-password=401', r.status === 401, `status ${r.status}`);
r = await call(null, null, 'POST', '/auth/login', { email: 'nobody@relay-demo.test', password: 'x' });
rec('login:unknown-email=401', r.status === 401, `status ${r.status}`);
r = await call('garbage.token.value', null, 'GET', '/contacts');
rec('session:invalid-token=401', r.status === 401, `status ${r.status}`);
r = await call(null, null, 'GET', '/contacts');
rec('session:no-token=401', r.status === 401, `status ${r.status}`);
for (const path of ['/workspaces/current', '/settings/business']) {
  r = await call(S.gym.token, S.m2w.ws, 'GET', path);
  rec(`tenant:forged-workspace-header ${path} =403`, r.status === 403, `status ${r.status}`);
  r = await call(S.gym.token, '000000000000000000000000', 'GET', path);
  rec(`tenant:nonexistent-workspace-header ${path} =403`, r.status === 403, `status ${r.status}`);
  r = await call(S.gym.token, 'not-hex', 'GET', path);
  rec(`tenant:malformed-workspace-header ${path} rejected`, [400, 403].includes(r.status), `status ${r.status}`);
}
r = await call(S.gym.token, S.m2w.ws, 'GET', '/contacts?limit=100');
rec('tenant:forged-header-on-owner-scoped-API-leaks-nothing', r.status === 200 && r.body.records.length === 5 && r.body.records.every((x) => x.email.includes('relay-demo') && String(x.workspaceId) === S.gym.ws), `records=${r.body?.records?.length}`);
r = await call(S.gym.token, null, 'POST', '/settings/demo-reset');
rec('settings:demo-reset-endpoint-disabled', r.status === 403, `status ${r.status}`);

fs.writeFileSync(new URL('./audit-session.json', import.meta.url), JSON.stringify(S));
fs.writeFileSync(new URL('./audit-results-1.json', import.meta.url), JSON.stringify(results, null, 1));
console.log(`\n${results.filter((x) => x.ok).length}/${results.length} passed`);
