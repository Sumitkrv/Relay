# Relay — Official Meta WhatsApp Cloud API Integration Readiness
## Architectural Isolation, Payload Contracts, Webhook Boundaries & Prompt 10 Roadmap

> **Document Version:** 2.0.0 (Prompt 9.2 Release Hardening Baseline)  
> **Status:** Mock-Engine Complete & Fully Integrated; Official Meta Integration Isolated for Prompt 10  
> **Runtime Environment:** Single-Operator Real Estate WhatsApp Automation Platform

---

## Table of Contents
- [Section A: Implemented & Verified Capabilities (Without Meta API)](#section-a-implemented--verified-capabilities-without-meta-api)
- [Section B: Provider Adapter Interface Contract](#section-b-provider-adapter-interface-contract)
- [Section C: Outgoing Message Payload Shapes (WhatsApp Cloud API JSON)](#section-c-outgoing-message-payload-shapes-whatsapp-cloud-api-json)
- [Section D: Template Parameter Mapping & Dynamic Tokens](#section-d-template-parameter-mapping--dynamic-tokens)
- [Section E: Media Reference Handling & Brochure Delivery](#section-e-media-reference-handling--brochure-delivery)
- [Section F: Inbound Message Event Mapping (Webhook Normalization)](#section-f-inbound-message-event-mapping-webhook-normalization)
- [Section G: Delivery & Read Status Event Mapping](#section-g-delivery--read-status-event-mapping)
- [Section H: Provider Error Normalization & Categorization](#section-h-provider-error-normalization--categorization)
- [Section I: Idempotency Strategy & Duplicate Elimination](#section-i-idempotency-strategy--duplicate-elimination)
- [Section J: Durable Queue Worker & Backoff Retries](#section-j-durable-queue-worker--backoff-retries)
- [Section K: 24-Hour Customer Service Window Enforcement](#section-k-24-hour-customer-service-window-enforcement)
- [Section L: Consent Requirements & Hard Opt-Out Suppression](#section-l-consent-requirements--hard-opt-out-suppression)
- [Section M: Webhook Authenticity & Signature Verification Requirements](#section-m-webhook-authenticity--signature-verification-requirements)
- [Section N: Required Official Meta Credentials (Without Hardcoding)](#section-n-required-official-meta-credentials-without-hardcoding)
- [Section O: Exact Scope Allocated to Prompt 10](#section-o-exact-scope-allocated-to-prompt-10)
- [Section P: Real-Provider Risks Requiring Live Testing in Prompt 11](#section-p-real-provider-risks-requiring-live-testing-in-prompt-11)
- [Section Q: Rollback & Circuit Breaker Safety Strategy](#section-q-rollback--circuit-breaker-safety-strategy)

---

### Section A: Implemented & Verified Capabilities (Without Meta API)
The entire internal CRM and messaging platform is functional, persistent, and verifiable without connecting external Meta APIs:
1. **Owner Authentication & Multi-Tenant Data Isolation**: Complete with JWT, HTTP-only session cookies, session versioning, and fail-closed tenant queries.
2. **Business Profile & Operational Preferences**: Agency details, RERA compliance, timezone configuration (`Asia/Kolkata`), and quiet hours.
3. **Contact Management & Smart Import**: Full CRUD, tags, contact groups, dynamic condition-based segments, CSV/XLSX imports with formula injection protection, duplicate phone handling, and strict E.164 phone normalization.
4. **Template Studio & Real Estate Variables**: 3-panel layout, dynamic token insertion (`{{name}}`, `{{project}}`, `{{city}}`), header media attachments (PDF/Image), button configurations (Quick Reply, URL CTA, Phone CTA), version history snapshots, and live WhatsApp preview.
5. **Template Mock Approval Simulation**: Isolated state field `mockProviderApprovalStatus` allowing lifecycle testing (`Simulated Submission` → `Simulated Pending Review` → `Simulated Approved` → `Simulated Rejected`) without touching `verifiedMetaApprovalStatus`.
6. **Campaign Wizard & Durable Queue**: 4-step wizard, live audience eligibility preview, template snapshot pinning, MongoDB queue persistence, background worker leasing with concurrency locks, and paused/resumed/cancelled campaign state machines.
7. **Two-Way Mock Inbox & Keyword Automation**: Conversation threads, synthetic inbound reply injector, unread tracking, manual takeover toggle, and keyword auto-reply rules (`BROCHURE`, `PRICE`, `VISIT`, `STOP`).
8. **Operational Reporting & Secure Exports**: Real-time KPI aggregations, secondary metrics, date filtering, multi-campaign comparison, and streaming CSV/XLSX downloads with formula escaping.

---

### Section B: Provider Adapter Interface Contract
The application interacts with messaging providers through a strict, provider-neutral contract (`messagingProviderRegistry.js`):

```typescript
interface WhatsAppProviderAdapter {
  validateConfiguration(): { valid: boolean; mode: string; safeguardsActive: boolean; liveSendingAllowed: boolean };
  getConnectionStatus(): Promise<{ connected: boolean; provider: string; status: string }>;
  getProviderCapabilities(): { templates: boolean; media: boolean; interactiveButtons: boolean; sessionMessages: boolean };
  mapProviderMessageId(rawId?: string): string;
  prepareTemplatePayload(params: { to: string; template: object; language?: string; variables?: object; mediaUrl?: string }): object;
  validateTemplatePayload(payload: object): { valid: boolean; errors: string[] };
  prepareMedia(file: object): Promise<{ mediaId?: string; mediaUrl: string; contentType: string; fileName: string; isSimulated: boolean }>;
  sendTemplateMessage(params: object): Promise<{ success: boolean; providerMessageId: string; status: string; rawResponse?: object }>;
  sendSessionMessage(params: object): Promise<{ success: boolean; providerMessageId: string; status: string }>;
  normalizeInboundMessage(rawWebhookPayload: object): NormalizedInboundMessage;
  normalizeStatusEvent(rawWebhookPayload: object): NormalizedStatusEvent;
  normalizeProviderError(error: object): NormalizedProviderError;
  verifyInboundEventSource(req: object): { authentic: boolean; source: string };
}
```
- **Prompt 9 Implementation:** `mockWhatsAppProvider.js` satisfies 100% of these methods, outputting deterministic synthetic responses with recognizable `mock_msg_...` IDs and `SIMULATED_...` statuses.
- **Prompt 10 Implementation:** `metaCloudWhatsAppProvider.js` will implement this identical interface, routing calls to `https://graph.facebook.com/v21.0/` without requiring any changes to campaign orchestration, queue workers, or inbox services.

---

### Section C: Outgoing Message Payload Shapes (WhatsApp Cloud API JSON)

#### 1. Template Message Payload (Standard Format)
```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "+919811223344",
  "type": "template",
  "template": {
    "name": "luxury_penthouse_invitation",
    "language": {
      "code": "en_US"
    },
    "components": [
      {
        "type": "header",
        "parameters": [
          {
            "type": "document",
            "document": {
              "link": "https://relaycrm.io/uploads/brochure-prestige-park.pdf",
              "filename": "Prestige_Park_Brochure.pdf"
            }
          }
        ]
      },
      {
        "type": "body",
        "parameters": [
          {
            "type": "text",
            "text": "Vikramaditya Singhania"
          },
          {
            "type": "text",
            "text": "Prestige Park Residences"
          },
          {
            "type": "text",
            "text": "Gurugram"
          }
        ]
      },
      {
        "type": "button",
        "sub_type": "url",
        "index": "0",
        "parameters": [
          {
            "type": "text",
            "text": "vip-preview"
          }
        ]
      }
    ]
  }
}
```

#### 2. Session Message Payload (Within 24-hr Customer Service Window)
```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "+919811223344",
  "type": "text",
  "text": {
    "preview_url": true,
    "body": "Hi Vikramaditya, unit pricing at Prestige Park Residences starts at ₹1.25 Cr with 20:80 flexible subvention. Which floor are you interested in?"
  }
}
```

---

### Section D: Template Parameter Mapping & Dynamic Tokens
The template rendering engine automatically maps contact and business tokens to WhatsApp positional parameters (`{{1}}`, `{{2}}`, etc.):

| CRM Token | Resolved Field | Fallback Default | Cloud API Parameter Index |
| :--- | :--- | :--- | :--- |
| `{{name}}` | `contact.fullName` | `"Valued Client"` | `parameters[0]` |
| `{{first_name}}` | `contact.fullName.split(' ')[0]` | `"Client"` | `parameters[1]` |
| `{{phone}}` | `contact.phoneNumber` | `""` | `parameters[2]` |
| `{{project}}` | `contact.interestedProject` or `template.project` | `"Prestige Park"` | `parameters[3]` |
| `{{city}}` | `contact.location` | `"Gurugram"` | `parameters[4]` |
| `{{property_type}}` | `contact.industry` | `"Apartment"` | `parameters[5]` |
| `{{business_name}}` | `user.businessName` | `"M2W Luxury Realty"` | `parameters[6]` |

---

### Section E: Media Reference Handling & Brochure Delivery
1. **Local Durable Storage:** Files uploaded via Template Studio are stored in the server's persistent `/uploads/` directory with SHA-256 integrity hashes.
2. **Current Mock Handling:** In Mock mode, `prepareMedia()` formats a public URL reference without fabricating a Meta media ID (`metaMediaId` remains null, `isSimulated: true`).
3. **Prompt 10 Transition:** Prompt 10 will add the two-step Meta Resumable Media Upload:
   - Step 1: `POST /v21.0/{phone_number_id}/media` with `multipart/form-data`.
   - Step 2: Store the returned Meta Media ID (`h:xxxxxxxxx`) alongside the local document reference for reuse across recipients.

---

### Section F: Inbound Message Event Mapping (Webhook Normalization)
Meta Cloud API sends incoming webhook notifications structured as nested arrays. Relay's `normalizeInboundMessage` unwraps this into a clean internal entity:

#### Raw Meta Inbound Webhook:
```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "1002938481234",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": { "display_phone_number": "+911234567890", "phone_number_id": "89123019283" },
        "contacts": [{ "profile": { "name": "Rohan Deshmukh" }, "wa_id": "919811991234" }],
        "messages": [{
          "from": "919811991234",
          "id": "wamid.HBgMOTExOTgxMTk5MTIzNxUCABIYFDNBRjEwMTIzOTQ=",
          "timestamp": "1729415848",
          "text": { "body": "Hi, please send the BROCHURE for Prestige Park." },
          "type": "text"
        }]
      },
      "field": "messages"
    }]
  }]
}
```

#### Relay Normalized Inbound Entity:
```json
{
  "provider": "META_CLOUD",
  "providerMessageId": "wamid.HBgMOTExOTgxMTk5MTIzNxUCABIYFDNBRjEwMTIzOTQ=",
  "from": "+919811991234",
  "customerName": "Rohan Deshmukh",
  "messageType": "text",
  "body": "Hi, please send the BROCHURE for Prestige Park.",
  "timestamp": "2026-10-20T09:38:48.000Z",
  "source": "VERIFIED_PROVIDER"
}
```

---

### Section G: Delivery & Read Status Event Mapping

| Meta Status | Relay Internal Event | Action Taken |
| :--- | :--- | :--- |
| `sent` | `SENT` | Recipient status marked Sent; carrier timestamp saved |
| `delivered` | `DELIVERED` | Recipient status marked Delivered; delivery audit logged |
| `read` | `READ` | Recipient status marked Read; engagement metric incremented |
| `failed` | `FAILED` | Mapped to retryable or terminal error based on error code |

---

### Section H: Provider Error Normalization & Categorization

| Meta Error Code | Meta Error Title | Relay Category | Retryable? | Action Taken |
| :--- | :--- | :--- | :--- | :--- |
| **130429** | Rate limit hit | `RATE_LIMIT_EXCEEDED` | **Yes** | Queue backoff with exponential delay (30s, 60s, 120s) |
| **131056** | Service temporarily unavailable | `PROVIDER_UNAVAILABLE` | **Yes** | Re-queue for next worker tick |
| **131047** | Re-engagement message required | `SESSION_WINDOW_EXPIRED` | **No** | Free-form reply blocked; requires approved template |
| **131026** | Message undeliverable | `UNDELIVERABLE_PHONE` | **No** | Mark recipient Failed; flag contact phone as invalid |
| **100** | Parameter missing / invalid | `INVALID_PAYLOAD` | **No** | Mark recipient Failed; log configuration defect |

---

### Section I: Idempotency Strategy & Duplicate Elimination
1. **Compound Unique Index:** `Message.index({ ownerId: 1, idempotencyKey: 1 }, { unique: true })`.
2. **Key Generation:** Every campaign recipient generates a deterministic key:
   `idempotencyKey = sha256(ownerId + campaignId + contactId + templateVersionId)`.
3. **Webhook Deduplication:** Incoming Meta webhook messages are keyed by `providerMessageId` (`wamid...`). If a webhook arrives multiple times, MongoDB rejects duplicate insertions at the database constraint level.

---

### Section J: Durable Queue Worker & Backoff Retries
- **Queue Engine:** MongoDB-backed atomic lease queue (`findOneAndUpdate` with `$lt: leaseExpiresAt`).
- **Worker Concurrency:** Single-operator bounded concurrency (5 parallel messages).
- **Retry Schedule:** Maximum 3 attempts with exponential backoff:
  - Attempt 1: Initial dispatch
  - Attempt 2: +30 seconds
  - Attempt 3: +120 seconds
- **Terminal Failures:** Suppression opt-outs, invalid phones, and permanent template rejections are immediately marked `FAILED` with retry disabled.

---

### Section K: 24-Hour Customer Service Window Enforcement
1. **Rule:** Free-form session replies and quick replies may only be dispatched if the customer has sent an incoming message within the last 24 hours (86,400,000 ms).
2. **Mock Implementation:** `mockWhatsAppProvider.sendSessionMessage` checks `lastCustomerMessageAt`. If time elapsed > 24 hours, the request is rejected with `SESSION_WINDOW_EXPIRED`.
3. **Marketing Broadcasts:** Always use approved pre-registered Templates and are exempt from the 24-hour window, provided valid explicit consent exists.

---

### Section L: Consent Requirements & Hard Opt-Out Suppression
1. **Zero-Policy:** A phone number alone never confers marketing eligibility.
2. **Explicit Opt-In Required:** Only contacts with `whatsappConsentStatus: "Opted In"` are leased for campaign delivery.
3. **STOP Keyword Automation:** When a customer replies `STOP`, the normalized conversation pipeline immediately:
   - Sets `whatsappConsentStatus = 'Opted Out'`.
   - Creates an immutable `ConsentRecord` audit trail (`eventType: 'OPT_OUT_WHATSAPP'`).
   - Aborts any undispatched queued messages for that contact across all active campaigns.

---

### Section M: Webhook Authenticity & Signature Verification Requirements
When Prompt 10 implements the live webhook endpoint (`POST /api/webhooks/whatsapp`):
1. **Payload Verification:** Every request must be verified using the `X-Hub-Signature-256` header:
   ```javascript
   const expectedSignature = 'sha256=' + crypto
     .createHmac('sha256', process.env.WHATSAPP_APP_SECRET)
     .update(rawBody)
     .digest('hex');
   if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
     // Authentic Meta Webhook
   }
   ```
2. **Challenge Verification:** The `GET /api/webhooks/whatsapp` route must respond to `hub.challenge` when `hub.verify_token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN`.

---

### Section N: Required Official Meta Credentials (Without Hardcoding)

| Variable Name | Description | Source in Meta Developer Console |
| :--- | :--- | :--- |
| `WHATSAPP_API_TOKEN` | System User Permanent Access Token | Business Manager → System Users → Generate Token (`whatsapp_business_messaging`) |
| `WHATSAPP_PHONE_NUMBER_ID` | Phone Number Identification Number | WhatsApp → API Setup → Phone Number ID |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | WABA Identification Number | WhatsApp → API Setup → WhatsApp Business Account ID |
| `WHATSAPP_APP_SECRET` | App Secret for Webhook HMAC SHA256 | App Dashboard → Basic Settings → App Secret |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN`| Secret string for webhook handshake | Configured during Webhook subscription in Meta Console |

---

### Section O: Exact Scope Allocated to Prompt 10
Prompt 10 will implement strictly the official provider adapter without altering CRM logic:
1. `metaCloudWhatsAppProvider.js` implementing the existing 13-method adapter contract.
2. Real HTTPS client calling `https://graph.facebook.com/v21.0/{phone_number_id}/messages`.
3. Meta Template Submission and Status Synchronization endpoint (`POST /v21.0/{waba_id}/message_templates`).
4. Real Meta Resumable Media Upload for PDF brochures and images.
5. Authenticated webhook endpoint (`POST /api/webhooks/whatsapp`) with `X-Hub-Signature-256` HMAC validation.
6. Webhook subscription handshake (`GET /api/webhooks/whatsapp`).

---

### Section P: Real-Provider Risks Requiring Live Testing in Prompt 11
The following real-world conditions cannot be simulated in an offline environment and must be verified in Prompt 11:
1. Meta Business Account & Phone Number Display Name official verification.
2. Template rejection by Meta AI reviewers for marketing policy violations.
3. WhatsApp Tier 1 Messaging Limits (starting at 1,000 business-initiated conversations / 24h).
4. Meta Cloud API global rate limiting (80 calls / second).
5. Cellular network delivery drops or handset offline delays.
6. WhatsApp business conversation pricing / billing category deductions.

---

### Section Q: Rollback & Circuit Breaker Safety Strategy
1. **Instant Fallback Toggle:** The provider registry maintains a fast toggle: if Meta Cloud API returns consecutive HTTP 5xx errors or token expiry errors, Relay automatically activates a Circuit Breaker, halting dispatch and alerting the owner in Settings.
2. **Zero Message Loss:** Any messages leased during an outage are released back into `QUEUED` state with an incremented backoff timer, ensuring zero message loss and preventing duplicate billing.
