import mongoose from 'mongoose';

const usageCounterSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: [true, 'Workspace ID is required for a usage counter.'],
      index: true,
    },
    periodKey: {
      type: String,
      required: [true, 'Period key (e.g. 2026-10) is required.'],
      trim: true,
      index: true,
    },
    contactsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    monthlyCampaignsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    simulatedMessagesCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    templatesCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    automationRulesCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    reportExportsCount: {
      type: Number,
      default: 0,
      min: 0,
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

usageCounterSchema.virtual('campaigns').get(function () {
  return this.monthlyCampaignsCount;
});
usageCounterSchema.virtual('simulatedMessages').get(function () {
  return this.simulatedMessagesCount;
});
usageCounterSchema.virtual('contacts').get(function () {
  return this.contactsCount;
});
usageCounterSchema.virtual('templates').get(function () {
  return this.templatesCount;
});
usageCounterSchema.set('toJSON', { virtuals: true });
usageCounterSchema.set('toObject', { virtuals: true });

usageCounterSchema.index({ workspaceId: 1, periodKey: 1 }, { unique: true });

export default mongoose.model('UsageCounter', usageCounterSchema);
