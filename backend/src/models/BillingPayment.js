import mongoose from 'mongoose';

export const PAYMENT_STATUSES = ['authorized', 'captured', 'failed', 'refunded'];

const billingPaymentSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: [true, 'Workspace ID is required for a payment record.'],
      index: true,
    },
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscription',
      required: [true, 'Subscription ID reference is required.'],
      index: true,
    },
    providerPaymentId: {
      type: String,
      required: [true, 'Provider payment ID is required.'],
      unique: true,
      trim: true,
      index: true,
    },
    providerInvoiceId: {
      type: String,
      default: null,
      trim: true,
    },
    amountMinor: {
      type: Number,
      required: [true, 'Payment amount in minor units is required.'],
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'Amount must be an integer (paise).',
      },
    },
    currency: {
      type: String,
      default: 'INR',
      uppercase: true,
      trim: true,
    },
    status: {
      type: String,
      enum: PAYMENT_STATUSES,
      required: true,
      index: true,
    },
    paymentMethod: {
      type: String,
      default: 'mandate',
      trim: true,
    },
    methodDetails: {
      last4: { type: String, default: '' },
      network: { type: String, default: '' },
      bank: { type: String, default: '' },
    },
    paidAt: {
      type: Date,
      default: Date.now,
    },
    billingPeriodStart: {
      type: Date,
      default: null,
    },
    billingPeriodEnd: {
      type: Date,
      default: null,
    },
    billingEnvironment: {
      type: String,
      enum: ['TEST', 'LIVE'],
      default: 'TEST',
    },
    errorCode: {
      type: String,
      default: null,
      trim: true,
    },
    errorDescription: {
      type: String,
      default: null,
      trim: true,
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

billingPaymentSchema.virtual('paymentStatus').get(function () {
  return this.status;
});

billingPaymentSchema.virtual('cardLast4').get(function () {
  return this.methodDetails?.last4 || '';
});

billingPaymentSchema.set('toJSON', { virtuals: true });
billingPaymentSchema.set('toObject', { virtuals: true });

billingPaymentSchema.index({ workspaceId: 1, paidAt: -1 });

export default mongoose.model('BillingPayment', billingPaymentSchema);
