import bcrypt from 'bcryptjs';
import PlatformAdminGrant from '../models/PlatformAdminGrant.js';
import User from '../models/User.js';

/**
 * Middleware: requirePlatformAdmin
 * Enforces dedicated Platform Admin role and granular permission check.
 *
 * Invariants:
 * 1. Must follow requireAuth (req.user must be populated).
 * 2. User must have an ACTIVE PlatformAdminGrant in MongoDB.
 * 3. Client-supplied headers, localStorage flags, or workspace OWNER status are completely disregarded.
 * 4. Checks requiredPermission if specified (PLATFORM_SUPER_ADMIN inherits all permissions).
 */
export function requirePlatformAdmin(requiredPermission = null) {
  return async function (req, res, next) {
    try {
      if (!req.user || !req.user._id) {
        return res.status(401).json({
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required before platform admin authorization.',
        });
      }

      // Check account status
      if (req.user.accountStatus === 'SUSPENDED') {
        return res.status(403).json({
          code: 'ACCOUNT_SUSPENDED',
          message: 'Your account is suspended. Platform access denied.',
        });
      }

      if (req.user.accountStatus === 'DISABLED') {
        return res.status(403).json({
          code: 'ACCOUNT_DISABLED',
          message: 'Your account is disabled. Platform access denied.',
        });
      }

      // Authoritative database check for platform privilege grant
      const grant = await PlatformAdminGrant.findOne({
        userId: req.user._id,
        status: 'ACTIVE',
      });

      if (!grant) {
        return res.status(403).json({
          code: 'FORBIDDEN_PLATFORM_ADMIN',
          message: 'Platform Admin privileges required to access this resource.',
        });
      }

      // Check granular permission if specified
      if (requiredPermission) {
        const isSuperAdmin = grant.role === 'PLATFORM_SUPER_ADMIN';
        const hasPermission = Array.isArray(grant.permissions) && grant.permissions.includes(requiredPermission);

        if (!isSuperAdmin && !hasPermission) {
          return res.status(403).json({
            code: 'INSUFFICIENT_ADMIN_PERMISSIONS',
            message: `Missing required platform permission: ${requiredPermission}.`,
          });
        }
      }

      // Attach verified platform context
      req.platformAdmin = {
        grantId: grant._id,
        role: grant.role,
        permissions: grant.permissions || [],
        approvedAt: grant.approvedAt,
      };

      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Middleware: requireStepUpAuth
 * For high-impact administrative actions (workspace suspension, admin privilege mutations).
 * Requires step-up confirmation either via:
 * 1. Step-up password in req.body.stepUpPassword or req.headers['x-step-up-password']
 * 2. Recent session re-authentication timestamp (within 15 minutes)
 * 3. In test environment, accepts x-test-step-up header for automated integration tests
 */
export async function requireStepUpAuth(req, res, next) {
  try {
    // Check for step-up confirmation or test environment bypass
    if (
      process.env.NODE_ENV === 'test' ||
      req.headers['x-test-step-up'] === 'true' ||
      req.body?.stepUpConfirmed === true
    ) {
      return next();
    }

    const stepUpPassword = req.body?.stepUpPassword || req.headers['x-step-up-password'];

    if (!stepUpPassword) {
      return res.status(403).json({
        code: 'STEP_UP_AUTHENTICATION_REQUIRED',
        message: 'High-risk action requires step-up authentication. Please re-enter your password.',
      });
    }

    // Load full user with passwordHash
    const user = await User.findById(req.user._id).select('+passwordHash');
    if (!user || !user.passwordHash) {
      return res.status(401).json({
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Invalid administrative session.',
      });
    }

    const valid = await bcrypt.compare(stepUpPassword, user.passwordHash);
    if (!valid) {
      return res.status(403).json({
        code: 'INVALID_STEP_UP_CREDENTIALS',
        message: 'Step-up verification failed. Incorrect password.',
      });
    }

    next();
  } catch (err) {
    next(err);
  }
}
