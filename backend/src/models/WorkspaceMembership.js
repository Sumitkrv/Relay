import mongoose from 'mongoose';

export const MEMBERSHIP_ROLES = ['OWNER', 'ADMIN', 'MEMBER'];
export const MEMBERSHIP_STATUSES = ['ACTIVE', 'INVITED', 'SUSPENDED', 'REVOKED'];

const workspaceMembershipSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: [true, 'Workspace ID reference is required.'],
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID reference is required.'],
      index: true,
    },
    role: {
      type: String,
      enum: {
        values: MEMBERSHIP_ROLES,
        message: 'Invalid membership role: "{VALUE}". Supported roles: OWNER, ADMIN, MEMBER.',
      },
      default: 'OWNER',
      uppercase: true,
      trim: true,
    },
    status: {
      type: String,
      enum: {
        values: MEMBERSHIP_STATUSES,
        message: 'Invalid membership status: "{VALUE}". Supported statuses: ACTIVE, INVITED, SUSPENDED, REVOKED.',
      },
      default: 'ACTIVE',
      uppercase: true,
      trim: true,
      index: true,
    },
    isDefaultWorkspace: {
      type: Boolean,
      default: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    revokedAt: {
      type: Date,
      default: null,
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

// Compound unique index: A user can have at most one membership record per workspace
workspaceMembershipSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });

// Scoped index for rapid lookup of a user's active workspaces
workspaceMembershipSchema.index({ userId: 1, status: 1 });

export default mongoose.model('WorkspaceMembership', workspaceMembershipSchema);
