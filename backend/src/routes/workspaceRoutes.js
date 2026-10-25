import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireWorkspace } from '../middleware/requireWorkspace.js';
import * as workspaceController from '../controllers/workspaceController.js';

const router = Router();

// All workspace routes require valid server-side authentication
router.use(requireAuth);

// List all active workspaces belonging to the authenticated user
router.get('/my-workspaces', workspaceController.getMyWorkspaces);

// Internal provisioning (safe, authenticated; not public signup)
router.post('/internal-provision', workspaceController.provisionWorkspace);

// Current authorized workspace details (requires active workspace membership verification)
router.get('/current', requireWorkspace, workspaceController.getCurrentWorkspace);

// Starter provisioning status (read-only) and owner-only safe retry
router.get('/current/starter-provisioning', requireWorkspace, workspaceController.getStarterProvisioningStatus);
router.post('/current/starter-provisioning/retry', requireWorkspace, workspaceController.retryStarterProvisioning);

export default router;
