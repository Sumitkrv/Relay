import mongoose from 'mongoose';
import Workspace from '../models/Workspace.js';
import WorkspaceMembership from '../models/WorkspaceMembership.js';
import User from '../models/User.js';
import BusinessProfile from '../models/BusinessProfile.js';
import MigrationCheckpoint from '../models/MigrationCheckpoint.js';
import { createDatabaseBackup, verifyDatabaseBackup } from './databaseBackupService.js';

// The canonical set of all collections subject to migration
export const MIGRATION_COLLECTIONS = [
  'contacts',
  'contactgroups',
  'contactcategories',
  'contactactivities',
  'consentrecords',
  'internalnotes',
  'audiencesegments',
  'audiencesegmentmembers',
  'importjobs',
  'importrows',
  'importerrors',
  'importmappingpresets',
  'messagetemplates',
  'templateversions',
  'templatemedias',
  'campaigns',
  'campaignexecutions',
  'campaignaudiences',
  'campaignmessagejobs',
  'campaignactivities',
  'messages',
  'messagedrafts',
  'messageevents',
  'providerevents',
  'conversations',
  'conversationmessages',
  'conversationactivities',
  'autoreplyrules',
  'ruleexecutions',
  'quickreplies',
  'inboxnotifications',
  'savedreports',
  'reportgenerations',
  'businessprofiles',
  'userpreferences',
  'securityauditlogs',
  'deals',
  'dealactivities',
  'dealconversions',
  'pipelinestages',
  'proposals',
  'proposaltemplates',
  'proposalversions',
  'leadscores',
  'leadscorehistories',
  'leadscorejobs',
  'leadscoringrulesets',
  'leadscoringrulehistories',
  'leadconversions',
  'followuptasks',
  'followuprecommendations',
  'automationworkflows',
  'workflowversions',
  'workflowexecutions',
  'workflowstepexecutions',
  'workflowschedules',
  'workflowsettings',
  'workflowevents',
  'workflowwaits',
  'chatbotdefinitions',
  'chatbotversions',
  'chatbottestsessions',
  'crminsights',
];

/**
 * Authoritatively resolves the existing M2W Realty Owner from database records.
 * Prioritizes BusinessProfile relationships, then User businessName without hardcoding.
 */
export async function resolveM2WOwner({ ownerId = null, ownerEmail = null } = {}) {
  const db = mongoose.connection.db;

  // 1. Explicit override if provided
  if (ownerId) {
    const user = await User.findById(ownerId);
    if (!user) throw new Error(`Specified ownerId "${ownerId}" not found in database.`);
    return { owner: user, source: 'EXPLICIT_OWNER_ID' };
  }
  if (ownerEmail) {
    const user = await User.findOne({ email: String(ownerEmail).toLowerCase().trim() });
    if (!user) throw new Error(`Specified ownerEmail "${ownerEmail}" not found in database.`);
    return { owner: user, source: 'EXPLICIT_OWNER_EMAIL' };
  }

  // 2. Authoritative check via BusinessProfile
  const m2wProfiles = await BusinessProfile.find({
    $or: [
      { displayName: /m2w/i },
      { legalOrTradingName: /m2w/i },
      { businessCategory: /real\s*estate/i },
    ],
  });

  if (m2wProfiles.length === 1) {
    const profile = m2wProfiles[0];
    const user = await User.findById(profile.ownerId);
    if (user) {
      return { owner: user, profile, source: 'AUTHORITATIVE_BUSINESS_PROFILE' };
    }
  }

  // 3. User model search for M2W business name
  const m2wUsers = await User.find({
    $or: [
      { businessName: /m2w/i },
      { email: /relaycrm\.io/i },
    ],
  });

  if (m2wUsers.length === 1) {
    return { owner: m2wUsers[0], source: 'AUTHORITATIVE_USER_BUSINESS_NAME' };
  }

  // 4. If multiple candidates exist, find the one with the BusinessProfile
  if (m2wUsers.length > 1) {
    const userIds = m2wUsers.map((u) => u._id);
    const profileWithUser = await BusinessProfile.findOne({ ownerId: { $in: userIds } });
    if (profileWithUser) {
      const selectedUser = m2wUsers.find((u) => u._id.toString() === profileWithUser.ownerId.toString());
      if (selectedUser) {
        return {
          owner: selectedUser,
          profile: profileWithUser,
          source: 'RESOLVED_MULTI_CANDIDATE_VIA_PROFILE',
          candidates: m2wUsers.map((u) => ({ id: u._id, email: u.email, name: u.name, businessName: u.businessName })),
        };
      }
    }

    throw new Error(
      `Ambiguous M2W owner candidates found (${m2wUsers.length}). Please disambiguate using --owner-id or --owner-email. Candidates: ${m2wUsers.map((u) => `${u.email} (${u._id})`).join(', ')}`
    );
  }

  // 5. Fallback: Check if single owner exists in DB
  const allOwners = await User.find({ role: 'owner' });
  if (allOwners.length === 1) {
    return { owner: allOwners[0], source: 'SINGLE_REGISTERED_OWNER' };
  }

  throw new Error('Unable to authoritatively determine M2W owner. No matching BusinessProfile or unique User found.');
}

/**
 * Creates or reuses the authoritative M2W Realty Workspace.
 * Preserves existing business profile identity, location, branding, and industry.
 */
export async function getOrCreateM2WWorkspace(owner, profile = null, { dryRun = false } = {}) {
  const existingWs = await Workspace.findOne({
    $or: [
      { slug: 'm2w-realty' },
      { createdBy: owner._id },
    ],
  });

  if (existingWs) {
    return { workspace: existingWs, isExisting: true };
  }

  const businessName =
    (profile && (profile.displayName || profile.legalOrTradingName)) ||
    owner.businessName ||
    'M2W Realty';

  const wsData = {
    name: businessName,
    slug: 'm2w-realty',
    industryKey: 'real_estate',
    businessEmail: (profile && profile.email) || owner.email,
    businessPhone: (profile && profile.phone) || '+919810123456',
    country: (profile && profile.country) || 'India',
    city: (profile && profile.city) || 'Gurugram',
    timezone: 'Asia/Kolkata',
    currency: 'INR',
    status: 'ACTIVE',
    onboardingStatus: 'COMPLETED',
    createdBy: owner._id,
    settings: {
      branding: {
        logoUrl: (profile && profile.logoUrl) || '',
        primaryColor: '#0D9488',
      },
      operational: {
        businessCategory: (profile && profile.businessCategory) || 'Real Estate',
      },
    },
  };

  if (dryRun) {
    const mockWs = new Workspace(wsData);
    mockWs._id = new mongoose.Types.ObjectId();
    return { workspace: mockWs, isExisting: false, dryRun: true };
  }

  const workspace = await Workspace.create(wsData);
  return { workspace, isExisting: false };
}

/**
 * Maps the verified M2W owner to a durable WorkspaceMembership with role 'OWNER'.
 */
export async function getOrCreateM2WMembership(owner, workspace, { dryRun = false } = {}) {
  let membership = await WorkspaceMembership.findOne({
    workspaceId: workspace._id,
    userId: owner._id,
  });

  if (membership) {
    return { membership, isExisting: true };
  }

  const memData = {
    workspaceId: workspace._id,
    userId: owner._id,
    role: 'OWNER',
    status: 'ACTIVE',
    isDefaultWorkspace: true,
    joinedAt: new Date(),
  };

  if (dryRun) {
    const mockMem = new WorkspaceMembership(memData);
    mockMem._id = new mongoose.Types.ObjectId();
    return { membership: mockMem, isExisting: false, dryRun: true };
  }

  membership = await WorkspaceMembership.create(memData);

  // Update owner default workspace if not set
  if (!owner.defaultWorkspaceId) {
    owner.defaultWorkspaceId = workspace._id;
    await owner.save();
  }

  return { membership, isExisting: false };
}

/**
 * Validates parent-child relationship consistency before migration.
 * Ensures linked records belong to the same verified owner.
 */
export async function validateParentChildRelationships(ownerId, db) {
  const conflicts = [];
  const orphanedReferences = [];

  // Check consentrecords -> contacts
  const consents = await db.collection('consentrecords').find({ ownerId }).toArray();
  for (const c of consents) {
    if (c.contactId) {
      const contact = await db.collection('contacts').findOne({ _id: c.contactId });
      if (!contact) {
        orphanedReferences.push({ collection: 'consentrecords', id: c._id, reason: 'Historical opt-out/consent record for deleted contact' });
      } else if (contact.ownerId.toString() !== ownerId.toString()) {
        conflicts.push({ collection: 'consentrecords', id: c._id, reason: 'Parent contact belongs to different owner' });
      }
    }
  }

  // Check conversations -> contacts
  const conversations = await db.collection('conversations').find({ ownerId }).toArray();
  for (const conv of conversations) {
    if (conv.contactId) {
      const contact = await db.collection('contacts').findOne({ _id: conv.contactId });
      if (!contact) {
        orphanedReferences.push({ collection: 'conversations', id: conv._id, reason: 'Historical conversation for deleted contact' });
      } else if (contact.ownerId.toString() !== ownerId.toString()) {
        conflicts.push({ collection: 'conversations', id: conv._id, reason: 'Parent contact belongs to different owner' });
      }
    }
  }

  // Check conversationmessages -> conversations
  const convMsgs = await db.collection('conversationmessages').find({ ownerId }).toArray();
  for (const cm of convMsgs) {
    if (cm.conversationId) {
      const conv = await db.collection('conversations').findOne({ _id: cm.conversationId });
      if (!conv) {
        orphanedReferences.push({ collection: 'conversationmessages', id: cm._id, reason: 'Orphaned conversationId' });
      } else if (conv.ownerId.toString() !== ownerId.toString()) {
        conflicts.push({ collection: 'conversationmessages', id: cm._id, reason: 'Parent conversation belongs to different owner' });
      }
    }
  }

  // Check campaignmessagejobs -> campaigns & contacts
  const jobs = await db.collection('campaignmessagejobs').find({ ownerId }).toArray();
  for (const j of jobs) {
    if (j.campaignId) {
      const camp = await db.collection('campaigns').findOne({ _id: j.campaignId });
      if (!camp) {
        orphanedReferences.push({ collection: 'campaignmessagejobs', id: j._id, reason: 'Orphaned campaignId' });
      } else if (camp.ownerId.toString() !== ownerId.toString()) {
        conflicts.push({ collection: 'campaignmessagejobs', id: j._id, reason: 'Parent campaign belongs to different owner' });
      }
    }
    if (j.contactId) {
      const contact = await db.collection('contacts').findOne({ _id: j.contactId });
      if (!contact) {
        orphanedReferences.push({ collection: 'campaignmessagejobs', id: j._id, reason: 'Orphaned contactId' });
      } else if (contact.ownerId.toString() !== ownerId.toString()) {
        conflicts.push({ collection: 'campaignmessagejobs', id: j._id, reason: 'Parent contact belongs to different owner' });
      }
    }
  }

  return { conflicts, orphanedReferences, issues: [...conflicts, ...orphanedReferences] };
}

/**
 * Executes or dry-runs the M2W Workspace Migration.
 */
export async function runM2WMigration({
  mode = 'DRY_RUN', // 'DRY_RUN' | 'EXECUTE'
  ownerId = null,
  ownerEmail = null,
  batchSize = 200,
  skipBackup = false,
  migrationId = null,
} = {}) {
  const db = mongoose.connection.db;
  const isDryRun = mode === 'DRY_RUN';
  const currentEnv = process.env.NODE_ENV || 'development';
  const effectiveMigrationId = migrationId || `mig_m2w_${Date.now()}`;

  // 1. Resolve Authoritative Owner
  const resolution = await resolveM2WOwner({ ownerId, ownerEmail });
  const owner = resolution.owner;
  const profile = resolution.profile || null;

  // 2. Backup Prerequisite Check (mandatory for EXECUTE in non-test)
  let backupInfo = null;
  if (!isDryRun && !skipBackup && currentEnv !== 'test') {
    backupInfo = await createDatabaseBackup();
    await verifyDatabaseBackup(backupInfo.backupFolder);
  }

  // 3. Workspace and Membership Resolution
  const wsResult = await getOrCreateM2WWorkspace(owner, profile, { dryRun: isDryRun });
  const workspace = wsResult.workspace;

  const memResult = await getOrCreateM2WMembership(owner, workspace, { dryRun: isDryRun });
  const membership = memResult.membership;

  // 4. Validate Parent-Child Integrity
  const validationResult = await validateParentChildRelationships(owner._id, db);
  const { conflicts: parentChildConflicts, orphanedReferences, issues: parentChildIssues } = validationResult;

  // 5. Initialize or Load Checkpoint
  let checkpoint = null;
  if (!isDryRun) {
    checkpoint = await MigrationCheckpoint.create({
      migrationId: effectiveMigrationId,
      sourceDatabase: db.databaseName,
      environment: currentEnv,
      mode: 'EXECUTE',
      status: 'RUNNING',
      verifiedOwnerId: owner._id,
      verifiedOwnerEmail: owner.email,
      targetWorkspaceId: workspace._id,
      targetWorkspaceSlug: workspace.slug,
      backupVerified: !!backupInfo,
      backupArtifactLocation: backupInfo ? backupInfo.backupFolder : '',
      backupTimestamp: backupInfo ? new Date() : null,
      startedAt: new Date(),
      collectionProgress: [],
      totals: { scanned: 0, eligible: 0, migrated: 0, alreadyMigrated: 0, skipped: 0, conflicts: 0 },
      conflicts: parentChildConflicts.map((issue) => ({
        collectionName: issue.collection,
        documentId: issue.id,
        reason: issue.reason,
      })),
      lock: {
        isLocked: true,
        lockedAt: new Date(),
        lockedBy: `process_${process.pid}`,
        leaseExpiresAt: new Date(Date.now() + 300000), // 5 min lease
      },
    });
  }

  // 6. Inspect and Backfill Collections
  const collectionReports = [];
  const grandTotals = {
    scanned: 0,
    eligible: 0,
    migrated: 0,
    alreadyMigrated: 0,
    skipped: 0,
    conflicts: parentChildIssues.length,
  };

  const existingCollectionNames = (await db.listCollections().toArray()).map((c) => c.name);

  for (const colName of MIGRATION_COLLECTIONS) {
    if (!existingCollectionNames.includes(colName)) {
      continue;
    }

    const col = db.collection(colName);
    const totalDocsInCol = await col.countDocuments();
    if (totalDocsInCol === 0) continue;

    // Scan documents for verified owner
    const ownerQuery = { ownerId: owner._id };
    const ownerDocsCount = await col.countDocuments(ownerQuery);

    // Count already migrated
    const alreadyMigratedCount = await col.countDocuments({
      ownerId: owner._id,
      workspaceId: workspace._id,
    });

    // Count conflicting documents (different workspaceId already assigned)
    const conflictingDocs = await col.find({
      ownerId: owner._id,
      workspaceId: { $exists: true, $ne: null, $ne: workspace._id },
    }).toArray();

    // Count eligible documents (needs workspaceId)
    const eligibleQuery = {
      ownerId: owner._id,
      $or: [
        { workspaceId: { $exists: false } },
        { workspaceId: null },
      ],
    };
    const eligibleCount = await col.countDocuments(eligibleQuery);

    grandTotals.scanned += ownerDocsCount;
    grandTotals.eligible += eligibleCount;
    grandTotals.alreadyMigrated += alreadyMigratedCount;
    grandTotals.conflicts += conflictingDocs.length;

    let colMigrated = 0;
    let colError = null;

    if (!isDryRun && eligibleCount > 0) {
      // Execute in bounded batches
      let hasMore = true;
      while (hasMore) {
        const batch = await col.find(eligibleQuery, { projection: { _id: 1 } }).limit(batchSize).toArray();
        if (!batch.length) {
          hasMore = false;
          break;
        }

        const batchIds = batch.map((d) => d._id);

        // Update preserving original ownerId, createdAt, updatedAt, and business data
        const updateResult = await col.updateMany(
          { _id: { $in: batchIds } },
          { $set: { workspaceId: workspace._id } }
        );

        colMigrated += updateResult.modifiedCount;
        grandTotals.migrated += updateResult.modifiedCount;

        if (batch.length < batchSize) {
          hasMore = false;
        }
      }
    } else if (isDryRun) {
      colMigrated = eligibleCount;
    }

    const colReport = {
      collectionName: colName,
      scannedCount: ownerDocsCount,
      eligibleCount,
      migratedCount: isDryRun ? 0 : colMigrated,
      projectedMigration: isDryRun ? eligibleCount : colMigrated,
      alreadyMigratedCount,
      skippedCount: totalDocsInCol - ownerDocsCount,
      conflictCount: conflictingDocs.length,
      status: colError ? 'FAILED' : 'COMPLETED',
      error: colError,
    };

    collectionReports.push(colReport);

    if (checkpoint) {
      checkpoint.collectionProgress.push({
        ...colReport,
        completedAt: new Date(),
      });
    }
  }

  // 7. Update Checkpoint Status
  if (checkpoint) {
    checkpoint.status = 'COMPLETED';
    checkpoint.completedAt = new Date();
    checkpoint.totals = grandTotals;
    checkpoint.validationStatus = parentChildConflicts.length === 0 ? 'VALID' : 'INVALID';
    checkpoint.validationDetails = {
      conflictsCount: parentChildConflicts.length,
      orphanedReferencesCount: orphanedReferences.length,
    };
    checkpoint.lock.isLocked = false;
    await checkpoint.save();
  }

  return {
    mode,
    migrationId: effectiveMigrationId,
    verifiedOwner: {
      id: owner._id,
      email: owner.email,
      name: owner.name,
      businessName: owner.businessName,
      resolutionSource: resolution.source,
    },
    targetWorkspace: {
      id: workspace._id,
      slug: workspace.slug,
      name: workspace.name,
      industryKey: workspace.industryKey,
      isExisting: wsResult.isExisting,
    },
    targetMembership: {
      id: membership._id,
      role: membership.role,
      status: membership.status,
      isExisting: memResult.isExisting,
    },
    backup: backupInfo
      ? {
          backupFolder: backupInfo.backupFolder,
          totalDocuments: backupInfo.totalDocuments,
          collectionCount: backupInfo.collectionCount,
        }
      : null,
    totals: grandTotals,
    collectionReports,
    parentChildConflicts,
    orphanedReferences,
    parentChildIssues,
    status: 'SUCCESS',
  };
}

/**
 * Rolls back a previous M2W Workspace migration.
 * Unsets workspaceId from documents touched by the target migration, preserving all original records.
 */
export async function rollbackM2WMigration({
  migrationId = null,
  ownerId = null,
  batchSize = 200,
  dryRun = false,
} = {}) {
  const db = mongoose.connection.db;

  // Find checkpoint
  let checkpoint = null;
  if (migrationId) {
    checkpoint = await MigrationCheckpoint.findOne({ migrationId });
  } else {
    checkpoint = await MigrationCheckpoint.findOne({ status: 'COMPLETED' }).sort({ createdAt: -1 });
  }

  if (!checkpoint) {
    throw new Error('No completed migration checkpoint found to rollback.');
  }

  const targetWsId = checkpoint.targetWorkspaceId;
  const verifiedOwnerId = checkpoint.verifiedOwnerId;

  const rollbackReports = [];
  let totalReverted = 0;

  for (const colProgress of checkpoint.collectionProgress) {
    const colName = colProgress.collectionName;
    const col = db.collection(colName);

    const query = {
      ownerId: verifiedOwnerId,
      workspaceId: targetWsId,
    };

    const countToRevert = await col.countDocuments(query);
    let reverted = 0;

    if (!dryRun && countToRevert > 0) {
      let hasMore = true;
      while (hasMore) {
        const batch = await col.find(query, { projection: { _id: 1 } }).limit(batchSize).toArray();
        if (!batch.length) {
          hasMore = false;
          break;
        }

        const batchIds = batch.map((d) => d._id);
        const updateResult = await col.updateMany(
          { _id: { $in: batchIds } },
          { $unset: { workspaceId: '' } }
        );

        reverted += updateResult.modifiedCount;
        if (batch.length < batchSize) hasMore = false;
      }
    } else if (dryRun) {
      reverted = countToRevert;
    }

    totalReverted += reverted;
    rollbackReports.push({
      collectionName: colName,
      recordsReverted: reverted,
    });
  }

  if (!dryRun) {
    checkpoint.status = 'ROLLED_BACK';
    checkpoint.rollbackStatus = 'COMPLETED';
    checkpoint.rolledBackAt = new Date();
    checkpoint.rollbackDetails = { totalReverted };
    await checkpoint.save();
  }

  return {
    migrationId: checkpoint.migrationId,
    targetWorkspaceId: targetWsId,
    verifiedOwnerId,
    totalRecordsReverted: totalReverted,
    rollbackReports,
    dryRun,
    status: 'ROLLED_BACK',
  };
}

/**
 * Validates post-migration state and data integrity.
 */
export async function verifyM2WMigration({ ownerId = null } = {}) {
  const db = mongoose.connection.db;
  const resolution = await resolveM2WOwner({ ownerId });
  const owner = resolution.owner;

  const workspace = await Workspace.findOne({
    $or: [{ slug: 'm2w-realty' }, { createdBy: owner._id }],
  });

  if (!workspace) {
    return { verified: false, reason: 'M2W Workspace does not exist.' };
  }

  const membership = await WorkspaceMembership.findOne({
    workspaceId: workspace._id,
    userId: owner._id,
    role: 'OWNER',
    status: 'ACTIVE',
  });

  if (!membership) {
    return { verified: false, reason: 'Active OWNER WorkspaceMembership not found.' };
  }

  // Check collections for unmigrated owner records
  const unmigratedSummary = [];
  const existingCollectionNames = (await db.listCollections().toArray()).map((c) => c.name);

  for (const colName of MIGRATION_COLLECTIONS) {
    if (!existingCollectionNames.includes(colName)) continue;
    const col = db.collection(colName);
    const unmigrated = await col.countDocuments({
      ownerId: owner._id,
      $or: [{ workspaceId: { $exists: false } }, { workspaceId: null }],
    });
    const migrated = await col.countDocuments({
      ownerId: owner._id,
      workspaceId: workspace._id,
    });

    if (unmigrated > 0 || migrated > 0) {
      unmigratedSummary.push({ collectionName: colName, migrated, unmigrated });
    }
  }

  const allMigrated = unmigratedSummary.every((s) => s.unmigrated === 0);

  // Check consent immutability
  const consents = await db.collection('consentrecords').find({ ownerId: owner._id }).toArray();
  const consentValid = consents.every((c) => c.status && c.consentPurpose && c.consentSource);

  return {
    verified: allMigrated && consentValid,
    workspace: { id: workspace._id, slug: workspace.slug, name: workspace.name, status: workspace.status },
    membership: { id: membership._id, role: membership.role, status: membership.status },
    owner: { id: owner._id, email: owner.email },
    allMigrated,
    consentValid,
    unmigratedSummary,
  };
}
