import api from './api';

export const adminService = {
  getOverview: async () => {
    const { data } = await api.get('/admin/overview');
    return data;
  },

  getWorkspaces: async (params = {}) => {
    const { data } = await api.get('/admin/workspaces', { params });
    return data;
  },

  getWorkspaceDetails: async (id) => {
    const { data } = await api.get(`/admin/workspaces/${id}`);
    return data;
  },

  suspendWorkspace: async (id) => {
    const { data } = await api.post(`/admin/workspaces/${id}/suspend`);
    return data;
  },

  reactivateWorkspace: async (id) => {
    const { data } = await api.post(`/admin/workspaces/${id}/reactivate`);
    return data;
  },

  getUsers: async (params = {}) => {
    const { data } = await api.get('/admin/users', { params });
    return data;
  },

  getAgencies: async () => {
    const { data } = await api.get('/admin/agencies');
    return data;
  },

  getSubscriptions: async (params = {}) => {
    const { data } = await api.get('/admin/subscriptions', { params });
    return data;
  },

  getSupportCases: async () => {
    const { data } = await api.get('/admin/support-cases');
    return data;
  },

  createSupportCase: async (payload) => {
    const { data } = await api.post('/admin/support-cases', payload);
    return data;
  },

  getAuditLogs: async (params = {}) => {
    const { data } = await api.get('/admin/audit-logs', { params });
    return data;
  },

  getSystemHealth: async () => {
    const { data } = await api.get('/admin/health');
    return data;
  },
};

export default adminService;
