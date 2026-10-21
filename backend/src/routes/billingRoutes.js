import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireWorkspace } from '../middleware/requireWorkspace.js';
import * as billingController from '../controllers/billingController.js';

const router = Router();

// 1. Public Plan Catalog (for pricing page and signup)
router.get('/plans', billingController.getPublicPlans);

// 2. Unauthenticated Provider Webhook Callback (cryptographically verified by X-Razorpay-Signature)
router.post('/webhooks/razorpay', billingController.handleRazorpayWebhook);

// 3. Protected Workspace Billing Endpoints (Strictly require active authentication & workspace membership)
router.get('/overview', requireAuth, requireWorkspace, billingController.getBillingOverview);
router.post('/trial/start', requireAuth, requireWorkspace, billingController.startTrial);
router.post('/subscriptions', requireAuth, requireWorkspace, billingController.createSubscription);
router.post('/checkout/verify', requireAuth, requireWorkspace, billingController.verifyCheckout);
router.post('/subscription/cancel', requireAuth, requireWorkspace, billingController.cancelSubscription);
router.post('/subscription/resubscribe', requireAuth, requireWorkspace, billingController.resubscribe);
router.get('/payments', requireAuth, requireWorkspace, billingController.getPayments);
router.get('/usage', requireAuth, requireWorkspace, billingController.getUsage);
router.get('/entitlements', requireAuth, requireWorkspace, billingController.getEntitlements);

export default router;
