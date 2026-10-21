import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

import User from '../src/models/User.js';
import Workspace from '../src/models/Workspace.js';
import WorkspaceMembership from '../src/models/WorkspaceMembership.js';
import Subscription from '../src/models/Subscription.js';
import BillingPayment from '../src/models/BillingPayment.js';
import BillingWebhookEvent from '../src/models/BillingWebhookEvent.js';

import planCatalogService from '../src/services/planCatalogService.js';
import subscriptionService from '../src/services/subscriptionService.js';
import razorpayClientService from '../src/services/razorpayClientService.js';
import billingWebhookService from '../src/services/billingWebhookService.js';

let mongodInstance = null;
let testOwner = null;
let testWorkspace = null;

test.before(async () => {
  if (mongoose.connection.readyState === 0) {
    try {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/relay_saas_test';
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 1500 });
    } catch {
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      mongodInstance = await MongoMemoryServer.create();
      await mongoose.connect(mongodInstance.getUri());
    }
  }

  await planCatalogService.initDefaultPlans();

  testOwner = await User.create({
    name: 'Checkout Test Owner',
    email: 'checkout_owner_' + Date.now() + '@relaytest.io',
    passwordHash: await bcrypt.hash('Password123!', 10),
    role: 'owner',
  });

  testWorkspace = await Workspace.create({
    name: 'Glow Salon Checkout',
    slug: 'glow-salon-checkout-' + Date.now(),
    industryKey: 'salon',
    businessEmail: 'owner@glowsalon.io',
    businessPhone: '+919988776655',
    createdBy: testOwner._id,
  });

  await WorkspaceMembership.create({
    workspaceId: testWorkspace._id,
    userId: testOwner._id,
    role: 'OWNER',
    status: 'ACTIVE',
  });
});

test.after(async () => {
  await mongoose.disconnect();
  if (mongodInstance) {
    await mongodInstance.stop();
  }
});

test('Razorpay Checkout: creates pending subscription with safe checkout metadata', async () => {
  const result = await subscriptionService.createSubscription({
    workspaceId: testWorkspace._id,
    userId: testOwner._id,
    planKey: 'relay_solo'
  });

  assert.equal(result.success, true);
  assert.ok(result.subscription, 'Must return subscription metadata');
  assert.equal(result.subscription.planKey, 'relay_solo');
  assert.equal(result.subscription.currency, 'INR');
  assert.equal(result.subscription.amountMinor, 79900);
  assert.ok(result.subscription.providerSubscriptionId, 'Must have providerSubscriptionId');
  assert.ok(result.subscription.keyId, 'Must include safe public key_id');

  // Verify internal state is pending checkout
  const sub = await Subscription.findOne({ workspaceId: testWorkspace._id });
  assert.ok(sub);
  assert.equal(sub.internalStatus, 'CHECKOUT_PENDING');
  assert.equal(sub.provider.toUpperCase(), 'RAZORPAY');
});

test('Signature Verification: authenticates valid subscription checkout signature', async () => {
  const sub = await Subscription.findOne({ workspaceId: testWorkspace._id });
  const paymentId = 'pay_test_' + Date.now().toString(36);
  const secret = razorpayClientService.keySecret;

  // Construct official signature: HMAC SHA256 of `${paymentId}|${sub.providerSubscriptionId}`
  const validSignature = crypto
    .createHmac('sha256', secret)
    .update(`${paymentId}|${sub.providerSubscriptionId}`)
    .digest('hex');

  // Test verifyCheckoutSignature utility directly
  const isValid = razorpayClientService.verifyCheckoutSignature({
    paymentId,
    subscriptionId: sub.providerSubscriptionId,
    signature: validSignature
  });
  assert.equal(isValid, true, 'Valid signature must be verified successfully');

  // Process checkout verification via subscriptionService
  const verifyResult = await subscriptionService.verifyCheckout({
    workspaceId: testWorkspace._id,
    userId: testOwner._id,
    razorpay_payment_id: paymentId,
    razorpay_subscription_id: sub.providerSubscriptionId,
    razorpay_signature: validSignature
  });

  assert.equal(verifyResult.success, true);
  assert.equal(verifyResult.status, 'ACTIVE');

  // Verify subscription is now ACTIVE with payment recorded
  const updatedSub = await Subscription.findOne({ workspaceId: testWorkspace._id });
  assert.equal(updatedSub.internalStatus, 'ACTIVE');
  assert.ok(updatedSub.lastPaidAt);

  const paymentRecord = await BillingPayment.findOne({ providerPaymentId: paymentId });
  assert.ok(paymentRecord, 'Must record payment transaction');
  assert.equal(paymentRecord.amountMinor, 79900);
  assert.equal(paymentRecord.paymentStatus, 'captured');
});

test('Signature Verification: rejects tampered or forged signature', async () => {
  const sub = await Subscription.findOne({ workspaceId: testWorkspace._id });
  const paymentId = 'pay_forged_' + Date.now();
  const forgedSignature = 'bad_forged_signature_hex_1234567890abcdef';

  await assert.rejects(
    async () => subscriptionService.verifyCheckout({
      workspaceId: testWorkspace._id,
      userId: testOwner._id,
      razorpay_payment_id: paymentId,
      razorpay_subscription_id: sub.providerSubscriptionId,
      razorpay_signature: forgedSignature
    }),
    /Invalid payment authorization signature/
  );
});

test('Webhook HMAC Verification: validates authentic raw body signature', async () => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || 'rzp_webhook_secret_mock';
  const rawBody = JSON.stringify({
    event: 'subscription.charged',
    contains: ['payment', 'subscription'],
    payload: {
      subscription: {
        entity: {
          id: 'sub_test_mock_123',
          status: 'active'
        }
      },
      payment: {
        entity: {
          id: 'pay_test_mock_123',
          amount: 79900,
          currency: 'INR',
          status: 'captured'
        }
      }
    }
  });

  const validSignature = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  const isValid = razorpayClientService.verifyWebhookSignature(rawBody, validSignature, secret);
  assert.equal(isValid, true, 'Webhook signature must be valid');

  const isInvalid = razorpayClientService.verifyWebhookSignature(rawBody, 'tampered_signature_hex', secret);
  assert.equal(isInvalid, false, 'Tampered webhook signature must fail verification');
});

test('Webhook Processing: handles subscription.charged and prevents duplicate processing', async () => {
  const sub = await Subscription.findOne({ workspaceId: testWorkspace._id });
  const eventId = 'evt_test_' + Date.now().toString(36);
  const paymentId = 'pay_webhook_' + Date.now().toString(36);

  const payload = {
    subscription: {
      entity: {
        id: sub.providerSubscriptionId,
        status: 'active',
        current_start: Math.floor(Date.now() / 1000),
        current_end: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000),
      }
    },
    payment: {
      entity: {
        id: paymentId,
        amount: 79900,
        currency: 'INR',
        status: 'captured',
        method: 'card',
        card: {
          last4: '4242',
          network: 'Visa'
        }
      }
    }
  };

  // First delivery
  const res1 = await billingWebhookService.processEvent({
    providerEventId: eventId,
    eventType: 'subscription.charged',
    payload
  });
  assert.equal(res1.status, 'processed');

  // Verify payment was recorded
  const pay = await BillingPayment.findOne({ providerPaymentId: paymentId });
  assert.ok(pay);
  assert.equal(pay.cardLast4, '4242');

  // Duplicate delivery with same eventId
  const res2 = await billingWebhookService.processEvent({
    providerEventId: eventId,
    eventType: 'subscription.charged',
    payload
  });
  assert.equal(res2.status, 'already_processed', 'Duplicate event must be recognized as idempotent');

  // Ensure no duplicate payment record was created
  const payCount = await BillingPayment.countDocuments({ providerPaymentId: paymentId });
  assert.equal(payCount, 1, 'Payment record must not be duplicated');
});

test('Out-of-Order Webhooks: does not reactivate cancelled subscription with stale charge event', async () => {
  const sub = await Subscription.findOne({ workspaceId: testWorkspace._id });
  
  // Set subscription to CANCELLED
  await Subscription.updateOne(
    { _id: sub._id },
    { $set: { internalStatus: 'CANCELLED', cancelledAt: new Date() } }
  );

  // Stale event arrives with old timestamp
  const staleEventId = 'evt_stale_' + Date.now();
  const payload = {
    subscription: {
      entity: {
        id: sub.providerSubscriptionId,
        status: 'active',
        current_start: Math.floor((Date.now() - 60 * 24 * 60 * 60 * 1000) / 1000), // 60 days ago
        current_end: Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000),
      }
    },
    payment: {
      entity: {
        id: 'pay_stale_' + Date.now(),
        amount: 79900,
        currency: 'INR',
        status: 'captured'
      }
    }
  };

  await billingWebhookService.processEvent({
    providerEventId: staleEventId,
    eventType: 'subscription.charged',
    payload
  });

  const reloaded = await Subscription.findById(sub._id);
  assert.equal(reloaded.internalStatus, 'CANCELLED', 'Stale event must not reactivate a cancelled subscription');
});
