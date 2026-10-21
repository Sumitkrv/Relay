import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  createGroup,
  deleteGroup,
  getGroup,
  getGroupMembers,
  listGroups,
  manageMembers,
  updateGroup
} from '../controllers/contactGroupController.js';

const router = Router();
router.use(requireAuth);

router.get('/', asyncHandler(listGroups));
router.post('/', asyncHandler(createGroup));
router.get('/:id', asyncHandler(getGroup));
router.patch('/:id', asyncHandler(updateGroup));
router.delete('/:id', asyncHandler(deleteGroup));
router.post('/:id/members', asyncHandler(manageMembers));
router.get('/:id/members', asyncHandler(getGroupMembers));

export default router;
