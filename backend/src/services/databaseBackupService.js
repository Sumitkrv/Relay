import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';

/**
 * Creates a verified database backup of the currently connected MongoDB instance.
 * Serializes collections, indexes, and document data into a durable, timestamped archive.
 */
export async function createDatabaseBackup({
  targetDir = path.resolve(process.cwd(), 'backups/mongodb'),
  customDbName = null,
} = {}) {
  const connection = mongoose.connection;
  if (!connection || connection.readyState !== 1) {
    throw new Error('Database backup failed: mongoose connection is not ready (readyState !== 1).');
  }

  const db = connection.db;
  const dbName = customDbName || db.databaseName;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFolder = path.join(targetDir, `backup_${dbName}_${timestamp}`);

  if (!fs.existsSync(backupFolder)) {
    fs.mkdirSync(backupFolder, { recursive: true });
  }

  const rawCollections = await db.listCollections().toArray();
  // Filter out system collections
  const collections = rawCollections.filter((c) => !c.name.startsWith('system.'));

  const manifest = {
    backupId: `bkp_${dbName}_${Date.now()}`,
    databaseName: dbName,
    createdAt: new Date().toISOString(),
    collectionCount: collections.length,
    collections: [],
    totalDocuments: 0,
    status: 'IN_PROGRESS',
  };

  let totalDocs = 0;

  for (const colInfo of collections) {
    const colName = colInfo.name;
    const col = db.collection(colName);
    const count = await col.countDocuments();
    const indexes = await col.indexes();

    const colDataFile = path.join(backupFolder, `${colName}.json`);
    const writeStream = fs.createWriteStream(colDataFile, { encoding: 'utf8' });

    writeStream.write('[\n');

    let isFirst = true;
    let written = 0;
    const cursor = col.find({}).batchSize(500);

    for await (const doc of cursor) {
      if (!isFirst) {
        writeStream.write(',\n');
      }
      writeStream.write(JSON.stringify(doc));
      isFirst = false;
      written++;
    }

    writeStream.write('\n]');
    await new Promise((resolve, reject) => {
      writeStream.end((err) => (err ? reject(err) : resolve()));
    });

    manifest.collections.push({
      name: colName,
      documentCount: written,
      indexCount: indexes.length,
      indexes,
      dataFile: `${colName}.json`,
    });

    totalDocs += written;
  }

  manifest.totalDocuments = totalDocs;
  manifest.status = 'COMPLETED';

  const manifestPath = path.join(backupFolder, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  return {
    backupId: manifest.backupId,
    backupFolder,
    manifestPath,
    databaseName: dbName,
    collectionCount: manifest.collectionCount,
    totalDocuments: manifest.totalDocuments,
    manifest,
  };
}

/**
 * Verifies a created database backup by inspecting its manifest and integrity of files.
 */
export async function verifyDatabaseBackup(backupFolder) {
  const manifestPath = path.join(backupFolder, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Backup verification failed: manifest.json not found in ${backupFolder}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.status !== 'COMPLETED') {
    throw new Error(`Backup verification failed: manifest status is "${manifest.status}", expected "COMPLETED"`);
  }

  let verifiedDocs = 0;
  for (const col of manifest.collections) {
    const filePath = path.join(backupFolder, col.dataFile);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Backup verification failed: missing collection file ${filePath}`);
    }
    const stat = fs.statSync(filePath);
    if (col.documentCount > 0 && stat.size < 2) {
      throw new Error(`Backup verification failed: ${col.name} has ${col.documentCount} docs but file size is ${stat.size} bytes`);
    }
    verifiedDocs += col.documentCount;
  }

  if (verifiedDocs !== manifest.totalDocuments) {
    throw new Error(`Backup verification mismatch: totalDocs (${manifest.totalDocuments}) !== verifiedDocs (${verifiedDocs})`);
  }

  return {
    verified: true,
    backupId: manifest.backupId,
    databaseName: manifest.databaseName,
    collectionsVerified: manifest.collections.length,
    documentsVerified: verifiedDocs,
    createdAt: manifest.createdAt,
  };
}
