import mongoose from 'mongoose';
import User from '../models/User.js';
import BusinessProfile from '../models/BusinessProfile.js';
import UserPreferences from '../models/UserPreferences.js';
import SecurityAuditLog from '../models/SecurityAuditLog.js';

const fail = (message, status = 400) => Object.assign(new Error(message), { status });

// Helper to calculate business profile completeness
function calculateBusinessCompleteness(bp) {
  if (!bp) return { score: 0, isComplete: false, missingFields: ['legalOrTradingName', 'email', 'phone', 'city'] };
  
  const checks = [
    { field: 'legalOrTradingName', weight: 25, valid: !!bp.legalOrTradingName?.trim() },
    { field: 'email', weight: 25, valid: !!bp.email?.trim() && /^\S+@\S+\.\S+$/.test(bp.email) },
    { field: 'phone', weight: 25, valid: !!bp.phone?.trim() },
    { field: 'city', weight: 25, valid: !!bp.city?.trim() },
  ];

  const score = checks.reduce((acc, c) => (c.valid ? acc + c.weight : acc), 0);
  const missingFields = checks.filter((c) => !c.valid).map((c) => c.field);

  return {
    score,
    isComplete: score >= 100,
    missingFields,
  };
}

// 1. GET /api/settings/profile
export async function getProfile(req, res) {
  const user = req.user;
  res.json({
    profile: {
      id: user._id,
      name: user.name,
      email: user.email,
      businessName: user.businessName || '',
      role: user.role || 'owner',
      roleDisplay:
        user.role === 'owner'
          ? 'Owner / Single Operator'
          : user.role === 'admin'
          ? 'Administrator'
          : 'Member',
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt || null,
      passwordChangedAt: user.passwordChangedAt || null,
    },
  });
}

// 2. PATCH /api/settings/profile
export async function updateProfile(req, res) {
  const { name, businessName } = req.body || {};
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) {
    throw fail('Name must be between 2 and 80 characters.');
  }

  const beforeName = req.user.name;
  req.user.name = name.trim();

  if (businessName !== undefined) {
    if (typeof businessName !== 'string' || businessName.trim().length > 120) {
      throw fail('Business name must be 120 characters or fewer.');
    }
    req.user.businessName = businessName.trim();

    // Also update BusinessProfile legalOrTradingName if it exists
    await BusinessProfile.findOneAndUpdate(
      { ownerId: req.user._id },
      { $set: { legalOrTradingName: req.user.businessName, displayName: req.user.businessName } },
      { upsert: false }
    );
  }

  await req.user.save();

  await SecurityAuditLog.create({
    ownerId: req.user._id,
    actorId: req.user._id,
    action: 'profile_updated',
    ipAddress: req.ip || req.get('x-forwarded-for') || '',
    userAgent: req.get('user-agent') || '',
    metadata: { fromName: beforeName, toName: req.user.name, businessName: req.user.businessName },
  }).catch(() => {});

  res.json({
    profile: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      businessName: req.user.businessName || '',
      role: req.user.role || 'owner',
      roleDisplay:
        req.user.role === 'owner'
          ? 'Owner / Single Operator'
          : req.user.role === 'admin'
          ? 'Administrator'
          : 'Member',
      createdAt: req.user.createdAt,
      lastLoginAt: req.user.lastLoginAt || null,
      passwordChangedAt: req.user.passwordChangedAt || null,
    },
    message: 'Profile updated successfully.',
  });
}

// 3. GET /api/settings/business
export async function getBusinessProfile(req, res) {
  let bp = await BusinessProfile.findOne({ ownerId: req.user._id }).lean();
  if (!bp) {
    bp = {
      ownerId: req.user._id,
      legalOrTradingName: req.user.businessName || 'M2W Realty',
      displayName: req.user.businessName || 'M2W Realty',
      businessCategory: 'Real Estate',
      email: req.user.email || '',
      phone: '',
      website: 'https://m2wrealty.com',
      description: 'M2W Realty real estate advisory, property inquiry automation and client engagement.',
      address: '',
      city: '',
      state: '',
      country: 'India',
      postalCode: '',
      logoUrl: '/logo.png',
      supportEmail: req.user.email || '',
    };
  }

  const { score, isComplete, missingFields } = calculateBusinessCompleteness(bp);

  res.json({
    businessProfile: bp,
    completenessScore: score,
    isComplete,
    missingFields,
  });
}

// 4. PUT /api/settings/business
export async function updateBusinessProfile(req, res) {
  const b = req.body || {};

  if (!b.legalOrTradingName || typeof b.legalOrTradingName !== 'string' || b.legalOrTradingName.trim().length < 2) {
    throw fail('Legal or trading name must be at least 2 characters.');
  }

  if (b.email && (!/^\S+@\S+\.\S+$/.test(b.email) || b.email.length > 120)) {
    throw fail('Provide a valid business email address.');
  }

  if (b.supportEmail && (!/^\S+@\S+\.\S+$/.test(b.supportEmail) || b.supportEmail.length > 120)) {
    throw fail('Provide a valid support email address.');
  }

  if (b.website && b.website.trim()) {
    try {
      const u = new URL(b.website.startsWith('http') ? b.website : `https://${b.website}`);
      if (!u.hostname.includes('.') || u.hostname.length < 4) {
        throw new Error();
      }
    } catch {
      throw fail('Provide a valid website URL format.');
    }
  }

  const payload = {
    legalOrTradingName: b.legalOrTradingName.trim().slice(0, 160),
    displayName: String(b.displayName || b.legalOrTradingName).trim().slice(0, 120),
    businessCategory: String(b.businessCategory || 'Real Estate').trim().slice(0, 80),
    email: String(b.email || '').trim().toLowerCase().slice(0, 120),
    phone: String(b.phone || '').trim().slice(0, 40),
    website: String(b.website || '').trim().slice(0, 240),
    description: String(b.description || '').trim().slice(0, 2000),
    address: String(b.address || '').trim().slice(0, 300),
    city: String(b.city || '').trim().slice(0, 80),
    state: String(b.state || '').trim().slice(0, 80),
    country: String(b.country || 'India').trim().slice(0, 80),
    postalCode: String(b.postalCode || '').trim().slice(0, 20),
    logoUrl: String(b.logoUrl || '').trim().slice(0, 500),
    supportEmail: String(b.supportEmail || '').trim().toLowerCase().slice(0, 120),
  };

  const updated = await BusinessProfile.findOneAndUpdate(
    { ownerId: req.user._id },
    { $set: payload },
    { new: true, upsert: true, runValidators: true }
  ).lean();

  // Keep User.businessName in sync with the legal or display name
  if (req.user.businessName !== payload.legalOrTradingName) {
    req.user.businessName = payload.legalOrTradingName.slice(0, 120);
    await req.user.save();
  }

  await SecurityAuditLog.create({
    ownerId: req.user._id,
    actorId: req.user._id,
    action: 'business_updated',
    ipAddress: req.ip || req.get('x-forwarded-for') || '',
    userAgent: req.get('user-agent') || '',
    metadata: { legalOrTradingName: payload.legalOrTradingName, city: payload.city },
  }).catch(() => {});

  const { score, isComplete, missingFields } = calculateBusinessCompleteness(updated);

  res.json({
    businessProfile: updated,
    completenessScore: score,
    isComplete,
    missingFields,
    message: 'Business profile saved successfully.',
  });
}

// 5. GET /api/settings/preferences
export async function getPreferences(req, res) {
  let prefs = await UserPreferences.findOne({ ownerId: req.user._id }).lean();
  if (!prefs) {
    prefs = {
      ownerId: req.user._id,
      timezone: 'Asia/Kolkata',
      dateFormat: 'DD/MM/YYYY',
      timeFormat: '12h',
      defaultCountryCallingCode: '+91',
      preferredLanguage: 'English',
      quietHours: { enabled: true, start: '21:00', end: '09:00' },
      workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      notificationPreferences: {
        campaignScheduled: true,
        campaignSimulationCompleted: true,
        campaignRequiresAttention: true,
        incomingReply: false,
        providerDisconnected: true,
      },
      campaignSummaryFrequency: 'daily',
    };
  }

  res.json({ preferences: prefs });
}

// 6. PUT /api/settings/preferences
export async function updatePreferences(req, res) {
  const b = req.body || {};

  // Validate IANA timezone
  if (b.timezone) {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: b.timezone });
    } catch {
      throw fail('Invalid IANA timezone identifier.');
    }
  }

  if (b.dateFormat && !['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'].includes(b.dateFormat)) {
    throw fail('Invalid date format. Choose DD/MM/YYYY, MM/DD/YYYY, or YYYY-MM-DD.');
  }

  if (b.timeFormat && !['12h', '24h'].includes(b.timeFormat)) {
    throw fail('Invalid time display format.');
  }

  if (b.defaultCountryCallingCode && !/^\+[1-9]\d{0,4}$/.test(b.defaultCountryCallingCode.trim())) {
    throw fail('Invalid country calling code (e.g. +91).');
  }

  const payload = {
    timezone: b.timezone ? b.timezone.trim() : 'Asia/Kolkata',
    dateFormat: b.dateFormat || 'DD/MM/YYYY',
    timeFormat: b.timeFormat || '12h',
    defaultCountryCallingCode: b.defaultCountryCallingCode ? b.defaultCountryCallingCode.trim() : '+91',
    preferredLanguage: b.preferredLanguage ? String(b.preferredLanguage).trim().slice(0, 40) : 'English',
    quietHours: {
      enabled: b.quietHours?.enabled !== false,
      start: b.quietHours?.start || '21:00',
      end: b.quietHours?.end || '09:00',
    },
    workingDays: Array.isArray(b.workingDays)
      ? b.workingDays.map((d) => String(d).trim()).filter(Boolean)
      : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    notificationPreferences: {
      campaignScheduled: b.notificationPreferences?.campaignScheduled !== false,
      campaignSimulationCompleted: b.notificationPreferences?.campaignSimulationCompleted !== false,
      campaignRequiresAttention: b.notificationPreferences?.campaignRequiresAttention !== false,
      incomingReply: Boolean(b.notificationPreferences?.incomingReply),
      providerDisconnected: b.notificationPreferences?.providerDisconnected !== false,
    },
    campaignSummaryFrequency: ['immediate', 'daily', 'weekly', 'none'].includes(b.campaignSummaryFrequency)
      ? b.campaignSummaryFrequency
      : 'daily',
  };

  const updated = await UserPreferences.findOneAndUpdate(
    { ownerId: req.user._id },
    { $set: payload },
    { new: true, upsert: true, runValidators: true }
  ).lean();

  await SecurityAuditLog.create({
    ownerId: req.user._id,
    actorId: req.user._id,
    action: 'preferences_updated',
    ipAddress: req.ip || req.get('x-forwarded-for') || '',
    userAgent: req.get('user-agent') || '',
    metadata: { timezone: payload.timezone, dateFormat: payload.dateFormat },
  }).catch(() => {});

  res.json({
    preferences: updated,
    message: 'Preferences updated successfully.',
  });
}

// 7. GET /api/settings/security
export async function getSecurityOverview(req, res) {
  const events = await SecurityAuditLog.find({ ownerId: req.user._id })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  res.json({
    security: {
      passwordLastChanged: req.user.passwordChangedAt || null,
      lastLoginAt: req.user.lastLoginAt || null,
      activeSessionsCount: 1, // Single-operator workspace
      authVersion: req.user.authVersion || 1,
      recentEvents: events.map((e) => ({
        id: e._id,
        action: e.action,
        ipAddress: e.ipAddress,
        userAgent: e.userAgent,
        createdAt: e.createdAt,
        metadata: e.metadata,
      })),
    },
  });
}

// 8. GET /api/settings/integrations
export async function getIntegrationStatus(req, res) {
  res.json({
    integration: {
      provider: 'Official WhatsApp Cloud API',
      connectionStatus: 'Disconnected',
      executionMode: 'Mock Mode (Safe)',
      notice: 'Official WhatsApp connection will be configured in the final integration phase (Prompt 10).',
      isMockMode: true,
      businessNumber: null,
      wabaId: null,
      templateSyncStatus: 'Ready for verification',
      webhookReadiness: 'Reserved for Phase 10',
      lastVerifiedAt: null,
      updatedAt: new Date(),
    },
  });
}

// 9. GET /api/settings/system-status
export async function getSystemStatus(req, res) {
  const bp = await BusinessProfile.findOne({ ownerId: req.user._id }).lean();
  const prefs = await UserPreferences.findOne({ ownerId: req.user._id }).lean();
  const { score, isComplete } = calculateBusinessCompleteness(bp);

  res.json({
    system: {
      backend: 'connected',
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      mockMode: true,
      whatsappProvider: 'disconnected',
      setupReadiness: {
        businessProfile: {
          status: isComplete ? 'Complete' : 'Incomplete',
          score,
        },
        preferences: {
          status: prefs ? 'Configured' : 'Defaults Active',
        },
        whatsappIntegration: {
          status: 'Mock Mode Active (Reserved for Phase 10)',
        },
      },
    },
  });
}

// 10. GET /api/settings/demo-status (Development only)
export async function getDemoStatus(req, res) {
  const isDev = process.env.NODE_ENV !== 'production';
  const ownerId = req.user._id;

  const [demoContactsCount, demoCampaignsCount, demoTemplatesCount, demoConversationsCount] = await Promise.all([
    mongoose.model('Contact').countDocuments({
      ownerId,
      $or: [{ 'customFields.isDemo': true }, { tags: 'demo' }],
    }),
    mongoose.model('Campaign').countDocuments({
      ownerId,
      $or: [{ name: { $regex: /\(Demo\)$/i } }, { tags: 'demo' }],
    }),
    mongoose.model('MessageTemplate').countDocuments({
      ownerId,
      $or: [{ tags: 'demo' }, { name: { $regex: /\(Demo\)$/i } }],
    }),
    mongoose.model('Conversation').countDocuments({
      ownerId,
      source: 'test',
    }),
  ]);

  res.json({
    isDevelopment: isDev,
    demoDatasetId: 'relay-real-estate-qa-v1',
    counts: {
      contacts: demoContactsCount,
      campaigns: demoCampaignsCount,
      templates: demoTemplatesCount,
      conversations: demoConversationsCount,
    },
    fixturesPath: 'test-fixtures/',
    notice: 'TEST DATA ONLY · NO EXTERNAL WHATSAPP MESSAGES',
  });
}

// 11. POST /api/settings/demo-seed (Development only)
export async function triggerDemoSeed(req, res) {
  if (process.env.NODE_ENV === 'production') {
    throw fail('Demo seeding is disabled in production.', 403);
  }
  const { seed } = await import('../scripts/seedDemoData.js');
  const result = await seed();
  res.json({ result, message: 'Demo seeding operation completed.' });
}

// 12. POST /api/settings/demo-reset (Development only)
export async function triggerDemoReset(req, res) {
  if (process.env.NODE_ENV === 'production') {
    throw fail('Demo data reset is disabled in production.', 403);
  }
  const { reset } = await import('../scripts/resetDemoData.js');
  const result = await reset();
  res.json({ result, message: 'Demo dataset reset successfully. Production records preserved.' });
}
