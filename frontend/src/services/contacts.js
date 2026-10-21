import api from './api';

export const listContacts = (params) => api.get('/contacts', { params });
export const getContact = (id) => api.get(`/contacts/${id}`);
export const getContactStats = () => api.get('/contacts/stats');
export const createContact = (payload) => api.post('/contacts', payload);
export const updateContact = (id, payload) => api.patch(`/contacts/${id}`, payload);
export const getConsent = (id) => api.get(`/contacts/${id}/consent`);
export const updateConsent = (id, payload) => api.post(`/contacts/${id}/consent`, payload);
export const recordConsentEvent = (id, payload) => api.post(`/contacts/${id}/consent-events`, payload);
export const getEligibility = (id) => api.get(`/contacts/${id}/eligibility`);
export const archiveContact = (id) => api.patch(`/contacts/${id}/archive`);
export const restoreContact = (id) => api.patch(`/contacts/${id}/restore`);
export const deleteContact = (id) => api.delete(`/contacts/${id}`);
export const bulkContacts = (payload) => api.patch('/contacts/bulk', payload);

export const listTags = () => api.get('/contacts/tags');
export const createTag = (payload) => api.post('/contacts/tags', payload);
export const renameTag = (payload) => api.patch('/contacts/tags', payload);
export const deleteTag = (params) => api.delete('/contacts/tags', { params });

export async function downloadContacts({ format = 'csv', ids, filters = {} } = {}) {
  const params = { ...filters, format };
  if (ids?.length) params.ids = ids.join(',');
  const { data } = await api.get('/contacts/export', { params, responseType: 'blob' });
  const url = URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = url;
  link.download = `relay-contacts.${format}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
