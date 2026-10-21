import mongoose from 'mongoose';

const quickReplySchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
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
    enum: ['Brochure', 'Pricing', 'Location', 'Site Visit', 'General', 'Follow-up'],
    default: 'General',
    index: true
  },
  supportedVariables: {
    type: [String],
    default: ['name', 'first_name', 'city', 'project', 'property_type', 'business_name']
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
  }
}, {
  timestamps: true
});

quickReplySchema.index({ ownerId: 1, category: 1, isActive: 1 });
quickReplySchema.index({ ownerId: 1, name: 1 });

export default mongoose.model('QuickReply', quickReplySchema);
