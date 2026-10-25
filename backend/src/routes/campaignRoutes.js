import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { resolveWorkspaceContext } from '../middleware/requireWorkspace.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as c from '../controllers/campaignController.js';
import * as e from '../controllers/campaignExecutionController.js';

const router = Router();
router.use(requireAuth);
router.use(resolveWorkspaceContext);

// Static routes registered before /:id parameter routes
router.get('/starter-drafts',asyncHandler(c.starterDrafts));
router.get('/stats',asyncHandler(c.campaignStats));
router.get('/categories',asyncHandler(c.categoryCounts));
router.post('/audience/preview',asyncHandler(c.previewAudienceEligibility));
router.get('/executions/:executionId',asyncHandler(e.get));
router.get('/executions/:executionId/jobs',asyncHandler(e.jobs));
router.get('/executions/:executionId/export',asyncHandler(e.exportReport));
router.post('/executions/:executionId/:action',asyncHandler(e.control));
router.get('/',asyncHandler(c.listCampaigns));
router.post('/',asyncHandler(c.createCampaign));

// Campaign-specific lifecycle actions & orchestrations
router.post('/:id/launch',asyncHandler(e.launch));
router.post('/:id/executions',asyncHandler(e.start));
router.get('/:id/executions',asyncHandler(e.list));
router.get('/:id/runs',asyncHandler(e.list));
router.get('/:id/execution',asyncHandler(e.activeExecution));
router.get('/:id/analytics',asyncHandler(e.analytics));
router.get('/:id/messages',asyncHandler(e.campaignMessages));
router.get('/:id/recipients',asyncHandler(c.listAudience));
router.get('/:id/queue-status',asyncHandler(e.campaignQueueStatus));
router.post('/:id/schedule',asyncHandler(e.schedule));
router.post('/:id/reschedule',asyncHandler(e.reschedule));
router.delete('/:id/schedule',asyncHandler(e.unschedule));
router.post('/:id/pause',asyncHandler(e.pauseCampaign));
router.post('/:id/resume',asyncHandler(e.resumeCampaign));
router.post('/:id/cancel',asyncHandler(e.cancelCampaign));
router.post('/:id/retry-failed',asyncHandler(e.retryFailed));

// Campaign configuration, audience & templates
router.get('/:id/audience',asyncHandler(c.listAudience));
router.post('/:id/audience',asyncHandler(c.setAudience));
router.delete('/:id/audience/:contactId',asyncHandler(c.removeAudienceMember));
router.get('/:id/previews',asyncHandler(c.previews));
router.post('/:id/preview',asyncHandler(c.previews));
router.get('/:id/activity',asyncHandler(c.activity));
router.get('/:id/export',asyncHandler(c.exportAudience));
router.post('/:id/validate',asyncHandler(c.validateCampaign));
router.post('/:id/duplicate',asyncHandler(c.duplicateCampaign));
router.post('/:id/archive',asyncHandler(c.archiveCampaign));
router.get('/:id',asyncHandler(c.getCampaign));
router.patch('/:id',asyncHandler(c.updateCampaign));
router.delete('/:id',asyncHandler(c.deleteCampaign));

export default router;

