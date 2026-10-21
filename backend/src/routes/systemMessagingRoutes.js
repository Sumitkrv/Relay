import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as m from '../controllers/messageController.js';

const router = Router();
router.use(requireAuth);

router.get('/messaging-status', asyncHandler(m.systemStatus));

export default router;
