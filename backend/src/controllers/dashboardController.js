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
import Message from '../models/Message.js';
import RuleExecution from '../models/RuleExecution.js';
import ImportJob from '../models/ImportJob.js';
import Workspace from '../models/Workspace.js';
import { getWorkerStatus } from '../services/messageQueueService.js';

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
  const headerWsId = req.headers?.['x-workspace-id'] || (typeof req.get === 'function' ? req.get('x-workspace-id') : null);
  const explicitWsId = req.workspace?._id || (headerWsId && mongoose.isObjectIdOrHexString(headerWsId) ? headerWsId : req.user.defaultWorkspaceId) || null;
  // Same boundary as the module lists (tenantScope): active workspace AND the signed-in author.
  const wsFilter = explicitWsId && mongoose.isObjectIdOrHexString(explicitWsId)
    ? { workspaceId: new mongoose.Types.ObjectId(explicitWsId), ownerId: req.user._id }
    : { ownerId: req.user._id };

  const [contacts, groups, recentCampaigns] = await Promise.all([
    getOwnerContactStats(req.user._id, explicitWsId),
    Campaign.aggregate([
      { $match: wsFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Campaign.find(wsFilter)
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
  const headerWsId = req.headers?.['x-workspace-id'] || (typeof req.get === 'function' ? req.get('x-workspace-id') : null);
  const explicitWsId = req.workspace?._id || (headerWsId && mongoose.isObjectIdOrHexString(headerWsId) ? headerWsId : req.user.defaultWorkspaceId) || null;
  const wsFilter = explicitWsId && mongoose.isObjectIdOrHexString(explicitWsId)
    ? { workspaceId: new mongoose.Types.ObjectId(explicitWsId), ownerId: req.user._id }
    : { ownerId: req.user._id };

  const activities = await ContactActivity.find(wsFilter)
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
  const headerWsId = req.headers?.['x-workspace-id'] || (typeof req.get === 'function' ? req.get('x-workspace-id') : null);
  const explicitWsId = req.workspace?._id || (headerWsId && mongoose.isObjectIdOrHexString(headerWsId) ? headerWsId : req.user.defaultWorkspaceId) || null;
  const wsFilter = explicitWsId && mongoose.isObjectIdOrHexString(explicitWsId)
    ? { workspaceId: new mongoose.Types.ObjectId(explicitWsId), ownerId }
    : { ownerId };
  // Business profile is a workspace-level record shared by every member.
  const profileFilter = wsFilter.workspaceId ? { workspaceId: wsFilter.workspaceId } : wsFilter;

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
    messageStatusGroups,
    autoReplyExecCount,
    ruleExecutionsRecent,
    workspaceDoc,
  ] = await Promise.all([
    getOwnerContactStats(ownerId, explicitWsId),
    Contact.countDocuments({ ...wsFilter, isDeleted: false, whatsappConsentStatus: 'Opted Out' }),
    Contact.countDocuments({ ...wsFilter, isDeleted: false, whatsappConsentStatus: { $in: ['Unknown', null] } }),
    Campaign.aggregate([
      { $match: wsFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    CampaignExecution.aggregate([
      { $match: { ...wsFilter } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Campaign.countDocuments({ ...wsFilter, 'mockSchedule.status': 'scheduled' }),
    Campaign.find(wsFilter)
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(5)
      .select('name status goal category audienceSelectionMode validationSummary mockSchedule createdAt updatedAt selectedTemplateId')
      .populate('selectedTemplateId', 'name')
      .lean(),
    Campaign.find({
      ...wsFilter,
      'mockSchedule.status': 'scheduled',
      'mockSchedule.startAt': { $gte: new Date() },
    })
      .sort({ 'mockSchedule.startAt': 1 })
      .limit(5)
      .select('name mockSchedule validationSummary selectedTemplateId createdAt')
      .populate('selectedTemplateId', 'name')
      .lean(),
    Conversation.aggregate([
      { $match: wsFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Conversation.aggregate([
      { $match: wsFilter },
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
    ConversationActivity.find({ ...wsFilter })
      .sort({ createdAt: -1 })
      .limit(8)
      .lean(),
    SecurityAuditLog.find({ ownerId })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
    BusinessProfile.findOne({ ...profileFilter }).lean(),
    UserPreferences.findOne({ ownerId }).lean(),
    MessageTemplate.countDocuments(
      explicitWsId && mongoose.isObjectIdOrHexString(explicitWsId)
        ? { workspaceId: explicitWsId, ownerId, localStatus: { $ne: 'Archived' } }
        : { ownerId, localStatus: { $ne: 'Archived' } }
    ),
    Campaign.countDocuments({ ...wsFilter, status: { $ne: 'Archived' } }),
    CampaignExecution.countDocuments({ ...wsFilter, status: 'failed' }),
    ImportJob.countDocuments({ ...wsFilter, failedCount: { $gt: 0 } }),
    Message.aggregate([
      { $match: { ...wsFilter } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    RuleExecution.countDocuments({ ...wsFilter }),
    RuleExecution.find({ ...wsFilter })
      .sort({ createdAt: -1 })
      .limit(8)
      .lean(),
    req.workspace
      ? Promise.resolve(req.workspace)
      : (explicitWsId && mongoose.isObjectIdOrHexString(explicitWsId)
          ? Workspace.findOne({
              _id: explicitWsId,
            }).lean()
          : (req.user.defaultWorkspaceId
              ? Workspace.findOne({
                  _id: req.user.defaultWorkspaceId,
                  $or: [{ ownerId }, { createdBy: ownerId }],
                }).lean()
              : Workspace.findOne({
                  $or: [{ ownerId }, { createdBy: ownerId }],
                }).sort({ createdAt: -1 }).lean())),
  ]);

  const campaignStatusMap = Object.fromEntries(campaignStatusGroups.map((x) => [x._id, x.count]));
  const campaignExecMap = Object.fromEntries(campaignExecutionGroups.map((x) => [x._id, x.count]));
  const convStatusMap = Object.fromEntries(conversationStatusGroups.map((x) => [x._id, x.count]));
  const msgStatusMap = Object.fromEntries(messageStatusGroups.map((x) => [x._id, x.count]));

  // Cumulative lifecycle semantics (matches reportService): a read message was also delivered and sent.
  const mockMessages = {
    total: messageStatusGroups.reduce((acc, curr) => acc + curr.count, 0),
    sent: (msgStatusMap.SIMULATED_SENT || 0) + (msgStatusMap.SIMULATED_DELIVERED || 0) + (msgStatusMap.SIMULATED_READ || 0),
    delivered: (msgStatusMap.SIMULATED_DELIVERED || 0) + (msgStatusMap.SIMULATED_READ || 0),
    read: msgStatusMap.SIMULATED_READ || 0,
    failed: (msgStatusMap.TEMPORARY_FAILURE || 0) + (msgStatusMap.PERMANENT_FAILURE || 0),
  };

  const industryKeyResolved = workspaceDoc?.industryKey || 'real_estate';
  const INDUSTRY_COPY = {
    real_estate: { enquiry: 'property enquiry', leads: 'property enquiry leads', templates: 'property brochure or enquiry templates', preview: 'property messages' },
    gym: { enquiry: 'membership and fitness enquiry', leads: 'membership and fitness enquiries', templates: 'membership or trial-class templates', preview: 'membership messages' },
    clinic: { enquiry: 'general service and appointment enquiry', leads: 'service and appointment enquiries', templates: 'service enquiry or appointment-reminder templates', preview: 'service messages' },
  };
  const copy = INDUSTRY_COPY[industryKeyResolved] || INDUSTRY_COPY.real_estate;
  const workerStatus = getWorkerStatus();

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
    ...ruleExecutionsRecent.map((x) => ({
      _id: x._id,
      module: 'Inbox',
      eventType: 'auto_reply_executed',
      title: `Auto-reply: ${x.matchedKeyword || x.ruleName || 'Rule'}`,
      description: `Rule "${x.ruleName || x.actionType}" (${x.status})`,
      timestamp: x.createdAt,
      source: 'Auto-Reply Engine',
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
      message: `Complete missing fields (${missingFields.join(', ')}) to finalize your ${copy.enquiry} branding.`,
      actionPath: '/settings?tab=business',
      actionLabel: 'Complete Profile',
    });
  }

  // Official Provider status alert
  alerts.push({
    id: 'alert_provider_disconnected',
    severity: 'info',
    module: 'Settings',
    title: 'Live WhatsApp not connected',
    message: 'Optional: Relay is running in Mock Mode, so no live WhatsApp messages are sent.',
    actionPath: '/settings?tab=channels',
    actionLabel: 'Integration settings',
    optional: true,
  });

  if (!workerStatus.running) {
    alerts.push({
      id: 'alert_worker_down',
      severity: 'error',
      module: 'Campaigns',
      title: 'Message worker is not running',
      message: 'Queued mock messages will not be processed until the backend worker restarts.',
      actionPath: '/campaigns',
      actionLabel: 'Review Campaigns',
    });
  }

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
      description: `Upload ${copy.leads} via Excel or CSV.`,
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
      description: `Draft personalized ${copy.templates}.`,
    },
    {
      id: 'campaign',
      label: 'Prepare Campaign',
      completed: totalCampaignCount > 0,
      path: '/campaigns/new',
      description: `Select audience and preview ${copy.preview}.`,
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
      businessName:
        workspaceDoc?.name ||
        businessProfile?.displayName ||
        businessProfile?.legalOrTradingName ||
        req.user.businessName ||
        'Relay Workspace',
      timezone: configuredTimezone,
      industry: workspaceDoc?.industryKey || 'real_estate',
      industryKey: workspaceDoc?.industryKey || 'real_estate',
      workspaceId: workspaceDoc?._id || null,
      slug: workspaceDoc?.slug || null,
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
    templates: {
      total: templateCount,
    },
    campaigns: {
      total: campaignStatusGroups.reduce((acc, curr) => acc + curr.count, 0),
      draft: campaignStatusMap.Draft || campaignStatusMap.draft || 0,
      readyForPreparation: campaignStatusMap['Validated for Preparation'] || 0,
      awaitingApproval: campaignStatusMap['Awaiting Template Approval'] || 0,
      needsReview: campaignStatusMap['Needs Review'] || 0,
      scheduled: scheduledCampaignsCount,
      running: campaignExecMap.running || 0,
      paused: campaignExecMap.paused || 0,
      completed: campaignExecMap.completed || 0,
      completedRuns: campaignExecMap.completed || 0, // execution (run) count, not campaign records
      totalRuns: campaignExecutionGroups.reduce((acc, curr) => acc + curr.count, 0),
      failed: campaignExecMap.failed || 0,
      archived: campaignStatusMap.Archived || 0,
      recent: normalizedRecentCampaigns,
    },
    upcomingCampaigns,
    inbox: {
      totalConversations: conversationStatusGroups.reduce((acc, curr) => acc + curr.count, 0),
      openConversations: convStatusMap.Open || 0,
      needsReview: (convStatusMap['Follow-up Required'] || 0) + (convStatusMap.Pending || 0),
      internalUnread: conversationUnreadAgg[0]?.total || 0,
      autoReplyExecutions: autoReplyExecCount,
      verifiedReplies: null, // STRICTLY null when provider is disconnected; NOT a misleading numeric 0
      verifiedRepliesAvailable: false,
      readinessNotice: 'Connect WhatsApp to see verified customer replies.',
    },
    mockMessages,
    autoReplyExecutions: autoReplyExecCount,

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
      backendHealth: 'CRM Online', // this response itself proves the API is serving
      databaseHealth: mongoose.connection.readyState === 1 ? 'MongoDB Connected' : 'Degraded',
      workerHealth: workerStatus.running ? 'Mock Engine Active' : 'Worker Not Running',
      workerRunning: workerStatus.running,
      workerLastHeartbeat: workerStatus.lastHeartbeat,
      mode: `Single-Owner ${(workspaceDoc?.industryKey || 'real_estate').replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())} Automation`,
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
