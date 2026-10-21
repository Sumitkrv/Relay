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

// Industry configuration and dynamic field endpoints for active workspace
router.get('/current/industry-config', requireWorkspace, industryController.getWorkspaceIndustryConfig);
router.get('/current/contact-field-definitions', requireWorkspace, industryController.getWorkspaceFieldDefinitions);
router.get('/current/filter-definitions', requireWorkspace, industryController.getWorkspaceFilterDefinitions);
router.get('/current/template-suggestions', requireWorkspace, industryController.getWorkspaceTemplateSuggestions);
router.get('/current/automation-suggestions', requireWorkspace, industryController.getWorkspaceAutomationSuggestions);
router.post('/current/template-draft', requireWorkspace, industryController.createTemplateDraft);
router.post('/current/automation-draft', requireWorkspace, industryController.createAutomationDraft);
router.put('/current/industry-preferences', requireWorkspace, industryController.updateIndustryPreferences);
router.post('/current/validate-contact-fields', requireWorkspace, industryController.validateContactFields);

// Mock Automation Engine endpoints (strictly workspace scoped)
router.get('/current/mock/status', requireWorkspace, mockController.getMockStatus);
router.post('/current/mock/toggle', requireWorkspace, mockController.toggleMockConnection);
router.post('/current/mock/inbound', requireWorkspace, mockController.simulateInboundMessage);
router.post('/current/mock/scenario', requireWorkspace, mockController.simulateMessageScenario);
router.post('/current/mock/automation-test', requireWorkspace, mockController.dryRunAutomationTest);
router.post('/current/mock/demo-setup', requireWorkspace, mockController.setupWorkspaceDemoData);
router.post('/current/mock/demo-reset', requireWorkspace, mockController.resetWorkspaceDemoData);
router.post('/current/mock/live-attempt', requireWorkspace, mockController.guardLiveAttempt);

// WhatsApp Connection Manager endpoints (SaaS Prompt 9)
router.get('/current/whatsapp/connection', requireWorkspace, whatsAppConnectionController.getConnection);
router.get('/current/whatsapp/readiness', requireWorkspace, whatsAppConnectionController.getReadiness);
router.get('/current/whatsapp/diagnostics', requireWorkspace, whatsAppConnectionController.getDiagnostics);
router.post('/current/whatsapp/disconnect', requireWorkspace, whatsAppConnectionController.disconnectConnection);
router.post('/current/whatsapp/reconnect', requireWorkspace, whatsAppConnectionController.reconnectConnection);
router.post('/current/whatsapp/onboarding/start', requireWorkspace, whatsAppConnectionController.startOnboarding);
router.get('/current/whatsapp/onboarding/current', requireWorkspace, whatsAppConnectionController.getCurrentOnboarding);
router.post('/current/whatsapp/onboarding/method', requireWorkspace, whatsAppConnectionController.selectMethod);
router.post('/current/whatsapp/onboarding/mock-advance', requireWorkspace, whatsAppConnectionController.advanceMockOnboarding);
router.post('/current/whatsapp/onboarding/cancel', requireWorkspace, whatsAppConnectionController.cancelOnboarding);

export default router;
