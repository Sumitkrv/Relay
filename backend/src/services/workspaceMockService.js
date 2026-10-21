import crypto from 'node:crypto';
import mongoose from 'mongoose';
import Workspace from '../models/Workspace.js';
import Contact from '../models/Contact.js';
import Conversation from '../models/Conversation.js';
import ConversationMessage from '../models/ConversationMessage.js';
import Message from '../models/Message.js';
import Campaign from '../models/Campaign.js';
import AutoReplyRule from '../models/AutoReplyRule.js';
import MessageTemplate from '../models/MessageTemplate.js';
import ConsentRecord from '../models/ConsentRecord.js';
import RuleExecution from '../models/RuleExecution.js';
import { recordMessageEvent } from './messageEventService.js';
import mockWhatsAppProvider from './mockWhatsAppProvider.js';
import { industryRegistry } from '../config/industries/industryRegistry.js';
import { matchKeyword, interpolateVariables } from './autoReplyRuleService.js';

export class WorkspaceMockError extends Error {
  constructor(message, status = 400, code = 'MOCK_SIMULATION_ERROR') {
    super(message);
    this.name = 'WorkspaceMockError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Get comprehensive Mock connection status and statistics for a workspace.
 */
export async function getWorkspaceMockStatus(workspace) {
  if (!workspace || !workspace._id) {
    throw new WorkspaceMockError('Valid workspace context required.', 400, 'MISSING_WORKSPACE');
  }

  const wsId = workspace._id;
  const isPaused = workspace.metadata?.mockConnectionStatus === 'MOCK_PAUSED';
  const connectionStatus = isPaused ? 'MOCK_PAUSED' : 'MOCK_ACTIVE';

  // Aggregate metrics scoped authoritatively to this workspace
  const [
    simulatedCampaigns,
    totalSimulatedMessages,
    simulatedSent,
    simulatedDelivered,
    simulatedRead,
    simulatedFailed,
    totalConversations,
    activeRulesCount,
    demoContactsCount,
  ] = await Promise.all([
    Campaign.countDocuments({ workspaceId: wsId, executionMode: 'MOCK' }),
    Message.countDocuments({ workspaceId: wsId, providerMode: 'MOCK' }),
    Message.countDocuments({ workspaceId: wsId, status: 'SIMULATED_SENT' }),
    Message.countDocuments({ workspaceId: wsId, status: 'SIMULATED_DELIVERED' }),
    Message.countDocuments({ workspaceId: wsId, status: 'SIMULATED_READ' }),
    Message.countDocuments({ workspaceId: wsId, status: { $in: ['TEMPORARY_FAILURE', 'PERMANENT_FAILURE', 'BLOCKED'] } }),
    Conversation.countDocuments({ workspaceId: wsId }),
    AutoReplyRule.countDocuments({ workspaceId: wsId, enabled: true, archivedAt: null }),
    Contact.countDocuments({ workspaceId: wsId, isDemo: true }),
  ]);

  return {
    workspaceId: wsId.toString(),
    workspaceName: workspace.name,
    industryKey: workspace.industryKey || 'other',
    mode: 'MOCK',
    providerName: 'Relay WhatsApp Simulator',
    providerVersion: mockWhatsAppProvider.version,
    status: connectionStatus,
    senderId: `mock_sender_${wsId.toString()}`,
    senderIdentifier: `mock_sender_${wsId.toString()}`,
    senderName: `${workspace.name} (Relay Simulator)`,
    officialMetaConnected: false,
    liveSendingAllowed: false,
    safeguardsActive: true,
    lastActivityAt: workspace.updatedAt || new Date(),
    availableScenarios: [
      { id: 'NORMAL_DELIVERY', name: 'Normal Delivery', description: 'Simulate successful dispatch and delivery' },
      { id: 'READ_RECEIPT', name: 'Read Receipt', description: 'Simulate contact reading the message' },
      { id: 'TEMPORARY_FAILURE', name: 'Temporary Carrier Failure', description: 'Simulate transient retryable upstream error' },
      { id: 'PERMANENT_FAILURE', name: 'Permanent Failure', description: 'Simulate unregistered phone number' },
      { id: 'INBOUND_REPLY', name: 'Inbound Customer Reply', description: 'Simulate customer sending a message to Inbox' },
    ],
    metrics: {
      simulatedCampaigns,
      totalSimulatedMessages,
      simulatedSent,
      simulatedDelivered,
      simulatedRead,
      simulatedFailed,
      totalConversations,
      activeRulesCount,
      demoContactsCount,
    },
    disclaimer: 'Mock Mode — No real WhatsApp messages are sent. All events are internal simulations.',
  };
}

/**
 * Toggle workspace mock connection status (e.g. MOCK_ACTIVE vs MOCK_PAUSED).
 */
export async function toggleWorkspaceMockConnection(workspace, newStatus) {
  if (!['MOCK_ACTIVE', 'MOCK_PAUSED'].includes(newStatus)) {
    throw new WorkspaceMockError('Invalid status. Permitted: MOCK_ACTIVE, MOCK_PAUSED', 400, 'INVALID_STATUS');
  }

  const updatedMetadata = {
    ...(workspace.metadata || {}),
    mockConnectionStatus: newStatus,
    mockStatusUpdatedAt: new Date(),
  };

  workspace.metadata = updatedMetadata;
  await Workspace.updateOne({ _id: workspace._id }, { $set: { metadata: updatedMetadata } });

  return {
    workspaceId: workspace._id.toString(),
    status: newStatus,
    updatedAt: new Date(),
  };
}

/**
 * Two-way Inbox simulation: Ingest an incoming simulated customer message,
 * route to workspace conversation, and trigger auto-reply keyword pipeline.
 */
export async function simulateInboundMessage({
  workspace,
  contactPhone,
  contactName,
  messageBody,
  contactId = null,
  user = {},
}) {
  if (!workspace || !workspace._id) {
    throw new WorkspaceMockError('Workspace context required.', 400, 'MISSING_WORKSPACE');
  }
  if (!messageBody || !messageBody.trim()) {
    throw new WorkspaceMockError('Message body cannot be empty.', 400, 'EMPTY_MESSAGE_BODY');
  }

  const cleanBody = messageBody.trim().slice(0, 1000);
  const normalizedPhone = (contactPhone || '+919999000001').trim();
  const name = (contactName || 'Test Customer').trim().slice(0, 80);

  // 1. Resolve or create synthetic contact in this workspace
  let contact = null;
  if (contactId && mongoose.isObjectIdOrHexString(contactId)) {
    contact = await Contact.findOne({ _id: contactId, workspaceId: workspace._id });
  }
  if (!contact) {
    contact = await Contact.findOne({ phoneNumber: normalizedPhone, workspaceId: workspace._id });
  }
  if (!contact) {
    contact = await Contact.create({
      workspaceId: workspace._id,
      ownerId: workspace.createdBy || user._id,
      fullName: name,
      phoneNumber: normalizedPhone,
      leadSource: 'INBOUND_SIMULATOR',
      isDemo: true,
      tags: ['demo', 'inbound-simulator'],
      whatsappConsentStatus: 'Opted In',
    });
  }

  // 2. Resolve or create Conversation thread
  let conversation = await Conversation.findOne({
    workspaceId: workspace._id,
    contactId: contact._id,
  });

  const now = new Date();
  if (!conversation) {
    conversation = await Conversation.create({
      workspaceId: workspace._id,
      ownerId: workspace.createdBy || user._id,
      contactId: contact._id,
      status: 'Open',
      lastActivityAt: now,
      lastInboundAt: now,
      internalUnreadCount: 1,
    });
  } else {
    conversation.lastActivityAt = now;
    conversation.lastInboundAt = now;
    conversation.internalUnreadCount = (conversation.internalUnreadCount || 0) + 1;
    if (conversation.status === 'Resolved' || conversation.status === 'Closed') {
      conversation.status = 'Open';
    }
    await conversation.save();
  }

  // 3. Save incoming ConversationMessage
  const providerMessageId = `mock_msg_inbound_${crypto.randomBytes(8).toString('hex')}`;
  const inboundMessage = await ConversationMessage.create({
    ownerId: workspace.createdBy || user._id,
    workspaceId: workspace._id,
    conversationId: conversation._id,
    contactId: contact._id,
    direction: 'inbound',
    messageType: 'text',
    messageSource: 'synthetic_test',
    trustLevel: 'synthetic',
    providerMessageId,
    messageBody: cleanBody,
    providerStatus: 'Delivered',
    simulationStatus: 'Simulated Success',
    occurredAt: now,
    receivedAt: now,
  });

  // 4. Evaluate Auto-Reply Pipeline
  const trace = [
    `Inbound message received: "${cleanBody.slice(0, 50)}"`,
    `Routed to workspace: ${workspace.name} (${workspace._id})`,
    `Conversation thread active (${conversation._id})`,
  ];

  let replyMessage = null;
  let matchedRule = null;
  let triggeredKeyword = '';
  let suppressionOutcome = null;

  // A. Check Manual Takeover
  if (conversation.automationStatus === 'PAUSED') {
    trace.push('Manual takeover active: auto-reply was paused by operator.');
    await RuleExecution.create({
      ownerId: workspace.createdBy || user._id,
      workspaceId: workspace._id,
      conversationId: conversation._id,
      contactId: contact._id,
      messageId: inboundMessage._id,
      actionType: 'PAUSED_TAKEOVER',
      executionMode: 'SYNTHETIC_TEST',
      status: 'PAUSED_TAKEOVER',
      reason: 'Manual takeover active on conversation',
    });
  } else {
    // B. Check STOP / Opt-out Suppression Keyword
    const stopKeywords = ['STOP', 'UNSUBSCRIBE', 'CANCEL', 'QUIT', 'END', 'OPTOUT'];
    const upperText = cleanBody.toUpperCase().trim();
    const isStopTrigger = stopKeywords.some((kw) => upperText === kw || upperText.startsWith(`${kw} `) || upperText.endsWith(` ${kw}`));

    if (isStopTrigger) {
      suppressionOutcome = 'OPTED_OUT';
      trace.push('STOP keyword matched. Enforcing authoritative compliance suppression.');

      await ConsentRecord.create({
        ownerId: workspace.createdBy || user._id,
        contactId: contact._id,
        status: 'Opted Out',
        consentSource: 'synthetic_test_stop',
        consentPurpose: 'All WhatsApp updates',
        evidenceReference: `Inbound simulation STOP: "${cleanBody.slice(0, 100)}"`,
        consentCapturedAt: now,
        recordedBy: workspace.createdBy || user._id,
      });

      contact.isSuppressed = true;
      contact.suppressionReason = 'WhatsApp STOP simulation (demo)';
      contact.whatsappConsentStatus = 'Opted Out';
      await contact.save();

      const stopResponseText = 'You have been unsubscribed from WhatsApp updates. Reply START anytime to re-enable.';
      replyMessage = await ConversationMessage.create({
        ownerId: workspace.createdBy || user._id,
        workspaceId: workspace._id,
        conversationId: conversation._id,
        contactId: contact._id,
        direction: 'outbound',
        messageType: 'text',
        messageSource: 'mock_simulation',
        trustLevel: 'synthetic',
        providerMessageId: `mock_msg_optout_${crypto.randomBytes(8).toString('hex')}`,
        messageBody: stopResponseText,
        providerStatus: 'Sent',
        simulationStatus: 'Simulated Success',
        occurredAt: new Date(now.getTime() + 100),
      });

      trace.push('Dispatched mock opt-out confirmation message.');
    } else {
      // C. Match Active Workspace Auto-Reply Rules
      const rules = await AutoReplyRule.find({
        $or: [
          { workspaceId: workspace._id, enabled: true, archivedAt: null },
          { ownerId: workspace.createdBy, workspaceId: null, enabled: true, archivedAt: null },
        ],
      }).sort({ priority: 1, createdAt: 1 });

      trace.push(`Loaded ${rules.length} active auto-reply rules for priority matching.`);

      for (const rule of rules) {
        const matchRes = matchKeyword(cleanBody, rule.triggerKeyword, rule.synonyms || [], rule.matchType || 'WHOLE_WORD');
        if (matchRes.matched) {
          matchedRule = rule;
          triggeredKeyword = matchRes.matchedKeyword;
          trace.push(`Matched rule: "${rule.name}" via keyword "${triggeredKeyword}" (Priority: ${rule.priority}).`);
          break;
        }
      }

      if (matchedRule) {
        // Interpolate variables
        const responseText = interpolateVariables(
          matchedRule.responseMessage || 'Thank you for contacting us! We will assist you shortly.',
          contact,
          { businessName: workspace.name, ...user }
        );

        replyMessage = await ConversationMessage.create({
          ownerId: workspace.createdBy || user._id,
          workspaceId: workspace._id,
          conversationId: conversation._id,
          contactId: contact._id,
          direction: 'outbound',
          messageType: 'text',
          messageSource: 'mock_simulation',
          trustLevel: 'synthetic',
          providerMessageId: `mock_msg_reply_${crypto.randomBytes(8).toString('hex')}`,
          messageBody: responseText,
          providerStatus: 'Sent',
          simulationStatus: 'Simulated Success',
          occurredAt: new Date(now.getTime() + 150),
        });

        await RuleExecution.create({
          ownerId: workspace.createdBy || user._id,
          workspaceId: workspace._id,
          conversationId: conversation._id,
          contactId: contact._id,
          messageId: inboundMessage._id,
          ruleId: matchedRule._id,
          ruleName: matchedRule.name,
          matchedKeyword: triggeredKeyword,
          actionType: matchedRule.actionType,
          executionMode: 'SYNTHETIC_TEST',
          status: 'SUCCESS',
          replyMessageId: replyMessage._id,
        });

        trace.push(`Prepared and persisted simulated automated response.`);
      } else {
        trace.push('No keyword rules matched incoming text.');
      }
    }
  }

  return {
    success: true,
    workspaceId: workspace._id.toString(),
    conversationId: conversation._id.toString(),
    inboundMessage,
    inboundMessageId: inboundMessage._id.toString(),
    replyMessage,
    autoReply: replyMessage && suppressionOutcome !== 'OPTED_OUT' ? {
      ruleName: matchedRule?.name,
      responseBody: replyMessage.messageBody,
    } : null,
    matchedRule: matchedRule ? { id: matchedRule._id, name: matchedRule.name, keyword: triggeredKeyword } : null,
    triggeredKeyword,
    suppressionOutcome,
    trace,
  };
}

/**
 * Message lifecycle scenario simulation:
 * Advances a Message through DELIVERED, READ, or simulated failure.
 */
export async function simulateMessageScenario({ workspace, messageId, scenario }) {
  if (!workspace || !workspace._id) {
    throw new WorkspaceMockError('Workspace context required.', 400, 'MISSING_WORKSPACE');
  }

  const validScenarios = ['DELIVERED', 'READ', 'TEMPORARY_FAILURE', 'PERMANENT_FAILURE'];
  if (!validScenarios.includes(scenario)) {
    throw new WorkspaceMockError(`Scenario must be one of: ${validScenarios.join(', ')}`, 400, 'INVALID_SCENARIO');
  }

  const message = await Message.findOne({ _id: messageId, workspaceId: workspace._id });
  if (!message) {
    throw new WorkspaceMockError('Message not found in this workspace.', 404, 'MESSAGE_NOT_FOUND');
  }

  const now = new Date();
  let newStatus = message.status;
  let updateFields = {};

  if (scenario === 'DELIVERED') {
    newStatus = 'SIMULATED_DELIVERED';
    updateFields = {
      status: newStatus,
      simulatedDeliveredAt: now,
      deliveredAt: now,
    };
  } else if (scenario === 'READ') {
    newStatus = 'SIMULATED_READ';
    updateFields = {
      status: newStatus,
      simulatedDeliveredAt: message.simulatedDeliveredAt || now,
      simulatedReadAt: now,
      readAt: now,
    };
  } else if (scenario === 'TEMPORARY_FAILURE') {
    newStatus = 'TEMPORARY_FAILURE';
    updateFields = {
      status: newStatus,
      failureCode: 'MOCK_TEMPORARY_FAILURE',
      failureReason: 'Simulated transient carrier timeout',
      nextRetryAt: new Date(now.getTime() + 10000),
    };
  } else if (scenario === 'PERMANENT_FAILURE') {
    newStatus = 'PERMANENT_FAILURE';
    updateFields = {
      status: newStatus,
      failureCode: 'MOCK_PERMANENT_FAILURE',
      failureReason: 'Simulated recipient number not registered on WhatsApp',
      completedAt: now,
    };
  }

  await Message.updateOne({ _id: message._id }, { $set: updateFields });

  // Update associated ConversationMessage if linked
  if (message.providerMessageId) {
    await ConversationMessage.updateMany(
      { providerMessageId: message.providerMessageId, workspaceId: workspace._id },
      { $set: { providerStatus: scenario === 'READ' ? 'Read' : scenario === 'DELIVERED' ? 'Delivered' : 'Failed' } }
    );
  }

  // Record audit event
  const eventTypeMap = {
    DELIVERED: 'SIMULATED_DELIVERED',
    READ: 'SIMULATED_READ',
    TEMPORARY_FAILURE: 'MOCK_SEND_FAILED',
    PERMANENT_FAILURE: 'MOCK_DELIVERY_FAILED',
  };

  await recordMessageEvent({
    ownerId: message.ownerId,
    workspaceId: workspace._id,
    messageId: message._id,
    eventType: eventTypeMap[scenario] || 'SIMULATED_STATUS_UPDATED',
    previousStatus: message.status,
    newStatus,
    source: 'workspace_mock_simulator',
    attemptNumber: message.attemptCount || 1,
    correlationId: message.correlationId,
    safeMetadata: { scenario, workspaceId: workspace._id.toString() },
  });

  return {
    messageId: message._id.toString(),
    previousStatus: message.status,
    newStatus,
    scenario,
    updatedAt: now,
  };
}

/**
 * Dry-run test of automation rules:
 * Validates how a message would match active rules without mutating the database.
 */
export async function dryRunAutomationTest({ workspace, messageBody, contactId = null }) {
  if (!workspace || !workspace._id) {
    throw new WorkspaceMockError('Workspace context required.', 400, 'MISSING_WORKSPACE');
  }
  if (!messageBody || !messageBody.trim()) {
    throw new WorkspaceMockError('Message text required for testing.', 400, 'EMPTY_TEXT');
  }

  const cleanBody = messageBody.trim();
  const trace = [`Received test string: "${cleanBody}"`];

  // 1. Check STOP
  const stopKeywords = ['STOP', 'UNSUBSCRIBE', 'CANCEL', 'QUIT', 'END', 'OPTOUT'];
  const upper = cleanBody.toUpperCase().trim();
  const isStop = stopKeywords.some((kw) => upper === kw || upper.startsWith(`${kw} `) || upper.endsWith(` ${kw}`));

  if (isStop) {
    trace.push('COMPLIANCE MATCH: Text triggers STOP opt-out suppression.');
    return {
      matched: true,
      isStopSuppression: true,
      rule: {
        name: 'STOP & Opt-out Compliance (System Safeguard)',
        priority: 0,
        actionType: 'RECORD_OPT_OUT',
      },
      triggeredKeyword: 'STOP',
      responseText: 'You have been unsubscribed from WhatsApp updates.',
      trace,
    };
  }

  // 2. Load active workspace rules
  const rules = await AutoReplyRule.find({
    $or: [
      { workspaceId: workspace._id, enabled: true, archivedAt: null },
      { ownerId: workspace.createdBy, workspaceId: null, enabled: true, archivedAt: null },
    ],
  }).sort({ priority: 1, createdAt: 1 });

  trace.push(`Evaluating against ${rules.length} active rules...`);

  let matchedRule = null;
  let triggeredKeyword = '';

  for (const rule of rules) {
    const res = matchKeyword(cleanBody, rule.triggerKeyword, rule.synonyms || [], rule.matchType || 'WHOLE_WORD');
    if (res.matched) {
      matchedRule = rule;
      triggeredKeyword = res.matchedKeyword;
      trace.push(`MATCH FOUND: Rule "${rule.name}" triggered on "${triggeredKeyword}" (${rule.matchType})`);
      break;
    }
  }

  if (!matchedRule) {
    trace.push('No active rules matched the test message.');
    return {
      matched: false,
      isStopSuppression: false,
      rule: null,
      triggeredKeyword: '',
      responseText: '',
      trace,
    };
  }

  // Variable preview
  let sampleContact = { fullName: 'Sample Contact', city: 'Gurugram' };
  if (contactId && mongoose.isObjectIdOrHexString(contactId)) {
    const c = await Contact.findOne({ _id: contactId, workspaceId: workspace._id }).lean();
    if (c) sampleContact = c;
  }

  const responseText = interpolateVariables(
    matchedRule.responseMessage || '',
    sampleContact,
    { businessName: workspace.name }
  );

  trace.push('Personalization tokens interpolated into response.');

  return {
    matched: true,
    matchFound: true,
    isStopSuppression: false,
    rule: {
      id: matchedRule._id.toString(),
      name: matchedRule.name,
      priority: matchedRule.priority,
      actionType: matchedRule.actionType,
      matchType: matchedRule.matchType,
    },
    matchedRule,
    triggeredKeyword,
    responseText,
    renderedReply: responseText,
    trace,
  };
}

/**
 * Idempotently setup sample demo data for a workspace tailored to its vertical.
 */
export async function setupWorkspaceDemoData({ workspace, user }) {
  if (!workspace || !workspace._id) {
    throw new WorkspaceMockError('Workspace context required.', 400, 'MISSING_WORKSPACE');
  }

  const wsId = workspace._id;
  const ownerId = workspace.createdBy || user._id;
  const industryKey = workspace.industryKey || 'other';

  // 1. Check idempotency: if demo contacts already exist, return existing status
  const existingDemoCount = await Contact.countDocuments({ workspaceId: wsId, isDemo: true });
  if (existingDemoCount > 0) {
    return {
      alreadyProvisioned: true,
      message: 'Demo dataset already provisioned in this workspace.',
      counts: {
        demoContacts: existingDemoCount,
      },
    };
  }

  // 2. Seed 3 vertical-tailored synthetic contacts
  const contactsData = getIndustryDemoContacts(industryKey, wsId, ownerId);
  const createdContacts = await Contact.insertMany(contactsData);

  // 3. Seed 1 sample vertical template
  const templatePresets = industryRegistry.getIndustryTemplateSuggestions(industryKey);
  const samplePreset = templatePresets[0] || {
    title: 'Welcome & Introduction',
    body: 'Hello {{customer_name}}, thank you for reaching out to {{business_name}}!',
    categoryIntent: 'marketing',
  };

  const template = await MessageTemplate.create({
    ownerId,
    workspaceId: wsId,
    name: `${samplePreset.title} (Demo)`,
    body: samplePreset.body,
    category: 'Marketing',
    localStatus: 'Draft',
    providerStatus: 'Not Submitted',
    mockProviderApprovalStatus: 'Simulated Approved',
    language: 'en',
    tags: ['demo'],
  });

  // 4. Seed sample vertical auto-reply rules (top presets for vertical)
  const autoPresets = industryRegistry.getIndustryAutomationPresets(industryKey);
  const presetsToSeed = autoPresets.length > 0 ? autoPresets.slice(0, 2) : [
    {
      displayName: 'Info Auto-reply',
      triggerKeywords: ['INFO'],
      matchType: 'contains',
      suggestedResponse: 'Thank you for contacting {{business_name}}! Here is our information.',
      priority: 10,
    }
  ];

  const createdRules = [];
  for (const sampleAuto of presetsToSeed) {
    const primaryKw = (sampleAuto.triggerKeywords[0] || 'INFO').toUpperCase();
    const synonyms = (sampleAuto.triggerKeywords.slice(1) || []).map((k) => k.toUpperCase());

    const createdRule = await AutoReplyRule.create({
      ownerId,
      workspaceId: wsId,
      name: `${sampleAuto.displayName} (Demo)`,
      triggerKeyword: primaryKw,
      synonyms,
      matchType: sampleAuto.matchType === 'exact' ? 'EXACT_MATCH' : 'CONTAINS',
      actionType: 'RUN_MOCK_REPLY',
      responseMessage: sampleAuto.suggestedResponse,
      enabled: true, // Enabled for the sample demo
      priority: sampleAuto.priority || 10,
    });
    createdRules.push(createdRule);
  }

  // 5. Seed 1 sample conversation with first contact
  const firstContact = createdContacts[0];
  const now = new Date();
  const conversation = await Conversation.create({
    ownerId,
    workspaceId: wsId,
    contactId: firstContact._id,
    status: 'Open',
    lastActivityAt: now,
    lastInboundAt: now,
    source: 'synthetic_test',
  });

  await ConversationMessage.create({
    ownerId,
    workspaceId: wsId,
    conversationId: conversation._id,
    contactId: firstContact._id,
    direction: 'inbound',
    messageType: 'text',
    messageSource: 'synthetic_test',
    trustLevel: 'synthetic',
    providerMessageId: `mock_demo_in_${Date.now()}`,
    messageBody: `Hi, I am interested in ${industryKey === 'gym' ? 'membership' : industryKey === 'salon' ? 'services' : 'information'}.`,
    occurredAt: now,
    receivedAt: now,
  });

  await ConversationMessage.create({
    ownerId,
    workspaceId: wsId,
    conversationId: conversation._id,
    contactId: firstContact._id,
    direction: 'outbound',
    messageType: 'text',
    messageSource: 'mock_simulation',
    trustLevel: 'synthetic',
    providerMessageId: `mock_demo_out_${Date.now()}`,
    messageBody: `Hello ${firstContact.fullName || 'there'}! Thank you for your interest in ${workspace.name}.`,
    simulationStatus: 'Simulated Success',
    providerStatus: 'Delivered',
    occurredAt: new Date(now.getTime() + 100),
  });

  return {
    alreadyProvisioned: false,
    message: 'Sample demo dataset successfully created for this workspace.',
    created: {
      contactsCount: createdContacts.length,
      templateId: template._id.toString(),
      ruleId: createdRules[0]?._id?.toString() || null,
      rulesCount: createdRules.length,
      conversationId: conversation._id.toString(),
    },
  };
}

/**
 * Safely reset and clean up demo records inside this workspace only.
 * Guaranteed never to touch genuine customer records or other workspaces.
 */
export async function resetWorkspaceDemoData({ workspace, user }) {
  if (!workspace || !workspace._id) {
    throw new WorkspaceMockError('Workspace context required.', 400, 'MISSING_WORKSPACE');
  }

  const wsId = workspace._id;

  // 1. Find all demo contacts in this workspace
  const demoContacts = await Contact.find({
    workspaceId: wsId,
    $or: [{ isDemo: true }, { tags: 'demo' }],
  }).select('_id').lean();
  const demoContactIds = demoContacts.map((c) => c._id);

  // 2. Find demo conversations
  const demoConvs = await Conversation.find({
    workspaceId: wsId,
    $or: [
      { contactId: { $in: demoContactIds } },
      { source: { $in: ['test', 'synthetic_test'] } },
    ],
  }).select('_id').lean();
  const demoConvIds = demoConvs.map((c) => c._id);

  // 3. Perform scoped safe deletions
  const [
    delMessages,
    delConvs,
    delConsent,
    delContacts,
    delCampaigns,
    delRules,
  ] = await Promise.all([
    ConversationMessage.deleteMany({
      workspaceId: wsId,
      $or: [
        { conversationId: { $in: demoConvIds } },
        { messageSource: { $in: ['synthetic_test', 'mock_simulation'] } },
      ],
    }),
    Conversation.deleteMany({ workspaceId: wsId, _id: { $in: demoConvIds } }),
    ConsentRecord.deleteMany({ workspaceId: wsId, contactId: { $in: demoContactIds } }),
    Contact.deleteMany({ workspaceId: wsId, _id: { $in: demoContactIds } }),
    Campaign.deleteMany({ workspaceId: wsId, isDemo: true }),
    AutoReplyRule.deleteMany({ workspaceId: wsId, name: /Demo\)$/ }),
  ]);

  return {
    success: true,
    deleted: {
      contacts: delContacts.deletedCount,
      conversations: delConvs.deletedCount,
      messages: delMessages.deletedCount,
      consentRecords: delConsent.deletedCount,
      campaigns: delCampaigns.deletedCount,
      rules: delRules.deletedCount,
    },
    message: 'Demo dataset cleared safely. Genuine business records remain intact.',
  };
}

function getIndustryDemoContacts(industryKey, workspaceId, ownerId) {
  const common = {
    workspaceId,
    ownerId,
    isDemo: true,
    tags: ['demo', 'synthetic'],
    whatsappConsentStatus: 'Opted In',
    leadSource: 'DEMO_PROVISIONING',
  };

  switch (industryKey) {
    case 'gym':
      return [
        { ...common, fullName: 'Aarav Patel (Demo Member)', phoneNumber: '+919999000001', industryData: { membershipInterest: 'annual', fitnessProgram: 'strength' } },
        { ...common, fullName: 'Priya Sharma (Demo Trial)', phoneNumber: '+919999000002', industryData: { membershipInterest: 'monthly', trialSessionInterest: true } },
        { ...common, fullName: 'Karan Mehra (Demo Yoga)', phoneNumber: '+919999000003', industryData: { membershipInterest: 'quarterly', fitnessProgram: 'yoga' } },
      ];
    case 'salon':
      return [
        { ...common, fullName: 'Ananya Roy (Demo Client)', phoneNumber: '+919999000001', industryData: { serviceInterest: 'haircut', preferredAppointmentTime: 'evening' } },
        { ...common, fullName: 'Rohan Kapoor (Demo Grooming)', phoneNumber: '+919999000002', industryData: { serviceInterest: 'package', packageInterest: 'bridal' } },
        { ...common, fullName: 'Mira Sethi (Demo Spa)', phoneNumber: '+919999000003', industryData: { serviceInterest: 'spa' } },
      ];
    case 'clinic':
      return [
        { ...common, fullName: 'Vikram Joshi (Demo Patient)', phoneNumber: '+919999000001', industryData: { serviceInterest: 'consultation', preferredEnquiryTime: 'morning' } },
        { ...common, fullName: 'Sunita Rao (Demo Followup)', phoneNumber: '+919999000002', industryData: { serviceInterest: 'checkup', serviceCategory: 'clinic_visit' } },
        { ...common, fullName: 'David Dsouza (Demo Enquiry)', phoneNumber: '+919999000003', industryData: { serviceInterest: 'screening' } },
      ];
    case 'education':
      return [
        { ...common, fullName: 'Aditya Gupta (Demo Student)', phoneNumber: '+919999000001', industryData: { courseInterest: 'jee_prep', learningMode: 'classroom' } },
        { ...common, fullName: 'Sneha Verma (Demo Parent)', phoneNumber: '+919999000002', industryData: { courseInterest: 'foundation', batchPreference: 'weekend' } },
        { ...common, fullName: 'Tarun Malik (Demo Online)', phoneNumber: '+919999000003', industryData: { courseInterest: 'coding', learningMode: 'online' } },
      ];
    case 'automobile':
      return [
        { ...common, fullName: 'Rajesh Nair (Demo Buyer)', phoneNumber: '+919999000001', industryData: { vehicleModelInterest: 'SUV Prime', testDriveInterest: true } },
        { ...common, fullName: 'Simran Kaur (Demo Sedan)', phoneNumber: '+919999000002', industryData: { vehicleCategory: 'sedan', purchaseTimeframe: 'immediate' } },
        { ...common, fullName: 'Amitabh Sen (Demo EV)', phoneNumber: '+919999000003', industryData: { vehicleCategory: 'ev' } },
      ];
    case 'real_estate':
    default:
      return [
        { ...common, fullName: 'Rahul Verma (Demo Buyer)', phoneNumber: '+919999000001', interestedPropertyType: 'Apartment', interestedProject: 'Skyline Heights', budgetRange: '₹1Cr - ₹2.5Cr' },
        { ...common, fullName: 'Pooja Agarwal (Demo Villa)', phoneNumber: '+919999000002', interestedPropertyType: 'Villa', interestedProject: 'Green Valley', budgetRange: 'Above ₹5Cr' },
        { ...common, fullName: 'Manish Tyagi (Demo Plot)', phoneNumber: '+919999000003', interestedPropertyType: 'Residential Plot', budgetRange: '₹50L - ₹1Cr' },
      ];
  }
}
