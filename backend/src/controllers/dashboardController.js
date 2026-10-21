import mongoose from 'mongoose';
import { getOwnerContactStats } from './contactController.js';
import Contact from '../models/Contact.js';
import ContactActivity from '../models/ContactActivity.js';
import Campaign from '../models/Campaign.js';
import CampaignExecution from '../models/CampaignExecution.js';
import CampaignActivity from '../models/CampaignActivity.js';
import Conversation from '../models/Conversation.js';
import ConversationActivity from '../models/ConversationActivity.js';
import BusinessProfile from '../models/BusinessProfile.js';
import UserPreferences from '../models/UserPreferences.js';
import SecurityAuditLog from '../models/SecurityAuditLog.js';
import MessageTemplate from '../models/MessageTemplate.js';
import ImportJob from '../models/ImportJob.js';

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
  return { score, isComplete: score >= 100, missingFields };
}

// Backwards-compatible /api/dashboard/stats
export async function stats(req, res) {
  const [contacts, groups, recentCampaigns] = await Promise.all([
    getOwnerContactStats(req.user._id),
    Campaign.aggregate([
      { $match: { ownerId: req.user._id } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Campaign.find({ ownerId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name status createdAt updatedAt category')
      .lean(),
  ]);

  const c = Object.fromEntries(groups.map((x) => [x._id, x.count]));
  const totalCampaigns = groups.reduce((n, x) => n + x.count, 0);

  res.json({
    stats: {
      contactTotal: contacts.totalContacts,
      eligibleTotal: contacts.eligibleWhatsAppContacts,
      newLeads: contacts.newLeads,
      interestedLeads: contacts.interestedLeads,
      convertedLeads: contacts.convertedLeads,
      totalCampaigns,
      draftCampaigns: c.Draft || 0,
      validatedCampaigns: c['Validated for Preparation'] || 0,
      campaignsRequiringAttention:
        (c['Needs Review'] || 0) +
        (c['Awaiting Provider Setup'] || 0) +
        (c['Awaiting Template Approval'] || 0),
    },
    recentCampaigns,
    campaignPerformance: [],
    contactGrowth: contacts.contactGrowth,
  });
}

// Backwards-compatible /api/dashboard/activity
export async function activity(req, res) {
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 8));
  const activities = await ContactActivity.find({ ownerId: req.user._id })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('contactId', 'fullName companyName')
    .select('activityType description createdAt changes contactId')
    .lean();

  res.json({
    activities: activities.map((item) => ({
      ...item,
      title: item.activityType.replaceAll('_', ' '),
      action: item.activityType,
      contactName: item.contactId?.fullName,
      companyName: item.contactId?.companyName,
    })),
  });
}

// Full Operational Dashboard Aggregator: GET /api/dashboard/overview
export async function overview(req, res) {
  const ownerId = req.user._id;

  const [
    contactStatsData,
    optedOutCount,
    unknownConsentCount,
    campaignStatusGroups,
    campaignExecutionGroups,
    scheduledCampaignsCount,
    recentCampaignsDocs,
    upcomingCampaignsDocs,
    conversationStatusGroups,
    conversationUnreadAgg,
    contactActivities,
    campaignActivities,
    conversationActivities,
    securityLogs,
    businessProfile,
    userPreferences,
    templateCount,
    totalCampaignCount,
    failedExecutionsCount,
    importErrorsCount,
  ] = await Promise.all([
    getOwnerContactStats(ownerId),
    Contact.countDocuments({ ownerId, isDeleted: false, whatsappConsentStatus: 'Opted Out' }),
    Contact.countDocuments({ ownerId, isDeleted: false, whatsappConsentStatus: { $in: ['Unknown', null] } }),
    Campaign.aggregate([
      { $match: { ownerId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    CampaignExecution.aggregate([
      { $match: { ownerId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Campaign.countDocuments({ ownerId, 'mockSchedule.status': 'scheduled' }),
    Campaign.find({ ownerId })
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(5)
      .select('name status goal category audienceSelectionMode validationSummary mockSchedule createdAt updatedAt selectedTemplateId')
      .populate('selectedTemplateId', 'name')
      .lean(),
    Campaign.find({
      ownerId,
      'mockSchedule.status': 'scheduled',
      'mockSchedule.startAt': { $gte: new Date() },
    })
      .sort({ 'mockSchedule.startAt': 1 })
      .limit(5)
      .select('name mockSchedule validationSummary selectedTemplateId createdAt')
      .populate('selectedTemplateId', 'name')
      .lean(),
    Conversation.aggregate([
      { $match: { ownerId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Conversation.aggregate([
      { $match: { ownerId } },
      { $group: { _id: null, total: { $sum: '$internalUnreadCount' } } },
    ]),
    ContactActivity.find({ ownerId })
      .sort({ createdAt: -1 })
      .limit(8)
      .populate('contactId', 'fullName companyName')
      .lean(),
    CampaignActivity.find({ ownerId })
      .sort({ createdAt: -1 })
      .limit(8)
      .populate('campaignId', 'name')
      .lean(),
    ConversationActivity.find({ ownerId })
      .sort({ createdAt: -1 })
      .limit(8)
      .lean(),
    SecurityAuditLog.find({ ownerId })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
    BusinessProfile.findOne({ ownerId }).lean(),
    UserPreferences.findOne({ ownerId }).lean(),
    MessageTemplate.countDocuments({ ownerId, localStatus: { $ne: 'Archived' } }),
    Campaign.countDocuments({ ownerId, status: { $ne: 'Archived' } }),
    CampaignExecution.countDocuments({ ownerId, status: 'failed' }),
    ImportJob.countDocuments({ ownerId, failedCount: { $gt: 0 } }),
  ]);

  const campaignStatusMap = Object.fromEntries(campaignStatusGroups.map((x) => [x._id, x.count]));
  const campaignExecMap = Object.fromEntries(campaignExecutionGroups.map((x) => [x._id, x.count]));
  const convStatusMap = Object.fromEntries(conversationStatusGroups.map((x) => [x._id, x.count]));

  const configuredTimezone = userPreferences?.timezone || 'Asia/Kolkata';

  // Normalize recent campaigns
  const normalizedRecentCampaigns = recentCampaignsDocs.map((c) => {
    let normalizedStatus = c.status;
    if (c.mockSchedule?.status === 'scheduled') {
      normalizedStatus = 'Scheduled (Mock)';
    } else if (c.status === 'Validated for Preparation') {
      normalizedStatus = 'Ready for Preparation';
    }

    const audienceCount =
      c.validationSummary?.counts?.total ??
      c.validationSummary?.totalAudience ??
      0;

    const isScheduled = c.mockSchedule?.status === 'scheduled';
    const isTemplateMissing = !c.selectedTemplateId;
    const templateLabel = c.selectedTemplateId?.name
      ? c.selectedTemplateId.name
      : isScheduled
      ? 'Template Required (Action Needed)'
      : 'No template selected';

    return {
      _id: c._id,
      name: c.name,
      audience: audienceCount,
      template: templateLabel,
      requiresTemplate: isScheduled && isTemplateMissing,
      schedule: c.mockSchedule?.startAt || null,
      timezone: c.mockSchedule?.timezone || configuredTimezone,
      status: normalizedStatus,
      rawStatus: c.status,
      updatedAt: c.updatedAt || c.createdAt,
    };
  });

  // Upcoming campaigns formatting
  const upcomingCampaigns = upcomingCampaignsDocs.map((c) => {
    const audienceSize =
      c.validationSummary?.counts?.total ??
      c.validationSummary?.totalAudience ??
      0;

    const isTemplateMissing = !c.selectedTemplateId;

    return {
      _id: c._id,
      name: c.name,
      scheduledStartAt: c.mockSchedule?.startAt,
      timezone: c.mockSchedule?.timezone || configuredTimezone,
      audienceSize,
      executionMode: 'Mock Simulation',
      status: 'Scheduled (Mock)',
      templateName: c.selectedTemplateId?.name || 'Template Required (Action Needed)',
      requiresTemplate: isTemplateMissing,
    };
  });

  // Unified recent activity timeline (top 10)
  const unifiedActivities = [
    ...contactActivities.map((x) => ({
      _id: x._id,
      module: 'Contacts',
      eventType: x.activityType,
      title: x.activityType ? x.activityType.replaceAll('_', ' ') : 'Contact event',
      description:
        x.description ||
        (x.contactId?.fullName ? `Updated contact ${x.contactId.fullName}` : 'Contact updated'),
      timestamp: x.createdAt,
      source: 'Contacts CRM',
    })),
    ...campaignActivities.map((x) => ({
      _id: x._id,
      module: 'Campaigns',
      eventType: x.activityType,
      title: x.activityType ? x.activityType.replaceAll('_', ' ') : 'Campaign event',
      description:
        x.description ||
        (x.campaignId?.name ? `Campaign ${x.campaignId.name}` : 'Campaign updated'),
      timestamp: x.createdAt,
      source: 'Campaign Engine',
    })),
    ...conversationActivities.map((x) => ({
      _id: x._id,
      module: 'Inbox',
      eventType: x.eventType,
      title: x.eventType ? x.eventType.replaceAll('_', ' ') : 'Conversation event',
      description: x.eventType.replaceAll('_', ' '),
      timestamp: x.createdAt,
      source: x.eventSource === 'manual' ? 'Manual Note' : 'Internal CRM',
    })),
    ...securityLogs.map((x) => ({
      _id: x._id,
      module: 'Settings',
      eventType: x.action,
      title: x.action ? x.action.replaceAll('_', ' ') : 'Security action',
      description: `Security: ${x.action.replaceAll('_', ' ')}`,
      timestamp: x.createdAt,
      source: 'Security Audit',
    })),
  ]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 10);

  // Business Profile Completeness
  const { score: bpScore, isComplete: bpComplete, missingFields } = calculateBusinessCompleteness(businessProfile);

  // Operational Alerts ("Needs Attention")
  const alerts = [];
  if (!bpComplete) {
    alerts.push({
      id: 'alert_bp_incomplete',
      severity: 'warning',
      module: 'Settings',
      title: 'Business Profile Incomplete',
      message: `Complete missing fields (${missingFields.join(', ')}) to finalize property enquiry branding.`,
      actionPath: '/settings?tab=business',
      actionLabel: 'Complete Profile',
    });
  }

  // Official Provider status alert
  alerts.push({
    id: 'alert_provider_disconnected',
    severity: 'info',
    module: 'Settings',
    title: 'WhatsApp Provider Disconnected',
    message: 'Official Meta WhatsApp Cloud API credentials are disconnected. Internal mock mode active.',
    actionPath: '/settings?tab=integrations',
    actionLabel: 'View Provider Status',
  });

  // Active actionable warnings: Scheduled campaigns missing templates
  const missingTemplateCampaigns = upcomingCampaignsDocs.filter((c) => !c.selectedTemplateId);
  for (const c of missingTemplateCampaigns) {
    alerts.push({
      id: `alert_missing_template_${c._id}`,
      severity: 'warning',
      module: 'Campaigns',
      title: 'Scheduled Campaign Requires Template',
      message: `Campaign "${c.name}" is scheduled without a message template. Attach a template in Campaign Editor before execution.`,
      actionPath: `/campaigns/${c._id}/edit`,
      actionLabel: 'Attach Template',
    });
  }

  if (failedExecutionsCount > 0) {
    alerts.push({
      id: 'alert_campaign_failed',
      severity: 'error',
      module: 'Campaigns',
      title: 'Campaign Simulation Failed',
      message: `${failedExecutionsCount} mock campaign execution(s) reported failures. Review run logs.`,
      actionPath: '/campaigns',
      actionLabel: 'Review Campaigns',
    });
  }

  if (importErrorsCount > 0) {
    alerts.push({
      id: 'alert_import_errors',
      severity: 'warning',
      module: 'Contacts',
      title: 'Rejected Import Records',
      message: `${importErrorsCount} import batch(es) had rejected rows due to phone number or schema validation.`,
      actionPath: '/contacts',
      actionLabel: 'View Contacts',
    });
  }

  // Guided Onboarding Checklist
  const onboardingSteps = [
    {
      id: 'profile',
      label: 'Complete Business Profile',
      completed: bpComplete,
      path: '/settings?tab=business',
      description: 'Add legal trading name, phone and office address.',
    },
    {
      id: 'contacts',
      label: 'Import Contacts',
      completed: contactStatsData.totalContacts > 0,
      path: '/import',
      description: 'Upload property enquiry leads via Excel or CSV.',
    },
    {
      id: 'consent',
      label: 'Review Consent Records',
      completed: contactStatsData.eligibleWhatsAppContacts > 0,
      path: '/contacts?whatsappConsentStatus=Opted%20In',
      description: 'Verify affirmative WhatsApp messaging consent.',
    },
    {
      id: 'template',
      label: 'Create WhatsApp Template',
      completed: templateCount > 0,
      path: '/templates',
      description: 'Draft personalized property brochure or enquiry templates.',
    },
    {
      id: 'campaign',
      label: 'Prepare Campaign',
      completed: totalCampaignCount > 0,
      path: '/campaigns/new',
      description: 'Select audience and preview property messages.',
    },
    {
      id: 'provider',
      label: 'Review WhatsApp Integration Readiness',
      completed: false, // Truthful: remains reserved for final integration phase
      path: '/settings?tab=channels',
      description: 'Verify official WhatsApp Business Account credentials.',
    },
  ];

  const onboardingCompleteCount = onboardingSteps.filter((s) => s.completed).length;

  res.json({
    businessContext: {
      businessName: businessProfile?.displayName || businessProfile?.legalOrTradingName || req.user.businessName || 'M2W Realty',
      timezone: configuredTimezone,
    },
    contacts: {
      total: contactStatsData.totalContacts,
      verifiedOptedIn: contactStatsData.eligibleWhatsAppContacts,
      optedOut: optedOutCount,
      unknownConsent: unknownConsentCount,
      newLeads: contactStatsData.newLeads,
      interestedLeads: contactStatsData.interestedLeads,
      convertedLeads: contactStatsData.convertedLeads,
      growth: contactStatsData.contactGrowth || [],
    },
    campaigns: {
      total: campaignStatusGroups.reduce((acc, curr) => acc + curr.count, 0),
      draft: campaignStatusMap.Draft || 0,
      readyForPreparation: campaignStatusMap['Validated for Preparation'] || 0,
      needsReview: campaignStatusMap['Needs Review'] || 0,
      scheduled: scheduledCampaignsCount,
      running: campaignExecMap.running || 0,
      paused: campaignExecMap.paused || 0,
      completed: campaignExecMap.completed || 0,
      failed: campaignExecMap.failed || 0,
      archived: campaignStatusMap.Archived || 0,
      recent: normalizedRecentCampaigns,
    },
    upcomingCampaigns,
    inbox: {
      openConversations: convStatusMap.Open || 0,
      needsReview: (convStatusMap['Follow-up Required'] || 0) + (convStatusMap.Pending || 0),
      internalUnread: conversationUnreadAgg[0]?.total || 0,
      verifiedReplies: null, // STRICTLY null when provider is disconnected; NOT a misleading numeric 0
      verifiedRepliesAvailable: false,
      readinessNotice: 'Connect WhatsApp to see verified customer replies.',
    },
    provider: {
      providerName: 'Official WhatsApp Cloud API',
      connectionStatus: 'Disconnected',
      executionMode: 'Mock Mode (Safe)',
      businessNumber: null,
      lastVerifiedAt: null,
      webhookStatus: 'Not Available',
      templateSync: 'Not Available',
      notes: 'External WhatsApp Cloud API sending is disabled in safe sandbox mode.',
    },
    system: {
      backendHealth: 'CRM Online',
      databaseHealth: mongoose.connection.readyState === 1 ? 'MongoDB Connected' : 'Degraded',
      workerHealth: 'Mock Engine Active',
      mode: 'Single-Owner Real Estate Automation',
    },
    activity: unifiedActivities,
    alerts,
    onboarding: {
      isComplete: onboardingCompleteCount === onboardingSteps.length,
      completedCount: onboardingCompleteCount,
      totalSteps: onboardingSteps.length,
      steps: onboardingSteps,
    },
  });
}
