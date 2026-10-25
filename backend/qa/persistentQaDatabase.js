/**
 * QA-only preload: run the REAL backend (src/server.js) against an isolated, PERSISTENT MongoDB database.
 *
 *   QA_DATABASE_NAME=relay_demo_qa_persistent \
 *     node --import ./qa/persistentQaDatabase.js src/server.js
 *
 * Why this exists: server.js loads backend/.env.demo with override, which pins DATABASE_NAME to the
 * working demo database. QA workflows (create/update/delete/messaging/campaigns) must never touch that
 * database, but must still survive process restarts - so MongoMemoryServer is not an option.
 *
 * Guarantees:
 *  - Only database names that start with "relay_demo_qa" are accepted.
 *  - The working databases (relay_demo, freelance_automation_crm, relay_crm) are refused outright.
 *  - Everything else (auth, workers, queues, routes) is the unmodified production code path.
 */
import mongoose from 'mongoose';

const name = process.env.QA_DATABASE_NAME;
const PROTECTED = new Set(['relay_demo', 'freelance_automation_crm', 'relay_crm', 'admin', 'local', 'config']);

if (!name || !/^relay_demo_qa[a-z0-9_]*$/.test(name) || PROTECTED.has(name)) {
  console.error('QA safety guard: set QA_DATABASE_NAME to an isolated name such as relay_demo_qa_persistent.');
  process.exit(1);
}

const original = mongoose.connect.bind(mongoose);
mongoose.connect = (uri, options = {}) => {
  const host = new URL(String(uri)).hostname;
  if (!['127.0.0.1', 'localhost'].includes(host)) {
    throw new Error('QA safety guard: persistent QA runs are limited to the local MongoDB instance.');
  }
  return original(uri, { ...options, dbName: name });
};
console.log(`[QA] Persistent QA database forced: ${name} (working database untouched)`);
