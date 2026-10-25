import crypto from 'node:crypto';
import Message from '../models/Message.js';
import MessageEvent from '../models/MessageEvent.js';
import Contact from '../models/Contact.js';
import MessageTemplate, { TemplateVersion } from '../models/MessageTemplate.js';
import User from '../models/User.js';
import { prepareMessageIntent } from './messagePreparationService.js';
import { processMessageJob, getQueueHealth } from './messageQueueService.js';
import { recordMessageEvent } from './messageEventService.js';

const fail = (message, status = 400, code = 'MESSAGE_ERROR') => {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
};

/**
 * Lists messages with server-side filters, search, and pagination.
 */
export async function listMessages(ownerId, {
  workspaceId = null,
  status = null,
  campaignId = null,
  campaignRunId = null,
  contactId = null,
  search = '',
  page = 1,
  limit = 25,
  sortBy = 'createdAt',
  sortOrder = -1
} = {}) {
  const q = { ownerId, ...(workspaceId ? { workspaceId } : {}) };

  if (status && status !== 'all') {
    q.status = status;
  }

  if (campaignId) {
    q.campaignId = campaignId;
  }

  if (campaignRunId) {
    q.campaignRunId = campaignRunId;
  }

  if (contactId) {
    q.contactId = contactId;
  }

  if (search && search.trim()) {
    const term = search.trim();
    q.$or = [
      { recipientName: { $regex: term, $options: 'i' } },
      { recipientPhone: { $regex: term, $options: 'i' } },
      { messageId: { $regex: term, $options: 'i' } },
      { 'renderedContentSnapshot.body': { $regex: term, $options: 'i' } }
    ];
  }

  const p = Math.max(1, Number(page) || 1);
  const l = Math.max(1, Math.min(100, Number(limit) || 25));

  const [records, total] = await Promise.all([
    Message.find(q)
      .populate('contactId', 'fullName phoneNumber email companyName city interestedPropertyType leadStatus')
      .populate('campaignId', 'name category status')
      .populate('templateId', 'name category language')
      .sort({ [sortBy]: sortOrder, _id: sortOrder })
      .skip((p - 1) * l)
      .limit(l)
      .lean(),
    Message.countDocuments(q)
  ]);

  return {
    records,
    total,
    page: p,
    limit: l,
    totalPages: Math.ceil(total / l)
  };
}

/**
 * Returns single message by ID with owner authorization check.
 */
export async function getMessage(messageId, ownerId, workspaceId = null) {
  const message = await Message.findOne({ _id: messageId, ownerId, ...(workspaceId ? { workspaceId } : {}) })
    .populate('contactId', 'fullName phoneNumber email city interestedPropertyType interestedProject')
    .populate('campaignId', 'name category')
    .populate('templateId', 'name category language')
    .lean();

  if (!message) {
    throw fail('Message not found or does not belong to this workspace.', 404, 'MESSAGE_NOT_FOUND');
  }

  return message;
}

/**
 * Manually retries a failed message if recipient is still eligible.
 */
export async function retryMessage(messageId, ownerId, workspaceId = null) {
  const message = await Message.findOne({ _id: messageId, ownerId, ...(workspaceId ? { workspaceId } : {}) });
  if (!message) {
    throw fail('Message not found.', 404, 'MESSAGE_NOT_FOUND');
  }

  if (!['TEMPORARY_FAILURE', 'PERMANENT_FAILURE'].includes(message.status)) {
    throw fail(`Cannot retry a message in status "${message.status}". Only failed messages can be retried.`, 409, 'INVALID_RETRY_STATE');
  }

  // Check contact eligibility before retry
  const contact = await Contact.findOne({ _id: message.contactId, ownerId, ...(message.workspaceId ? { workspaceId: message.workspaceId } : {}) }).lean();
  if (!contact || contact.isDeleted || contact.isArchived) {
    throw fail('Cannot retry: contact is deleted or archived.', 400, 'INVALID_CONTACT');
  }

  if (contact.whatsappConsentStatus === 'Opted Out') {
    throw fail('Cannot retry: contact has opted out of WhatsApp messaging.', 400, 'CONTACT_OPTED_OUT');
  }

  if (contact.leadStatus === 'Do Not Contact') {
    throw fail('Cannot retry: contact is marked as Do Not Contact.', 400, 'DO_NOT_CONTACT');
  }

  const previousStatus = message.status;
  message.status = 'QUEUED';
  message.failureCode = '';
  message.failureReason = '';
  message.nextRetryAt = null;
  message.leaseOwner = '';
  message.leaseUntil = null;
  message.queuedAt = new Date();
  await message.save();

  await recordMessageEvent({
    ownerId,
    messageId: message._id,
    eventType: 'MESSAGE_QUEUED',
    previousStatus,
    newStatus: 'QUEUED',
    source: 'manual_retry_api',
    attemptNumber: message.attemptCount + 1,
    correlationId: message.correlationId
  });

  return message;
}

/**
 * Cancels a pending or scheduled message.
 */
export async function cancelMessage(messageId, ownerId, reason = 'Cancelled by user', workspaceId = null) {
  const message = await Message.findOne({ _id: messageId, ownerId, ...(workspaceId ? { workspaceId } : {}) });
  if (!message) {
    throw fail('Message not found.', 404, 'MESSAGE_NOT_FOUND');
  }

  if (['SIMULATED_SENT', 'SIMULATED_DELIVERED', 'SIMULATED_READ'].includes(message.status)) {
    throw fail('Cannot cancel a completed message that has already been sent.', 409, 'CANNOT_CANCEL_SENT');
  }

  if (message.status === 'CANCELLED') {
    return message; // Idempotent cancel
  }

  const previousStatus = message.status;
  message.status = 'CANCELLED';
  message.failureCode = 'USER_CANCELLED';
  message.failureReason = reason;
  message.completedAt = new Date();
  message.leaseOwner = '';
  message.leaseUntil = null;
  await message.save();

  await recordMessageEvent({
    ownerId,
    messageId: message._id,
    eventType: 'MESSAGE_CANCELLED',
    previousStatus,
    newStatus: 'CANCELLED',
    source: 'cancel_api',
    attemptNumber: message.attemptCount,
    correlationId: message.correlationId,
    safeMetadata: { reason }
  });

  return message;
}

/**
 * Diagnostic test harness for developers and automated testing.
 */
export async function runMockDiagnosticScenario(scenario, ownerId) {
  const user = await User.findById(ownerId).lean();
  if (!user) throw fail('Owner user not found', 404);

  // 1. Create or find an isolated synthetic test contact
  const testPhone = `+919999${Math.floor(100000 + Math.random() * 900000)}`;
  const syntheticContact = await Contact.create({
    ownerId,
    fullName: `Test Recipient ${scenario.toUpperCase()}`,
    phoneNumber: testPhone,
    city: 'Mumbai',
    interestedPropertyType: '4 BHK Luxury Villa',
    interestedProject: 'Lodha Bellissimo',
    preferredLocation: 'Worli',
    budgetRange: '₹5 Cr - ₹7 Cr',
    whatsappConsentStatus: 'Opted In',
    isDemo: true
  });

  // Create isolated consent audit record for this contact
  const ConsentRecord = (await import('../models/ConsentRecord.js')).default;
  await ConsentRecord.create({
    ownerId,
    contactId: syntheticContact._id,
    phoneNumber: testPhone,
    status: 'Opted In',
    consentSource: 'website_form',
    evidenceReference: 'diag_test_consent_ref',
    consentedBusinessName: user.businessName || 'M2W Realty',
    consentPurpose: 'Property information and new launches',
    consentCapturedAt: new Date(),
    recordedBy: ownerId
  });

  // Find or create test template
  let template = await MessageTemplate.findOne({ ownerId, isArchived: false });
  let version = null;
  if (template) {
    version = await TemplateVersion.findOne({ templateId: template._id, ownerId });
  }

  const corrId = `diag_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const idempKey = `diag:${ownerId}:${scenario}:${syntheticContact._id}`;

  const outcomeMap = {
    success: null, // default
    temporary_failure: 'temporary_failure',
    permanent_failure: 'permanent_failure',
    timeout: 'timeout',
    rate_limit: 'rate_limit',
    worker_recovery: 'temporary_failure'
  };

  const forcedOutcome = outcomeMap[scenario] || null;

  // Prepare message intent
  const { message } = await prepareMessageIntent({
    ownerId,
    contactId: syntheticContact._id,
    templateId: template?._id || null,
    templateVersionId: version?._id || null,
    purpose: 'Property information and new launches',
    idempotencyKey: idempKey,
    correlationId: corrId,
    metadata: {
      isDiagnosticTest: true,
      diagnosticScenario: scenario,
      forceOutcome: forcedOutcome
    }
  });

  // Process message immediately through worker function
  let processSuccess = false;
  if (scenario === 'idempotency_verify') {
    // Attempt second preparation with same idempotency key
    const duplicateAttempt = await prepareMessageIntent({
      ownerId,
      contactId: syntheticContact._id,
      templateId: template?._id || null,
      templateVersionId: version?._id || null,
      purpose: 'Property information and new launches',
      idempotencyKey: idempKey,
      correlationId: `diag_second_${Date.now()}`
    });

    processSuccess = duplicateAttempt.isExisting === true && String(duplicateAttempt.message._id) === String(message._id);
    await processMessageJob(message._id, `diag-worker-${process.pid}`);
  } else {
    processSuccess = await processMessageJob(message._id, `diag-worker-${process.pid}`);
  }

  const finalMessage = await Message.findById(message._id).lean();
  const events = await MessageEvent.find({ messageId: message._id, ownerId }).sort({ timestamp: 1 }).lean();

  return {
    scenario,
    success: true,
    messageId: finalMessage.messageId,
    status: finalMessage.status,
    attemptCount: finalMessage.attemptCount,
    providerMessageId: finalMessage.providerMessageId || null,
    failureCode: finalMessage.failureCode || null,
    eventsCount: events.length,
    events: events.map(e => ({ eventType: e.eventType, previousStatus: e.previousStatus, newStatus: e.newStatus })),
    diagnosticsLog: `Scenario "${scenario}" executed. Final message state: ${finalMessage.status}.`
  };
}
