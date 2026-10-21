import {Router} from 'express';
import {requireAuth} from '../middleware/auth.js';
import {asyncHandler} from '../utils/asyncHandler.js';
import * as c from '../controllers/chatbotController.js';
const r=Router();r.use(requireAuth);
r.get('/',asyncHandler(c.list));r.post('/',asyncHandler(c.create));r.get('/:id/versions',asyncHandler(c.versions));r.post('/:id/restore/:versionId',asyncHandler(c.restoreVersion));r.post('/:id/validate',asyncHandler(c.validate));r.post('/:id/publish',asyncHandler(c.publish));r.post('/:id/duplicate',asyncHandler(c.duplicate));r.post('/:id/archive',asyncHandler(c.archive));r.post('/:id/test-sessions',asyncHandler(c.startTest));r.get('/:id',asyncHandler(c.get));r.patch('/:id',asyncHandler(c.update));
export default r;
