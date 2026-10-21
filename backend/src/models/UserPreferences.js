import mongoose from 'mongoose';

const userPreferencesSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    timezone: {
      type: String,
      default: 'Asia/Kolkata',
      trim: true,
    },
    dateFormat: {
      type: String,
      default: 'DD/MM/YYYY',
      enum: ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'],
    },
    timeFormat: {
      type: String,
      default: '12h',
      enum: ['12h', '24h'],
    },
    defaultCountryCallingCode: {
      type: String,
      default: '+91',
      trim: true,
      maxlength: 8,
    },
    preferredLanguage: {
      type: String,
      default: 'English',
      trim: true,
      maxlength: 40,
    },
    quietHours: {
      enabled: {
        type: Boolean,
        default: true,
      },
      start: {
        type: String,
        default: '21:00',
      },
      end: {
        type: String,
        default: '09:00',
      },
    },
    workingDays: {
      type: [String],
      default: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    },
    notificationPreferences: {
      campaignScheduled: {
        type: Boolean,
        default: true,
      },
      campaignSimulationCompleted: {
        type: Boolean,
        default: true,
      },
      campaignRequiresAttention: {
        type: Boolean,
        default: true,
      },
      incomingReply: {
        type: Boolean,
        default: false,
      },
      providerDisconnected: {
        type: Boolean,
        default: true,
      },
    },
    campaignSummaryFrequency: {
      type: String,
      default: 'daily',
      enum: ['immediate', 'daily', 'weekly', 'none'],
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('UserPreferences', userPreferencesSchema);
