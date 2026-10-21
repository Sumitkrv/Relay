import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    index: true
  },
  messageId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  contactId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contact',
    required: true,
    index: true
  },
  recipientPhone: {
    type: String,
    required: true,
    trim: true
  },
  recipientName: {
    type: String,
    default: '',
    trim: true
  },
  campaignId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campaign',
    default: null,
    index: true
  },
  campaignRunId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CampaignExecution',
    default: null,
    index: true
  },
  campaignJobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CampaignMessageJob',
    default: null,
    index: true
  },
  templateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MessageTemplate',
    default: null
  },
  templateVersionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TemplateVersion',
    default: null
  },
  templateVersion: {
    type: Number,
    default: 1
  },
  channel: {
    type: String,
    enum: ['whatsapp'],
    default: 'whatsapp'
  },
  providerMode: {
    type: String,
    enum: ['MOCK', 'DISABLED'],
    default: 'MOCK'
  },
  providerMessageId: {
    type: String,
    default: '',
    trim: true
  },
  messageDirection: {
    type: String,
    enum: ['outbound', 'inbound'],
    default: 'outbound'
  },
  renderedContentSnapshot: {
    header: { type: String, default: '' },
    headerType: { type: String, enum: ['NONE', 'TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT'], default: 'NONE' },
    body: { type: String, default: '' },
    footer: { type: String, default: '' },
    buttons: { type: Array, default: [] },
    variables: { type: mongoose.Schema.Types.Mixed, default: {} },
    mediaUrl: { type: String, default: '' },
    mediaType: { type: String, default: '' },
    mediaName: { type: String, default: '' }
  },
  mediaReferences: {
    type: [mongoose.Schema.Types.Mixed],
    default: []
  },
  status: {
    type: String,
    enum: [
      'DRAFT',
      'PENDING_VALIDATION',
      'BLOCKED',
      'SCHEDULED',
      'QUEUED',
      'PROCESSING',
      'SIMULATED_SENT',
      'SIMULATED_DELIVERED',
      'SIMULATED_READ',
      'TEMPORARY_FAILURE',
      'PERMANENT_FAILURE',
      'CANCELLED'
    ],
    default: 'QUEUED',
    index: true
  },
  scheduledAt: {
    type: Date,
    default: null
  },
  queuedAt: {
    type: Date,
    default: Date.now
  },
  processingStartedAt: {
    type: Date,
    default: null
  },
  simulatedSentAt: {
    type: Date,
    default: null
  },
  completedAt: {
    type: Date,
    default: null
  },
  failureCode: {
    type: String,
    default: '',
    trim: true
  },
  failureReason: {
    type: String,
    default: '',
    trim: true
  },
  attemptCount: {
    type: Number,
    default: 0
  },
  maxAttempts: {
    type: Number,
    default: 3
  },
  nextRetryAt: {
    type: Date,
    default: null
  },
  leaseOwner: {
    type: String,
    default: ''
  },
  leaseUntil: {
    type: Date,
    default: null
  },
  idempotencyKey: {
    type: String,
    index: true,
    sparse: true,
    trim: true
  },
  correlationId: {
    type: String,
    default: '',
    trim: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

messageSchema.index({ ownerId: 1, status: 1, createdAt: -1 });
messageSchema.index({ ownerId: 1, campaignId: 1, createdAt: -1 });
messageSchema.index({ ownerId: 1, campaignRunId: 1, status: 1 });
messageSchema.index({ ownerId: 1, contactId: 1, createdAt: -1 });
messageSchema.index({ ownerId: 1, idempotencyKey: 1 }, { unique: true, sparse: true });
messageSchema.index({ status: 1, leaseUntil: 1, scheduledAt: 1, nextRetryAt: 1 });

export default mongoose.model('Message', messageSchema);
