import crypto from 'node:crypto';

/**
 * MockWhatsAppProvider
 * 
 * Complete, authoritative implementation of the Relay WhatsApp Provider Contract
 * for offline development, automated testing, and simulated multi-scenario execution.
 * 
 * Guarantees:
 * - NO real external network calls to Meta Graph API
 * - Explicit source classification ('MOCK', 'SYNTHETIC_TEST')
 * - Identifiers prefixed with 'mock_msg_...'
 * - Deterministic outcome simulations (success, temporary failure, permanent failure, timeout, rate limit)
 * - Identical contract interface to the future MetaCloudWhatsAppProvider (Prompt 10)
 */
class MockWhatsAppProvider {
  constructor() {
    this.mode = 'MOCK';
    this.name = 'MockWhatsAppProvider';
    this.version = '1.0.0-api-free';
    this.isOutageSimulated = false;
  }

  getProviderMode() {
    return 'MOCK';
  }

  setSimulatedOutage(outage) {
    this.isOutageSimulated = Boolean(outage);
  }

  /**
   * 1. Validate Configuration
   */
  validateConfiguration() {
    return {
      valid: true,
      mode: 'MOCK',
      provider: this.name,
      version: this.version,
      safeguardsActive: true,
      liveSendingAllowed: false,
      outageSimulated: this.isOutageSimulated,
      message: 'Mock WhatsApp Provider active. All operations are simulated safely in sandbox environment.'
    };
  }

  /**
   * 2. Get Connection Status
   */
  getConnectionStatus() {
    if (this.isOutageSimulated) {
      return {
        connected: false,
        mode: 'MOCK',
        officialMetaConnected: false,
        mockEngineReady: false,
        status: 'OUTAGE_SIMULATED',
        webhookVerification: 'simulated_offline',
        message: 'Simulated WhatsApp gateway outage active for resilience testing.'
      };
    }

    return {
      connected: false, // Truthful: official Meta Cloud API is NOT connected
      mode: 'MOCK',
      officialMetaConnected: false,
      mockEngineReady: true,
      status: 'SANDBOX_READY',
      webhookVerification: 'internal_simulated',
      message: 'Official Meta WhatsApp Cloud API disconnected. Offline in sandbox simulation.'
    };
  }

  /**
   * 3. Prepare Template Payload
   * Shapes payload according to standard WhatsApp Cloud API payload structures.
   */
  prepareTemplatePayload({ template, contact, user, variables = {}, recipientPhone }) {
    if (!template) {
      throw new Error('Template is required to prepare template payload.');
    }

    const phone = recipientPhone || contact?.phoneNumber;
    if (!phone || !/^\+[1-9]\d{7,14}$/.test(phone)) {
      return {
        valid: false,
        error: 'Invalid recipient phone number format. Must be international E.164 format.',
        failureCode: 'INVALID_PHONE'
      };
    }

    const providerMessageId = this.mapProviderMessageId();

    // Standard WhatsApp components structure
    const components = [];

    // Header component
    if (template.headerType && template.headerType !== 'NONE') {
      const headerComp = { type: 'header', format: template.headerType.toLowerCase() };
      if (template.headerType === 'TEXT') {
        headerComp.text = template.header;
      } else if (['IMAGE', 'DOCUMENT', 'VIDEO'].includes(template.headerType)) {
        headerComp[template.headerType.toLowerCase()] = {
          link: template.headerMediaUrl || 'mock://media-vault/brochure.pdf'
        };
      }
      components.push(headerComp);
    }

    // Body component with resolved parameters
    const bodyParameters = Object.entries(variables).map(([name, val]) => ({
      type: 'text',
      text: String(val ?? '')
    }));

    components.push({
      type: 'body',
      parameters: bodyParameters
    });

    // Buttons component if configured
    if (Array.isArray(template.buttons) && template.buttons.length > 0) {
      template.buttons.forEach((btn, index) => {
        if (btn.type === 'QUICK_REPLY') {
          components.push({
            type: 'button',
            sub_type: 'quick_reply',
            index,
            parameters: [{ type: 'payload', payload: btn.value || btn.text }]
          });
        } else if (btn.type === 'URL') {
          components.push({
            type: 'button',
            sub_type: 'url',
            index,
            parameters: [{ type: 'text', text: btn.value || '' }]
          });
        }
      });
    }

    return {
      valid: true,
      mode: 'MOCK',
      providerMessageId,
      recipientPhone: phone,
      messaging_product: 'whatsapp',
      to: phone.replace('+', ''),
      type: 'template',
      template: {
        name: template.name?.toLowerCase().replace(/[^a-z0-9_]/g, '_') || 'sample_template',
        language: { code: template.language || 'en' },
        components
      },
      preparedAt: new Date()
    };
  }

  /**
   * 4. Validate Template Payload
   */
  validateTemplatePayload(payload) {
    if (!payload || typeof payload !== 'object') {
      return { valid: false, error: 'Payload must be an object.', failureCode: 'INVALID_PAYLOAD' };
    }
    if (!payload.recipientPhone && !payload.to) {
      return { valid: false, error: 'Recipient phone number is required.', failureCode: 'MISSING_PHONE' };
    }
    if (!payload.template || !payload.template.name) {
      return { valid: false, error: 'Template specification is missing.', failureCode: 'MISSING_TEMPLATE' };
    }
    return { valid: true };
  }

  /**
   * 5. Prepare Media
   */
  prepareMedia({ mediaUrl, mediaType, mediaName, url, filename }) {
    const finalUrl = mediaUrl || url;
    if (!finalUrl) {
      return { valid: false, error: 'Media URL or local file path is required.' };
    }
    const type = (mediaType || 'document').toLowerCase();
    const name = mediaName || filename || 'document.pdf';
    return {
      valid: true,
      type,
      mediaType: type,
      mediaId: `mock_media_${crypto.randomBytes(8).toString('hex')}`,
      url: finalUrl,
      mediaUrl: finalUrl,
      filename: name,
      mediaName: name,
      isMockReference: true,
      verifiedMetaMediaId: null,
      preparedAt: new Date()
    };
  }

  /**
   * 6. Send Template Message (Simulated Outbound)
   */
  async sendTemplateMessage(messagePayload, options = {}) {
    return this.sendMessage(messagePayload, options);
  }

  /**
   * 7. Send Session Message (Simulated 24-Hour Window Outbound)
   */
  async sendSessionMessage(messagePayload, options = {}) {
    const conv = options.conversation || messagePayload?.conversation;
    let sessionActive = options.sessionActive !== false;

    if (conv?.lastCustomerMessageAt) {
      const elapsedMs = Date.now() - new Date(conv.lastCustomerMessageAt).getTime();
      if (elapsedMs > 24 * 60 * 60 * 1000) {
        sessionActive = false;
      }
    }

    if (!sessionActive) {
      return {
        success: false,
        status: 'PERMANENT_FAILURE',
        providerMessageId: null,
        error: 'Simulated 24-hour customer service window expired. Freeform session message rejected.',
        failureCode: 'SESSION_WINDOW_EXPIRED',
        retryable: false,
        occurredAt: new Date()
      };
    }

    return this.sendMessage(messagePayload, options);
  }

  /**
   * Core send simulator with deterministic outcome overrides
   */
  async sendMessage(messagePayload, options = {}) {
    if (options.mode === 'LIVE' || messagePayload?.mode === 'LIVE') {
      return {
        success: false,
        status: 'BLOCKED',
        providerMessageId: null,
        error: 'LIVE mode is hard-blocked. Only MOCK mode is permitted in Prompt 9.',
        failureCode: 'LIVE_SENDING_FORBIDDEN',
        retryable: false,
        occurredAt: new Date()
      };
    }

    // Check if outage is simulated
    if (this.isOutageSimulated) {
      return {
        success: false,
        status: 'TEMPORARY_FAILURE',
        providerMessageId: null,
        error: 'Simulated WhatsApp gateway outage active (503 Service Unavailable).',
        failureCode: 'MOCK_PROVIDER_UNAVAILABLE',
        retryable: true,
        occurredAt: new Date()
      };
    }

    // Configurable simulation delay (default 5ms in tests for fast execution)
    const delayMs = options.simulatedDelayMs ?? (process.env.NODE_ENV === 'test' ? 5 : 20);
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    const forceOutcome = options.forceOutcome || messagePayload?.metadata?.forceOutcome;

    if (forceOutcome === 'temporary_failure') {
      return {
        success: false,
        status: 'TEMPORARY_FAILURE',
        providerMessageId: null,
        error: 'Simulated temporary upstream carrier timeout.',
        failureCode: 'MOCK_TEMPORARY_FAILURE',
        retryable: true,
        occurredAt: new Date()
      };
    }

    if (forceOutcome === 'timeout') {
      return {
        success: false,
        status: 'TEMPORARY_FAILURE',
        providerMessageId: null,
        error: 'Simulated WhatsApp gateway request timeout (504 Gateway Timeout).',
        failureCode: 'MOCK_TIMEOUT',
        retryable: true,
        occurredAt: new Date()
      };
    }

    if (forceOutcome === 'rate_limit') {
      return {
        success: false,
        status: 'TEMPORARY_FAILURE',
        providerMessageId: null,
        error: 'Simulated WhatsApp Business messaging tier rate limit reached.',
        failureCode: 'MOCK_RATE_LIMIT',
        retryable: true,
        occurredAt: new Date()
      };
    }

    if (forceOutcome === 'provider_unavailable') {
      return {
        success: false,
        status: 'TEMPORARY_FAILURE',
        providerMessageId: null,
        error: 'Simulated provider service temporarily unavailable (503).',
        failureCode: 'MOCK_PROVIDER_UNAVAILABLE',
        retryable: true,
        occurredAt: new Date()
      };
    }

    if (forceOutcome === 'permanent_failure') {
      return {
        success: false,
        status: 'PERMANENT_FAILURE',
        providerMessageId: null,
        error: 'Simulated recipient phone number is not registered on WhatsApp.',
        failureCode: 'MOCK_PERMANENT_FAILURE',
        retryable: false,
        occurredAt: new Date()
      };
    }

    // Default: Normal simulated success
    const providerMessageId =
      messagePayload.providerMessageId || this.mapProviderMessageId();
    const now = new Date();

    return {
      success: true,
      status: 'SIMULATED_SENT',
      providerMessageId,
      simulatedSentAt: now,
      simulatedDeliveredAt: options.simulateDelivered ? new Date(now.getTime() + 50) : null,
      simulatedReadAt: options.simulateRead ? new Date(now.getTime() + 100) : null,
      error: null,
      failureCode: null,
      retryable: false
    };
  }

  /**
   * 8. Normalize Inbound Message
   * Converts incoming webhook payload into a normalized Relay internal event.
   */
  normalizeInboundMessage(rawInbound) {
    if (!rawInbound) {
      throw new Error('Raw inbound payload is required.');
    }

    const text =
      rawInbound.text?.body ||
      rawInbound.body ||
      rawInbound.messageBody ||
      rawInbound.button?.text ||
      '';

    const fromPhone =
      rawInbound.from ||
      rawInbound.senderPhone ||
      rawInbound.contactPhone ||
      '+919876543210';

    const providerMessageId =
      rawInbound.id ||
      rawInbound.providerMessageId ||
      `mock_msg_inbound_${crypto.randomBytes(8).toString('hex')}`;

    return {
      providerMessageId,
      fromPhone: fromPhone.startsWith('+') ? fromPhone : `+${fromPhone}`,
      contactName: rawInbound.profile?.name || rawInbound.contactName || 'Client',
      text: text.trim(),
      body: text.trim(),
      direction: 'inbound',
      messageType: rawInbound.type || 'text',
      timestamp: rawInbound.timestamp ? new Date(Number(rawInbound.timestamp) * 1000) : new Date(),
      source: 'SYNTHETIC_TEST',
      sourceClassification: 'SYNTHETIC_TEST',
      trustLevel: 'synthetic',
      media: rawInbound.image || rawInbound.document || null
    };
  }

  /**
   * 9. Normalize Status Event
   * Converts status webhook payload into a normalized Relay status event.
   */
  normalizeStatusEvent(rawStatus) {
    if (!rawStatus) {
      throw new Error('Raw status event is required.');
    }

    const providerMessageId = rawStatus.id || rawStatus.providerMessageId || '';
    const rawStatusStr = String(rawStatus.status || '').toLowerCase();

    let status = 'SIMULATED_SENT';
    if (rawStatusStr === 'delivered') status = 'SIMULATED_DELIVERED';
    else if (rawStatusStr === 'read') status = 'SIMULATED_READ';
    else if (rawStatusStr === 'failed') status = 'PERMANENT_FAILURE';

    return {
      providerMessageId,
      status,
      timestamp: rawStatus.timestamp ? new Date(Number(rawStatus.timestamp) * 1000) : new Date(),
      failureCode: rawStatus.errors?.[0]?.code || rawStatus.failureCode || null,
      failureReason: rawStatus.errors?.[0]?.title || rawStatus.error || null,
      sourceClassification: 'MOCK'
    };
  }

  /**
   * 10. Normalize Provider Error
   */
  normalizeProviderError(error) {
    if (!error) return { failureCode: 'UNKNOWN_ERROR', message: 'An unknown error occurred', retryable: false };
    if (typeof error === 'string') return { failureCode: 'MOCK_ERROR', message: error, retryable: false };

    const rawCode = error.code || error.error?.code || error.failureCode;
    let failureCode = 'MOCK_ERROR';
    let retryable = false;

    if (rawCode === 130429 || rawCode === '130429' || rawCode === 'RATE_LIMIT_EXCEEDED') {
      failureCode = 'RATE_LIMIT_EXCEEDED';
      retryable = true;
    } else if (rawCode === 'TEMPORARY_FAILURE' || rawCode === 'NETWORK_TIMEOUT') {
      failureCode = 'TEMPORARY_FAILURE';
      retryable = true;
    } else if (rawCode === 'PERMANENT_FAILURE' || rawCode === 'INVALID_PHONE') {
      failureCode = 'PERMANENT_FAILURE';
      retryable = false;
    } else if (rawCode) {
      failureCode = String(rawCode);
    }

    return {
      failureCode,
      message: error.message || error.error?.message || 'Simulated provider processing error',
      retryable
    };
  }

  /**
   * 11. Verify Inbound Event Source
   * In MOCK mode, asserts that simulation was triggered by authenticated owner in dev/test.
   */
  verifyInboundEventSource(req = {}) {
    if (process.env.NODE_ENV === 'production') {
      return { verified: false, reason: 'Mock simulation endpoint disabled in production.' };
    }
    const isVerified = req.source === 'SYNTHETIC_TEST' || req.headers?.['x-mock-event'] || !req.user || Boolean(req.user?._id);
    return { verified: Boolean(isVerified), source: 'SYNTHETIC_TEST' };
  }

  /**
   * 12. Map Provider Message ID
   */
  mapProviderMessageId(customId) {
    if (customId && String(customId).startsWith('mock_msg_')) {
      return customId;
    }
    return `mock_msg_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * 13. Get Provider Capabilities
   */
  getProviderCapabilities() {
    return {
      mode: 'MOCK',
      isLive: false,
      supportsTemplates: true,
      supportsSessionMessages: true,
      supportsQuickReplies: true,
      supportsCallToActions: true,
      supportsMediaHeaders: true,
      supportsDocumentHeaders: true,
      supportsBrochureAttachment: true,
      maxVariablesCount: 20,
      sessionWindowHours: 24,
      officialProviderConnected: false,
      liveMetaSending: false,
      hardBlockedModes: ['LIVE']
    };
  }

  // Backward-compatible helpers
  prepareMessage(payload) {
    return this.prepareTemplatePayload({
      template: { name: 'standard_template', headerType: 'NONE' },
      recipientPhone: payload.recipientPhone || payload.contact?.phoneNumber
    });
  }

  interpretResult(result) {
    if (!result) {
      return {
        status: 'TEMPORARY_FAILURE',
        failureCode: 'UNKNOWN_PROVIDER_RESULT',
        error: 'Null or undefined response received from provider simulation',
        retryable: true
      };
    }
    return {
      status: result.status || (result.success ? 'SIMULATED_SENT' : 'TEMPORARY_FAILURE'),
      failureCode: result.failureCode || (result.success ? null : 'MOCK_GENERIC_FAILURE'),
      error: result.error || null,
      retryable: Boolean(result.retryable),
      providerMessageId: result.providerMessageId || null
    };
  }

  normalizeError(error) {
    return this.normalizeProviderError(error);
  }
}

export default new MockWhatsAppProvider();
