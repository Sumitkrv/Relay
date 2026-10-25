import api from './api.js';

/**
 * Service: Mock Automation Client API
 * 
 * Interacts with the backend workspace-scoped mock automation engine.
 */

export async function getMockStatus() {
  const response = await api.get('/workspaces/current/mock/status');
  return response.data?.data;
}

export async function toggleMockConnection(status) {
  const response = await api.post('/workspaces/current/mock/toggle', { status });
  return response.data?.data;
}

export async function simulateInboundMessage({ contactPhone, contactName, messageBody, contactId }) {
  const response = await api.post('/workspaces/current/mock/inbound', {
    contactPhone,
    contactName,
    messageBody,
    contactId,
  });
  return response.data?.data;
}

export async function simulateMessageScenario({ messageId, scenario }) {
  const response = await api.post('/workspaces/current/mock/scenario', {
    messageId,
    scenario,
  });
  return response.data?.data;
}

export async function dryRunAutomationTest({ messageBody, contactId }) {
  const response = await api.post('/workspaces/current/mock/automation-test', {
    messageBody,
    contactId,
  });
  return response.data?.data;
}

export async function setupWorkspaceDemoData() {
  const response = await api.post('/workspaces/current/mock/demo-setup');
  return response.data;
}

export async function resetWorkspaceDemoData() {
  const response = await api.post('/workspaces/current/mock/demo-reset');
  return response.data;
}

export async function attemptLiveConnection() {
  const response = await api.post('/workspaces/current/mock/live-attempt');
  return response.data;
}
