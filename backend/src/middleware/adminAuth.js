/**
 * Platform Super Admin Authorization Middleware
 * Verifies that the authenticated user possesses authoritative platform admin privileges in MongoDB.
 */

import User from '../models/User.js';

// Reserved/demonstration email identities. These accounts ship with publicly documented passwords.
const DEMO_IDENTITY = /@relay-demo\.test$/i;
// Anything matching this is a synthetic/test/demo identity rather than a genuine business account.
const NON_GENUINE_IDENTITY = /(\.test|@relay-test\.io|@example\.(com|org|net))$/i;

export function isDemoIdentityEmail(email) {
  return DEMO_IDENTITY.test(String(email || '').trim());
}

export async function requirePlatformAdmin(req, res, next) {
  if (!req.user || !req.user._id) {
    return res.status(401).json({
      code: 'UNAUTHENTICATED',
      message: 'Authentication is required to access Platform Admin.',
    });
  }

  // Authoritatively re-fetch from database to ensure no stale or forged JWT properties
  const user = await User.findById(req.user._id);
  if (!user || !user.isPlatformAdmin) {
    return res.status(403).json({
      code: 'FORBIDDEN_ADMIN_ACCESS',
      message: 'Access denied. Platform Super Admin privileges required.',
    });
  }

  // A demonstration platform admin (public demo password) must never be able to list, inspect or
  // suspend genuine businesses. Fail closed whenever this database also holds genuine accounts,
  // unless the operator explicitly opts in for a fully-synthetic database.
  if (isDemoIdentityEmail(user.email) && process.env.ALLOW_DEMO_PLATFORM_ADMIN !== 'true') {
    const genuineAccounts = await User.countDocuments({
      email: { $not: NON_GENUINE_IDENTITY },
    });
    if (genuineAccounts > 0) {
      return res.status(403).json({
        code: 'DEMO_ADMIN_DISABLED',
        message: 'The demonstration platform admin is disabled because this database contains genuine business accounts.',
      });
    }
  }

  req.adminUser = user;
  next();
}

export default requirePlatformAdmin;
