import mongoose from 'mongoose';

export const BILLING_INTERVALS = ['monthly', 'yearly', 'trial'];

const planSchema = new mongoose.Schema(
  {
    planKey: {
      type: String,
      required: [true, 'Plan key is required.'],
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    displayName: {
      type: String,
      required: [true, 'Display name is required.'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    currency: {
      type: String,
      default: 'INR',
      uppercase: true,
      trim: true,
    },
    amountMinor: {
      type: Number,
      required: [true, 'Amount in minor currency units (paise) is required.'],
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'Amount must be an integer (minor currency units).',
      },
    },
    billingInterval: {
      type: String,
      enum: BILLING_INTERVALS,
      default: 'monthly',
    },
    billingIntervalCount: {
      type: Number,
      default: 1,
      min: 1,
    },
    trialDays: {
      type: Number,
      default: 0,
      min: 0,
    },
    includedFeatures: [{ type: String, trim: true }],
    usageLimits: {
      maxContacts: { type: Number, default: 100 },
      maxMonthlyCampaigns: { type: Number, default: 5 },
      maxSimulatedMessages: { type: Number, default: 500 },
      maxTemplates: { type: Number, default: 5 },
      maxAutomationRules: { type: Number, default: 3 },
      maxStorageMb: { type: Number, default: 50 },
      allowLiveMessaging: { type: Boolean, default: false },
    },
    isPublic: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    version: {
      type: Number,
      default: 1,
    },
    providerPlanIdTest: {
      type: String,
      default: '',
      trim: true,
    },
    providerPlanIdLive: {
      type: String,
      default: '',
      trim: true,
    },
    taxTreatment: {
      type: String,
      enum: ['exclusive', 'inclusive'],
      default: 'exclusive',
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

export default mongoose.model('Plan', planSchema);
