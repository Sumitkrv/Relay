import mongoose from 'mongoose';

const migrationCheckpointSchema = new mongoose.Schema(
  {
    migrationId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    version: {
      type: String,
      default: '1.0.0',
    },
    sourceDatabase: {
      type: String,
      required: true,
    },
    environment: {
      type: String,
      required: true,
      enum: ['development', 'staging', 'production', 'test'],
      default: 'development',
    },
    mode: {
      type: String,
      required: true,
      enum: ['DRY_RUN', 'EXECUTE', 'ROLLBACK'],
      default: 'DRY_RUN',
    },
    status: {
      type: String,
      required: true,
      enum: ['INITIALIZED', 'RUNNING', 'COMPLETED', 'FAILED', 'ROLLED_BACK'],
      default: 'INITIALIZED',
      index: true,
    },
    verifiedOwnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    verifiedOwnerEmail: {
      type: String,
      default: '',
    },
    targetWorkspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    targetWorkspaceSlug: {
      type: String,
      default: 'm2w-realty',
    },
    backupVerified: {
      type: Boolean,
      default: false,
    },
    backupArtifactLocation: {
      type: String,
      default: '',
    },
    backupTimestamp: {
      type: Date,
      default: null,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    collectionProgress: [
      {
        collectionName: { type: String, required: true },
        scannedCount: { type: Number, default: 0 },
        eligibleCount: { type: Number, default: 0 },
        migratedCount: { type: Number, default: 0 },
        alreadyMigratedCount: { type: Number, default: 0 },
        skippedCount: { type: Number, default: 0 },
        conflictCount: { type: Number, default: 0 },
        status: {
          type: String,
          enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'SKIPPED'],
          default: 'PENDING',
        },
        error: { type: String, default: null },
        completedAt: { type: Date, default: null },
      },
    ],
    totals: {
      scanned: { type: Number, default: 0 },
      eligible: { type: Number, default: 0 },
      migrated: { type: Number, default: 0 },
      alreadyMigrated: { type: Number, default: 0 },
      skipped: { type: Number, default: 0 },
      conflicts: { type: Number, default: 0 },
    },
    conflicts: [
      {
        collectionName: { type: String, required: true },
        documentId: { type: mongoose.Schema.Types.Mixed, required: true },
        reason: { type: String, required: true },
        detectedAt: { type: Date, default: Date.now },
      },
    ],
    executionErrors: [
      {
        collectionName: { type: String, required: true },
        documentId: { type: mongoose.Schema.Types.Mixed },
        error: { type: String, required: true },
        occurredAt: { type: Date, default: Date.now },
      },
    ],
    validationStatus: {
      type: String,
      enum: ['NOT_VALIDATED', 'VALID', 'INVALID'],
      default: 'NOT_VALIDATED',
    },
    validationDetails: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    rollbackStatus: {
      type: String,
      enum: ['NONE', 'IN_PROGRESS', 'COMPLETED', 'FAILED'],
      default: 'NONE',
    },
    rolledBackAt: {
      type: Date,
      default: null,
    },
    rollbackDetails: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    lock: {
      isLocked: { type: Boolean, default: false },
      lockedAt: { type: Date, default: null },
      lockedBy: { type: String, default: '' },
      leaseExpiresAt: { type: Date, default: null },
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('MigrationCheckpoint', migrationCheckpointSchema);
