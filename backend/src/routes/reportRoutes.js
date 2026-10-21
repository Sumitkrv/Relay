import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as rc from '../controllers/reportController.js';
import * as legacyAnalytics from '../controllers/analyticsController.js';
import * as legacyGen from '../controllers/reportGenerationController.js';

const r = Router();
r.use(requireAuth);

// Static reporting routes registered before dynamic /:id parameter routes
r.get('/overview', asyncHandler(rc.overview));
r.get('/campaigns/compare', asyncHandler(rc.compare));
r.get('/campaigns/:id/recipients', asyncHandler(rc.campaignRecipients));
r.get('/campaigns/:id', asyncHandler(rc.getCampaign));
r.get('/campaigns', asyncHandler(rc.campaigns));

r.get('/messages/status', asyncHandler(rc.messageStatus));
r.get('/messages/failures', asyncHandler(rc.failures));
r.get('/messages/retries', asyncHandler(rc.retries));
r.get('/messages', asyncHandler(rc.messages));

r.get('/scheduling', asyncHandler(rc.scheduling));
r.get('/consent', asyncHandler(rc.consent));
r.get('/opt-outs', asyncHandler(rc.optOuts));
r.get('/audience-exclusions', asyncHandler(rc.audienceExclusions));
r.get('/inbox', asyncHandler(rc.inbox));
r.get('/auto-replies', asyncHandler(rc.autoReplies));
r.get('/filters', asyncHandler(rc.filters));

r.post('/export', asyncHandler(rc.exportReport));
r.get('/export', asyncHandler(rc.exportReport));
r.get('/exports', asyncHandler(rc.listExports));
r.get('/exports/:id/download', asyncHandler(rc.downloadExport));

// Legacy Saved Report routes for backward compatibility
r.get('/', asyncHandler(legacyAnalytics.listReports));
r.post('/', asyncHandler(legacyAnalytics.createReport));
r.post('/preview', asyncHandler(legacyGen.preview));
r.post('/:id/generate', asyncHandler(legacyGen.generate));
r.get('/:id/generations', asyncHandler(legacyGen.generations));
r.get('/:id/download', asyncHandler(legacyGen.generate));
r.get('/:id', asyncHandler(legacyAnalytics.getReport));
r.patch('/:id', asyncHandler(legacyAnalytics.updateReport));
r.delete('/:id', asyncHandler(legacyAnalytics.deleteReport));

export default r;
