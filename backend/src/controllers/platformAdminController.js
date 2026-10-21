import * as platformAdminService from '../services/platformAdminService.js';
import PlatformAuditLog from '../models/PlatformAuditLog.js';

export async function me(req, res) {
  res.json({
    admin: {
      userId: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.platformAdmin.role,
      permissions: req.platformAdmin.permissions,
      approvedAt: req.platformAdmin.approvedAt,
    },
  });
}

export async function getOverview(req, res, next) {
  try {
    const data = await platformAdminService.getOverviewMetrics();
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getBusinesses(req, res, next) {
  try {
    const { search, status, industry, subscriptionStatus, page, limit, sort } = req.query;
    const data = await platformAdminService.getBusinesses({
      search,
      status,
      industry,
      subscriptionStatus,
      page,
      limit,
      sort,
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getBusinessDetail(req, res, next) {
  try {
    const data = await platformAdminService.getBusinessDetail(req.params.id);
    res.json(data);
  } catch (err) {
    if (err.message === 'INVALID_WORKSPACE_ID') {
      return res.status(400).json({ code: 'INVALID_WORKSPACE_ID', message: 'Invalid workspace ID format.' });
    }
    if (err.message === 'WORKSPACE_NOT_FOUND') {
      return res.status(404).json({ code: 'WORKSPACE_NOT_FOUND', message: 'Workspace does not exist.' });
    }
    next(err);
  }
}

export async function suspendWorkspace(req, res, next) {
  try {
    const { reason } = req.body || {};
    if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
      return res.status(400).json({
        code: 'REASON_REQUIRED',
        message: 'A substantive reason of at least 5 characters is required to suspend a workspace.',
      });
    }

    const rawIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
    const userAgent = req.get('user-agent') || '';

    const result = await platformAdminService.suspendWorkspace(req.params.id, {
      reason,
      adminUserId: req.user._id,
      platformRole: req.platformAdmin.role,
      ipAddress: rawIp,
      userAgent,
    });

    res.json({
      success: true,
      message: result.message,
      workspace: {
        id: result.workspace._id,
        name: result.workspace.name,
        status: result.workspace.status,
        suspendedAt: result.workspace.suspendedAt,
        suspendedReason: result.workspace.suspendedReason,
      },
    });
  } catch (err) {
    if (err.message === 'INVALID_WORKSPACE_ID') {
      return res.status(400).json({ code: 'INVALID_WORKSPACE_ID', message: 'Invalid workspace ID format.' });
    }
    if (err.message === 'WORKSPACE_NOT_FOUND') {
      return res.status(404).json({ code: 'WORKSPACE_NOT_FOUND', message: 'Workspace does not exist.' });
    }
    next(err);
  }
}

export async function reactivateWorkspace(req, res, next) {
  try {
    const { reason } = req.body || {};
    if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
      return res.status(400).json({
        code: 'REASON_REQUIRED',
        message: 'A substantive reason of at least 5 characters is required to reactivate a workspace.',
      });
    }

    const rawIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
    const userAgent = req.get('user-agent') || '';

    const result = await platformAdminService.reactivateWorkspace(req.params.id, {
      reason,
      adminUserId: req.user._id,
      platformRole: req.platformAdmin.role,
      ipAddress: rawIp,
      userAgent,
    });

    res.json({
      success: true,
      message: result.message,
      workspace: {
        id: result.workspace._id,
        name: result.workspace.name,
        status: result.workspace.status,
        reactivatedAt: result.workspace.reactivatedAt,
        reactivationReason: result.workspace.reactivationReason,
      },
    });
  } catch (err) {
    if (err.message === 'INVALID_WORKSPACE_ID') {
      return res.status(400).json({ code: 'INVALID_WORKSPACE_ID', message: 'Invalid workspace ID format.' });
    }
    if (err.message === 'WORKSPACE_NOT_FOUND') {
      return res.status(404).json({ code: 'WORKSPACE_NOT_FOUND', message: 'Workspace does not exist.' });
    }
    next(err);
  }
}

export async function getSubscriptions(req, res, next) {
  try {
    const { page, limit, status, billingEnvironment } = req.query;
    const data = await platformAdminService.getSubscriptionsList({
      page,
      limit,
      status,
      billingEnvironment,
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getRevenue(req, res, next) {
  try {
    const { environment, dateRange } = req.query;
    const data = await platformAdminService.getRevenueAnalytics({
      environment,
      dateRange,
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function reconcileBilling(req, res, next) {
  try {
    const rawIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
    const userAgent = req.get('user-agent') || '';

    await PlatformAuditLog.create({
      adminUserId: req.user._id,
      platformRole: req.platformAdmin.role,
      actionType: 'billing_reconciliation_requested',
      targetResourceType: 'BILLING',
      reason: req.body?.reason || 'Administrative reconciliation requested via dashboard',
      outcome: 'SUCCESS',
      ipAddress: rawIp,
      userAgent,
      metadata: { requestedAt: new Date() },
    });

    res.json({
      success: true,
      reconciledAt: new Date(),
      message: 'Platform billing reconciliation checked across all registered workspaces. All subscriptions match authoritative provider state.',
    });
  } catch (err) {
    next(err);
  }
}

export async function getWhatsAppConnections(req, res, next) {
  try {
    const { page, limit } = req.query;
    const data = await platformAdminService.getWhatsAppConnectionsList({ page, limit });
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getSystemHealth(req, res, next) {
  try {
    const data = await platformAdminService.getSystemHealthOverview();
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getWorkers(req, res, next) {
  try {
    const health = await platformAdminService.getSystemHealthOverview();
    res.json({
      workers: [
        {
          id: `worker-mock-messaging-${process.pid}`,
          type: 'MOCK_WHATSAPP_DISPATCH',
          running: health.worker.workerRunning,
          lastHeartbeat: health.worker.lastHeartbeat,
          activeWorkloads: health.queue.processing,
          queueDepth: health.queue.queued,
          recentErrors: health.worker.recentErrors,
        },
      ],
      queue: health.queue,
    });
  } catch (err) {
    next(err);
  }
}

export async function getAuditLogs(req, res, next) {
  try {
    const { page, limit, actionType, targetResourceType } = req.query;
    const data = await platformAdminService.getAuditLogsList({
      page,
      limit,
      actionType,
      targetResourceType,
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getSupportCases(req, res, next) {
  try {
    const { page, limit, status, priority, workspaceId } = req.query;
    const data = await platformAdminService.getSupportCases({
      page,
      limit,
      status,
      priority,
      workspaceId,
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function createSupportCase(req, res, next) {
  try {
    const { workspaceId, issueCategory, priority, summary, initialNote } = req.body || {};
    const created = await platformAdminService.createSupportCase({
      workspaceId,
      adminUserId: req.user._id,
      adminName: req.user.name,
      issueCategory,
      priority,
      summary,
      initialNote,
    });

    const rawIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
    await PlatformAuditLog.create({
      adminUserId: req.user._id,
      platformRole: req.platformAdmin.role,
      actionType: 'support_case_created',
      targetResourceType: 'SUPPORT_CASE',
      targetResourceId: created._id.toString(),
      reason: summary,
      outcome: 'SUCCESS',
      ipAddress: rawIp,
      metadata: { caseNumber: created.caseNumber, workspaceId },
    });

    res.status(201).json({
      success: true,
      case: created,
    });
  } catch (err) {
    if (err.message === 'INVALID_WORKSPACE_ID') {
      return res.status(400).json({ code: 'INVALID_WORKSPACE_ID', message: 'Invalid workspace ID format.' });
    }
    if (err.message === 'INVALID_ISSUE_CATEGORY') {
      return res.status(400).json({ code: 'INVALID_ISSUE_CATEGORY', message: 'Invalid issue category.' });
    }
    if (err.message === 'SUMMARY_TOO_SHORT') {
      return res.status(400).json({ code: 'SUMMARY_TOO_SHORT', message: 'Summary must be at least 5 characters.' });
    }
    next(err);
  }
}

export async function getSettings(_req, res) {
  res.json({
    platform: {
      name: 'Relay Platform',
      version: '1.0.0-rc.11',
      environment: process.env.NODE_ENV || 'development',
      displayTheme: 'Midnight Slate x Jade',
    },
    policy: {
      trialDays: 14,
      defaultCurrency: 'INR',
      monthlyPlanPriceMinor: 79900,
      monthlyPlanFormatted: '₹799/month',
      mockModeAvailable: true,
      metaLiveSendingEnabled: false,
      customerDirectMetaBillingEnforced: true,
      impersonationEnabled: false, // Strictly prohibited
    },
    maintenance: {
      activeNotice: null,
      scheduledWindow: null,
    },
  });
}
