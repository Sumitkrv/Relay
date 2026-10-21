import mongoose from 'mongoose';

const businessProfileSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      index: true,
    },
    legalOrTradingName: {
      type: String,
      trim: true,
      default: '',
      maxlength: 160,
    },
    displayName: {
      type: String,
      trim: true,
      default: '',
      maxlength: 120,
    },
    businessCategory: {
      type: String,
      trim: true,
      default: 'Real Estate',
      maxlength: 80,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
      maxlength: 120,
    },
    phone: {
      type: String,
      trim: true,
      default: '',
      maxlength: 40,
    },
    website: {
      type: String,
      trim: true,
      default: '',
      maxlength: 240,
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: 2000,
    },
    address: {
      type: String,
      trim: true,
      default: '',
      maxlength: 300,
    },
    city: {
      type: String,
      trim: true,
      default: '',
      maxlength: 80,
    },
    state: {
      type: String,
      trim: true,
      default: '',
      maxlength: 80,
    },
    country: {
      type: String,
      trim: true,
      default: 'India',
      maxlength: 80,
    },
    postalCode: {
      type: String,
      trim: true,
      default: '',
      maxlength: 20,
    },
    logoUrl: {
      type: String,
      trim: true,
      default: '',
      maxlength: 500,
    },
    supportEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
      maxlength: 120,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('BusinessProfile', businessProfileSchema);
