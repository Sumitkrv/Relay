#!/usr/bin/env node
/**
 * RELAY SAAS — SECURE PLATFORM SUPER ADMIN BOOTSTRAP CLI
 *
 * Usage:
 *   node backend/src/scripts/bootstrapPlatformAdmin.js --email admin@example.com
 *   node backend/src/scripts/bootstrapPlatformAdmin.js --userId 60c72b2f9b1d8b2bad5e1234
 *
 * Invariants:
 * 1. CLI only - never exposed via HTTP.
 * 2. Requires explicit target user identification (email or ID).
 * 3. Idempotent: checks if active grant already exists.
 * 4. Records authoritative audit event in PlatformAuditLog.
 * 5. Does NOT create synthetic accounts or hardcode passwords.
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/User.js';
import PlatformAdminGrant, { ALL_PLATFORM_PERMISSIONS } from '../models/PlatformAdminGrant.js';
import PlatformAuditLog from '../models/PlatformAuditLog.js';

dotenv.config();

async function run() {
  const args = process.argv.slice(2);
  let targetEmail = null;
  let targetUserId = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--email' && args[i + 1]) {
      targetEmail = args[i + 1].trim().toLowerCase();
      i++;
    } else if (args[i] === '--userId' && args[i + 1]) {
      targetUserId = args[i + 1].trim();
      i++;
    }
  }

  if (!targetEmail && !targetUserId) {
    console.error('Error: You must provide either --email or --userId to bootstrap a Platform Super Admin.');
    console.error('Usage: node backend/src/scripts/bootstrapPlatformAdmin.js --email <email>');
    process.exit(1);
  }

  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/relay';
  await mongoose.connect(mongoUri);

  try {
    let query = {};
    if (targetUserId) {
      query = { _id: targetUserId };
    } else {
      query = { email: targetEmail };
    }

    const user = await User.findOne(query);
    if (!user) {
      console.error(`Error: User not found for query: ${JSON.stringify(query)}`);
      process.exit(1);
    }

    if (user.accountStatus === 'SUSPENDED' || user.accountStatus === 'DISABLED') {
      console.error(`Error: Cannot grant admin privileges to a ${user.accountStatus} account.`);
      process.exit(1);
    }

    // Check existing grant
    const existing = await PlatformAdminGrant.findOne({ userId: user._id });
    if (existing && existing.status === 'ACTIVE') {
      console.log(`User ${user.email} (${user._id}) already has an ACTIVE ${existing.role} grant. Idempotent exit.`);
      await mongoose.disconnect();
      process.exit(0);
    }

    if (existing && existing.status !== 'ACTIVE') {
      // Reactivate revoked grant
      existing.status = 'ACTIVE';
      existing.role = 'PLATFORM_SUPER_ADMIN';
      existing.permissions = [...ALL_PLATFORM_PERMISSIONS];
      existing.revokedAt = null;
      existing.revocationReason = null;
      existing.approvedAt = new Date();
      existing.grantedBy = 'CLI_BOOTSTRAP';
      await existing.save();

      await PlatformAuditLog.create({
        adminUserId: user._id,
        platformRole: 'PLATFORM_SUPER_ADMIN',
        actionType: 'admin_grant_reactivated',
        targetResourceType: 'PLATFORM_GRANT',
        targetResourceId: existing._id.toString(),
        reason: 'Reactivated via secure CLI bootstrap script',
        outcome: 'SUCCESS',
        metadata: { userId: user._id.toString(), email: user.email },
      });

      console.log(`Successfully reactivated PLATFORM_SUPER_ADMIN grant for user: ${user.email} (${user._id})`);
      await mongoose.disconnect();
      process.exit(0);
    }

    // Create fresh grant
    const grant = await PlatformAdminGrant.create({
      userId: user._id,
      role: 'PLATFORM_SUPER_ADMIN',
      status: 'ACTIVE',
      permissions: [...ALL_PLATFORM_PERMISSIONS],
      grantedBy: 'CLI_BOOTSTRAP',
      approvedAt: new Date(),
    });

    await PlatformAuditLog.create({
      adminUserId: user._id,
      platformRole: 'PLATFORM_SUPER_ADMIN',
      actionType: 'admin_grant_created',
      targetResourceType: 'PLATFORM_GRANT',
      targetResourceId: grant._id.toString(),
      reason: 'Initial bootstrap via secure operator CLI',
      outcome: 'SUCCESS',
      metadata: { userId: user._id.toString(), email: user.email, role: 'PLATFORM_SUPER_ADMIN' },
    });

    console.log(`[SUCCESS] Platform Super Admin privileges granted to user: ${user.email} (${user._id})`);
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1]?.endsWith('bootstrapPlatformAdmin.js')) {
  run().catch((err) => {
    console.error('Fatal bootstrap error:', err);
    process.exit(1);
  });
}

export { run };
