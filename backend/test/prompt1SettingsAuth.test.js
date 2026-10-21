import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';

import app from '../src/app.js';
import User from '../src/models/User.js';
import BusinessProfile from '../src/models/BusinessProfile.js';
import UserPreferences from '../src/models/UserPreferences.js';
import SecurityAuditLog from '../src/models/SecurityAuditLog.js';

process.env.JWT_SECRET = 'prompt1-test-secret-value-32-chars-long-relay';
let mongo;
let owner;
let ownerToken;

const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());

  const passwordHash = await bcrypt.hash('CurrentPassword123!', 10);
  owner = await User.create({
    name: 'Sumit Thakur',
    email: 'owner@relayrealestate.example',
    passwordHash,
    role: 'owner',
    authVersion: 1,
    lastLoginAt: new Date(),
  });

  ownerToken = jwt.sign(
    { sub: String(owner._id), ver: 1 },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
});

after(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

test('1. Authentication & Security: login, anti-enumeration, session rotation and logout', async () => {
  // A. Protected routes reject unauthorized requests
  const unauthMe = await request(app).get('/api/auth/me');
  assert.equal(unauthMe.status, 401);

  const unauthSettings = await request(app).get('/api/settings/profile');
  assert.equal(unauthSettings.status, 401);

  // B. Anti-enumeration: wrong password returns generic message
  const badPass = await request(app).post('/api/auth/login').send({
    email: 'owner@relayrealestate.example',
    password: 'WrongPassword999!',
  });
  assert.equal(badPass.status, 401);
  assert.equal(badPass.body.message, 'Invalid email or password.');

  // C. Anti-enumeration: nonexistent email returns identical message
  const nonExistent = await request(app).post('/api/auth/login').send({
    email: 'nobody@nonexistent.example',
    password: 'AnyPassword123!',
  });
  assert.equal(nonExistent.status, 401);
  assert.equal(nonExistent.body.message, 'Invalid email or password.');

  // D. Missing fields rejected
  const missingPass = await request(app).post('/api/auth/login').send({
    email: 'owner@relayrealestate.example',
  });
  assert.equal(missingPass.status, 400);

  // E. Valid login succeeds, returns owner identity, never exposes passwordHash
  const validLogin = await request(app).post('/api/auth/login').send({
    email: 'owner@relayrealestate.example',
    password: 'CurrentPassword123!',
  });
  assert.equal(validLogin.status, 200);
  assert.equal(validLogin.body.user.role, 'owner');
  assert.equal(validLogin.body.user.passwordHash, undefined);
  assert.ok(validLogin.headers['set-cookie']);

  // F. Identity endpoint returns owner details
  const meRes = await request(app).get('/api/auth/me').set(authHeader(ownerToken));
  assert.equal(meRes.status, 200);
  assert.equal(meRes.body.user.email, 'owner@relayrealestate.example');
  assert.equal(meRes.body.user.role, 'owner');

  // G. Logout clears session cookie
  const logoutRes = await request(app).post('/api/auth/logout').set(authHeader(ownerToken));
  assert.equal(logoutRes.status, 200);
  assert.match(logoutRes.headers['set-cookie'][0], /session=;/);
});

test('2. Owner Profile: read, update and MongoDB persistence', async () => {
  // A. Read profile
  const profRes = await request(app).get('/api/settings/profile').set(authHeader(ownerToken));
  assert.equal(profRes.status, 200);
  assert.equal(profRes.body.profile.name, 'Sumit Thakur');
  assert.equal(profRes.body.profile.roleDisplay, 'Owner / Single Operator');

  // B. Validation: name too short
  const badName = await request(app)
    .patch('/api/settings/profile')
    .set(authHeader(ownerToken))
    .send({ name: 'A' });
  assert.equal(badName.status, 400);

  // C. Update display name
  const updatedProf = await request(app)
    .patch('/api/settings/profile')
    .set(authHeader(ownerToken))
    .send({ name: 'Sumit R. Thakur', businessName: 'Apex Real Estate Ventures' });
  assert.equal(updatedProf.status, 200);
  assert.equal(updatedProf.body.profile.name, 'Sumit R. Thakur');

  // D. Verify persistence in MongoDB
  const dbUser = await User.findById(owner._id);
  assert.equal(dbUser.name, 'Sumit R. Thakur');
  assert.equal(dbUser.businessName, 'Apex Real Estate Ventures');

  // E. Verify audit log entry
  const audit = await SecurityAuditLog.findOne({
    ownerId: owner._id,
    action: 'profile_updated',
  }).sort({ createdAt: -1 });
  assert.ok(audit);
  assert.equal(audit.metadata.toName, 'Sumit R. Thakur');
});

test('3. Real Estate Business Profile: validation, persistence and completeness score', async () => {
  // A. Initial read
  const initial = await request(app).get('/api/settings/business').set(authHeader(ownerToken));
  assert.equal(initial.status, 200);
  assert.ok(typeof initial.body.completenessScore === 'number');

  // B. Validation: missing legal name
  const badLegal = await request(app)
    .put('/api/settings/business')
    .set(authHeader(ownerToken))
    .send({ legalOrTradingName: '' });
  assert.equal(badLegal.status, 400);

  // C. Validation: invalid website
  const badWebsite = await request(app)
    .put('/api/settings/business')
    .set(authHeader(ownerToken))
    .send({
      legalOrTradingName: 'Apex Realty',
      website: 'not-a-valid-url-without-domain',
    });
  assert.equal(badWebsite.status, 400);

  // D. Valid business update
  const validBusiness = await request(app)
    .put('/api/settings/business')
    .set(authHeader(ownerToken))
    .send({
      legalOrTradingName: 'Apex Real Estate Ventures',
      displayName: 'Apex Realty',
      businessCategory: 'Real Estate',
      email: 'contact@apexrealty.example',
      phone: '+91 98765 43210',
      website: 'https://apexrealty.example',
      description: 'Luxury residential and commercial property advisory firm.',
      address: 'Suite 401, Apex Commercial Tower, MG Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
      postalCode: '560001',
    });
  assert.equal(validBusiness.status, 200);
  assert.equal(validBusiness.body.businessProfile.city, 'Bengaluru');
  assert.equal(validBusiness.body.completenessScore, 100);
  assert.equal(validBusiness.body.isComplete, true);

  // E. Verify persistence in MongoDB BusinessProfile collection
  const dbBp = await BusinessProfile.findOne({ ownerId: owner._id });
  assert.equal(dbBp.legalOrTradingName, 'Apex Real Estate Ventures');
  assert.equal(dbBp.city, 'Bengaluru');
  assert.equal(dbBp.phone, '+91 98765 43210');
});

test('4. Security & Password Change: strong policy, session revocation and rotation', async () => {
  // A. Reject wrong current password
  const wrongCurrent = await request(app)
    .post('/api/auth/change-password')
    .set(authHeader(ownerToken))
    .send({
      currentPassword: 'WrongPassword!',
      newPassword: 'BrandNewSecurePassword123!',
    });
  assert.equal(wrongCurrent.status, 400);
  assert.equal(wrongCurrent.body.message, 'Current password is incorrect.');

  // B. Reject weak new password (< 8 chars)
  const weakPass = await request(app)
    .post('/api/auth/change-password')
    .set(authHeader(ownerToken))
    .send({
      currentPassword: 'CurrentPassword123!',
      newPassword: 'short',
    });
  assert.equal(weakPass.status, 400);

  // C. Reject new password equal to current password
  const samePass = await request(app)
    .post('/api/auth/change-password')
    .set(authHeader(ownerToken))
    .send({
      currentPassword: 'CurrentPassword123!',
      newPassword: 'CurrentPassword123!',
    });
  assert.equal(samePass.status, 400);

  // D. Valid password change succeeds and rotates session
  const changeRes = await request(app)
    .post('/api/auth/change-password')
    .set(authHeader(ownerToken))
    .send({
      currentPassword: 'CurrentPassword123!',
      newPassword: 'BrandNewSecurePassword123!',
    });
  assert.equal(changeRes.status, 200);
  assert.ok(changeRes.body.token);

  // E. Old token with ver: 1 is now rejected due to authVersion increment (session revocation)
  const revokedAccess = await request(app)
    .get('/api/auth/me')
    .set(authHeader(ownerToken));
  assert.equal(revokedAccess.status, 401);
  assert.match(revokedAccess.body.message, /Session has expired|Session revoked/i);

  // F. Old password no longer works for login
  const oldLogin = await request(app).post('/api/auth/login').send({
    email: 'owner@relayrealestate.example',
    password: 'CurrentPassword123!',
  });
  assert.equal(oldLogin.status, 401);

  // G. New password works for login
  const newLogin = await request(app).post('/api/auth/login').send({
    email: 'owner@relayrealestate.example',
    password: 'BrandNewSecurePassword123!',
  });
  assert.equal(newLogin.status, 200);
  const newToken = newLogin.body.token;

  // H. Security overview shows updated timestamp and audit events
  const secOverview = await request(app)
    .get('/api/settings/security')
    .set(authHeader(newToken));
  assert.equal(secOverview.status, 200);
  assert.ok(secOverview.body.security.passwordLastChanged);
  assert.ok(secOverview.body.security.recentEvents.length >= 1);
});

test('5. Operational Preferences: timezone, date format, quiet hours and notification flags', async () => {
  // Login with new credentials to get active token
  const loginRes = await request(app).post('/api/auth/login').send({
    email: 'owner@relayrealestate.example',
    password: 'BrandNewSecurePassword123!',
  });
  const token = loginRes.body.token;

  // A. Get initial preferences
  const initialPrefs = await request(app)
    .get('/api/settings/preferences')
    .set(authHeader(token));
  assert.equal(initialPrefs.status, 200);
  assert.equal(initialPrefs.body.preferences.timezone, 'Asia/Kolkata');
  assert.equal(initialPrefs.body.preferences.defaultCountryCallingCode, '+91');

  // B. Validation: reject invalid IANA timezone
  const badTz = await request(app)
    .put('/api/settings/preferences')
    .set(authHeader(token))
    .send({ timezone: 'Invalid/City_Nowhere' });
  assert.equal(badTz.status, 400);

  // C. Update operational preferences
  const updatePrefs = await request(app)
    .put('/api/settings/preferences')
    .set(authHeader(token))
    .send({
      timezone: 'Asia/Dubai',
      dateFormat: 'DD/MM/YYYY',
      timeFormat: '24h',
      defaultCountryCallingCode: '+971',
      preferredLanguage: 'English',
      quietHours: { enabled: true, start: '22:00', end: '08:00' },
      notificationPreferences: {
        campaignScheduled: true,
        campaignSimulationCompleted: true,
        campaignRequiresAttention: true,
        incomingReply: false,
        providerDisconnected: true,
      },
      campaignSummaryFrequency: 'daily',
    });
  assert.equal(updatePrefs.status, 200);
  assert.equal(updatePrefs.body.preferences.timezone, 'Asia/Dubai');
  assert.equal(updatePrefs.body.preferences.defaultCountryCallingCode, '+971');
  assert.equal(updatePrefs.body.preferences.quietHours.start, '22:00');

  // D. Verify persistence in MongoDB UserPreferences collection
  const dbPrefs = await UserPreferences.findOne({ ownerId: owner._id });
  assert.equal(dbPrefs.timezone, 'Asia/Dubai');
  assert.equal(dbPrefs.defaultCountryCallingCode, '+971');
  assert.equal(dbPrefs.quietHours.start, '22:00');
});

test('6. WhatsApp Integration State & System Readiness: truthful status and mock safeguards', async () => {
  const loginRes = await request(app).post('/api/auth/login').send({
    email: 'owner@relayrealestate.example',
    password: 'BrandNewSecurePassword123!',
  });
  const token = loginRes.body.token;

  // A. Integration status is truthfully disconnected and in mock mode
  const intRes = await request(app)
    .get('/api/settings/integrations')
    .set(authHeader(token));
  assert.equal(intRes.status, 200);
  assert.equal(intRes.body.integration.connectionStatus, 'Disconnected');
  assert.equal(intRes.body.integration.executionMode, 'Mock Mode (Safe)');
  assert.equal(intRes.body.integration.businessNumber, null);
  assert.equal(intRes.body.integration.wabaId, null);
  assert.match(intRes.body.integration.notice, /Prompt 10/i);

  // B. System status endpoint reports component health and readiness
  const sysRes = await request(app)
    .get('/api/settings/system-status')
    .set(authHeader(token));
  assert.equal(sysRes.status, 200);
  assert.equal(sysRes.body.system.backend, 'connected');
  assert.equal(sysRes.body.system.database, 'connected');
  assert.equal(sysRes.body.system.mockMode, true);
  assert.equal(sysRes.body.system.setupReadiness.businessProfile.status, 'Complete');
  assert.equal(sysRes.body.system.setupReadiness.preferences.status, 'Configured');
});
