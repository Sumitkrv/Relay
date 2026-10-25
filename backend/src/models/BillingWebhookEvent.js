import mongoose from 'mongoose';

export const WEBHOOK_PROCESSING_STATUSES = [
  'PENDING',
  'PROCESSED',
  'FAILED',
  'IGNORED_UNKNOWN',
  'DUPLICATE',
];

const billingWebhookEventSchema = new mongoose.Schema(
  {
    providerEventId: {
      type: String,
      required: [true, 'Provider event ID is required.'],
      unique: true,
      trim: true,
      index: true,
    },
    eventType: {
      type: String,
      required: [true, 'Webhook event type is required.'],
      trim: true,
      index: true,
    },
    providerSubscriptionId: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      default: null,
      index: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    processingStatus: {
      type: String,
      enum: WEBHOOK_PROCESSING_STATUSES,
      default: 'PENDING',
      index: true,
    },
    receivedAt: {
      type: Date,
      default: Date.now,
    },
    processedAt: {
      type: Date,
      default: null,
    },
    processingError: {
      type: String,
      default: null,
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

billingWebhookEventSchema.index({ eventType: 1, receivedAt: -1 });

export default mongoose.model('BillingWebhookEvent', billingWebhookEventSchema);
