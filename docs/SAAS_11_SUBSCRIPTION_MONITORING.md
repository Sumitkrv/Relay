# RELAY SAAS — PHASE 11: SUBSCRIPTION MONITORING

## 1. Overview

The Platform Admin Subscription Monitoring module (`/platform-admin/subscriptions`) provides visibility across all tenant billing subscriptions, free trials, renewal periods, and payment exception states.

---

## 2. Key Statuses Monitored

| Internal Status | Operational Definition | Platform Action |
|---|---|---|
| `ACTIVE` | Subscription is paid and in good standing with valid entitlement period. | Normal full feature access. |
| `TRIALING` | Active 14-day server-authoritative free trial grant. | Full feature access until `trialEndsAt`. |
| `PAST_DUE` | Renewal charge failed; entering operational grace period. | Highlighted in red/attention filters. |
| `PAYMENT_PENDING` | Charge in flight or authorization pending. | Monitored during reconciliation checks. |
| `HALTED` | Multiple recurring payment failures; provider paused retries. | Requires operator triage or customer intervention. |
| `CANCELLED` | Subscription cancelled by customer; active until `currentPeriodEnd`. | Recorded with cancellation reason. |
| `LEGACY_ENTITLED` | Operational grant (e.g. M2W Realty migration); full features granted. | 0 INR charge; excluded from cash collections. |

---

## 3. Financial Reconciliation Trigger

Platform administrators may invoke an idempotent reconciliation check across all registered subscriptions:

```
POST /api/platform-admin/billing/reconcile
Headers: Authorization: Bearer <token>
Body: { "reason": "Administrative audit reconciliation check" }
```

### Safety Guarantees:
- Bounded and idempotent execution.
- Never fabricates payments or modifies provider subscription records.
- Records a `PlatformAuditLog` event documenting operator identity and timestamp.
