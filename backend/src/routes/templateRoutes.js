import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { resolveWorkspaceContext } from '../middleware/requireWorkspace.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as c from '../controllers/templateController.js';

const router=Router();
router.use(requireAuth);
router.use(resolveWorkspaceContext);

router.get('/variables',asyncHandler(c.getVariables));
router.get('/categories',asyncHandler(c.getCategories));
router.get('/library',asyncHandler(c.library));
router.get('/ai/status',c.aiStatus);
router.post('/ai/generate',c.aiRateLimit,c.generateAI);
router.post('/ai/rewrite',c.aiRateLimit,c.rewriteAI);

router.get('/',asyncHandler(c.listTemplates));
router.post('/',asyncHandler(c.createTemplate));

router.get('/:id/versions',asyncHandler(c.templateVersions));
router.post('/:id/versions/:versionId/preview',asyncHandler(c.previewTemplateVersion));
router.post('/:id/restore-version',asyncHandler(c.restoreVersion));
router.post('/:id/archive',asyncHandler(c.archiveTemplate));
router.post('/:id/restore',asyncHandler(c.restoreTemplate));
router.get('/:id/history',asyncHandler(c.templateHistory));
router.get('/:id/campaigns',asyncHandler(c.templateCampaigns));
router.post('/:id/preview',asyncHandler(c.previewTemplate));
router.post('/:id/bulk-preview',asyncHandler(c.bulkPreview));
router.post('/:id/validate',asyncHandler(c.validateTemplateRoute));
router.post('/:id/mock-approval',asyncHandler(c.setMockApproval));
router.post('/:id/duplicate',asyncHandler(c.duplicateTemplate));
router.get('/:id',asyncHandler(c.getTemplate));
router.patch('/:id',asyncHandler(c.updateTemplate));
router.delete('/:id',asyncHandler(c.deleteTemplate));

export default router;
