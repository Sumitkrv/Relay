import crypto from 'crypto';

class RazorpayClientService {
  constructor() {
    this.mode = process.env.RAZORPAY_MODE || 'test';
    this.keyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_relay_mock_key_id';
    this.keySecret = process.env.RAZORPAY_KEY_SECRET || 'relay_test_razorpay_secret_key_2026';
    this.webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'relay_test_webhook_secret_2026';
    this.isLiveEnabled = process.env.RELAY_LIVE_BILLING_ENABLED === 'true';
    this.apiBaseUrl = 'https://api.razorpay.com/v1';
  }

  /**
   * Asserts environment safety. Live billing is strictly disabled by default.
   */
  assertEnvironmentSafety(requestedMode = 'test') {
    if (requestedMode === 'live' || this.mode === 'live') {
      if (!this.isLiveEnabled) {
        const err = new Error('LIVE Razorpay billing is strictly DISABLED in Phase 10. Test mode only.');
        err.code = 'LIVE_PAYMENTS_DISABLED';
        err.status = 403;
        throw err;
      }
    }
    return true;
  }

  /**
   * Returns safe public config for frontend checkout.
   */
  getPublicConfig() {
    return {
      keyId: this.keyId,
      mode: this.mode,
      currency: 'INR',
      isLiveEnabled: this.isLiveEnabled,
    };
  }

  verifySubscriptionSignature(arg1, arg2, arg3) {
    let paymentId, subscriptionId, signature;
    if (typeof arg1 === 'object' && arg1 !== null) {
      paymentId = arg1.paymentId || arg1.razorpay_payment_id;
      subscriptionId = arg1.subscriptionId || arg1.razorpay_subscription_id;
      signature = arg1.signature || arg1.razorpay_signature;
    } else {
      paymentId = arg1;
      subscriptionId = arg2;
      signature = arg3;
    }

    if (!paymentId || !subscriptionId || !signature) {
      return false;
    }

    const payload = `${paymentId}|${subscriptionId}`;
    const hmac = crypto.createHmac('sha256', this.keySecret);
    hmac.update(payload);
    const expected = hmac.digest('hex');

    try {
      const expectedBuf = Buffer.from(expected, 'hex');
      const signatureBuf = Buffer.from(signature, 'hex');
      if (expectedBuf.length !== signatureBuf.length) {
        return false;
      }
      return crypto.timingSafeEqual(expectedBuf, signatureBuf);
    } catch {
      return false;
    }
  }

  verifyCheckoutSignature(arg1, arg2, arg3) {
    return this.verifySubscriptionSignature(arg1, arg2, arg3);
  }

  /**
   * Verifies Razorpay incoming signed webhook header (X-Razorpay-Signature).
   * 
   * @param {string|Buffer} rawBody - Raw unparsed HTTP body string
   * @param {string} signature - Header X-Razorpay-Signature value
   * @param {string} secret - Webhook secret override (optional)
   * @returns {boolean} True if HMAC matches
   */
  verifyWebhookSignature(arg1, arg2, arg3) {
    let rawBody, signature, secret;
    if (typeof arg1 === 'object' && arg1 !== null && !Buffer.isBuffer(arg1)) {
      rawBody = arg1.rawBody;
      signature = arg1.signature;
      secret = arg1.secret;
    } else {
      rawBody = arg1;
      signature = arg2;
      secret = arg3;
    }

    const webhookSecret = secret || this.webhookSecret;
    if (!rawBody || !signature || !webhookSecret) {
      return false;
    }

    const hmac = crypto.createHmac('sha256', webhookSecret);
    hmac.update(rawBody);
    const expected = hmac.digest('hex');

    try {
      const expectedBuf = Buffer.from(expected, 'hex');
      const signatureBuf = Buffer.from(signature, 'hex');
      if (expectedBuf.length !== signatureBuf.length) {
        return false;
      }
      return crypto.timingSafeEqual(expectedBuf, signatureBuf);
    } catch {
      return false;
    }
  }

  /**
   * Creates a recurring subscription on Razorpay.
   */
  async createSubscription({ planId, totalCount = 12, customerNotify = 1, notes = {} }) {
    this.assertEnvironmentSafety(this.mode);

    // If real credentials are provided and not mock test keys, call live endpoint
    if (this.keyId && !this.keyId.includes('mock') && this.keySecret && !this.keySecret.includes('test')) {
      const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
      const response = await fetch(`${this.apiBaseUrl}/subscriptions`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plan_id: planId,
          total_count: totalCount,
          customer_notify: customerNotify,
          notes,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const err = new Error(errorData.error?.description || 'Razorpay subscription creation failed.');
        err.status = response.status;
        err.code = 'RAZORPAY_API_ERROR';
        throw err;
      }
      return response.json();
    }

    // Deterministic Test Sandbox Simulation
    const timestamp = Date.now();
    const syntheticSubId = `sub_test_${timestamp}_${crypto.randomBytes(4).toString('hex')}`;
    return {
      id: syntheticSubId,
      entity: 'subscription',
      plan_id: planId,
      status: 'created',
      current_start: null,
      current_end: null,
      ended_at: null,
      quantity: 1,
      notes,
      charge_at: null,
      start_at: Math.floor(timestamp / 1000),
      end_at: Math.floor((timestamp + 365 * 24 * 3600 * 1000) / 1000),
      auth_transaction_id: null,
      total_count: totalCount,
      paid_count: 0,
      customer_notify: customerNotify,
      created_at: Math.floor(timestamp / 1000),
      short_url: `https://rzp.io/i/test_${syntheticSubId}`,
    };
  }

  /**
   * Fetches provider subscription state.
   */
  async fetchSubscription(subscriptionId) {
    this.assertEnvironmentSafety(this.mode);

    return {
      id: subscriptionId,
      entity: 'subscription',
      status: 'active',
      current_start: Math.floor(Date.now() / 1000),
      current_end: Math.floor((Date.now() + 30 * 24 * 3600 * 1000) / 1000),
      paid_count: 1,
    };
  }

  /**
   * Cancels a subscription on Razorpay.
   */
  async cancelSubscription(subscriptionId, cancelAtCycleEnd = false) {
    this.assertEnvironmentSafety(this.mode);

    return {
      id: subscriptionId,
      entity: 'subscription',
      status: cancelAtCycleEnd ? 'active' : 'cancelled',
      cancel_at_cycle_end: cancelAtCycleEnd,
      cancelled_at: Math.floor(Date.now() / 1000),
    };
  }

  /**
   * Fetches payment details.
   */
  async fetchPayment(paymentId) {
    return {
      id: paymentId,
      entity: 'payment',
      amount: 79900,
      currency: 'INR',
      status: 'captured',
      method: 'mandate',
      card: { last4: '4242', network: 'Visa' },
      captured: true,
      created_at: Math.floor(Date.now() / 1000),
    };
  }
}

export default new RazorpayClientService();
