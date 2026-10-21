# SaaS 10 — Invoice Management & Tax Readiness

## 1. Provider Payment Receipts
When Razorpay captures a recurring subscription payment:
- The authoritative `providerPaymentId` and `providerInvoiceId` are stored in the `billingpayments` MongoDB collection.
- Non-sensitive payment metadata (e.g. card network, `last4`, payment method) is saved for client reference.
- Clients can view and verify transaction IDs directly in the Billing Dashboard (`/app/settings/billing`).

---

## 2. Tax Invoice Configuration Status
- **Current Billing Currency**: INR (Indian Rupee).
- **Tax Model**: Tax-exclusive pricing by default.
- **GST Compliance Note**: Issuing formal GST tax invoices requires legal entity verification, registered office address, and GSTIN registration confirmation.
- **Safeguard**: Relay displays genuine provider payment receipts and does NOT fabricate fake GST tax invoices, fictitious GSTINs, or arbitrary CGST/SGST breakdowns prior to commercial tax review.
