import crypto from 'crypto';
import WhatsAppConnection from '../models/WhatsAppConnection.js';
import ProviderEvent from '../models/ProviderEvent.js';

/**
 * WhatsApp Webhook Routing Service
 * 
 * Verifies webhook signatures and authoritatively maps incoming provider events
 * to the correct workspace and active connection.
 */
class WhatsAppWebhookRoutingService {
  /**
   * Verifies the HMAC-SHA256 signature sent by Meta in X-Hub-Signature-256 header.
   * Uses constant-time comparison to prevent timing attacks.
   * 
   * @param {string|Buffer} rawBody - Raw unparsed HTTP request body
   * @param {string} signatureHeader - Value of X-Hub-Signature-256 header (e.g. 'sha256=abcdef...')
   * @param {string} appSecret - Meta App Secret
   * @returns {boolean} True if signature is valid
   */
  verifySignature(rawBody, signatureHeader, appSecret) {
    if (!signatureHeader || !appSecret || !rawBody) {
      return false;
    }

    const parts = signatureHeader.split('=');
    if (parts.length !== 2 || parts[0] !== 'sha256') {
      return false;
    }

    const expectedSig = parts[1];
    const hmac = crypto.createHmac('sha256', appSecret);
    hmac.update(rawBody);
    const calculatedSig = hmac.digest('hex');

    try {
      const expectedBuf = Buffer.from(expectedSig, 'hex');
      const calculatedBuf = Buffer.from(calculatedSig, 'hex');
      if (expectedBuf.length !== calculatedBuf.length) {
        return false;
      }
      return crypto.timingSafeEqual(expectedBuf, calculatedBuf);
    } catch {
      return false;
    }
  }

  /**
   * Resolves the authoritative workspace and connection for an incoming event.
   * FAILS CLOSED for unknown or ambiguous sender identities.
   * 
   * @param {Object} eventMetadata - { phoneNumberId, displayPhoneNumber, wabaId }
   * @returns {Promise<Object>} Resolved connection document or throws security error
   */
  async resolveSenderContext(eventMetadata) {
    const { phoneNumberId, normalizedPhone, wabaId } = eventMetadata || {};

    const queryConditions = [];
    if (phoneNumberId) {
      queryConditions.push({ phoneNumberId });
    }
    if (normalizedPhone) {
      queryConditions.push({ normalizedPhoneNumber: normalizedPhone });
    }
    if (wabaId && queryConditions.length === 0) {
      queryConditions.push({ wabaId });
    }

    if (queryConditions.length === 0) {
      const err = new Error('WEBHOOK ROUTING SECURITY: Missing sender identifiers in webhook payload.');
      err.code = 'MISSING_SENDER_IDENTIFIER';
      err.status = 400;
      throw err;
    }

    // Lookup matching connections
    const matches = await WhatsAppConnection.find({
      $or: queryConditions,
    }).populate('workspaceId');

    if (matches.length === 0) {
      const err = new Error(`WEBHOOK ROUTING SECURITY [UNKNOWN_SENDER_REJECTED]: Unknown sender identity (${phoneNumberId || normalizedPhone}). No matching connection found. Failing closed.`);
      err.code = 'UNKNOWN_SENDER_REJECTED';
      err.status = 404;
      throw err;
    }

    if (matches.length > 1) {
      // Ambiguous collision: multiple workspaces claim same sender without authorized sharing
      const err = new Error(`WEBHOOK ROUTING SECURITY [AMBIGUOUS_SENDER_REJECTED]: Ambiguous sender identity. Multiple active connections match ${phoneNumberId || normalizedPhone}. Failing closed.`);
      err.code = 'AMBIGUOUS_SENDER_REJECTED';
      err.status = 409;
      throw err;
    }

    const connection = matches[0];

    // Enforce active connection state
    const inactiveStatuses = ['DISCONNECTED', 'SUSPENDED', 'FAILED'];
    if (inactiveStatuses.includes(connection.connectionStatus)) {
      const err = new Error(`WEBHOOK ROUTING SECURITY [CONNECTION_INACTIVE]: Connection is in inactive state: ${connection.connectionStatus}. Rejecting event.`);
      err.code = 'CONNECTION_INACTIVE';
      err.status = 403;
      throw err;
    }

    return connection;
  }

  /**
   * Deduplicates incoming events using idempotency key.
   */
  async recordEventIdempotently({ workspaceId, connectionId, providerEventId, eventType, rawPayload }) {
    const idempotencyKey = `ws_${workspaceId}_evt_${providerEventId}_${eventType}`;

    try {
      const existing = await ProviderEvent.findOne({ idempotencyKey });
      if (existing) {
        return { isDuplicate: true, event: existing };
      }

      const event = await ProviderEvent.create({
        workspaceId,
        connectionId,
        idempotencyKey,
        providerEventId,
        eventType,
        rawPayload,
        processedAt: new Date(),
      });

      return { isDuplicate: false, event };
    } catch (err) {
      if (err.code === 11000) {
        // Mongo duplicate key error
        return { isDuplicate: true };
      }
      throw err;
    }
  }
}

export default new WhatsAppWebhookRoutingService();
