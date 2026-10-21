import {Router} from 'express';
import {requireAuth} from '../middleware/auth.js';
import {asyncHandler} from '../utils/asyncHandler.js';
import * as c from '../controllers/chatbotController.js';
const r=Router();r.use(requireAuth);r.get('/:sessionId',asyncHandler(c.getTest));r.post('/:sessionId/respond',asyncHandler(c.respond));r.delete('/:sessionId',asyncHandler(c.deleteTest));
export default r;
