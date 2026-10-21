import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as m from '../controllers/messageController.js';

const router = Router();
router.use(requireAuth);

router.get('/stats', asyncHandler(m.stats));
router.post('/prepare', asyncHandler(m.prepare));
router.get('/', asyncHandler(m.list));
router.get('/:id', asyncHandler(m.get));
router.get('/:id/events', asyncHandler(m.events));
router.post('/:id/retry', asyncHandler(m.retry));
router.post('/:id/cancel', asyncHandler(m.cancel));

export default router;
