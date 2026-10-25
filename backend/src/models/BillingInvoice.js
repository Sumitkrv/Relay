import mongoose from 'mongoose';

const billingInvoiceSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
    },
    planId: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    status: {
      type: String,
      enum: ['PAID', 'PENDING', 'FAILED'],
      default: 'PAID',
    },
    paidAt: {
      type: Date,
      default: Date.now,
    },
    description: {
      type: String,
      default: 'Relay Subscription (Simulated Test Record)',
    },
    paymentMethod: {
      type: String,
      default: 'Mock UPI / Netbanking (Test Mode)',
    },
    isMock: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('BillingInvoice', billingInvoiceSchema);
