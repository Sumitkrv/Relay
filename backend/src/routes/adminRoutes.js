import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePlatformAdmin } from '../middleware/adminAuth.js';
import * as adminController from '../controllers/adminController.js';

const router = Router();

// All admin routes strictly enforce authenticated session + authoritative isPlatformAdmin flag
router.use(requireAuth, requirePlatformAdmin);

router.get('/overview', adminController.getOverview);
router.get('/workspaces', adminController.getWorkspaces);
router.get('/workspaces/:id', adminController.getWorkspaceDetails);
router.post('/workspaces/:id/suspend', adminController.suspendWorkspace);
router.patch('/workspaces/:id/suspend', adminController.suspendWorkspace);
router.post('/workspaces/:id/reactivate', adminController.reactivateWorkspace);
router.patch('/workspaces/:id/reactivate', adminController.reactivateWorkspace);
router.get('/users', adminController.getUsers);
router.get('/agencies', adminController.getAgencies);
router.get('/subscriptions', adminController.getSubscriptions);
router.get('/support-cases', adminController.getSupportCases);
router.get('/cases', adminController.getSupportCases);
router.post('/support-cases', adminController.createSupportCase);
router.get('/audit-logs', adminController.getAuditLogs);
router.get('/health', adminController.getSystemHealth);

export default router;
