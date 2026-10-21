import api from './api';

/**
 * WhatsApp Connection & Onboarding API Client (SaaS Prompt 9)
 */

export const getWhatsAppConnection = async () => {
  const res = await api.get('/workspaces/current/whatsapp/connection');
  return res.data;
};

export const getWhatsAppReadiness = async () => {
  const res = await api.get('/workspaces/current/whatsapp/readiness');
  return res.data;
};

export const getWhatsAppDiagnostics = async () => {
  const res = await api.get('/workspaces/current/whatsapp/diagnostics');
  return res.data;
};

export const startWhatsAppOnboarding = async ({ requestedPhone, countryCode, connectionMethod }) => {
  const res = await api.post('/workspaces/current/whatsapp/onboarding/start', {
    requestedPhone,
    countryCode,
    connectionMethod,
  });
  return res.data;
};

export const getCurrentWhatsAppOnboarding = async () => {
  const res = await api.get('/workspaces/current/whatsapp/onboarding/current');
  return res.data;
};

export const selectWhatsAppMethod = async ({ attemptId, connectionMethod }) => {
  const res = await api.post('/workspaces/current/whatsapp/onboarding/method', {
    attemptId,
    connectionMethod,
  });
  return res.data;
};

export const advanceMockWhatsAppStep = async ({ attemptId, step, scenario, payload }) => {
  const res = await api.post('/workspaces/current/whatsapp/onboarding/mock-advance', {
    attemptId,
    step,
    scenario,
    payload,
  });
  return res.data;
};

export const cancelWhatsAppOnboarding = async (attemptId) => {
  const res = await api.post('/workspaces/current/whatsapp/onboarding/cancel', { attemptId });
  return res.data;
};

export const disconnectWhatsAppConnection = async (reason) => {
  const res = await api.post('/workspaces/current/whatsapp/disconnect', { reason });
  return res.data;
};

export const reconnectWhatsAppConnection = async () => {
  const res = await api.post('/workspaces/current/whatsapp/reconnect');
  return res.data;
};

export default {
  getWhatsAppConnection,
  getWhatsAppReadiness,
  getWhatsAppDiagnostics,
  startWhatsAppOnboarding,
  getCurrentWhatsAppOnboarding,
  selectWhatsAppMethod,
  advanceMockWhatsAppStep,
  cancelWhatsAppOnboarding,
  disconnectWhatsAppConnection,
  reconnectWhatsAppConnection,
};
