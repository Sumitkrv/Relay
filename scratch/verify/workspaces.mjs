import { createRequire } from 'module';
const require = createRequire('/Users/sumitthakur/Desktop/Relay/backend/package.json');
const mongoose = require('mongoose');
await mongoose.connect('mongodb://127.0.0.1:27017', { serverSelectionTimeoutMS: 5000 });
const dbName = process.argv[2] || 'relay_demo';
const db = mongoose.connection.client.db(dbName);
const ws = await db.collection('workspaces').find({}).sort({createdAt:1}).toArray();
const users = await db.collection('users').find({}, {projection:{passwordHash:0,password:0}}).toArray();
const uById = Object.fromEntries(users.map(u=>[String(u._id),u]));
const mem = await db.collection('workspacememberships').find({}).toArray();
console.log(`DB ${dbName}: workspaces=${ws.length} users=${users.length} memberships=${mem.length}`);
const wsCols = {contacts:'contacts',templates:'messagetemplates',rules:'autoreplyrules',quick:'quickreplies',campaigns:'campaigns',convs:'conversations',convMsgs:'conversationmessages',msgs:'messages',notes:'internalnotes',profiles:'businessprofiles',followups:'followuptasks',groups:'contactgroups'};
for (const w of ws) {
  const q = { workspaceId: w._id };
  const counts = {};
  for (const [k,c] of Object.entries(wsCols)) counts[k] = await db.collection(c).countDocuments(q);
  const demoContacts = await db.collection('contacts').countDocuments({ ...q, isDemo: true });
  const owners = mem.filter(m=>String(m.workspaceId)===String(w._id)).map(m=>`${uById[String(m.userId)]?.email||'?'}[${m.role}/${m.status}]`);
  console.log(`\n- ${w._id} | ${w.name} | slug=${w.slug} | ind=${w.industryKey} | status=${w.status} | onb=${w.onboardingStatus} | created=${w.createdAt?.toISOString?.().slice(0,10)} | flags: isDemo=${w.isDemo} demo=${w.demo}`);
  console.log('   counts:', JSON.stringify(counts), 'isDemoContacts=', demoContacts);
  console.log('   members:', owners.join(', '));
}
const orphan = {};
for (const c of ['contacts','messagetemplates','autoreplyrules','quickreplies','campaigns','conversations','businessprofiles']) {
  orphan[c] = await db.collection(c).countDocuments({ $or:[{workspaceId:{$exists:false}},{workspaceId:null}] });
}
console.log('\nNo-workspaceId (orphans):', JSON.stringify(orphan));
console.log('\nUSERS:'); for (const u of users) console.log(`  ${u.email} | ${u.name||u.fullName||''} | status=${u.accountStatus||u.status} | role=${u.role||''} | verified=${u.emailVerified} | created=${u.createdAt?.toISOString?.().slice(0,10)}`);
await mongoose.disconnect();
