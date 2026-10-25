import mongoose from 'mongoose';

export const AUDIT_TARGET_TYPES = [
  'WORKSPACE',
  'SUBSCRIPTION',
  'CONNECTION',
  'USER',
  'WORKER',
  'PLATFORM_GRANT',
  'SUPPORT_CASE',
  'SYSTEM',
  'BILLING',
];

export const AUDIT_OUTCOMES = ['SUCCESS', 'FAILED', 'DENIED'];

const REDACTED_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'session',
  'secret',
  'key_secret',
  'authorization',
  'card',
  'cvv',
  'body',
  'messagetext',
  'accesstoken',
  'refreshtoken',
]);

/**
 * Recursively redacts sensitive credentials and customer communication bodies
 */
export function sanitizeAuditMetadata(obj, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 6) return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeAuditMetadata(item, depth + 1));
  }
  const clean = {};
  for (const [key, val] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (
      REDACTED_KEYS.has(lowerKey) ||
      lowerKey.includes('password') ||
      lowerKey.includes('token') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('card') ||
      lowerKey.includes('cvv') ||
      lowerKey.includes('session') ||
      lowerKey.includes('messagetext')
    ) {
      clean[key] = '[REDACTED]';
    } else if (typeof val === 'object' && val !== null) {
      clean[key] = sanitizeAuditMetadata(val, depth + 1);
    } else {
      clean[key] = val;
    }
  }
  return clean;
}

const platformAuditLogSchema = new mongoose.Schema(
  {
    adminUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    platformRole: {
      type: String,
      required: true,
      index: true,
    },
    actionType: {
      type: String,
      required: true,
      index: true,
    },
    targetResourceType: {
      type: String,
      enum: AUDIT_TARGET_TYPES,
      required: true,
      index: true,
    },
    targetResourceId: {
      type: String,
      default: null,
      index: true,
    },
    reason: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500,
    },
    outcome: {
      type: String,
      enum: AUDIT_OUTCOMES,
      default: 'SUCCESS',
      index: true,
    },
    ipAddress: {
      type: String,
      default: '',
    },
    userAgent: {
      type: String,
      default: '',
    },
    correlationId: {
      type: String,
      default: () => `adm_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    strict: 'throw',
    toJSON: {
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

platformAuditLogSchema.pre('save', function (next) {
  if (this.metadata) {
    this.metadata = sanitizeAuditMetadata(this.metadata);
  }
  next();
});

platformAuditLogSchema.index({ createdAt: -1 });
platformAuditLogSchema.index({ targetResourceType: 1, targetResourceId: 1 });

export default mongoose.model('PlatformAuditLog', platformAuditLogSchema);
