import mongoose from 'mongoose';

export const SUBSCRIPTION_STATUSES = [
  'TRIALING',
  'ACTIVE',
  'PAST_DUE',
  'CANCELED',
  'EXPIRED',
];

export const PLANS = [
  {
    id: 'solo_799',
    name: 'Solo Growth Plan',
    amount: 799,
    currency: 'INR',
    interval: 'month',
    contactLimit: 1000,
    features: ['1 WhatsApp Connection', '1,000 Active Contacts', 'Auto-Replies & Templates', 'Full CRM Reports'],
  },
  {
    id: 'growth_1999',
    name: 'Scale & Team Plan',
    amount: 1999,
    currency: 'INR',
    interval: 'month',
    contactLimit: 5000,
    features: ['2 WhatsApp Senders', '5,000 Active Contacts', 'Advanced Flow Builder', 'Priority Dispatch Queue'],
  },
  {
    id: 'agency_4999',
    name: 'Agency & White-Label',
    amount: 4999,
    currency: 'INR',
    interval: 'month',
    contactLimit: 25000,
    features: ['Unlimited Client Workspaces', 'White-Label Branding', 'Simulated Custom Domains', 'Delegated Staff RBAC'],
  },
];

const workspaceSubscriptionSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      unique: true,
      index: true,
    },
    planId: {
      type: String,
      default: 'solo_799',
    },
    planName: {
      type: String,
      default: 'Solo Growth Plan',
    },
    amount: {
      type: Number,
      default: 799,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    status: {
      type: String,
      enum: SUBSCRIPTION_STATUSES,
      default: 'TRIALING',
      index: true,
    },
    trialStartsAt: {
      type: Date,
      default: Date.now,
    },
    trialEndsAt: {
      type: Date,
      default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
    },
    currentPeriodStartsAt: {
      type: Date,
      default: Date.now,
    },
    currentPeriodEndsAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false,
    },
    canceledAt: {
      type: Date,
      default: null,
    },
    testClockOffsetMs: {
      type: Number,
      default: 0, // In-memory / DB offset to simulate time jumps safely
    },
    isMock: {
      type: Boolean,
      default: true,
    },
    paymentMethod: {
      type: String,
      default: 'Mock UPI / Card (Test Mode)',
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('WorkspaceSubscription', workspaceSubscriptionSchema);
