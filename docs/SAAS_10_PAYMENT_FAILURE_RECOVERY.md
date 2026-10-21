# SaaS 10 — Payment Failure Management & Dunning Recovery

## 1. Overview
Recurring payment mandates may encounter transient failures due to insufficient balance, expired cards, or temporary bank downtime. Relay implements a humane, resilient recovery workflow.

---

## 2. Grace Period Architecture
When a `payment.failed` event is received via webhook or reconciliation:
1. `Subscription.internalStatus` transitions to `PAST_DUE`.
2. A 3-day grace period is granted (`gracePeriodEndsAt = now + 3 days`).
3. An automated transactional notification is dispatched to the business owner with a direct link to the Billing Settings portal.
4. **During Grace**: Core read access, template editing, and historical reporting remain accessible with a prominent warning banner.
5. **After Grace**: New campaign launches are blocked until payment authorization is updated. Zero customer contacts or message records are purged.

---

## 3. Retries & Recovery
- Razorpay handles recurring auto-retries in accordance with RBI recurring payment mandate guidelines.
- If a subsequent retry succeeds, Razorpay issues a `subscription.charged` event, transitioning the subscription back to `ACTIVE` and clearing the warning state.
- If all provider retries fail, a `subscription.halted` event is processed, transitioning the status to `HALTED`.
- The customer can re-authorize payment directly from `/app/settings/billing` at any time.
