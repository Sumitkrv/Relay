/**
 * Industry Routes
 * Public and authorized routes for Relay Multi-Industry Configuration.
 */

import { Router } from 'express';
import * as industryController from '../controllers/industryConfigurationController.js';

const router = Router();

// Public: list all supported industries and their capabilities
router.get('/', industryController.getPublicIndustries);

// Public: get full definition of a specific industry by key
router.get('/:industryKey', industryController.getPublicIndustryByKey);

export default router;
