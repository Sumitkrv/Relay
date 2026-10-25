import mongoose from 'mongoose';
import Workspace, { VALID_INDUSTRIES, WORKSPACE_STATUSES } from '../models/Workspace.js';
import User from '../models/User.js';
import Subscription, { SUBSCRIPTION_INTERNAL_STATUSES } from '../models/Subscription.js';
import BillingPayment from '../models/BillingPayment.js';
import WhatsAppConnection from '../models/WhatsAppConnection.js';
import PlatformAuditLog from '../models/PlatformAuditLog.js';
import SupportCase, { SUPPORT_ISSUE_CATEGORIES, SUPPORT_PRIORITIES } from '../models/SupportCase.js';
import Message from '../models/Message.js';
import { getQueueHealth } from './messageQueueService.js';

/**
 * Mask email address for administrative privacy preservation:
 * admin@example.com -> a***n@example.com
 */
export function maskEmail(email) {
  if (!email || typeof email !== 'string') return '';
  const [local, domain] = email.split('@');
  if (!domain) return email;
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

/**
 * 1. Overview Metrics
 */
export async function getOverviewMetrics() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalWorkspaces,
    activeWorkspaces,
    suspendedWorkspaces,
    newWorkspacesThisMonth,
    onboardingIncomplete,
    activePaidSubscriptions,
    trialingWorkspaces,
    subscriptionsNeedingAttention,
    liveRevenueAgg,
    testRevenueAgg,
    mockConnections,
    liveConnections,
    industryCounts,
    recentAuditLogs,
    queueHealth,
  ] = await Promise.all([
    Workspace.countDocuments({ status: { $ne: 'ARCHIVED' } }),
    Workspace.countDocuments({ status: 'ACTIVE' }),
    Workspace.countDocuments({ status: 'SUSPENDED' }),
    Workspace.countDocuments({ createdAt: { $gte: startOfMonth }, status: { $ne: 'ARCHIVED' } }),
    Workspace.countDocuments({ onboardingStatus: { $ne: 'COMPLETED' }, status: { $ne: 'ARCHIVED' } }),
    Subscription.countDocuments({ internalStatus: 'ACTIVE' }),
    Subscription.countDocuments({ internalStatus: 'TRIALING' }),
    Subscription.countDocuments({
      internalStatus: { $in: ['PAST_DUE', 'PAYMENT_PENDING', 'HALTED', 'RECONCILIATION_REQUIRED'] },
    }),
    BillingPayment.aggregate([
      { $match: { billingEnvironment: 'LIVE', status: 'captured' } },
      { $group: { _id: null, totalMinor: { $sum: '$amountMinor' }, count: { $sum: 1 } } },
    ]),
    BillingPayment.aggregate([
      { $match: { billingEnvironment: 'TEST', status: 'captured' } },
      { $group: { _id: null, totalMinor: { $sum: '$amountMinor' }, count: { $sum: 1 } } },
    ]),
    WhatsAppConnection.countDocuments({ connectionType: 'MOCK_SIMULATED' }),
    WhatsAppConnection.countDocuments({ connectionMode: 'LIVE', status: 'LIVE_READY' }),
    Workspace.aggregate([
      { $match: { status: { $ne: 'ARCHIVED' } } },
      { $group: { _id: '$industryKey', count: { $sum: 1 } } },
    ]),
    PlatformAuditLog.find()
      .sort({ createdAt: -1 })
      .limit(6)
      .populate('adminUserId', 'name email')
      .lean(),
    getQueueHealth(),
  ]);

  const industryDistribution = industryCounts.map((i) => ({
    industry: i._id || 'other',
    count: i.count,
  }));

  const verifiedLiveRevenueMinor = liveRevenueAgg[0]?.totalMinor || 0;
  const verifiedTestRevenueMinor = testRevenueAgg[0]?.totalMinor || 0;

  return {
    workspaces: {
      total: totalWorkspaces,
      active: activeWorkspaces,
      suspended: suspendedWorkspaces,
      newThisMonth: newWorkspacesThisMonth,
      onboardingIncomplete,
    },
    subscriptions: {
      activePaid: activePaidSubscriptions,
      trialing: trialingWorkspaces,
      needingAttention: subscriptionsNeedingAttention,
    },
    revenue: {
      liveGrossMinor: verifiedLiveRevenueMinor,
      liveGrossFormatted: `₹${(verifiedLiveRevenueMinor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      testGrossMinor: verifiedTestRevenueMinor,
      testGrossFormatted: `₹${(verifiedTestRevenueMinor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      livePaymentsCount: liveRevenueAgg[0]?.count || 0,
      testPaymentsCount: testRevenueAgg[0]?.count || 0,
      disclaimer: 'Revenue reflects verified captured subscription payments only. Operational grants and test checkouts are strictly separated.',
    },
    whatsapp: {
      mockConnections,
      liveConnections,
      officialLiveSupported: false, // Meta Live sending strictly disabled in this phase
      readinessState: 'MOCK_SAFEGUARDS_ENFORCED',
    },
    queue: {
      queued: queueHealth?.queueStats?.queued || 0,
      processing: queueHealth?.queueStats?.processing || 0,
      failed: (queueHealth?.queueStats?.temporaryFailure || 0) + (queueHealth?.queueStats?.permanentFailure || 0),
      workerRunning: Boolean(queueHealth?.workerRunning),
      activeWorkers: queueHealth?.activeWorkers || 0,
      lastHeartbeat: queueHealth?.lastHeartbeat || null,
    },
    industryDistribution,
    recentAuditLogs: recentAuditLogs.map((log) => ({
      id: log._id,
      actionType: log.actionType,
      targetResourceType: log.targetResourceType,
      targetResourceId: log.targetResourceId,
      reason: log.reason,
      outcome: log.outcome,
      adminName: log.adminUserId?.name || 'Platform Admin',
      adminEmailMasked: maskEmail(log.adminUserId?.email),
      createdAt: log.createdAt,
    })),
  };
}

/**
 * 2. Businesses Directory with validated allowlists and pagination
 */
export async function getBusinesses({
  search = '',
  status = '',
  industry = '',
  subscriptionStatus = '',
  page = 1,
  limit = 15,
  sort = '-createdAt',
}) {
  const query = {};

  if (status && WORKSPACE_STATUSES.includes(status)) {
    query.status = status;
  } else {
    query.status = { $ne: 'ARCHIVED' };
  }

  if (industry && VALID_INDUSTRIES.includes(industry)) {
    query.industryKey = industry;
  }

  if (search && typeof search === 'string') {
    const cleanSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (cleanSearch) {
      query.$or = [
        { name: { $regex: cleanSearch, $options: 'i' } },
        { slug: { $regex: cleanSearch, $options: 'i' } },
        { businessEmail: { $regex: cleanSearch, $options: 'i' } },
      ];
    }
  }

  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 15));
  const skip = (safePage - 1) * safeLimit;

  // Sorting allowlist
  const allowedSortFields = {
    '-createdAt': { createdAt: -1 },
    'createdAt': { createdAt: 1 },
    'name': { name: 1 },
    '-name': { name: -1 },
    'status': { status: 1 },
  };
  const sortOption = allowedSortFields[sort] || { createdAt: -1 };

  const [total, workspaces] = await Promise.all([
    Workspace.countDocuments(query),
    Workspace.find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(safeLimit)
      .populate('createdBy', 'name email accountStatus')
      .lean(),
  ]);

  const workspaceIds = workspaces.map((w) => w._id);

  const [subscriptions, connections] = await Promise.all([
    Subscription.find({ workspaceId: { $in: workspaceIds } }).lean(),
    WhatsAppConnection.find({ workspaceId: { $in: workspaceIds } }).lean(),
  ]);

  const subMap = new Map();
  subscriptions.forEach((s) => subMap.set(s.workspaceId.toString(), s));

  const connMap = new Map();
  connections.forEach((c) => connMap.set(c.workspaceId.toString(), c));

  const records = workspaces.map((w) => {
    const sub = subMap.get(w._id.toString());
    const conn = connMap.get(w._id.toString());

    return {
      id: w._id,
      name: w.name,
      slug: w.slug,
      industryKey: w.industryKey,
      businessEmail: maskEmail(w.businessEmail),
      businessPhone: w.businessPhone ? `${w.businessPhone.slice(0, 4)}****${w.businessPhone.slice(-3)}` : '',
      status: w.status,
      onboardingStatus: w.onboardingStatus,
      createdAt: w.createdAt,
      suspendedAt: w.suspendedAt || null,
      suspendedReason: w.suspendedReason || null,
      owner: {
        id: w.createdBy?._id,
        name: w.createdBy?.name || 'Workspace Owner',
        emailMasked: maskEmail(w.createdBy?.email),
        accountStatus: w.createdBy?.accountStatus || 'ACTIVE',
      },
      subscription: {
        planKey: sub?.planKey || 'none',
        internalStatus: sub?.internalStatus || 'NO_SUBSCRIPTION',
        billingEnvironment: sub?.billingEnvironment || 'TEST',
        currentPeriodEnd: sub?.currentPeriodEnd || null,
        trialEndsAt: sub?.trialEndsAt || null,
      },
      whatsappConnection: {
        connectionType: conn?.connectionType || 'MOCK_SIMULATED',
        status: conn?.status || 'NOT_CONNECTED',
        billingStatus: conn?.billingStatus || 'UNVERIFIED',
      },
    };
  });

  // Filter in-memory if subscriptionStatus filter requested
  let filtered = records;
  if (subscriptionStatus && SUBSCRIPTION_INTERNAL_STATUSES.includes(subscriptionStatus)) {
    filtered = records.filter((r) => r.subscription.internalStatus === subscriptionStatus);
  }

  return {
    workspaces: filtered,
    pagination: {
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit) || 1,
    },
  };
}

/**
 * 3. Business Detail Profile
 */
export async function getBusinessDetail(workspaceId) {
  if (!mongoose.isObjectIdOrHexString(workspaceId)) {
    throw new Error('INVALID_WORKSPACE_ID');
  }

  const workspace = await Workspace.findById(workspaceId)
    .populate('createdBy', 'name email accountStatus isEmailVerified createdAt')
    .lean();

  if (!workspace) {
    throw new Error('WORKSPACE_NOT_FOUND');
  }

  const [subscription, connection, queueSummary, auditLogs, supportCasesCount] = await Promise.all([
    Subscription.findOne({ workspaceId: workspace._id }).lean(),
    WhatsAppConnection.findOne({ workspaceId: workspace._id }).lean(),
    Message.aggregate([
      { $match: { workspaceId: workspace._id } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    PlatformAuditLog.find({ targetResourceType: 'WORKSPACE', targetResourceId: workspace._id.toString() })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('adminUserId', 'name email')
      .lean(),
    SupportCase.countDocuments({ workspaceId: workspace._id }),
  ]);

  const queueStats = {
    total: 0,
    queued: 0,
    processing: 0,
    failed: 0,
    sent: 0,
  };

  queueSummary.forEach((item) => {
    queueStats.total += item.count;
    if (item._id === 'QUEUED') queueStats.queued = item.count;
    else if (item._id === 'PROCESSING') queueStats.processing = item.count;
    else if (['PERMANENT_FAILURE', 'TEMPORARY_FAILURE', 'FAILED'].includes(item._id)) queueStats.failed += item.count;
    else if (['SIMULATED_SENT', 'SIMULATED_DELIVERED', 'SIMULATED_READ', 'SENT', 'DELIVERED', 'READ'].includes(item._id)) queueStats.sent += item.count;
  });

  return {
    workspace: {
      id: workspace._id,
      name: workspace.name,
      slug: workspace.slug,
      industryKey: workspace.industryKey,
      businessEmail: maskEmail(workspace.businessEmail),
      country: workspace.country,
      city: workspace.city,
      timezone: workspace.timezone,
      currency: workspace.currency,
      status: workspace.status,
      onboardingStatus: workspace.onboardingStatus,
      createdAt: workspace.createdAt,
      suspendedAt: workspace.suspendedAt || null,
      suspendedReason: workspace.suspendedReason || null,
      reactivatedAt: workspace.reactivatedAt || null,
      reactivationReason: workspace.reactivationReason || null,
    },
    owner: {
      id: workspace.createdBy?._id,
      name: workspace.createdBy?.name || 'Owner',
      emailMasked: maskEmail(workspace.createdBy?.email),
      accountStatus: workspace.createdBy?.accountStatus || 'ACTIVE',
      isEmailVerified: Boolean(workspace.createdBy?.isEmailVerified),
      memberSince: workspace.createdBy?.createdAt,
    },
    subscription: subscription
      ? {
          planKey: subscription.planKey,
          internalStatus: subscription.internalStatus,
          provider: subscription.provider,
          billingEnvironment: subscription.billingEnvironment,
          amountMinor: subscription.amountMinor,
          currency: subscription.currency,
          startedAt: subscription.startedAt,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          trialStartedAt: subscription.trialStartedAt,
          trialEndsAt: subscription.trialEndsAt,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          lastPaidAt: subscription.lastPaidAt,
          lastReconciledAt: subscription.lastReconciledAt,
        }
      : null,
    whatsappConnection: connection
      ? {
          connectionType: connection.connectionType,
          connectionMode: connection.connectionMode,
          status: connection.status,
          billingStatus: connection.billingStatus,
          webhookStatus: connection.webhookStatus,
          phoneVerificationStatus: connection.phoneVerificationStatus,
          registrationStatus: connection.registrationStatus,
          lastHealthCheck: connection.lastHealthCheck || null,
          lastErrorCategory: connection.lastErrorCategory || null,
        }
      : null,
    queueStats,
    supportCasesCount,
    recentAuditLogs: auditLogs.map((log) => ({
      id: log._id,
      actionType: log.actionType,
      reason: log.reason,
      outcome: log.outcome,
      adminName: log.adminUserId?.name || 'Platform Admin',
      createdAt: log.createdAt,
    })),
  };
}

/**
 * 4. Workspace Suspension Operation
 */
export async function suspendWorkspace(workspaceId, { reason, adminUserId, platformRole, ipAddress = '', userAgent = '' }) {
  if (!mongoose.isObjectIdOrHexString(workspaceId)) {
    throw new Error('INVALID_WORKSPACE_ID');
  }

  if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
    throw new Error('SUSPENSION_REASON_REQUIRED');
  }

  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) {
    throw new Error('WORKSPACE_NOT_FOUND');
  }

  if (workspace.status === 'SUSPENDED') {
    return { workspace, message: 'Workspace is already suspended.' };
  }

  const previousStatus = workspace.status;
  workspace.status = 'SUSPENDED';
  workspace.suspendedAt = new Date();
  workspace.suspendedReason = reason.trim();
  workspace.suspendedBy = adminUserId;
  await workspace.save();

  await PlatformAuditLog.create({
    adminUserId,
    platformRole,
    actionType: 'workspace_suspended',
    targetResourceType: 'WORKSPACE',
    targetResourceId: workspace._id.toString(),
    reason: reason.trim(),
    outcome: 'SUCCESS',
    ipAddress,
    userAgent,
    metadata: {
      workspaceName: workspace.name,
      previousStatus,
      newStatus: 'SUSPENDED',
    },
  });

  return {
    workspace,
    message: 'Workspace suspended successfully. Background dispatch has been paused.',
  };
}

/**
 * 5. Workspace Reactivation Operation
 */
export async function reactivateWorkspace(workspaceId, { reason, adminUserId, platformRole, ipAddress = '', userAgent = '' }) {
  if (!mongoose.isObjectIdOrHexString(workspaceId)) {
    throw new Error('INVALID_WORKSPACE_ID');
  }

  if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
    throw new Error('REACTIVATION_REASON_REQUIRED');
  }

  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) {
    throw new Error('WORKSPACE_NOT_FOUND');
  }

  if (workspace.status === 'ACTIVE') {
    return { workspace, message: 'Workspace is already active.' };
  }

  const previousStatus = workspace.status;
  workspace.status = 'ACTIVE';
  workspace.reactivatedAt = new Date();
  workspace.reactivationReason = reason.trim();
  workspace.reactivatedBy = adminUserId;
  await workspace.save();

  await PlatformAuditLog.create({
    adminUserId,
    platformRole,
    actionType: 'workspace_reactivated',
    targetResourceType: 'WORKSPACE',
    targetResourceId: workspace._id.toString(),
    reason: reason.trim(),
    outcome: 'SUCCESS',
    ipAddress,
    userAgent,
    metadata: {
      workspaceName: workspace.name,
      previousStatus,
      newStatus: 'ACTIVE',
    },
  });

  return {
    workspace,
    message: 'Workspace reactivated successfully.',
  };
}

/**
 * 6. Subscription Monitoring List
 */
export async function getSubscriptionsList({
  page = 1,
  limit = 15,
  status = '',
  billingEnvironment = '',
}) {
  const query = {};

  if (status && SUBSCRIPTION_INTERNAL_STATUSES.includes(status)) {
    query.internalStatus = status;
  }

  if (billingEnvironment && ['LIVE', 'TEST'].includes(billingEnvironment)) {
    query.billingEnvironment = billingEnvironment;
  }

  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 15));
  const skip = (safePage - 1) * safeLimit;

  const [total, subscriptions, counts] = await Promise.all([
    Subscription.countDocuments(query),
    Subscription.find(query)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .populate('workspaceId', 'name slug status industryKey')
      .populate('ownerUserId', 'name email')
      .lean(),
    Subscription.aggregate([{ $group: { _id: '$internalStatus', count: { $sum: 1 } } }]),
  ]);

  const summaryCounts = {
    active: 0,
    trialing: 0,
    pastDue: 0,
    cancelled: 0,
    total: 0,
  };

  counts.forEach((c) => {
    summaryCounts.total += c.count;
    if (c._id === 'ACTIVE') summaryCounts.active = c.count;
    else if (c._id === 'TRIALING') summaryCounts.trialing = c.count;
    else if (['PAST_DUE', 'PAYMENT_PENDING', 'HALTED'].includes(c._id)) summaryCounts.pastDue += c.count;
    else if (c._id === 'CANCELLED') summaryCounts.cancelled = c.count;
  });

  const records = subscriptions.map((s) => ({
    id: s._id,
    workspace: {
      id: s.workspaceId?._id,
      name: s.workspaceId?.name || 'Unknown Workspace',
      slug: s.workspaceId?.slug || '',
      status: s.workspaceId?.status || 'UNKNOWN',
    },
    owner: {
      id: s.ownerUserId?._id,
      name: s.ownerUserId?.name || 'Owner',
      emailMasked: maskEmail(s.ownerUserId?.email),
    },
    planKey: s.planKey,
    billingEnvironment: s.billingEnvironment,
    provider: s.provider,
    providerSubscriptionId: s.providerSubscriptionId,
    internalStatus: s.internalStatus,
    amountMinor: s.amountMinor,
    currency: s.currency,
    trialEndsAt: s.trialEndsAt,
    currentPeriodEnd: s.currentPeriodEnd,
    lastPaidAt: s.lastPaidAt,
    lastReconciledAt: s.lastReconciledAt,
    cancellationReason: s.cancellationReason,
  }));

  return {
    subscriptions: records,
    summaryCounts,
    pagination: {
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit) || 1,
    },
  };
}

/**
 * 7. Verified Revenue Analytics
 */
export async function getRevenueAnalytics({ environment = 'LIVE', dateRange = 'all' }) {
  const env = environment === 'TEST' ? 'TEST' : 'LIVE';
  const query = { billingEnvironment: env };

  if (dateRange === 'today') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    query.paidAt = { $gte: today };
  } else if (dateRange === '7d') {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    query.paidAt = { $gte: d };
  } else if (dateRange === '30d') {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    query.paidAt = { $gte: d };
  } else if (dateRange === 'this_month') {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    query.paidAt = { $gte: d };
  }

  const [
    capturedAgg,
    refundedAgg,
    failedAgg,
    distinctWorkspaces,
    monthlyTrendAgg,
    recentPayments,
  ] = await Promise.all([
    BillingPayment.aggregate([
      { $match: { ...query, status: 'captured' } },
      { $group: { _id: null, grossPaise: { $sum: '$amountMinor' }, count: { $sum: 1 } } },
    ]),
    BillingPayment.aggregate([
      { $match: { ...query, status: 'refunded' } },
      { $group: { _id: null, refundedPaise: { $sum: '$amountMinor' }, count: { $sum: 1 } } },
    ]),
    BillingPayment.aggregate([
      { $match: { ...query, status: 'failed' } },
      { $group: { _id: null, count: { $sum: 1 } } },
    ]),
    BillingPayment.distinct('workspaceId', { ...query, status: 'captured' }),
    BillingPayment.aggregate([
      { $match: { ...query, status: 'captured' } },
      {
        $group: {
          _id: {
            year: { $year: '$paidAt' },
            month: { $month: '$paidAt' },
          },
          totalPaise: { $sum: '$amountMinor' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]),
    BillingPayment.find(query)
      .sort({ paidAt: -1 })
      .limit(15)
      .populate('workspaceId', 'name')
      .lean(),
  ]);

  const grossMinor = capturedAgg[0]?.grossPaise || 0;
  const refundsMinor = refundedAgg[0]?.refundedPaise || 0;
  const netMinor = Math.max(0, grossMinor - refundsMinor);
  const paidCount = capturedAgg[0]?.count || 0;
  const failedCount = failedAgg[0]?.count || 0;

  const monthlyTrend = monthlyTrendAgg.map((m) => ({
    month: `${m._id.year}-${String(m._id.month).padStart(2, '0')}`,
    amountPaise: m.totalPaise,
    amountFormatted: `₹${(m.totalPaise / 100).toLocaleString('en-IN')}`,
    count: m.count,
  }));

  const sanitizedPayments = recentPayments.map((p) => ({
    id: p._id,
    providerPaymentId: p.providerPaymentId,
    workspaceName: p.workspaceId?.name || 'Workspace',
    amountMinor: p.amountMinor,
    amountFormatted: `₹${(p.amountMinor / 100).toFixed(2)}`,
    currency: p.currency,
    status: p.status,
    method: p.paymentMethod || 'mandate',
    cardLast4: p.methodDetails?.last4 || '',
    paidAt: p.paidAt,
  }));

  return {
    environment: env,
    dateRange,
    grossCollectedMinor: grossMinor,
    grossFormatted: `₹${(grossMinor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    refundsMinor,
    refundsFormatted: `₹${(refundsMinor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    netCollectedMinor: netMinor,
    netFormatted: `₹${(netMinor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    paidPaymentCount: paidCount,
    failedPaymentCount: failedCount,
    distinctPayingWorkspaces: distinctWorkspaces.length,
    monthlyTrend,
    recentPayments: sanitizedPayments,
    disclaimer:
      env === 'TEST'
        ? 'TEST MODE: Payments are simulated or Razorpay sandbox checkouts. They do not constitute actual revenue.'
        : 'LIVE MODE: Genuine collected subscription revenue. Meta messaging fees and operational grants excluded.',
  };
}

/**
 * 8. WhatsApp Connections Monitoring List
 */
export async function getWhatsAppConnectionsList({ page = 1, limit = 15 }) {
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 15));
  const skip = (safePage - 1) * safeLimit;

  const [total, connections, statusCounts] = await Promise.all([
    WhatsAppConnection.countDocuments(),
    WhatsAppConnection.find()
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .populate('workspaceId', 'name slug status industryKey')
      .lean(),
    WhatsAppConnection.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);

  const summary = {
    mockReady: 0,
    disconnected: 0,
    billingUnverified: 0,
    total: 0,
  };

  statusCounts.forEach((s) => {
    summary.total += s.count;
    if (s._id === 'MOCK_SIMULATED_READY') summary.mockReady = s.count;
    else if (['NOT_CONNECTED', 'DISCONNECTED'].includes(s._id)) summary.disconnected = s.count;
    else if (s._id === 'BILLING_UNVERIFIED') summary.billingUnverified = s.count;
  });

  const records = connections.map((c) => ({
    id: c._id,
    workspace: {
      id: c.workspaceId?._id,
      name: c.workspaceId?.name || 'Unknown',
      slug: c.workspaceId?.slug || '',
      status: c.workspaceId?.status || 'UNKNOWN',
    },
    connectionType: c.connectionType,
    connectionMode: c.connectionMode,
    status: c.status,
    billingStatus: c.billingStatus,
    webhookStatus: c.webhookStatus,
    phoneVerificationStatus: c.phoneVerificationStatus,
    registrationStatus: c.registrationStatus,
    phoneNumberId: c.phoneNumberId ? `${c.phoneNumberId.slice(0, 4)}****` : null,
    displayPhoneNumber: c.displayPhoneNumber ? `${c.displayPhoneNumber.slice(0, 4)}****${c.displayPhoneNumber.slice(-3)}` : null,
    lastHealthCheck: c.lastHealthCheck || null,
    lastErrorCategory: c.lastErrorCategory || null,
  }));

  return {
    connections: records,
    summary,
    pagination: {
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit) || 1,
    },
  };
}

/**
 * 9. System & Worker Health
 */
export async function getSystemHealthOverview() {
  const queueHealth = await getQueueHealth();
  const dbState = mongoose.connection.readyState;
  const dbStatus = dbState === 1 ? 'CONNECTED' : dbState === 2 ? 'CONNECTING' : 'DISCONNECTED';

  const [totalWorkspaces, totalSubscriptions, totalPayments, auditEventsCount] = await Promise.all([
    Workspace.countDocuments(),
    Subscription.countDocuments(),
    BillingPayment.countDocuments(),
    PlatformAuditLog.countDocuments(),
  ]);

  return {
    database: {
      status: dbStatus,
      readyState: dbState,
      totalWorkspaces,
      totalSubscriptions,
      totalPayments,
      auditEventsCount,
    },
    queue: {
      ...queueHealth.queueStats,
      staleLeases: 0,
      oldestPendingJobAgeSec: 0,
    },
    worker: {
      activeWorkers: queueHealth.activeWorkers,
      workerRunning: queueHealth.workerRunning,
      lastHeartbeat: queueHealth.lastHeartbeat,
      providerMode: queueHealth.providerMode,
      recentErrors: queueHealth.recentErrors || [],
    },
    metaWhatsAppSafety: {
      liveSendingAllowed: false,
      reason: 'Platform security policy: Meta LIVE sending remains strictly disabled in this phase.',
      mockEngineActive: true,
    },
    timestamp: new Date(),
  };
}

/**
 * 10. Audit Logs List
 */
export async function getAuditLogsList({ page = 1, limit = 20, actionType = '', targetResourceType = '' }) {
  const query = {};
  if (actionType) query.actionType = actionType;
  if (targetResourceType) query.targetResourceType = targetResourceType;

  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (safePage - 1) * safeLimit;

  const [total, logs] = await Promise.all([
    PlatformAuditLog.countDocuments(query),
    PlatformAuditLog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .populate('adminUserId', 'name email')
      .lean(),
  ]);

  const records = logs.map((l) => ({
    id: l._id,
    adminName: l.adminUserId?.name || 'Platform Admin',
    adminEmailMasked: maskEmail(l.adminUserId?.email),
    platformRole: l.platformRole,
    actionType: l.actionType,
    targetResourceType: l.targetResourceType,
    targetResourceId: l.targetResourceId,
    reason: l.reason,
    outcome: l.outcome,
    correlationId: l.correlationId,
    ipAddress: l.ipAddress ? `${l.ipAddress.slice(0, 7)}***` : '',
    metadata: l.metadata,
    createdAt: l.createdAt,
  }));

  return {
    logs: records,
    pagination: {
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit) || 1,
    },
  };
}

/**
 * 11. Support Cases & Operations
 */
export async function getSupportCases({ page = 1, limit = 15, status = '', priority = '', workspaceId = '' }) {
  const query = {};
  if (status) query.status = status;
  if (priority) query.priority = priority;
  if (workspaceId && mongoose.isObjectIdOrHexString(workspaceId)) query.workspaceId = workspaceId;

  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 15));
  const skip = (safePage - 1) * safeLimit;

  const [total, cases] = await Promise.all([
    SupportCase.countDocuments(query),
    SupportCase.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .populate('workspaceId', 'name slug')
      .populate('createdByAdmin', 'name email')
      .lean(),
  ]);

  const records = cases.map((c) => ({
    id: c._id,
    caseNumber: c.caseNumber,
    workspace: {
      id: c.workspaceId?._id,
      name: c.workspaceId?.name || 'Workspace',
      slug: c.workspaceId?.slug || '',
    },
    createdByAdmin: {
      id: c.createdByAdmin?._id,
      name: c.createdByAdmin?.name || 'Admin',
    },
    issueCategory: c.issueCategory,
    priority: c.priority,
    status: c.status,
    summary: c.summary,
    notesCount: c.internalNotes?.length || 0,
    internalNotes: c.internalNotes || [],
    createdAt: c.createdAt,
    resolvedAt: c.resolvedAt,
  }));

  return {
    cases: records,
    pagination: {
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit) || 1,
    },
  };
}

export async function createSupportCase({
  workspaceId,
  adminUserId,
  adminName,
  issueCategory,
  priority = 'MEDIUM',
  summary,
  initialNote = '',
}) {
  if (!mongoose.isObjectIdOrHexString(workspaceId)) {
    throw new Error('INVALID_WORKSPACE_ID');
  }

  if (!SUPPORT_ISSUE_CATEGORIES.includes(issueCategory)) {
    throw new Error('INVALID_ISSUE_CATEGORY');
  }

  if (!summary || typeof summary !== 'string' || summary.trim().length < 5) {
    throw new Error('SUMMARY_TOO_SHORT');
  }

  const caseNumber = `CASE-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

  const internalNotes = [];
  if (initialNote && typeof initialNote === 'string' && initialNote.trim()) {
    internalNotes.push({
      noteId: `note_${Date.now()}`,
      adminUserId,
      adminName,
      text: initialNote.trim(),
      createdAt: new Date(),
    });
  }

  const supportCase = await SupportCase.create({
    caseNumber,
    workspaceId,
    createdByAdmin: adminUserId,
    issueCategory,
    priority: SUPPORT_PRIORITIES.includes(priority) ? priority : 'MEDIUM',
    status: 'OPEN',
    summary: summary.trim(),
    internalNotes,
  });

  return supportCase;
}
