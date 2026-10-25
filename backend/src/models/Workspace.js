import mongoose from 'mongoose';

export const VALID_INDUSTRIES = [
  'real_estate',
  'gym',
  'clinic',
  'education',
  'salon',
  'automobile',
  'travel_tourism',
  'travel',
  'restaurant_food',
  'restaurants_food',
  'professional_services',
  'professional',
  'generic_business',
  'generic',
  'ecommerce_retail',
  'home_services',
  'hospitality',
  'other',
];

export const STARTER_PROVISIONING_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'];

const starterProvisioningSchema = new mongoose.Schema(
  {
    status: { type: String, enum: STARTER_PROVISIONING_STATUSES, default: 'PENDING' },
    industryKey: { type: String, default: '' },
    packVersion: { type: String, default: '' },
    attempts: { type: Number, default: 0 },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    lastError: { type: String, default: '' },
    counts: {
      templates: { type: Number, default: 0 },
      quickReplies: { type: Number, default: 0 },
      rules: { type: Number, default: 0 },
      campaigns: { type: Number, default: 0 },
    },
  },
  { _id: false }
);

export const WORKSPACE_STATUSES = [
  'PROVISIONING',
  'ACTIVE',
  'SUSPENDED',
  'ARCHIVED',
  'FAILED_PROVISIONING',
];

export const ONBOARDING_STATUSES = [
  'PENDING_PROFILE',
  'PENDING_INDUSTRY',
  'PENDING_BRANDING',
  'COMPLETED',
];

const workspaceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Workspace name is required.'],
      trim: true,
      minlength: [2, 'Workspace name must be at least 2 characters.'],
      maxlength: [120, 'Workspace name cannot exceed 120 characters.'],
    },
    slug: {
      type: String,
      required: [true, 'Workspace slug is required.'],
      unique: true,
      lowercase: true,
      trim: true,
      minlength: [3, 'Workspace slug must be at least 3 characters.'],
      maxlength: [60, 'Workspace slug cannot exceed 60 characters.'],
      match: [/^[a-z0-9-]+$/, 'Workspace slug may only contain lowercase letters, numbers, and hyphens.'],
    },
    industryKey: {
      type: String,
      required: [true, 'Industry key is required.'],
      enum: {
        values: VALID_INDUSTRIES,
        message: 'Invalid industry key: "{VALUE}". Supported industries: real_estate, gym, clinic, education, salon, automobile, travel_tourism, restaurant_food, professional_services, generic_business, other.',
      },
      default: 'generic_business',
    },
    businessEmail: {
      type: String,
      required: [true, 'Business email is required.'],
      trim: true,
      lowercase: true,
      maxlength: [120, 'Business email cannot exceed 120 characters.'],
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid business email address.'],
    },
    businessPhone: {
      type: String,
      required: [true, 'Business phone is required.'],
      trim: true,
      match: [/^\+[1-9]\d{7,14}$/, 'Business phone must be in valid E.164 international format (e.g. +919811223344).'],
    },
    country: {
      type: String,
      default: 'India',
      trim: true,
      maxlength: [80, 'Country cannot exceed 80 characters.'],
    },
    city: {
      type: String,
      default: '',
      trim: true,
      maxlength: [80, 'City cannot exceed 80 characters.'],
    },
    timezone: {
      type: String,
      default: 'Asia/Kolkata',
      trim: true,
      maxlength: [60, 'Timezone cannot exceed 60 characters.'],
      validate: {
        validator(val) {
          try {
            new Intl.DateTimeFormat('en-US', { timeZone: val });
            return true;
          } catch {
            return false;
          }
        },
        message: 'Invalid IANA timezone: "{VALUE}".',
      },
    },
    currency: {
      type: String,
      default: 'INR',
      uppercase: true,
      trim: true,
      match: [/^[A-Z]{3}$/, 'Currency must be a 3-letter ISO code (e.g. INR, USD).'],
    },
    status: {
      type: String,
      enum: {
        values: WORKSPACE_STATUSES,
        message: 'Invalid workspace status: "{VALUE}".',
      },
      default: 'ACTIVE',
      index: true,
    },
    onboardingStatus: {
      type: String,
      enum: {
        values: ONBOARDING_STATUSES,
        message: 'Invalid onboarding status: "{VALUE}".',
      },
      default: 'COMPLETED',
    },
    logoReference: {
      type: String,
      default: '',
      trim: true,
      maxlength: [500, 'Logo reference cannot exceed 500 characters.'],
    },
    logoUrl: {
      type: String,
      default: '',
      trim: true,
      maxlength: [500, 'Logo URL cannot exceed 500 characters.'],
    },
    setupVersion: {
      type: Number,
      default: 1,
      min: 1,
    },
    configurationVersion: {
      type: Number,
      default: 1,
      min: 1,
    },
    settings: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Present only on workspaces created after automatic starter provisioning was introduced.
    starterProvisioning: {
      type: starterProvisioningSchema,
      default: undefined,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator user reference is required.'],
      index: true,
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

// Indexes
workspaceSchema.index({ status: 1, createdAt: -1 });
workspaceSchema.index({ createdBy: 1, status: 1 });

/**
 * Pre-validation hook to normalize slug
 */
workspaceSchema.pre('validate', function (next) {
  if (this.slug && typeof this.slug === 'string') {
    this.slug = this.slug
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  } else if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  next();
});

export default mongoose.model('Workspace', workspaceSchema);
