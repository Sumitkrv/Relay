import mongoose from 'mongoose';

export const SUBSCRIPTION_INTERNAL_STATUSES = [
  'NO_SUBSCRIPTION',
  'TRIALING',
  'TRIAL_EXPIRED',
  'CHECKOUT_PENDING',
  'AUTHORIZATION_PENDING',
  'ACTIVE',
  'PAYMENT_PENDING',
  'PAST_DUE',
  'HALTED',
  'PAUSED',
  'CANCEL_AT_PERIOD_END',
  'CANCELLED',
  'EXPIRED',
  'RECONCILIATION_REQUIRED',
  'LEGACY_ENTITLED',
];

export const BILLING_PROVIDERS = ['RAZORPAY', 'LEGACY_MIGRATION', 'MOCK'];
export const BILLING_ENVIRONMENTS = ['TEST', 'LIVE'];

const subscriptionSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: [true, 'Workspace ID is required for a subscription.'],
      unique: true,
      index: true,
    },
    ownerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner user reference is required.'],
      index: true,
    },
    planKey: {
      type: String,
      required: [true, 'Plan key is required.'],
      trim: true,
      lowercase: true,
      index: true,
    },
    planVersion: {
      type: Number,
      default: 1,
    },
    provider: {
      type: String,
      enum: BILLING_PROVIDERS,
      default: 'RAZORPAY',
    },
    providerSubscriptionId: {
      type: String,
      default: null,
      trim: true,
    },
    providerCustomerId: {
      type: String,
      default: null,
      trim: true,
    },
    providerPlanId: {
      type: String,
      default: null,
      trim: true,
    },
    billingEnvironment: {
      type: String,
      enum: BILLING_ENVIRONMENTS,
      default: 'TEST',
      index: true,
    },
    providerStatus: {
      type: String,
      default: null,
      trim: true,
    },
    internalStatus: {
      type: String,
      enum: SUBSCRIPTION_INTERNAL_STATUSES,
      default: 'NO_SUBSCRIPTION',
      index: true,
    },
    currency: {
      type: String,
      default: 'INR',
      uppercase: true,
      trim: true,
    },
    amountMinor: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'Amount must be an integer (minor currency units).',
      },
    },
    taxTreatment: {
      type: String,
      enum: ['exclusive', 'inclusive'],
      default: 'exclusive',
    },
    startedAt: {
      type: Date,
      default: null,
    },
    currentPeriodStart: {
      type: Date,
      default: null,
    },
    currentPeriodEnd: {
      type: Date,
      default: null,
      index: true,
    },
    trialStartedAt: {
      type: Date,
      default: null,
    },
    trialEndsAt: {
      type: Date,
      default: null,
      index: true,
    },
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false,
    },
    cancellationRequestedAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancellationReason: {
      type: String,
      default: null,
      trim: true,
    },
    lastPaidAt: {
      type: Date,
      default: null,
    },
    nextExpectedChargeAt: {
      type: Date,
      default: null,
    },
    lastReconciledAt: {
      type: Date,
      default: null,
    },
    gracePeriodEndsAt: {
      type: Date,
      default: null,
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

subscriptionSchema.index({ workspaceId: 1, internalStatus: 1 });
subscriptionSchema.index({ providerSubscriptionId: 1 }, { sparse: true });

export default mongoose.model('Subscription', subscriptionSchema);
