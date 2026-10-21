import api from './api';

export const listMessages = (params) => api.get('/messages', { params });
export const getMessageStats = (params) => api.get('/messages/stats', { params });
export const getMessage = (id) => api.get(`/messages/${id}`);
export const getMessageEvents = (id) => api.get(`/messages/${id}/events`);
export const prepareMessage = (data) => api.post('/messages/prepare', data);
export const retryMessage = (id) => api.post(`/messages/${id}/retry`);
export const cancelMessage = (id, reason) => api.post(`/messages/${id}/cancel`, { reason });

export const getSystemMessagingStatus = () => api.get('/system/messaging-status');
export const runMockDiagnostic = (scenario) => api.post('/dev/mock-messaging/run-test', { scenario });
export const getMockDiagnosticResults = () => api.get('/dev/mock-messaging/test-results');

export const simulateInboundReply = (data) => api.post('/dev/mock-messaging/simulate-inbound', data);
export const simulateStatusEvent = (data) => api.post('/dev/mock-messaging/simulate-status', data);
export const simulateOutageToggle = (outage) => api.post('/dev/mock-messaging/simulate-outage', { outage });
export const getFixturesStatus = () => api.get('/dev/mock-messaging/fixtures');
export const loadTestFixtures = () => api.post('/dev/mock-messaging/load-fixtures');
export const resetDemoData = () => api.post('/dev/mock-messaging/reset-demo');
export const runCampaignWorkerNow = () => api.post('/dev/mock-messaging/run-campaign-worker');
export const getSystemTestMatrix = () => api.get('/dev/mock-messaging/system-matrix');
export const simulateTemplateApproval = (templateId, status) => api.post(`/templates/${templateId}/mock-approval`, { status });

export const getCampaignMessages = (campaignId, params) => api.get(`/campaigns/${campaignId}/messages`, { params });
export const getCampaignQueueStatus = (campaignId) => api.get(`/campaigns/${campaignId}/queue-status`);

