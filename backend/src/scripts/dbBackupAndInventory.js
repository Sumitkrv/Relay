/**
 * Read-only inventory + restorable EJSON backup of the configured MongoDB database.
 *
 *   node src/scripts/dbBackupAndInventory.js              # inventory only (read-only)
 *   node src/scripts/dbBackupAndInventory.js --backup     # inventory + backup to backend/backups/mongodb
 *
 * Never prints credentials or document contents. Backups are written with
 * owner-only permissions under the git-ignored backups/ directory.
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

// Load .env regardless of whether executed from repo root or backend/
for (const p of [path.resolve(process.cwd(), '.env'), path.resolve(process.cwd(), 'backend/.env'), path.resolve(new URL('.', import.meta.url).pathname, '../../.env')]) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    break;
  }
}

const { EJSON } = mongoose.mongo.BSON;
const doBackup = process.argv.includes('--backup');

function maskedTarget(uri) {
  try {
    const u = new URL(uri);
    return `${u.protocol}//${u.hostname}`;
  } catch {
    return '<unparseable uri>';
  }
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set in backend/.env');
  const dbName = process.env.DATABASE_NAME || undefined;
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000, ...(dbName ? { dbName } : {}) });
  const db = mongoose.connection.db;
  console.log(`Target: ${maskedTarget(uri)}  database: ${db.databaseName}`);

  const collections = (await db.listCollections().toArray()).filter((c) => !c.name.startsWith('system.')).sort((a, b) => a.name.localeCompare(b.name));
  const inventory = [];
  for (const c of collections) {
    const col = db.collection(c.name);
    const [count, indexes] = await Promise.all([col.estimatedDocumentCount(), col.indexes()]);
    inventory.push({ collection: c.name, documents: count, indexes: indexes.length });
  }
  console.table(inventory);

  if (!doBackup) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.resolve(process.cwd(), 'backups/mongodb', `backup_${db.databaseName}_${stamp}`);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  let total = 0;
  for (const c of collections) {
    const col = db.collection(c.name);
    const file = path.join(dir, `${c.name}.ejson`);
    const out = fs.createWriteStream(file, { encoding: 'utf8', mode: 0o600 });
    let n = 0;
    for await (const doc of col.find({}).batchSize(500)) {
      out.write(`${EJSON.stringify(doc, { relaxed: false })}\n`);
      n += 1;
    }
    await new Promise((resolve, reject) => out.end((e) => (e ? reject(e) : resolve())));
    fs.writeFileSync(path.join(dir, `${c.name}.indexes.json`), JSON.stringify(await col.indexes()), { mode: 0o600 });
    const expected = inventory.find((i) => i.collection === c.name)?.documents;
    if (expected !== undefined && Math.abs(expected - n) > 0 && expected > 0) {
      console.warn(`  note: ${c.name} estimated ${expected}, wrote ${n}`);
    }
    total += n;
  }
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ database: db.databaseName, createdAt: new Date().toISOString(), format: 'EJSON canonical, one document per line', collections: inventory, totalDocuments: total }, null, 2), { mode: 0o600 });
  console.log(`Backup written: ${path.relative(process.cwd(), dir)} (${collections.length} collections, ${total} documents)`);
}

main()
  .catch((err) => {
    console.error(`Inventory/backup failed: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
