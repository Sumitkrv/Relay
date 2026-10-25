import mongoose from 'mongoose';

const securityAuditLogSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        'login_success',
        'login_failure',
        'logout',
        'password_changed',
        'profile_updated',
        'business_updated',
        'preferences_updated',
        'session_revoked',
        'workspace_suspended_by_admin',
        'workspace_reactivated_by_admin',
        'agency_client_delegation_revoked',
        'agency_staff_invited',
        'agency_staff_removed',
        'admin_support_case_created',
      ],
      index: true,
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    ipAddress: {
      type: String,
      default: '',
    },
    userAgent: {
      type: String,
      default: '',
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

export default mongoose.model('SecurityAuditLog', securityAuditLogSchema);
