import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Preloaded by the isolated test runner. Never let a regression suite reach an existing DB.
const allowed = new Set();
const originalUri = MongoMemoryServer.prototype.getUri;
MongoMemoryServer.prototype.getUri = function (...args) {
  const uri = originalUri.apply(this, args);
  allowed.add(new URL(uri).host);
  return uri;
};
for (const method of ['connect', 'createConnection']) {
  const original = mongoose[method].bind(mongoose);
  mongoose[method] = (uri, ...args) => {
    if (!allowed.has(new URL(String(uri)).host)) {
      throw new Error('QA safety guard: only MongoDB instances created by this test process are allowed.');
    }
    return original(uri, ...args);
  };
}
