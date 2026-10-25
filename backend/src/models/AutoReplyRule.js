import mongoose from 'mongoose';

const autoReplyRuleSchema = new mongoose.Schema({
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
  triggerKeyword: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  synonyms: {
    type: [String],
    default: []
  },
  matchType: {
    type: String,
    enum: ['EXACT_MATCH', 'WHOLE_WORD', 'CONTAINS'],
    default: 'WHOLE_WORD'
  },
  actionType: {
    type: String,
    enum: [
      'PREPARE_QUICK_REPLY',
      'RUN_MOCK_REPLY',
      'MARK_NEEDS_ATTENTION',
      'CREATE_INTERNAL_NOTE',
      'PAUSE_AUTOMATION',
      'RECORD_OPT_OUT'
    ],
    required: true
  },
  responseMessage: {
    type: String,
    default: '',
    maxlength: 5000
  },
  quickReplyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'QuickReply',
    default: null
  },
  priority: {
    type: Number,
    default: 10,
    index: true
  },
  enabled: {
    type: Boolean,
    default: true,
    index: true
  },
  cooldownSeconds: {
    type: Number,
    default: 15
  },
  executionCount: {
    type: Number,
    default: 0
  },
  lastExecutedAt: {
    type: Date,
    default: null
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

autoReplyRuleSchema.index({ workspaceId: 1, enabled: 1, priority: 1 });
autoReplyRuleSchema.index({ workspaceId: 1, presetKey: 1 });
autoReplyRuleSchema.index({ ownerId: 1, enabled: 1, priority: 1 });

// One provisioned copy of each industry starter per workspace (new field: no legacy conflicts).
autoReplyRuleSchema.index({ workspaceId: 1, starterPresetKey: 1 }, { unique: true, partialFilterExpression: { starterPresetKey: { $type: 'string' } } });

export default mongoose.model('AutoReplyRule', autoReplyRuleSchema);
