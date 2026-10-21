import mongoose from 'mongoose';

const messageEventSchema = new mongoose.Schema({
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
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    required: true,
    index: true
  },
  eventType: {
    type: String,
    enum: [
      'MESSAGE_CREATED',
      'VALIDATION_COMPLETED',
      'MESSAGE_BLOCKED',
      'MESSAGE_SCHEDULED',
      'MESSAGE_QUEUED',
      'PROCESSING_STARTED',
      'MOCK_SEND_SUCCEEDED',
      'MOCK_SEND_FAILED',
      'RETRY_SCHEDULED',
      'MESSAGE_CANCELLED',
      'MESSAGE_COMPLETED',
      'SIMULATED_DELIVERED',
      'SIMULATED_READ',
      'MOCK_DELIVERY_FAILED',
      'SIMULATED_STATUS_UPDATED'
    ],
    required: true
  },
  previousStatus: {
    type: String,
    default: ''
  },
  newStatus: {
    type: String,
    required: true
  },
  source: {
    type: String,
    default: 'engine'
  },
  attemptNumber: {
    type: Number,
    default: 1
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  correlationId: {
    type: String,
    default: ''
  },
  safeMetadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: false
});

messageEventSchema.index({ ownerId: 1, messageId: 1, timestamp: -1 });
messageEventSchema.index({ ownerId: 1, eventType: 1, timestamp: -1 });
messageEventSchema.index({ workspaceId: 1, messageId: 1, timestamp: -1 });
messageEventSchema.index({ workspaceId: 1, eventType: 1, timestamp: -1 });

export default mongoose.model('MessageEvent', messageEventSchema);
