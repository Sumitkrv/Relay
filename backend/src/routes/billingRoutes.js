import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireWorkspace } from '../middleware/requireWorkspace.js';
import * as billingController from '../controllers/billingController.js';

const router = Router();

// Public plan catalog
router.get('/plans', billingController.getPlans);

// Workspace-scoped billing operations
router.get(['/current', '/subscription'], requireAuth, requireWorkspace, billingController.getWorkspaceBilling);
router.post(['/checkout', '/mock-checkout'], requireAuth, requireWorkspace, billingController.mockCheckout);
router.post('/advance-clock', requireAuth, requireWorkspace, billingController.advanceClock);
router.post('/cancel', requireAuth, requireWorkspace, billingController.cancelSubscription);
router.post('/resubscribe', requireAuth, requireWorkspace, billingController.mockCheckout);

export default router;
