import crypto from 'crypto';
import AuthToken from '../models/AuthToken.js';
import User from '../models/User.js';
import WorkspaceMembership from '../models/WorkspaceMembership.js';

export const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const PASSWORD_RESET_TOKEN_TTL_MS = 30 * 60 * 1000;     // 30 minutes
export const RESEND_COOLDOWN_MS = 60 * 1000;                   // 60 seconds

/**
 * Computes a SHA-256 hash of a raw token string
 */
export function hashToken(rawToken) {
  return crypto.createHash('sha256').update(String(rawToken).trim()).digest('hex');
}

/**
 * Generates a cryptographically secure random token (64 hex characters)
 */
export function generateSecureToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Creates and persists an email verification token for a user.
 * Automatically invalidates any existing active verification tokens for the user.
 */
export async function createEmailVerificationToken(userId, { ipHash = '', userAgent = '' } = {}) {
  // 1. Invalidate previous unconsumed verification tokens
  await AuthToken.updateMany(
    { userId, purpose: 'EMAIL_VERIFICATION', isConsumed: false },
    { $set: { isConsumed: true, consumedAt: new Date() } }
  );

  // 2. Generate new random token
  const rawToken = generateSecureToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);

  // 3. Persist hash in database
  await AuthToken.create({
    userId,
    tokenHash,
    purpose: 'EMAIL_VERIFICATION',
    expiresAt,
    isConsumed: false,
    metadata: { ipHash, userAgent },
  });

  return { rawToken, expiresAt };
}

/**
 * Atomically verifies and consumes an email verification token.
 * Returns { success, user, errorReason }
 */
export async function consumeEmailVerificationToken(rawToken) {
  if (!rawToken || typeof rawToken !== 'string') {
    return { success: false, errorReason: 'INVALID_TOKEN' };
  }

  const tokenHash = hashToken(rawToken);

  // Check if token exists at all to provide meaningful error statuses
  const existing = await AuthToken.findOne({ tokenHash, purpose: 'EMAIL_VERIFICATION' });
  if (!existing) {
    return { success: false, errorReason: 'INVALID_TOKEN' };
  }

  if (existing.isConsumed) {
    return { success: false, errorReason: 'ALREADY_USED', userId: existing.userId };
  }

  if (existing.expiresAt.getTime() <= Date.now()) {
    return { success: false, errorReason: 'EXPIRED', userId: existing.userId };
  }

  // Atomic single-use consumption
  const consumed = await AuthToken.findOneAndUpdate(
    {
      _id: existing._id,
      isConsumed: false,
      expiresAt: { $gt: new Date() },
    },
    {
      $set: {
        isConsumed: true,
        consumedAt: new Date(),
      },
    },
    { new: true }
  );

  if (!consumed) {
    return { success: false, errorReason: 'ALREADY_USED' };
  }

  // Activate user
  const user = await User.findById(consumed.userId);
  if (!user) {
    return { success: false, errorReason: 'USER_NOT_FOUND' };
  }

  user.isEmailVerified = true;
  user.emailVerifiedAt = new Date();
  if (user.accountStatus === 'PENDING_EMAIL_VERIFICATION') {
    user.accountStatus = 'ACTIVE';
  }
  await user.save();

  return { success: true, user };
}

/**
 * Creates and persists a password reset token for a user.
 * Automatically invalidates any existing active reset tokens for the user.
 */
export async function createPasswordResetToken(userId, { ipHash = '', userAgent = '' } = {}) {
  // 1. Invalidate previous unconsumed reset tokens
  await AuthToken.updateMany(
    { userId, purpose: 'PASSWORD_RESET', isConsumed: false },
    { $set: { isConsumed: true, consumedAt: new Date() } }
  );

  // 2. Generate new random token
  const rawToken = generateSecureToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS);

  // 3. Persist hash in database
  await AuthToken.create({
    userId,
    tokenHash,
    purpose: 'PASSWORD_RESET',
    expiresAt,
    isConsumed: false,
    metadata: { ipHash, userAgent },
  });

  return { rawToken, expiresAt };
}

/**
 * Atomically validates and consumes a password reset token.
 * Returns { success, user, errorReason }
 */
export async function consumePasswordResetToken(rawToken) {
  if (!rawToken || typeof rawToken !== 'string') {
    return { success: false, errorReason: 'INVALID_TOKEN' };
  }

  const tokenHash = hashToken(rawToken);

  const existing = await AuthToken.findOne({ tokenHash, purpose: 'PASSWORD_RESET' });
  if (!existing) {
    return { success: false, errorReason: 'INVALID_TOKEN' };
  }

  if (existing.isConsumed) {
    return { success: false, errorReason: 'ALREADY_USED' };
  }

  if (existing.expiresAt.getTime() <= Date.now()) {
    return { success: false, errorReason: 'EXPIRED' };
  }

  // Atomic single-use consumption
  const consumed = await AuthToken.findOneAndUpdate(
    {
      _id: existing._id,
      isConsumed: false,
      expiresAt: { $gt: new Date() },
    },
    {
      $set: {
        isConsumed: true,
        consumedAt: new Date(),
      },
    },
    { new: true }
  );

  if (!consumed) {
    return { success: false, errorReason: 'ALREADY_USED' };
  }

  const user = await User.findById(consumed.userId).select('+passwordHash');
  if (!user) {
    return { success: false, errorReason: 'USER_NOT_FOUND' };
  }

  return { success: true, user };
}

/**
 * Authoritative transitional check for legacy accounts (e.g. M2W Realty Owner).
 * If a user already possesses an active WorkspaceMembership, they are grandfathered as verified.
 */
export async function isLegacyOrAuthorizedUser(user) {
  if (!user) return false;

  // Already explicitly verified
  if (user.isEmailVerified && user.emailVerifiedAt) return true;

  // Check if user has an active workspace membership
  const hasActiveMembership = await WorkspaceMembership.exists({
    userId: user._id,
    status: 'ACTIVE',
  });

  if (hasActiveMembership) {
    // Grandfather legacy user safely
    user.isEmailVerified = true;
    user.emailVerifiedAt = user.createdAt || new Date();
    user.accountStatus = 'ACTIVE';
    await user.save();
    return true;
  }

  return false;
}
