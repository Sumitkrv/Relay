import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { resolveWorkspaceContext } from '../middleware/requireWorkspace.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as c from '../controllers/inboxController.js';

const r = Router();
r.use(requireAuth);
r.use(resolveWorkspaceContext);

// Top level stats & status
r.get('/stats', asyncHandler(c.stats));
r.get('/analytics', asyncHandler(c.analytics));
r.get('/provider-status', asyncHandler(c.providerStatus));
r.delete('/demo-data', asyncHandler(c.clearDemoData));

// Quick Replies Routes
r.get('/quick-replies', asyncHandler(c.listQuickReplies));
r.post('/quick-replies/starter-pack', asyncHandler(c.installStarterQuickReplies));
r.post('/quick-replies', asyncHandler(c.createQuickReply));
r.get('/quick-replies/:id', asyncHandler(c.getQuickReply));
r.patch('/quick-replies/:id', asyncHandler(c.updateQuickReply));
r.delete('/quick-replies/:id', asyncHandler(c.deleteQuickReply));
r.post('/quick-replies/:id/duplicate', asyncHandler(c.duplicateQuickReply));

// Auto-reply Keyword Rules Routes (static before param)
r.get('/auto-reply-rules', asyncHandler(c.listAutoReplyRules));
r.post('/auto-reply-rules/starter-pack', asyncHandler(c.installStarterRules));
r.post('/auto-reply-rules', asyncHandler(c.createAutoReplyRule));
r.post('/auto-reply-rules/test-match', asyncHandler(c.testMatchAllRules));
r.get('/auto-reply-rules/history', asyncHandler(c.ruleExecutionHistory));
r.get('/auto-reply-rules/:id', asyncHandler(c.getAutoReplyRule));
r.patch('/auto-reply-rules/:id', asyncHandler(c.updateAutoReplyRule));
r.delete('/auto-reply-rules/:id', asyncHandler(c.deleteAutoReplyRule));
r.post('/auto-reply-rules/:id/activate', asyncHandler(c.activateRule));
r.post('/auto-reply-rules/:id/deactivate', asyncHandler(c.deactivateRule));
r.post('/auto-reply-rules/:id/test', asyncHandler(c.testSingleRule));

// Conversations Routes
r.get('/conversations', asyncHandler(c.list));
r.post('/conversations', asyncHandler(c.createConversation));
r.get('/conversations/:id', asyncHandler(c.getConversation));
r.patch('/conversations/:id/contact', asyncHandler(c.contactUpdate));
r.patch('/conversations/:id/status', asyncHandler(c.updateStatus));
r.patch('/conversations/:id/automation', asyncHandler(c.toggleAutomation));
r.patch('/conversations/:id', asyncHandler(c.updateConversation));

// Conversation Messages, Mock Outbound, and Test Simulation
r.get('/conversations/:id/messages', asyncHandler(c.messages));
r.post('/conversations/:id/messages', asyncHandler(c.addManualMessage));
r.post('/conversations/:id/mock-reply', asyncHandler(c.sendMockReply));
r.post('/conversations/:id/test-events', asyncHandler(c.createSyntheticTestEvent));
r.get('/conversations/:id/activity', asyncHandler(c.activity));
r.post('/conversations/:id/mark-reviewed', asyncHandler(c.markReviewed));
r.post('/conversations/:id/mark-read', asyncHandler(c.markRead));
r.post('/conversations/:id/mark-unread', asyncHandler(c.markUnread));
r.post('/conversations/:id/archive', asyncHandler((req, res) => {
  req.body = { status: 'Archived' };
  return c.updateConversation(req, res);
}));
r.post('/conversations/:id/reopen', asyncHandler((req, res) => {
  req.body = { status: 'Open' };
  return c.updateConversation(req, res);
}));

// Drafts & Notes
r.get('/conversations/:id/draft', asyncHandler(c.getDraft));
r.put('/conversations/:id/draft', asyncHandler(c.saveDraft));
r.delete('/conversations/:id/draft', asyncHandler(c.deleteDraft));
r.get('/conversations/:id/notes', asyncHandler(c.notes));
r.post('/conversations/:id/notes', asyncHandler(c.createNote));
r.patch('/notes/:id', asyncHandler(c.updateNote));
r.delete('/notes/:id', asyncHandler(c.deleteNote));

export default r;
