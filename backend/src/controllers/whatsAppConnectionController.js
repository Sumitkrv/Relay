import whatsAppConnectionService from '../services/whatsAppConnectionService.js';
import whatsAppOnboardingService from '../services/whatsAppOnboardingService.js';

export const getConnection = async (req, res) => {
  const workspaceId = req.workspace?._id;
  const connection = await whatsAppConnectionService.getConnection(workspaceId);
  return res.status(200).json({ success: true, data: connection });
};

export const getReadiness = async (req, res) => {
  const workspaceId = req.workspace?._id;
  const readiness = await whatsAppConnectionService.getReadiness(workspaceId);
  return res.status(200).json({ success: true, data: readiness });
};

export const getDiagnostics = async (req, res) => {
  const workspaceId = req.workspace?._id;
  const diagnostics = await whatsAppConnectionService.getConnectionDiagnostics(workspaceId);
  return res.status(200).json({ success: true, data: diagnostics });
};

export const disconnectConnection = async (req, res) => {
  const workspaceId = req.workspace?._id;
  const { reason } = req.body || {};
  const result = await whatsAppConnectionService.disconnectConnection(workspaceId, req.user, { reason });
  return res.status(200).json({ success: true, ...result });
};

export const reconnectConnection = async (req, res) => {
  const workspaceId = req.workspace?._id;
  const result = await whatsAppConnectionService.reconnectConnection(workspaceId, req.user);
  return res.status(200).json({ success: true, ...result });
};

export const startOnboarding = async (req, res) => {
  const workspaceId = req.workspace?._id;
  const { requestedPhone, countryCode, connectionMethod } = req.body || {};

  try {
    const attempt = await whatsAppOnboardingService.startOnboarding(workspaceId, req.user, {
      requestedPhone,
      countryCode,
      connectionMethod,
    });
    return res.status(201).json({ success: true, data: attempt });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

export const getCurrentOnboarding = async (req, res) => {
  const workspaceId = req.workspace?._id;
  const attempt = await whatsAppOnboardingService.getCurrentAttempt(workspaceId);
  return res.status(200).json({ success: true, data: attempt });
};

export const selectMethod = async (req, res) => {
  const workspaceId = req.workspace?._id;
  const { attemptId, connectionMethod } = req.body || {};

  if (!attemptId || !connectionMethod) {
    return res.status(400).json({ success: false, message: 'attemptId and connectionMethod are required.' });
  }

  const attempt = await whatsAppOnboardingService.selectMethod(attemptId, workspaceId, connectionMethod);
  return res.status(200).json({ success: true, data: attempt });
};

export const advanceMockOnboarding = async (req, res) => {
  const workspaceId = req.workspace?._id;
  const { attemptId, step, scenario, payload } = req.body || {};

  if (!attemptId || !step) {
    return res.status(400).json({ success: false, message: 'attemptId and step are required.' });
  }

  const result = await whatsAppOnboardingService.advanceMockStep(attemptId, workspaceId, {
    step: Number(step),
    scenario,
    payload,
  });

  return res.status(200).json({ success: true, ...result });
};

export const cancelOnboarding = async (req, res) => {
  const workspaceId = req.workspace?._id;
  const { attemptId } = req.body || {};

  if (!attemptId) {
    return res.status(400).json({ success: false, message: 'attemptId is required.' });
  }

  const result = await whatsAppOnboardingService.cancelOnboarding(attemptId, workspaceId);
  return res.status(200).json({ success: true, ...result });
};
