# Relay SaaS — Customer-Direct Meta Billing Safety (Phase 9 of 15)

## 1. Commercial Model & Financial Safeguards

Relay operates strictly as a SaaS technology provider. The commercial model guarantees zero messaging debt liability for Relay:

1. **Meta Messaging Charges:** Paid directly by each tenant business to Meta via their own payment method attached to their Meta Business Manager.
2. **Relay SaaS Subscription:** Charged separately for software access (₹799/month launch plan, implemented in SaaS Prompt 10).

---

## 2. Prohibition of Shared Partner Lines of Credit

Meta offers partner onboarding flows where a Tech Partner may attach a shared line of credit, making the partner financially liable for all outbound messaging volume across its customer accounts.

**Relay strictly rejects and forbids this arrangement.**

```javascript
// Hard Financial Guard in WhatsAppBillingReadinessService.js
assertZeroPartnerCreditSharing(payload) {
  if (payload && (payload.creditLineId || payload.partnerCredit || payload.sharedCredit)) {
    const err = new Error('FINANCIAL SECURITY VIOLATION: Relay strictly forbids sharing partner credit lines with tenant workspaces.');
    err.code = 'PARTNER_CREDIT_FORBIDDEN';
    err.status = 403;
    throw err;
  }
  return true;
}
```

### Prohibited Operations:
- ❌ Never attach Relay's line of credit to any workspace.
- ❌ Never invoke Meta credit-sharing APIs.
- ❌ Never enter Relay's credit card into a customer WABA.
- ❌ Never infer verified billing from phone verification alone.
- ❌ Never unblock live activation if customer-direct billing is unverified.

---

## 3. Independent Billing Readiness Data Model

Persisted in [`WhatsAppConnection.billingStatus`](file:///c:/Users/Admin/Desktop/Relay-main/backend/src/models/WhatsAppConnection.js):

| Billing Status | Can Activate Live? | Description |
|---|---|---|
| `UNVERIFIED` | **No** | Default initial state. Customer has not attached payment method to Meta. |
| `CUSTOMER_DIRECT_PENDING` | **No** | Payment method submitted to Meta; verification pending. |
| `CUSTOMER_DIRECT_VERIFIED` | **Eligible** | Direct billing verified. Zero liability for Relay. |
| `INELIGIBLE` | **No** | Meta flagged account as financially restricted or ineligible. |
| `FAILED` | **No** | Payment verification failed. Live activation blocked. |

---

## 4. Customer Billing UI Transparency

In Step 5 of the Connection Wizard:
- Clearly articulates: *"WhatsApp messaging fees are charged directly by Meta under your business's own Meta Business payment method."*
- Explains Relay's zero liability policy.
- Zero fake payment-card entry forms inside Relay.
- In Mock Mode, clearly labels verified billing as simulated for testing purposes.
