import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as m from '../controllers/messageController.js';

const router = Router();
router.use(requireAuth);

// Production safety guard: developer testing endpoints are disabled in production
router.use((_req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      message: 'Developer testing endpoints are strictly disabled in production environments.'
    });
  }
  next();
});

router.post('/run-test', asyncHandler(m.devRunTest));
router.get('/test-results', asyncHandler(m.devTestResults));
router.post('/simulate-inbound', asyncHandler(m.devSimulateInbound));
router.post('/simulate-status', asyncHandler(m.devSimulateStatus));
router.post('/simulate-outage', asyncHandler(m.devSimulateOutage));
router.get('/fixtures', asyncHandler(m.devGetFixtures));
router.post('/load-fixtures', asyncHandler(m.devLoadFixtures));
router.post('/reset-demo', asyncHandler(m.devResetDemo));
router.post('/run-campaign-worker', asyncHandler(m.devRunCampaignWorker));
router.get('/system-matrix', asyncHandler(m.devSystemMatrix));

export default router;
