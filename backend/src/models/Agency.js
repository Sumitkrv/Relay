import mongoose from 'mongoose';

const agencySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    branding: {
      companyName: { type: String, default: 'Spark Digital Agency' },
      logoUrl: { type: String, default: '' },
      brandColor: { type: String, default: '#0D9488' },
      portalTitle: { type: String, default: 'Client Automation Portal' },
      supportEmail: { type: String, default: 'support@sparkagency.test' },
      supportPhone: { type: String, default: '+919876500000' },
      customDomain: { type: String, default: 'crm.sparkagency.test' },
      domainStatus: {
        type: String,
        enum: ['NOT_CONFIGURED', 'DNS_PENDING', 'VERIFIED', 'ACTIVE'],
        default: 'DNS_PENDING',
      },
      dnsTxtRecord: { type: String, default: 'relay-verify=spark-789a42' },
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'SUSPENDED'],
      default: 'ACTIVE',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('Agency', agencySchema);
