import api from './api';

export const getOverview = (params) =>
  api.get('/reports/overview', { params }).then((res) => res.data);

export const getCampaignPerformance = (params) =>
  api.get('/reports/campaigns', { params }).then((res) => res.data);

export const compareCampaigns = (ids) =>
  api
    .get('/reports/campaigns/compare', { params: { ids: Array.isArray(ids) ? ids.join(',') : ids } })
    .then((res) => res.data);

export const getCampaignDetail = (id) =>
  api.get(`/reports/campaigns/${id}`).then((res) => res.data);

export const getCampaignRecipients = (id, params) =>
  api.get(`/reports/campaigns/${id}/recipients`, { params }).then((res) => res.data);

export const getMessageStatus = (params) =>
  api.get('/reports/messages/status', { params }).then((res) => res.data);

export const getMessages = (params) =>
  api.get('/reports/messages', { params }).then((res) => res.data);

export const getFailures = (params) =>
  api.get('/reports/messages/failures', { params }).then((res) => res.data);

export const getRetries = (params) =>
  api.get('/reports/messages/retries', { params }).then((res) => res.data);

export const getScheduling = () =>
  api.get('/reports/scheduling').then((res) => res.data);

export const getConsent = (params) =>
  api.get('/reports/consent', { params }).then((res) => res.data);

export const getOptOuts = (params) =>
  api.get('/reports/opt-outs', { params }).then((res) => res.data);

export const getAudienceExclusions = (params) =>
  api.get('/reports/audience-exclusions', { params }).then((res) => res.data);

export const getInboxAnalytics = (params) =>
  api.get('/reports/inbox', { params }).then((res) => res.data);

export const getAutoReplies = (params) =>
  api.get('/reports/auto-replies', { params }).then((res) => res.data);

export const getFilters = () =>
  api.get('/reports/filters').then((res) => res.data);

export const exportReport = (data) =>
  api.post('/reports/export', data, {
    responseType: 'blob'
  });

export const getExportHistory = () =>
  api.get('/reports/exports').then((res) => res.data);

export const downloadExport = (id) =>
  api.get(`/reports/exports/${id}/download`, {
    responseType: 'blob'
  });
