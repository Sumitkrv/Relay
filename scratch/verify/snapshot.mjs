// READ-ONLY fingerprint of business collections (count + sha256 over _id|updatedAt). Usage: node snapshot.mjs <db> <outfile>
import { createRequire } from 'module'; import crypto from 'crypto'; import fs from 'fs';
const require = createRequire('/Users/sumitthakur/Desktop/Relay/backend/package.json');
const mongoose = require('mongoose'); await mongoose.connect('mongodb://127.0.0.1:27017');
const [dbName, out] = [process.argv[2], process.argv[3]];
const db = mongoose.connection.client.db(dbName);
const SKIP = new Set(['authsessions','securityauditlogs','authtokens','workspacesubscriptions']);
const snap = {};
for (const c of (await db.listCollections().toArray()).map(c=>c.name).sort()) {
  if (SKIP.has(c) || c.startsWith('system.')) continue;
  const docs = await db.collection(c).find({}, {projection:{_id:1,updatedAt:1}}).sort({_id:1}).toArray();
  if (!docs.length) continue;
  snap[c] = { n: docs.length, sha: crypto.createHash('sha256').update(docs.map(d=>`${d._id}|${d.updatedAt?.toISOString?.()||''}`).join('\n')).digest('hex').slice(0,16) };
}
fs.writeFileSync(out, JSON.stringify(snap,null,1)); console.log(dbName, 'collections fingerprinted:', Object.keys(snap).length, 'docs:', Object.values(snap).reduce((a,b)=>a+b.n,0));
await mongoose.disconnect();
