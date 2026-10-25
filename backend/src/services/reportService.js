import mongoose from 'mongoose';
import ExcelJS from 'exceljs';
import Campaign from '../models/Campaign.js';
import CampaignExecution from '../models/CampaignExecution.js';
import CampaignMessageJob from '../models/CampaignMessageJob.js';
import CampaignAudience from '../models/CampaignAudience.js';
import Message from '../models/Message.js';
import Contact from '../models/Contact.js';
import ConsentRecord from '../models/ConsentRecord.js';
import Conversation from '../models/Conversation.js';
import RuleExecution from '../models/RuleExecution.js';
import AutoReplyRule from '../models/AutoReplyRule.js';
import ReportGeneration from '../models/ReportGeneration.js';
import UserPreferences from '../models/UserPreferences.js';
import { dateBounds } from './analyticsService.js';

const fail = (m, s = 400) => Object.assign(new Error(m), { status: s });
const oid = (id) => new mongoose.Types.ObjectId(id);

/**
 * Formula injection protection:
 * Cell strings starting with =, +, -, @, \t, or \r are escaped by prefixing with a single quote (').
 * Quoted and formatted safely for spreadsheets without altering valid phone numbers inappropriately.
 */
export function sanitizeSpreadsheetCell(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  
  let s = typeof value === 'object' ? JSON.stringify(value) : String(value);
  // If the string starts with =, +, -, @, or whitespace followed by formula triggers
  if (/^[\s]*[=+@\-\t\r]/.test(s)) {
    return `'${s}`;
  }
  return s;
}

/**
 * Resolves owner configured timezone or fallback to Asia/Kolkata
 */
export async function getOwnerTimezone(ownerId) {
  try {
    const prefs = await UserPreferences.findOne({ ownerId }).select('timezone').lean();
    if (prefs?.timezone) {
      new Intl.DateTimeFormat('en', { timeZone: prefs.timezone });
      return prefs.timezone;
    }
  } catch {
    // fallback
  }
  return 'Asia/Kolkata';
}

/**
 * 1. Overview Metrics
 * Aggregates 4 Primary KPIs, secondary operational metrics, and chart series.
 */
export async function getOverview(ownerId, query = {}) {
  const timeZone = query.timezone || await getOwnerTimezone(ownerId);
  const { start, end } = dateBounds({ ...query, timezone: timeZone });
  const owner = oid(ownerId);
  const scope = { ownerId: owner, ...(query.workspaceId ? { workspaceId: oid(query.workspaceId) } : {}) };

  // Execution mode filter (MOCK or ALL)
  const mode = (query.executionMode || 'ALL').toUpperCase();

  // Campaign Filter if provided
  const campaignMatch = { ...scope, isArchived: { $ne: true } };
  if (query.campaignId && mongoose.isObjectIdOrHexString(query.campaignId)) {
    campaignMatch._id = oid(query.campaignId);
  }
  if (query.status && query.status !== 'all') {
    campaignMatch.status = query.status;
  }

  // 1. Total Campaigns (authoritative counts matching Overview and Campaigns)
  const [
    totalCampaigns,
    scheduledCampaigns,
    runningCampaigns,
    draftCampaigns,
    readyCampaigns,
    allCampaigns
  ] = await Promise.all([
    Campaign.countDocuments({ ...scope, status: { $ne: 'Archived' } }),
    Campaign.countDocuments({
      ...scope,
      status: { $ne: 'Archived' },
      $or: [{ status: 'Scheduled' }, { 'mockSchedule.status': 'scheduled' }]
    }),
    Campaign.countDocuments({ ...scope, status: 'Running' }),
    Campaign.countDocuments({
      ...scope,
      status: 'Draft',
      'mockSchedule.status': { $ne: 'scheduled' }
    }),
    Campaign.countDocuments({
      ...scope,
      status: { $in: ['Validated for Preparation', 'Ready'] },
      'mockSchedule.status': { $ne: 'scheduled' }
    }),
    Campaign.find({ ...scope, status: { $ne: 'Archived' } }).select('status createdAt mockSchedule').lean()
  ]);

  const scheduledRunningCampaigns = scheduledCampaigns + runningCampaigns;

  // Campaign runs (CampaignExecution)
  const executionMatch = { ...scope, createdAt: { $gte: start, $lte: end } };
  if (campaignMatch._id) executionMatch.campaignId = campaignMatch._id;
  const [completedMockRuns, failedMockRuns, totalRuns] = await Promise.all([
    CampaignExecution.countDocuments({ ...executionMatch, status: 'completed' }),
    CampaignExecution.countDocuments({ ...executionMatch, status: 'failed' }),
    CampaignExecution.countDocuments(executionMatch)
  ]);

  // Message aggregations in date range
  const messageMatch = {
    ...scope,
    createdAt: { $gte: start, $lte: end }
  };
  if (campaignMatch._id) messageMatch.campaignId = campaignMatch._id;

  const [
    mockProcessedCount,
    mockFailureCount,
    messagesWithRetries,
    totalRetriesAgg,
    statusGrouped,
    dailyTrendAgg,
    failureCodesAgg
  ] = await Promise.all([
    // Processed mock messages: either terminal success or terminal failure
    Message.countDocuments({
      ...messageMatch,
      status: { $in: ['SIMULATED_SENT', 'SIMULATED_DELIVERED', 'SIMULATED_READ', 'TEMPORARY_FAILURE', 'PERMANENT_FAILURE'] }
    }),
    Message.countDocuments({
      ...messageMatch,
      status: { $in: ['TEMPORARY_FAILURE', 'PERMANENT_FAILURE'] }
    }),
    Message.countDocuments({
      ...messageMatch,
      attemptCount: { $gt: 1 }
    }),
    Message.aggregate([
      { $match: { ...messageMatch, attemptCount: { $gt: 1 } } },
      { $group: { _id: null, totalRetries: { $sum: { $subtract: ['$attemptCount', 1] } } } }
    ]),
    Message.aggregate([
      { $match: messageMatch },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    Message.aggregate([
      { $match: messageMatch },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: timeZone } },
          simulatedSent: {
            $sum: { $cond: [{ $in: ['$status', ['SIMULATED_SENT', 'SIMULATED_DELIVERED', 'SIMULATED_READ']] }, 1, 0] }
          },
          failed: {
            $sum: { $cond: [{ $in: ['$status', ['TEMPORARY_FAILURE', 'PERMANENT_FAILURE']] }, 1, 0] }
          },
          queued: {
            $sum: { $cond: [{ $in: ['$status', ['QUEUED', 'PROCESSING']] }, 1, 0] }
          },
          total: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]),
    Message.aggregate([
      {
        $match: {
          ...messageMatch,
          failureCode: { $exists: true, $ne: '' }
        }
      },
      { $group: { _id: '$failureCode', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 }
    ])
  ]);

  // Audience exclusions & eligible contacts across campaigns
  const audienceMatch = { ...scope };
  if (campaignMatch._id) audienceMatch.campaignId = campaignMatch._id;
  const [audienceEligibilityAgg, uniqueExcludedCount] = await Promise.all([
    CampaignAudience.aggregate([
      { $match: audienceMatch },
      {
        $group: {
          _id: '$eligibilityStatus',
          count: { $sum: 1 }
        }
      }
    ]),
    CampaignAudience.distinct('contactId', {
      ...audienceMatch,
      eligibilityStatus: { $ne: 'Eligible for Campaign Preparation' }
    })
  ]);

  const eligibilityMap = Object.fromEntries(audienceEligibilityAgg.map((x) => [x._id, x.count]));
  const totalAudienceSnapshots = audienceEligibilityAgg.reduce((acc, x) => acc + x.count, 0);
  const totalEligible = eligibilityMap['Eligible for Campaign Preparation'] || 0;
  const totalExcluded = totalAudienceSnapshots - totalEligible;

  const statusGroupedMap = Object.fromEntries(statusGrouped.map((x) => [x._id, x.count]));

  const mockMessageBreakdown = {
    intended: totalAudienceSnapshots,
    eligible: totalEligible,
    blocked: (statusGroupedMap.BLOCKED || 0) + totalExcluded,
    queued: statusGroupedMap.QUEUED || 0,
    processing: statusGroupedMap.PROCESSING || 0,
    completedMockAttempts: mockProcessedCount,
    simulatedSent: (statusGroupedMap.SIMULATED_SENT || 0) + (statusGroupedMap.SIMULATED_DELIVERED || 0) + (statusGroupedMap.SIMULATED_READ || 0),
    simulatedDelivered: (statusGroupedMap.SIMULATED_DELIVERED || 0) + (statusGroupedMap.SIMULATED_READ || 0),
    simulatedRead: statusGroupedMap.SIMULATED_READ || 0,
    failed: mockFailureCount,
    cancelled: statusGroupedMap.CANCELLED || 0,
    retried: messagesWithRetries
  };

  // Consent & opt-outs
  const [recordedOptOuts, unreadConversations] = await Promise.all([
    Contact.countDocuments({
      ...scope,
      $or: [{ whatsappConsentStatus: 'Opted Out' }, { isSuppressed: true }]
    }),
    Conversation.aggregate([
      { $match: { ...scope } },
      { $group: { _id: null, unread: { $sum: '$internalUnreadCount' } } }
    ])
  ]);

  // Campaign Status Distribution chart data: authoritative current states
  const statusCounts = {};
  for (const c of allCampaigns) {
    let displayStatus = c.status;
    if (c.mockSchedule?.status === 'scheduled') {
      displayStatus = 'Scheduled (Mock)';
    } else if (c.status === 'Validated for Preparation') {
      displayStatus = 'Ready for Preparation';
    }
    statusCounts[displayStatus] = (statusCounts[displayStatus] || 0) + 1;
  }
  const campaignStatusDistribution = Object.entries(statusCounts).map(([status, count]) => ({
    status,
    count
  }));

  // Daily Trend formatted
  const messageTrend = dailyTrendAgg.map((d) => ({
    date: d._id,
    simulatedSent: d.simulatedSent,
    failed: d.failed,
    queued: d.queued,
    total: d.total
  }));

  // Failure Breakdown formatted
  const failureBreakdown = failureCodesAgg.map((f) => ({
    reason: f._id || 'UNKNOWN_ERROR',
    count: f.count
  }));

  return {
    kpis: {
      totalCampaigns,
      scheduledRunningCampaigns,
      mockMessagesProcessed: mockProcessedCount,
      // CRITICAL: Verified WhatsApp Messages Sent must be null when provider is disconnected
      verifiedMessagesSent: null,
      measurementAvailability: {
        totalCampaigns: 'AVAILABLE',
        scheduledRunningCampaigns: 'AVAILABLE',
        mockMessagesProcessed: 'AVAILABLE',
        verifiedMessagesSent: 'UNAVAILABLE'
      }
    },
    secondaryMetrics: {
      draftCampaigns,
      readyCampaigns,
      scheduledCampaigns,
      runningCampaigns,
      completedMockRuns,
      failedMockRuns,
      totalRuns,
      excludedRecipients: uniqueExcludedCount.length || totalExcluded,
      retryAttempts: totalRetriesAgg[0]?.totalRetries || 0,
      messagesWithRetries,
      unreadConversations: unreadConversations[0]?.unread || 0,
      verifiedCustomerReplies: null, // Unavailable
      recordedOptOuts,
      mockMessageBreakdown
    },
    charts: {
      campaignStatusDistribution,
      messageTrend,
      failureBreakdown,
      audienceBreakdown: {
        totalAudienceSnapshots,
        eligible: totalEligible,
        excluded: totalExcluded
      }
    },
    meta: {
      period: {
        start,
        end,
        range: query.range || '30d'
      },
      timeZone,
      executionMode: mode,
      providerStatus: 'DISCONNECTED',
      providerReason: 'Official Meta WhatsApp Cloud API is disconnected. Outbound metrics reflect mock test execution only.',
      generatedAt: new Date().toISOString()
    },
    timeZone,
  };
}

/**
 * 2. Campaign Performance Table & List
 */
export async function getCampaignPerformance(ownerId, query = {}) {
  const timeZone = query.timezone || await getOwnerTimezone(ownerId);
  const { start, end } = dateBounds({ ...query, timezone: timeZone });
  const owner = oid(ownerId);
  const scope = { ownerId: owner, ...(query.workspaceId ? { workspaceId: oid(query.workspaceId) } : {}) };

  const filter = {
    ...scope,
    status: { $ne: 'Archived' }
  };

  // Date filtering can apply to campaign creation or scheduled date
  if (query.applyDateTo === 'schedule') {
    filter['mockSchedule.startAt'] = { $gte: start, $lte: end };
  } else if (query.start || query.end || query.range) {
    filter.createdAt = { $gte: start, $lte: end };
  }

  if (query.status && query.status !== 'all') {
    filter.status = query.status;
  }
  if (query.campaignId && mongoose.isObjectIdOrHexString(query.campaignId)) {
    filter._id = oid(query.campaignId);
  }
  if (query.search && typeof query.search === 'string') {
    const term = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { name: new RegExp(term, 'i') },
      { category: new RegExp(term, 'i') },
      { goal: new RegExp(term, 'i') }
    ];
  }

  const page = Math.max(1, Number.parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit) || 20));
  const skip = (page - 1) * limit;

  const [campaigns, total] = await Promise.all([
    Campaign.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('selectedTemplateId', 'name category status')
      .populate('activeExecutionId', 'status mode totalJobs startedAt completedAt summary')
      .lean(),
    Campaign.countDocuments(filter)
  ]);

  // For each campaign, enrich with live metrics
  const records = await Promise.all(
    campaigns.map(async (c) => {
      const [audienceStats, executions, messageStats] = await Promise.all([
        CampaignAudience.aggregate([
          { $match: { ...scope, campaignId: c._id } },
          {
            $group: {
              _id: '$eligibilityStatus',
              count: { $sum: 1 }
            }
          }
        ]),
        CampaignExecution.find({ ...scope, campaignId: c._id })
          .sort({ createdAt: -1 })
          .limit(5)
          .lean(),
        Message.aggregate([
          { $match: { ...scope, campaignId: c._id } },
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
              retries: {
                $sum: { $cond: [{ $gt: ['$attemptCount', 1] }, { $subtract: ['$attemptCount', 1] }, 0] }
              }
            }
          }
        ])
      ]);

      const eligibility = Object.fromEntries(audienceStats.map((x) => [x._id, x.count]));
      const totalAudience = audienceStats.reduce((acc, x) => acc + x.count, 0) || c.validationSummary?.counts?.total || 0;
      const eligible = eligibility['Eligible for Campaign Preparation'] || c.validationSummary?.counts?.eligible || 0;
      const excluded = Math.max(0, totalAudience - eligible);

      const msgMap = Object.fromEntries(messageStats.map((x) => [x._id, x.count]));
      const mockProcessed =
        (msgMap.SIMULATED_SENT || 0) +
        (msgMap.SIMULATED_DELIVERED || 0) +
        (msgMap.SIMULATED_READ || 0) +
        (msgMap.PERMANENT_FAILURE || 0);
      const mockFailures = (msgMap.PERMANENT_FAILURE || 0) + (msgMap.TEMPORARY_FAILURE || 0);
      const totalRetries = messageStats.reduce((acc, x) => acc + (x.retries || 0), 0);

      const latestExecution = executions[0] || null;
      let runDurationMs = null;
      if (latestExecution?.startedAt && latestExecution?.completedAt) {
        runDurationMs = new Date(latestExecution.completedAt).getTime() - new Date(latestExecution.startedAt).getTime();
      }

      return {
        _id: c._id,
        name: c.name,
        status: c.status,
        executionMode: c.executionMode || 'MOCK',
        category: c.category || 'General',
        templateName: c.selectedTemplateId?.name || c.templateSnapshot?.name || 'Standard Template',
        audienceSize: totalAudience,
        eligibleRecipients: eligible,
        excludedRecipients: excluded,
        mockMessagesProcessed: mockProcessed,
        simulatedFailures: mockFailures,
        retryAttempts: totalRetries,
        scheduledDate: c.mockSchedule?.startAt || null,
        actualRunDate: latestExecution?.startedAt || null,
        completedDate: latestExecution?.completedAt || null,
        runStatus: latestExecution?.status || 'none',
        runDurationMs,
        executionCount: executions.length,
        createdAt: c.createdAt
      };
    })
  );

  return {
    records,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    },
    meta: {
      timeZone,
      filtersApplied: {
        range: query.range || '30d',
        status: query.status || 'all',
        executionMode: query.executionMode || 'ALL'
      }
    }
  };
}

/**
 * 3. Campaign Comparison
 * Compares 2 to 4 campaigns side-by-side
 */
export async function compareCampaigns(ownerId, campaignIds = [], query = {}) {
  if (!Array.isArray(campaignIds) || campaignIds.length < 2 || campaignIds.length > 4) {
    throw fail('Select between 2 and 4 campaigns to compare.', 400);
  }

  for (const id of campaignIds) {
    if (!mongoose.isObjectIdOrHexString(id)) {
      throw fail(`Invalid campaign ID: ${id}`, 400);
    }
  }

  const owner = oid(ownerId);
  const scope = { ownerId: owner, ...(query.workspaceId ? { workspaceId: oid(query.workspaceId) } : {}) };
  const campaigns = await Campaign.find({
    ...scope,
    _id: { $in: campaignIds.map((id) => oid(id)) }
  })
    .populate('selectedTemplateId', 'name category')
    .lean();

  if (campaigns.length < 2) {
    throw fail('Could not find enough matching campaigns owned by you to compare.', 404);
  }

  const comparison = await Promise.all(
    campaigns.map(async (c) => {
      const [audienceStats, executions, messageStats, reasonsAgg] = await Promise.all([
        CampaignAudience.aggregate([
          { $match: { ...scope, campaignId: c._id } },
          { $group: { _id: '$eligibilityStatus', count: { $sum: 1 } } }
        ]),
        CampaignExecution.find({ ...scope, campaignId: c._id }).sort({ createdAt: -1 }).limit(1).lean(),
        Message.aggregate([
          { $match: { ...scope, campaignId: c._id } },
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
              retries: {
                $sum: { $cond: [{ $gt: ['$attemptCount', 1] }, { $subtract: ['$attemptCount', 1] }, 0] }
              }
            }
          }
        ]),
        CampaignAudience.aggregate([
          { $match: { ...scope, campaignId: c._id, exclusionReasons: { $exists: true, $ne: [] } } },
          { $unwind: '$exclusionReasons' },
          { $group: { _id: '$exclusionReasons', count: { $sum: 1 } } }
        ])
      ]);

      const eligibility = Object.fromEntries(audienceStats.map((x) => [x._id, x.count]));
      const totalAudience = audienceStats.reduce((acc, x) => acc + x.count, 0) || c.validationSummary?.counts?.total || 0;
      const eligible = eligibility['Eligible for Campaign Preparation'] || c.validationSummary?.counts?.eligible || 0;
      const excluded = Math.max(0, totalAudience - eligible);

      const msgMap = Object.fromEntries(messageStats.map((x) => [x._id, x.count]));
      const mockProcessed =
        (msgMap.SIMULATED_SENT || 0) +
        (msgMap.SIMULATED_DELIVERED || 0) +
        (msgMap.SIMULATED_READ || 0) +
        (msgMap.PERMANENT_FAILURE || 0);
      const mockFailures = (msgMap.PERMANENT_FAILURE || 0) + (msgMap.TEMPORARY_FAILURE || 0);
      const retries = messageStats.reduce((acc, x) => acc + (x.retries || 0), 0);

      const latestRun = executions[0] || null;
      let runDurationFormatted = '—';
      if (latestRun?.startedAt && latestRun?.completedAt) {
        const diffMs = new Date(latestRun.completedAt).getTime() - new Date(latestRun.startedAt).getTime();
        const seconds = Math.floor(diffMs / 1000);
        runDurationFormatted = seconds > 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`;
      }

      return {
        _id: c._id,
        name: c.name,
        status: c.status,
        executionMode: c.executionMode || 'MOCK',
        templateName: c.selectedTemplateId?.name || c.templateSnapshot?.name || 'Standard Template',
        audienceSize: totalAudience,
        eligibleContacts: eligible,
        excludedContacts: excluded,
        mockMessagesProcessed: mockProcessed,
        failureCount: mockFailures,
        retryAttempts: retries,
        runDurationFormatted,
        runStatus: latestRun?.status || 'Not Executed',
        startedAt: latestRun?.startedAt || null,
        completedAt: latestRun?.completedAt || null,
        exclusionReasonsBreakdown: Object.fromEntries(reasonsAgg.map((x) => [x._id, x.count]))
      };
    })
  );

  return {
    campaigns: comparison,
    count: comparison.length,
    modeDisclaimer: 'All execution comparisons currently reflect simulated mock engine performance. Verified WhatsApp Cloud API metrics will activate upon official integration.'
  };
}

/**
 * 4. Recipient-Level Campaign Reporting
 */
export async function getCampaignRecipients(ownerId, campaignId, query = {}) {
  if (!mongoose.isObjectIdOrHexString(campaignId)) throw fail('Invalid Campaign ID.', 400);
  const owner = oid(ownerId);
  const scope = { ownerId: owner, ...(query.workspaceId ? { workspaceId: oid(query.workspaceId) } : {}) };
  const cId = oid(campaignId);

  const campaign = await Campaign.findOne({ _id: cId, ...scope }).select('name audienceSnapshotVersion').lean();
  if (!campaign) throw fail('Campaign not found.', 404);

  const filter = {
    ...scope,
    campaignId: cId
  };

  if (query.eligibilityStatus && query.eligibilityStatus !== 'all') {
    filter.eligibilityStatus = query.eligibilityStatus;
  }

  const page = Math.max(1, Number.parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit) || 25));
  const skip = (page - 1) * limit;

  // Search by contact name/phone
  if (query.search && typeof query.search === 'string') {
    const rx = new RegExp(query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const matchedContacts = await Contact.find({
      ...scope,
      $or: [{ fullName: rx }, { phoneNumber: rx }, { companyName: rx }]
    }).select('_id').limit(5000).lean();
    filter.contactId = { $in: matchedContacts.map((c) => c._id) };
  }

  const [audienceRows, total] = await Promise.all([
    CampaignAudience.find(filter)
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .populate('contactId', 'fullName phoneNumber email whatsappConsentStatus isSuppressed')
      .lean(),
    CampaignAudience.countDocuments(filter)
  ]);

  // Fetch job/message status for these contacts
  const contactIds = audienceRows.map((r) => r.contactId?._id).filter(Boolean);
  const [jobs, messages] = await Promise.all([
    CampaignMessageJob.find({
      ...scope,
      campaignId: cId,
      contactId: { $in: contactIds }
    }).lean(),
    Message.find({
      ...scope,
      campaignId: cId,
      contactId: { $in: contactIds }
    }).select('contactId status attemptCount failureCode failureReason simulatedSentAt completedAt').lean()
  ]);

  const jobMap = new Map(jobs.map((j) => [String(j.contactId), j]));
  const msgMap = new Map(messages.map((m) => [String(m.contactId), m]));

  const records = audienceRows.map((r) => {
    const cidStr = String(r.contactId?._id || r.contactId);
    const job = jobMap.get(cidStr);
    const msg = msgMap.get(cidStr);

    return {
      contactId: r.contactId?._id || r.contactId,
      contactName: r.contactId?.fullName || 'Contact',
      contactPhone: r.contactId?.phoneNumber || '—',
      eligibilityStatus: r.eligibilityStatus,
      exclusionReasons: r.exclusionReasons || [],
      executionStatus: msg?.status || job?.status || (r.eligibilityStatus === 'Eligible for Campaign Preparation' ? 'QUEUED' : 'BLOCKED'),
      attemptCount: msg?.attemptCount || job?.attempts || 0,
      failureCode: msg?.failureCode || (r.exclusionReasons?.length ? r.exclusionReasons[0] : ''),
      failureReason: msg?.failureReason || job?.error || '',
      processedAt: msg?.completedAt || job?.processedAt || null,
      sourceClassification: 'MOCK'
    };
  });

  return {
    records,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    }
  };
}

/**
 * 5. Message Status Summary
 */
export async function getMessageStatusSummary(ownerId, query = {}) {
  const timeZone = query.timezone || await getOwnerTimezone(ownerId);
  const { start, end } = dateBounds({ ...query, timezone: timeZone });
  const owner = oid(ownerId);
  const scope = { ownerId: owner, ...(query.workspaceId ? { workspaceId: oid(query.workspaceId) } : {}) };

  const match = {
    ...scope,
    createdAt: { $gte: start, $lte: end }
  };
  if (query.campaignId && mongoose.isObjectIdOrHexString(query.campaignId)) {
    match.campaignId = oid(query.campaignId);
  }

  const grouped = await Message.aggregate([
    { $match: match },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);

  const map = Object.fromEntries(grouped.map((g) => [g._id, g.count]));

  return {
    internalPreparation: {
      DRAFT: map.DRAFT || 0,
      PENDING_VALIDATION: map.PENDING_VALIDATION || 0,
      BLOCKED: map.BLOCKED || 0,
      SCHEDULED: map.SCHEDULED || 0,
      QUEUED: map.QUEUED || 0,
      PROCESSING: map.PROCESSING || 0,
      CANCELLED: map.CANCELLED || 0
    },
    mockResults: {
      SIMULATED_SENT: map.SIMULATED_SENT || 0,
      SIMULATED_DELIVERED: map.SIMULATED_DELIVERED || 0,
      SIMULATED_READ: map.SIMULATED_READ || 0,
      TEMPORARY_FAILURE: map.TEMPORARY_FAILURE || 0,
      PERMANENT_FAILURE: map.PERMANENT_FAILURE || 0
    },
    metricsBreakdown: {
      intended: Object.values(map).reduce((a, b) => a + b, 0),
      eligible: (map.SCHEDULED || 0) + (map.QUEUED || 0) + (map.PROCESSING || 0) + (map.SIMULATED_SENT || 0) + (map.SIMULATED_DELIVERED || 0) + (map.SIMULATED_READ || 0) + (map.TEMPORARY_FAILURE || 0) + (map.PERMANENT_FAILURE || 0),
      blocked: map.BLOCKED || 0,
      queued: map.QUEUED || 0,
      processing: map.PROCESSING || 0,
      completedMockAttempts: (map.SIMULATED_SENT || 0) + (map.SIMULATED_DELIVERED || 0) + (map.SIMULATED_READ || 0) + (map.TEMPORARY_FAILURE || 0) + (map.PERMANENT_FAILURE || 0),
      simulatedSent: (map.SIMULATED_SENT || 0) + (map.SIMULATED_DELIVERED || 0) + (map.SIMULATED_READ || 0),
      simulatedDelivered: (map.SIMULATED_DELIVERED || 0) + (map.SIMULATED_READ || 0),
      simulatedRead: map.SIMULATED_READ || 0,
      failed: (map.TEMPORARY_FAILURE || 0) + (map.PERMANENT_FAILURE || 0),
      cancelled: map.CANCELLED || 0,
      retried: await Message.countDocuments({ ...match, attemptCount: { $gt: 1 } })
    },
    verifiedProvider: {
      ACCEPTED: { available: false, count: null },
      DELIVERED: { available: false, count: null },
      READ: { available: false, count: null },
      FAILED: { available: false, count: null },
      INCOMING_REPLY: { available: false, count: null }
    },
    meta: {
      timeZone,
      providerConnected: false,
      note: 'Verified WhatsApp message callbacks are offline until Meta WhatsApp Cloud API credentials are integrated in Prompt 10.'
    }
  };
}

/**
 * 6. Message Failure Analytics
 */
export async function getFailureAnalytics(ownerId, query = {}) {
  const timeZone = query.timezone || await getOwnerTimezone(ownerId);
  const { start, end } = dateBounds({ ...query, timezone: timeZone });
  const owner = oid(ownerId);
  const scope = { ownerId: owner, ...(query.workspaceId ? { workspaceId: oid(query.workspaceId) } : {}) };

  const match = {
    ...scope,
    createdAt: { $gte: start, $lte: end }
  };
  if (query.campaignId && mongoose.isObjectIdOrHexString(query.campaignId)) {
    match.campaignId = oid(query.campaignId);
  }

  // 1. Transport failures from Message
  const transportFailures = await Message.aggregate([
    {
      $match: {
        ...match,
        failureCode: { $exists: true, $ne: '' }
      }
    },
    {
      $group: {
        _id: '$failureCode',
        count: { $sum: 1 },
        totalAttempts: { $sum: '$attemptCount' },
        campaigns: { $addToSet: '$campaignId' },
        firstOccurred: { $min: '$createdAt' },
        lastOccurred: { $max: '$updatedAt' }
      }
    }
  ]);

  // 2. Audience eligibility exclusions from CampaignAudience
  const audienceExclusions = await CampaignAudience.aggregate([
    {
      $match: {
        ...scope,
        eligibilityStatus: { $ne: 'Eligible for Campaign Preparation' },
        createdAt: { $gte: start, $lte: end }
      }
    },
    { $unwind: '$exclusionReasons' },
    {
      $group: {
        _id: '$exclusionReasons',
        count: { $sum: 1 },
        campaigns: { $addToSet: '$campaignId' }
      }
    }
  ]);

  // Normalize and classify failures
  const explanationMap = {
    INVALID_PHONE: {
      category: 'Eligibility Exclusion',
      explanation: 'Phone number does not match E.164 format or is missing required country code.'
    },
    MISSING_CONSENT: {
      category: 'Eligibility Exclusion',
      explanation: 'No recorded opt-in consent exists for this contact in the workspace.'
    },
    CONTACT_OPTED_OUT: {
      category: 'Eligibility Exclusion',
      explanation: 'Contact has opted out of WhatsApp communications.'
    },
    DO_NOT_CONTACT: {
      category: 'Eligibility Exclusion',
      explanation: 'Contact is marked with suppression flag (Do Not Contact).'
    },
    UNRESOLVED_VARIABLE: {
      category: 'Preparation Failure',
      explanation: 'One or more required template personalization tags could not be resolved from contact fields.'
    },
    TEMPLATE_INVALID: {
      category: 'Preparation Failure',
      explanation: 'Template snapshot is incomplete or version is deprecated.'
    },
    MOCK_TIMEOUT: {
      category: 'Transport Attempt Failure',
      explanation: 'Simulated dispatch timed out during mock processing queue lease.'
    },
    MOCK_RATE_LIMIT: {
      category: 'Transport Attempt Failure',
      explanation: 'Simulated tier rate limit exceeded; message scheduled for backoff retry.'
    },
    MOCK_TEMPORARY_FAILURE: {
      category: 'Transport Attempt Failure',
      explanation: 'Temporary network glitch simulated in mock engine; retry attempted.'
    },
    MOCK_PERMANENT_FAILURE: {
      category: 'Transport Attempt Failure',
      explanation: 'Terminal failure simulated in mock mode; retry limit exhausted.'
    },
    QUEUE_UNAVAILABLE: {
      category: 'Transport Attempt Failure',
      explanation: 'Message job queue worker interrupted.'
    }
  };

  const results = [];

  for (const item of transportFailures) {
    const code = item._id || 'UNKNOWN_TRANSPORT_ERROR';
    const meta = explanationMap[code] || {
      category: 'Transport Attempt Failure',
      explanation: 'Mock message transport attempt encountered an unclassified error.'
    };
    results.push({
      failureCode: code,
      category: meta.category,
      affectedLogicalMessages: item.count,
      totalAttempts: item.totalAttempts || item.count,
      campaignsAffected: item.campaigns.length,
      actionableExplanation: meta.explanation,
      firstOccurrence: item.firstOccurred || null,
      lastOccurrence: item.lastOccurred || null
    });
  }

  for (const item of audienceExclusions) {
    const rawReason = item._id || 'General Exclusion';
    let code = 'MISSING_CONSENT';
    if (/phone/i.test(rawReason)) code = 'INVALID_PHONE';
    else if (/opt.*out/i.test(rawReason)) code = 'CONTACT_OPTED_OUT';
    else if (/suppress|do not contact/i.test(rawReason)) code = 'DO_NOT_CONTACT';
    else if (/variable|missing/i.test(rawReason)) code = 'UNRESOLVED_VARIABLE';

    const meta = explanationMap[code] || {
      category: 'Eligibility Exclusion',
      explanation: rawReason
    };

    results.push({
      failureCode: `AUDIENCE_${code}`,
      category: meta.category,
      affectedLogicalMessages: item.count,
      totalAttempts: item.count,
      campaignsAffected: item.campaigns.length,
      actionableExplanation: `${rawReason}: ${meta.explanation}`,
      firstOccurrence: null,
      lastOccurrence: null
    });
  }

  return {
    failures: results,
    totalFailureRecords: results.reduce((acc, r) => acc + r.affectedLogicalMessages, 0)
  };
}

/**
 * 7. Retry Analytics
 */
export async function getRetryAnalytics(ownerId, query = {}) {
  const timeZone = query.timezone || await getOwnerTimezone(ownerId);
  const { start, end } = dateBounds({ ...query, timezone: timeZone });
  const owner = oid(ownerId);
  const scope = { ownerId: owner, ...(query.workspaceId ? { workspaceId: oid(query.workspaceId) } : {}) };

  const match = {
    ...scope,
    createdAt: { $gte: start, $lte: end }
  };
  if (query.campaignId && mongoose.isObjectIdOrHexString(query.campaignId)) {
    match.campaignId = oid(query.campaignId);
  }

  const [
    messagesRequiringRetry,
    retryTotalAgg,
    retriesSucceeded,
    retriesExhausted,
    temporaryFailures,
    permanentFailures
  ] = await Promise.all([
    // Messages requiring at least 1 retry attempt
    Message.countDocuments({ ...match, attemptCount: { $gt: 1 } }),
    // Sum of retries (attemptCount - 1)
    Message.aggregate([
      { $match: { ...match, attemptCount: { $gt: 1 } } },
      { $group: { _id: null, total: { $sum: { $subtract: ['$attemptCount', 1] } } } }
    ]),
    // Retries that succeeded in mock mode
    Message.countDocuments({
      ...match,
      attemptCount: { $gt: 1 },
      status: { $in: ['SIMULATED_SENT', 'SIMULATED_DELIVERED', 'SIMULATED_READ'] }
    }),
    // Retries exhausted
    Message.countDocuments({
      ...match,
      status: 'PERMANENT_FAILURE',
      $expr: { $gte: ['$attemptCount', '$maxAttempts'] }
    }),
    Message.countDocuments({ ...match, status: 'TEMPORARY_FAILURE' }),
    Message.countDocuments({ ...match, status: 'PERMANENT_FAILURE' })
  ]);

  return {
    messagesRequiringRetry,
    totalRetryAttempts: retryTotalAgg[0]?.total || 0,
    retriesSucceededInMockMode: retriesSucceeded,
    retriesExhausted,
    temporaryFailures,
    permanentFailures,
    note: 'Unique recipient totals are never inflated by retries. Each retry is an attempt on a single persistent message identity.'
  };
}

/**
 * 8. Consent & Opt-Out Reporting
 */
export async function getConsentReporting(ownerId, query = {}) {
  const owner = oid(ownerId);
  const scope = { ownerId: owner, ...(query.workspaceId ? { workspaceId: oid(query.workspaceId) } : {}) };

  const [
    totalContacts,
    optedIn,
    unknown,
    optedOut,
    suppressed,
    consentExclusions
  ] = await Promise.all([
    Contact.countDocuments({ ...scope, isDeleted: false }),
    Contact.countDocuments({ ...scope, isDeleted: false, whatsappConsentStatus: 'Opted In' }),
    Contact.countDocuments({ ...scope, isDeleted: false, whatsappConsentStatus: 'Unknown' }),
    Contact.countDocuments({ ...scope, isDeleted: false, whatsappConsentStatus: 'Opted Out' }),
    Contact.countDocuments({ ...scope, isDeleted: false, isSuppressed: true }),
    CampaignAudience.distinct('contactId', {
      ...scope,
      eligibilityStatus: { $in: ['Missing Consent', 'Opted Out'] }
    })
  ]);

  return {
    totalContacts,
    validRecordedOptIn: optedIn,
    unknownConsent: unknown,
    contactsOptedOut: optedOut,
    suppressedDNC: suppressed,
    contactsExcludedDueToConsent: consentExclusions.length,
    historicalNote: 'Current-state consent figures reflect the authoritative database state. Historical reconstructions rely on immutable ConsentRecord events.'
  };
}

/**
 * 9. Opt-Out Events Table
 */
export async function getOptOutReporting(ownerId, query = {}) {
  const owner = oid(ownerId);
  const scope = { ownerId: owner, ...(query.workspaceId ? { workspaceId: oid(query.workspaceId) } : {}) };
  const page = Math.max(1, Number.parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit) || 25));
  const skip = (page - 1) * limit;

  // Contacts marked as opted out or suppressed
  const filter = {
    ...scope,
    isDeleted: false,
    $or: [{ whatsappConsentStatus: 'Opted Out' }, { isSuppressed: true }]
  };

  if (query.search && typeof query.search === 'string') {
    const rx = new RegExp(query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$and = [{ $or: [{ fullName: rx }, { phoneNumber: rx }] }];
  }

  const [contacts, total] = await Promise.all([
    Contact.find(filter)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('fullName phoneNumber whatsappConsentStatus isSuppressed suppressionReason suppressedAt updatedAt isDemo')
      .lean(),
    Contact.countDocuments(filter)
  ]);

  const records = contacts.map((c) => {
    let source = 'MANUAL_SUPPRESSION';
    if (c.isDemo) source = 'SYNTHETIC_TEST_OPTOUT';
    else if (c.whatsappConsentStatus === 'Opted Out') source = 'VERIFIED_CUSTOMER_OPTOUT';

    return {
      contactId: c._id,
      contactName: c.fullName,
      contactPhone: c.phoneNumber,
      consentStatus: c.whatsappConsentStatus,
      isSuppressed: c.isSuppressed,
      suppressionReason: c.suppressionReason || 'Customer requested opt-out',
      source,
      eventDate: c.suppressedAt || c.updatedAt
    };
  });

  return {
    records,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    }
  };
}

/**
 * 10. Audience Exclusions Breakdown
 */
export async function getAudienceExclusions(ownerId, query = {}) {
  const owner = oid(ownerId);
  const scope = { ownerId: owner, ...(query.workspaceId ? { workspaceId: oid(query.workspaceId) } : {}) };
  const match = {
    ...scope,
    eligibilityStatus: { $ne: 'Eligible for Campaign Preparation' }
  };
  if (query.campaignId && mongoose.isObjectIdOrHexString(query.campaignId)) {
    match.campaignId = oid(query.campaignId);
  }

  const [reasonsAgg, uniqueExcludedContacts] = await Promise.all([
    CampaignAudience.aggregate([
      { $match: match },
      { $unwind: '$exclusionReasons' },
      { $group: { _id: '$exclusionReasons', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),
    CampaignAudience.distinct('contactId', match)
  ]);

  const totalExclusionReasonsCount = reasonsAgg.reduce((acc, r) => acc + r.count, 0);

  return {
    uniqueExcludedContacts: uniqueExcludedContacts.length,
    totalExclusionReasons: totalExclusionReasonsCount,
    breakdown: reasonsAgg.map((r) => ({
      reason: r._id,
      count: r.count
    })),
    note: 'One excluded contact may have multiple reasons (e.g. Missing Consent + Invalid Phone). Therefore the sum of exclusion reasons may exceed the unique excluded contacts count.'
  };
}

/**
 * 11. Inbox & Auto-reply Analytics
 */
export async function getInboxAnalytics(ownerId, query = {}) {
  const owner = oid(ownerId);
  const scope = { ownerId: owner, ...(query.workspaceId ? { workspaceId: oid(query.workspaceId) } : {}) };

  const [conversationsAgg, unreadAgg, ruleExecutionsAgg] = await Promise.all([
    Conversation.aggregate([
      { $match: { ...scope } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    Conversation.aggregate([
      { $match: { ...scope } },
      { $group: { _id: null, unread: { $sum: '$internalUnreadCount' } } }
    ]),
    RuleExecution.aggregate([
      { $match: { ...scope } },
      {
        $group: {
          _id: {
            ruleName: '$ruleName',
            keyword: '$matchedKeyword',
            executionMode: '$executionMode',
            status: '$status'
          },
          count: { $sum: 1 },
          lastExecuted: { $max: '$createdAt' }
        }
      }
    ])
  ]);

  const convMap = Object.fromEntries(conversationsAgg.map((c) => [c._id, c.count]));

  const autoReplies = ruleExecutionsAgg.map((r) => ({
    ruleName: r._id.ruleName || 'Keyword Rule',
    keyword: r._id.keyword,
    executionMode: r._id.executionMode,
    status: r._id.status,
    count: r.count,
    lastExecuted: r.lastExecuted
  }));

  return {
    openConversations: convMap.Open || 0,
    needsAttention: convMap['Needs Attention'] || 0,
    internalUnread: unreadAgg[0]?.unread || 0,
    resolvedConversations: convMap.Resolved || 0,
    verifiedCustomerReplies: null, // Unavailable
    autoReplyRulesTriggered: autoReplies.reduce((acc, r) => acc + r.count, 0),
    autoReplies,
    note: 'Auto-reply executions differentiate between synthetic test runs and future verified customer events.'
  };
}

/**
 * 11b. Auto-Reply Analytics
 */
export async function getAutoReplyAnalytics(ownerId, query = {}) {
  const owner = oid(ownerId);
  const scope = { ownerId: owner, ...(query.workspaceId ? { workspaceId: oid(query.workspaceId) } : {}) };
  const timeZone = query.timezone || await getOwnerTimezone(ownerId);
  const { start, end } = dateBounds({ ...query, timezone: timeZone });

  const match = { ...scope };
  if (start && end) {
    match.createdAt = { $gte: start, $lte: end };
  }

  const [ruleExecutionsAgg, rulesList] = await Promise.all([
    RuleExecution.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            ruleName: '$ruleName',
            keyword: '$matchedKeyword',
            executionMode: '$executionMode',
            status: '$status'
          },
          count: { $sum: 1 },
          lastExecuted: { $max: '$createdAt' }
        }
      },
      { $sort: { count: -1 } }
    ]),
    AutoReplyRule.find({ ...scope, archivedAt: null })
      .select('name triggerKeyword enabled priority executionCount lastExecutedAt')
      .lean()
  ]);

  const executions = ruleExecutionsAgg.map((r) => ({
    ruleName: r._id.ruleName || 'Keyword Rule',
    keyword: r._id.keyword,
    executionMode: r._id.executionMode,
    status: r._id.status,
    count: r.count,
    lastExecuted: r.lastExecuted
  }));

  const totalExecutions = executions.reduce((acc, r) => acc + r.count, 0);
  const activeRulesCount = rulesList.filter((r) => r.enabled).length;

  return {
    totalExecutions,
    activeRulesCount,
    totalRules: rulesList.length,
    rules: rulesList,
    autoReplies: executions,
    executions,
    note: 'Auto-reply executions reflect mock and synthetic testing events with zero live Meta messaging claims.'
  };
}

/**
 * 12. Scheduling Analytics
 */

export async function getSchedulingAnalytics(ownerId, query = {}) {
  const owner = oid(ownerId);
  const scope = { ownerId: owner, ...(query.workspaceId ? { workspaceId: oid(query.workspaceId) } : {}) };

  const [scheduledCampaigns, completedRuns, scheduledRuns] = await Promise.all([
    Campaign.countDocuments({ ...scope, status: 'Scheduled' }),
    CampaignExecution.countDocuments({ ...scope, status: 'completed' }),
    CampaignExecution.find({ ...scope, trigger: 'scheduled' })
      .sort({ scheduledFor: -1 })
      .limit(20)
      .lean()
  ]);

  return {
    scheduledCampaigns,
    completedMockRuns: completedRuns,
    recentScheduledRuns: scheduledRuns.map((r) => ({
      _id: r._id,
      campaignId: r.campaignId,
      status: r.status,
      scheduledFor: r.scheduledFor,
      startedAt: r.startedAt,
      completedAt: r.completedAt
    }))
  };
}

/**
 * 13. Available Filter Options
 */
export async function getAvailableFilters(ownerId, query = {}) {
  const owner = oid(ownerId);
  const scope = { ownerId: owner, ...(query.workspaceId ? { workspaceId: oid(query.workspaceId) } : {}) };
  const campaigns = await Campaign.find({ ...scope, status: { $ne: 'Archived' } })
    .select('_id name category status')
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  return {
    campaigns: campaigns.map((c) => ({
      _id: c._id,
      name: c.name,
      status: c.status
    })),
    statuses: [
      'all',
      'Draft',
      'Needs Review',
      'Validated for Preparation',
      'Ready',
      'Scheduled',
      'Running',
      'Paused',
      'Completed',
      'Failed',
      'Cancelled'
    ],
    executionModes: ['ALL', 'MOCK', 'VERIFIED_PROVIDER'],
    dateRanges: [
      { label: 'Today', value: 'today' },
      { label: 'Last 7 Days', value: '7d' },
      { label: 'Last 30 Days', value: '30d' },
      { label: 'This Month', value: 'this_month' },
      { label: 'Last Month', value: 'previous_month' },
      { label: 'Custom Range', value: 'custom' }
    ]
  };
}

/**
 * 14. Secure Report Export (CSV / XLSX)
 * Enforces formula injection protection, field allowlists, owner scoping, and data minimization.
 */
export async function exportReportData(ownerId, options = {}) {
  const { reportType, format = 'csv', filters = {} } = options;
  const owner = oid(ownerId);
  const scope = { ownerId: owner, ...(filters.workspaceId ? { workspaceId: oid(filters.workspaceId) } : {}) };
  const timeZone = filters.timezone || await getOwnerTimezone(ownerId);

  let rows = [];
  let sheetTitle = 'Report';
  let fileBaseName = 'relay-report';

  if (reportType === 'campaign_summary') {
    const data = await getCampaignPerformance(ownerId, filters);
    sheetTitle = 'Campaign Performance';
    fileBaseName = 'campaign-performance-report';
    rows = data.records.map((r) => ({
      'Campaign Name': sanitizeSpreadsheetCell(r.name),
      'Status': sanitizeSpreadsheetCell(r.status),
      'Template': sanitizeSpreadsheetCell(r.templateName),
      'Execution Mode': sanitizeSpreadsheetCell(r.executionMode),
      'Category': sanitizeSpreadsheetCell(r.category),
      'Audience Size': r.audienceSize,
      'Eligible Recipients': r.eligibleRecipients,
      'Excluded Recipients': r.excludedRecipients,
      'Mock Messages Processed': r.mockMessagesProcessed,
      'Simulated Failures': r.simulatedFailures,
      'Retry Attempts': r.retryAttempts,
      'Scheduled Date': r.scheduledDate ? new Date(r.scheduledDate).toISOString() : '—',
      'Actual Run Date': r.actualRunDate ? new Date(r.actualRunDate).toISOString() : '—',
      'Created At': new Date(r.createdAt).toISOString()
    }));
  } else if (reportType === 'campaign_recipients') {
    if (!filters.campaignId) throw fail('Campaign ID is required for recipient export.', 400);
    const data = await getCampaignRecipients(ownerId, filters.campaignId, { limit: 5000, ...filters });
    sheetTitle = 'Campaign Recipients';
    fileBaseName = 'campaign-recipients-report';
    rows = data.records.map((r) => ({
      'Contact Name': sanitizeSpreadsheetCell(r.contactName),
      'Contact Phone': sanitizeSpreadsheetCell(r.contactPhone),
      'Eligibility Status': sanitizeSpreadsheetCell(r.eligibilityStatus),
      'Exclusion Reasons': sanitizeSpreadsheetCell((r.exclusionReasons || []).join('; ')),
      'Execution Status': sanitizeSpreadsheetCell(r.executionStatus),
      'Attempts': r.attemptCount,
      'Failure Code': sanitizeSpreadsheetCell(r.failureCode),
      'Failure Reason': sanitizeSpreadsheetCell(r.failureReason),
      'Source Classification': sanitizeSpreadsheetCell(r.sourceClassification),
      'Processed At': r.processedAt ? new Date(r.processedAt).toISOString() : '—'
    }));
  } else if (reportType === 'failure_analysis') {
    const data = await getFailureAnalytics(ownerId, filters);
    sheetTitle = 'Failure Breakdown';
    fileBaseName = 'failure-analytics-report';
    rows = data.failures.map((f) => ({
      'Failure Code': sanitizeSpreadsheetCell(f.failureCode),
      'Category': sanitizeSpreadsheetCell(f.category),
      'Affected Logical Messages': f.affectedLogicalMessages,
      'Total Attempts': f.totalAttempts,
      'Campaigns Affected': f.campaignsAffected,
      'Actionable Explanation': sanitizeSpreadsheetCell(f.actionableExplanation)
    }));
  } else if (reportType === 'consent_summary') {
    const data = await getConsentReporting(ownerId, filters);
    sheetTitle = 'Consent & Suppression';
    fileBaseName = 'consent-summary-report';
    rows = [
      { 'Metric': 'Total Contacts', 'Count': data.totalContacts },
      { 'Metric': 'Valid Recorded WhatsApp Opt-In', 'Count': data.validRecordedOptIn },
      { 'Metric': 'Unknown Consent', 'Count': data.unknownConsent },
      { 'Metric': 'Contacts Opted Out', 'Count': data.contactsOptedOut },
      { 'Metric': 'Suppressed (Do Not Contact)', 'Count': data.suppressedDNC },
      { 'Metric': 'Contacts Excluded Due To Consent', 'Count': data.contactsExcludedDueToConsent }
    ];
  } else if (reportType === 'opt_outs') {
    const data = await getOptOutReporting(ownerId, { limit: 5000, ...filters });
    sheetTitle = 'Opt-Outs & Suppression';
    fileBaseName = 'opt-outs-report';
    rows = data.records.map((r) => ({
      'Contact Name': sanitizeSpreadsheetCell(r.contactName),
      'Contact Phone': sanitizeSpreadsheetCell(r.contactPhone),
      'Consent Status': sanitizeSpreadsheetCell(r.consentStatus),
      'Suppression Reason': sanitizeSpreadsheetCell(r.suppressionReason),
      'Source Classification': sanitizeSpreadsheetCell(r.source),
      'Event Date': r.eventDate ? new Date(r.eventDate).toISOString() : '—'
    }));
  } else {
    // Default to campaign summary
    const data = await getCampaignPerformance(ownerId, filters);
    sheetTitle = 'Report Summary';
    fileBaseName = 'relay-export';
    rows = data.records.map((r) => ({
      'Campaign Name': sanitizeSpreadsheetCell(r.name),
      'Status': sanitizeSpreadsheetCell(r.status),
      'Audience Size': r.audienceSize,
      'Eligible': r.eligibleRecipients,
      'Excluded': r.excludedRecipients,
      'Mock Processed': r.mockMessagesProcessed,
      'Failures': r.simulatedFailures
    }));
  }

  const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
  const fullFileName = `${fileBaseName}-${timestampStr}.${format}`;

  let buffer;
  let mimeType;

  if (format === 'csv') {
    mimeType = 'text/csv; charset=utf-8';
    if (!rows.length) {
      buffer = Buffer.from('\uFEFFNo matching records found for active filters.\r\n', 'utf8');
    } else {
      const headers = Object.keys(rows[0]);
      const enc = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
      const csvLines = [
        headers.map(enc).join(','),
        ...rows.map((row) => headers.map((h) => enc(row[h])).join(','))
      ];
      buffer = Buffer.from('\uFEFF' + csvLines.join('\r\n'), 'utf8');
    }
  } else if (format === 'xlsx') {
    mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Relay — Real Estate WhatsApp Automation';
    workbook.created = new Date();

    // Summary Sheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.addRow(['Relay Real Estate Automation — Export Summary']);
    summarySheet.addRow(['Report Type', reportType]);
    summarySheet.addRow(['Generated At', new Date().toISOString()]);
    summarySheet.addRow(['Record Count', rows.length]);
    summarySheet.addRow(['Timezone', timeZone]);
    summarySheet.addRow(['Active Filters', JSON.stringify(filters)]);
    summarySheet.getRow(1).font = { bold: true, size: 14, color: { argb: 'FF2563EB' } };
    summarySheet.columns = [{ width: 20 }, { width: 45 }];

    // Details Sheet
    const detailsSheet = workbook.addWorksheet(sheetTitle);
    if (rows.length > 0) {
      const headers = Object.keys(rows[0]);
      detailsSheet.addRow(headers);
      detailsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      detailsSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111827' } };

      for (const row of rows) {
        detailsSheet.addRow(headers.map((h) => row[h]));
      }

      detailsSheet.columns = headers.map((h) => ({
        key: h,
        width: Math.min(40, Math.max(14, String(h).length + 4))
      }));
    } else {
      detailsSheet.addRow(['No matching records found for active filters.']);
    }

    buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  } else {
    throw fail('Unsupported export format. Choose csv or xlsx.', 400);
  }

  // Create audit record in ReportGeneration
  const generation = await ReportGeneration.create({
    ownerId,
    workspaceId: filters.workspaceId || undefined,
    name: fileBaseName,
    reportType,
    filters,
    format,
    status: 'Completed',
    rowCount: rows.length,
    fileName: fullFileName,
    mimeType,
    fileData: buffer,
    generatedBy: ownerId,
    startedAt: new Date(),
    completedAt: new Date()
  });

  return {
    buffer,
    mimeType,
    fileName: fullFileName,
    rowCount: rows.length,
    generationId: generation._id
  };
}

/**
 * 15. Message Log Activity
 */
export async function getMessages(ownerId, query = {}) {
  const timeZone = query.timezone || await getOwnerTimezone(ownerId);
  const { start, end } = dateBounds({ ...query, timezone: timeZone });
  const owner = oid(ownerId);
  const scope = { ownerId: owner, ...(query.workspaceId ? { workspaceId: oid(query.workspaceId) } : {}) };

  const match = {
    ...scope,
    createdAt: { $gte: start, $lte: end }
  };
  if (query.campaignId && mongoose.isObjectIdOrHexString(query.campaignId)) {
    match.campaignId = oid(query.campaignId);
  }
  if (query.status && query.status !== 'all') {
    match.status = query.status;
  }
  if (query.search && typeof query.search === 'string') {
    const term = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    match.$or = [
      { recipientName: new RegExp(term, 'i') },
      { recipientPhone: new RegExp(term, 'i') },
      { messageId: new RegExp(term, 'i') }
    ];
  }

  const page = Math.max(1, Number.parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit) || 25));
  const skip = (page - 1) * limit;

  const [records, total] = await Promise.all([
    Message.find(match)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('campaignId', 'name')
      .populate('templateId', 'name')
      .lean(),
    Message.countDocuments(match)
  ]);

  return {
    records: records.map((m) => ({
      _id: m._id,
      messageId: m.messageId,
      recipientName: m.recipientName || 'Contact',
      recipientPhone: m.recipientPhone,
      campaignName: m.campaignId?.name || '—',
      templateName: m.templateId?.name || '—',
      status: m.status,
      attemptCount: m.attemptCount,
      failureCode: m.failureCode,
      failureReason: m.failureReason,
      simulatedSentAt: m.simulatedSentAt,
      completedAt: m.completedAt,
      createdAt: m.createdAt
    })),
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    }
  };
}

