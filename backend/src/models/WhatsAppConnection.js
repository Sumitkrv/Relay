import mongoose from 'mongoose';

export const CONNECTION_TYPES = [
  'EXISTING_APP_COEXISTENCE',
  'NEW_CLOUD_API',
  'MOCK_SIMULATED',
];

export const CONNECTION_MODES = [
  'MOCK',
  'LIVE',
];

export const CONNECTION_STATUSES = [
  'NOT_CONNECTED',
  'SETUP_STARTED',
  'METHOD_SELECTED',
  'AWAITING_PROVIDER_AUTHORIZATION',
  'AUTHORIZATION_PENDING',
  'PHONE_VERIFICATION_PENDING',
  'REGISTRATION_PENDING',
  'BILLING_UNVERIFIED',
  'WEBHOOK_UNVERIFIED',
  'READY_TO_ACTIVATE',
  'MOCK_SIMULATED_READY',
  'LIVE_READY',
  'SUSPENDED',
  'RECONNECT_REQUIRED',
  'DISCONNECTING',
  'DISCONNECTED',
  'FAILED',
];

export const VERIFICATION_STATUSES = [
  'UNVERIFIED',
  'CODE_REQUESTED',
  'VERIFIED',
  'FAILED',
];

export const REGISTRATION_STATUSES = [
  'UNREGISTERED',
  'REGISTERING',
  'REGISTERED',
  'FAILED',
];

export const BILLING_STATUSES = [
  'UNVERIFIED',
  'CUSTOMER_DIRECT_PENDING',
  'CUSTOMER_DIRECT_VERIFIED',
  'INELIGIBLE',
  'FAILED',
];

export const WEBHOOK_STATUSES = [
  'UNVERIFIED',
  'PENDING_SUBSCRIPTION',
  'VERIFIED',
  'FAILED',
];

export const PERMISSION_STATUSES = [
  'UNVERIFIED',
  'PENDING',
  'GRANTED',
  'PARTIAL',
  'REVOKED',
];

export const AUTHORIZATION_STATUSES = [
  'UNVERIFIED',
  'PENDING',
  'AUTHORIZED',
  'REVOKED',
  'EXPIRED',
  'FAILED',
];

const whatsAppConnectionSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: [true, 'Workspace ID is required for a WhatsApp connection.'],
      unique: true,
      index: true,
    },
    connectionType: {
      type: String,
      enum: {
        values: CONNECTION_TYPES,
        message: 'Invalid connection type: "{VALUE}".',
      },
      default: 'MOCK_SIMULATED',
    },
    provider: {
      type: String,
      default: 'MOCK',
      trim: true,
    },
    mode: {
      type: String,
      enum: {
        values: CONNECTION_MODES,
        message: 'Invalid connection mode: "{VALUE}".',
      },
      default: 'MOCK',
      index: true,
    },
    connectionMode: {
      type: String,
      enum: CONNECTION_MODES,
      default: 'MOCK',
    },
    displayPhoneNumber: {
      type: String,
      default: '',
      trim: true,
    },
    normalizedPhoneNumber: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    businessPortfolioId: {
      type: String,
      default: null,
      trim: true,
    },
    wabaId: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
    phoneNumberId: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
    connectionStatus: {
      type: String,
      enum: {
        values: CONNECTION_STATUSES,
        message: 'Invalid connection status: "{VALUE}".',
      },
      default: 'NOT_CONNECTED',
      index: true,
    },
    status: {
      type: String,
      enum: CONNECTION_STATUSES,
      default: 'NOT_CONNECTED',
    },
    authorizationStatus: {
      type: String,
      enum: {
        values: AUTHORIZATION_STATUSES,
        message: 'Invalid authorization status: "{VALUE}".',
      },
      default: 'UNVERIFIED',
    },
    phoneVerificationStatus: {
      type: String,
      enum: {
        values: VERIFICATION_STATUSES,
        message: 'Invalid phone verification status: "{VALUE}".',
      },
      default: 'UNVERIFIED',
    },
    registrationStatus: {
      type: String,
      enum: {
        values: REGISTRATION_STATUSES,
        message: 'Invalid registration status: "{VALUE}".',
      },
      default: 'UNREGISTERED',
    },
    billingStatus: {
      type: String,
      enum: {
        values: BILLING_STATUSES,
        message: 'Invalid billing status: "{VALUE}".',
      },
      default: 'UNVERIFIED',
    },
    webhookStatus: {
      type: String,
      enum: {
        values: WEBHOOK_STATUSES,
        message: 'Invalid webhook status: "{VALUE}".',
      },
      default: 'UNVERIFIED',
    },
    permissionsStatus: {
      type: String,
      enum: {
        values: PERMISSION_STATUSES,
        message: 'Invalid permissions status: "{VALUE}".',
      },
      default: 'UNVERIFIED',
    },
    credentialReference: {
      type: String,
      default: null,
      trim: true,
    },
    mockScenario: {
      type: String,
      default: null,
      trim: true,
    },
    isSimulated: {
      type: Boolean,
      default: true,
    },
    lastCheckedAt: {
      type: Date,
      default: Date.now,
    },
    lastErrorCode: {
      type: String,
      default: null,
      trim: true,
    },
    lastErrorMessage: {
      type: String,
      default: null,
      trim: true,
    },
    connectedAt: {
      type: Date,
      default: null,
    },
    disconnectedAt: {
      type: Date,
      default: null,
    },
    disconnectionReason: {
      type: String,
      default: null,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
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

whatsAppConnectionSchema.pre('save', function (next) {
  if (this.connectionStatus && !this.status) this.status = this.connectionStatus;
  if (this.status && !this.connectionStatus) this.connectionStatus = this.status;
  if (this.mode && !this.connectionMode) this.connectionMode = this.mode;
  if (this.connectionMode && !this.mode) this.mode = this.connectionMode;
  next();
});

// Compound Indexes for fast multi-tenant lookup and uniqueness guards
whatsAppConnectionSchema.index({ workspaceId: 1, mode: 1 });
whatsAppConnectionSchema.index({ normalizedPhoneNumber: 1, mode: 1 });

export default mongoose.model('WhatsAppConnection', whatsAppConnectionSchema);
