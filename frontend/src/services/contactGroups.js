import api from './api';

export const listContactGroups = (params) => api.get('/contact-groups', { params });
export const getContactGroup = (id) => api.get(`/contact-groups/${id}`);
export const createContactGroup = (payload) => api.post('/contact-groups', payload);
export const updateContactGroup = (id, payload) => api.patch(`/contact-groups/${id}`, payload);
export const deleteContactGroup = (id) => api.delete(`/contact-groups/${id}`);
export const manageGroupMembers = (id, payload) => api.post(`/contact-groups/${id}/members`, payload);
export const listGroupMembers = (id, params) => api.get(`/contact-groups/${id}/members`, { params });
