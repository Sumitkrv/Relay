import mongoose from 'mongoose';

export const SUPPORT_ISSUE_CATEGORIES = [
  'ONBOARDING',
  'BILLING',
  'WHATSAPP_CONNECTION',
  'MESSAGING_QUEUE',
  'ACCOUNT_ACCESS',
  'TECHNICAL_ERROR',
  'GENERAL_SUPPORT',
];

export const SUPPORT_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
export const SUPPORT_STATUSES = ['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED'];

const internalNoteSchema = new mongoose.Schema(
  {
    noteId: {
      type: String,
      default: () => `note_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    },
    adminUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    adminName: {
      type: String,
      required: true,
      trim: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const supportCaseSchema = new mongoose.Schema(
  {
    caseNumber: {
      type: String,
      unique: true,
      required: true,
      index: true,
    },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    createdByAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    issueCategory: {
      type: String,
      enum: SUPPORT_ISSUE_CATEGORIES,
      required: true,
      index: true,
    },
    priority: {
      type: String,
      enum: SUPPORT_PRIORITIES,
      default: 'MEDIUM',
      index: true,
    },
    status: {
      type: String,
      enum: SUPPORT_STATUSES,
      default: 'OPEN',
      index: true,
    },
    summary: {
      type: String,
      required: true,
      trim: true,
      maxlength: 250,
    },
    internalNotes: [internalNoteSchema],
    resolvedAt: {
      type: Date,
      default: null,
    },
    resolvedByAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    resolutionSummary: {
      type: String,
      default: '',
      trim: true,
      maxlength: 1000,
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

supportCaseSchema.index({ status: 1, priority: 1, createdAt: -1 });

export default mongoose.model('SupportCase', supportCaseSchema);
