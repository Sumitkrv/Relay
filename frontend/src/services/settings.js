import api from './api';

export const getProfile = () => api.get('/settings/profile');
export const updateProfile = (data) => api.patch('/settings/profile', data);

export const getBusinessProfile = () => api.get('/settings/business');
export const updateBusinessProfile = (data) => api.put('/settings/business', data);

export const getPreferences = () => api.get('/settings/preferences');
export const updatePreferences = (data) => api.put('/settings/preferences', data);

export const getSecurityOverview = () => api.get('/settings/security');
export const changePassword = (data) => api.post('/auth/change-password', data);

export const getIntegrationStatus = () => api.get('/settings/integrations');
export const getSystemStatus = () => api.get('/settings/system-status');
export const getDemoStatus = () => api.get('/settings/demo-status');
export const triggerDemoSeed = () => api.post('/settings/demo-seed');
export const triggerDemoReset = () => api.post('/settings/demo-reset');

export default {
  getProfile,
  updateProfile,
  getBusinessProfile,
  updateBusinessProfile,
  getPreferences,
  updatePreferences,
  getSecurityOverview,
  changePassword,
  getIntegrationStatus,
  getSystemStatus,
  getDemoStatus,
  triggerDemoSeed,
  triggerDemoReset,
};
