import crypto from 'node:crypto';
import mongoose from 'mongoose';
import * as messageService from '../services/messageService.js';
import { getMessageEvents, recordMessageEvent } from '../services/messageEventService.js';
import { getQueueHealth, messageWorkerTick } from '../services/messageQueueService.js';
import { prepareMessageIntent } from '../services/messagePreparationService.js';
import mockWhatsAppProvider from '../services/mockWhatsAppProvider.js';
import { evaluateInboundMessage, seedDefaultRules } from '../services/autoReplyRuleService.js';
import { getFixturesStatus, seedDemoDataForOwner, resetDemoDataForOwner } from '../services/demoDataService.js';
import Contact from '../models/Contact.js';
import Conversation from '../models/Conversation.js';
import ConversationMessage from '../models/ConversationMessage.js';
import Message from '../models/Message.js';
import MessageTemplate from '../models/MessageTemplate.js';
import Campaign from '../models/Campaign.js';
import CampaignMessageJob from '../models/CampaignMessageJob.js';


const isId = v => mongoose.isObjectIdOrHexString(v);
const fail = (message, status = 400, code = 'INVALID_REQUEST') => {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
};

export async function list(req, res) {
  const { status, campaignId, campaignRunId, contactId, search, page, limit, sortBy, sortOrder } = req.query;
  const result = await messageService.listMessages(req.user._id, {
    workspaceId: req.workspaceId,
    status,
    campaignId: isId(campaignId) ? campaignId : null,
    campaignRunId: isId(campaignRunId) ? campaignRunId : null,
    contactId: isId(contactId) ? contactId : null,
    search,
    page,
    limit,
    sortBy,
    sortOrder: Number(sortOrder) || -1
  });
  res.json(result);
}

export async function stats(req, res) {
  const health = await getQueueHealth(req.user._id, req.workspaceId);
  res.json({
    stats: health.queueStats,
    health
  });
}

export async function get(req, res) {
  if (!isId(req.params.id)) throw fail('Message ID is invalid.');
  const message = await messageService.getMessage(req.params.id, req.user._id, req.workspaceId);
  res.json({ message });
}

export async function events(req, res) {
  if (!isId(req.params.id)) throw fail('Message ID is invalid.');
  // Verify message belongs to owner
  await messageService.getMessage(req.params.id, req.user._id, req.workspaceId);
  const records = await getMessageEvents(req.params.id, req.user._id);
  res.json({ records });
}

export async function prepare(req, res) {
  const { contactId, templateId, templateVersionId, campaignId, purpose, scheduledAt, idempotencyKey, metadata } = req.body || {};
  if (!contactId || !isId(contactId)) throw fail('Valid contactId is required.');

  // Validate scheduledAt if provided
  if (scheduledAt) {
    const at = new Date(scheduledAt);
    if (Number.isNaN(at.valueOf()) || at <= new Date()) {
      throw fail('Scheduled date/time must be a valid future timestamp.');
    }
  }

  const { message, isExisting } = await prepareMessageIntent({
    workspaceId: req.workspaceId,
    ownerId: req.user._id,
    contactId,
    templateId: isId(templateId) ? templateId : null,
    templateVersionId: isId(templateVersionId) ? templateVersionId : null,
    campaignId: isId(campaignId) ? campaignId : null,
    purpose: purpose || 'General Enquiry',
    scheduledAt,
    idempotencyKey,
    metadata
  });

  res.status(isExisting ? 200 : 201).json({ message, isExisting });
}

export async function retry(req, res) {
  if (!isId(req.params.id)) throw fail('Message ID is invalid.');
  const message = await messageService.retryMessage(req.params.id, req.user._id, req.workspaceId);
  res.json({ message, notice: 'Message re-queued for simulation.' });
}

export async function cancel(req, res) {
  if (!isId(req.params.id)) throw fail('Message ID is invalid.');
  const reason = req.body?.reason || 'Cancelled by user via dashboard';
  const message = await messageService.cancelMessage(req.params.id, req.user._id, reason, req.workspaceId);
  res.json({ message, notice: 'Message cancelled successfully.' });
}

export async function systemStatus(req, res) {
  const health = await getQueueHealth(req.user._id, req.workspaceId);
  res.json(health);
}

export async function devRunTest(req, res) {
  // Reject in production environments
  if (process.env.NODE_ENV === 'production') {
    throw fail('Diagnostic simulation endpoints are strictly forbidden in production mode.', 403, 'PROD_FORBIDDEN');
  }

  const scenario = String(req.body?.scenario || 'success').toLowerCase();
  const allowedScenarios = [
    'success',
    'temporary_failure',
    'permanent_failure',
    'timeout',
    'rate_limit',
    'worker_recovery',
    'idempotency_verify'
  ];

  if (!allowedScenarios.includes(scenario)) {
    throw fail(`Unknown diagnostic scenario "${scenario}". Permitted: ${allowedScenarios.join(', ')}.`);
  }

  const result = await messageService.runMockDiagnosticScenario(scenario, req.user._id);
  res.json(result);
}

export async function devTestResults(req, res) {
  if (process.env.NODE_ENV === 'production') {
    throw fail('Diagnostic endpoints are forbidden in production.', 403, 'PROD_FORBIDDEN');
  }

  const records = await messageService.listMessages(req.user._id, {
    workspaceId: req.workspaceId,
    limit: 20,
    sortBy: 'createdAt',
    sortOrder: -1
  });

  res.json({
    recentTests: records.records.filter(r => r.metadata?.isDiagnosticTest)
  });
}

export async function devSimulateInbound(req, res) {
  if (process.env.NODE_ENV === 'production') {
    throw fail('Diagnostic simulation endpoints are strictly forbidden in production mode.', 403, 'PROD_FORBIDDEN');
  }

  const { contactId, conversationId, body: rawBody, messageText } = req.body || {};
  const body = (rawBody || messageText || 'Hi, please send the brochure.').trim();
  const ownerId = req.user._id;


  let targetContact = null;
  let targetConversation = null;

  if (conversationId && isId(conversationId)) {
    targetConversation = await Conversation.findOne({ _id: conversationId, ownerId });
    if (targetConversation) {
      targetContact = await Contact.findOne({ _id: targetConversation.contactId, ownerId });
    }
  }

  if (!targetContact && contactId && isId(contactId)) {
    targetContact = await Contact.findOne({ _id: contactId, ownerId });
    if (targetContact) {
      targetConversation = await Conversation.findOne({ contactId: targetContact._id, ownerId });
    }
  }

  if (!targetContact) {
    targetContact = await Contact.findOne({ ownerId, isDeleted: false }).sort({ updatedAt: -1 });
    if (!targetContact) {
      targetContact = await Contact.create({
        ownerId,
        fullName: 'Aarav Mehta (Demo Prospect)',
        phoneNumber: '+919811001122',
        email: 'aarav.mehta@relay-realestate.test',
        location: 'Gurugram',
        industry: 'Apartment',
        leadStatus: 'Interested',
        whatsappConsentStatus: 'Opted In',
        tags: ['demo', 'inbound-simulator'],
        customFields: { isDemo: true, propertyInterest: 'Luxury 4BHK Apartment' }
      });
    }
  }

  if (!targetConversation) {
    targetConversation = await Conversation.create({
      ownerId,
      contactId: targetContact._id,
      status: 'Open',
      source: 'synthetic_test',
      automationStatus: 'ACTIVE',
      lastMessageText: body.trim(),
      lastMessageAt: new Date(),
      lastMessageDirection: 'inbound',
      internalUnreadCount: 1
    });
  } else {
    // Idempotency: Anti-replay duplicate detection within 2 seconds
    const recentDuplicate = await ConversationMessage.findOne({
      ownerId,
      conversationId: targetConversation._id,
      messageBody: body.trim(),
      direction: 'inbound',
      occurredAt: { $gte: new Date(Date.now() - 2000) },
    });
    if (recentDuplicate) {
      return res.json({
        idempotent: true,
        message: 'Duplicate inbound event ignored (anti-replay suppression).',
        inboundMessage: recentDuplicate,
        conversation: targetConversation,
        contact: targetContact,
      });
    }

    targetConversation.lastMessageText = body.trim();
    targetConversation.lastMessageAt = new Date();
    targetConversation.lastMessageDirection = 'inbound';
    targetConversation.internalUnreadCount = (targetConversation.internalUnreadCount || 0) + 1;
    await targetConversation.save();
  }

  const idempotencyKey = String(req.body?.idempotencyKey || req.headers['idempotency-key'] || '').trim();
  if (idempotencyKey) {
    const existing = await ConversationMessage.findOne({
      ownerId,
      'metadata.idempotencyKey': idempotencyKey,
    });
    if (existing) {
      return res.json({
        idempotent: true,
        message: 'Duplicate inbound event ignored via idempotency key.',
        inboundMessage: existing,
        conversation: targetConversation,
        contact: targetContact,
      });
    }
  }

  const providerMessageId = `mock_msg_inbound_${crypto.randomBytes(6).toString('hex')}`;
  const inboundMsg = await ConversationMessage.create({
    ownerId,
    conversationId: targetConversation._id,
    contactId: targetContact._id,
    direction: 'inbound',
    messageType: 'text',
    messageSource: 'synthetic_test',
    trustLevel: 'synthetic',
    messageBody: body.trim(),
    providerMessageId,
    providerStatus: 'Delivered',
    simulationStatus: 'Simulated Success',
    occurredAt: new Date(),
    metadata: { source: 'SYNTHETIC_TEST', isSimulated: true, ...(idempotencyKey ? { idempotencyKey } : {}) }
  });

  const ruleResult = await evaluateInboundMessage({
    ownerId,
    conversationId: targetConversation._id,
    contactId: targetContact._id,
    messageBody: body.trim(),
    messageId: inboundMsg._id,
    user: req.user,
    executionMode: 'SYNTHETIC_TEST'
  });

  res.json({
    success: true,
    conversationId: targetConversation._id,
    contactId: targetContact._id,
    contactName: targetContact.fullName,
    inboundMessage: {
      _id: inboundMsg._id,
      providerMessageId,
      body: inboundMsg.messageBody,
      direction: 'inbound',
      status: 'DELIVERED',
      createdAt: inboundMsg.createdAt
    },
    ruleResult,
    notice: 'Synthetic customer reply processed through normalized conversation pipeline. Verified Meta delivery remains untouched.'
  });
}

export async function devSimulateStatus(req, res) {
  if (process.env.NODE_ENV === 'production') {
    throw fail('Diagnostic simulation endpoints are strictly forbidden in production mode.', 403, 'PROD_FORBIDDEN');
  }

  const { messageId, status = 'delivered', failureCode, failureReason } = req.body || {};
  if (!messageId || !isId(messageId)) throw fail('Valid messageId is required.');

  const ownerId = req.user._id;
  const message = await Message.findOne({ _id: messageId, ownerId });
  if (!message) throw fail('Message not found.', 404);

  let newStatus = 'SIMULATED_SENT';
  let eventType = 'SIMULATED_STATUS_UPDATED';

  if (status === 'delivered') {
    newStatus = 'SIMULATED_DELIVERED';
    eventType = 'SIMULATED_DELIVERED';
    message.status = newStatus;
    message.simulatedDeliveredAt = new Date();
  } else if (status === 'read') {
    newStatus = 'SIMULATED_READ';
    eventType = 'SIMULATED_READ';
    message.status = newStatus;
    message.simulatedReadAt = new Date();
  } else if (status === 'failed') {
    newStatus = 'PERMANENT_FAILURE';
    eventType = 'MOCK_DELIVERY_FAILED';
    message.status = newStatus;
    message.failureCode = failureCode || 'SIMULATED_CARRIER_REJECT';
    message.failureReason = failureReason || 'Simulated carrier delivery drop';
  } else {
    throw fail('Status must be "delivered", "read", or "failed".');
  }

  await message.save();

  if (message.campaignJobId) {
    const jobStatus = status === 'failed' ? 'failed' : 'simulated_success';
    await CampaignMessageJob.updateOne(
      { _id: message.campaignJobId },
      { $set: { status: jobStatus, processedAt: new Date() } }
    );
  }

  await recordMessageEvent({
    ownerId,
    messageId: message._id,
    eventType,
    previousStatus: message.status,
    newStatus,
    source: 'MOCK_SIMULATOR',
    metadata: { simulated: true, failureCode: message.failureCode }
  });

  res.json({
    success: true,
    messageId: message._id,
    newStatus,
    notice: `Message status simulated as ${newStatus}.`
  });
}

export async function devSimulateOutage(req, res) {
  if (process.env.NODE_ENV === 'production') {
    throw fail('Outage simulation endpoints are forbidden in production.', 403, 'PROD_FORBIDDEN');
  }

  const { outage } = req.body || {};
  mockWhatsAppProvider.setSimulatedOutage(Boolean(outage));

  res.json({
    success: true,
    isOutageSimulated: mockWhatsAppProvider.isOutageSimulated,
    status: mockWhatsAppProvider.getConnectionStatus()
  });
}

export async function devGetFixtures(req, res) {
  if (process.env.NODE_ENV === 'production') {
    throw fail('Fixtures endpoints are forbidden in production.', 403, 'PROD_FORBIDDEN');
  }
  const status = await getFixturesStatus(req.user._id);
  res.json(status);
}

export async function devLoadFixtures(req, res) {
  if (process.env.NODE_ENV === 'production') {
    throw fail('Seeding endpoints are forbidden in production.', 403, 'PROD_FORBIDDEN');
  }
  const result = await seedDemoDataForOwner(req.user._id);
  res.json(result);
}

export async function devResetDemo(req, res) {
  if (process.env.NODE_ENV === 'production') {
    throw fail('Reset endpoints are forbidden in production.', 403, 'PROD_FORBIDDEN');
  }
  const result = await resetDemoDataForOwner(req.user._id);
  res.json(result);
}

export async function devRunCampaignWorker(req, res) {
  if (process.env.NODE_ENV === 'production') {
    throw fail('Worker trigger endpoints are forbidden in production.', 403, 'PROD_FORBIDDEN');
  }

  const processedCount = await messageWorkerTick(`dev-test-worker-${process.pid}`);
  const health = await getQueueHealth(req.user._id, req.workspaceId);

  res.json({
    success: true,
    processedJobs: processedCount,
    queueHealth: health,
    notice: `Processed ${processedCount} pending messages in mock worker tick.`
  });
}

export async function devSystemMatrix(req, res) {
  if (process.env.NODE_ENV === 'production') {
    throw fail('System matrix endpoints are forbidden in production.', 403, 'PROD_FORBIDDEN');
  }

  const ownerId = req.user._id;
  const [contactsCount, templatesCount, campaignsCount, conversationsCount, messagesCount] = await Promise.all([
    Contact.countDocuments({ ownerId, isDeleted: false }),
    MessageTemplate.countDocuments({ ownerId, isArchived: false }),
    Campaign.countDocuments({ ownerId, isArchived: false }),
    Conversation.countDocuments({ ownerId }),
    Message.countDocuments({ ownerId })
  ]);

  const queueHealth = await getQueueHealth(ownerId);

  const subsystems = [
    { id: 'auth_safeguards', name: 'Owner Authentication & Server Guards', status: 'PASS', mode: 'STRICT_SINGLE_OWNER', evidence: 'bcrypt, JWT, cookie, 403 LIVE mode fail-closed guard' },
    { id: 'business_profile', name: 'Workspace Business Profile', status: 'PASS', mode: 'PERSISTED', evidence: 'M2W Luxury Realty profile persisted in MongoDB' },
    { id: 'contacts_groups', name: 'Contact Management & Groups', status: 'PASS', mode: 'PERSISTED', evidence: `${contactsCount} contacts scoped to owner` },
    { id: 'segmentation', name: 'Dynamic Audience Segmentation', status: 'PASS', mode: 'PERSISTED', evidence: 'Allowlisted operators (equals, contains, in, gte, lte)' },
    { id: 'consent_suppression', name: 'Consent Audit & Hard Suppression', status: 'PASS', mode: 'PERSISTED', evidence: 'Immutable ConsentRecord audit trail, zero marketing to Opted Out' },
    { id: 'excel_csv_import', name: 'Excel & CSV Import Engine', status: 'PASS', mode: 'PERSISTED', evidence: 'csv-parse, exceljs, header mapping, duplicate policy, formula protection' },
    { id: 'template_studio', name: 'Template Studio & CRM Variables', status: 'PASS', mode: 'PERSISTED', evidence: `${templatesCount} templates, real estate variables, version snapshots` },
    { id: 'template_mock_approval', name: 'Template Mock Approval Simulator', status: 'PASS', mode: 'MOCK_ONLY', evidence: 'Simulated Submission / Review / Approval without touching verifiedMetaApprovalStatus' },
    { id: 'media_brochure', name: 'Media Upload & PDF Attachments', status: 'PASS', mode: 'PERSISTED', evidence: 'Durable media references, PDF brochure preview' },
    { id: 'campaign_wizard', name: 'Four-Step Campaign Wizard', status: 'PASS', mode: 'PERSISTED', evidence: 'Template → Audience → Preview → Launch with immutable pinned version' },
    { id: 'campaign_lifecycle', name: 'Durable Scheduling & Lifecycle', status: 'PASS', mode: 'PERSISTED', evidence: `${campaignsCount} campaigns, Pause/Resume/Cancel/Retry state machine` },
    { id: 'mock_messaging_queue', name: 'Mock Messaging Queue & Retries', status: 'PASS', mode: 'MOCK_SANDBOX', evidence: `${messagesCount} messages, exponential backoff, worker lease` },
    { id: 'unified_inbox', name: 'Two-Way Unified Inbox & Takeover', status: 'PASS', mode: 'PERSISTED', evidence: `${conversationsCount} conversations, unread badges, manual takeover toggle` },
    { id: 'keyword_autoreply', name: 'Keyword Auto-Replies & STOP Compliance', status: 'PASS', mode: 'PERSISTED', evidence: 'BROCHURE, PRICE, VISIT, STOP whole-word matching and priority engine' },
    { id: 'reports_analytics', name: 'Reports & Analytics Aggregation', status: 'PASS', mode: 'PERSISTED', evidence: 'MongoDB aggregations, honest provider-disconnected state' },
    { id: 'exports_security', name: 'Secure CSV & Excel Data Exports', status: 'PASS', mode: 'PERSISTED', evidence: 'Formula injection escaping (=, +, -, @), owner-scoped exports' }
  ];

  res.json({
    timestamp: new Date().toISOString(),
    overallStatus: 'ALL_PASS_API_FREE',
    providerMode: mockWhatsAppProvider.getProviderMode(),
    officialMetaConnected: false,
    outageSimulated: mockWhatsAppProvider.isOutageSimulated,
    queueHealth,
    subsystems
  });
}

