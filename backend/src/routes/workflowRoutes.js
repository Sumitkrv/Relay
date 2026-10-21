import {Router} from 'express';
import {requireAuth} from '../middleware/auth.js';
import {asyncHandler} from '../utils/asyncHandler.js';
import * as w from '../controllers/workflowController.js';
const r=Router();r.use(requireAuth);
r.get('/stats',asyncHandler(w.stats));r.get('/templates',asyncHandler(w.templates));r.get('/settings',asyncHandler(w.getSettings));r.patch('/settings',asyncHandler(w.setSettings));
r.get('/',asyncHandler(w.list));r.post('/',asyncHandler(w.create));
r.get('/:id/versions',asyncHandler(w.versions));r.get('/:id/executions',asyncHandler(w.listRuns));r.post('/:id/executions',asyncHandler(w.startExecution));r.post('/:id/test',asyncHandler(w.test));r.post('/:id/validate',asyncHandler(w.validate));r.post('/:id/publish',asyncHandler(w.publish));r.post('/:id/activate',asyncHandler(w.activate));r.post('/:id/pause',asyncHandler(w.pause));r.post('/:id/duplicate',asyncHandler(w.duplicate));r.post('/:id/archive',asyncHandler(w.archive));r.get('/:id',asyncHandler(w.get));r.patch('/:id',asyncHandler(w.update));r.delete('/:id',asyncHandler(w.remove));
export default r;
