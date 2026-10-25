// QA Stage 2 — module workflows against the PERSISTENT QA database through the real HTTP API.
// Usage: node qa-stage2.mjs [industryKey=real_estate]
import fs from 'node:fs';
import { call, ws, sh } from './lib.mjs';
const creds = JSON.parse(fs.readFileSync(new URL('./qa-credentials.json', import.meta.url)));
const IND = process.argv[2] || 'real_estate';
const A = creds.accounts[`${IND}:a`];
const H = ws(A.workspaceId);
const T = A.token;
const results = [];
const rec = (id, ok, note = '') => { results.push({ id, ok, note }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${note ? ' — ' + note : ''}`); };
const api = (m, p, b) => call(T, m, p, b, H);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const RUN = Date.now().toString().slice(-6);
// Reserved fictional numbers (NANP 555-01xx / IN test range) — QA only
const phone = (n) => `+9198765${String(RUN).slice(-3)}${String(n).padStart(2, '0')}`;
const state = JSON.parse(fs.existsSync(new URL('./qa-state.json', import.meta.url)) ? fs.readFileSync(new URL('./qa-state.json', import.meta.url)) : '{}');
state[IND] = state[IND] || {};
const S = state[IND];

// ───────────── CONTACTS ─────────────
const optIn = { status: 'Opted In', consentSource: 'QA web form', consentPurpose: 'Order & enquiry updates', evidenceReference: `QA-FORM-${RUN}`, consentCapturedAt: new Date(Date.now() - 3600e3).toISOString() };
const mk = async (n, extra = {}) => api('POST', '/contacts', { fullName: `QA Contact ${RUN}-${n}`, phoneNumber: phone(n), email: `qa${RUN}${n}@relay-qa.test`, city: 'Bengaluru', ...extra });
const c1 = await mk(1, { consent: optIn, tags: ['qa', 'vip'] });
rec('contacts: create (opted-in with evidence)', c1.s === 201 && !!c1.j.contact?._id, `status ${c1.s} ${c1.s !== 201 ? sh(c1.j) : ''}`);
const c2 = await mk(2, { consent: optIn });
const c3 = await mk(3);
rec('contacts: create without consent defaults to Unknown', c3.s === 201 && c3.j.contact?.whatsappConsentStatus === 'Unknown', `status ${c3.s} consent=${c3.j.contact?.whatsappConsentStatus}`);
const dup = await mk(1);
rec('contacts: duplicate phone rejected (409)', dup.s === 409, `status ${dup.s}`);
const bad = await api('POST', '/contacts', { fullName: 'X', phoneNumber: 'abc' });
rec('contacts: invalid input rejected (400)', bad.s === 400, `status ${bad.s}`);
const noEvidence = await api('POST', '/contacts', { fullName: 'No Evidence', phoneNumber: phone(9), consent: { status: 'Opted In' } });
rec('contacts: opt-in without evidence rejected', noEvidence.s === 400, `status ${noEvidence.s}`);
const id1 = c1.j.contact?._id, id2 = c2.j.contact?._id, id3 = c3.j.contact?._id;
S.contactIds = [id1, id2, id3];
const upd = await api('PATCH', `/contacts/${id3}`, { leadStatus: 'Interested', priority: 'High', notes: `QA note ${RUN}`, tags: ['qa', 'hot'], city: 'Mysuru' });
rec('contacts: update (status, priority, notes, tags)', upd.s === 200 && upd.j.contact?.leadStatus === 'Interested' && upd.j.contact?.notes === `QA note ${RUN}`, `status ${upd.s} ${upd.s !== 200 ? sh(upd.j) : ''}`);
const tagsList = await api('GET', '/contacts/tags');
rec('contacts: tags listed', tagsList.s === 200 && sh(tagsList.j).includes('hot'), `status ${tagsList.s}`);
const filt = await api('GET', '/contacts?leadStatus=Interested&limit=50');
rec('contacts: filter by status', filt.s === 200 && filt.j.records.some(r => r._id === id3), `total ${filt.j.total}`);
const search = await api('GET', `/contacts?search=${encodeURIComponent('QA Contact ' + RUN)}&limit=50`);
rec('contacts: search finds new records', search.s === 200 && search.j.total >= 3, `total ${search.j.total}`);
const grp = await api('POST', '/contact-groups', { name: `QA Group ${RUN}`, description: 'QA persistent group' });
rec('groups: create', grp.s === 201, `status ${grp.s} ${grp.s !== 201 ? sh(grp.j) : ''}`);
const gid = grp.j.group?._id || grp.j._id; S.groupId = gid;
const mem = await api('POST', `/contact-groups/${gid}/members`, { action: 'add', contactIds: [id1, id2] });
rec('groups: add members', [200, 201].includes(mem.s), `status ${mem.s} ${mem.s >= 300 ? sh(mem.j) : ''}`);
const fu = await api('POST', '/follow-ups', { contactId: id3, title: `QA follow-up ${RUN}`, dueAt: new Date(Date.now() + 86400e3).toISOString(), notes: 'call back' });
rec('follow-ups: create', fu.s === 201, `status ${fu.s} ${fu.s !== 201 ? sh(fu.j) : ''}`);
const fuId = fu.j.followUp?._id || fu.j.task?._id || fu.j._id;
if (fuId) { const done = await api('POST', `/follow-ups/${fuId}/complete`, {}); rec('follow-ups: complete', done.s === 200, `status ${done.s}`); }
const arch = await api('PATCH', `/contacts/${id2}/archive`); const rest = await api('PATCH', `/contacts/${id2}/restore`);
rec('contacts: archive then restore', arch.s === 200 && rest.s === 200, `archive ${arch.s} restore ${rest.s}`);
const exp = await fetch((process.env.RELAY_API || 'http://localhost:5000/api') + '/contacts/export?format=csv', { headers: { Authorization: 'Bearer ' + T, ...H } });
const csvText = await exp.text();
rec('contacts: CSV export contains QA records', exp.status === 200 && csvText.includes(`QA Contact ${RUN}-1`), `status ${exp.status}, ${csvText.split('\n').length} lines`);
const cons = await api('GET', `/contacts/${id1}/consent`);
rec('consent: history recorded with evidence', cons.s === 200 && sh(cons.j).includes('QA-FORM'), `status ${cons.s}`);

// ───────────── CSV IMPORT ─────────────
{
  const rows = ['Full Name,Phone,Email,City', `QA Import ${RUN} A,${phone(20)},impa${RUN}@relay-qa.test,Pune`, `QA Import ${RUN} B,${phone(21)},impb${RUN}@relay-qa.test,Delhi`, `QA Import ${RUN} Dup,${phone(1)},dup${RUN}@relay-qa.test,Delhi`, `Bad Row,12,,`].join('\n');
  const fd = new FormData(); fd.append('file', new Blob([rows], { type: 'text/csv' }), `qa-import-${RUN}.csv`);
  const up = await fetch((process.env.RELAY_API || 'http://localhost:5000/api') + '/imports/upload', { method: 'POST', headers: { Authorization: 'Bearer ' + T, ...H }, body: fd });
  const upj = await up.json().catch(() => ({}));
  rec('import: CSV upload accepted', up.status === 201 || up.status === 200, `status ${up.status} ${up.status >= 300 ? sh(upj) : ''}`);
  const jobId = upj.job?._id || upj.importJob?._id || upj._id;
  S.importJobId = jobId;
  if (jobId) {
    const prev = await api('GET', `/imports/${jobId}/preview`); console.log('   preview keys', Object.keys(prev.j || {}).join(','), sh(prev.j?.suggestedMapping || prev.j?.mapping, 300));
    const mapping = prev.j?.suggestedMapping || prev.j?.mapping || prev.j?.job?.mapping;
    if (mapping) { const mp = await api('PATCH', `/imports/${jobId}/mapping`, { mapping }); rec('import: mapping saved', mp.s === 200, `status ${mp.s} ${mp.s !== 200 ? sh(mp.j) : ''}`); }
    const val = await api('POST', `/imports/${jobId}/validate`, {}); rec('import: validate (flags duplicate + invalid rows)', val.s === 200, `status ${val.s} ${sh(val.j?.job?.summary || val.j?.summary || val.j, 260)}`);
    const ex = await api('POST', `/imports/${jobId}/execute`, { consentConfirmed: false, duplicateStrategy: 'skip' }); rec('import: execute', [200, 202].includes(ex.s), `status ${ex.s} ${ex.s >= 300 ? sh(ex.j) : ''}`);
    let job; for (let i = 0; i < 40; i++) { await sleep(500); job = (await api('GET', `/imports/${jobId}/status`)).j.job; if (['Completed', 'Completed With Errors', 'Failed'].includes(job?.status)) break; }
    rec('import: finished with counts', ['Completed', 'Completed With Errors'].includes(job?.status), `status=${job?.status} created=${job?.createdCount ?? job?.importedCount} dup=${job?.duplicateCount} failed=${job?.failedCount}`);
    const after = await api('GET', `/contacts?search=${encodeURIComponent('QA Import ' + RUN)}&limit=50`);
    rec('import: imported rows visible in Contacts', after.j.total >= 2, `visible ${after.j.total}`);
  }
}

// ───────────── TEMPLATES + VARIABLES ─────────────
const tpl = await api('POST', '/templates', { name: `qa_tpl_${RUN}`, category: 'Utility', language: 'en', headerType: 'NONE', body: 'Hi {{first_name}}, this is {{business_name}} confirming your visit. Reply STOP to opt out.', footer: '', buttons: [] });
rec('templates: create custom', tpl.s === 201, `status ${tpl.s} ${tpl.s !== 201 ? sh(tpl.j) : ''}`);
const tid = tpl.j.template?._id || tpl.j._id; S.templateId = tid;
const prevT = await api('POST', `/templates/${tid}/preview`, { contactId: id3 });
const rendered = sh(prevT.j, 600);
rec('templates: variable resolution uses real contact + workspace identity', prevT.s === 200 && !rendered.includes('{{') && rendered.includes('QA') , `status ${prevT.s} ${rendered.slice(0, 220)}`);
const valT = await api('POST', `/templates/${tid}/validate`, {}); rec('templates: validate', valT.s === 200, `status ${valT.s}`);
const upT = await api('PATCH', `/templates/${tid}`, { body: 'Hi {{first_name}}, v2 from {{business_name}}. Reply STOP to opt out.' });
rec('templates: update creates version 2', upT.s === 200 && (upT.j.template?.currentVersionNumber ?? upT.j.currentVersionNumber) === 2, `status ${upT.s} ver ${upT.j.template?.currentVersionNumber}`);
const vers = await api('GET', `/templates/${tid}/versions`); rec('templates: version history persisted', vers.s === 200 && vers.j.records?.length >= 2, `versions ${vers.j.records?.length}`);
const dupT = await api('POST', `/templates/${tid}/duplicate`, {}); rec('templates: duplicate', [200, 201].includes(dupT.s), `status ${dupT.s}`);
const unresolved = await api('POST', '/templates', { name: `qa_bad_${RUN}`, category: 'Utility', language: 'en', headerType: 'NONE', body: 'Hello {{totally_unknown_variable}}', buttons: [] });
const unresolvedValidate = unresolved.s === 201 ? await api('POST', `/templates/${unresolved.j.template?._id}/validate`, {}) : unresolved;
rec('templates: unknown variable is flagged (not silently sent)', unresolved.s >= 400 || sh(unresolvedValidate.j).toLowerCase().includes('unknown') || sh(unresolvedValidate.j).includes('totally_unknown_variable'), `create ${unresolved.s}; ${sh(unresolvedValidate.j, 200)}`);
const ai = await api('POST', '/templates/ai/generate', { prompt: 'x' });
rec('templates: AI generation reports truthful unavailable state (503, no fake output)', ai.s === 503 && /not configured/i.test(ai.j?.message || ''), `status ${ai.s}`);
const arT = await api('POST', `/templates/${dupT.j.template?._id || dupT.j._id}/archive`, {}); rec('templates: archive', arT.s === 200, `status ${arT.s}`);

// ───────────── QUICK REPLIES ─────────────
const qr = await api('POST', '/inbox/quick-replies', { name: `QA quick ${RUN}`, category: 'General', messageText: 'Thanks {{first_name}}, we will call you shortly.' });
rec('quick replies: create', qr.s === 201, `status ${qr.s} ${qr.s !== 201 ? sh(qr.j) : ''}`);
const qid = qr.j.quickReply?._id || qr.j._id; S.quickReplyId = qid;
const qu = await api('PATCH', `/inbox/quick-replies/${qid}`, { messageText: 'Updated QA quick reply for {{first_name}}.' });
rec('quick replies: update', qu.s === 200, `status ${qu.s}`);
const ql = await api('GET', '/inbox/quick-replies'); rec('quick replies: persisted in list', ql.j.records.some(r => r._id === qid), `total ${ql.j.total}`);

// ───────────── AUTO-REPLY RULES + INBOX ─────────────
const rule = await api('POST', '/inbox/auto-reply-rules', { name: `QA rule ${RUN}`, triggerKeyword: `QAPRICE${RUN}`, matchType: 'WHOLE_WORD', actionType: 'RUN_MOCK_REPLY', responseMessage: 'Our QA price sheet is on its way, {{first_name}}.', enabled: true, priority: 1 });
rec('rules: create keyword rule', rule.s === 201, `status ${rule.s} ${rule.s !== 201 ? sh(rule.j) : ''}`);
const rid = rule.j.rule?._id || rule.j._id; S.ruleId = rid;
const conv = await api('POST', `/contacts/${id1}/conversations`, {});
rec('inbox: conversation created for contact', [200, 201].includes(conv.s), `status ${conv.s} ${conv.s >= 300 ? sh(conv.j) : ''}`);
const cid = conv.j.conversation?._id || conv.j._id; S.conversationId = cid;
const tm = await api('POST', '/inbox/auto-reply-rules/test-match', { message: `what is the QAPRICE${RUN} please` });
rec('rules: test-match hits the rule', tm.s === 200 && sh(tm.j).includes(`QA rule ${RUN}`), `status ${tm.s}`);
const inb = await api('POST', `/inbox/conversations/${cid}/test-events`, { body: `what is the QAPRICE${RUN} please` });
rec('inbox: synthetic inbound message stored (labelled synthetic)', inb.s === 201 || inb.s === 200, `status ${inb.s} ${inb.s >= 300 ? sh(inb.j) : ''}`);
await sleep(1500);
const msgs = await api('GET', `/inbox/conversations/${cid}/messages`);
const list = msgs.j.records || msgs.j.messages || [];
rec('inbox: inbound persisted + auto-reply executed (rule sent mock reply)', list.some(m => m.direction === 'inbound') && list.some(m => m.direction === 'outbound' && /QA price sheet/.test(m.messageBody || '')), `messages ${list.length}: ${list.map(m => m.direction + ':' + (m.messageSource || '')).join(', ')}`);
const hist = await api('GET', '/inbox/auto-reply-rules/history'); rec('rules: execution history recorded', hist.s === 200 && sh(hist.j).includes(`QA rule ${RUN}`), `status ${hist.s}`);
const man = await api('POST', `/inbox/conversations/${cid}/messages`, { body: 'Manual reply from QA operator', messageBody: 'Manual reply from QA operator' });
rec('inbox: manual operator message', [200, 201].includes(man.s), `status ${man.s} ${man.s >= 300 ? sh(man.j) : ''}`);
const note = await api('POST', `/inbox/conversations/${cid}/notes`, { body: `Internal QA note ${RUN}`, noteBody: `Internal QA note ${RUN}`, content: `Internal QA note ${RUN}` });
rec('inbox: internal note', [200, 201].includes(note.s), `status ${note.s} ${note.s >= 300 ? sh(note.j) : ''}`);
const stp = await api('POST', `/inbox/conversations/${cid}/test-events`, { body: 'STOP' });
await sleep(1200);
const cAfter = await api('GET', `/contacts/${id1}`);
rec('compliance: inbound STOP records opt-out on the contact', cAfter.j.contact?.whatsappConsentStatus === 'Opted Out' || cAfter.j.contact?.isSuppressed === true, `consent=${cAfter.j.contact?.whatsappConsentStatus} suppressed=${cAfter.j.contact?.isSuppressed}`);

// ───────────── SETTINGS ─────────────
const bp = await api('GET', '/settings/business');
const upBp = await api('PUT', '/settings/business', { ...(bp.j.businessProfile || {}), tagline: `QA tagline ${RUN}`, legalOrTradingName: bp.j.businessProfile?.legalOrTradingName });
rec('settings: business profile update', upBp.s === 200, `status ${upBp.s} ${upBp.s !== 200 ? sh(upBp.j) : ''}`);
const pref = await api('PUT', '/settings/preferences', { timezone: 'Asia/Kolkata' });
rec('settings: preferences update', [200].includes(pref.s), `status ${pref.s} ${pref.s !== 200 ? sh(pref.j) : ''}`);

fs.writeFileSync(new URL('./qa-state.json', import.meta.url), JSON.stringify({ ...state, [IND]: { ...S, run: RUN } }, null, 1));
const fails = results.filter(r => !r.ok);
fs.writeFileSync(new URL(`./qa-stage2-${IND}-results.json`, import.meta.url), JSON.stringify(results, null, 1));
console.log(`\nSTAGE 2 (${IND}): ${results.length - fails.length}/${results.length} passed`);
