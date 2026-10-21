import mongoose from 'mongoose';

const trialGrantSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: [true, 'Workspace ID is required for a trial grant.'],
      unique: true,
      index: true,
    },
    ownerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner User ID is required.'],
      index: true,
    },
    trialStartedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    trialEndsAt: {
      type: Date,
      required: true,
      index: true,
    },
    trialDays: {
      type: Number,
      default: 14,
      min: 1,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'EXPIRED', 'CONVERTED_TO_PAID', 'REVOKED'],
      default: 'ACTIVE',
      index: true,
    },
    grantVersion: {
      type: Number,
      default: 1,
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

export default mongoose.model('TrialGrant', trialGrantSchema);
