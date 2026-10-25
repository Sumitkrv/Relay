# SaaS 10 — Subscription State Machine & Lifecycle Management

## 1. Internal Billing State Machine
The Relay billing engine defines explicit, deterministic internal statuses:

```mermaid
stateDiagram-v2
    [*] --> NO_SUBSCRIPTION
    NO_SUBSCRIPTION --> TRIALING: Start 14-Day Trial
    TRIALING --> TRIAL_EXPIRED: 14 Days Elapsed
    TRIALING --> CHECKOUT_PENDING: Upgrade to Relay Solo
    NO_SUBSCRIPTION --> CHECKOUT_PENDING: Select Relay Solo
    TRIAL_EXPIRED --> CHECKOUT_PENDING: Subscribe Now
    CHECKOUT_PENDING --> AUTHORIZATION_PENDING: Mandate Created
    CHECKOUT_PENDING --> ACTIVE: Checkout Verified / Charged
    AUTHORIZATION_PENDING --> ACTIVE: First Payment Captured
    ACTIVE --> PAST_DUE: Payment Failed (Grace Period)
    PAST_DUE --> ACTIVE: Retry Succeeded
    PAST_DUE --> HALTED: Retries Exhausted
    ACTIVE --> CANCEL_AT_PERIOD_END: Cancel Requested
    CANCEL_AT_PERIOD_END --> ACTIVE: Resume Renewal
    CANCEL_AT_PERIOD_END --> CANCELLED: Period Ended
    ACTIVE --> CANCELLED: Immediate Cancel
    CANCELLED --> CHECKOUT_PENDING: Resubscribe
    [*] --> LEGACY_ENTITLED: Migration Reference (M2W)
```

---

## 2. Cancellation Policies
Relay supports two cancellation modes:
1. **Cancel at Period End (Default & Recommended)**:
   - Access to full CRM, segmentation, and templates continues until `currentPeriodEnd`.
   - Razorpay recurring mandate is cancelled at cycle boundary.
   - Preserves customer data indefinitely.
2. **Immediate Cancellation**:
   - For special customer support cases or explicit termination.
   - Deactivates subscription immediately while retaining all historical records.

---

## 3. Re-Subscription Flow
A business whose subscription is cancelled or trial is expired can resubscribe at any time:
- Calls `subscriptionService.createSubscription()`.
- Generates a fresh Razorpay recurring subscription.
- Preserves all existing contacts, templates, campaign records, and inbox interactions.
- Does not reset trial eligibility.
