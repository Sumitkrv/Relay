import { asyncHandler } from '../utils/asyncHandler.js';
import * as billingService from '../services/mockBillingService.js';

export const getPlans = (req, res) => {
  res.json({ plans: billingService.PLANS });
};

export const getWorkspaceBilling = asyncHandler(async (req, res) => {
  const workspaceId = req.workspace._id;
  const subscription = await billingService.getSubscription(workspaceId);
  const invoices = await billingService.getInvoices(workspaceId);

  res.json({
    subscription,
    invoices,
    plans: billingService.PLANS,
  });
});

export const mockCheckout = asyncHandler(async (req, res) => {
  const workspaceId = req.workspace._id;
  const { planId, failSimulation } = req.body;

  const result = await billingService.simulateCheckout(workspaceId, {
    planId,
    failSimulation: Boolean(failSimulation),
  });

  res.json(result);
});

export const advanceClock = asyncHandler(async (req, res) => {
  const workspaceId = req.workspace._id;
  const { days = 15 } = req.body;

  const subscription = await billingService.advanceTestClock(workspaceId, days);
  res.json({ success: true, subscription, advancedDays: days });
});

export const cancelSubscription = asyncHandler(async (req, res) => {
  const workspaceId = req.workspace._id;
  const subscription = await billingService.cancelSubscription(workspaceId);
  res.json({ success: true, subscription });
});

export default {
  getPlans,
  getWorkspaceBilling,
  mockCheckout,
  advanceClock,
  cancelSubscription,
};
