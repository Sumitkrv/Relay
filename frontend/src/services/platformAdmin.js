import api from './api';

export const platformAdminApi = {
  getMe: () => api.get('/platform-admin/me').then((r) => r.data),
  getOverview: () => api.get('/platform-admin/overview').then((r) => r.data),
  getBusinesses: (params = {}) => api.get('/platform-admin/businesses', { params }).then((r) => r.data),
  getBusinessDetail: (id) => api.get(`/platform-admin/businesses/${id}`).then((r) => r.data),
  suspendWorkspace: (id, payload) => api.post(`/platform-admin/businesses/${id}/suspend`, payload).then((r) => r.data),
  reactivateWorkspace: (id, payload) => api.post(`/platform-admin/businesses/${id}/reactivate`, payload).then((r) => r.data),
  getSubscriptions: (params = {}) => api.get('/platform-admin/subscriptions', { params }).then((r) => r.data),
  getRevenue: (params = {}) => api.get('/platform-admin/revenue', { params }).then((r) => r.data),
  reconcileBilling: (payload = {}) => api.post('/platform-admin/billing/reconcile', payload).then((r) => r.data),
  getWhatsAppConnections: (params = {}) => api.get('/platform-admin/whatsapp-connections', { params }).then((r) => r.data),
  getSystemHealth: () => api.get('/platform-admin/system-health').then((r) => r.data),
  getWorkers: () => api.get('/platform-admin/workers').then((r) => r.data),
  getAuditLogs: (params = {}) => api.get('/platform-admin/audit-logs', { params }).then((r) => r.data),
  getSupportCases: (params = {}) => api.get('/platform-admin/support/cases', { params }).then((r) => r.data),
  createSupportCase: (payload) => api.post('/platform-admin/support/cases', payload).then((r) => r.data),
  getSettings: () => api.get('/platform-admin/settings').then((r) => r.data),
};

export default platformAdminApi;
