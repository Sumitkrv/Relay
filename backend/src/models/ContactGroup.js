import mongoose from 'mongoose';

const contactGroupSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', index: true },
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  normalizedName: { type: String, required: true, lowercase: true, trim: true },
  description: { type: String, trim: true, default: '', maxlength: 500 },
  color: { type: String, trim: true, default: '#0D9488', maxlength: 20 },
  contactCount: { type: Number, default: 0, min: 0 },
  isArchived: { type: Boolean, default: false }
}, { timestamps: true });

contactGroupSchema.index({ ownerId: 1, normalizedName: 1 }, { unique: true });
contactGroupSchema.index({ ownerId: 1, updatedAt: -1 });

export default mongoose.model('ContactGroup', contactGroupSchema);
