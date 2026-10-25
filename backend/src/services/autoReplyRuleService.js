import { valuesFor } from '../utils/templateEngine.js';
import Workspace from '../models/Workspace.js';
import { workspaceBusinessContext } from '../utils/workspaceBusinessContext.js';
import crypto from 'node:crypto';
import InboundRuleClaim from '../models/InboundRuleClaim.js';
import AutoReplyRule from '../models/AutoReplyRule.js';
import QuickReply from '../models/QuickReply.js';
import RuleExecution from '../models/RuleExecution.js';
import Conversation from '../models/Conversation.js';
import ConversationMessage from '../models/ConversationMessage.js';
import InternalNote from '../models/InternalNote.js';
import Contact from '../models/Contact.js';
import ConsentRecord from '../models/ConsentRecord.js';
import { writeActivity } from './inboxService.js';
import { getStrictIndustryConfig } from '../config/industries/industryRegistry.js';

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function matchKeyword(text, keyword, synonyms = [], matchType = 'WHOLE_WORD') {
  if (!text || typeof text !== 'string') return { matched: false, matchedKeyword: '' };
  const rawText = text.trim();
  const candidates = [keyword, ...(Array.isArray(synonyms) ? synonyms : [])].filter(Boolean);

  for (const candidate of candidates) {
    const cleanCand = candidate.trim();
    if (!cleanCand) continue;

    if (matchType === 'EXACT_MATCH') {
      if (rawText.toLowerCase() === cleanCand.toLowerCase()) {
        return { matched: true, matchedKeyword: cleanCand };
      }
    } else if (matchType === 'CONTAINS') {
      if (rawText.toLowerCase().includes(cleanCand.toLowerCase())) {
        return { matched: true, matchedKeyword: cleanCand };
      }
    } else {
      // WHOLE_WORD
      const rx = new RegExp(`(^|\\s|[^\\w])${escapeRegex(cleanCand)}($|\\s|[^\\w])`, 'i');
      if (rx.test(rawText)) {
        return { matched: true, matchedKeyword: cleanCand };
      }
    }
  }

  return { matched: false, matchedKeyword: '' };
}

export function interpolateVariables(templateText, contact = {}, user = {}) {
  if (!templateText) return '';
  const fullName = contact.fullName || 'Valued Client';
  const firstName = fullName.trim().split(/\s+/)[0] || 'Client';
  const city = contact.city || contact.location || 'Gurugram';
  const project = contact.interestedProject || contact.interestedService || contact.businessCategory || contact.location || 'our premium developments';
  const propertyType = contact.interestedPropertyType || contact.industry || 'Property';
  const businessName = user.businessName || 'M2W Luxury Realty';

  const vars = {
    name: fullName,
    first_name: firstName,
    city,
    project,
    property_type: propertyType,
    business_name: businessName
  };

  return templateText.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, token) => vars[token] || `{{${token}}}`);
}

export async function seedDefaultQuickReplies(ownerId) {
  const existingCount = await QuickReply.countDocuments({ ownerId, archivedAt: null });
  if (existingCount > 0) return;

  const defaults = [
    {
      ownerId,
      name: 'Brochure & Master Plan Link',
      category: 'Brochure',
      description: 'Quick link to project brochure and floor plans',
      messageText: 'Hi {{first_name}}, here is the digital brochure and floor layout plans for {{project}}: https://relaycrm.io/brochure/prestige-park. Let me know if you would like me to arrange a private walkthrough.'
    },
    {
      ownerId,
      name: 'Pricing & Flexible Payment Plan',
      category: 'Pricing',
      description: 'Overview of unit costs and installment options',
      messageText: 'Hi {{first_name}}, unit pricing at {{project}} starts at ₹1.25 Cr with possession-linked 20:80 flexible builder subvention plans. Which floor or facing are you most interested in?'
    },
    {
      ownerId,
      name: 'Experience Center & Site Visit',
      category: 'Site Visit',
      description: 'Invitation to visit sample apartment with timings',
      messageText: 'Hi {{first_name}}, our sample flat experience center is open 7 days a week from 10:00 AM to 7:00 PM in {{city}}. Would you prefer a weekday morning or weekend afternoon visit?'
    },
    {
      ownerId,
      name: 'Location & Key Connectivity',
      category: 'Location',
      description: 'Proximity to highways, metro, and airport',
      messageText: '{{project}} is strategically positioned on Golf Course Extension Road, just 5 minutes from Cyber City metro and 25 minutes from IGI Airport.'
    },
    {
      ownerId,
      name: 'Thank You & Callback Request',
      category: 'General',
      description: 'Polite acknowledgment and confirmation of interest',
      messageText: 'Thank you for reaching out to {{business_name}}, {{first_name}}. I am reviewing your enquiry details and will call you shortly.'
    }
  ];

  await QuickReply.insertMany(defaults);
}

export async function seedDefaultRules(ownerId) {
  const existingCount = await AutoReplyRule.countDocuments({ ownerId, archivedAt: null });
  if (existingCount > 0) return;

  const defaults = [
    {
      ownerId,
      name: 'STOP & Opt-out Compliance',
      triggerKeyword: 'STOP',
      synonyms: ['UNSUBSCRIBE', 'OPT OUT', 'STOP PROMOTIONS', 'CANCEL'],
      matchType: 'WHOLE_WORD',
      priority: 1, // Highest priority
      actionType: 'RECORD_OPT_OUT',
      responseMessage: 'You have been unsubscribed from WhatsApp property updates. Reply START anytime to re-enable notifications.',
      enabled: true
    },
    {
      ownerId,
      name: 'Brochure Request Auto-reply',
      triggerKeyword: 'BROCHURE',
      synonyms: ['FLOOR PLAN', 'LAYOUT', 'CATALOGUE', 'PDF'],
      matchType: 'WHOLE_WORD',
      priority: 10,
      actionType: 'RUN_MOCK_REPLY',
      responseMessage: 'Hi! Here is the latest project brochure and master layout plan: https://relaycrm.io/brochure/prestige-park. Let us know if you would like to schedule a site visit.',
      enabled: true
    },
    {
      ownerId,
      name: 'Price & Quotation Inquiry',
      triggerKeyword: 'PRICE',
      synonyms: ['PRICING', 'COST', 'RATE', 'BUDGET', 'QUOTATION'],
      matchType: 'WHOLE_WORD',
      priority: 15,
      actionType: 'RUN_MOCK_REPLY',
      responseMessage: 'Thank you for your interest in {{project}}! Pricing depends on unit configuration, layout, and current availability. Which unit type (e.g. 2BHK, 3BHK, Villa) are you exploring so we can share verified inventory pricing?',
      enabled: true
    },
    {
      ownerId,
      name: 'Site Visit Interest & Alert',
      triggerKeyword: 'VISIT',
      synonyms: ['SITE VISIT', 'APPOINTMENT', 'VISITING', 'TOUR', 'SAMPLE FLAT'],
      matchType: 'WHOLE_WORD',
      priority: 20,
      actionType: 'MARK_NEEDS_ATTENTION',
      responseMessage: 'We would love to show you the sample apartment! Our experience center is open 10 AM – 7 PM daily. Which day works best for you?',
      enabled: true
    }
  ];

  await AutoReplyRule.insertMany(defaults);
}

async function evaluateOnce({
  ownerId,
  workspaceId,
  conversationId,
  contactId,
  messageBody,
  messageId = null,
  user = {},
  executionMode = 'MOCK'
}) {
  const scope = { ownerId, ...(workspaceId ? { workspaceId } : {}) };
  const conversation = await Conversation.findOne({ _id: conversationId, ...scope });
  if (!conversation) return { matched: false, reason: 'Conversation not found' };

  if (conversation.workspaceId) {
    scope.workspaceId = conversation.workspaceId;
    const workspace = await Workspace.findById(conversation.workspaceId).lean();
    user = workspaceBusinessContext(user, workspace);
  }
  const complianceMatch = matchKeyword(messageBody, 'STOP', ['UNSUBSCRIBE', 'CANCEL', 'HALT', 'OPT-OUT'], 'WHOLE_WORD');

  // Consent handling always runs before manual takeover and marketing rules.
  // 1. Manual Takeover Check
  if (!complianceMatch.matched && conversation.automationStatus === 'PAUSED') {
    await RuleExecution.create({
      ...scope,
      conversationId,
      contactId,
      messageId,
      actionType: 'PAUSED_TAKEOVER',
      executionMode,
      status: 'PAUSED_TAKEOVER',
      reason: 'Owner has manual control; auto-reply was suspended'
    });
    return {
      matched: false,
      paused: true,
      reason: 'Owner has taken over conversation; automation paused'
    };
  }

  // 2. Fetch Active Rules in priority order (1 is top priority)
  const rulesQuery = conversation.workspaceId
    ? { workspaceId: conversation.workspaceId, enabled: true, archivedAt: null }
    : { ownerId, enabled: true, archivedAt: null };
  const rules = await AutoReplyRule.find(rulesQuery).sort({ priority: 1, createdAt: 1 });

  let matchedRule = complianceMatch.matched ? protectedOptOutRule() : null;
  let matchedKeyword = complianceMatch.matchedKeyword;

  for (const rule of rules) {
    if (complianceMatch.matched) break;
    if (rule.actionType === 'RECORD_OPT_OUT') continue;
    const res = matchKeyword(messageBody, rule.triggerKeyword, rule.synonyms, rule.matchType);
    if (res.matched) {
      matchedRule = rule;
      matchedKeyword = res.matchedKeyword;
      break;
    }
  }

  if (!matchedRule) {
    return { matched: false };
  }

  // 3. Cooldown Check (bypassed only in trusted server-side SYNTHETIC_TEST mode in non-production environments)
  const isTrustedSynthetic = executionMode === 'SYNTHETIC_TEST' && process.env.NODE_ENV !== 'production';
  if (!complianceMatch.matched && !isTrustedSynthetic && matchedRule.lastExecutedAt) {
    const diffSec = (Date.now() - new Date(matchedRule.lastExecutedAt).getTime()) / 1000;
    if (diffSec < (matchedRule.cooldownSeconds || 15)) {
      await RuleExecution.create({
        ...scope,
        conversationId,
        contactId,
        messageId,
        ruleId: complianceMatch.matched ? null : matchedRule._id,
        ruleName: matchedRule.name,
        matchedKeyword,
        actionType: matchedRule.actionType,
        executionMode: isTrustedSynthetic ? 'SYNTHETIC_TEST' : 'MOCK',
        status: 'COOLDOWN_SKIPPED',
        reason: `Triggered within cooldown (${Math.round(diffSec)}s / ${matchedRule.cooldownSeconds}s)`
      });
      return { matched: true, executed: false, action: matchedRule.actionType, actionType: matchedRule.actionType, reason: 'Cooldown active' };
    }
  }

  // 4. Contact Details
  const contact = await Contact.findOne({ _id: contactId, ...scope }).lean() || {};

  let replyMessage = null;
  let executionStatus = 'SUCCESS';
  let executionReason = '';

  // 5. Execute Action
  switch (matchedRule.actionType) {
    case 'RECORD_OPT_OUT': {
      // Isolate synthetic STOP testing: authentic customer consent records cannot be altered by synthetic tests
      const isDemoContact = Boolean(
        contact.isDemo ||
        contact.customFields?.isDemo ||
        contact.customFields?.isSyntheticDemo ||
        contact.tags?.includes('demo') ||
        contact.tags?.includes('inbound-simulator') ||
        contact.phoneNumber?.startsWith('+91981100') ||
        contact.phoneNumber?.startsWith('+91987650') ||
        contact.email?.endsWith('.test') ||
        contact.fullName?.toLowerCase().includes('synthetic') ||
        contact.fullName?.toLowerCase().includes('demo') ||
        contact.fullName?.toLowerCase().includes('test')
      );

      if (isTrustedSynthetic && !isDemoContact) {
        // Safe simulation: do not alter authentic customer consent record
        executionStatus = 'BLOCKED';
        executionReason = 'Simulated STOP opt-out on non-demo contact blocked to preserve authentic consent integrity';
      } else {
        // Authoritative consent record
        await ConsentRecord.create({
          ...scope,
          contactId,
          status: 'Opted Out',
          consentSource: isTrustedSynthetic ? 'synthetic_test_stop' : 'inbound_stop',
          consentPurpose: 'All WhatsApp updates',
          evidenceReference: `Inbound STOP message: "${messageBody.slice(0, 100)}"`,
          consentCapturedAt: new Date(),
          recordedBy: ownerId
        });

        // Update Contact suppression
        await Contact.findOneAndUpdate({ _id: contactId, ...scope }, {
          isSuppressed: true,
          suppressionReason: isTrustedSynthetic ? 'WhatsApp STOP simulation (demo)' : 'WhatsApp STOP request',
          whatsappConsentStatus: 'Opted Out'
        });

        // Update Conversation labels
        if (!conversation.labels.includes('Opted Out')) {
          conversation.labels.push('Opted Out');
          await conversation.save();
        }
      }

      // Send confirmation reply
      if (executionStatus === 'BLOCKED') break;
      const replyText = interpolateVariables(matchedRule.responseMessage, contact, user);
      replyMessage = await ConversationMessage.create({
        ...scope,
        conversationId,
        contactId,
        direction: 'outbound',
        messageType: 'text',
        messageSource: executionMode === 'SYNTHETIC_TEST' ? 'synthetic_test' : 'mock_simulation',
        trustLevel: executionMode === 'SYNTHETIC_TEST' ? 'synthetic' : 'unverified',
        messageBody: replyText,
        providerStatus: 'Unavailable',
        simulationStatus: 'Simulated Success',
        occurredAt: new Date()
      });

      await writeActivity({
        conversation,
        eventType: 'opt_out_recorded',
        eventSource: 'auto_reply_engine',
        metadata: { rule: matchedRule.name, trigger: matchedKeyword },
        performedBy: ownerId
      });
      break;
    }

    case 'MARK_NEEDS_ATTENTION': {
      conversation.status = 'Needs Attention';
      if (!conversation.labels.includes('Needs Attention')) {
        conversation.labels.push('Needs Attention');
      }
      await conversation.save();

      // Log internal note
      await InternalNote.create({
        ...scope,
        contactId,
        conversationId,
        content: `[Auto-reply: ${matchedRule.name}] Client sent "${matchedKeyword}". Marked Needs Attention for owner follow-up.`,
        createdBy: ownerId,
        updatedBy: ownerId
      });

      // Optionally send acknowledgment reply
      if (matchedRule.responseMessage) {
        const rendered = interpolateVariables(matchedRule.responseMessage, contact, user);
        replyMessage = await ConversationMessage.create({
          ...scope,
          conversationId,
          contactId,
          direction: 'outbound',
          messageType: 'text',
          messageSource: executionMode === 'SYNTHETIC_TEST' ? 'synthetic_test' : 'mock_simulation',
          trustLevel: executionMode === 'SYNTHETIC_TEST' ? 'synthetic' : 'unverified',
          messageBody: rendered,
          providerStatus: 'Unavailable',
          simulationStatus: 'Simulated Success',
          occurredAt: new Date()
        });
      }

      await writeActivity({
        conversation,
        eventType: 'status_changed',
        eventSource: 'auto_reply_engine',
        metadata: { to: 'Needs Attention', rule: matchedRule.name },
        performedBy: ownerId
      });
      break;
    }

    case 'RUN_MOCK_REPLY':
    case 'PREPARE_QUICK_REPLY': {
      const replyTemplate = matchedRule.responseMessage || 'Thank you for reaching out!';
      const rendered = interpolateVariables(replyTemplate, contact, user);

      replyMessage = await ConversationMessage.create({
        ...scope,
        conversationId,
        contactId,
        direction: 'outbound',
        messageType: 'text',
        messageSource: executionMode === 'SYNTHETIC_TEST' ? 'synthetic_test' : 'mock_simulation',
        trustLevel: executionMode === 'SYNTHETIC_TEST' ? 'synthetic' : 'unverified',
        messageBody: rendered,
        providerStatus: 'Unavailable',
        simulationStatus: 'Simulated Success',
        occurredAt: new Date()
      });

      await writeActivity({
        conversation,
        eventType: 'auto_reply_sent',
        eventSource: 'auto_reply_engine',
        metadata: { rule: matchedRule.name, trigger: matchedKeyword },
        performedBy: ownerId
      });
      break;
    }

    case 'CREATE_INTERNAL_NOTE': {
      await InternalNote.create({
        ...scope,
        contactId,
        conversationId,
        content: `[Auto-reply: ${matchedRule.name}] Client message matched keyword "${matchedKeyword}".`,
        createdBy: ownerId,
        updatedBy: ownerId
      });
      break;
    }

    case 'PAUSE_AUTOMATION': {
      conversation.automationStatus = 'PAUSED';
      await conversation.save();
      await writeActivity({
        conversation,
        eventType: 'automation_paused',
        eventSource: 'auto_reply_engine',
        metadata: { rule: matchedRule.name },
        performedBy: ownerId
      });
      break;
    }

    default:
      executionStatus = 'FAILED';
      executionReason = `Unsupported action type: ${matchedRule.actionType}`;
      break;
  }

  // Update rule stats
  if (!complianceMatch.matched) {
    matchedRule.executionCount = (matchedRule.executionCount || 0) + 1;
    matchedRule.lastExecutedAt = new Date();
    await matchedRule.save();
  }

  // If a reply message was created, update conversation last message
  if (replyMessage) {
    conversation.lastMessageId = replyMessage._id;
    conversation.lastActivityAt = replyMessage.occurredAt;
    await conversation.save();
  }

  // Log execution
  const execution = await RuleExecution.create({
    ...scope,
    conversationId,
    contactId,
    messageId,
    ruleId: complianceMatch.matched ? null : matchedRule._id,
    ruleName: matchedRule.name,
    matchedKeyword,
    actionType: matchedRule.actionType,
    executionMode,
    status: executionStatus,
    reason: executionReason,
    replyMessageId: replyMessage?._id || null
  });

  return {
    matched: true,
    executed: true,
    rule: matchedRule,
    action: matchedRule.actionType,
    actionType: matchedRule.actionType,
    replyMessage,
    execution
  };
}

export function presetRecordId(kind, scopeId, key) {
  return crypto.createHash('sha256').update(`${kind}:${scopeId}:${key}`).digest('hex').slice(0, 24);
}

export function protectedOptOutRule() {
  return {
    _id: 'system-opt-out', name: 'Protected WhatsApp opt-out', triggerKeyword: 'STOP',
    synonyms: ['UNSUBSCRIBE', 'CANCEL', 'HALT', 'OPT-OUT'], matchType: 'WHOLE_WORD',
    actionType: 'RECORD_OPT_OUT', responseMessage: 'You have been unsubscribed from automated updates by {{business_name}}. Contact the business to record new consent.',
    priority: 0, enabled: true, executionCount: 0, isProtected: true,
  };
}

export async function evaluateInboundMessage(input) {
  if (!input.messageId) return evaluateOnce(input);
  const id = `${input.workspaceId || input.ownerId}:${input.messageId}`;
  try {
    await InboundRuleClaim.create({ _id: id, ownerId: input.ownerId, workspaceId: input.workspaceId });
  } catch (error) {
    if (error.code === 11000) return { matched: false, executed: false, duplicate: true, reason: 'Inbound event already processed.' };
    throw error;
  }
  try {
    const result = await evaluateOnce(input);
    await InboundRuleClaim.updateOne({ _id: id, ownerId: input.ownerId }, { $set: { status: 'COMPLETE' } });
    return result;
  } catch (error) {
    await InboundRuleClaim.updateOne({ _id: id, ownerId: input.ownerId }, { $set: { status: 'FAILED' } });
    throw error;
  }
}
