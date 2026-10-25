// READ-ONLY: offline bcrypt check of known demo passwords against stored hashes (no logins, no writes).
import { createRequire } from 'module';
const require = createRequire('/Users/sumitthakur/Desktop/Relay/backend/package.json');
const mongoose = require('mongoose'); const bcrypt = require('bcryptjs');
await mongoose.connect('mongodb://127.0.0.1:27017', { serverSelectionTimeoutMS: 5000 });
const dbName = process.argv[2] || 'relay_demo';
const db = mongoose.connection.client.db(dbName);
const users = await db.collection('users').find({}).toArray();
const mem = await db.collection('workspacememberships').find({}).toArray();
const ws = Object.fromEntries((await db.collection('workspaces').find({}).toArray()).map(w=>[String(w._id),w.name]));
for (const u of users) {
  let hit = null;
  for (const p of ['password123','DemoPass123!','DemoPass123','Password123!','admin123','test1234']) if (u.passwordHash && await bcrypt.compare(p, u.passwordHash)) { hit = p; break; }
  const w = mem.filter(m=>String(m.userId)===String(u._id)).map(m=>ws[String(m.workspaceId)]).join('; ');
  console.log(`${u.email.padEnd(46)} platformAdmin=${String(!!u.isPlatformAdmin).padEnd(5)} knownDemoPassword=${hit ? 'YES('+hit+')' : 'no '} -> ${w||'(no workspace)'}`);
}
await mongoose.disconnect();
