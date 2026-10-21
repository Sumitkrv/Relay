import mongoose from 'mongoose';

export const TOKEN_PURPOSES = ['EMAIL_VERIFICATION', 'PASSWORD_RESET'];

const authTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID reference is required.'],
      index: true,
    },
    tokenHash: {
      type: String,
      required: [true, 'Token hash is required.'],
      unique: true,
      index: true,
      trim: true,
    },
    purpose: {
      type: String,
      enum: {
        values: TOKEN_PURPOSES,
        message: 'Invalid token purpose: "{VALUE}". Supported purposes: EMAIL_VERIFICATION, PASSWORD_RESET.',
      },
      required: [true, 'Token purpose is required.'],
      index: true,
    },
    expiresAt: {
      type: Date,
      required: [true, 'Token expiration timestamp is required.'],
    },
    isConsumed: {
      type: Boolean,
      default: false,
      index: true,
    },
    consumedAt: {
      type: Date,
      default: null,
    },
    metadata: {
      ipHash: { type: String, default: '' },
      userAgent: { type: String, default: '' },
    },
  },
  {
    timestamps: true,
    strict: 'throw',
  }
);

// Compound indexes for rapid lookup and atomic consumption
authTokenSchema.index({ tokenHash: 1, purpose: 1, isConsumed: 1 });
authTokenSchema.index({ userId: 1, purpose: 1, isConsumed: 1 });

// TTL index for automatic asynchronous MongoDB cleanup of expired tokens
authTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('AuthToken', authTokenSchema);
