import mongoose from 'mongoose';

const agencyMembershipSchema = new mongoose.Schema(
  {
    agencyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Agency',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['AGENCY_OWNER', 'AGENCY_MANAGER', 'AGENCY_VIEWER'],
      default: 'AGENCY_MANAGER',
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INVITED', 'REVOKED'],
      default: 'ACTIVE',
    },
  },
  {
    timestamps: true,
  }
);

agencyMembershipSchema.index({ agencyId: 1, userId: 1 }, { unique: true });

export default mongoose.model('AgencyMembership', agencyMembershipSchema);
