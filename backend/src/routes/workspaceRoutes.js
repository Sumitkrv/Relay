import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireWorkspace } from '../middleware/requireWorkspace.js';
import * as workspaceController from '../controllers/workspaceController.js';
import * as industryController from '../controllers/industryConfigurationController.js';
import * as mockController from '../controllers/workspaceMockController.js';
import * as whatsAppConnectionController from '../controllers/whatsAppConnectionController.js';

const router = Router();

// All workspace routes require valid server-side authentication
router.use(requireAuth);

// List all active workspaces belonging to the authenticated user
router.get('/my-workspaces', workspaceController.getMyWorkspaces);

// Internal provisioning (safe, authenticated; not public signup)
router.post('/internal-provision', workspaceController.provisionWorkspace);

// Current authorized workspace details (requires active workspace membership verification)
router.get('/current', requireWorkspace, workspaceController.getCurrentWorkspace);

// Restore the authenticated, tenant-scoped configuration routes used by the UI.
router.get('/current/starter-provisioning', requireWorkspace, workspaceController.getStarterProvisioningStatus);
router.post('/current/starter-provisioning/retry', requireWorkspace, workspaceController.retryStarterProvisioning);
router.get('/current/industry-config', requireWorkspace, industryController.getWorkspaceIndustryConfig);
router.get('/current/contact-field-definitions', requireWorkspace, industryController.getWorkspaceFieldDefinitions);
router.get('/current/filter-definitions', requireWorkspace, industryController.getWorkspaceFilterDefinitions);
router.get('/current/template-suggestions', requireWorkspace, industryController.getWorkspaceTemplateSuggestions);
router.get('/current/automation-suggestions', requireWorkspace, industryController.getWorkspaceAutomationSuggestions);
router.post('/current/template-draft', requireWorkspace, industryController.createTemplateDraft);
router.post('/current/automation-draft', requireWorkspace, industryController.createAutomationDraft);
router.put('/current/industry-preferences', requireWorkspace, industryController.updateIndustryPreferences);
router.post('/current/validate-contact-fields', requireWorkspace, industryController.validateContactFields);

export default router;
