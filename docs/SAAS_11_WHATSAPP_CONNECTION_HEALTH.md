# RELAY SAAS — PHASE 11: WHATSAPP CONNECTION HEALTH & BILLING SAFETY

## 1. Connection Health Observability

The Platform Admin WhatsApp module (`/platform-admin/whatsapp-connections`) inspects the connection readiness and lifecycle of every registered customer workspace without exposing sensitive Meta credentials or customer conversations.

### Monitored Telemetry Fields:
- **Connection Type:** `MOCK_SIMULATED`, `EXISTING_APP_COEXISTENCE`, `NEW_CLOUD_API`
- **Execution Mode:** `MOCK` (active), `LIVE` (locked fail-closed)
- **Readiness State:** `MOCK_SIMULATED_READY`, `NOT_CONNECTED`, `BILLING_UNVERIFIED`, `WEBHOOK_UNVERIFIED`, `DISCONNECTED`
- **Billing Responsibility:** `UNVERIFIED`, `CUSTOMER_DIRECT_PENDING`, `CUSTOMER_DIRECT_VERIFIED`
- **Sender Registration & Phone Verification:** `VERIFIED`, `CODE_REQUESTED`, `UNVERIFIED`
- **Webhook Readiness:** `VERIFIED`, `UNVERIFIED`, `PENDING_SUBSCRIPTION`

---

## 2. Customer-Direct Meta Billing Safety

To protect Relay from unbounded third-party messaging liabilities:
1. **Zero Credit Line Sharing:** Relay never attaches its payment card or credit line to customer Meta WhatsApp Business Accounts (WABAs).
2. **Direct Verification Enforcement:** Customers must configure direct credit card or invoice billing with Meta inside their Meta Business Manager before any future live mode activation.
3. **Fail-Closed Gating:** Any connection with `billingStatus !== 'CUSTOMER_DIRECT_VERIFIED'` is blocked from attempting live communication.
4. **Token Security:** Meta access tokens, system user tokens, and webhook secrets are AES-256-GCM encrypted in MongoDB and are **never** returned across administrative APIs.
