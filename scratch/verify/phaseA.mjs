// Phase A: READ-ONLY comparison of rendered-API values vs MongoDB for every account whose credentials are available.
import { createRequire } from 'module'; import fs from 'fs';
import { call, login, KNOWN, ws, sh } from './lib.mjs';
const require = createRequire('/Users/sumitthakur/Desktop/Relay/backend/package.json');
const mongoose = require('mongoose');
await mongoose.connect('mongodb://127.0.0.1:27017');
const db = mongoose.connection.client.db('relay_demo');
const accounts = [
  ['owner.gym@relay-demo.test', KNOWN['owner.gym@relay-demo.test']],
  ['owner.clinic@relay-demo.test', KNOWN['owner.clinic@relay-demo.test']],
  ['m2w-owner@relay-demo.test', 'DemoPass123!'],
  ['salon-owner@relay-demo.test', 'DemoPass123!'],
  ['education-owner@relay-demo.test', 'DemoPass123!'],
  ['automobile-owner@relay-demo.test', 'DemoPass123!'],
  ['business-owner@relay-demo.test', 'DemoPass123!'],
  ['admin@relay-demo.test', 'DemoPass123!'],
];
const out = [];
for (const [email, password] of accounts) {
  const L = await login(email, password);
  if (L.s !== 200) { console.log(`\n## ${email}: login ${L.s} (${L.j?.message})`); out.push({ email, login: L.s }); continue; }
  for (const w of L.j.workspaces) {
    const H = ws(w.id); const T = L.token;
    const W = new mongoose.Types.ObjectId(w.id);
    const owner = new mongoose.Types.ObjectId(L.j.user.id);
    const g = async (p) => (await call(T, 'GET', p, undefined, H)).j;
    const [c, t, q, r, cp, cv, dash, rep, bp] = await Promise.all([g('/contacts?limit=1'), g('/templates?limit=1'), g('/inbox/quick-replies'), g('/inbox/auto-reply-rules'), g('/campaigns?limit=1'), g('/inbox/conversations?limit=1'), g('/dashboard/overview'), g('/reports/overview?range=30d'), g('/settings/business')]);
    const d = async (col, f) => db.collection(col).countDocuments(f);
    const db_ = {
      contacts: await d('contacts', { workspaceId: W, isDeleted: { $ne: true }, isArchived: { $ne: true } }),
      contactsAllNotDeleted: await d('contacts', { workspaceId: W, isDeleted: { $ne: true } }),
      templates: await d('messagetemplates', { workspaceId: W, isArchived: { $ne: true } }),
      quick: await d('quickreplies', { workspaceId: W }),
      quickByOwner: await d('quickreplies', { ownerId: owner }),
      rules: await d('autoreplyrules', { workspaceId: W }),
      rulesByOwner: await d('autoreplyrules', { ownerId: owner }),
      campaigns: await d('campaigns', { workspaceId: W, isArchived: { $ne: true } }),
      conversations: await d('conversations', { workspaceId: W }),
      profile: await d('businessprofiles', { workspaceId: W }),
    };
    const api = { contacts: c?.total, templates: t?.total, quick: q?.total, rules: r?.total, campaigns: cp?.total, conversations: cv?.total, profileComplete: bp?.isComplete, profileScore: bp?.completenessScore, dashContacts: sh(dash?.contacts, 160), dashTemplates: sh(dash?.templates, 100), dashCampaigns: sh(dash?.campaigns, 100), dashInbox: sh(dash?.inbox, 100), reportKpis: sh(rep?.kpis, 200) };
    console.log(`\n## ${email} -> ${w.name} (${w.industryKey}) ws=${w.id}`);
    console.log('   API :', JSON.stringify(api));
    console.log('   DB  :', JSON.stringify(db_));
    const mism = [];
    if (api.contacts !== db_.contacts) mism.push(`contacts api=${api.contacts} db=${db_.contacts}`);
    if (api.templates !== db_.templates) mism.push(`templates api=${api.templates} db=${db_.templates}`);
    if (api.quick !== db_.quick) mism.push(`quick api=${api.quick} db(ws)=${db_.quick} db(owner)=${db_.quickByOwner}`);
    if (api.rules !== db_.rules) mism.push(`rules api=${api.rules} db(ws)=${db_.rules} db(owner)=${db_.rulesByOwner}`);
    if (api.campaigns !== db_.campaigns) mism.push(`campaigns api=${api.campaigns} db=${db_.campaigns}`);
    if (api.conversations !== db_.conversations) mism.push(`conversations api=${api.conversations} db=${db_.conversations}`);
    console.log('   MISMATCH:', mism.length ? mism.join(' | ') : 'none');
    out.push({ email, workspace: w.name, api, db: db_, mismatches: mism });
    await call(T, 'POST', '/auth/logout');
  }
}
fs.writeFileSync('scratch/verify/phaseA-results.json', JSON.stringify(out, null, 2));
await mongoose.disconnect();
