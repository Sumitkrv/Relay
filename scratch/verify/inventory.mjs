// READ-ONLY inventory of the active DB. No writes.
import { createRequire } from 'module';
const require = createRequire('/Users/sumitthakur/Desktop/Relay/backend/package.json');
const mongoose = require('mongoose');
const uri = 'mongodb://127.0.0.1:27017';
await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
const admin = mongoose.connection.db.admin();
const dbs = await admin.listDatabases();
console.log('DATABASES:', dbs.databases.map(d => `${d.name}(${(d.sizeOnDisk/1e6).toFixed(1)}MB)`).join(', '));
console.log('serverVersion:', (await admin.serverInfo()).version);
for (const d of dbs.databases.filter(d => !['admin','local','config'].includes(d.name))) {
  const db = mongoose.connection.client.db(d.name);
  const cols = (await db.listCollections().toArray()).map(c => c.name).sort();
  console.log(`\n=== DB ${d.name}: ${cols.length} collections`);
  const rows = [];
  for (const c of cols) { const n = await db.collection(c).countDocuments(); if (n) rows.push(`${c}=${n}`); }
  console.log(rows.join('  '));
}
await mongoose.disconnect();
