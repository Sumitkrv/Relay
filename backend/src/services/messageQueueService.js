import Contact from '../models/Contact.js';
import ConsentRecord from '../models/ConsentRecord.js';
import Message from '../models/Message.js';
import CampaignExecution from '../models/CampaignExecution.js';
import CampaignMessageJob from '../models/CampaignMessageJob.js';
import ConversationMessage from '../models/ConversationMessage.js';
import Conversation from '../models/Conversation.js';
import Workspace from '../models/Workspace.js';
import mockWhatsAppProvider from './mockWhatsAppProvider.js';
import { recordMessageEvent } from './messageEventService.js';
import { evaluateRecipientEligibility } from './messagePreparationService.js';

let workerRunning = false;
let workerTimer = null;
let lastHeartbeat = null;
let isProcessingTick = false;
let recentErrors = [];

/**
 * Atomic processing of a single claimed Message.
 */
export async function processMessageJob(messageId, workerId = `msg-worker-${process.pid}`) {
  const now = new Date();

  // Atomically claim the message lease
  const message = await Message.findOneAndUpdate(
    {
      _id: messageId,
      $or: [
        { status: 'QUEUED' },
        { status: 'PROCESSING', leaseUntil: { $lt: now } }
      ]
    },
    {
      $set: {
        status: 'PROCESSING',
        leaseOwner: workerId,
        leaseUntil: new Date(Date.now() + 30000), // 30-second lease
        processingStartedAt: now
      },
      $inc: { attemptCount: 1 }
    },
    { new: true }
  );

  if (!message) return false;

  await recordMessageEvent({
    ownerId: message.ownerId,
    workspaceId: message.workspaceId,
    messageId: message._id,
    eventType: 'PROCESSING_STARTED',
    previousStatus: 'QUEUED',
    newStatus: 'PROCESSING',
    source: workerId,
    attemptNumber: message.attemptCount,
    correlationId: message.correlationId
  });

  // 0. Workspace Suspension Safety Check - pause dispatch without destroying jobs
  if (message.workspaceId) {
    const ws = await Workspace.findById(message.workspaceId).select('status');
    if (ws && ws.status === 'SUSPENDED') {
      await Message.updateOne(
        { _id: message._id, leaseOwner: workerId },
        {
          $set: {
            status: 'QUEUED',
            leaseOwner: '',
            leaseUntil: null,
            failureReason: 'Workspace is suspended. Message dispatch paused.'
          }
        }
      );
      return false;
    }
  }

  // 1. If linked to a CampaignExecution, verify execution is still running/queued
  let campaignExecution = null;
  if (message.campaignRunId) {
    campaignExecution = await CampaignExecution.findOne({
      _id: message.campaignRunId,
      ownerId: message.ownerId
    });

    if (!campaignExecution || campaignExecution.status === 'cancelled' || campaignExecution.cancelRequested) {
      await Message.updateOne(
        { _id: message._id, leaseOwner: workerId },
        {
          $set: {
            status: 'CANCELLED',
            failureCode: 'CAMPAIGN_CANCELLED',
            failureReason: 'Campaign execution was cancelled by user.',
            leaseOwner: '',
            leaseUntil: null,
            completedAt: new Date()
          }
        }
      );
      await recordMessageEvent({
        ownerId: message.ownerId,
        messageId: message._id,
        eventType: 'MESSAGE_CANCELLED',
        previousStatus: 'PROCESSING',
        newStatus: 'CANCELLED',
        source: 'campaign_cancellation',
        attemptNumber: message.attemptCount,
        correlationId: message.correlationId
      });
      return true;
    }

    if (campaignExecution.status === 'paused') {
      // Revert to QUEUED and release lease
      await Message.updateOne(
        { _id: message._id, leaseOwner: workerId },
        {
          $set: {
            status: 'QUEUED',
            leaseOwner: '',
            leaseUntil: null
          }
        }
      );
      return false;
    }
  }

  // 2. Final Recipient Eligibility Recheck (Right before provider dispatch)
  const contact = await Contact.findOne({
    _id: message.contactId,
    ownerId: message.ownerId
  }).lean();

  if (!contact || contact.isDeleted || contact.isArchived) {
    await Message.updateOne(
      { _id: message._id, leaseOwner: workerId },
      {
        $set: {
          status: 'BLOCKED',
          failureCode: 'INVALID_CONTACT',
          failureReason: contact?.isDeleted ? 'Contact was deleted before dispatch.' : 'Contact record is missing.',
          leaseOwner: '',
          leaseUntil: null,
          completedAt: new Date()
        }
      }
    );
    await recordMessageEvent({
      ownerId: message.ownerId,
      messageId: message._id,
      eventType: 'MESSAGE_BLOCKED',
      previousStatus: 'PROCESSING',
      newStatus: 'BLOCKED',
      source: 'final_eligibility_recheck',
      attemptNumber: message.attemptCount,
      correlationId: message.correlationId,
      safeMetadata: { reason: 'Contact unavailable' }
    });
    return true;
  }

  // Check if contact has opted out or become DNC during scheduling/queueing
  if (contact.whatsappConsentStatus === 'Opted Out') {
    await Message.updateOne(
      { _id: message._id, leaseOwner: workerId },
      {
        $set: {
          status: 'BLOCKED',
          failureCode: 'CONTACT_OPTED_OUT',
          failureReason: 'Contact opted out of WhatsApp messaging before dispatch.',
          leaseOwner: '',
          leaseUntil: null,
          completedAt: new Date()
        }
      }
    );
    await recordMessageEvent({
      ownerId: message.ownerId,
      messageId: message._id,
      eventType: 'MESSAGE_BLOCKED',
      previousStatus: 'PROCESSING',
      newStatus: 'BLOCKED',
      source: 'final_eligibility_recheck',
      attemptNumber: message.attemptCount,
      correlationId: message.correlationId,
      safeMetadata: { reason: 'Contact opted out' }
    });
    return true;
  }

  if (contact.isSuppressed || contact.leadStatus === 'Do Not Contact' || contact.tags?.includes('do-not-contact') || contact.tags?.includes('dnc')) {
    await Message.updateOne(
      { _id: message._id, leaseOwner: workerId },
      {
        $set: {
          status: 'BLOCKED',
          failureCode: 'DO_NOT_CONTACT',
          failureReason: 'Contact is marked as Do Not Contact.',
          leaseOwner: '',
          leaseUntil: null,
          completedAt: new Date()
        }
      }
    );
    await recordMessageEvent({
      ownerId: message.ownerId,
      messageId: message._id,
      eventType: 'MESSAGE_BLOCKED',
      previousStatus: 'PROCESSING',
      newStatus: 'BLOCKED',
      source: 'final_eligibility_recheck',
      attemptNumber: message.attemptCount,
      correlationId: message.correlationId,
      safeMetadata: { reason: 'Do Not Contact' }
    });
    return true;
  }

  // 3. Dispatch to MockWhatsAppProvider
  let result;
  try {
    result = await mockWhatsAppProvider.sendMessage({
      recipientPhone: message.recipientPhone,
      recipientName: message.recipientName,
      renderedContent: message.renderedContentSnapshot,
      metadata: message.metadata
    }, {
      forceOutcome: message.metadata?.forceOutcome
    });
  } catch (err) {
    result = {
      success: false,
      status: 'TEMPORARY_FAILURE',
      error: err.message,
      failureCode: 'MOCK_EXCEPTION',
      retryable: true
    };
  }

  // 4. Handle Mock Provider Result
  const finishedAt = new Date();

  if (result.success) {
    // Simulated Success
    await Message.updateOne(
      { _id: message._id, leaseOwner: workerId },
      {
        $set: {
          status: 'SIMULATED_SENT',
          providerMessageId: result.providerMessageId,
          simulatedSentAt: finishedAt,
          completedAt: finishedAt,
          leaseOwner: '',
          leaseUntil: null,
          failureCode: '',
          failureReason: ''
        }
      }
    );

    await recordMessageEvent({
      ownerId: message.ownerId,
      workspaceId: message.workspaceId,
      messageId: message._id,
      eventType: 'MOCK_SEND_SUCCEEDED',
      previousStatus: 'PROCESSING',
      newStatus: 'SIMULATED_SENT',
      source: workerId,
      attemptNumber: message.attemptCount,
      correlationId: message.correlationId,
      safeMetadata: { providerMessageId: result.providerMessageId }
    });

    await recordMessageEvent({
      ownerId: message.ownerId,
      workspaceId: message.workspaceId,
      messageId: message._id,
      eventType: 'MESSAGE_COMPLETED',
      previousStatus: 'SIMULATED_SENT',
      newStatus: 'SIMULATED_SENT',
      source: workerId,
      attemptNumber: message.attemptCount,
      correlationId: message.correlationId
    });

    // Sync with CampaignMessageJob if present
    if (message.campaignJobId) {
      await CampaignMessageJob.updateOne(
        { _id: message.campaignJobId },
        {
          $set: {
            status: 'simulated_success',
            error: '',
            processedAt: finishedAt,
            leaseOwner: '',
            leaseUntil: null
          }
        }
      );
    }

    // Record synthetic ConversationMessage for Inbox representation
    try {
      const convQuery = message.workspaceId
        ? { workspaceId: message.workspaceId, contactId: message.contactId }
        : { ownerId: message.ownerId, contactId: message.contactId };

      let conversation = await Conversation.findOne(convQuery);

      if (!conversation) {
        conversation = await Conversation.create({
          ownerId: message.ownerId,
          workspaceId: message.workspaceId || null,
          contactId: message.contactId,
          lastMessageAt: finishedAt,
          status: 'Open'
        });
      }

      await ConversationMessage.create({
        ownerId: message.ownerId,
        workspaceId: message.workspaceId || null,
        conversationId: conversation._id,
        contactId: message.contactId,
        direction: 'outbound',
        messageType: message.renderedContentSnapshot?.headerType === 'DOCUMENT' ? 'document' : 'text',
        messageSource: 'mock_simulation',
        trustLevel: 'synthetic',
        providerMessageId: result.providerMessageId || '',
        templateVersionId: message.templateVersionId,
        messageBody: message.renderedContentSnapshot?.body || '',
        simulationStatus: 'Simulated Success',
        providerStatus: 'Sent',
        occurredAt: finishedAt
      });
    } catch (err) {
      // Non-fatal if ConversationMessage fails
      console.warn('Synthetic conversation record creation notice:', err.message);
    }

  } else {
    // Failure outcome (Temporary or Permanent)
    const isRetryable = Boolean(result.retryable) && message.attemptCount < message.maxAttempts;

    if (isRetryable) {
      // Exponential backoff with jitter: 2s, 4s, 8s... + jitter (max 5m)
      const baseDelay = 2000 * Math.pow(2, message.attemptCount - 1);
      const jitter = Math.floor(Math.random() * 500);
      const delayMs = Math.min(300000, baseDelay + jitter);
      const nextRetryAt = new Date(Date.now() + delayMs);

      await Message.updateOne(
        { _id: message._id, leaseOwner: workerId },
        {
          $set: {
            status: 'TEMPORARY_FAILURE',
            failureCode: result.failureCode || 'MOCK_TEMPORARY_FAILURE',
            failureReason: result.error || 'Simulated temporary failure',
            nextRetryAt,
            leaseOwner: '',
            leaseUntil: null
          }
        }
      );

      await recordMessageEvent({
        ownerId: message.ownerId,
        messageId: message._id,
        eventType: 'MOCK_SEND_FAILED',
        previousStatus: 'PROCESSING',
        newStatus: 'TEMPORARY_FAILURE',
        source: workerId,
        attemptNumber: message.attemptCount,
        correlationId: message.correlationId,
        safeMetadata: { failureCode: result.failureCode, error: result.error, retryable: true }
      });

      await recordMessageEvent({
        ownerId: message.ownerId,
        messageId: message._id,
        eventType: 'RETRY_SCHEDULED',
        previousStatus: 'TEMPORARY_FAILURE',
        newStatus: 'TEMPORARY_FAILURE',
        source: workerId,
        attemptNumber: message.attemptCount,
        correlationId: message.correlationId,
        safeMetadata: { nextRetryAt, delayMs }
      });

    } else {
      // Permanent failure or max attempts exhausted
      const finalStatus = 'PERMANENT_FAILURE';
      await Message.updateOne(
        { _id: message._id, leaseOwner: workerId },
        {
          $set: {
            status: finalStatus,
            failureCode: result.failureCode || 'MOCK_PERMANENT_FAILURE',
            failureReason: result.error || 'Permanent simulated failure or max retries exceeded',
            nextRetryAt: null,
            completedAt: finishedAt,
            leaseOwner: '',
            leaseUntil: null
          }
        }
      );

      await recordMessageEvent({
        ownerId: message.ownerId,
        messageId: message._id,
        eventType: 'MOCK_SEND_FAILED',
        previousStatus: 'PROCESSING',
        newStatus: finalStatus,
        source: workerId,
        attemptNumber: message.attemptCount,
        correlationId: message.correlationId,
        safeMetadata: { failureCode: result.failureCode, error: result.error, retryable: false }
      });

      await recordMessageEvent({
        ownerId: message.ownerId,
        messageId: message._id,
        eventType: 'MESSAGE_COMPLETED',
        previousStatus: finalStatus,
        newStatus: finalStatus,
        source: workerId,
        attemptNumber: message.attemptCount,
        correlationId: message.correlationId
      });

      if (message.campaignJobId) {
        await CampaignMessageJob.updateOne(
          { _id: message.campaignJobId },
          {
            $set: {
              status: 'failed',
              error: result.error || 'Permanent mock failure',
              processedAt: finishedAt,
              leaseOwner: '',
              leaseUntil: null
            }
          }
        );
      }
    }
  }

  return true;
}

/**
 * Worker execution tick:
 * 1. Reconciles stuck/expired leases
 * 2. Scans and enqueues due scheduled messages
 * 3. Scans and enqueues due retries
 * 4. Processes batches of queued messages with controlled concurrency
 */
export async function messageWorkerTick(workerId = `msg-worker-${process.pid}`) {
  lastHeartbeat = new Date();
  const now = new Date();

  try {
    // 1. Outbox reconciliation: Recover expired leases (worker crashed or timed out)
    await Message.updateMany(
      {
        status: 'PROCESSING',
        leaseUntil: { $lt: now }
      },
      {
        $set: {
          status: 'QUEUED',
          leaseOwner: '',
          leaseUntil: null
        }
      }
    );

    // 2. Schedule scan: Release due scheduled messages
    const dueScheduled = await Message.find({
      status: 'SCHEDULED',
      scheduledAt: { $lte: now }
    }).limit(50).select('_id ownerId correlationId').lean();

    for (const item of dueScheduled) {
      const updated = await Message.updateOne(
        { _id: item._id, status: 'SCHEDULED' },
        {
          $set: {
            status: 'QUEUED',
            queuedAt: now
          }
        }
      );
      if (updated.modifiedCount > 0) {
        await recordMessageEvent({
          ownerId: item.ownerId,
          messageId: item._id,
          eventType: 'MESSAGE_QUEUED',
          previousStatus: 'SCHEDULED',
          newStatus: 'QUEUED',
          source: 'schedule_reconciler',
          correlationId: item.correlationId
        });
      }
    }

    // 3. Retry scan: Enqueue due temporary failures
    const dueRetries = await Message.find({
      status: 'TEMPORARY_FAILURE',
      nextRetryAt: { $lte: now }
    }).limit(50).select('_id ownerId correlationId attemptCount maxAttempts').lean();

    for (const item of dueRetries) {
      if (item.attemptCount < (item.maxAttempts || 3)) {
        const updated = await Message.updateOne(
          { _id: item._id, status: 'TEMPORARY_FAILURE' },
          {
            $set: {
              status: 'QUEUED',
              queuedAt: now,
              nextRetryAt: null
            }
          }
        );
        if (updated.modifiedCount > 0) {
          await recordMessageEvent({
            ownerId: item.ownerId,
            messageId: item._id,
            eventType: 'MESSAGE_QUEUED',
            previousStatus: 'TEMPORARY_FAILURE',
            newStatus: 'QUEUED',
            source: 'retry_reconciler',
            correlationId: item.correlationId
          });
        }
      }
    }

    // 4. Batch Processing with Multi-Tenant Fairness:
    // Interleave processing across distinct workspaces to prevent one tenant from monopolizing the worker
    const activeWorkspaces = await Message.distinct('workspaceId', { status: 'QUEUED', workspaceId: { $ne: null } });
    if (activeWorkspaces && activeWorkspaces.length > 1) {
      let turns = 0;
      for (const wsId of activeWorkspaces) {
        if (turns >= 15) break;
        const candidate = await Message.findOne({ status: 'QUEUED', workspaceId: wsId })
          .sort({ createdAt: 1 })
          .select('_id')
          .lean();
        if (candidate) {
          await processMessageJob(candidate._id, workerId);
          turns++;
        }
      }
    } else {
      for (let i = 0; i < 15; i++) {
        const candidate = await Message.findOne({ status: 'QUEUED' })
          .sort({ createdAt: 1 })
          .select('_id')
          .lean();

        if (!candidate) break;

        const processed = await processMessageJob(candidate._id, workerId);
        if (!processed) break;
      }
    }

  } catch (err) {
    recentErrors.unshift({
      timestamp: new Date(),
      message: err.message
    });
    if (recentErrors.length > 20) recentErrors.pop();
    console.error('Message worker tick caught error:', err.message);
  }
}

/**
 * Starts the durable background worker timer.
 */
export function startMessageWorker() {
  if (workerRunning) return;
  workerRunning = true;

  const tick = async () => {
    if (isProcessingTick) return;
    isProcessingTick = true;
    try {
      await messageWorkerTick();
    } finally {
      isProcessingTick = false;
    }
  };

  workerTimer = setInterval(tick, 1000);
  workerTimer.unref();
  tick(); // Initial immediate tick

  console.log('Durable Mock Message Worker started.');
  return workerTimer;
}

/**
 * Stops the background worker gracefully.
 */
export function stopMessageWorker() {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
  }
  workerRunning = false;
  console.log('Durable Mock Message Worker stopped.');
}

/**
 * Returns comprehensive queue health and operational metrics.
 */
export function getWorkerStatus() {
  return { running: workerRunning, lastHeartbeat };
}

export async function getQueueHealth(ownerId = null, workspaceId = null) {
  const query = { ...(ownerId ? { ownerId } : {}), ...(workspaceId ? { workspaceId } : {}) };

  const [counts, processingCount] = await Promise.all([
    Message.aggregate([
      { $match: query },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    Message.countDocuments({ ...query, status: 'PROCESSING' })
  ]);

  const stats = {
    queued: 0,
    processing: processingCount,
    scheduled: 0,
    temporaryFailure: 0,
    permanentFailure: 0,
    simulatedSent: 0,
    simulatedDelivered: 0,
    simulatedRead: 0,
    blocked: 0,
    cancelled: 0,
    total: 0
  };

  for (const item of counts) {
    const c = item.count;
    stats.total += c;
    if (item._id === 'QUEUED') stats.queued = c;
    else if (item._id === 'PROCESSING') stats.processing = c;
    else if (item._id === 'SCHEDULED') stats.scheduled = c;
    else if (item._id === 'TEMPORARY_FAILURE') stats.temporaryFailure = c;
    else if (item._id === 'PERMANENT_FAILURE') stats.permanentFailure = c;
    else if (item._id === 'SIMULATED_SENT') stats.simulatedSent = c;
    else if (item._id === 'SIMULATED_DELIVERED') stats.simulatedDelivered = c;
    else if (item._id === 'SIMULATED_READ') stats.simulatedRead = c;
    else if (item._id === 'BLOCKED') stats.blocked = c;
    else if (item._id === 'CANCELLED') stats.cancelled = c;
  }

  return {
    applicationOnline: true,
    databaseOnline: true,
    queueOnline: true,
    workerRunning,
    whatsappConnected: false, // Disconnected in Prompt 5, mock mode only
    providerMode: 'MOCK',
    mockSafeguardsActive: true,
    lastHeartbeat,
    activeWorkers: workerRunning ? 1 : 0,
    queueStats: stats,
    recentErrors: recentErrors.slice(0, 5)
  };
}
