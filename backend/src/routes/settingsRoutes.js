import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  getProfile,
  updateProfile,
  getBusinessProfile,
  updateBusinessProfile,
  getPreferences,
  updatePreferences,
  getSecurityOverview,
  getIntegrationStatus,
  getSystemStatus,
  getDemoStatus,
  triggerDemoSeed,
  triggerDemoReset,
} from '../controllers/settingsController.js';

const router = Router();

// All settings routes require authentication
router.use(requireAuth);

router.get('/profile', asyncHandler(getProfile));
router.patch('/profile', asyncHandler(updateProfile));

router.get('/business', asyncHandler(getBusinessProfile));
router.put('/business', asyncHandler(updateBusinessProfile));

router.get('/preferences', asyncHandler(getPreferences));
router.put('/preferences', asyncHandler(updatePreferences));

router.get('/security', asyncHandler(getSecurityOverview));
router.get('/integrations', asyncHandler(getIntegrationStatus));
router.get('/system-status', asyncHandler(getSystemStatus));
router.get('/demo-status', asyncHandler(getDemoStatus));
router.post('/demo-seed', asyncHandler(triggerDemoSeed));
router.post('/demo-reset', asyncHandler(triggerDemoReset));

export default router;
