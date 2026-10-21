import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', index: true },
  contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact', required: true, index: true },
  activeWorkspaceKey: { type: String, default: undefined },
  channel: { type: String, enum: ['whatsapp'], default: 'whatsapp' },
  provider: { type: String, enum: ['none', 'meta'], default: 'none' },
  businessAccountId: { type: String, default: '' },
  businessPhoneNumberId: { type: String, default: '' },
  source: { type: String, enum: ['manual', 'test', 'mock', 'synthetic_test', 'provider'], default: 'manual' },
  status: {
    type: String,
    enum: ['Open', 'Pending', 'Follow-up Required', 'Needs Attention', 'Resolved', 'Closed', 'Archived'],
    default: 'Open'
  },
  automationStatus: {
    type: String,
    enum: ['ACTIVE', 'PAUSED'],
    default: 'ACTIVE'
  },
  assignedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  lastMessageId: { type: mongoose.Schema.Types.ObjectId, ref: 'ConversationMessage', default: null },
  lastActivityAt: { type: Date, default: Date.now },
  lastInboundAt: { type: Date, default: null },
  lastVerifiedInboundAt: { type: Date, default: null },
  internalUnreadCount: { type: Number, min: 0, default: 0 },
  tags: { type: [String], default: [] },
  labels: { type: [String], default: [] }
}, { timestamps: true });
schema.index({ ownerId: 1, lastActivityAt: -1 });
schema.index({ ownerId: 1, status: 1, lastActivityAt: -1 });
schema.index({ ownerId: 1, contactId: 1, source: 1, status: 1 });
schema.index({ activeWorkspaceKey: 1 }, { unique: true, partialFilterExpression: { activeWorkspaceKey: { $type: 'string' } } });
export default mongoose.model('Conversation', schema);
