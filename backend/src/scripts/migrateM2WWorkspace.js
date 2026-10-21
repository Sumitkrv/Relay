import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import {
  runM2WMigration,
  rollbackM2WMigration,
  verifyM2WMigration,
  resolveM2WOwner,
  MIGRATION_COLLECTIONS,
} from '../services/m2wMigrationService.js';
import MigrationCheckpoint from '../models/MigrationCheckpoint.js';
import Workspace from '../models/Workspace.js';
import WorkspaceMembership from '../models/WorkspaceMembership.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

function parseArgs() {
  const args = process.argv.slice(2);
  const flags = {
    status: false,
    dryRun: false,
    execute: false,
    verify: false,
    rollback: false,
    skipBackup: false,
    ownerId: null,
    ownerEmail: null,
    migrationId: null,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--status') flags.status = true;
    else if (arg === '--dry-run') flags.dryRun = true;
    else if (arg === '--execute') flags.execute = true;
    else if (arg === '--verify') flags.verify = true;
    else if (arg === '--rollback') flags.rollback = true;
    else if (arg === '--skip-backup') flags.skipBackup = true;
    else if (arg === '--owner-id' && args[i + 1]) flags.ownerId = args[++i];
    else if (arg === '--owner-email' && args[i + 1]) flags.ownerEmail = args[++i];
    else if (arg === '--migration-id' && args[i + 1]) flags.migrationId = args[++i];
  }

  return flags;
}

async function handleStatus(flags) {
  console.log('\n======================================================');
  console.log('RELAY SAAS — M2W MIGRATION STATUS AUDIT');
  console.log('======================================================');

  const db = mongoose.connection.db;
  console.log(`Database Connected: ${db.databaseName}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

  try {
    const resolution = await resolveM2WOwner({
      ownerId: flags.ownerId,
      ownerEmail: flags.ownerEmail,
    });
    console.log(`Authoritative M2W Owner: ${resolution.owner.name} (${resolution.owner.email}) [ID: ${resolution.owner._id}]`);
    console.log(`Resolution Source: ${resolution.source}`);

    const ws = await Workspace.findOne({
      $or: [{ slug: 'm2w-realty' }, { createdBy: resolution.owner._id }],
    });
    if (ws) {
      console.log(`M2W Workspace: [${ws.status}] ${ws.name} (Slug: ${ws.slug}, ID: ${ws._id})`);
      const mem = await WorkspaceMembership.findOne({ workspaceId: ws._id, userId: resolution.owner._id });
      console.log(`Owner Membership: ${mem ? `[${mem.status}] Role: ${mem.role} (ID: ${mem._id})` : 'NOT FOUND'}`);
    } else {
      console.log('M2W Workspace: NOT YET PROVISIONED');
    }

    console.log('\n--- COLLECTION INVENTORY & MIGRATION COVERAGE ---');
    console.log(
      'Collection'.padEnd(28) +
      'Total Docs'.padStart(12) +
      'Owner Docs'.padStart(12) +
      'Migrated'.padStart(12) +
      'Unmigrated'.padStart(12)
    );
    console.log('-'.repeat(76));

    const existingCols = (await db.listCollections().toArray()).map((c) => c.name);
    let totalEligible = 0;
    let totalMigrated = 0;

    for (const colName of MIGRATION_COLLECTIONS) {
      if (!existingCols.includes(colName)) continue;
      const col = db.collection(colName);
      const totalCount = await col.countDocuments();
      if (totalCount === 0) continue;

      const ownerCount = await col.countDocuments({ ownerId: resolution.owner._id });
      const migratedCount = ws
        ? await col.countDocuments({ ownerId: resolution.owner._id, workspaceId: ws._id })
        : 0;
      const unmigratedCount = ws
        ? await col.countDocuments({
            ownerId: resolution.owner._id,
            $or: [{ workspaceId: { $exists: false } }, { workspaceId: null }],
          })
        : ownerCount;

      totalEligible += ownerCount;
      totalMigrated += migratedCount;

      console.log(
        colName.padEnd(28) +
        String(totalCount).padStart(12) +
        String(ownerCount).padStart(12) +
        String(migratedCount).padStart(12) +
        String(unmigratedCount).padStart(12)
      );
    }
    console.log('-'.repeat(76));
    console.log(`TOTALS: Owner Documents: ${totalEligible} | Migrated to M2W Workspace: ${totalMigrated}`);

    // Recent checkpoints
    const checkpoints = await MigrationCheckpoint.find({}).sort({ createdAt: -1 }).limit(3);
    console.log('\n--- RECENT MIGRATION CHECKPOINTS ---');
    if (!checkpoints.length) {
      console.log('No migration checkpoints recorded.');
    } else {
      for (const cp of checkpoints) {
        console.log(`[${cp.status}] ID: ${cp.migrationId} | Mode: ${cp.mode} | Migrated: ${cp.totals.migrated} | Started: ${cp.startedAt.toISOString()}`);
      }
    }
  } catch (err) {
    console.error('Status Audit Error:', err.message);
  }
}

async function main() {
  const flags = parseArgs();

  // If no action specified, default to dry-run
  if (!flags.status && !flags.dryRun && !flags.execute && !flags.verify && !flags.rollback) {
    flags.dryRun = true;
  }

  await connectDB();

  try {
    if (flags.status) {
      await handleStatus(flags);
    } else if (flags.dryRun) {
      console.log('\n======================================================');
      console.log('RELAY SAAS — M2W MIGRATION DRY RUN (ZERO WRITES)');
      console.log('======================================================');
      const result = await runM2WMigration({
        mode: 'DRY_RUN',
        ownerId: flags.ownerId,
        ownerEmail: flags.ownerEmail,
      });

      console.log(`\nVerified Owner: ${result.verifiedOwner.name} (${result.verifiedOwner.email})`);
      console.log(`Resolution Source: ${result.verifiedOwner.resolutionSource}`);
      console.log(`Target Workspace: ${result.targetWorkspace.name} (Slug: ${result.targetWorkspace.slug}) [Existing: ${result.targetWorkspace.isExisting}]`);
      console.log(`Target Membership Role: ${result.targetMembership.role} [Existing: ${result.targetMembership.isExisting}]`);
      console.log(`Parent-Child Consistency Issues: ${result.parentChildIssues.length}`);

      console.log('\n--- PROJECTED BACKFILL SUMMARY ---');
      console.log(
        'Collection'.padEnd(28) +
        'Scanned'.padStart(10) +
        'Eligible'.padStart(10) +
        'Projected'.padStart(12) +
        'Already Mig'.padStart(12)
      );
      console.log('-'.repeat(72));

      for (const r of result.collectionReports) {
        console.log(
          r.collectionName.padEnd(28) +
          String(r.scannedCount).padStart(10) +
          String(r.eligibleCount).padStart(10) +
          String(r.projectedMigration).padStart(12) +
          String(r.alreadyMigratedCount).padStart(12)
        );
      }
      console.log('-'.repeat(72));
      console.log(`TOTALS: Scanned: ${result.totals.scanned} | Eligible: ${result.totals.eligible} | Already Migrated: ${result.totals.alreadyMigrated}`);
      console.log('\nDRY RUN COMPLETED: 0 database writes executed. System ready for controlled migration.');
    } else if (flags.execute) {
      console.log('\n======================================================');
      console.log('RELAY SAAS — CONTROLLED M2W MIGRATION EXECUTION');
      console.log('======================================================');

      const result = await runM2WMigration({
        mode: 'EXECUTE',
        ownerId: flags.ownerId,
        ownerEmail: flags.ownerEmail,
        skipBackup: flags.skipBackup,
      });

      console.log(`\nMigration Checkpoint ID: ${result.migrationId}`);
      console.log(`Verified Owner: ${result.verifiedOwner.name} (${result.verifiedOwner.email})`);
      console.log(`Workspace Assigned: ${result.targetWorkspace.name} (${result.targetWorkspace.slug})`);
      if (result.backup) {
        console.log(`Verified Backup Created at: ${result.backup.backupFolder}`);
      }
      console.log(`\nTotal Records Migrated: ${result.totals.migrated}`);
      console.log(`Already Migrated Records: ${result.totals.alreadyMigrated}`);
      console.log(`Conflicts: ${result.totals.conflicts}`);
      console.log('\nMIGRATION COMPLETED SUCCESSFULLY.');
    } else if (flags.verify) {
      console.log('\n======================================================');
      console.log('RELAY SAAS — M2W MIGRATION VERIFICATION');
      console.log('======================================================');
      const vResult = await verifyM2WMigration({ ownerId: flags.ownerId });
      console.log(`Verification Status: ${vResult.verified ? 'PASS' : 'FAIL'}`);
      if (vResult.workspace) {
        console.log(`Workspace: ${vResult.workspace.name} (${vResult.workspace.slug})`);
      }
      console.log(`All Records Migrated: ${vResult.allMigrated}`);
      console.log(`Consent Records Intact: ${vResult.consentValid}`);
      if (!vResult.verified) {
        console.log(`Reason: ${vResult.reason || 'Unmigrated records detected'}`);
        process.exitCode = 1;
      }
    } else if (flags.rollback) {
      console.log('\n======================================================');
      console.log('RELAY SAAS — M2W MIGRATION ROLLBACK');
      console.log('======================================================');
      const rbResult = await rollbackM2WMigration({
        migrationId: flags.migrationId,
        ownerId: flags.ownerId,
      });
      console.log(`Rollback Checkpoint ID: ${rbResult.migrationId}`);
      console.log(`Total Records Reverted: ${rbResult.totalRecordsReverted}`);
      console.log('\nROLLBACK COMPLETED SUCCESSFULLY.');
    }
  } catch (err) {
    console.error('\nMIGRATION FATAL ERROR:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

main();
