# Relay SaaS — Mock Onboarding Engine & Test Scenarios (Phase 9 of 15)

## 1. Mission of Mock Onboarding

Mock Onboarding provides an honest, reliable simulation sandbox that guides business owners through the exact 7-step connection wizard without transmitting live network requests to Meta or requiring real credit cards.

### Core Guarantees:
- **No Live Meta Calls:** Zero HTTP traffic to Meta Graph API.
- **No Password Collection:** Relay never displays fake Facebook login screens or collects Meta passwords.
- **Clear Visual Distinction:** Persistent badges clearly designate the sandbox as `Mock Simulator`.
- **Durable Persistence:** Onboarding attempts and connection state transitions are genuinely stored in MongoDB.

---

## 2. Nine Deterministic Simulation Scenarios

| Scenario ID | Name | Step Triggered | Expected Outcome |
|---|---|---|---|
| `SCENARIO_A_APP_ELIGIBLE` | Existing App Eligible | Step 3 (Auth) | Coexistence eligibility confirmed; advances to Step 4. |
| `SCENARIO_B_APP_INELIGIBLE` | Coexistence Ineligible | Step 3 (Auth) | Coexistence rejected under current rules; recommends Option B. |
| `SCENARIO_C_CLOUD_API` | Dedicated Cloud API | Step 2 & 4 | Dedicated Cloud API number path; advances cleanly. |
| `SCENARIO_D_AUTH_CANCELLED` | User Exits / Cancels | Step 3 (Auth) | Attempt marked `CANCELLED`; connection marked `FAILED`. |
| `SCENARIO_E_VERIFICATION_FAILED` | Invalid OTP Code | Step 4 (Verify) | Triggered when OTP != `123456`; attempts incremented; retry allowed. |
| `SCENARIO_F_BILLING_UNVERIFIED` | Billing Incomplete | Step 5 (Billing) | Billing marked `UNVERIFIED`; blocks live readiness. |
| `SCENARIO_G_WEBHOOK_UNVERIFIED` | Webhook Unsubscribed | Step 7 (Readiness) | Webhook remains `UNVERIFIED`; highlighted in diagnostics. |
| `SCENARIO_H_REAUTH_REQUIRED` | Reauthorization Needed | Lifecycle | Simulates expired Meta token requiring reconnection. |
| `SCENARIO_I_DISCONNECTED` | Disconnect Simulation | Teardown | Safe teardown; resets connection while preserving data. |

---

## 3. UI Stepper & Experience

Implemented in [`ConnectionWizardModal.jsx`](file:///c:/Users/Admin/Desktop/Relay-main/frontend/src/components/whatsapp/ConnectionWizardModal.jsx):
1. **Step 1 (Number):** International calling code selector and E.164 preview.
2. **Step 2 (Method):** Interactive selection cards for Option A (Coexistence) vs Option B (Cloud API).
3. **Step 3 (Auth):** Simulated Meta OAuth dialog with scenario selector.
4. **Step 4 (Verify):** 6-digit verification code input with `123456` test helper.
5. **Step 5 (Billing):** Customer-direct Meta billing explanation and zero liability acknowledgment.
6. **Step 6 (Relay Plan):** ₹799/month Launch Plan overview (Prompt 10 handoff).
7. **Step 7 (Readiness):** Independent readiness checklist and activation as `MOCK_SIMULATED_READY`.
