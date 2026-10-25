/**
 * Demo Mode & Safety Boundary Service
 * 
 * Enforces strict isolation guarantees for local demo testing:
 * 1. Verifies that the connected database is an explicitly designated demo/test database.
 * 2. Prevents any accidental mutations against production databases.
 * 3. Enforces that email auto-verification is only permitted when ALL local demo conditions are met.
 * 4. Fails closed if running in production or if external live side-effects are enabled.
 */

import mongoose from 'mongoose';

/**
 * Checks whether a given database name qualifies as an isolated demo/test database.
 */
export function isIsolatedDemoDatabase(dbName) {
  if (!dbName || typeof dbName !== 'string') return false;
  const normalized = dbName.toLowerCase().trim();
  
  // Explicitly disallow any production-like names
  if (normalized.includes('prod') || normalized === 'freelance_automation_crm_production') {
    return false;
  }

  // Must match approved isolated demo patterns
  return normalized === 'relay_demo' || normalized.includes('demo') || normalized.includes('test');
}

/**
 * Validates whether development-only email auto-verification is permitted.
 * Fails closed in production or if live external providers are active.
 */
export function isDemoAutoVerifyAllowed() {
  // 1. Explicit local demo mode
  const isDemoMode = process.env.APP_MODE === 'demo';

  // 2. Must not be in production
  const isDevOrDemo = process.env.NODE_ENV !== 'production';

  // 3. Explicit auto-verify flag must be true
  const isAutoVerifyFlag =
    process.env.DEMO_EMAIL_AUTO_VERIFY === 'true' ||
    process.env.AUTH_EMAIL_VERIFICATION_MODE === 'development_bypass';

  // 4. Email provider must be mock or inmemory
  const emailProvider = (process.env.EMAIL_PROVIDER || '').toLowerCase();
  const isEmailMock = emailProvider === 'mock' || emailProvider === 'inmemory';

  // 5. Database must be isolated demo storage
  const activeDbName = mongoose.connection?.db?.databaseName || process.env.DATABASE_NAME || '';
  const isDemoDb = isIsolatedDemoDatabase(activeDbName);

  // 6. External side effects must remain disabled
  const liveWhatsApp = process.env.LIVE_WHATSAPP_ENABLED === 'true';
  const liveBilling = process.env.LIVE_BILLING_ENABLED === 'true';

  return (
    isDemoMode &&
    isDevOrDemo &&
    isAutoVerifyFlag &&
    isEmailMock &&
    isDemoDb &&
    !liveWhatsApp &&
    !liveBilling
  );
}

/**
 * Asserts that the current database connection is safely pointing to an isolated demo database.
 * Throws a fatal Error if safety invariants are violated.
 */
export function assertDemoDatabaseSafety(conn = mongoose.connection) {
  const dbName = conn?.db?.databaseName || (conn?.name) || process.env.DATABASE_NAME || '';
  
  if (!isIsolatedDemoDatabase(dbName)) {
    throw new Error(
      `SAFETY VIOLATION: Operation restricted to isolated demo database. Current target "${dbName}" is not an approved demo storage (expected "relay_demo" or "*demo*"). Aborting.`
    );
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'SAFETY VIOLATION: Demo seeding and automated testing operations are prohibited in production.'
    );
  }

  return true;
}
