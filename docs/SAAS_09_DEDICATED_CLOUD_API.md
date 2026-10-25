# Relay SaaS — Dedicated Cloud API Sender Architecture (Option B)

## 1. Overview of Option B

The Dedicated Cloud API Number path is engineered for businesses that desire an isolated, enterprise-grade sender for high-throughput WhatsApp automation without mobile phone app dependencies.

```mermaid
flowchart LR
    Owner[Business Owner] -->|Registers Clean Number| MetaPortal[Meta Business Manager]
    MetaPortal -->|Issues WABA & Phone Number ID| CloudAPI[WhatsApp Cloud API]
    CloudAPI <-->|High-Volume Broadcasting & Webhooks| Relay[Relay SaaS Platform]
```

---

## 2. Onboarding Lifecycle Stages

1. **Number Entry & Normalization:** Normalized to canonical E.164.
2. **Business Asset Resolution:** Resolves customer's Meta Business Portfolio and WhatsApp Business Account (WABA).
3. **Phone Number ID Binding:** Captures provider's unique integer identifier.
4. **Verification Challenge:** Simulates SMS / Voice OTP verification.
5. **Two-Step Verification (Registration):** Establishes a 6-digit registration PIN to protect the Cloud API endpoint.
6. **Webhook Subscription:** Subscribes Relay's callback endpoint to messages, statuses, and quality updates.
7. **Readiness Confirmation:** Evaluates independent readiness criteria before activation.

---

## 3. Dedicated vs. Coexistence Invariants

| Attribute | Option A (Coexistence) | Option B (Dedicated Cloud API) |
|---|---|---|
| **Mobile App Chatting** | Supported concurrently on WhatsApp Business mobile app | Not supported (number dedicated to Cloud API) |
| **Messaging Throughput** | Standard tier (subject to coexistence limits) | High-volume enterprise broadcasting (up to Tier 3/4) |
| **Existing Number Conflict** | Supported where eligible | Number must not be active on personal WhatsApp without deregulation |
| **Phone Number ID** | Linked to coexistence WABA | Linked to dedicated enterprise WABA |

---

## 4. Verification Simulation in Phase 9

In Phase 9:
- Synthetic verification code is standardized: `123456`.
- Entering `123456` simulates carrier OTP verification and registration.
- Entering any other code simulates `SCENARIO_E_VERIFICATION_FAILED` (`INVALID_OTP`).
- Never communicates with real telecommunication carriers in this phase.
