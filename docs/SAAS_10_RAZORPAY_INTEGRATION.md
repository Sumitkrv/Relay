# SaaS 10 — Official Razorpay Subscriptions Integration

## 1. Integration Scope
Relay utilizes the **Razorpay Subscriptions API** (recurring auto-debit payments via eMandate, UPI AutoPay, and recurring cards) rather than one-time order checkouts.

- Official Docs: [Razorpay Subscriptions Integration Guide](https://razorpay.com/docs/payments/subscriptions/integration-guide)
- API Version: `/v1/subscriptions`
- SDK: `razorpay` Node.js official package + Vanilla JS Checkout script (`https://checkout.razorpay.com/v1/checkout.js`).

---

## 2. Test Mode vs Live Mode Isolation
```ini
# Environment Variables
RAZORPAY_MODE=test
RELAY_LIVE_BILLING_ENABLED=false
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
```
- In **Test Mode**, simulated subscriptions, test authorization callbacks, and test webhooks are processed safely without genuine banking transactions.
- Live billing activation is blocked by the `assertEnvironmentSafety()` guard in `razorpayClientService.js` unless `RELAY_LIVE_BILLING_ENABLED=true` is explicitly configured.

---

## 3. Subscription Creation Flow
1. **Frontend Request**: Owner clicks "Subscribe to Relay Solo" (`POST /api/billing/subscriptions`, `{ planKey: 'relay_solo' }`).
2. **Backend Validation**:
   - Authenticates session and verifies user is the workspace OWNER.
   - Validates plan configuration (₹799 / 79900 paise).
   - Generates or retrieves subscription with Razorpay Subscriptions API.
3. **Safe Response**: Returns public `keyId`, `providerSubscriptionId`, and plan metadata without exposing `key_secret`.
4. **Checkout Launch**: Frontend loads Razorpay Checkout and opens the subscription recurring authorization modal.

---

## 4. Subscription Parameters
- `plan_id`: Configured Razorpay plan ID for Relay Solo.
- `total_count`: 12 monthly recurring cycles.
- `customer_notify`: 1 (Razorpay notifies customer before recurring debits).
- `notes`: Contains `workspaceId`, `ownerUserId`, and `planKey` for auditing and out-of-band webhook correlation.
