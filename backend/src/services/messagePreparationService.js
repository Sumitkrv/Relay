import crypto from 'node:crypto';
import Contact from '../models/Contact.js';
import ConsentRecord from '../models/ConsentRecord.js';
import Message from '../models/Message.js';
import MessageTemplate, { TemplateVersion } from '../models/MessageTemplate.js';
import User from '../models/User.js';
import { resolveTemplate } from '../utils/templateEngine.js';
import { recordMessageEvent } from './messageEventService.js';

const PHONE_REGEX = /^\+[1-9]\d{7,14}$/;

const norm = v => String(v || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/**
 * Evaluates whether a contact is eligible for a specific messaging request.
 * Enforces affirmative opt-in, evidence audit, business name matching, purpose matching,
 * and suppression / opt-out / DNC rules.
 */
export async function evaluateRecipientEligibility(contact, user, { purpose = '', isSyntheticTest = false } = {}) {
  if (!contact) {
    return { eligible: false, failureCode: 'INVALID_CONTACT', reason: 'Contact record does not exist or was deleted.' };
  }

  if (contact.isDeleted || contact.isArchived) {
    return {
      eligible: false,
      failureCode: 'INVALID_CONTACT',
      reason: contact.isDeleted ? 'Contact is marked as deleted.' : 'Contact is archived.'
    };
  }

  const phone = contact.phoneNumber || '';
  if (!PHONE_REGEX.test(phone)) {
    return {
      eligible: false,
      failureCode: 'INVALID_PHONE',
      reason: `Phone number "${phone}" is not in valid international E.164 format (e.g. +919876543210).`
    };
  }

  // Check opt-out / DNC status on contact
  if (contact.whatsappConsentStatus === 'Opted Out') {
    return { eligible: false, failureCode: 'CONTACT_OPTED_OUT', reason: 'Contact has explicitly opted out of WhatsApp messaging.' };
  }

  if (contact.isSuppressed || contact.leadStatus === 'Do Not Contact' || contact.tags?.includes('do-not-contact') || contact.tags?.includes('dnc')) {
    return { eligible: false, failureCode: 'DO_NOT_CONTACT', reason: 'Contact is marked as Do Not Contact.' };
  }

  // If this is a synthetic test in isolated test harness, we still enforce consent unless explicitly permitted
  const latestConsent = await ConsentRecord.findOne({
    ownerId: contact.ownerId,
    contactId: contact._id
  }).sort({ recordedAt: -1, _id: -1 }).lean();

  if (latestConsent?.status === 'Opted Out') {
    return { eligible: false, failureCode: 'CONTACT_OPTED_OUT', reason: 'Most recent consent audit record indicates opt-out.' };
  }

  if (contact.whatsappConsentStatus !== 'Opted In') {
    return {
      eligible: false,
      failureCode: 'MISSING_CONSENT',
      reason: contact.whatsappConsentStatus === 'Pending'
        ? 'WhatsApp consent is pending confirmation.'
        : 'Contact has unknown or unconfirmed WhatsApp messaging consent.'
    };
  }

  // Verify evidence-backed audit record
  if (!latestConsent || latestConsent.status !== 'Opted In') {
    return {
      eligible: false,
      failureCode: 'MISSING_CONSENT',
      reason: 'No affirmative opt-in record found in the consent audit trail.'
    };
  }

  if (!latestConsent.consentSource || !latestConsent.evidenceReference) {
    return {
      eligible: false,
      failureCode: 'MISSING_CONSENT',
      reason: 'Consent record lacks verifiable audit source or evidence reference.'
    };
  }

  if (!latestConsent.consentCapturedAt || new Date(latestConsent.consentCapturedAt) > new Date()) {
    return {
      eligible: false,
      failureCode: 'MISSING_CONSENT',
      reason: 'Consent capture timestamp is invalid or recorded in the future.'
    };
  }

  // Workspace business name check
  const workspaceBiz = norm(user?.businessName);
  const consentedBiz = norm(latestConsent.consentedBusinessName);
  if (!workspaceBiz || consentedBiz !== workspaceBiz) {
    return {
      eligible: false,
      failureCode: 'MISSING_CONSENT',
      reason: `Consent was recorded for "${latestConsent.consentedBusinessName || 'unknown'}", which does not match active workspace "${user?.businessName}".`
    };
  }

  // Purpose matching if purpose is provided
  if (purpose) {
    const targetPurpose = norm(purpose);
    const recordedPurpose = norm(latestConsent.consentPurpose);
    if (!recordedPurpose.includes(targetPurpose) && !targetPurpose.includes(recordedPurpose)) {
      return {
        eligible: false,
        failureCode: 'MISSING_CONSENT',
        reason: `Recorded consent purpose "${latestConsent.consentPurpose}" does not cover the requested message purpose "${purpose}".`
      };
    }
  }

  return { eligible: true, failureCode: null, reason: null, latestConsent };
}

/**
 * Prepares a durable message intent, renders variables, validates eligibility,
 * and records message + audit events in MongoDB.
 */
export async function prepareMessageIntent({
  ownerId,
  contactId,
  templateId,
  templateVersionId,
  campaignId = null,
  campaignRunId = null,
  campaignJobId = null,
  purpose = '',
  scheduledAt = null,
  idempotencyKey = null,
  correlationId = null,
  metadata = {},
  bypassConsentForTest = false // Development-only transport test harness flag
}) {
  const generatedCorrId = correlationId || `corr_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const generatedIdempKey = idempotencyKey || `${ownerId}:${campaignRunId || 'direct'}:${contactId}:${purpose || 'msg'}`;

  // 1. Idempotency Check: if message already exists with this idempotencyKey and ownerId, return it!
  const existing = await Message.findOne({ ownerId, idempotencyKey: generatedIdempKey });
  if (existing) {
    return { message: existing, isExisting: true };
  }

  // 2. Fetch Contact and User
  const [contact, user] = await Promise.all([
    Contact.findOne({ _id: contactId, ownerId }).lean(),
    User.findById(ownerId).select('name businessName businessPhone website phone').lean()
  ]);

  if (!contact) {
    const err = new Error('Contact not found or does not belong to this workspace.');
    err.status = 404;
    err.code = 'INVALID_CONTACT';
    throw err;
  }

  // 3. Fetch Template and pinned TemplateVersion
  let template = null;
  let version = null;

  if (templateId) {
    template = await MessageTemplate.findOne({ _id: templateId, ownerId }).lean();
    if (!template) {
      const err = new Error('Message template not found.');
      err.status = 404;
      err.code = 'TEMPLATE_NOT_FOUND';
      throw err;
    }

    if (templateVersionId) {
      version = await TemplateVersion.findOne({ _id: templateVersionId, templateId, ownerId }).lean();
    } else if (template.currentVersionId) {
      version = await TemplateVersion.findOne({ _id: template.currentVersionId, templateId, ownerId }).lean();
    }

    if (!version) {
      const err = new Error('Template version snapshot not found.');
      err.status = 404;
      err.code = 'TEMPLATE_VERSION_MISSING';
      throw err;
    }
  }

  // 4. Resolve Template Variables
  let renderedSnapshot = {
    header: '',
    headerType: version?.snapshot?.headerType || template?.headerType || 'NONE',
    body: '',
    footer: '',
    buttons: [],
    variables: {},
    mediaUrl: version?.snapshot?.headerMediaUrl || template?.headerMediaUrl || '',
    mediaType: version?.snapshot?.headerType || template?.headerType || 'NONE',
    mediaName: version?.snapshot?.headerMediaName || template?.headerMediaName || ''
  };

  let missingVariables = [];

  if (version?.snapshot) {
    const resolved = resolveTemplate(version.snapshot, contact, user);
    renderedSnapshot.header = resolved.header || '';
    renderedSnapshot.body = resolved.body || '';
    renderedSnapshot.footer = resolved.footer || '';
    renderedSnapshot.buttons = resolved.buttons || [];
    renderedSnapshot.variables = resolved.variables || [];
    missingVariables = resolved.missingVariables || [];
  }

  // 5. Evaluate Recipient Eligibility
  let eligibility = { eligible: true, failureCode: null, reason: null };
  if (!bypassConsentForTest) {
    eligibility = await evaluateRecipientEligibility(contact, user, { purpose });
  } else {
    // Even in bypass, phone must be valid E.164
    if (!PHONE_REGEX.test(contact.phoneNumber || '')) {
      eligibility = { eligible: false, failureCode: 'INVALID_PHONE', reason: 'Invalid phone format.' };
    }
  }

  // Check missing required variables
  if (eligibility.eligible && missingVariables.length > 0) {
    eligibility = {
      eligible: false,
      failureCode: 'UNRESOLVED_VARIABLE',
      reason: `Missing required personalization variables: ${missingVariables.join(', ')}.`
    };
  }

  // 6. Determine Initial Status
  let initialStatus = 'QUEUED';
  let failureCode = '';
  let failureReason = '';

  if (!eligibility.eligible) {
    initialStatus = 'BLOCKED';
    failureCode = eligibility.failureCode || 'BLOCKED';
    failureReason = eligibility.reason || 'Blocked by eligibility check.';
  } else if (scheduledAt && new Date(scheduledAt) > new Date()) {
    initialStatus = 'SCHEDULED';
  }

  const messageUniqueId = `msg_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;

  // 7. Create durable Message record
  const message = await Message.create({
    ownerId,
    messageId: messageUniqueId,
    contactId: contact._id,
    recipientPhone: contact.phoneNumber || '',
    recipientName: contact.fullName || '',
    campaignId,
    campaignRunId,
    campaignJobId,
    templateId: template?._id || null,
    templateVersionId: version?._id || null,
    templateVersion: version?.versionNumber || 1,
    channel: 'whatsapp',
    providerMode: 'MOCK',
    providerMessageId: '',
    messageDirection: 'outbound',
    renderedContentSnapshot: renderedSnapshot,
    mediaReferences: template?.headerMediaId ? [template.headerMediaId] : [],
    status: initialStatus,
    scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
    queuedAt: initialStatus === 'QUEUED' ? new Date() : null,
    failureCode,
    failureReason,
    attemptCount: 0,
    maxAttempts: 3,
    idempotencyKey: generatedIdempKey,
    correlationId: generatedCorrId,
    metadata
  });

  // 8. Record MessageEvents
  await recordMessageEvent({
    ownerId,
    messageId: message._id,
    eventType: 'MESSAGE_CREATED',
    previousStatus: '',
    newStatus: 'DRAFT',
    source: 'preparation_service',
    correlationId: generatedCorrId,
    safeMetadata: { purpose, templateName: template?.name }
  });

  await recordMessageEvent({
    ownerId,
    messageId: message._id,
    eventType: 'VALIDATION_COMPLETED',
    previousStatus: 'DRAFT',
    newStatus: initialStatus,
    source: 'eligibility_service',
    correlationId: generatedCorrId,
    safeMetadata: {
      eligible: eligibility.eligible,
      failureCode,
      missingVariables
    }
  });

  if (initialStatus === 'BLOCKED') {
    await recordMessageEvent({
      ownerId,
      messageId: message._id,
      eventType: 'MESSAGE_BLOCKED',
      previousStatus: 'VALIDATION_COMPLETED',
      newStatus: 'BLOCKED',
      source: 'eligibility_service',
      correlationId: generatedCorrId,
      safeMetadata: { failureCode, failureReason }
    });
  } else if (initialStatus === 'SCHEDULED') {
    await recordMessageEvent({
      ownerId,
      messageId: message._id,
      eventType: 'MESSAGE_SCHEDULED',
      previousStatus: 'VALIDATION_COMPLETED',
      newStatus: 'SCHEDULED',
      source: 'preparation_service',
      correlationId: generatedCorrId,
      safeMetadata: { scheduledAt }
    });
  } else if (initialStatus === 'QUEUED') {
    await recordMessageEvent({
      ownerId,
      messageId: message._id,
      eventType: 'MESSAGE_QUEUED',
      previousStatus: 'VALIDATION_COMPLETED',
      newStatus: 'QUEUED',
      source: 'preparation_service',
      correlationId: generatedCorrId
    });
  }

  return { message, isExisting: false };
}
