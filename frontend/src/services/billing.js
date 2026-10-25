import api from './api';

export const getPlans = async () => {
  const response = await api.get('/billing/plans');
  return response.data;
};

export const getBillingOverview = async () => {
  const response = await api.get('/billing/overview');
  return response.data;
};

export const startTrial = async () => {
  const response = await api.post('/billing/trial/start');
  return response.data;
};

export const createSubscription = async (planKey = 'relay_solo') => {
  const response = await api.post('/billing/subscriptions', { planKey });
  return response.data;
};

export const verifyCheckout = async ({ razorpay_payment_id, razorpay_subscription_id, razorpay_signature }) => {
  const response = await api.post('/billing/checkout/verify', {
    razorpay_payment_id,
    razorpay_subscription_id,
    razorpay_signature
  });
  return response.data;
};

export const cancelSubscription = async (cancelImmediately = false, reason = '') => {
  const response = await api.post('/billing/subscriptions/cancel', {
    cancelImmediately,
    reason
  });
  return response.data;
};

export const getPaymentHistory = async () => {
  const response = await api.get('/billing/payments');
  return response.data;
};

export const getUsage = async () => {
  const response = await api.get('/billing/usage');
  return response.data;
};

export const getEntitlements = async () => {
  const response = await api.get('/billing/entitlements');
  return response.data;
};

export const triggerReconciliation = async () => {
  const response = await api.post('/billing/reconcile');
  return response.data;
};

export default {
  getPlans,
  getBillingOverview,
  startTrial,
  createSubscription,
  verifyCheckout,
  cancelSubscription,
  getPaymentHistory,
  getUsage,
  getEntitlements,
  triggerReconciliation
};
