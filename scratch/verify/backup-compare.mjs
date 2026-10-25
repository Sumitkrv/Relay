import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'module';
const require = createRequire('/Users/sumitthakur/Desktop/Relay/backend/package.json');
const { MongoClient } = require('mongodb');
const dir = '/Users/sumitthakur/Desktop/Relay/backend/backups/mongodb/backup_relay_demo_2026-10-25T04-03-49-288Z';
const cli = await MongoClient.connect('mongodb://127.0.0.1:27017'); const db = cli.db('relay_demo');
const live = {}; for (const c of await db.listCollections().toArray()) live[c.name] = await db.collection(c.name).countDocuments();
let b = 0, l = 0, parsed = 0; const diffs = [];
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.ejson'))) {
  const name = f.replace(/\.ejson$/, ''); const raw = fs.readFileSync(path.join(dir, f), 'utf8').trim();
  let n; try { const j = JSON.parse(raw || '[]'); n = Array.isArray(j) ? j.length : (j.documents?.length ?? 0); parsed++; } catch { n = raw ? raw.split('\n').length : 0; }
  b += n; l += live[name] || 0; if (n !== (live[name] || 0)) diffs.push([name, n, live[name] ?? 'absent']);
}
console.log('ejson files parsed', parsed, '| backup docs', b, '| live docs same collections', l, '| live total', Object.values(live).reduce((x,y)=>x+y,0));
console.log('differences (collection, backup, live):', JSON.stringify(diffs));
await cli.close();
