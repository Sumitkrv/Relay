# RELAY SAAS — PHASE 11: VERIFIED REVENUE ANALYTICS

## 1. Accounting Policy & Invariants

Relay's Platform Revenue Analytics (`/platform-admin/revenue`) adheres strictly to **cash-basis verified collections**:

1. **Captured Payments Only:**
   Revenue is calculated exclusively by summing genuine `BillingPayment` records with `status: 'captured'`.
2. **Refund Deductions:**
   Refunds (`status: 'refunded'`) are accurately summed and deducted from gross collections to calculate net collected revenue:
   $$\text{Net Revenue} = \text{Gross Captured Collections} - \text{Refunds}$$
3. **Strict Mode Separation (Live vs Test):**
   - **LIVE MODE:** Contains only captured payments with `billingEnvironment === 'LIVE'`.
   - **TEST MODE:** Contains sandbox checkouts with `billingEnvironment === 'TEST'`.
   - Test sandbox collections are **never** commingled with live commercial revenue.
4. **Zero Revenue Fabrication:**
   - Authorization-only transactions (`status: 'authorized'`) are excluded from collected revenue.
   - Operational entitlement grants (`LEGACY_ENTITLED` for M2W Realty) generate zero revenue.
   - Platform administrators cannot arbitrarily mark subscriptions as PAID or insert synthetic financial transactions.

---

## 2. API Contract

### `GET /api/platform-admin/revenue`

**Query Parameters:**
- `environment`: `'LIVE'` (default) or `'TEST'`
- `dateRange`: `'all'` (default), `'today'`, `'7d'`, `'30d'`, `'this_month'`

**Response Schema:**
```json
{
  "environment": "LIVE",
  "dateRange": "all",
  "grossCollectedMinor": 79900,
  "grossFormatted": "₹799.00",
  "refundsMinor": 0,
  "refundsFormatted": "₹0.00",
  "netCollectedMinor": 79900,
  "netFormatted": "₹799.00",
  "paidPaymentCount": 1,
  "failedPaymentCount": 0,
  "distinctPayingWorkspaces": 1,
  "monthlyTrend": [
    {
      "month": "2026-10",
      "amountPaise": 79900,
      "amountFormatted": "₹799",
      "count": 1
    }
  ],
  "recentPayments": [
    {
      "id": "60c72b2f9b1d8b2bad5e0001",
      "providerPaymentId": "pay_live_123456",
      "workspaceName": "FitZone Gym",
      "amountMinor": 79900,
      "amountFormatted": "₹799.00",
      "currency": "INR",
      "status": "captured",
      "method": "mandate",
      "cardLast4": "4242",
      "paidAt": "2026-10-21T06:30:00.000Z"
    }
  ],
  "disclaimer": "LIVE MODE: Genuine collected subscription revenue. Meta messaging fees and operational grants excluded."
}
```
