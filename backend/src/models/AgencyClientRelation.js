import mongoose from 'mongoose';

const agencyClientRelationSchema = new mongoose.Schema(
  {
    agencyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Agency',
      required: true,
      index: true,
    },
    clientWorkspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'PENDING_INVITE', 'REVOKED'],
      default: 'ACTIVE',
      index: true,
    },
    delegatedPermissions: {
      type: [String],
      default: ['contacts:read', 'contacts:write', 'campaigns:manage', 'templates:manage', 'inbox:reply'],
    },
    invitedEmail: {
      type: String,
      default: '',
    },
    inviteToken: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

agencyClientRelationSchema.index({ agencyId: 1, clientWorkspaceId: 1 }, { unique: true });

export default mongoose.model('AgencyClientRelation', agencyClientRelationSchema);
