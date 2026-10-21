# SaaS 10 — Webhook Processing, Verification & Idempotency

## 1. Webhook Endpoint
- **Route**: `POST /api/billing/webhooks/razorpay`
- **Security**: Authenticated solely through cryptographic signature in `X-Razorpay-Signature`.

---

## 2. Raw Body Verification
Express modifies request bodies during JSON parsing. To ensure exact cryptographic matching with Razorpay's HMAC signature, the raw payload buffer is captured in `backend/src/app.js`:
```javascript
app.use(express.json({
  limit: '100kb',
  verify: (req, _res, buf) => {
    req.rawBody = buf.toString();
  }
}));
```
In `billingWebhookService.js`, `req.rawBody` is validated against `X-Razorpay-Signature` using `RAZORPAY_WEBHOOK_SECRET`.

---

## 3. Idempotency & Deduplication
Razorpay may deliver webhooks multiple times due to network retries.
All events are recorded in the `billingwebhookevents` collection:
- `providerEventId`: Unique event identifier from Razorpay headers/payload.
- Indexed with `{ providerEventId: 1 }` unique constraint.
- If an event is replayed, the service immediately returns HTTP 200 `{ status: 'already_processed', ignored: true }` without repeating side-effects (no duplicate payments, no duplicate email notifications, and no double entitlement extensions).

---

## 4. Supported Lifecycle Events
| Event | Action / State Transition |
|---|---|
| `subscription.authenticated` | Moves subscription to `AUTHORIZATION_PENDING`. |
| `subscription.activated` | Moves subscription to `ACTIVE`, sets `currentPeriodStart` and `currentPeriodEnd`. |
| `subscription.charged` | Records `BillingPayment` transaction (`captured`), updates period end, and dispatches renewal receipt email. |
| `subscription.halted` | Moves subscription to `HALTED`, notifies owner of recurring failure. |
| `subscription.cancelled` | Moves subscription to `CANCELLED`, records cancellation timestamp. |
| `payment.failed` | Transitions subscription to `PAST_DUE`, starts 3-day grace period, sends failure notification. |

---

## 5. Out-of-Order Delivery Protection
If a delayed `subscription.charged` event arrives after the user has already cancelled the subscription, the service checks the current internal state and prevents a stale event from reviving a cancelled subscription.
