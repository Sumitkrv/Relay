import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireWorkspace } from '../middleware/requireWorkspace.js';
import {
  getPublicIndustrySummaries,
  getStrictIndustryConfig,
  getIndustryConfig,
} from '../config/industries/industryRegistry.js';
import { getEffectiveWorkspaceIndustryConfig } from '../services/industryConfigurationService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// Public: Get all supported industry summaries for marketing / onboarding
router.get('/', (req, res) => {
  res.json({
    industries: getPublicIndustrySummaries(),
  });
});

// Public: Get detailed configuration for a specific industry
router.get('/:industryKey', (req, res) => {
  const { industryKey } = req.params;
  const config = getStrictIndustryConfig(industryKey);
  if (!config) {
    return res.status(404).json({
      code: 'INDUSTRY_NOT_FOUND',
      message: `Industry "${industryKey}" is not supported.`,
    });
  }
  res.json({ industry: config });
});

// Protected: Get effective industry configuration for the active workspace
router.get(
  '/workspace/current',
  requireAuth,
  requireWorkspace,
  asyncHandler(async (req, res) => {
    const config = await getEffectiveWorkspaceIndustryConfig(req.workspace._id);
    res.json(config);
  })
);

export default router;
