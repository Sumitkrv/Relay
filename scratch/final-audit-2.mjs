// Live functional + security audit (part 2). Real HTTP -> Express -> relay_demo MongoDB.
// Only creates uniquely tagged "AUDIT-<ts>" fixtures and removes only those.
import fs from 'node:fs';
const S = JSON.parse(fs.readFileSync(new URL('./audit-session.json', import.meta.url)));
const BASE = 'http://localhost:5000/api';
const TAG = `AUDIT-${Date.now().toString(36)}`;
const out = [];
const rec = (id, ok, note = '') => { out.push({ id, ok, note }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${note ? ' — ' + note : ''}`); };
const sh = (o, n = 220) => String(JSON.stringify(o)).slice(0, n);
async function c(k, method, path, body, hdr = {}) {
  const r = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + S[k].token, ...hdr }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch {}
  return { s: r.status, j };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BIZ = { m2w: 'M2W Realty', gym: 'FitZone Gym', clinic: 'CarePlus Clinic' };
const CATS = ['Welcome Message', 'Enquiry Acknowledgement', 'Customer Follow-Up', 'Visit / Appointment Reminder', 'Information Update', 'Thank You Message', 'Feedback Request'];
const RULES = { m2w: ['PRICE', 'BROCHURE', 'VISIT'], gym: ['MEMBERSHIP', 'TRIAL', 'TIMINGS'], clinic: ['APPOINTMENT', 'TIMINGS', 'LOCATION'] };
const only = process.argv[2];
const keys = only ? [only] : Object.keys(BIZ);
const snap = {};

// ---------- snapshot (for isolation checks) ----------
for (const k of Object.keys(BIZ)) {
  const ct = await c(k, 'GET', '/contacts?limit=100');
  const tp = await c(k, 'GET', '/templates?limit=100');
  snap[k] = { contacts: ct.j.records.map((x) => x._id), templates: tp.j.records.map((x) => ({ id: x._id, body: x.body })) };
}

for (const k of keys) {
  console.log(`\n===== ${BIZ[k]} =====`);
  const me = await c(k, 'GET', '/workspaces/current');
  const ws = me.j.workspace;
  rec(`${k}:workspace-resolves-own`, ws?.name === BIZ[k] && ws.timezone === 'Asia/Kolkata', `${ws?.name}/${ws?.industryKey}/${ws?.timezone}`);

  // --- seed data ---
  const ct = await c(k, 'GET', '/contacts?limit=100');
  const seeded = ct.j.records.filter((x) => x.leadSource === 'DEMO_SEED');
  rec(`${k}:5-seed-contacts`, seeded.length === 5 && seeded.every((x) => String(x.workspaceId) === String(ws._id)), `seed=${seeded.length} total=${ct.j.total}`);
  const tp = await c(k, 'GET', '/templates?limit=100');
  const names = tp.j.records.map((t) => t.name);
  rec(`${k}:7-generic-templates`, CATS.every((n) => names.includes(n)) && tp.j.total >= 7, `total=${tp.j.total}`);
  rec(`${k}:templates-no-fake-meta-approval`, tp.j.records.every((t) => t.providerStatus === 'Not Submitted'), '');
  const cp = await c(k, 'GET', '/campaigns');
  rec(`${k}:campaign-draft-exists`, cp.j.records.length >= 1, cp.j.records.map((x) => `${x.name}[${x.status}]`).join(', '));
  const ru = await c(k, 'GET', '/inbox/auto-reply-rules');
  const kws = ru.j.records.map((r) => r.triggerKeyword);
  rec(`${k}:3-demo-autoreply-rules`, RULES[k].every((w) => kws.includes(w)), kws.join(','));

  // --- contacts CRUD + validation ---
  const mk = { fullName: `${TAG} Test Person`, phoneNumber: '+12025550199', email: `${TAG.toLowerCase()}@relay-demo.test`, leadSource: 'AUDIT' };
  let r = await c(k, 'POST', '/contacts', mk);
  const newId = r.j?.contact?._id || r.j?._id;
  rec(`${k}:contact-create`, r.s === 201 && !!newId, `status ${r.s} ${r.s !== 201 ? sh(r.j) : ''}`);
  r = await c(k, 'PATCH', `/contacts/${newId}`, { notes: 'edited by audit' });
  rec(`${k}:contact-edit`, r.s === 200, `status ${r.s}`);
  r = await c(k, 'GET', `/contacts?search=${TAG}`);
  rec(`${k}:contact-search`, r.j.records?.length === 1, `found=${r.j.records?.length}`);
  r = await c(k, 'GET', `/contacts/${newId}`);
  rec(`${k}:contact-persisted-notes`, (r.j.contact || r.j).notes === 'edited by audit');
  for (const [label, body] of [
    ['empty-name', { ...mk, fullName: '', phoneNumber: '+12025550198' }],
    ['invalid-email', { ...mk, email: 'not-an-email', phoneNumber: '+12025550197' }],
    ['malformed-phone', { fullName: `${TAG} bad`, phoneNumber: 'abc' }],
    ['oversized-name', { fullName: 'A'.repeat(5000), phoneNumber: '+12025550196' }],
    ['nosql-operator-name', { fullName: { $gt: '' }, phoneNumber: '+12025550195' }],
    ['wrong-type-phone', { fullName: `${TAG} t`, phoneNumber: { $ne: null } }],
  ]) {
    r = await c(k, 'POST', '/contacts', body);
    rec(`${k}:contact-validation:${label}`, r.s >= 400 && r.s < 500, `status ${r.s} ${r.j?.message || ''}`.slice(0, 120));
  }
  r = await c(k, 'POST', '/contacts', mk);
  rec(`${k}:contact-duplicate-blocked`, r.s === 409 || r.s === 400, `status ${r.s}`);
  r = await c(k, 'GET', '/contacts/not-an-id');
  rec(`${k}:contact-invalid-id`, r.s === 400 || r.s === 404, `status ${r.s}`);
  r = await c(k, 'POST', '/contacts', { fullName: `${TAG} mass`, phoneNumber: '+12025550194', workspaceId: ws._id === snap[k] ? '' : '000000000000000000000001', ownerId: '000000000000000000000001' });
  const massId = r.j?.contact?._id;
  if (massId) { const g = await c(k, 'GET', `/contacts/${massId}`); const ct2 = g.j.contact || g.j; rec(`${k}:contact-ignores-forged-owner/workspace`, String(ct2.workspaceId) === String(ws._id) && ct2.ownerId !== '000000000000000000000001'); await c(k, 'DELETE', `/contacts/${massId}`); }
  else rec(`${k}:contact-ignores-forged-owner/workspace`, r.s >= 400, `rejected ${r.s}`);

  // --- templates ---
  const t0 = tp.j.records.find((t) => t.name === 'Welcome Message');
  const origBody = t0.body;
  r = await c(k, 'POST', `/templates/${t0._id}/preview`, { contactId: seeded[0]._id });
  const prev = sh(r.j, 600);
  rec(`${k}:template-preview-uses-business-name`, r.s === 200 && prev.includes(BIZ[k].split(' ')[0]), `status ${r.s}`);
  rec(`${k}:template-preview-no-other-business`, !Object.entries(BIZ).filter(([x]) => x !== k).some(([, n]) => prev.includes(n)));
  r = await c(k, 'PATCH', `/templates/${t0._id}`, { body: origBody + ' [audit-edit]' });
  rec(`${k}:template-edit`, r.s === 200, `status ${r.s} ${r.s !== 200 ? sh(r.j) : ''}`);
  r = await c(k, 'GET', `/templates/${t0._id}`);
  rec(`${k}:template-edit-persisted`, sh(r.j, 3000).includes('[audit-edit]'));
  await c(k, 'PATCH', `/templates/${t0._id}`, { body: origBody }); // restore
  r = await c(k, 'POST', '/templates', { name: `${TAG} Draft`, category: 'Utility', body: 'Hi {{customer_name}} from {{business_name}}' , language: 'en' });
  const newT = r.j?.template?._id || r.j?._id;
  rec(`${k}:template-create-draft`, r.s === 201 && !!newT, `status ${r.s} ${r.s !== 201 ? sh(r.j) : ''}`);
  r = await c(k, 'POST', '/templates', { name: `${TAG} Bad`, category: 'Utility', body: 'Hi {{__proto__}} {{constructor.constructor("x")()}}', language: 'en' });
  rec(`${k}:template-malicious-expression-rejected-or-inert`, r.s >= 400 || !sh(r.j, 2000).includes('constructor.constructor("x")()}}"') , `status ${r.s}`);
  const badId = r.j?.template?._id; if (badId) await c(k, 'POST', `/templates/${badId}/archive`);
  if (newT) { r = await c(k, 'POST', `/templates/${newT}/archive`); rec(`${k}:template-archive-test-draft`, r.s === 200, `status ${r.s}`); }
  const tp2 = await c(k, 'GET', '/templates?limit=100');
  rec(`${k}:original-7-templates-intact`, CATS.every((n) => tp2.j.records.some((t) => t.name === n)));

  // cleanup contact
  r = await c(k, 'DELETE', `/contacts/${newId}`);
  rec(`${k}:contact-delete-test-contact`, r.s === 200 || r.s === 204, `status ${r.s}`);
  r = await c(k, 'GET', '/contacts?limit=100');
  rec(`${k}:seed-contacts-untouched`, snap[k].contacts.every((id) => r.j.records.some((x) => x._id === id)), `total=${r.j.total}`);
}

// ---------- cross-tenant matrix ----------
console.log('\n===== CROSS-TENANT MATRIX =====');
const pairs = [['gym', 'm2w'], ['clinic', 'gym'], ['m2w', 'clinic']];
for (const [attacker, victim] of pairs) {
  const vC = snap[victim].contacts[0];
  const vT = snap[victim].templates[0];
  const vCamp = (await c(victim, 'GET', '/campaigns')).j.records[0];
  const vRule = (await c(victim, 'GET', '/inbox/auto-reply-rules')).j.records[0];
  const tag = `${attacker}->${victim}`;
  let r = await c(attacker, 'GET', `/contacts/${vC}`); rec(`xt:${tag}:read-contact`, r.s === 404 || r.s === 403, `status ${r.s}`);
  r = await c(attacker, 'PATCH', `/contacts/${vC}`, { notes: 'HACKED' }); rec(`xt:${tag}:write-contact`, r.s === 404 || r.s === 403, `status ${r.s}`);
  r = await c(attacker, 'GET', `/templates/${vT.id}`); rec(`xt:${tag}:read-template`, r.s === 404 || r.s === 403, `status ${r.s}`);
  r = await c(attacker, 'PATCH', `/templates/${vT.id}`, { body: 'HACKED' }); rec(`xt:${tag}:write-template`, r.s === 404 || r.s === 403, `status ${r.s}`);
  r = await c(attacker, 'GET', `/campaigns/${vCamp._id}`); rec(`xt:${tag}:read-campaign`, r.s === 404 || r.s === 403, `status ${r.s}`);
  r = await c(attacker, 'POST', `/campaigns/${vCamp._id}/launch`, {}); rec(`xt:${tag}:launch-foreign-campaign`, r.s === 404 || r.s === 403, `status ${r.s}`);
  r = await c(attacker, 'PATCH', `/inbox/auto-reply-rules/${vRule._id}`, { enabled: false }); rec(`xt:${tag}:write-rule`, r.s === 404 || r.s === 403, `status ${r.s}`);
  r = await c(attacker, 'POST', `/inbox/auto-reply-rules/${vRule._id}/deactivate`); rec(`xt:${tag}:deactivate-rule`, r.s === 404 || r.s === 403, `status ${r.s}`);
  r = await c(attacker, 'POST', '/inbox/conversations', { contactId: vC }); rec(`xt:${tag}:conversation-for-foreign-contact`, r.s >= 400 && r.s < 500, `status ${r.s}`);
  r = await c(attacker, 'GET', '/workspaces/current', null, { 'x-workspace-id': (await c(victim, 'GET', '/workspaces/current')).j.workspace._id }); rec(`xt:${tag}:forged-workspace-header-on-workspace-api`, r.s === 403, `status ${r.s}`);
  r = await c(attacker, 'GET', '/contacts?limit=100', null, { 'x-workspace-id': (await c(victim, 'GET', '/workspaces/current')).j.workspace._id });
  rec(`xt:${tag}:forged-header-returns-no-victim-contacts`, r.s === 200 && !r.j.records.some((x) => x._id === vC), `status ${r.s}`);
  r = await c(attacker, 'POST', `/campaigns/${(await c(attacker, 'GET', '/campaigns')).j.records[0]._id}/audience`, { contactIds: [vC] }); rec(`xt:${tag}:foreign-contact-in-own-campaign-audience`, r.s >= 400 && r.s < 500, `status ${r.s} ${sh(r.j, 100)}`);
  r = await c(attacker, 'GET', `/templates/${vT.id}/campaigns`); rec(`xt:${tag}:template-campaign-listing`, r.s === 404 || r.s === 403 || (r.s === 200 && (r.j.records || []).length === 0), `status ${r.s}`);
}
// victim data unchanged
for (const k of Object.keys(BIZ)) {
  const t = await c(k, 'GET', '/templates?limit=100');
  const same = snap[k].templates.every((o) => t.j.records.find((x) => x._id === o.id)?.body === o.body);
  rec(`xt:${k}:templates-bodies-unchanged-after-attacks`, same);
  const ct = await c(k, 'GET', '/contacts?limit=100');
  rec(`xt:${k}:no-HACKED-notes`, !ct.j.records.some((x) => x.notes === 'HACKED'));
}
fs.writeFileSync(new URL(`./audit-results-2${only ? '-' + only : ''}.json`, import.meta.url), JSON.stringify(out, null, 1));
console.log(`\n${out.filter((x) => x.ok).length}/${out.length} passed; failures:`);
out.filter((x) => !x.ok).forEach((x) => console.log(' -', x.id, x.note));
