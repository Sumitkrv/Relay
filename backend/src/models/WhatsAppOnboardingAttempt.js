import mongoose from 'mongoose';

export const ONBOARDING_ATTEMPT_STATUSES = [
  'STARTED',
  'METHOD_CHOSEN',
  'AUTHORIZATION_SIMULATED',
  'VERIFICATION_SIMULATED',
  'BILLING_REVIEWED',
  'READY_CHECKED',
  'COMPLETED',
  'CANCELLED',
  'EXPIRED',
  'FAILED',
];

export const ONBOARDING_METHODS = [
  'EXISTING_APP_COEXISTENCE',
  'NEW_CLOUD_API',
  'MOCK_SIMULATED',
];

const whatsAppOnboardingAttemptSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: [true, 'Workspace reference is required for an onboarding attempt.'],
      index: true,
    },
    initiatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required for an onboarding attempt.'],
      index: true,
    },
    connectionMethod: {
      type: String,
      enum: {
        values: ONBOARDING_METHODS,
        message: 'Invalid onboarding connection method: "{VALUE}".',
      },
      default: 'EXISTING_APP_COEXISTENCE',
    },
    requestedPhone: {
      type: String,
      default: '',
      trim: true,
    },
    normalizedRequestedPhone: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    attemptStatus: {
      type: String,
      enum: {
        values: ONBOARDING_ATTEMPT_STATUSES,
        message: 'Invalid onboarding attempt status: "{VALUE}".',
      },
      default: 'STARTED',
      index: true,
    },
    stateReferenceHash: {
      type: String,
      required: [true, 'State reference hash is required for CSRF protection.'],
      unique: true,
      index: true,
    },
    currentStep: {
      type: Number,
      min: 1,
      max: 7,
      default: 1,
    },
    simulatedScenario: {
      type: String,
      default: 'SCENARIO_A_APP_ELIGIBLE',
      trim: true,
    },
    eligibilityAssessment: {
      status: {
        type: String,
        enum: [
          'NOT_ASSESSED',
          'INFORMATION_REQUIRED',
          'POTENTIALLY_ELIGIBLE',
          'PROVIDER_VERIFICATION_REQUIRED',
          'ELIGIBLE_VERIFIED',
          'INELIGIBLE_VERIFIED',
        ],
        default: 'NOT_ASSESSED',
      },
      notes: { type: String, default: '' },
      evaluatedAt: { type: Date, default: null },
    },
    phoneVerificationCode: {
      type: String,
      default: null,
    },
    verificationAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    billingReadiness: {
      intendedBillingModel: { type: String, default: 'CUSTOMER_DIRECT' },
      billingResponsibility: { type: String, default: 'CUSTOMER' },
      verificationStatus: {
        type: String,
        enum: ['UNVERIFIED', 'CUSTOMER_DIRECT_PENDING', 'CUSTOMER_DIRECT_VERIFIED', 'INELIGIBLE', 'FAILED'],
        default: 'UNVERIFIED',
      },
      notes: { type: String, default: '' },
    },
    providerSource: {
      type: String,
      default: 'MOCK',
      trim: true,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 60 * 60 * 1000), // 1 hour expiry
      index: true,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    failureCode: {
      type: String,
      default: null,
      trim: true,
    },
    safeFailureDescription: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    timestamps: true,
    strict: 'throw',
    toJSON: {
      transform(_doc, ret) {
        delete ret.__v;
        delete ret.phoneVerificationCode; // Never expose verification codes in JSON
        return ret;
      },
    },
  }
);

// Compound indexes
whatsAppOnboardingAttemptSchema.index({ workspaceId: 1, attemptStatus: 1, createdAt: -1 });

export default mongoose.model('WhatsAppOnboardingAttempt', whatsAppOnboardingAttemptSchema);
