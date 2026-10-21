import { Router } from 'express';
import { activity, stats, overview } from '../controllers/dashboardController.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(requireAuth);
router.get('/overview', asyncHandler(overview));
router.get('/stats', asyncHandler(stats));
router.get('/activity', asyncHandler(activity));

export default router;
