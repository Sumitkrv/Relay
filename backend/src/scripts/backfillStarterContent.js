/**
 * Explicit, opt-in starter backfill for workspaces created BEFORE automatic provisioning.
 *
 *   node src/scripts/backfillStarterContent.js                         # dry-run: every workspace (read-only)
 *   node src/scripts/backfillStarterContent.js --workspace=<id>        # dry-run: one workspace
 *   node src/scripts/backfillStarterContent.js --workspace=<id> --apply  # insert ONLY missing starters
 *
 * --apply requires an explicit single --workspace. Existing records (including edited
 * templates and the enabled/disabled state of rules) are never modified.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import Workspace from '../models/Workspace.js';
import { inspectWorkspaceStarterData, provisionWorkspaceStarterData } from '../services/industryStarterProvisioningService.js';

const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const apply = process.argv.includes('--apply');
const workspaceId = arg('workspace');

async function main() {
  if (apply && !workspaceId) throw new Error('--apply requires --workspace=<id>. Bulk backfill is intentionally not supported.');
  if (workspaceId && !mongoose.isObjectIdOrHexString(workspaceId)) throw new Error('Invalid --workspace id.');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000, ...(process.env.DATABASE_NAME ? { dbName: process.env.DATABASE_NAME } : {}) });
  console.log(`Database: ${mongoose.connection.db.databaseName}  mode: ${apply ? 'APPLY' : 'DRY-RUN'}`);

  const workspaces = await Workspace.find(workspaceId ? { _id: workspaceId } : {}).select('name slug industryKey createdBy starterProvisioning').lean();
  const rows = [];
  for (const ws of workspaces) {
    try {
      const inv = await inspectWorkspaceStarterData(ws._id, ws.industryKey);
      rows.push({ slug: ws.slug, industry: inv.industryKey, provisioning: ws.starterProvisioning?.status || 'legacy', missingTemplates: inv.missing.templates, missingReplies: inv.missing.quickReplies, missingRules: inv.missing.rules, missingDrafts: inv.missing.campaigns });
    } catch (err) {
      rows.push({ slug: ws.slug, industry: ws.industryKey, provisioning: 'ERROR', note: err.message });
    }
  }
  console.table(rows);

  if (!apply) return;
  const ws = workspaces[0];
  if (!ws) throw new Error('Workspace not found.');
  const result = await provisionWorkspaceStarterData({ workspaceId: ws._id, ownerId: ws.createdBy, industryKey: ws.industryKey, force: true });
  console.log('Backfill result:', JSON.stringify(result));
}

main()
  .catch((err) => {
    console.error(`Backfill failed: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
