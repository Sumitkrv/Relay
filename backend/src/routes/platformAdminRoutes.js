import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePlatformAdmin, requireStepUpAuth } from '../middleware/platformAdminAuth.js';
import * as controller from '../controllers/platformAdminController.js';

const router = Router();

// Base protection: all platform-admin routes strictly require authenticated user
router.use(requireAuth);

// 1. Session verification
router.get('/me', requirePlatformAdmin(), controller.me);

// 2. Overview metrics
router.get('/overview', requirePlatformAdmin('platform.dashboard.read'), controller.getOverview);

// 3. Businesses directory & management
router.get('/businesses', requirePlatformAdmin('platform.workspaces.read'), controller.getBusinesses);
router.get('/businesses/:id', requirePlatformAdmin('platform.workspaces.read'), controller.getBusinessDetail);
router.post('/businesses/:id/suspend', requirePlatformAdmin('platform.workspaces.suspend'), requireStepUpAuth, controller.suspendWorkspace);
router.post('/businesses/:id/reactivate', requirePlatformAdmin('platform.workspaces.reactivate'), requireStepUpAuth, controller.reactivateWorkspace);

// 4. Subscriptions & Billing
router.get('/subscriptions', requirePlatformAdmin('platform.billing.read'), controller.getSubscriptions);
router.get('/revenue', requirePlatformAdmin('platform.billing.read'), controller.getRevenue);
router.post('/billing/reconcile', requirePlatformAdmin('platform.billing.reconcile'), controller.reconcileBilling);

// 5. WhatsApp Connections
router.get('/whatsapp-connections', requirePlatformAdmin('platform.connections.read'), controller.getWhatsAppConnections);

// 6. System & Worker Observability
router.get('/system-health', requirePlatformAdmin('platform.health.read'), controller.getSystemHealth);
router.get('/workers', requirePlatformAdmin('platform.workers.read'), controller.getWorkers);

// 7. Security & Audit Trail
router.get('/audit-logs', requirePlatformAdmin('platform.audit.read'), controller.getAuditLogs);

// 8. Support Operations
router.get('/support/cases', requirePlatformAdmin('platform.support.cases.read'), controller.getSupportCases);
router.post('/support/cases', requirePlatformAdmin('platform.support.cases.write'), controller.createSupportCase);

// 9. Safe Platform Settings
router.get('/settings', requirePlatformAdmin('platform.settings.read'), controller.getSettings);

export default router;
