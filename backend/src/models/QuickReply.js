import mongoose from 'mongoose';

const quickReplySchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    index: true,
    default: null
  },
  presetKey: {
    type: String,
    trim: true,
    index: true,
    default: null
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 120
  },
  description: {
    type: String,
    default: '',
    trim: true,
    maxlength: 500
  },
  messageText: {
    type: String,
    required: true,
    trim: true,
    maxlength: 5000
  },
  category: {
    type: String,
    trim: true,
    default: 'General',
    index: true
  },
  supportedVariables: {
    type: [String],
    default: ['customer_name', 'first_name', 'city', 'business_name']
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  usageCount: {
    type: Number,
    default: 0
  },
  archivedAt: {
    type: Date,
    default: null
  },
  starterPresetKey: { type: String, trim: true, default: null },
  starterPackVersion: { type: String, trim: true, default: null },
  provisioningSource: { type: String, trim: true, default: null }
}, {
  timestamps: true
});

quickReplySchema.index({ workspaceId: 1, category: 1, isActive: 1 });
quickReplySchema.index({ workspaceId: 1, presetKey: 1 });
quickReplySchema.index({ ownerId: 1, category: 1, isActive: 1 });
quickReplySchema.index({ ownerId: 1, name: 1 });

// One provisioned copy of each industry starter per workspace (new field: no legacy conflicts).
quickReplySchema.index({ workspaceId: 1, starterPresetKey: 1 }, { unique: true, partialFilterExpression: { starterPresetKey: { $type: 'string' } } });

export default mongoose.model('QuickReply', quickReplySchema);
