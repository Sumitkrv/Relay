import mongoose from 'mongoose';

const ruleExecutionSchema = new mongoose.Schema({
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', index: true },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
    index: true
  },
  contactId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contact',
    required: true,
    index: true
  },
  messageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ConversationMessage',
    default: null
  },
  ruleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AutoReplyRule',
    default: null
  },
  ruleName: {
    type: String,
    default: ''
  },
  matchedKeyword: {
    type: String,
    default: ''
  },
  actionType: {
    type: String,
    required: true
  },
  executionMode: {
    type: String,
    enum: ['MOCK', 'SYNTHETIC_TEST', 'MANUAL'],
    default: 'SYNTHETIC_TEST'
  },
  status: {
    type: String,
    enum: ['SUCCESS', 'BLOCKED', 'PAUSED_TAKEOVER', 'COOLDOWN_SKIPPED', 'FAILED'],
    default: 'SUCCESS'
  },
  reason: {
    type: String,
    default: ''
  },
  replyMessageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ConversationMessage',
    default: null
  }
}, {
  timestamps: true
});

ruleExecutionSchema.index({ ownerId: 1, conversationId: 1, createdAt: -1 });

export default mongoose.model('RuleExecution', ruleExecutionSchema);
