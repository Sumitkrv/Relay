import api from './api';

export const agencyService = {
  getContext: async () => {
    const { data } = await api.get('/agency/context');
    return data;
  },

  getClients: async () => {
    const { data } = await api.get('/agency/clients');
    return data;
  },

  getClientDetails: async (id) => {
    const { data } = await api.get(`/agency/clients/${id}`);
    return data;
  },

  inviteClient: async (payload) => {
    const { data } = await api.post('/agency/clients/invite', payload);
    return data;
  },

  revokeClient: async (relationId) => {
    const { data } = await api.delete(`/agency/clients/${relationId}`);
    return data;
  },

  getStaff: async () => {
    const { data } = await api.get('/agency/staff');
    return data;
  },

  inviteStaff: async (payload) => {
    const { data } = await api.post('/agency/staff/invite', payload);
    return data;
  },

  removeStaff: async (membershipId) => {
    const { data } = await api.delete(`/agency/staff/${membershipId}`);
    return data;
  },

  updateBranding: async (payload) => {
    const { data } = await api.put('/agency/branding', payload);
    return data;
  },

  verifyDomain: async () => {
    const { data } = await api.post('/agency/domains/verify');
    return data;
  },
};

export default agencyService;
