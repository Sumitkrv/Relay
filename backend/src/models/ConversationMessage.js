import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', index: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
  contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact', required: true, index: true },
  direction: { type: String, enum: ['inbound', 'outbound', 'internal', 'system'], required: true },
  messageType: { type: String, enum: ['text', 'image', 'video', 'document', 'audio', 'location', 'contact_card', 'interactive_reply', 'unsupported'], default: 'text' },
  messageSource: { type: String, enum: ['manual', 'synthetic_test', 'mock_simulation', 'provider', 'internal_note', 'system_event'], required: true },
  trustLevel: { type: String, enum: ['unverified', 'synthetic', 'trusted_provider', 'internal'], default: 'unverified' },
  providerMessageId: { type: String, default: '' },
  templateVersionId: { type: mongoose.Schema.Types.ObjectId, ref: 'TemplateVersion', default: null },
  campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', default: null },
  campaignName: { type: String, default: '' },
  messageBody: { type: String, default: '', maxlength: 10000 },
  mediaMetadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  providerStatus: { type: String, enum: ['Created', 'Queued', 'Submitted', 'Sent', 'Delivered', 'Read', 'Failed', 'Unavailable'], default: 'Unavailable' },
  simulationStatus: { type: String, enum: ['Draft', 'Simulated Success', 'Simulated Failure', 'Manually Logged', 'None'], default: 'None' },
  occurredAt: { type: Date, default: Date.now },
  receivedAt: { type: Date, default: null },
  providerTimestamp: { type: Date, default: null }
}, { timestamps: true });
schema.index({ ownerId: 1, conversationId: 1, occurredAt: -1, _id: -1 });
schema.index({ ownerId: 1, messageBody: 'text' });
schema.index({ ownerId: 1, providerMessageId: 1 }, { partialFilterExpression: { providerMessageId: { $type: 'string', $ne: '' } } });
export default mongoose.model('ConversationMessage', schema);
