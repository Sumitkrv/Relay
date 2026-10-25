import mongoose from 'mongoose';

const publicEnquirySchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    businessEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    businessName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 160,
    },
    industry: {
      type: String,
      enum: ['real_estate', 'gym', 'clinic', 'education', 'salon', 'automobile', 'travel_tourism', 'travel', 'restaurant_food', 'restaurants_food', 'professional_services', 'professional', 'generic_business', 'generic', 'other'],
      default: 'generic_business',
    },
    contactReason: {
      type: String,
      enum: ['general', 'early_access', 'pricing', 'agency_partnership', 'technical'],
      default: 'general',
    },
    phone: {
      type: String,
      trim: true,
      default: '',
      maxlength: 30,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 2000,
    },
    ipHash: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['new', 'reviewed', 'contacted', 'closed'],
      default: 'new',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

publicEnquirySchema.index({ businessEmail: 1, createdAt: -1 });
publicEnquirySchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('PublicEnquiry', publicEnquirySchema);
