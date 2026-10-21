import planCatalogService from '../services/planCatalogService.js';
import subscriptionService from '../services/subscriptionService.js';
import trialManagementService from '../services/trialManagementService.js';
import workspaceEntitlementService from '../services/workspaceEntitlementService.js';
import usageQuotaService from '../services/usageQuotaService.js';
import billingWebhookService from '../services/billingWebhookService.js';
import BillingPayment from '../models/BillingPayment.js';

export const getPublicPlans = async (req, res) => {
  const plans = await planCatalogService.getPublicPlans();
  return res.status(200).json({ success: true, data: plans });
};

export const getBillingOverview = async (req, res) => {
  const workspaceId = req.workspace?._id;
  const overview = await subscriptionService.getBillingOverview(workspaceId);
  return res.status(200).json({ success: true, data: overview });
};

export const startTrial = async (req, res) => {
  const workspaceId = req.workspace?._id;
  try {
    const result = await trialManagementService.startTrial(workspaceId, req.user);
    return res.status(201).json({ success: true, ...result });
  } catch (err) {
    return res.status(err.status || 400).json({
      success: false,
      code: err.code || 'TRIAL_START_FAILED',
      message: err.message,
    });
  }
};

export const createSubscription = async (req, res) => {
  const workspaceId = req.workspace?._id;
  const { planKey } = req.body || {};

  try {
    const result = await subscriptionService.createSubscription(workspaceId, req.user, { planKey });
    return res.status(201).json({ success: true, ...result });
  } catch (err) {
    return res.status(err.status || 400).json({
      success: false,
      code: err.code || 'SUBSCRIPTION_CREATION_FAILED',
      message: err.message,
    });
  }
};

export const verifyCheckout = async (req, res) => {
  const workspaceId = req.workspace?._id;
  const { paymentId, subscriptionId, signature } = req.body || {};

  try {
    const result = await subscriptionService.verifyCheckout(workspaceId, req.user, {
      paymentId,
      subscriptionId,
      signature,
    });
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    return res.status(err.status || 400).json({
      success: false,
      code: err.code || 'CHECKOUT_VERIFICATION_FAILED',
      message: err.message,
    });
  }
};

export const cancelSubscription = async (req, res) => {
  const workspaceId = req.workspace?._id;
  const { cancelAtPeriodEnd, reason } = req.body || {};

  try {
    const result = await subscriptionService.cancelSubscription(workspaceId, req.user, {
      cancelAtPeriodEnd,
      reason,
    });
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    return res.status(err.status || 400).json({
      success: false,
      code: err.code || 'CANCELLATION_FAILED',
      message: err.message,
    });
  }
};

export const resubscribe = async (req, res) => {
  const workspaceId = req.workspace?._id;
  const { planKey } = req.body || {};

  try {
    const result = await subscriptionService.resubscribe(workspaceId, req.user, { planKey });
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    return res.status(err.status || 400).json({
      success: false,
      code: err.code || 'RESUBSCRIBE_FAILED',
      message: err.message,
    });
  }
};

export const getPayments = async (req, res) => {
  const workspaceId = req.workspace?._id;
  const payments = await BillingPayment.find({ workspaceId }).sort({ paidAt: -1 }).limit(50).lean();
  return res.status(200).json({ success: true, data: payments });
};

export const getUsage = async (req, res) => {
  const workspaceId = req.workspace?._id;
  const usage = await usageQuotaService.getUsage(workspaceId);
  return res.status(200).json({ success: true, data: usage });
};

export const getEntitlements = async (req, res) => {
  const workspaceId = req.workspace?._id;
  const entitlements = await workspaceEntitlementService.getWorkspaceEntitlements(workspaceId);
  return res.status(200).json({ success: true, data: entitlements });
};

export const handleRazorpayWebhook = async (req, res) => {
  const signatureHeader = req.headers['x-razorpay-signature'];
  const eventIdHeader = req.headers['x-razorpay-event-id'];
  const rawBody = req.rawBody || JSON.stringify(req.body);

  try {
    const result = await billingWebhookService.processWebhook({
      rawBody,
      signatureHeader,
      eventIdHeader,
    });
    return res.status(200).json({ status: 'ok', ...result });
  } catch (err) {
    return res.status(err.status || 400).json({
      status: 'error',
      code: err.code || 'WEBHOOK_FAILED',
      message: err.message,
    });
  }
};
