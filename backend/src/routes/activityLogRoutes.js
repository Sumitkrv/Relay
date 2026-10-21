import {Router} from 'express';
import {requireAuth} from '../middleware/auth.js';
import {asyncHandler} from '../utils/asyncHandler.js';
import * as c from '../controllers/activityLogController.js';
const r=Router();r.use(requireAuth);r.get('/stats',asyncHandler(c.stats));r.get('/export',asyncHandler(c.exportCsv));r.get('/',asyncHandler(c.list));r.get('/:id',asyncHandler(c.detail));export default r;
