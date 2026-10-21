import mongoose from 'mongoose';
import Conversation from '../models/Conversation.js';
import ConversationMessage from '../models/ConversationMessage.js';
import MessageDraft from '../models/MessageDraft.js';
import InternalNote from '../models/InternalNote.js';
import FollowUpTask from '../models/FollowUpTask.js';
import ConversationActivity from '../models/ConversationActivity.js';
import InboxNotification from '../models/InboxNotification.js';
import Contact from '../models/Contact.js';
import ContactActivity from '../models/ContactActivity.js';
import ConsentRecord from '../models/ConsentRecord.js';
import MessageTemplate, { TemplateVersion } from '../models/MessageTemplate.js';
import QuickReply from '../models/QuickReply.js';
import AutoReplyRule from '../models/AutoReplyRule.js';
import RuleExecution from '../models/RuleExecution.js';
import {
  objectId,
  requireConversation,
  writeActivity,
  makeConversation,
  logManualCommunication,
  getProviderStatus
} from '../services/inboxService.js';
import {
  seedDefaultRules,
  seedDefaultQuickReplies,
  evaluateInboundMessage,
  matchKeyword,
  interpolateVariables
} from '../services/autoReplyRuleService.js';
import { scoreContact } from '../services/leadScoringService.js';
import { recordConvertedContact } from '../services/leadConversionService.js';
import Campaign from '../models/Campaign.js';
import CampaignAudience from '../models/CampaignAudience.js';
import CampaignExecution from '../models/CampaignExecution.js';
import CampaignMessageJob from '../models/CampaignMessageJob.js';
import Deal from '../models/Deal.js';
import Proposal from '../models/Proposal.js';
import WorkflowExecution from '../models/WorkflowExecution.js';

const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const statuses = ['Open', 'Pending', 'Follow-up Required', 'Needs Attention', 'Resolved', 'Closed', 'Archived'];

async function scopedConversation(req) {
  const c = await requireConversation(req.user._id, req.params.id);
  if (!c) throw fail('Conversation not found.', 404);
  return c;
}

export async function stats(req, res) {
  const ownerId = req.user._id;
  await Promise.all([
    seedDefaultRules(ownerId).catch(() => {}),
    seedDefaultQuickReplies(ownerId).catch(() => {})
  ]);

  const [byStatus, unread, followups, provider, rulesCount, quickRepliesCount] = await Promise.all([
    Conversation.aggregate([{ $match: { ownerId } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Conversation.aggregate([{ $match: { ownerId } }, { $group: { _id: null, count: { $sum: '$internalUnreadCount' } } }]),
    FollowUpTask.countDocuments({ ownerId, status: { $in: ['Pending', 'In Progress'] }, dueAt: { $lte: new Date() } }),
    getProviderStatus(),
    AutoReplyRule.countDocuments({ ownerId, enabled: true, archivedAt: null }),
    QuickReply.countDocuments({ ownerId, archivedAt: null })
  ]);

  const s = Object.fromEntries(byStatus.map(x => [x._id, x.count]));
  res.json({
    stats: {
      total: byStatus.reduce((n, x) => n + x.count, 0),
      open: s.Open || 0,
      needsAttention: (s['Needs Attention'] || 0) + (s['Follow-up Required'] || 0),
      pending: s.Pending || 0,
      resolved: s.Resolved || 0,
      closed: s.Closed || 0,
      unread: unread[0]?.count || 0,
      followupsDue: followups,
      activeRules: rulesCount,
      quickReplies: quickRepliesCount,
      genuineInboundMessages: null,
      genuineReplies: null,
      responseRate: null,
      deliveryRate: null,
      providerAvailable: false
    },
    provider
  });
}

export async function list(req, res) {
  const ownerId = req.user._id;
  await Promise.all([
    seedDefaultRules(ownerId).catch(() => {}),
    seedDefaultQuickReplies(ownerId).catch(() => {})
  ]);

  const page = Math.max(1, Number.parseInt(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit) || 20));
  const filter = { ownerId };

  if (req.query.status && req.query.status !== 'all') {
    if (!statuses.map(s => s.toLowerCase()).includes(req.query.status.toLowerCase())) {
      throw fail('Invalid conversation status.');
    }
    const matched = statuses.find(s => s.toLowerCase() === req.query.status.toLowerCase());
    filter.status = matched;
  }

  // Filter shortcuts
  if (req.query.filter === 'unread') {
    filter.internalUnreadCount = { $gt: 0 };
  } else if (req.query.filter === 'followup' || req.query.filter === 'needs_attention') {
    filter.status = { $in: ['Needs Attention', 'Follow-up Required'] };
  } else if (req.query.filter === 'open') {
    filter.status = 'Open';
  } else if (req.query.filter === 'closed') {
    filter.status = 'Closed';
  } else if (req.query.filter === 'resolved') {
    filter.status = 'Resolved';
  }

  if (req.query.automation === 'active') {
    filter.automationStatus = 'ACTIVE';
  } else if (req.query.automation === 'paused') {
    filter.automationStatus = 'PAUSED';
  }

  if (req.query.source === 'test') {
    filter.source = 'test';
  } else if (req.query.source === 'real') {
    filter.source = { $in: ['manual', 'mock', 'provider'] };
  }

  if (req.query.assigned === 'me') {
    filter.assignedUserId = ownerId;
  }

  if (req.query.activitySince) {
    const since = new Date(req.query.activitySince);
    if (!Number.isNaN(since.getTime())) filter.lastActivityAt = { $gte: since };
  }
  if (req.query.activityBefore) {
    const until = new Date(req.query.activityBefore);
    if (!Number.isNaN(until.getTime())) filter.lastActivityAt = { ...(filter.lastActivityAt || {}), $lte: until };
  }

  let contactQuery = { ownerId, isDeleted: false };
  const q = String(req.query.q || '').trim().slice(0, 120);

  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const contacts = await Contact.find({
      ...contactQuery,
      $or: [
        { fullName: rx },
        { phoneNumber: rx },
        { companyName: rx },
        { tags: rx },
        { leadStatus: rx },
        { businessCategory: rx },
        { interestedService: rx },
        { location: rx }
      ]
    }).limit(500).select('_id').lean();

    const ids = contacts.map(c => c._id);
    const messages = await ConversationMessage.find({ ownerId, messageBody: rx }).limit(300).select('conversationId').lean();

    filter.$or = [
      { contactId: { $in: ids } },
      { _id: { $in: messages.map(m => m.conversationId) } },
      { labels: rx },
      { tags: rx }
    ];
  }

  if (req.query.category) contactQuery.businessCategory = String(req.query.category).slice(0, 80);
  if (req.query.leadStatus) contactQuery.leadStatus = String(req.query.leadStatus).slice(0, 80);
  if (req.query.tag) contactQuery.tags = String(req.query.tag).slice(0, 40).toLowerCase();
  if (req.query.priority) contactQuery.priority = String(req.query.priority);

  if (Object.keys(contactQuery).length > 2) {
    const contacts = await Contact.find(contactQuery).limit(1000).select('_id').lean();
    filter.contactId = { $in: contacts.map(c => c._id) };
  }

  const sort = req.query.sort === 'oldest' ? { lastActivityAt: 1, _id: 1 } : { lastActivityAt: -1, _id: -1 };
  const [records, total] = await Promise.all([
    Conversation.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate({
        path: 'contactId',
        match: { ownerId, isDeleted: false },
        select: 'fullName companyName phoneNumber email website businessCategory industry location interestedService leadStatus priority tags notes leadSource lastContactedAt lastRepliedAt whatsappConsentStatus isSuppressed suppressionReason'
      })
      .populate({
        path: 'lastMessageId',
        select: 'messageBody direction messageSource occurredAt simulationStatus'
      })
      .lean(),
    Conversation.countDocuments(filter)
  ]);

  res.json({
    records: records.filter(x => x.contactId),
    total,
    page,
    limit,
    pages: Math.ceil(total/limit)
  });
}

export async function createConversation(req, res) {
  const source = req.body?.source === 'test' ? 'test' : 'manual';
  const conversation = await makeConversation({
    ownerId: req.user._id,
    contactId: req.body?.contactId,
    performedBy: req.user._id,
    source
  });
  res.status(201).json({ conversation });
}

export async function getConversation(req, res) {
  const c = await scopedConversation(req);
  const [conversation, contact, draft, notes, tasks, consentHistory, audience] = await Promise.all([
    Conversation.findOne({ _id: c._id, ownerId: req.user._id }).populate('lastMessageId').lean(),
    Contact.findOne({ _id: c.contactId, ownerId: req.user._id, isDeleted: false }).lean(),
    MessageDraft.findOne({ ownerId: req.user._id, conversationId: c._id }).lean(),
    InternalNote.find({ ownerId: req.user._id, conversationId: c._id, deletedAt: null }).sort({ isPinned: -1, createdAt: -1 }).limit(100).lean(),
    FollowUpTask.find({ ownerId: req.user._id, conversationId: c._id }).sort({ dueAt: 1 }).limit(50).lean(),
    ConsentRecord.find({ ownerId: req.user._id, contactId: c.contactId }).sort({ recordedAt: -1 }).limit(10).select('status consentSource consentPurpose consentCapturedAt evidenceReference recordedAt').lean(),
    CampaignAudience.find({ ownerId: req.user._id, contactId: c.contactId }).sort({ createdAt: -1 }).limit(50).lean()
  ]);

  if (!contact) throw fail('Contact not found.', 404);

  // Link campaign history if available
  const campaignIds = [...new Set(audience.map(x => String(x.campaignId)))];
  const campaigns = campaignIds.length
    ? await Campaign.find({ ownerId: req.user._id, _id: { $in: campaignIds } }).select('name description purpose status campaignType schedule templateSnapshot').lean()
    : [];
  const campaignMap = new Map(campaigns.map(x => [String(x._id), x]));

  const jobs = campaignIds.length
    ? await CampaignMessageJob.find({ ownerId: req.user._id, contactId: c.contactId, campaignId: { $in: campaignIds } }).sort({ createdAt: -1 }).limit(50).lean()
    : [];

  const campaignHistory = audience.map(member => {
    const camp = campaignMap.get(String(member.campaignId));
    const job = jobs.find(j => String(j.campaignId) === String(member.campaignId));
    return {
      campaign: camp || null,
      job: job || null,
      addedAt: member.createdAt
    };
  }).filter(x => x.campaign);

  res.json({
    conversation,
    contact,
    draft,
    notes,
    tasks,
    consentHistory,
    campaignHistory,
    providerWindow: { status: 'Unknown', lastVerifiedInboundAt: c.lastVerifiedInboundAt || null, expiresAt: null }
  });
}

export async function updateConversation(req, res) {
  if (!objectId(req.params.id)) throw fail('Conversation ID is invalid.');
  const c = await Conversation.findOne({ _id: req.params.id, ownerId: req.user._id });
  if (!c) throw fail('Conversation not found.', 404);
  const b = req.body || {};

  const allowedFields = ['status', 'assignedUserId', 'tags', 'labels', 'automationStatus'];
  if (Object.keys(b).some(k => !allowedFields.includes(k))) {
    throw fail('Unsupported conversation field.');
  }

  if (b.status !== undefined) {
    const matched = statuses.find(s => s.toLowerCase() === String(b.status).toLowerCase());
    if (!matched) throw fail('Invalid conversation status.');
    const before = c.status;

    if (matched === 'Archived') {
      c.activeWorkspaceKey = undefined;
    } else if (before === 'Archived') {
      const key = String(c.ownerId) + ':' + String(c.contactId) + ':' + c.source;
      const collision = await Conversation.findOne({ ownerId: req.user._id, activeWorkspaceKey: key, _id: { $ne: c._id } }).lean();
      if (collision) throw fail('An active conversation workspace already exists for this contact and source.', 409);
      c.activeWorkspaceKey = key;
    } else if (!c.activeWorkspaceKey) {
      c.activeWorkspaceKey = String(c.ownerId) + ':' + String(c.contactId) + ':' + c.source;
    }

    c.status = matched;
    if (before !== c.status) {
      await writeActivity({
        conversation: c,
        eventType: 'status_changed',
        metadata: { from: before, to: c.status },
        performedBy: req.user._id
      });
    }
  }

  if (b.automationStatus !== undefined) {
    if (!['ACTIVE', 'PAUSED'].includes(b.automationStatus)) throw fail('Invalid automation status.');
    const beforeAuto = c.automationStatus;
    c.automationStatus = b.automationStatus;
    if (beforeAuto !== c.automationStatus) {
      await writeActivity({
        conversation: c,
        eventType: c.automationStatus === 'PAUSED' ? 'owner_takeover_enabled' : 'automation_resumed',
        metadata: { from: beforeAuto, to: c.automationStatus },
        performedBy: req.user._id
      });
    }
  }

  if (b.assignedUserId !== undefined) {
    if (b.assignedUserId && !objectId(b.assignedUserId)) throw fail('Assigned user ID is invalid.');
    if (b.assignedUserId && String(b.assignedUserId) !== String(req.user._id)) throw fail('Assignment must be to a workspace user.');
    c.assignedUserId = b.assignedUserId || null;
    await writeActivity({
      conversation: c,
      eventType: 'assigned',
      metadata: { assignedUserId: c.assignedUserId },
      performedBy: req.user._id
    });
  }

  if (b.tags !== undefined) {
    if (!Array.isArray(b.tags) || b.tags.length > 30 || b.tags.some(x => typeof x !== 'string' || x.length > 40)) {
      throw fail('Provide up to 30 valid conversation tags.');
    }
    c.tags = [...new Set(b.tags.map(x => x.trim().toLowerCase()).filter(Boolean))];
  }

  if (b.labels !== undefined) {
    if (!Array.isArray(b.labels) || b.labels.length > 20 || b.labels.some(x => typeof x !== 'string' || x.length > 60)) {
      throw fail('Provide up to 20 valid conversation labels.');
    }
    c.labels = [...new Set(b.labels.map(x => x.trim()).filter(Boolean))];
  }

  await c.save();
  res.json({ conversation: c });
}

export async function updateStatus(req, res) {
  const next = req.body?.status;
  if (!next) throw fail('Status is required.');
  req.body = { status: next };
  return updateConversation(req, res);
}

export async function toggleAutomation(req, res) {
  const c = await scopedConversation(req);
  const next = req.body?.automationStatus || (c.automationStatus === 'PAUSED' ? 'ACTIVE' : 'PAUSED');
  if (!['ACTIVE', 'PAUSED'].includes(next)) throw fail('Invalid automation status.');
  
  await Conversation.updateOne({ _id: c._id, ownerId: req.user._id }, { $set: { automationStatus: next } });
  
  await writeActivity({
    conversation: c,
    eventType: next === 'PAUSED' ? 'owner_takeover_enabled' : 'automation_resumed',
    metadata: { automationStatus: next },
    performedBy: req.user._id
  });

  res.json({
    automationStatus: next,
    notice: next === 'PAUSED' ? 'Manual control active. Auto-replies paused.' : 'Automation active. Keyword auto-replies enabled.'
  });
}

export async function messages(req, res) {
  const c = await scopedConversation(req);
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit) || 40));
  const before = Number.isFinite(Date.parse(req.query.before || '')) ? new Date(req.query.before) : null;
  const filter = { ownerId: req.user._id, conversationId: c._id, ...(before ? { occurredAt: { $lt: before } } : {}) };
  const rows = await ConversationMessage.find(filter).sort({ occurredAt: -1, _id: -1 }).limit(limit + 1).lean();
  const hasMore = rows.length > limit;
  const records = rows.slice(0, limit).reverse();
  res.json({ records, hasMore, nextBefore: hasMore ? records[0]?.occurredAt : null });
}

export async function addManualMessage(req, res) {
  const c = await scopedConversation(req);
  const message = await logManualCommunication({
    ownerId: req.user._id,
    conversation: c,
    performedBy: req.user._id,
    body: req.body?.body,
    direction: req.body?.direction,
    occurredAt: req.body?.occurredAt,
    type: req.body?.type
  });
  res.status(201).json({ message, notice: 'Manually logged communication. Not verified as a WhatsApp event.' });
}

export async function sendMockReply(req, res) {
  const c = await scopedConversation(req);
  const body = String(req.body?.body || '').trim();
  if (!body || body.length > 5000) throw fail('Message text must contain 1–5000 characters.');

  const message = await ConversationMessage.create({
    ownerId: req.user._id,
    conversationId: c._id,
    contactId: c.contactId,
    direction: 'outbound',
    messageType: 'text',
    messageSource: 'mock_simulation',
    trustLevel: 'unverified',
    messageBody: body,
    providerStatus: 'Unavailable',
    simulationStatus: 'Simulated Success',
    occurredAt: new Date()
  });

  const stored = await Conversation.findOne({ _id: c._id, ownerId: req.user._id });
  stored.lastMessageId = message._id;
  stored.lastActivityAt = message.occurredAt;
  await stored.save();

  await writeActivity({
    conversation: c,
    eventType: 'mock_message_sent',
    eventSource: 'mock_simulation',
    metadata: { messageId: message._id, direction: 'outbound' },
    performedBy: req.user._id
  });

  res.status(201).json({
    message,
    notice: 'Simulated mock WhatsApp reply logged. No external WhatsApp messages were sent.'
  });
}

export async function markReviewed(req, res) {
  const c = await Conversation.findOneAndUpdate(
    { _id: req.params.id, ownerId: req.user._id },
    { $set: { internalUnreadCount: 0 } },
    { new: true }
  );
  if (!c) throw fail('Conversation not found.', 404);
  await writeActivity({ conversation: c, eventType: 'marked_reviewed', metadata: {}, performedBy: req.user._id });
  res.json({ conversation: c, notice: 'Updated CRM unread state only; no WhatsApp read receipt was sent.' });
}

export async function markRead(req, res) {
  return markReviewed(req, res);
}

export async function markUnread(req, res) {
  const c = await Conversation.findOneAndUpdate(
    { _id: req.params.id, ownerId: req.user._id },
    { $set: { internalUnreadCount: Math.max(1, Number(req.body?.count) || 1) } },
    { new: true }
  );
  if (!c) throw fail('Conversation not found.', 404);
  await writeActivity({ conversation: c, eventType: 'marked_unread', metadata: { internalUnreadCount: c.internalUnreadCount }, performedBy: req.user._id });
  res.json({ conversation: c });
}

export async function activity(req, res) {
  const c = await scopedConversation(req);
  const [events, messages, notes, tasks, contactEvents] = await Promise.all([
    ConversationActivity.find({ ownerId: req.user._id, conversationId: c._id }).sort({ createdAt: -1 }).limit(100).lean(),
    ConversationMessage.find({ ownerId: req.user._id, conversationId: c._id }).sort({ occurredAt: -1 }).limit(50).lean(),
    InternalNote.find({ ownerId: req.user._id, conversationId: c._id, deletedAt: null }).sort({ createdAt: -1 }).limit(50).lean(),
    FollowUpTask.find({ ownerId: req.user._id, conversationId: c._id }).sort({ updatedAt: -1 }).limit(50).lean(),
    ContactActivity.find({ ownerId: req.user._id, contactId: c.contactId }).sort({ createdAt: -1 }).limit(100).lean()
  ]);

  const linkedMessages = new Set(events.map(e => String(e.metadata?.messageId || '')));
  const linkedNotes = new Set(events.map(e => String(e.metadata?.noteId || '')));
  const linkedTasks = new Set(events.map(e => String(e.metadata?.taskId || '')));

  const records = [
    ...events.map(e => ({ ...e, kind: 'activity' })),
    ...contactEvents.map(e => ({ ...e, kind: 'contact_activity', eventType: e.activityType, eventSource: 'contact', metadata: { description: e.description, changes: e.changes }, createdAt: e.createdAt })),
    ...messages.filter(m => !linkedMessages.has(String(m._id))).map(m => ({ ...m, kind: 'message', createdAt: m.occurredAt })),
    ...notes.filter(n => !linkedNotes.has(String(n._id))).map(n => ({ ...n, kind: 'note' })),
    ...tasks.filter(t => !linkedTasks.has(String(t._id))).map(t => ({ ...t, kind: 'followup' }))
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 150);

  res.json({ records });
}

export async function getDraft(req, res) {
  const c = await scopedConversation(req);
  res.json({ draft: await MessageDraft.findOne({ ownerId: req.user._id, conversationId: c._id }).lean() });
}

export async function saveDraft(req, res) {
  const c = await scopedConversation(req);
  const body = String(req.body?.draftText ?? '');
  if (body.length > 10000) throw fail('Draft is too long.');

  let selectedTemplateId = null, selectedTemplateVersionId = null;
  if (req.body?.selectedTemplateVersionId) {
    if (!objectId(req.body.selectedTemplateVersionId)) throw fail('Template version ID is invalid.');
    const version = await TemplateVersion.findOne({ _id: req.body.selectedTemplateVersionId, ownerId: req.user._id }).lean();
    if (!version) throw fail('Template version not found.', 404);
    selectedTemplateVersionId = version._id;
    selectedTemplateId = version.templateId;
  }

  const draft = await MessageDraft.findOneAndUpdate(
    { ownerId: req.user._id, conversationId: c._id },
    {
      $set: {
        contactId: c.contactId,
        draftText: body,
        selectedTemplateId,
        selectedTemplateVersionId,
        updatedBy: req.user._id
      },
      $setOnInsert: { ownerId: req.user._id, conversationId: c._id }
    },
    { new: true, upsert: true, runValidators: true }
  );

  await writeActivity({ conversation: c, eventType: 'draft_saved', metadata: { characterCount: body.length }, performedBy: req.user._id });
  res.json({ draft, notice: 'Draft saved. No message was sent.' });
}

export async function deleteDraft(req, res) {
  const c = await scopedConversation(req);
  await MessageDraft.deleteOne({ ownerId: req.user._id, conversationId: c._id });
  await writeActivity({ conversation: c, eventType: 'draft_deleted', metadata: {}, performedBy: req.user._id });
  res.json({ deleted: true });
}

export async function notes(req, res) {
  const c = await scopedConversation(req);
  res.json({ records: await InternalNote.find({ ownerId: req.user._id, conversationId: c._id, deletedAt: null }).sort({ isPinned: -1, createdAt: -1 }).limit(100).lean() });
}

export async function createNote(req, res) {
  const c = await scopedConversation(req);
  const content = String(req.body?.content || '').trim();
  if (!content || content.length > 5000) throw fail('Note must contain 1–5000 characters.');

  const note = await InternalNote.create({
    ownerId: req.user._id,
    contactId: c.contactId,
    conversationId: c._id,
    content,
    isPinned: req.body?.isPinned === true,
    priority: ['Low', 'Normal', 'High'].includes(req.body?.priority) ? req.body.priority : 'Normal',
    createdBy: req.user._id,
    updatedBy: req.user._id
  });

  await writeActivity({ conversation: c, eventType: 'note_added', metadata: { noteId: note._id }, performedBy: req.user._id });
  res.status(201).json({ note });
}

export async function updateNote(req, res) {
  if (!objectId(req.params.id)) throw fail('Note ID is invalid.');
  const note = await InternalNote.findOne({ _id: req.params.id, ownerId: req.user._id, deletedAt: null });
  if (!note) throw fail('Note not found.', 404);

  if (req.body?.content !== undefined) {
    if (typeof req.body.content !== 'string' || !req.body.content.trim() || req.body.content.length > 5000) throw fail('Note must contain 1–5000 characters.');
    note.history.push({ content: note.content, editedBy: req.user._id, editedAt: new Date() });
    note.content = req.body.content.trim();
  }
  if (req.body?.isPinned !== undefined) note.isPinned = Boolean(req.body.isPinned);
  if (req.body?.priority !== undefined) {
    if (!['Low', 'Normal', 'High'].includes(req.body.priority)) throw fail('Invalid note priority.');
    note.priority = req.body.priority;
  }
  note.updatedBy = req.user._id;
  await note.save();

  if (note.conversationId) {
    const c = await Conversation.findOne({ _id: note.conversationId, ownerId: req.user._id });
    if (c) await writeActivity({ conversation: c, eventType: 'note_updated', metadata: { noteId: note._id, isPinned: note.isPinned }, performedBy: req.user._id });
  }
  res.json({ note });
}

export async function deleteNote(req, res) {
  if (!objectId(req.params.id)) throw fail('Note ID is invalid.');
  const note = await InternalNote.findOneAndUpdate(
    { _id: req.params.id, ownerId: req.user._id, deletedAt: null },
    { $set: { deletedAt: new Date(), updatedBy: req.user._id } },
    { new: true }
  );
  if (!note) throw fail('Note not found.', 404);
  if (note.conversationId) {
    const c = await Conversation.findOne({ _id: note.conversationId, ownerId: req.user._id });
    if (c) await writeActivity({ conversation: c, eventType: 'note_deleted', metadata: { noteId: note._id }, performedBy: req.user._id });
  }
  res.json({ deleted: true });
}

export async function contactUpdate(req, res) {
  const c = await scopedConversation(req);
  const allowed = ['fullName', 'phoneNumber', 'email', 'companyName', 'website', 'location', 'businessCategory', 'industry', 'leadSource', 'whatsappNumber', 'estimatedDealValue', 'leadStatus', 'priority', 'tags', 'notes', 'interestedService'];
  if (Object.keys(req.body || {}).some(k => !allowed.includes(k))) throw fail('Unsupported contact field. Use the consent management page for consent changes.');

  const contact = await Contact.findOne({ _id: c.contactId, ownerId: req.user._id, isDeleted: false });
  if (!contact) throw fail('Contact not found.', 404);

  const changes = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined && contact[key] !== req.body[key]) {
      const value = req.body[key];
      if (['fullName', 'phoneNumber', 'email', 'companyName', 'website', 'location', 'businessCategory', 'industry', 'leadSource', 'whatsappNumber'].includes(key) && (typeof value !== 'string' || value.length > 300)) throw fail('Invalid contact field.');
      if (key === 'estimatedDealValue' && value !== null && (!Number.isFinite(Number(value)) || Number(value) < 0)) throw fail('Estimated deal value must be a non-negative number.');
      if (key === 'leadStatus' && !['New', 'Contacted', 'Interested', 'Follow-up Required', 'Negotiation', 'Converted', 'Not Interested', 'Closed'].includes(value)) throw fail('Invalid lead status.');
      if (key === 'priority' && !['Low', 'Medium', 'High', 'Urgent'].includes(value)) throw fail('Invalid priority.');
      if (key === 'tags' && (!Array.isArray(value) || value.length > 50 || value.some(x => typeof x !== 'string' || x.length > 40))) throw fail('Invalid tags.');
      if (['notes', 'interestedService'].includes(key) && (typeof value !== 'string' || value.length > (key === 'notes' ? 10000 : 120))) throw fail(`Invalid ${key}.`);
      changes[key] = { from: contact[key], to: key === 'estimatedDealValue' && value !== null ? Number(value) : value };
      contact[key] = key === 'estimatedDealValue' && value !== null ? Number(value) : key === 'tags' ? [...new Set(value.map(x => x.trim().toLowerCase()).filter(Boolean))] : value;
    }
  }

  await contact.save();
  await ContactActivity.create({
    ownerId: req.user._id,
    contactId: contact._id,
    performedBy: req.user._id,
    activityType: changes.leadStatus ? 'status_changed' : changes.priority ? 'priority_changed' : 'edited',
    description: 'Contact updated from Inbox',
    changes
  });

  if (changes.leadStatus?.to === 'Converted') await recordConvertedContact(contact, req.user._id);
  await scoreContact(req.user._id, contact._id);
  res.json({ contact });
}

export async function createFollowUp(req, res) {
  const b = req.body || {};
  const contactId = b.contactId || (b.conversationId && (await requireConversation(req.user._id, b.conversationId))?.contactId);
  if (!objectId(contactId)) throw fail('Contact ID is invalid.');

  const contact = await Contact.findOne({ _id: contactId, ownerId: req.user._id, isDeleted: false }).lean();
  if (!contact) throw fail('Contact not found.', 404);

  let conversation = null;
  if (b.conversationId) {
    conversation = await requireConversation(req.user._id, b.conversationId);
    if (!conversation || String(conversation.contactId) !== String(contactId)) throw fail('Conversation not found for this contact.', 404);
  }

  const dueAt = new Date(b.dueAt);
  if (Number.isNaN(dueAt.getTime())) throw fail('A valid follow-up date and time are required.');
  const title = String(b.title || '').trim();
  if (title.length < 2 || title.length > 160) throw fail('Task title must contain 2–160 characters.');

  let deal = null, proposal = null;
  if (b.dealId) {
    deal = await Deal.findOne({ _id: b.dealId, ownerId: req.user._id, contactId, archivedAt: null });
    if (!deal) throw fail('Deal not found for this contact.', 404);
  }
  if (b.proposalId) {
    proposal = await Proposal.findOne({ _id: b.proposalId, ownerId: req.user._id, contactId });
    if (!proposal || (deal && String(proposal.dealId) !== String(deal._id))) throw fail('Proposal not found for this contact/deal.', 404);
  }

  const task = await FollowUpTask.create({
    ownerId: req.user._id,
    contactId,
    conversationId: conversation?._id || null,
    dealId: deal?._id || null,
    proposalId: proposal?._id || null,
    title,
    description: String(b.description || '').slice(0, 2000),
    dueAt,
    timezone: String(b.timezone || 'Asia/Kolkata'),
    priority: ['Low', 'Medium', 'High', 'Urgent'].includes(b.priority) ? b.priority : 'Medium',
    assignedUserId: req.user._id,
    createdBy: req.user._id
  });

  if (conversation) {
    await writeActivity({
      conversation,
      eventType: 'followup_created',
      metadata: { taskId: task._id, title, dueAt },
      performedBy: req.user._id
    });
  }

  await InboxNotification.create({
    ownerId: req.user._id,
    recipientUserId: req.user._id,
    conversationId: conversation?._id || null,
    contactId,
    notificationType: 'followup_assigned',
    dedupeKey: `task:${task._id}`,
    title: 'Follow-up scheduled',
    description: title
  }).catch(() => {});

  res.status(201).json({ task });
}

export async function listFollowUps(req, res) {
  const filter = { ownerId: req.user._id };
  if (req.query.status && ['Pending', 'In Progress', 'Completed', 'Cancelled'].includes(req.query.status)) filter.status = req.query.status;
  if (req.query.dealId) {
    if (!objectId(req.query.dealId)) throw fail('Deal ID is invalid.');
    filter.dealId = req.query.dealId;
  }
  if (req.query.proposalId) {
    if (!objectId(req.query.proposalId)) throw fail('Proposal ID is invalid.');
    filter.proposalId = req.query.proposalId;
  }
  if (req.query.contactId) {
    if (!objectId(req.query.contactId)) throw fail('Contact ID is invalid.');
    filter.contactId = req.query.contactId;
  }
  if (req.query.due === 'pending') filter.status = { $in: ['Pending', 'In Progress'] };

  const page = Math.max(1, Number.parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit) || 50));
  const [records, total] = await Promise.all([
    FollowUpTask.find(filter).sort({ dueAt: 1 }).skip((page - 1) * limit).limit(limit).populate('contactId', 'fullName companyName phoneNumber leadStatus').lean(),
    FollowUpTask.countDocuments(filter)
  ]);
  res.json({ records, total, page, limit });
}

export async function getFollowUp(req, res) {
  if (!objectId(req.params.id)) throw fail('Task ID is invalid.');
  const task = await FollowUpTask.findOne({ _id: req.params.id, ownerId: req.user._id }).populate('contactId', 'fullName companyName phoneNumber leadStatus').lean();
  if (!task) throw fail('Task not found.', 404);
  res.json({ task });
}

export async function updateFollowUp(req, res) {
  if (!objectId(req.params.id)) throw fail('Task ID is invalid.');
  const task = await FollowUpTask.findOne({ _id: req.params.id, ownerId: req.user._id });
  if (!task) throw fail('Task not found.', 404);

  const allowed = ['title', 'description', 'dueAt', 'timezone', 'priority', 'status', 'dealId', 'proposalId'];
  if (Object.keys(req.body || {}).some(k => !allowed.includes(k))) throw fail('Unsupported follow-up field.');

  for (const k of allowed) {
    if (req.body[k] !== undefined) {
      if (k === 'dealId') {
        if (!objectId(req.body[k]) || !await Deal.exists({ _id: req.body[k], ownerId: req.user._id, contactId: task.contactId, archivedAt: null })) throw fail('Deal not found for this contact.', 404);
        task.dealId = req.body[k];
        continue;
      }
      if (k === 'proposalId') {
        if (!objectId(req.body[k]) || !await Proposal.exists({ _id: req.body[k], ownerId: req.user._id, contactId: task.contactId })) throw fail('Proposal not found for this contact.', 404);
        task.proposalId = req.body[k];
        continue;
      }
      if (k === 'title' && (!String(req.body[k]).trim() || String(req.body[k]).length > 160)) throw fail('Invalid task title.');
      if (k === 'description' && String(req.body[k]).length > 2000) throw fail('Description is too long.');
      if (k === 'dueAt') {
        const d = new Date(req.body[k]);
        if (Number.isNaN(d.getTime())) throw fail('Invalid due date.');
        task.dueAt = d;
      } else if (k === 'priority' && !['Low', 'Medium', 'High', 'Urgent'].includes(req.body[k])) throw fail('Invalid priority.');
      else if (k === 'status' && !['Pending', 'In Progress', 'Completed', 'Cancelled'].includes(req.body[k])) throw fail('Invalid task status.');
      else if (k !== 'dueAt') task[k] = req.body[k];
    }
  }

  if (task.status === 'Completed') task.completedAt = new Date();
  await task.save();

  if (task.status === 'Completed') await scoreContact(req.user._id, task.contactId);
  if (task.conversationId) {
    const c = await Conversation.findOne({ _id: task.conversationId, ownerId: req.user._id });
    if (c) await writeActivity({ conversation: c, eventType: task.status === 'Completed' ? 'followup_completed' : 'followup_created', metadata: { taskId: task._id, status: task.status }, performedBy: req.user._id });
  }
  res.json({ task });
}

export async function completeFollowUp(req, res) {
  req.body = { status: 'Completed' };
  return updateFollowUp(req, res);
}

export async function cancelFollowUp(req, res) {
  req.body = { status: 'Cancelled' };
  return updateFollowUp(req, res);
}

export async function notifications(req, res) {
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit) || 30));
  const records = await InboxNotification.find({ ownerId: req.user._id, recipientUserId: req.user._id }).sort({ createdAt: -1 }).limit(limit).lean();
  res.json({ records, unreadCount: await InboxNotification.countDocuments({ ownerId: req.user._id, recipientUserId: req.user._id, isRead: false }) });
}

export async function unreadNotificationCount(req, res) {
  res.json({ count: await InboxNotification.countDocuments({ ownerId: req.user._id, recipientUserId: req.user._id, isRead: false }) });
}

export async function markNotificationRead(req, res) {
  if (!objectId(req.params.id)) throw fail('Notification ID is invalid.');
  const notification = await InboxNotification.findOneAndUpdate(
    { _id: req.params.id, ownerId: req.user._id, recipientUserId: req.user._id },
    { $set: { isRead: true } },
    { new: true }
  );
  if (!notification) throw fail('Notification not found.', 404);
  res.json({ notification });
}

export async function markAllNotificationsRead(req, res) {
  await InboxNotification.updateMany({ ownerId: req.user._id, recipientUserId: req.user._id, isRead: false }, { $set: { isRead: true } });
  res.json({ updated: true });
}

export async function analytics(req, res) {
  const ownerId = req.user._id;
  const [statusesList, unread, due, completed, ruleExecutions] = await Promise.all([
    Conversation.aggregate([{ $match: { ownerId } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Conversation.aggregate([{ $match: { ownerId } }, { $group: { _id: null, total: { $sum: '$internalUnreadCount' } } }]),
    FollowUpTask.countDocuments({ ownerId, status: { $in: ['Pending', 'In Progress'] }, dueAt: { $lte: new Date() } }),
    FollowUpTask.countDocuments({ ownerId, status: 'Completed' }),
    RuleExecution.countDocuments({ ownerId })
  ]);
  res.json({
    records: statusesList,
    metrics: {
      unread: unread[0]?.total || 0,
      followupsDue: due,
      followupsCompleted: completed,
      autoReplyExecutions: ruleExecutions
    },
    providerMetrics: { available: false, inbound: null, replies: null, responseRate: null, deliveryRate: null }
  });
}

export async function providerStatus(req, res) {
  res.json(await getProviderStatus());
}

export async function createContactConversation(req, res) {
  const conversation = await makeConversation({
    ownerId: req.user._id,
    contactId: req.params.contactId,
    performedBy: req.user._id,
    source: req.body?.source === 'test' ? 'test' : 'manual'
  });
  res.status(201).json({ conversation });
}

export async function clearDemoData(req, res) {
  if (req.body?.confirm !== true) throw fail('Confirm clearing test inbox records.');
  const ownerId = req.user._id;
  const conversations = await Conversation.find({ ownerId, source: 'test' }).select('_id').lean();
  const ids = conversations.map(x => x._id);
  if (ids.length) {
    await Promise.all([
      ConversationMessage.deleteMany({ ownerId, conversationId: { $in: ids }, messageSource: { $in: ['synthetic_test', 'mock_simulation', 'manual'] } }),
      MessageDraft.deleteMany({ ownerId, conversationId: { $in: ids } }),
      InternalNote.deleteMany({ ownerId, conversationId: { $in: ids } }),
      FollowUpTask.deleteMany({ ownerId, conversationId: { $in: ids } }),
      ConversationActivity.deleteMany({ ownerId, conversationId: { $in: ids } }),
      Conversation.deleteMany({ ownerId, _id: { $in: ids }, source: 'test' })
    ]);
  }
  res.json({ deletedConversations: ids.length, notice: 'Only explicitly labeled test conversations and their inbox records were removed.' });
}

export async function createSyntheticTestEvent(req, res) {
  if (process.env.NODE_ENV === 'production') throw fail('Synthetic inbox events are disabled in production.', 404);
  const c = await Conversation.findOne({ _id: req.params.id, ownerId: req.user._id });
  if (!c) throw fail('Conversation not found.', 404);

  const body = String(req.body?.body || '').trim();
  if (!body || body.length > 5000) throw fail('Test event text must contain 1–5000 characters.');

  const message = await ConversationMessage.create({
    ownerId: req.user._id,
    conversationId: c._id,
    contactId: c.contactId,
    direction: 'inbound',
    messageType: 'text',
    messageSource: 'synthetic_test',
    trustLevel: 'synthetic',
    messageBody: body,
    providerStatus: 'Unavailable',
    simulationStatus: 'Simulated Success',
    occurredAt: new Date()
  });

  c.lastMessageId = message._id;
  c.lastActivityAt = message.occurredAt;
  c.lastInboundAt = message.occurredAt;
  c.internalUnreadCount += 1;
  await c.save();

  await writeActivity({
    conversation: c,
    eventType: 'message_logged',
    eventSource: 'synthetic_test',
    metadata: { messageId: message._id, direction: 'inbound', label: 'Synthetic test event only' },
    performedBy: req.user._id
  });

  // Evaluate Keyword Rules
  const ruleEvaluation = await evaluateInboundMessage({
    ownerId: req.user._id,
    conversationId: c._id,
    contactId: c.contactId,
    messageBody: body,
    messageId: message._id,
    user: req.user,
    executionMode: 'SYNTHETIC_TEST'
  });

  const updatedConversation = await Conversation.findById(c._id).populate('lastMessageId').lean();

  res.status(201).json({
    message,
    conversation: updatedConversation,
    ruleEvaluation,
    notice: 'Synthetic test event stored in TEST context. Evaluated through keyword automation engine.'
  });
}

// -------------------------------------------------------------
// QUICK REPLIES CRUD CONTROLLERS
// -------------------------------------------------------------

export async function listQuickReplies(req, res) {
  const ownerId = req.user._id;
  await seedDefaultQuickReplies(ownerId).catch(() => {});

  const filter = { ownerId, archivedAt: null };
  if (req.query.category && req.query.category !== 'all') {
    filter.category = req.query.category;
  }
  if (req.query.q) {
    const rx = new RegExp(req.query.q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: rx }, { messageText: rx }, { description: rx }];
  }

  const records = await QuickReply.find(filter).sort({ category: 1, name: 1 }).lean();
  res.json({ records, total: records.length });
}

export async function createQuickReply(req, res) {
  const { name, messageText, category, description } = req.body || {};
  if (!name || !name.trim()) throw fail('Quick reply title/name is required.');
  if (!messageText || !messageText.trim()) throw fail('Quick reply text is required.');

  const reply = await QuickReply.create({
    ownerId: req.user._id,
    name: name.trim(),
    description: (description || '').trim(),
    messageText: messageText.trim(),
    category: ['Brochure', 'Pricing', 'Location', 'Site Visit', 'General', 'Follow-up'].includes(category) ? category : 'General'
  });

  res.status(201).json({ quickReply: reply });
}

export async function getQuickReply(req, res) {
  if (!objectId(req.params.id)) throw fail('Quick reply ID is invalid.');
  const reply = await QuickReply.findOne({ _id: req.params.id, ownerId: req.user._id, archivedAt: null }).lean();
  if (!reply) throw fail('Quick reply not found.', 404);
  res.json({ quickReply: reply });
}

export async function updateQuickReply(req, res) {
  if (!objectId(req.params.id)) throw fail('Quick reply ID is invalid.');
  const reply = await QuickReply.findOne({ _id: req.params.id, ownerId: req.user._id, archivedAt: null });
  if (!reply) throw fail('Quick reply not found.', 404);

  const { name, messageText, category, description, isActive } = req.body || {};
  if (name !== undefined) {
    if (!name.trim()) throw fail('Name cannot be empty.');
    reply.name = name.trim();
  }
  if (messageText !== undefined) {
    if (!messageText.trim()) throw fail('Message text cannot be empty.');
    reply.messageText = messageText.trim();
  }
  if (category !== undefined) {
    if (['Brochure', 'Pricing', 'Location', 'Site Visit', 'General', 'Follow-up'].includes(category)) {
      reply.category = category;
    }
  }
  if (description !== undefined) reply.description = String(description).trim();
  if (isActive !== undefined) reply.isActive = Boolean(isActive);

  await reply.save();
  res.json({ quickReply: reply });
}

export async function deleteQuickReply(req, res) {
  if (!objectId(req.params.id)) throw fail('Quick reply ID is invalid.');
  const reply = await QuickReply.findOneAndUpdate(
    { _id: req.params.id, ownerId: req.user._id, archivedAt: null },
    { $set: { archivedAt: new Date() } },
    { new: true }
  );
  if (!reply) throw fail('Quick reply not found.', 404);
  res.json({ deleted: true });
}

export async function duplicateQuickReply(req, res) {
  if (!objectId(req.params.id)) throw fail('Quick reply ID is invalid.');
  const original = await QuickReply.findOne({ _id: req.params.id, ownerId: req.user._id, archivedAt: null }).lean();
  if (!original) throw fail('Quick reply not found.', 404);

  const duplicate = await QuickReply.create({
    ownerId: req.user._id,
    name: `${original.name} (Copy)`,
    description: original.description,
    messageText: original.messageText,
    category: original.category,
    supportedVariables: original.supportedVariables
  });

  res.status(201).json({ quickReply: duplicate });
}

// -------------------------------------------------------------
// AUTO-REPLY KEYWORD RULES CRUD & TESTER
// -------------------------------------------------------------

export async function listAutoReplyRules(req, res) {
  const ownerId = req.user._id;
  await seedDefaultRules(ownerId).catch(() => {});

  const filter = { ownerId, archivedAt: null };
  const records = await AutoReplyRule.find(filter).sort({ priority: 1, createdAt: 1 }).lean();
  res.json({ records, total: records.length });
}

export async function createAutoReplyRule(req, res) {
  const { name, triggerKeyword, synonyms, matchType, actionType, responseMessage, priority, enabled, cooldownSeconds } = req.body || {};
  if (!name || !name.trim()) throw fail('Rule name is required.');
  if (!triggerKeyword || !triggerKeyword.trim()) throw fail('Trigger keyword is required.');
  if (!actionType) throw fail('Action type is required.');

  const rule = await AutoReplyRule.create({
    ownerId: req.user._id,
    name: name.trim(),
    triggerKeyword: triggerKeyword.trim().toUpperCase(),
    synonyms: Array.isArray(synonyms) ? synonyms.map(s => String(s).trim().toUpperCase()).filter(Boolean) : [],
    matchType: ['EXACT_MATCH', 'WHOLE_WORD', 'CONTAINS'].includes(matchType) ? matchType : 'WHOLE_WORD',
    actionType,
    responseMessage: responseMessage || '',
    priority: Number.isFinite(Number(priority)) ? Number(priority) : 10,
    enabled: enabled !== false,
    cooldownSeconds: Number.isFinite(Number(cooldownSeconds)) ? Number(cooldownSeconds) : 15
  });

  res.status(201).json({ rule });
}

export async function getAutoReplyRule(req, res) {
  if (!objectId(req.params.id)) throw fail('Rule ID is invalid.');
  const rule = await AutoReplyRule.findOne({ _id: req.params.id, ownerId: req.user._id, archivedAt: null }).lean();
  if (!rule) throw fail('Rule not found.', 404);
  res.json({ rule });
}

export async function updateAutoReplyRule(req, res) {
  if (!objectId(req.params.id)) throw fail('Rule ID is invalid.');
  const rule = await AutoReplyRule.findOne({ _id: req.params.id, ownerId: req.user._id, archivedAt: null });
  if (!rule) throw fail('Rule not found.', 404);

  const b = req.body || {};
  if (b.name !== undefined) rule.name = String(b.name).trim();
  if (b.triggerKeyword !== undefined) rule.triggerKeyword = String(b.triggerKeyword).trim().toUpperCase();
  if (b.synonyms !== undefined) {
    rule.synonyms = Array.isArray(b.synonyms) ? b.synonyms.map(s => String(s).trim().toUpperCase()).filter(Boolean) : [];
  }
  if (b.matchType !== undefined && ['EXACT_MATCH', 'WHOLE_WORD', 'CONTAINS'].includes(b.matchType)) {
    rule.matchType = b.matchType;
  }
  if (b.actionType !== undefined) rule.actionType = b.actionType;
  if (b.responseMessage !== undefined) rule.responseMessage = String(b.responseMessage);
  if (b.priority !== undefined) rule.priority = Number(b.priority) || 10;
  if (b.enabled !== undefined) rule.enabled = Boolean(b.enabled);
  if (b.cooldownSeconds !== undefined) rule.cooldownSeconds = Math.max(0, Number(b.cooldownSeconds) || 15);

  await rule.save();
  res.json({ rule });
}

export async function deleteAutoReplyRule(req, res) {
  if (!objectId(req.params.id)) throw fail('Rule ID is invalid.');
  const rule = await AutoReplyRule.findOneAndUpdate(
    { _id: req.params.id, ownerId: req.user._id, archivedAt: null },
    { $set: { archivedAt: new Date(), enabled: false } },
    { new: true }
  );
  if (!rule) throw fail('Rule not found.', 404);
  res.json({ deleted: true });
}

export async function activateRule(req, res) {
  if (!objectId(req.params.id)) throw fail('Rule ID is invalid.');
  const rule = await AutoReplyRule.findOneAndUpdate(
    { _id: req.params.id, ownerId: req.user._id, archivedAt: null },
    { $set: { enabled: true } },
    { new: true }
  );
  if (!rule) throw fail('Rule not found.', 404);
  res.json({ rule });
}

export async function deactivateRule(req, res) {
  if (!objectId(req.params.id)) throw fail('Rule ID is invalid.');
  const rule = await AutoReplyRule.findOneAndUpdate(
    { _id: req.params.id, ownerId: req.user._id, archivedAt: null },
    { $set: { enabled: false } },
    { new: true }
  );
  if (!rule) throw fail('Rule not found.', 404);
  res.json({ rule });
}

export async function testSingleRule(req, res) {
  if (!objectId(req.params.id)) throw fail('Rule ID is invalid.');
  const rule = await AutoReplyRule.findOne({ _id: req.params.id, ownerId: req.user._id, archivedAt: null }).lean();
  if (!rule) throw fail('Rule not found.', 404);

  const text = String(req.body?.text || '').trim();
  const matchResult = matchKeyword(text, rule.triggerKeyword, rule.synonyms, rule.matchType);

  res.json({
    ruleId: rule._id,
    ruleName: rule.name,
    inputText: text,
    matched: matchResult.matched,
    matchedKeyword: matchResult.matchedKeyword,
    proposedAction: rule.actionType,
    responsePreview: rule.responseMessage || null
  });
}

export async function testMatchAllRules(req, res) {
  const text = String(req.body?.text || '').trim();
  if (!text) throw fail('Text to test is required.');

  const rules = await AutoReplyRule.find({
    ownerId: req.user._id,
    enabled: true,
    archivedAt: null
  }).sort({ priority: 1, createdAt: 1 }).lean();

  let matchedRule = null;
  let matchedKeyword = '';

  for (const rule of rules) {
    const resCheck = matchKeyword(text, rule.triggerKeyword, rule.synonyms, rule.matchType);
    if (resCheck.matched) {
      matchedRule = rule;
      matchedKeyword = resCheck.matchedKeyword;
      break;
    }
  }

  res.json({
    inputText: text,
    matched: Boolean(matchedRule),
    matchedRule: matchedRule ? {
      _id: matchedRule._id,
      name: matchedRule.name,
      triggerKeyword: matchedRule.triggerKeyword,
      priority: matchedRule.priority,
      actionType: matchedRule.actionType,
      responseMessage: matchedRule.responseMessage,
      matchedKeyword
    } : null
  });
}

export async function ruleExecutionHistory(req, res) {
  const ownerId = req.user._id;
  const filter = { ownerId };
  if (req.query.conversationId && objectId(req.query.conversationId)) {
    filter.conversationId = req.query.conversationId;
  }
  const records = await RuleExecution.find(filter)
    .sort({ createdAt: -1 })
    .limit(50)
    .populate('conversationId', 'status source')
    .populate('contactId', 'fullName phoneNumber')
    .lean();

  res.json({ records, total: records.length });
}
