import mongoose from 'mongoose';

export const PLATFORM_ROLES = [
  'PLATFORM_SUPER_ADMIN',
  'PLATFORM_SUPPORT',
  'PLATFORM_BILLING',
  'PLATFORM_OPERATIONS',
  'PLATFORM_READ_ONLY',
];

export const GRANT_STATUSES = ['ACTIVE', 'REVOKED', 'SUSPENDED'];

export const ALL_PLATFORM_PERMISSIONS = [
  'platform.dashboard.read',
  'platform.workspaces.read',
  'platform.workspaces.suspend',
  'platform.workspaces.reactivate',
  'platform.billing.read',
  'platform.billing.reconcile',
  'platform.connections.read',
  'platform.health.read',
  'platform.workers.read',
  'platform.audit.read',
  'platform.support.cases.read',
  'platform.support.cases.write',
  'platform.support.notes.write',
  'platform.settings.read',
  'platform.settings.write',
  'platform.admin.grants.manage',
];

const platformAdminGrantSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required for Platform Admin Grant.'],
      unique: true,
      index: true,
    },
    role: {
      type: String,
      enum: PLATFORM_ROLES,
      default: 'PLATFORM_SUPER_ADMIN',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: GRANT_STATUSES,
      default: 'ACTIVE',
      required: true,
      index: true,
    },
    permissions: {
      type: [String],
      default: () => [...ALL_PLATFORM_PERMISSIONS],
    },
    grantedBy: {
      type: String,
      default: 'CLI_BOOTSTRAP',
    },
    grantedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedAt: {
      type: Date,
      default: Date.now,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    revokedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    revocationReason: {
      type: String,
      default: null,
      trim: true,
    },
    lastReviewedAt: {
      type: Date,
      default: Date.now,
    },
    mfaEnforced: {
      type: Boolean,
      default: false,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    strict: 'throw',
    toJSON: {
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

platformAdminGrantSchema.index({ userId: 1, status: 1 });

export default mongoose.model('PlatformAdminGrant', platformAdminGrantSchema);
