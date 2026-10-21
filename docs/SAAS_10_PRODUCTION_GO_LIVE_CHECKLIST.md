# SaaS 10 — Production Go-Live & Financial Audit Checklist

## 1. Production Status: DISABLED
> [!IMPORTANT]
> **LIVE BILLING STATUS: DISABLED**
> Relay operates in **Razorpay TEST MODE** (`RAZORPAY_MODE=test`, `RELAY_LIVE_BILLING_ENABLED=false`).
> No live credit cards will be billed, and no production charges will be processed without completing this checklist.

---

## 2. Production Activation Prerequisites
Before toggling `RELAY_LIVE_BILLING_ENABLED=true`:

- [ ] **Merchant Account Activation**: Complete formal Razorpay merchant onboarding, KYC verification, and Recurring Subscriptions capability approval.
- [ ] **Live Plan Synchronization**: Create matching production plan in Razorpay Dashboard for `relay_solo` (₹799/month, 12 cycles) and populate `RAZORPAY_SOLO_PLAN_ID_LIVE`.
- [ ] **Tax & GST Verification**: Confirm legal business entity name, GSTIN registration, registered office address, and whether ₹799 price is tax-inclusive or exclusive.
- [ ] **Webhook Endpoint URL**: Configure live webhook URL (`https://app.relay.com/api/billing/webhooks/razorpay`) with HTTPS in Razorpay Dashboard and store secret in `RAZORPAY_WEBHOOK_SECRET`.
- [ ] **Terms & Cancellation Policy**: Publish reviewed terms of service, refund policy, and cancellation policy on the marketing website.
- [ ] **Support Channel**: Configure dedicated billing support email (`billing@relay.com`) and escalation procedure for payment disputes.
- [ ] **Meta Customer-Direct Billing Alignment**: Reconfirm with customer onboarding that Meta conversation charges remain billed directly to their credit card on WABA.

---

## 3. Deployment Safety Gate
The application code includes an automated safety guard (`assertEnvironmentSafety()` in `razorpayClientService.js`). Even if production API keys are configured, live payment collection is rejected unless `RELAY_LIVE_BILLING_ENABLED=true` is explicitly provided in the production environment.
