import * as workspaceMockService from '../services/workspaceMockService.js';

/**
 * Controller: Workspace Mock Automation Controller
 * 
 * Provides HTTP endpoints for the multi-tenant Mock WhatsApp Automation Engine.
 * Strictly scoped to the authenticated workspace resolved by requireWorkspace middleware.
 */

export async function getMockStatus(req, res, next) {
  try {
    const status = await workspaceMockService.getWorkspaceMockStatus(req.workspace);
    return res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error) {
    return next(error);
  }
}

export async function toggleMockConnection(req, res, next) {
  try {
    const { status } = req.body;
    if (!['MOCK_ACTIVE', 'MOCK_PAUSED'].includes(status)) {
      return res.status(400).json({
        code: 'INVALID_STATUS',
        message: 'Mock status must be either MOCK_ACTIVE or MOCK_PAUSED.',
      });
    }

    const updated = await workspaceMockService.toggleWorkspaceMockConnection(req.workspace, status);
    return res.status(200).json({
      success: true,
      message: `Mock connection status updated to ${status}.`,
      data: updated,
    });
  } catch (error) {
    return next(error);
  }
}

export async function simulateInboundMessage(req, res, next) {
  try {
    const { contactPhone, contactName, messageBody, contactId } = req.body;

    if (!messageBody || typeof messageBody !== 'string' || !messageBody.trim()) {
      return res.status(400).json({
        code: 'INVALID_MESSAGE_BODY',
        message: 'messageBody is required and must be non-empty.',
      });
    }

    const result = await workspaceMockService.simulateInboundMessage({
      workspace: req.workspace,
      contactPhone,
      contactName,
      messageBody: messageBody.trim(),
      contactId,
      user: req.user,
    });

    return res.status(200).json({
      success: true,
      message: 'Simulated inbound message processed successfully.',
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

export async function simulateMessageScenario(req, res, next) {
  try {
    const { messageId, scenario } = req.body;

    if (!messageId) {
      return res.status(400).json({
        code: 'MISSING_MESSAGE_ID',
        message: 'messageId is required to simulate a lifecycle event.',
      });
    }

    const validScenarios = ['DELIVERED', 'READ', 'TEMPORARY_FAILURE', 'PERMANENT_FAILURE'];
    if (!validScenarios.includes(scenario)) {
      return res.status(400).json({
        code: 'INVALID_SCENARIO',
        message: `Scenario must be one of: ${validScenarios.join(', ')}`,
      });
    }

    const result = await workspaceMockService.simulateMessageScenario({
      workspace: req.workspace,
      messageId,
      scenario,
    });

    return res.status(200).json({
      success: true,
      message: `Simulated lifecycle scenario '${scenario}' executed.`,
      data: result,
    });
  } catch (error) {
    if (error.message === 'Message not found in this workspace.') {
      return res.status(404).json({
        code: 'MESSAGE_NOT_FOUND',
        message: error.message,
      });
    }
    return next(error);
  }
}

export async function dryRunAutomationTest(req, res, next) {
  try {
    const { messageBody, contactId } = req.body;

    if (!messageBody || typeof messageBody !== 'string' || !messageBody.trim()) {
      return res.status(400).json({
        code: 'INVALID_MESSAGE_BODY',
        message: 'messageBody is required to evaluate auto-reply matching.',
      });
    }

    const result = await workspaceMockService.dryRunAutomationTest({
      workspace: req.workspace,
      messageBody: messageBody.trim(),
      contactId,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

export async function setupWorkspaceDemoData(req, res, next) {
  try {
    const result = await workspaceMockService.setupWorkspaceDemoData({
      workspace: req.workspace,
      user: req.user,
    });

    return res.status(200).json({
      success: true,
      message: 'Workspace demo data provisioned safely.',
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

export async function resetWorkspaceDemoData(req, res, next) {
  try {
    const result = await workspaceMockService.resetWorkspaceDemoData({
      workspace: req.workspace,
      user: req.user,
    });

    return res.status(200).json({
      success: true,
      message: 'Workspace synthetic demo records cleaned up safely. Real customer data was preserved.',
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * Live Attempt Guard:
 * Strictly blocks any attempt to switch or send via live Meta WhatsApp Cloud API in Phase 8.
 */
export async function guardLiveAttempt(req, res) {
  return res.status(403).json({
    code: 'LIVE_META_CONNECTION_DISABLED',
    message: 'Live Meta WhatsApp Cloud API connectivity is disabled in Mock Mode Phase (Prompt 8). Live connection onboarding will be enabled in SaaS Phase 9.',
    isLiveEnabled: false,
    mockEnforced: true,
  });
}
