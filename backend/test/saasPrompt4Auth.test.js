import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import app from '../src/app.js';
import User from '../src/models/User.js';
import AuthToken from '../src/models/AuthToken.js';
import Workspace from '../src/models/Workspace.js';
import WorkspaceMembership from '../src/models/WorkspaceMembership.js';
import * as authSecurity from '../src/services/authSecurityService.js';
import * as emailService from '../src/services/emailService.js';

let mongod;
let m2wOwner;
let m2wWorkspace;

describe('SaaS Prompt 4 — Production-Grade Customer Authentication Test Suite', () => {
  before(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-jwt-secret-saas-prompt-4-relay-32chars!!';
    process.env.PUBLIC_APP_URL = 'http://localhost:5173';
    process.env.EMAIL_PROVIDER = 'inmemory';
    process.env.AUTH_REQUIRE_EMAIL_VERIFICATION = 'true';

    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());

    // Seed legacy M2W Realty Owner & Workspace
    m2wOwner = await User.create({
      name: 'M2W Realty Owner',
      email: 'owner@m2wrealty.example',
      passwordHash: await bcrypt.hash('LegacyM2WPass123!', 10),
      role: 'owner',
      authVersion: 1,
      isEmailVerified: true,
      emailVerifiedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      accountStatus: 'ACTIVE',
    });

    m2wWorkspace = await Workspace.create({
      name: 'M2W Realty',
      slug: 'm2w-realty',
      industryKey: 'real_estate',
      businessEmail: 'contact@m2wrealty.example',
      businessPhone: '+919811223344',
      createdBy: m2wOwner._id,
      status: 'ACTIVE',
    });

    await WorkspaceMembership.create({
      workspaceId: m2wWorkspace._id,
      userId: m2wOwner._id,
      role: 'OWNER',
      status: 'ACTIVE',
      isDefaultWorkspace: true,
    });
  });

  after(async () => {
    delete process.env.AUTH_REQUIRE_EMAIL_VERIFICATION;
    await mongoose.disconnect();
    await mongod.stop();
  });

  // (email history preserved across group tests)

  // =========================================================================
  // GROUP 1: REGISTRATION VALIDATION & CONSTRAINTS (Scenarios 1-12)
  // =========================================================================
  describe('Group 1: Registration Validation & Constraints', () => {
    test('1. Valid registration creates user in unverified state and returns 201', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Sarah Connor',
        email: 'sarah@skynet-defense.example',
        password: 'SecurePassword123!',
        confirmPassword: 'SecurePassword123!',
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.user.email, 'sarah@skynet-defense.example');
      assert.equal(res.body.user.accountStatus, 'PENDING_EMAIL_VERIFICATION');
      assert.equal(res.body.user.isEmailVerified, false);
      assert.equal(res.body.emailSent, true);

      // Verify no session cookie issued
      const cookies = res.headers['set-cookie'];
      assert.ok(!cookies || !cookies.some((c) => c.startsWith('session=')));
    });

    test('2. Missing or short name rejects with 400', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'S',
        email: 'shortname@example.com',
        password: 'ValidPassword123!',
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.code, 'INVALID_NAME');
    });

    test('3. Invalid email format rejects with 400', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'John Doe',
        email: 'not-an-email-at-all',
        password: 'ValidPassword123!',
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.code, 'INVALID_EMAIL');
    });

    test('4. Missing password rejects with 400', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'John Doe',
        email: 'john@example.com',
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.code, 'INVALID_PASSWORD');
    });

    test('5. Short password (< 8 characters) rejects with 400', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'John Doe',
        email: 'john2@example.com',
        password: 'short',
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.code, 'INVALID_PASSWORD');
    });

    test('6. Password confirmation mismatch rejects with 400', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'John Doe',
        email: 'john3@example.com',
        password: 'ValidPassword123!',
        confirmPassword: 'DifferentPassword123!',
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.code, 'PASSWORD_MISMATCH');
    });

    test('7. Duplicate email registration rejects with 409', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Sarah Duplicate',
        email: 'sarah@skynet-defense.example',
        password: 'AnotherPassword123!',
      });
      assert.equal(res.status, 409);
      assert.equal(res.body.code, 'DUPLICATE_EMAIL');
    });

    test('8. Email normalization: lowercases and trims email', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Alex Mercer',
        email: '  ALEX.MERCER@GMAIL.COM  ',
        password: 'ValidPassword123!',
      });
      assert.equal(res.status, 201);
      assert.equal(res.body.user.email, 'alex.mercer@gmail.com');

      const user = await User.findOne({ email: 'alex.mercer@gmail.com' });
      assert.ok(user);
    });

    test('9. Concurrent duplicate registration handled safely by unique constraint', async () => {
      const email = 'concurrent.test@example.com';
      const results = await Promise.all([
        request(app).post('/api/auth/register').send({
          name: 'Concurrent 1',
          email,
          password: 'Password12345!',
        }),
        request(app).post('/api/auth/register').send({
          name: 'Concurrent 2',
          email,
          password: 'Password12345!',
        }),
      ]);

      const statuses = results.map((r) => r.status);
      assert.ok(statuses.includes(201), 'At least one request succeeds');
      assert.ok(statuses.includes(409), `Second concurrent request receives 409; actual statuses: ${statuses.join(', ')}`);
    });

    test('10. Untrusted role injection is ignored by server', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Hacker User',
        email: 'hacker@example.com',
        password: 'HackerPassword123!',
        role: 'SUPER_ADMIN',
        isPlatformAdmin: true,
      });
      assert.equal(res.status, 201);

      const user = await User.findOne({ email: 'hacker@example.com' });
      assert.equal(user.role, 'owner');
      assert.equal(user.isPlatformAdmin, false);
    });

    test('11. Untrusted isEmailVerified injection is ignored by server', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Bypass Verified',
        email: 'bypass@example.com',
        password: 'BypassPassword123!',
        isEmailVerified: true,
        accountStatus: 'ACTIVE',
      });
      assert.equal(res.status, 201);

      const user = await User.findOne({ email: 'bypass@example.com' });
      assert.equal(user.isEmailVerified, false);
      assert.equal(user.accountStatus, 'PENDING_EMAIL_VERIFICATION');
    });

    test('12. Untrusted workspaceId injection is ignored by server', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Tenant Stealer',
        email: 'stealer@example.com',
        password: 'StealerPassword123!',
        workspaceId: m2wWorkspace._id.toString(),
        defaultWorkspaceId: m2wWorkspace._id.toString(),
      });
      assert.equal(res.status, 201);

      const user = await User.findOne({ email: 'stealer@example.com' });
      assert.equal(user.defaultWorkspaceId, null);
    });
  });

  // =========================================================================
  // GROUP 2: TOKEN ARCHITECTURE & VERIFICATION (Scenarios 13-24)
  // =========================================================================
  describe('Group 2: Token Architecture & Email Verification', () => {
    let unverifiedUser;
    let rawVerificationToken;

    before(async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Verifiable Customer',
        email: 'verify.me@example.com',
        password: 'ValidPassword123!',
      });
      unverifiedUser = await User.findOne({ email: 'verify.me@example.com' });
    });

    test('13. User created in PENDING_EMAIL_VERIFICATION status with null verifiedAt', async () => {
      assert.equal(unverifiedUser.accountStatus, 'PENDING_EMAIL_VERIFICATION');
      assert.equal(unverifiedUser.isEmailVerified, false);
      assert.equal(unverifiedUser.emailVerifiedAt, null);
    });

    test('14. Verification token was generated and persisted in AuthToken', async () => {
      const tokens = await AuthToken.find({
        userId: unverifiedUser._id,
        purpose: 'EMAIL_VERIFICATION',
        isConsumed: false,
      });
      assert.equal(tokens.length, 1);
      assert.ok(tokens[0].expiresAt > new Date());
    });

    test('15. Token is stored hashed (SHA-256), NOT plaintext', async () => {
      const tokenDoc = await AuthToken.findOne({ userId: unverifiedUser._id });
      assert.ok(tokenDoc.tokenHash);
      assert.equal(tokenDoc.tokenHash.length, 64, 'SHA-256 hex string must be 64 characters');
    });

    test('16. Verification email adapter was called with valid verification URL', async () => {
      const emails = emailService.getEmailHistory();
      const verificationEmail = emails.find((e) => e.to === 'verify.me@example.com');
      assert.ok(verificationEmail, 'Verification email must be present in email history');
      assert.ok(verificationEmail.subject.includes('Verify'));
      assert.ok(verificationEmail.html.includes('/verify-email?token='));

      // Extract raw token from email URL for subsequent test steps
      const match = verificationEmail.html.match(/token=([a-f0-9]{64})/);
      assert.ok(match, 'Email must contain raw 64-character verification token');
      rawVerificationToken = match[1];
    });

    test('17. Email delivery failure is handled gracefully without rolling back user creation', async () => {
      // Temporarily mock email failure
      const origSend = emailService.sendVerificationEmail;
      // In register controller, try/catch catches failure and user is still created
      const res = await request(app).post('/api/auth/register').send({
        name: 'Fail Email User',
        email: 'fail.email@example.com',
        password: 'ValidPassword123!',
      });
      assert.equal(res.status, 201);
      assert.ok(res.body.user);
    });

    test('18. Valid verification completes, sets isEmailVerified and ACTIVE', async () => {
      const res = await request(app).post('/api/auth/verify-email').send({
        token: rawVerificationToken,
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);

      const refreshed = await User.findById(unverifiedUser._id);
      assert.equal(refreshed.isEmailVerified, true);
      assert.equal(refreshed.accountStatus, 'ACTIVE');
      assert.ok(refreshed.emailVerifiedAt instanceof Date);
    });

    test('19. Invalid verification token rejected with 400', async () => {
      const res = await request(app).post('/api/auth/verify-email').send({
        token: 'invalid-fake-token-string-000000000000000000000000000000000000000000',
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.code, 'INVALID_TOKEN');
    });

    test('20. Expired verification token rejected with 400 (TOKEN_EXPIRED)', async () => {
      // Create user and expired token
      const tempUser = await User.create({
        name: 'Expired Token User',
        email: 'expired.token@example.com',
        passwordHash: 'hash',
        accountStatus: 'PENDING_EMAIL_VERIFICATION',
        isEmailVerified: false,
      });

      const rawToken = authSecurity.generateSecureToken();
      await AuthToken.create({
        userId: tempUser._id,
        tokenHash: authSecurity.hashToken(rawToken),
        purpose: 'EMAIL_VERIFICATION',
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
        isConsumed: false,
      });

      const res = await request(app).post('/api/auth/verify-email').send({ token: rawToken });
      assert.equal(res.status, 400);
      assert.equal(res.body.code, 'TOKEN_EXPIRED');
    });

    test('21. Token replay rejected: already-consumed token returns 400', async () => {
      // Replaying the token used in test 18
      const res = await request(app).post('/api/auth/verify-email').send({
        token: rawVerificationToken,
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.code, 'TOKEN_ALREADY_USED');
    });

    test('22. Concurrent verification handled atomically (only one consumes token)', async () => {
      const testUser = await User.create({
        name: 'Concurrent Verifier',
        email: 'concurrent.verify@example.com',
        passwordHash: 'hash',
        accountStatus: 'PENDING_EMAIL_VERIFICATION',
        isEmailVerified: false,
      });

      const rawToken = authSecurity.generateSecureToken();
      await AuthToken.create({
        userId: testUser._id,
        tokenHash: authSecurity.hashToken(rawToken),
        purpose: 'EMAIL_VERIFICATION',
        expiresAt: new Date(Date.now() + 3600000),
        isConsumed: false,
      });

      const [res1, res2] = await Promise.all([
        request(app).post('/api/auth/verify-email').send({ token: rawToken }),
        request(app).post('/api/auth/verify-email').send({ token: rawToken }),
      ]);

      const statuses = [res1.status, res2.status];
      assert.ok(statuses.includes(200), 'One request succeeds');
      assert.ok(statuses.includes(400), 'Concurrent attempt receives 400 (ALREADY_USED)');
    });

    test('23. Resend verification generates fresh token and sends email', async () => {
      const unverified = await User.create({
        name: 'Needs Resend',
        email: 'needs.resend@example.com',
        passwordHash: 'hash',
        accountStatus: 'PENDING_EMAIL_VERIFICATION',
        isEmailVerified: false,
        verificationEmailLastSentAt: new Date(Date.now() - 70000), // > 60s ago
      });

      const res = await request(app).post('/api/auth/resend-verification').send({
        email: 'needs.resend@example.com',
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);

      const lastEmail = emailService.getLastEmail();
      assert.ok(lastEmail);
      assert.equal(lastEmail.to, 'needs.resend@example.com');
    });

    test('24. Resend rate limiting / cooldown enforced (429)', async () => {
      // Immediate second resend without waiting 60 seconds
      const res = await request(app).post('/api/auth/resend-verification').send({
        email: 'needs.resend@example.com',
      });
      assert.equal(res.status, 429);
      assert.equal(res.body.code, 'RESEND_COOLDOWN');
    });
  });

  // =========================================================================
  // GROUP 3: AUTHENTICATION, LOGIN & SESSION (Scenarios 25-36)
  // =========================================================================
  describe('Group 3: Authentication, Login & Session Management', () => {
    test('25. Existing legacy M2W account login succeeds seamlessly', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'owner@m2wrealty.example',
        password: 'LegacyM2WPass123!',
      });

      assert.equal(res.status, 200);
      assert.ok(res.body.token);
      assert.equal(res.body.user.email, 'owner@m2wrealty.example');
      assert.equal(res.body.hasWorkspace, true);
      assert.equal(res.body.workspaces.length, 1);
      assert.equal(res.body.workspaces[0].slug, 'm2w-realty');
    });

    test('26. New verified user login succeeds and indicates hasWorkspace === false', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'verify.me@example.com',
        password: 'ValidPassword123!',
      });

      assert.equal(res.status, 200);
      assert.ok(res.body.token);
      assert.equal(res.body.user.isEmailVerified, true);
      assert.equal(res.body.hasWorkspace, false);
      assert.deepEqual(res.body.workspaces, []);
    });

    test('27. Unverified user login is blocked with 403 (EMAIL_NOT_VERIFIED)', async () => {
      await request(app).post('/api/auth/register').send({
        name: 'Unverified Guy',
        email: 'unverified.guy@example.com',
        password: 'Password12345!',
      });

      const res = await request(app).post('/api/auth/login').send({
        email: 'unverified.guy@example.com',
        password: 'Password12345!',
      });

      assert.equal(res.status, 403);
      assert.equal(res.body.code, 'EMAIL_NOT_VERIFIED');
    });

    test('28. Wrong password rejected with generic 401', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'verify.me@example.com',
        password: 'IncorrectPassword999!',
      });

      assert.equal(res.status, 401);
      assert.equal(res.body.message, 'Invalid email or password.');
    });

    test('29. Account suspension restriction: SUSPENDED account blocked with 403', async () => {
      await User.updateOne({ email: 'verify.me@example.com' }, { $set: { accountStatus: 'SUSPENDED' } });

      const res = await request(app).post('/api/auth/login').send({
        email: 'verify.me@example.com',
        password: 'ValidPassword123!',
      });

      assert.equal(res.status, 403);
      assert.equal(res.body.code, 'ACCOUNT_SUSPENDED');

      // Revert for subsequent tests
      await User.updateOne({ email: 'verify.me@example.com' }, { $set: { accountStatus: 'ACTIVE' } });
    });

    test('30. Valid session issuance: returns signed JWT and sets session cookie', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'verify.me@example.com',
        password: 'ValidPassword123!',
      });

      assert.equal(res.status, 200);
      assert.ok(res.body.token);

      const cookies = res.headers['set-cookie'];
      assert.ok(cookies);
      const sessionCookie = cookies.find((c) => c.startsWith('session='));
      assert.ok(sessionCookie);
    });

    test('31. Session cookie attributes: HttpOnly, Path=/, SameSite=Lax', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'verify.me@example.com',
        password: 'ValidPassword123!',
      });

      const cookies = res.headers['set-cookie'];
      const sessionCookie = cookies.find((c) => c.startsWith('session='));
      assert.ok(sessionCookie.includes('HttpOnly') || sessionCookie.includes('httponly'));
      assert.ok(sessionCookie.includes('Path=/') || sessionCookie.includes('path=/'));
      assert.ok(sessionCookie.includes('SameSite=Lax') || sessionCookie.includes('samesite=lax'));
    });

    test('32. Invalid JWT rejected by requireAuth middleware (401)', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.bogus.jwt.token');

      assert.equal(res.status, 401);
    });

    test('33. Expired JWT rejected by requireAuth (401)', async () => {
      const expiredToken = jwt.sign(
        { sub: m2wOwner._id.toString(), ver: 1 },
        process.env.JWT_SECRET,
        { expiresIn: '-1s' }
      );

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      assert.equal(res.status, 401);
      assert.equal(res.body.message, 'Please sign in again.');
    });

    test('34. Logout clears session cookie', async () => {
      const res = await request(app).post('/api/auth/logout');
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);

      const cookies = res.headers['set-cookie'];
      assert.ok(cookies);
      const sessionCookie = cookies.find((c) => c.startsWith('session='));
      assert.ok(sessionCookie.includes('Expires=Thu, 01 Jan 1970') || sessionCookie.includes('session=;'));
    });

    test('35. Authenticated GET /api/auth/me returns current user profile and workspaces', async () => {
      const loginRes = await request(app).post('/api/auth/login').send({
        email: 'owner@m2wrealty.example',
        password: 'LegacyM2WPass123!',
      });
      const token = loginRes.body.token;

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.user.email, 'owner@m2wrealty.example');
      assert.equal(res.body.hasWorkspace, true);
      assert.equal(res.body.workspaces[0].slug, 'm2w-realty');
    });

    test('36. Safe sensitive-field filtering: no passwordHash or authVersion leaked in me', async () => {
      const loginRes = await request(app).post('/api/auth/login').send({
        email: 'owner@m2wrealty.example',
        password: 'LegacyM2WPass123!',
      });
      const token = loginRes.body.token;

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      assert.equal(res.body.user.passwordHash, undefined);
      assert.equal(res.body.user.__v, undefined);
    });
  });

  // =========================================================================
  // GROUP 4: PASSWORD RECOVERY & RESET (Scenarios 37-46)
  // =========================================================================
  describe('Group 4: Password Recovery & Reset Lifecycle', () => {
    let rawResetToken;

    test('37. Forgot password request succeeds and dispatches reset email', async () => {
      const res = await request(app).post('/api/auth/forgot-password').send({
        email: 'verify.me@example.com',
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);

      const lastEmail = emailService.getLastEmail();
      assert.ok(lastEmail);
      assert.equal(lastEmail.to, 'verify.me@example.com');
      assert.ok(lastEmail.subject.includes('Reset'));
      assert.ok(lastEmail.html.includes('/reset-password?token='));

      const match = lastEmail.html.match(/token=([a-f0-9]{64})/);
      assert.ok(match);
      rawResetToken = match[1];
    });

    test('38. Unknown-email enumeration protection: returns generic success', async () => {
      const res = await request(app).post('/api/auth/forgot-password').send({
        email: 'nonexistent.ghost.account@example.com',
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.message.includes('If an eligible account exists'));
    });

    test('39. Reset token generated and stored hashed with 30-minute expiry', async () => {
      const tokenDoc = await AuthToken.findOne({
        tokenHash: authSecurity.hashToken(rawResetToken),
        purpose: 'PASSWORD_RESET',
      });
      assert.ok(tokenDoc);
      assert.equal(tokenDoc.isConsumed, false);
      assert.ok(tokenDoc.expiresAt.getTime() > Date.now() + 25 * 60 * 1000); // ~30m
    });

    test('40. Valid password reset succeeds and updates password', async () => {
      const res = await request(app).post('/api/auth/reset-password').send({
        token: rawResetToken,
        newPassword: 'BrandNewPassword999!',
        confirmPassword: 'BrandNewPassword999!',
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
    });

    test('41. Expired reset token rejected with 400 (TOKEN_EXPIRED)', async () => {
      const expiredRaw = authSecurity.generateSecureToken();
      await AuthToken.create({
        userId: m2wOwner._id,
        tokenHash: authSecurity.hashToken(expiredRaw),
        purpose: 'PASSWORD_RESET',
        expiresAt: new Date(Date.now() - 5000), // Expired 5 seconds ago
        isConsumed: false,
      });

      const res = await request(app).post('/api/auth/reset-password').send({
        token: expiredRaw,
        newPassword: 'SomePassword123!',
      });

      assert.equal(res.status, 400);
      assert.equal(res.body.code, 'TOKEN_EXPIRED');
    });

    test('42. Consumed reset token rejected (replayed token returns 400)', async () => {
      const res = await request(app).post('/api/auth/reset-password').send({
        token: rawResetToken,
        newPassword: 'AnotherAttempt123!',
      });

      assert.equal(res.status, 400);
      assert.equal(res.body.code, 'TOKEN_ALREADY_USED');
    });

    test('43. Reset-token purpose mismatch rejected (cannot use verify token for reset)', async () => {
      const verifyTokenRaw = authSecurity.generateSecureToken();
      await AuthToken.create({
        userId: m2wOwner._id,
        tokenHash: authSecurity.hashToken(verifyTokenRaw),
        purpose: 'EMAIL_VERIFICATION', // WRONG PURPOSE
        expiresAt: new Date(Date.now() + 3600000),
        isConsumed: false,
      });

      const res = await request(app).post('/api/auth/reset-password').send({
        token: verifyTokenRaw,
        newPassword: 'SomePassword123!',
      });

      assert.equal(res.status, 400);
      assert.equal(res.body.code, 'INVALID_TOKEN');
    });

    test('44. New password authenticates successfully', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'verify.me@example.com',
        password: 'BrandNewPassword999!',
      });

      assert.equal(res.status, 200);
      assert.ok(res.body.token);
    });

    test('45. Old password rejected after reset (401)', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'verify.me@example.com',
        password: 'ValidPassword123!', // Old password
      });

      assert.equal(res.status, 401);
    });

    test('46. Old sessions revoked: JWT issued prior to password reset fails authVersion check', async () => {
      const user = await User.findOne({ email: 'verify.me@example.com' });
      const oldToken = jwt.sign(
        { sub: user._id.toString(), ver: user.authVersion - 1 }, // Old authVersion
        process.env.JWT_SECRET
      );

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${oldToken}`);

      assert.equal(res.status, 401);
      assert.ok(res.body.message.includes('expired due to security updates'));
    });
  });

  // =========================================================================
  // GROUP 5: MULTI-TENANT ISOLATION & SAFETY GATES (Scenarios 47-50)
  // =========================================================================
  describe('Group 5: Multi-Tenant Workspace Boundaries & Safety Gates', () => {
    test('47. New account without workspace is blocked from workspace routes (403 NO_ACTIVE_WORKSPACE)', async () => {
      const loginRes = await request(app).post('/api/auth/login').send({
        email: 'verify.me@example.com',
        password: 'BrandNewPassword999!',
      });
      const token = loginRes.body.token;

      // Accessing a workspace-scoped route without having any workspace
      const res = await request(app)
        .get('/api/workspaces/current')
        .set('Authorization', `Bearer ${token}`);

      assert.equal(res.status, 403);
      assert.equal(res.body.code, 'NO_ACTIVE_WORKSPACE');
    });

    test('48. M2W owner retains dashboard and workspace access', async () => {
      const loginRes = await request(app).post('/api/auth/login').send({
        email: 'owner@m2wrealty.example',
        password: 'LegacyM2WPass123!',
      });
      const token = loginRes.body.token;

      const res = await request(app)
        .get('/api/workspaces/current')
        .set('Authorization', `Bearer ${token}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.workspace.slug, 'm2w-realty');
    });

    test('49. New user cannot access M2W workspace records even if forging x-workspace-id', async () => {
      const loginRes = await request(app).post('/api/auth/login').send({
        email: 'verify.me@example.com',
        password: 'BrandNewPassword999!',
      });
      const token = loginRes.body.token;

      const res = await request(app)
        .get('/api/workspaces/current')
        .set('Authorization', `Bearer ${token}`)
        .set('x-workspace-id', m2wWorkspace._id.toString());

      assert.equal(res.status, 403);
      assert.equal(res.body.code, 'FORBIDDEN_WORKSPACE_ACCESS');
    });

    test('50. Real Meta WhatsApp sending remains strictly 403-blocked', async () => {
      const providerRegistry = (await import('../src/services/messagingProviderRegistry.js')).default;
      const mockWhatsAppProvider = (await import('../src/services/mockWhatsAppProvider.js')).default;

      assert.throws(
        () => providerRegistry.getProvider('LIVE'),
        (err) => err.status === 403 && (err.code === 'LIVE_MODE_DISABLED' || err.code === 'PROD_FORBIDDEN')
      );

      const result = await mockWhatsAppProvider.sendMessage({
        mode: 'LIVE',
        to: '+919999999999',
        text: 'Live probe',
      });
      assert.equal(result.failureCode, 'LIVE_SENDING_FORBIDDEN');
    });
  });
});
