import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import WorkspaceMembership from '../models/WorkspaceMembership.js';
import SecurityAuditLog from '../models/SecurityAuditLog.js';
import { cookieOptions } from '../utils/cookies.js';
import * as authSecurity from '../services/authSecurityService.js';
import * as emailService from '../services/emailService.js';
import { isDemoAutoVerifyAllowed } from '../config/demoSafety.js';
import AuthSession from '../models/AuthSession.js';
import { sessionCookieName, requestToken } from '../utils/sessionCookie.js';

export const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  businessName: user.businessName || '',
  email: user.email,
  role: user.role || 'owner',
  accountStatus: user.accountStatus || 'ACTIVE',
  isEmailVerified: Boolean(user.isEmailVerified || user.emailVerifiedAt),
  emailVerifiedAt: user.emailVerifiedAt || null,
  authVersion: user.authVersion || 1,
  createdAt: user.createdAt,
  lastLoginAt: user.lastLoginAt || null,
  passwordChangedAt: user.passwordChangedAt || null,
  isPlatformAdmin: Boolean(user.isPlatformAdmin),
});

export const getPublicAppUrl = () => {
  return (
    process.env.PUBLIC_APP_URL ||
    process.env.FRONTEND_URL ||
    'http://localhost:5173'
  ).replace(/\/+$/, '');
};

export const issue = async (user, res, status = 200, extra = {}) => {
  const cookieName = sessionCookieName(res.req);
  const session = await AuthSession.create({ userId: user._id, expiresAt: new Date(Date.now() + cookieOptions().maxAge) });
  const token = jwt.sign(
    { sub: user._id.toString(), ver: user.authVersion || 1, sid: String(session._id) },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.cookie(cookieName, token, cookieOptions());
  res.status(status).json({
    user: publicUser(user),
    token,
    ...extra,
  });
};

/**
 * POST /api/auth/register
 * Real registration with server-side validation, password hashing,
 * unverified initial status, and transactional verification email.
 */
export async function register(req, res) {
  const { name, email, password, confirmPassword } = req.body || {};

  // 1. Validation
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) {
    return res.status(400).json({ code: 'INVALID_NAME', message: 'Name must be between 2 and 80 characters.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (typeof email !== 'string' || !emailRegex.test(email.trim())) {
    return res.status(400).json({ code: 'INVALID_EMAIL', message: 'Enter a valid email address.' });
  }

  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    return res.status(400).json({ code: 'INVALID_PASSWORD', message: 'Password must be between 8 and 128 characters.' });
  }

  if (confirmPassword !== undefined && confirmPassword !== password) {
    return res.status(400).json({ code: 'PASSWORD_MISMATCH', message: 'Passwords do not match.' });
  }

  const normalized = email.trim().toLowerCase();

  // 2. Duplicate check (prevent race conditions via unique index on email)
  // Wait for the unique index before admitting concurrent registrations on a fresh DB.
  await User.init();
  const existingUser = await User.findOne({ email: normalized });
  if (existingUser) {
    return res.status(409).json({
      code: 'DUPLICATE_EMAIL',
      message: 'An account with this email address already exists.',
    });
  }

  // 3. Create user record (with strict demo auto-verification policy)
  const passwordHash = await bcrypt.hash(password, 12);
  const autoVerify = isDemoAutoVerifyAllowed();
  let user;
  try {
    user = await User.create({
      name: name.trim(),
      email: normalized,
      passwordHash,
      role: 'owner',
      accountStatus: autoVerify ? 'ACTIVE' : 'PENDING_EMAIL_VERIFICATION',
      isEmailVerified: autoVerify,
      emailVerifiedAt: autoVerify ? new Date() : null,
      verificationEmailLastSentAt: new Date(),
      authVersion: 1,
      defaultWorkspaceId: null,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        code: 'DUPLICATE_EMAIL',
        message: 'An account with this email address already exists.',
      });
    }
    throw err;
  }

  // 4. Generate email verification token
  const rawIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
  const { rawToken } = await authSecurity.createEmailVerificationToken(user._id, {
    ipHash: authSecurity.hashToken(rawIp),
    userAgent: req.get('user-agent') || '',
  });

  // 5. Send transactional verification email (intercepted in memory when mock provider is used)
  const verificationUrl = `${getPublicAppUrl()}/verify-email?token=${rawToken}`;
  let emailSent = false;
  try {
    await emailService.sendVerificationEmail({
      to: user.email,
      name: user.name,
      verificationUrl,
      token: rawToken,
    });
    emailSent = true;
  } catch (emailErr) {
    console.error('Transactional email delivery failure:', emailErr.message);
    // User is created safely; email delivery failure is reported
  }

  await SecurityAuditLog.create({
    ownerId: user._id,
    actorId: user._id,
    action: 'account_registered',
    ipAddress: rawIp,
    userAgent: req.get('user-agent') || '',
    metadata: { email: normalized, emailSent, autoVerified: autoVerify },
  }).catch(() => {});

  if (autoVerify) {
    // In demo environment, issue authenticated session directly
    return issue(user, res, 201, {
      success: true,
      message: 'Account registered and auto-verified for local demo.',
      autoVerified: true,
      hasWorkspace: false,
    });
  }

  // Note: We do NOT issue a session cookie here. Unverified users must verify their email first.
  res.status(201).json({
    success: true,
    message: 'Account registered successfully. Please check your email to verify your account.',
    user: publicUser(user),
    emailSent,
  });
}

/**
 * POST /api/auth/verify-email
 * Verifies email using single-use cryptographic token.
 */
export async function verifyEmail(req, res) {
  const { token } = req.body || {};
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ code: 'INVALID_TOKEN', message: 'Verification token is required.' });
  }

  const result = await authSecurity.consumeEmailVerificationToken(token);

  if (!result.success) {
    if (result.errorReason === 'EXPIRED') {
      return res.status(400).json({
        code: 'TOKEN_EXPIRED',
        message: 'Verification link has expired. Please request a new verification email.',
      });
    }
    if (result.errorReason === 'ALREADY_USED') {
      return res.status(400).json({
        code: 'TOKEN_ALREADY_USED',
        message: 'This verification link has already been used. Please log in.',
      });
    }
    return res.status(400).json({
      code: 'INVALID_TOKEN',
      message: 'Invalid or malformed verification link.',
    });
  }

  const rawIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
  await SecurityAuditLog.create({
    ownerId: result.user._id,
    actorId: result.user._id,
    action: 'email_verified',
    ipAddress: rawIp,
    userAgent: req.get('user-agent') || '',
  }).catch(() => {});

  res.json({
    success: true,
    message: 'Email verified successfully. You can now log in to your account.',
    user: publicUser(result.user),
  });
}

/**
 * POST /api/auth/resend-verification
 * Resends verification email with cooldown and anti-enumeration protections.
 */
export async function resendVerification(req, res) {
  const { email } = req.body || {};
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ code: 'INVALID_EMAIL', message: 'Email address is required.' });
  }

  const normalized = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalized });

  // Generic success response to prevent account enumeration
  const genericSuccess = {
    success: true,
    message: 'If your account is awaiting verification, a new verification link has been sent.',
  };

  if (!user) {
    return res.json(genericSuccess);
  }

  // If already verified, return generic success without generating tokens
  if (user.isEmailVerified && user.emailVerifiedAt) {
    return res.json(genericSuccess);
  }

  // Enforce cooldown (60 seconds between resends)
  if (user.verificationEmailLastSentAt) {
    const elapsed = Date.now() - new Date(user.verificationEmailLastSentAt).getTime();
    if (elapsed < authSecurity.RESEND_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((authSecurity.RESEND_COOLDOWN_MS - elapsed) / 1000);
      return res.status(429).json({
        code: 'RESEND_COOLDOWN',
        message: `Please wait ${waitSeconds} seconds before requesting another verification email.`,
      });
    }
  }

  const rawIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
  const { rawToken } = await authSecurity.createEmailVerificationToken(user._id, {
    ipHash: authSecurity.hashToken(rawIp),
    userAgent: req.get('user-agent') || '',
  });

  user.verificationEmailLastSentAt = new Date();
  await user.save();

  const verificationUrl = `${getPublicAppUrl()}/verify-email?token=${rawToken}`;
  try {
    await emailService.sendVerificationEmail({
      to: user.email,
      name: user.name,
      verificationUrl,
      token: rawToken,
    });
  } catch (err) {
    console.error('Resend verification email failure:', err.message);
  }

  await SecurityAuditLog.create({
    ownerId: user._id,
    actorId: user._id,
    action: 'verification_email_resend',
    ipAddress: rawIp,
    userAgent: req.get('user-agent') || '',
  }).catch(() => {});

  res.json(genericSuccess);
}

/**
 * POST /api/auth/login
 * Authenticates user, checks account status, enforces email verification,
 * respects legacy M2W accounts, and returns authorized workspace summary.
 */
export async function login(req, res) {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  const normalized = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalized }).select('+passwordHash');

  let valid = false;
  if (user && user.passwordHash) {
    valid = await bcrypt.compare(password, user.passwordHash);
  }

  const rawIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';

  // Prevent account enumeration by returning identical generic message
  if (!user || !valid) {
    if (user) {
      await SecurityAuditLog.create({
        ownerId: user._id,
        action: 'login_failure',
        ipAddress: rawIp,
        userAgent: req.get('user-agent') || '',
        metadata: { attemptedEmail: normalized, reason: 'invalid_credentials' },
      }).catch(() => {});
    }
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  // Account status checks
  if (user.accountStatus === 'SUSPENDED') {
    return res.status(403).json({
      code: 'ACCOUNT_SUSPENDED',
      message: 'Your account has been suspended. Please contact platform support.',
    });
  }

  if (user.accountStatus === 'DISABLED') {
    return res.status(403).json({
      code: 'ACCOUNT_DISABLED',
      message: 'Your account has been disabled. Please contact support.',
    });
  }

  // Email verification check with trusted legacy transition policy and demo auto-verification
  const isVerifiedOrLegacy = await authSecurity.isLegacyOrAuthorizedUser(user);
  if (!isVerifiedOrLegacy && user.accountStatus === 'PENDING_EMAIL_VERIFICATION') {
    if (isDemoAutoVerifyAllowed()) {
      user.isEmailVerified = true;
      user.emailVerifiedAt = new Date();
      user.accountStatus = 'ACTIVE';
      await user.save();
    } else {
      return res.status(403).json({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Please verify your email address before signing in. Check your inbox for the verification link.',
        email: user.email,
      });
    }
  }

  user.lastLoginAt = new Date();
  await user.save();

  // Find authorized workspaces
  const memberships = await WorkspaceMembership.find({
    userId: user._id,
    status: 'ACTIVE',
  }).populate('workspaceId');

  const workspaces = memberships
    .filter((m) => m.workspaceId && m.workspaceId.status === 'ACTIVE')
    .map((m) => ({
      id: m.workspaceId._id,
      name: m.workspaceId.name,
      slug: m.workspaceId.slug,
      industryKey: m.workspaceId.industryKey,
      role: m.role,
      isDefault: m.isDefaultWorkspace,
    }));

  await SecurityAuditLog.create({
    ownerId: user._id,
    actorId: user._id,
    action: 'login_success',
    ipAddress: rawIp,
    userAgent: req.get('user-agent') || '',
    metadata: { method: 'password' },
  }).catch(() => {});

  const agencyMembership = await AgencyMembership.findOne({ userId: user._id, status: 'ACTIVE' }).lean();
  const ownedAgency = !agencyMembership ? await Agency.findOne({ ownerId: user._id, status: 'ACTIVE' }).lean() : null;
  const isAgencyOperator = Boolean(agencyMembership || ownedAgency);

  return issue(user, res, 200, {
    workspaces,
    hasWorkspace: workspaces.length > 0,
    isAgencyOperator,
    user: {
      ...publicUser(user),
      isAgencyOperator,
    },
  });
}

/**
 * POST /api/auth/logout
 * Clears session cookie and logs audit event.
 */
export async function logout(req, res) {
  // Revoke only this session, including copied bearer credentials. Other tabs stay signed in.
  const cookieName = sessionCookieName(req);
  const token = requestToken(req);
  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      if (payload.sid) await AuthSession.updateOne({ _id: payload.sid, userId: payload.sub || payload.id }, { $set: { revokedAt: new Date() } });
    } catch (error) {
      if (!['TokenExpiredError', 'JsonWebTokenError'].includes(error.name)) throw error;
    }
  }
  if (req.user) {
    const rawIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
    await SecurityAuditLog.create({
      ownerId: req.user._id,
      actorId: req.user._id,
      action: 'logout',
      ipAddress: rawIp,
      userAgent: req.get('user-agent') || '',
    }).catch(() => {});
  }

  res.clearCookie(cookieName, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });

  res.json({ success: true, message: 'Signed out successfully.' });
}

/**
 * GET /api/auth/me
 * Returns current authenticated user and authorized workspace summary.
 */
export async function me(req, res) {
  const [memberships, adminGrant] = await Promise.all([
    WorkspaceMembership.find({
      userId: req.user._id,
      status: 'ACTIVE',
    }).populate('workspaceId'),
    PlatformAdminGrant.findOne({
      userId: req.user._id,
      status: 'ACTIVE',
    }),
  ]);

  const workspaces = memberships
    .filter((m) => m.workspaceId && m.workspaceId.status === 'ACTIVE')
    .map((m) => ({
      id: m.workspaceId._id,
      name: m.workspaceId.name,
      slug: m.workspaceId.slug,
      industryKey: m.workspaceId.industryKey,
      role: m.role,
      isDefault: m.isDefaultWorkspace,
    }));

  const agencyMembership = await AgencyMembership.findOne({ userId: req.user._id, status: 'ACTIVE' }).lean();
  const ownedAgency = !agencyMembership ? await Agency.findOne({ ownerId: req.user._id, status: 'ACTIVE' }).lean() : null;
  const isAgencyOperator = Boolean(agencyMembership || ownedAgency);

  res.json({
    user: publicUser(req.user),
    workspaces,
    hasWorkspace: workspaces.length > 0,
  });
}

/**
 * POST /api/auth/forgot-password
 * Initiates secure password reset with anti-enumeration protection.
 */
export async function forgotPassword(req, res) {
  const { email } = req.body || {};
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ code: 'INVALID_EMAIL', message: 'Email address is required.' });
  }

  const normalized = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalized });

  // Generic response prevents account enumeration
  const genericSuccess = {
    success: true,
    message: 'If an eligible account exists for this email, password reset instructions have been sent.',
  };

  if (!user || user.accountStatus === 'DISABLED') {
    return res.json(genericSuccess);
  }

  const rawIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
  const { rawToken } = await authSecurity.createPasswordResetToken(user._id, {
    ipHash: authSecurity.hashToken(rawIp),
    userAgent: req.get('user-agent') || '',
  });

  const resetUrl = `${getPublicAppUrl()}/reset-password?token=${rawToken}`;
  try {
    await emailService.sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetUrl,
      token: rawToken,
    });
  } catch (err) {
    console.error('Password reset email delivery failure:', err.message);
  }

  await SecurityAuditLog.create({
    ownerId: user._id,
    actorId: user._id,
    action: 'password_reset_requested',
    ipAddress: rawIp,
    userAgent: req.get('user-agent') || '',
  }).catch(() => {});

  res.json(genericSuccess);
}

/**
 * POST /api/auth/reset-password
 * Completes password reset, atomically consumes token, and revokes prior sessions.
 */
export async function resetPassword(req, res) {
  const { token, newPassword, confirmPassword } = req.body || {};

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ code: 'INVALID_TOKEN', message: 'Password reset token is required.' });
  }

  if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 128) {
    return res.status(400).json({ code: 'INVALID_PASSWORD', message: 'New password must be between 8 and 128 characters.' });
  }

  if (confirmPassword !== undefined && confirmPassword !== newPassword) {
    return res.status(400).json({ code: 'PASSWORD_MISMATCH', message: 'Passwords do not match.' });
  }

  // Atomically consume reset token
  const result = await authSecurity.consumePasswordResetToken(token);

  if (!result.success) {
    if (result.errorReason === 'EXPIRED') {
      return res.status(400).json({
        code: 'TOKEN_EXPIRED',
        message: 'Password reset link has expired. Please request a new one.',
      });
    }
    if (result.errorReason === 'ALREADY_USED') {
      return res.status(400).json({
        code: 'TOKEN_ALREADY_USED',
        message: 'This password reset link has already been used.',
      });
    }
    return res.status(400).json({
      code: 'INVALID_TOKEN',
      message: 'Invalid or malformed password reset link.',
    });
  }

  const user = result.user;
  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.passwordChangedAt = new Date();
  user.authVersion = (user.authVersion || 1) + 1; // Immediately invalidates all existing JWT sessions!
  await user.save();

  // Clear cookie session if one was active
  res.clearCookie('session', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });

  const rawIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
  await SecurityAuditLog.create({
    ownerId: user._id,
    actorId: user._id,
    action: 'password_reset_completed',
    ipAddress: rawIp,
    userAgent: req.get('user-agent') || '',
  }).catch(() => {});

  res.json({
    success: true,
    message: 'Your password has been successfully reset. Please log in with your new credentials.',
  });
}

/**
 * PATCH /api/auth/profile
 */
export async function updateProfile(req, res) {
  const name = req.body?.name;
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) {
    return res.status(400).json({ message: 'Name must be between 2 and 80 characters.' });
  }

  const beforeName = req.user.name;
  req.user.name = name.trim();
  if (req.body.businessName !== undefined) {
    if (typeof req.body.businessName !== 'string' || req.body.businessName.trim().length > 120) {
      return res.status(400).json({ message: 'Business name must be 120 characters or fewer.' });
    }
    req.user.businessName = req.body.businessName.trim();
  }
  await req.user.save();

  const rawIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
  await SecurityAuditLog.create({
    ownerId: req.user._id,
    actorId: req.user._id,
    action: 'profile_updated',
    ipAddress: rawIp,
    userAgent: req.get('user-agent') || '',
    metadata: { fromName: beforeName, toName: req.user.name },
  }).catch(() => {});

  res.json({ user: publicUser(req.user) });
}

/**
 * PATCH /api/auth/password & POST /api/auth/change-password
 */
export async function updatePassword(req, res) {
  const { currentPassword, newPassword } = req.body || {};
  if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 128) {
    return res.status(400).json({ message: 'New password must be between 8 and 128 characters.' });
  }

  const user = await User.findById(req.user._id).select('+passwordHash');
  if (!user || !(await bcrypt.compare(currentPassword || '', user.passwordHash))) {
    return res.status(400).json({ message: 'Current password is incorrect.' });
  }

  if (currentPassword === newPassword) {
    return res.status(400).json({ message: 'New password must be different from current password.' });
  }

  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.passwordChangedAt = new Date();
  user.authVersion = (user.authVersion || 1) + 1;
  await user.save();

  const rawIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
  await SecurityAuditLog.create({
    ownerId: user._id,
    actorId: user._id,
    action: 'password_changed',
    ipAddress: rawIp,
    userAgent: req.get('user-agent') || '',
  }).catch(() => {});

  // Rotate session with updated authVersion
  return issue(user, res);
}
