import api from './api';

// Conversations & Stats
export const inboxList = (params) => api.get('/inbox/conversations', { params });
export const inboxStats = () => api.get('/inbox/stats');
export const inboxConversation = (id) => api.get(`/inbox/conversations/${id}`);
export const inboxMessages = (id, params) => api.get(`/inbox/conversations/${id}/messages`, { params });
export const createConversation = (body) => api.post('/inbox/conversations', body);
export const updateConversation = (id, body) => api.patch(`/inbox/conversations/${id}`, body);
export const updateConversationStatus = (id, status) => api.patch(`/inbox/conversations/${id}/status`, { status });
export const toggleConversationAutomation = (id, automationStatus) =>
  api.patch(`/inbox/conversations/${id}/automation`, { automationStatus });
export const updateInboxContact = (id, body) => api.patch(`/inbox/conversations/${id}/contact`, body);
export const markReviewed = (id) => api.post(`/inbox/conversations/${id}/mark-reviewed`);
export const markRead = (id) => api.post(`/inbox/conversations/${id}/mark-read`);
export const markUnread = (id, count = 1) => api.post(`/inbox/conversations/${id}/mark-unread`, { count });
export const inboxActivity = (id) => api.get(`/inbox/conversations/${id}/activity`);

// Mock Outbound and Synthetic Simulation
export const sendMockReply = (id, body) => api.post(`/inbox/conversations/${id}/mock-reply`, { body });
export const createSyntheticTestEvent = (id, body) => api.post(`/inbox/conversations/${id}/test-events`, { body });
export const logManualMessage = (id, body) => api.post(`/inbox/conversations/${id}/messages`, body);

// Drafts
export const getDraft = (id) => api.get(`/inbox/conversations/${id}/draft`);
export const saveDraft = (id, body) => api.put(`/inbox/conversations/${id}/draft`, body);
export const deleteDraft = (id) => api.delete(`/inbox/conversations/${id}/draft`);

// Internal Notes
export const inboxNotes = (id) => api.get(`/inbox/conversations/${id}/notes`);
export const addInboxNote = (id, body) => api.post(`/inbox/conversations/${id}/notes`, body);
export const patchInboxNote = (id, body) => api.patch(`/inbox/notes/${id}`, body);
export const deleteInboxNote = (id) => api.delete(`/inbox/notes/${id}`);

// Quick Replies Library
export const listQuickReplies = (params) => api.get('/inbox/quick-replies', { params });
export const createQuickReply = (body) => api.post('/inbox/quick-replies', body);
export const getQuickReply = (id) => api.get(`/inbox/quick-replies/${id}`);
export const updateQuickReply = (id, body) => api.patch(`/inbox/quick-replies/${id}`, body);
export const deleteQuickReply = (id) => api.delete(`/inbox/quick-replies/${id}`);
export const duplicateQuickReply = (id) => api.post(`/inbox/quick-replies/${id}/duplicate`);

// Auto-Reply Keyword Rules & Engine
export const listAutoReplyRules = () => api.get('/inbox/auto-reply-rules');
export const createAutoReplyRule = (body) => api.post('/inbox/auto-reply-rules', body);
export const getAutoReplyRule = (id) => api.get(`/inbox/auto-reply-rules/${id}`);
export const updateAutoReplyRule = (id, body) => api.patch(`/inbox/auto-reply-rules/${id}`, body);
export const deleteAutoReplyRule = (id) => api.delete(`/inbox/auto-reply-rules/${id}`);
export const activateAutoReplyRule = (id) => api.post(`/inbox/auto-reply-rules/${id}/activate`);
export const deactivateAutoReplyRule = (id) => api.post(`/inbox/auto-reply-rules/${id}/deactivate`);
export const testAutoReplyRule = (id, text) => api.post(`/inbox/auto-reply-rules/${id}/test`, { text });
export const testMatchAllRules = (text) => api.post('/inbox/auto-reply-rules/test-match', { text });
export const getRuleExecutionHistory = (params) => api.get('/inbox/auto-reply-rules/history', { params });

// Follow-up Tasks
export const listFollowups = (params) => api.get('/follow-ups', { params });
export const createFollowup = (body) => api.post('/follow-ups', body);
export const updateFollowup = (id, body) => api.patch(`/follow-ups/${id}`, body);
export const completeFollowup = (id) => api.post(`/follow-ups/${id}/complete`);
export const cancelFollowup = (id) => api.post(`/follow-ups/${id}/cancel`);

// Analytics, Provider & Notifications
export const inboxAnalytics = () => api.get('/inbox/analytics');
export const providerStatus = () => api.get('/inbox/provider-status');
export const notifications = (params) => api.get('/notifications', { params });
export const notificationCount = () => api.get('/notifications/unread-count');
export const markNotificationRead = (id) => api.patch(`/notifications/${id}/read`);
export const markAllNotificationsRead = () => api.post('/notifications/mark-all-read');
export const clearDemoData = () => api.delete('/inbox/demo-data', { data: { confirm: true } });
