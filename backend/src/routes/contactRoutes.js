import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import {
  archiveContact,
  bulkContacts,
  contactActivity,
  contactStats,
  createContact,
  createTag,
  deleteTag,
  exportContacts,
  getConsent,
  getContact,
  getEligibility,
  listContacts,
  listTags,
  renameTag,
  restoreContact,
  softDeleteContact,
  updateConsent,
  updateContact
} from '../controllers/contactController.js';
import { contactWorkflows } from '../controllers/workflowController.js';
import { createContactConversation } from '../controllers/inboxController.js';
import { contactScore, scoreHistory } from '../controllers/analyticsController.js';

const router = Router();
router.use(requireAuth);

router.get('/stats', asyncHandler(contactStats));
router.get('/export', asyncHandler(exportContacts));
router.get('/tags', asyncHandler(listTags));
router.post('/tags', asyncHandler(createTag));
router.patch('/tags', asyncHandler(renameTag));
router.delete('/tags', asyncHandler(deleteTag));
router.patch('/tags/:tag', asyncHandler(renameTag));
router.delete('/tags/:tag', asyncHandler(deleteTag));

router.get('/', asyncHandler(listContacts));
router.post('/', asyncHandler(createContact));
router.patch('/bulk', asyncHandler(bulkContacts));

router.post('/:contactId/conversations', asyncHandler(createContactConversation));
router.get('/:id/score-history', asyncHandler(scoreHistory));
router.get('/:id/score', asyncHandler(contactScore));
router.get('/:id/activity', asyncHandler(contactActivity));
router.get('/:id/workflows', asyncHandler(contactWorkflows));
router.get('/:id/consent', asyncHandler(getConsent));
router.post('/:id/consent', asyncHandler(updateConsent));
router.post('/:id/consent-events', asyncHandler(updateConsent));
router.get('/:id/eligibility', asyncHandler(getEligibility));
router.patch('/:id/archive', asyncHandler(archiveContact));
router.patch('/:id/restore', asyncHandler(restoreContact));
router.get('/:id', asyncHandler(getContact));
router.patch('/:id', asyncHandler(updateContact));
router.delete('/:id', asyncHandler(softDeleteContact));

export default router;
