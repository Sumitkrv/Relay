import mongoose from 'mongoose';

const buttonSchema = new mongoose.Schema({
  type: { type: String, enum: ['QUICK_REPLY', 'URL', 'PHONE_NUMBER'], required: true },
  text: { type: String, trim: true, required: true, maxlength: 25 },
  value: { type: String, trim: true, default: '', maxlength: 2000 }
}, { _id: false });

const versionSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', index: true },
  templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'MessageTemplate', required: true, index: true },
  versionNumber: { type: Number, required: true },
  revisionNotes: { type: String, default: '', maxlength: 500 },
  snapshot: { type: mongoose.Schema.Types.Mixed, required: true },
  internalVariables: { type: [String], default: [] },
  metaParameterMappings: { type: mongoose.Schema.Types.Mixed, default: {} },
  sampleValues: { type: mongoose.Schema.Types.Mixed, default: {} },
  fallbackValues: { type: mongoose.Schema.Types.Mixed, default: {} },
  validationResults: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: { createdAt: true, updatedAt: false } });
versionSchema.index({ ownerId: 1, templateId: 1, versionNumber: -1 }, { unique: true });

const templateSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', index: true },
  name: { type: String, trim: true, required: true, minlength: 2, maxlength: 120 },
  description: { type: String, trim: true, default: '', maxlength: 500 },
  category: { type: String, enum: ['Marketing', 'Utility', 'Authentication'], default: 'Marketing' },
  language: { type: String, enum: ['en', 'hi', 'hinglish'], default: 'en' },
  headerType: { type: String, enum: ['NONE', 'TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT'], default: 'NONE' },
  header: { type: String, trim: true, default: '', maxlength: 60 },
  headerMediaId: { type: mongoose.Schema.Types.ObjectId, ref: 'TemplateMedia', default: null },
  headerMediaUrl: { type: String, trim: true, default: '' },
  headerMediaName: { type: String, trim: true, default: '' },
  headerMediaSize: { type: Number, default: 0 },
  headerMediaMime: { type: String, trim: true, default: '' },
  body: { type: String, default: '', maxlength: 4096 },
  footer: { type: String, trim: true, default: '', maxlength: 60 },
  buttons: { type: [buttonSchema], default: [] },
  internalVariables: { type: [String], default: [] },
  businessCategory: { type: String, trim: true, default: '', maxlength: 80 },
  intendedService: { type: String, trim: true, default: '', maxlength: 120 },
  tags: { type: [{ type: String, trim: true, lowercase: true, maxlength: 40 }], default: [] },
  isFavorite: { type: Boolean, default: false },
  lastUsedAt: { type: Date, default: null },
  localStatus: { type: String, enum: ['Draft', 'Ready for Review', 'Ready for Submission', 'Archived'], default: 'Draft' },
  providerStatus: { type: String, enum: ['Not Submitted', 'Pending', 'Approved', 'Rejected', 'Paused', 'Disabled'], default: 'Not Submitted' },
  mockProviderApprovalStatus: { type: String, enum: ['Not Submitted', 'Simulated Submission', 'Simulated Pending Review', 'Simulated Approved', 'Simulated Rejected', 'Simulated Paused'], default: 'Simulated Approved' },
  currentVersionId: { type: mongoose.Schema.Types.ObjectId, ref: 'TemplateVersion', default: null },
  currentVersionNumber: { type: Number, default: 0 },
  metaTemplateName: { type: String, trim: true, default: '', maxlength: 512 },
  metaTemplateId: { type: String, trim: true, default: '', maxlength: 256 },
  metaLanguage: { type: String, trim: true, default: '' },
  metaParameterMappings: { type: mongoose.Schema.Types.Mixed, default: {} },
  sampleValues: { type: mongoose.Schema.Types.Mixed, default: {} },
  fallbackValues: { type: mongoose.Schema.Types.Mixed, default: {} },
  usageReferences: { type: [String], default: [] },
  isArchived: { type: Boolean, default: false, index: true }
}, { timestamps: true });
templateSchema.index({ ownerId: 1, isArchived: 1, updatedAt: -1 });
templateSchema.index({ ownerId: 1, businessCategory: 1, intendedService: 1 });
templateSchema.index({ ownerId: 1, name: 1 });

export const TemplateVersion = mongoose.model('TemplateVersion', versionSchema);
export default mongoose.model('MessageTemplate', templateSchema);
