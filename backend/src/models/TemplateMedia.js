import mongoose from 'mongoose';

const templateMediaSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    storageKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    originalFileName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    mimeType: {
      type: String,
      required: true,
      trim: true,
    },
    sizeBytes: {
      type: Number,
      required: true,
      min: 1,
    },
    checksum: {
      type: String,
      default: '',
      trim: true,
    },
    mediaType: {
      type: String,
      enum: ['IMAGE', 'VIDEO', 'DOCUMENT'],
      required: true,
      index: true,
    },
    storagePath: {
      type: String,
      required: true,
    },
    storageStatus: {
      type: String,
      enum: ['active', 'deleted'],
      default: 'active',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

templateMediaSchema.index({ ownerId: 1, storageStatus: 1, createdAt: -1 });

export default mongoose.model('TemplateMedia', templateMediaSchema);
