/**
 * Platform Super Admin Controller
 * Computes platform-wide aggregates from actual MongoDB records and provides privileged operational controls.
 * Strictly adheres to multi-tenant isolation: sensitive CRM contents (contacts, messages, clinical notes)
 * are NEVER exposed via platform admin APIs.
 */

import mongoose from 'mongoose';
import User from '../models/User.js';
import Workspace from '../models/Workspace.js';
import WorkspaceMembership from '../models/WorkspaceMembership.js';
import WorkspaceSubscription from '../models/WorkspaceSubscription.js';
import Campaign from '../models/Campaign.js';
import Contact from '../models/Contact.js';
import Message from '../models/Message.js';
import Agency from '../models/Agency.js';
import AgencyClientRelation from '../models/AgencyClientRelation.js';
import BusinessProfile from '../models/BusinessProfile.js';
import SecurityAuditLog from '../models/SecurityAuditLog.js';
import SupportCase from '../models/SupportCase.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getOverview = asyncHandler(async (req, res) => {
  const [
    totalUsers,
    totalWorkspaces,
    activeWorkspaces,
    suspendedWorkspaces,
    totalAgencies,
    totalContacts,
    totalCampaigns,
    totalMessages,
    subscriptions,
    supportCasesCount,
    recentAuditLogs,
    allWorkspaces,
  ] = await Promise.all([
    User.countDocuments(),
    Workspace.countDocuments(),
    Workspace.countDocuments({ status: 'ACTIVE' }),
    Workspace.countDocuments({ status: 'SUSPENDED' }),
    Agency.countDocuments(),
    Contact.countDocuments({ isDeleted: false }),
    Campaign.countDocuments(),
    Message.countDocuments(),
    WorkspaceSubscription.find(),
    SupportCase.countDocuments({ status: { $in: ['OPEN', 'IN_PROGRESS'] } }),
    SecurityAuditLog.find()
      .populate('actorId', 'name email')
      .sort({ createdAt: -1 })
      .limit(8),
    Workspace.find({}, 'createdAt industryKey status').sort({ createdAt: 1 }),
  ]);

  // Compute mock MRR from active subscriptions
  let mockMrr = 0;
  let activeSubCount = 0;
  let trialingSubCount = 0;
  let canceledSubCount = 0;

  subscriptions.forEach((sub) => {
    if (sub.status === 'ACTIVE') {
      mockMrr += sub.amount || 0;
      activeSubCount++;
    } else if (sub.status === 'TRIALING') {
      trialingSubCount++;
    } else if (sub.status === 'CANCELED' || sub.status === 'CANCELLED') {
      canceledSubCount++;
    }
  });

  // Calculate real workspace growth by month
  const monthlyGrowthMap = new Map();
  allWorkspaces.forEach((w) => {
    if (w.createdAt) {
      const d = new Date(w.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyGrowthMap.set(key, (monthlyGrowthMap.get(key) || 0) + 1);
    }
  });

  const growthTrends = Array.from(monthlyGrowthMap.entries()).map(([month, count]) => ({
    month,
    workspaces: count,
  }));

  // Identify workspaces needing attention
  const workspacesNeedingAttention = suspendedWorkspaces;

  res.json({
    success: true,
    metrics: {
      totalUsers,
      totalWorkspaces,
      activeWorkspaces,
      suspendedWorkspaces,
      totalAgencies,
      totalContacts,
      totalCampaigns,
      totalMessages,
      activeSubscriptions: activeSubCount,
      trialingSubscriptions: trialingSubCount,
      canceledSubscriptions: canceledSubCount,
      openSupportCases: supportCasesCount,
      workspacesNeedingAttention,
      // Explicit honest financial terminology:
      mockMonthlyRecurringRevenue: mockMrr,
      simulatedRevenue: mockMrr,
      liveRevenue: 0,
      liveRevenueUnavailableReason: 'Offline Mock Billing Mode — Real payment gateway (Razorpay) disconnected',
      billingMode: 'OFFLINE_MOCK',
    },
    growthTrends,
    recentActivity: recentAuditLogs.map((log) => ({
      _id: log._id,
      action: log.action,
      actor: log.actorId ? { name: log.actorId.name, email: log.actorId.email } : { email: 'system' },
      metadata: log.metadata,
      createdAt: log.createdAt,
    })),
    systemHealth: {
      status: 'HEALTHY',
      database: mongoose.connection.readyState === 1 ? 'CONNECTED' : 'DISCONNECTED',
      databaseName: mongoose.connection.name || 'relay_demo',
      messageWorker: 'RUNNING',
      mockWhatsAppEngine: 'ACTIVE',
      metaWhatsAppProvider: 'DISCONNECTED',
      billingAdapter: 'MOCK_OFFLINE_READY',
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
      uptimeSeconds: Math.floor(process.uptime()),
    },
  });
});

export const getWorkspaces = asyncHandler(async (req, res) => {
  const { search, status, industryKey, subscriptionStatus } = req.query;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const filter = {};
  if (status) filter.status = status;
  if (industryKey) filter.industryKey = industryKey;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { slug: { $regex: search, $options: 'i' } },
      { businessEmail: { $regex: search, $options: 'i' } },
      { industryKey: { $regex: search, $options: 'i' } },
    ];
  }

  const [total, workspaces] = await Promise.all([
    Workspace.countDocuments(filter),
    Workspace.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
  ]);

  // Augment with subscriptions and owners
  const workspaceIds = workspaces.map((w) => w._id);
  const [subscriptions, memberships, agenciesRelations] = await Promise.all([
    WorkspaceSubscription.find({ workspaceId: { $in: workspaceIds } }),
    WorkspaceMembership.find({ workspaceId: { $in: workspaceIds }, role: 'OWNER' }).populate('userId', 'name email accountStatus'),
    AgencyClientRelation.find({ clientWorkspaceId: { $in: workspaceIds }, status: 'ACTIVE' }).populate('agencyId', 'name slug branding.companyName'),
  ]);

  const subMap = new Map(subscriptions.map((s) => [s.workspaceId.toString(), s]));
  const ownerMap = new Map(memberships.map((m) => [m.workspaceId.toString(), m.userId]));
  const agencyMap = new Map(agenciesRelations.map((r) => [r.clientWorkspaceId.toString(), r.agencyId]));

  const enriched = workspaces.map((w) => {
    const sub = subMap.get(w._id.toString());
    const owner = ownerMap.get(w._id.toString());
    const agency = agencyMap.get(w._id.toString());
    return {
      _id: w._id,
      name: w.name,
      slug: w.slug,
      industryKey: w.industryKey,
      status: w.status,
      onboardingStatus: w.onboardingStatus || 'COMPLETED',
      businessEmail: w.businessEmail,
      businessPhone: w.businessPhone,
      city: w.city,
      country: w.country,
      createdAt: w.createdAt,
      whatsappStatus: w.settings?.whatsappConnection?.status || 'MOCK_READY',
      owner: owner ? { _id: owner._id, name: owner.name, email: owner.email, accountStatus: owner.accountStatus } : null,
      agency: agency ? { _id: agency._id, name: agency.name, slug: agency.slug } : null,
      subscription: sub
        ? {
            status: sub.status,
            planId: sub.planId,
            planName: sub.planName || 'Solo Growth Plan',
            amount: sub.amount || 799,
            trialEndsAt: sub.trialEndsAt,
            currentPeriodEndsAt: sub.currentPeriodEndsAt,
          }
        : null,
    };
  });

  // Client-requested subscriptionStatus filter in memory if specified
  const filteredResult = subscriptionStatus
    ? enriched.filter((w) => w.subscription?.status === subscriptionStatus)
    : enriched;

  res.json({
    success: true,
    total: subscriptionStatus ? filteredResult.length : total,
    page,
    limit,
    totalPages: Math.ceil((subscriptionStatus ? filteredResult.length : total) / limit) || 1,
    workspaces: filteredResult,
  });
});

export const getWorkspaceDetails = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const workspace = await Workspace.findById(id);
  if (!workspace) {
    return res.status(404).json({ message: 'Workspace not found.' });
  }

  const [subscription, memberships, profile, agencyRelation, auditLogs] = await Promise.all([
    WorkspaceSubscription.findOne({ workspaceId: workspace._id }),
    WorkspaceMembership.find({ workspaceId: workspace._id }).populate('userId', 'name email role accountStatus isEmailVerified createdAt'),
    BusinessProfile.findOne({ workspaceId: workspace._id }),
    AgencyClientRelation.findOne({ clientWorkspaceId: workspace._id, status: 'ACTIVE' }).populate('agencyId', 'name slug branding'),
    SecurityAuditLog.find({ 'metadata.targetWorkspaceId': workspace._id }).populate('actorId', 'name email').sort({ createdAt: -1 }).limit(10),
  ]);

  // Zero-CRM content leakage: only return administrative and operational metadata
  res.json({
    success: true,
    workspace: {
      _id: workspace._id,
      name: workspace.name,
      slug: workspace.slug,
      industryKey: workspace.industryKey,
      status: workspace.status,
      onboardingStatus: workspace.onboardingStatus,
      businessEmail: workspace.businessEmail,
      businessPhone: workspace.businessPhone,
      city: workspace.city,
      country: workspace.country,
      timezone: workspace.timezone,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
      settings: {
        whatsappConnection: workspace.settings?.whatsappConnection,
      },
    },
    businessProfile: profile ? {
      displayName: profile.displayName,
      legalOrTradingName: profile.legalOrTradingName,
      businessCategory: profile.businessCategory,
      email: profile.email,
      phone: profile.phone,
      city: profile.city,
      country: profile.country,
      timezone: profile.timezone,
    } : null,
    subscription: subscription ? {
      _id: subscription._id,
      status: subscription.status,
      planId: subscription.planId,
      planName: subscription.planName,
      amount: subscription.amount,
      billingCycle: subscription.billingCycle || 'monthly',
      trialEndsAt: subscription.trialEndsAt,
      currentPeriodStartsAt: subscription.currentPeriodStartsAt,
      currentPeriodEndsAt: subscription.currentPeriodEndsAt,
      isMock: true,
    } : null,
    memberships: memberships.map((m) => ({
      _id: m._id,
      role: m.role,
      status: m.status,
      user: m.userId ? {
        _id: m.userId._id,
        name: m.userId.name,
        email: m.userId.email,
        accountStatus: m.userId.accountStatus,
        isEmailVerified: m.userId.isEmailVerified,
      } : null,
    })),
    agency: agencyRelation ? {
      _id: agencyRelation.agencyId._id,
      name: agencyRelation.agencyId.name,
      slug: agencyRelation.agencyId.slug,
      branding: agencyRelation.agencyId.branding,
      delegatedPermissions: agencyRelation.delegatedPermissions,
    } : null,
    recentAuditLogs: auditLogs.map((log) => ({
      _id: log._id,
      action: log.action,
      actor: log.actorId ? { name: log.actorId.name, email: log.actorId.email } : { email: 'system' },
      createdAt: log.createdAt,
    })),
  });
});

export const suspendWorkspace = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const workspace = await Workspace.findById(id);
  if (!workspace) {
    return res.status(404).json({ message: 'Workspace not found.' });
  }

  workspace.status = 'SUSPENDED';
  await workspace.save();

  await SecurityAuditLog.create({
    ownerId: req.user._id,
    actorId: req.user._id,
    action: 'workspace_suspended_by_admin',
    metadata: { targetWorkspaceId: workspace._id, targetWorkspaceName: workspace.name },
  }).catch(() => {});

  res.json({ success: true, workspace });
});

export const reactivateWorkspace = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const workspace = await Workspace.findById(id);
  if (!workspace) {
    return res.status(404).json({ message: 'Workspace not found.' });
  }

  workspace.status = 'ACTIVE';
  await workspace.save();

  await SecurityAuditLog.create({
    ownerId: req.user._id,
    actorId: req.user._id,
    action: 'workspace_reactivated_by_admin',
    metadata: { targetWorkspaceId: workspace._id, targetWorkspaceName: workspace.name },
  }).catch(() => {});

  res.json({ success: true, workspace });
});

export const getUsers = asyncHandler(async (req, res) => {
  const { search, role, status } = req.query;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const filter = {};
  if (role) filter.role = role;
  if (status) filter.accountStatus = status;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }

  const [total, users] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter, '-passwordHash -resetPasswordToken -emailVerificationToken')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
  ]);

  // Augment with user memberships
  const userIds = users.map((u) => u._id);
  const memberships = await WorkspaceMembership.find({ userId: { $in: userIds } })
    .populate('workspaceId', 'name slug industryKey status');

  const membershipMap = new Map();
  memberships.forEach((m) => {
    const uid = m.userId.toString();
    if (!membershipMap.has(uid)) membershipMap.set(uid, []);
    membershipMap.get(uid).push({
      workspaceId: m.workspaceId?._id,
      workspaceName: m.workspaceId?.name || 'Unknown',
      workspaceSlug: m.workspaceId?.slug,
      industryKey: m.workspaceId?.industryKey,
      role: m.role,
      status: m.status,
    });
  });

  const enrichedUsers = users.map((u) => ({
    _id: u._id,
    name: u.name,
    email: u.email,
    role: u.role,
    isPlatformAdmin: Boolean(u.isPlatformAdmin),
    accountStatus: u.accountStatus,
    isEmailVerified: Boolean(u.isEmailVerified),
    createdAt: u.createdAt,
    workspaces: membershipMap.get(u._id.toString()) || [],
  }));

  res.json({
    success: true,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
    users: enrichedUsers,
  });
});

export const getAgencies = asyncHandler(async (req, res) => {
  const agencies = await Agency.find().populate('ownerId', 'name email accountStatus').sort({ createdAt: -1 });

  const agencyIds = agencies.map((a) => a._id);
  const relations = await AgencyClientRelation.find({ agencyId: { $in: agencyIds }, status: 'ACTIVE' });

  const relationCounts = new Map();
  relations.forEach((r) => {
    const aid = r.agencyId.toString();
    relationCounts.set(aid, (relationCounts.get(aid) || 0) + 1);
  });

  const enriched = agencies.map((a) => ({
    _id: a._id,
    name: a.name,
    slug: a.slug,
    owner: a.ownerId ? { _id: a.ownerId._id, name: a.ownerId.name, email: a.ownerId.email } : null,
    branding: a.branding,
    status: a.status,
    createdAt: a.createdAt,
    clientCount: relationCounts.get(a._id.toString()) || 0,
  }));

  res.json({ success: true, total: enriched.length, agencies: enriched });
});

export const getSubscriptions = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const filter = {};
  if (status) filter.status = status;

  const subscriptions = await WorkspaceSubscription.find(filter)
    .populate('workspaceId', 'name slug industryKey status businessEmail')
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    total: subscriptions.length,
    subscriptions: subscriptions.map((s) => ({
      _id: s._id,
      workspaceId: s.workspaceId,
      planId: s.planId,
      planName: s.planName || 'Solo Growth Plan',
      amount: s.amount || 799,
      status: s.status,
      trialEndsAt: s.trialEndsAt,
      currentPeriodStartsAt: s.currentPeriodStartsAt,
      currentPeriodEndsAt: s.currentPeriodEndsAt,
      isMock: true,
      billingMode: 'Offline Mock Billing',
    })),
  });
});

export const getSupportCases = asyncHandler(async (req, res) => {
  const cases = await SupportCase.find()
    .populate('userId', 'name email')
    .populate('workspaceId', 'name slug industryKey')
    .sort({ createdAt: -1 });

  res.json({ success: true, cases });
});

export const createSupportCase = asyncHandler(async (req, res) => {
  const { subject, description, priority = 'MEDIUM', workspaceId = null } = req.body;
  const count = await SupportCase.countDocuments();
  const caseNumber = `CASE-${1000 + count + 1}`;

  const newCase = await SupportCase.create({
    caseNumber,
    subject,
    description,
    priority,
    workspaceId: workspaceId || null,
    userId: req.user._id,
    status: 'OPEN',
  });

  res.status(201).json({ success: true, case: newCase });
});

export const getAuditLogs = asyncHandler(async (req, res) => {
  const { action, search } = req.query;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
  const skip = (page - 1) * limit;

  const filter = {};
  if (action) filter.action = action;
  if (search) {
    filter.$or = [
      { action: { $regex: search, $options: 'i' } },
      { 'metadata.targetWorkspaceName': { $regex: search, $options: 'i' } },
    ];
  }

  const [total, logs] = await Promise.all([
    SecurityAuditLog.countDocuments(filter),
    SecurityAuditLog.find(filter)
      .populate('actorId', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
  ]);

  res.json({
    success: true,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
    logs: logs.map((l) => ({
      _id: l._id,
      action: l.action,
      actor: l.actorId ? { name: l.actorId.name, email: l.actorId.email } : { email: 'system' },
      metadata: l.metadata,
      createdAt: l.createdAt,
    })),
    // Also include auditLogs alias for compatibility
    auditLogs: logs.map((l) => ({
      _id: l._id,
      action: l.action,
      actorEmail: l.actorId?.email || 'system',
      timestamp: l.createdAt,
      metadata: l.metadata,
    })),
  });
});

export const getSystemHealth = asyncHandler(async (req, res) => {
  const dbConnected = mongoose.connection.readyState === 1;
  const memUsage = process.memoryUsage();

  res.json({
    success: true,
    status: dbConnected ? 'HEALTHY' : 'DEGRADED',
    database: {
      status: dbConnected ? 'CONNECTED' : 'DISCONNECTED',
      name: mongoose.connection.name || 'relay_demo',
      host: mongoose.connection.host || '127.0.0.1',
    },
    messageWorker: {
      status: 'RUNNING',
      mode: 'MOCK_IN_MEMORY_QUEUE',
      heartbeatAt: new Date(),
    },
    messagingProvider: {
      mockEngine: 'ACTIVE',
      metaCloudApi: 'DISCONNECTED',
      providerStatus: 'OFFLINE_MOCK_READY',
    },
    billingAdapter: {
      mode: 'OFFLINE_MOCK',
      realRazorpayLive: false,
      status: 'HEALTHY',
    },
    systemMetrics: {
      uptimeSeconds: Math.floor(process.uptime()),
      nodeVersion: process.version,
      platform: process.platform,
      memoryHeapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
      memoryRssMB: Math.round(memUsage.rss / 1024 / 1024),
    },
  });
});

export default {
  getOverview,
  getWorkspaces,
  getWorkspaceDetails,
  suspendWorkspace,
  reactivateWorkspace,
  getUsers,
  getAgencies,
  getSubscriptions,
  getSupportCases,
  createSupportCase,
  getAuditLogs,
  getSystemHealth,
};
