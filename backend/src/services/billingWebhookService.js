import BillingWebhookEvent from '../models/BillingWebhookEvent.js';
import Subscription from '../models/Subscription.js';
import BillingPayment from '../models/BillingPayment.js';
import Workspace from '../models/Workspace.js';
import User from '../models/User.js';
import razorpayClientService from './razorpayClientService.js';
import billingNotificationService from './billingNotificationService.js';

class BillingWebhookService {
  /**
   * Ingests and processes an incoming Razorpay webhook event cryptographically.
   */
  async processWebhook({ rawBody, signatureHeader, eventIdHeader = null }) {
    if (!signatureHeader || !rawBody) {
      const err = new Error('WEBHOOK REJECTED: Missing raw body or signature header.');
      err.status = 400;
      err.code = 'INVALID_WEBHOOK_HEADERS';
      throw err;
    }

    // 1. Cryptographic HMAC-SHA256 signature verification
    const isValid = razorpayClientService.verifyWebhookSignature({
      rawBody,
      signature: signatureHeader,
    });

    if (!isValid) {
      const err = new Error('WEBHOOK SECURITY REJECTED: Invalid X-Razorpay-Signature.');
      err.status = 401;
      err.code = 'INVALID_WEBHOOK_SIGNATURE';
      throw err;
    }

    // 2. Parse payload
    const payload = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
    const eventType = payload.event;
    const eventId = eventIdHeader || payload.event_id || payload.id || `evt_${Date.now()}`;

    // 3. Deduplication Check
    const existing = await BillingWebhookEvent.findOne({ providerEventId: eventId });
    if (existing) {
      return { success: true, status: 'DUPLICATE', ignored: true, message: 'Event already processed.' };
    }

    // 4. Resolve Subscription & Entity
    const subEntity = payload.payload?.subscription?.entity;
    const paymentEntity = payload.payload?.payment?.entity;
    const providerSubId = subEntity?.id || paymentEntity?.subscription_id || null;

    let workspaceId = null;
    let subscription = null;

    if (providerSubId) {
      subscription = await Subscription.findOne({ providerSubscriptionId: providerSubId });
      workspaceId = subscription?.workspaceId || null;
    }

    // 5. Record event receipt atomically
    const webhookEvent = await BillingWebhookEvent.create({
      providerEventId: eventId,
      eventType,
      providerSubscriptionId: providerSubId,
      workspaceId,
      payload,
      processingStatus: 'PENDING',
      receivedAt: new Date(),
    });

    // 6. State Machine Processing
    try {
      if (subscription) {
        await this._handleSubscriptionEvent(eventType, subscription, payload);
      }

      webhookEvent.processingStatus = 'PROCESSED';
      webhookEvent.processedAt = new Date();
      await webhookEvent.save();

      return { success: true, eventType, providerSubId, processed: true };
    } catch (procErr) {
      webhookEvent.processingStatus = 'FAILED';
      webhookEvent.processingError = procErr.message;
      await webhookEvent.save();
      throw procErr;
    }
  }

  /**
   * Directly processes an event object (for internal triggers, background workers, or test assertions).
   */
  async processEvent({ providerEventId, eventType, payload }) {
    const eventId = providerEventId || `evt_${Date.now()}`;
    const existing = await BillingWebhookEvent.findOne({ providerEventId: eventId });
    if (existing) {
      return { success: true, status: 'already_processed', ignored: true, message: 'Event already processed.' };
    }

    const subEntity = payload.subscription?.entity || payload.payload?.subscription?.entity;
    const paymentEntity = payload.payment?.entity || payload.payload?.payment?.entity;
    const providerSubId = subEntity?.id || paymentEntity?.subscription_id || null;

    let workspaceId = null;
    let subscription = null;

    if (providerSubId) {
      subscription = await Subscription.findOne({ providerSubscriptionId: providerSubId });
      workspaceId = subscription?.workspaceId || null;
    }

    const webhookEvent = await BillingWebhookEvent.create({
      providerEventId: eventId,
      eventType,
      providerSubscriptionId: providerSubId,
      workspaceId,
      payload,
      processingStatus: 'PENDING',
      receivedAt: new Date(),
    });

    try {
      if (subscription) {
        await this._handleSubscriptionEvent(eventType, subscription, { payload: payload.payload || payload });
      }

      webhookEvent.processingStatus = 'PROCESSED';
      webhookEvent.processedAt = new Date();
      await webhookEvent.save();

      return { success: true, status: 'processed', eventType, providerSubId, processed: true };
    } catch (procErr) {
      webhookEvent.processingStatus = 'FAILED';
      webhookEvent.processingError = procErr.message;
      await webhookEvent.save();
      throw procErr;
    }
  }

  async _handleSubscriptionEvent(eventType, subscription, payload) {
    const subEntity = payload.payload?.subscription?.entity;
    const paymentEntity = payload.payload?.payment?.entity;
    const now = new Date();

    switch (eventType) {
      case 'subscription.authenticated':
        subscription.internalStatus = 'AUTHORIZATION_PENDING';
        subscription.providerStatus = 'authenticated';
        subscription.lastReconciledAt = now;
        await subscription.save();
        break;

      case 'subscription.activated':
        subscription.internalStatus = 'ACTIVE';
        subscription.providerStatus = 'active';
        subscription.startedAt = subscription.startedAt || now;
        if (subEntity?.current_start) {
          subscription.currentPeriodStart = new Date(subEntity.current_start * 1000);
        }
        if (subEntity?.current_end) {
          subscription.currentPeriodEnd = new Date(subEntity.current_end * 1000);
        }
        subscription.lastReconciledAt = now;
        await subscription.save();
        break;

      case 'subscription.charged':
        if (subscription.internalStatus === 'CANCELLED') {
          // Guard: out-of-order stale event must not reactivate a cancelled subscription
          break;
        }
        subscription.internalStatus = 'ACTIVE';
        subscription.providerStatus = 'active';
        subscription.lastPaidAt = now;
        if (subEntity?.current_end) {
          subscription.currentPeriodEnd = new Date(subEntity.current_end * 1000);
        }
        subscription.lastReconciledAt = now;
        await subscription.save();

        // Record payment
        if (paymentEntity?.id) {
          await BillingPayment.findOneAndUpdate(
            { providerPaymentId: paymentEntity.id },
            {
              $setOnInsert: {
                workspaceId: subscription.workspaceId,
                subscriptionId: subscription._id,
                providerPaymentId: paymentEntity.id,
                providerInvoiceId: paymentEntity.invoice_id || null,
                amountMinor: paymentEntity.amount || subscription.amountMinor,
                currency: paymentEntity.currency || 'INR',
                status: 'captured',
                paymentMethod: paymentEntity.method || 'mandate',
                methodDetails: {
                  last4: paymentEntity.card?.last4 || '',
                  network: paymentEntity.card?.network || '',
                  bank: paymentEntity.bank || '',
                },
                paidAt: now,
                billingPeriodStart: subscription.currentPeriodStart,
                billingPeriodEnd: subscription.currentPeriodEnd,
                billingEnvironment: subscription.billingEnvironment,
              },
            },
            { upsert: true }
          );

          // Trigger email receipt
          const workspace = await Workspace.findById(subscription.workspaceId).lean();
          const user = await User.findById(subscription.ownerUserId).lean();
          if (user?.email) {
            await billingNotificationService.sendPaymentSuccessNotification({
              email: user.email,
              businessName: workspace?.name || 'Your Business',
              amountMinor: paymentEntity.amount || subscription.amountMinor,
              planName: 'Relay Solo',
              invoiceId: paymentEntity.invoice_id,
            });
          }
        }
        break;

      case 'payment.failed':
        subscription.internalStatus = 'PAST_DUE';
        subscription.gracePeriodEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7-day grace period
        subscription.lastReconciledAt = now;
        await subscription.save();

        if (paymentEntity?.id) {
          await BillingPayment.findOneAndUpdate(
            { providerPaymentId: paymentEntity.id },
            {
              $setOnInsert: {
                workspaceId: subscription.workspaceId,
                subscriptionId: subscription._id,
                providerPaymentId: paymentEntity.id,
                amountMinor: paymentEntity.amount || subscription.amountMinor,
                currency: paymentEntity.currency || 'INR',
                status: 'failed',
                errorCode: paymentEntity.error_code || 'PAYMENT_FAILED',
                errorDescription: paymentEntity.error_description || 'Card charge unsuccessful.',
                paidAt: now,
              },
            },
            { upsert: true }
          );

          const workspace = await Workspace.findById(subscription.workspaceId).lean();
          const user = await User.findById(subscription.ownerUserId).lean();
          if (user?.email) {
            await billingNotificationService.sendPaymentFailedNotification({
              email: user.email,
              businessName: workspace?.name || 'Your Business',
              amountMinor: paymentEntity.amount || subscription.amountMinor,
              planName: 'Relay Solo',
              gracePeriodEndsAt: subscription.gracePeriodEndsAt,
            });
          }
        }
        break;

      case 'subscription.halted':
        subscription.internalStatus = 'HALTED';
        subscription.providerStatus = 'halted';
        subscription.lastReconciledAt = now;
        await subscription.save();
        break;

      case 'subscription.cancelled':
        subscription.internalStatus = 'CANCELLED';
        subscription.providerStatus = 'cancelled';
        subscription.cancelledAt = now;
        subscription.lastReconciledAt = now;
        await subscription.save();
        break;

      case 'subscription.completed':
        subscription.internalStatus = 'EXPIRED';
        subscription.providerStatus = 'completed';
        subscription.lastReconciledAt = now;
        await subscription.save();
        break;

      default:
        // Safely ignore unrecognized events without failing
        break;
    }
  }
}

export default new BillingWebhookService();
