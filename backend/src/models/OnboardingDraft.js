import mongoose from 'mongoose';
import { VALID_INDUSTRIES } from './Workspace.js';

export const ONBOARDING_DRAFT_STATUSES = ['DRAFT', 'PROVISIONING', 'COMPLETED', 'FAILED'];

const onboardingDraftSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required for onboarding draft.'],
      unique: true,
      index: true,
    },
    step: {
      type: Number,
      default: 1,
      min: 1,
      max: 6,
    },
    businessIdentity: {
      name: {
        type: String,
        trim: true,
        maxlength: [120, 'Business name cannot exceed 120 characters.'],
        default: '',
      },
      email: {
        type: String,
        trim: true,
        lowercase: true,
        maxlength: [120, 'Business email cannot exceed 120 characters.'],
        default: '',
      },
      phone: {
        type: String,
        trim: true,
        maxlength: [40, 'Business phone cannot exceed 40 characters.'],
        default: '',
      },
      website: {
        type: String,
        trim: true,
        maxlength: [240, 'Website URL cannot exceed 240 characters.'],
        default: '',
      },
      description: {
        type: String,
        trim: true,
        maxlength: [2000, 'Description cannot exceed 2000 characters.'],
        default: '',
      },
    },
    industryKey: {
      type: String,
      enum: {
        values: VALID_INDUSTRIES,
        message: 'Invalid industry key: "{VALUE}".',
      },
      default: 'other',
    },
    businessDetails: {
      address: {
        type: String,
        trim: true,
        maxlength: [300, 'Address cannot exceed 300 characters.'],
        default: '',
      },
      city: {
        type: String,
        trim: true,
        maxlength: [80, 'City cannot exceed 80 characters.'],
        default: '',
      },
      state: {
        type: String,
        trim: true,
        maxlength: [80, 'State cannot exceed 80 characters.'],
        default: '',
      },
      country: {
        type: String,
        trim: true,
        default: 'India',
        maxlength: [80, 'Country cannot exceed 80 characters.'],
      },
      timezone: {
        type: String,
        trim: true,
        default: 'Asia/Kolkata',
        maxlength: [60, 'Timezone cannot exceed 60 characters.'],
      },
      preferredLanguage: {
        type: String,
        trim: true,
        default: 'en',
        maxlength: [20, 'Language code cannot exceed 20 characters.'],
      },
      industryMetadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
    },
    branding: {
      logoUrl: {
        type: String,
        trim: true,
        maxlength: [500, 'Logo URL cannot exceed 500 characters.'],
        default: '',
      },
      logoFilename: {
        type: String,
        trim: true,
        maxlength: [255, 'Filename cannot exceed 255 characters.'],
        default: '',
      },
      logoMimeType: {
        type: String,
        trim: true,
        maxlength: [100, 'MIME type cannot exceed 100 characters.'],
        default: '',
      },
      logoSizeBytes: {
        type: Number,
        default: 0,
      },
    },
    status: {
      type: String,
      enum: {
        values: ONBOARDING_DRAFT_STATUSES,
        message: 'Invalid draft status: "{VALUE}".',
      },
      default: 'DRAFT',
      index: true,
    },
    provisionedWorkspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      default: null,
    },
    schemaVersion: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
    strict: 'throw',
    toJSON: {
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

export default mongoose.model('OnboardingDraft', onboardingDraftSchema);
