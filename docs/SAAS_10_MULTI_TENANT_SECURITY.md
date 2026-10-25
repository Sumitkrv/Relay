# SaaS 10 — Multi-Tenant Financial Security & Isolation

## 1. Architectural Principles
Relay enforces strict multi-tenant isolation across all financial layers:
1. **Tenant Association**: Every `Subscription`, `BillingPayment`, `TrialGrant`, and `UsageCounter` is indexed and queried by `workspaceId`.
2. **Owner-Only Authorization**: All subscription initiation, checkout verification, and cancellation actions verify that the authenticated user is an `OWNER` of the target workspace via `WorkspaceMembership`.
3. **No Cross-Tenant Visibility**: A customer in Workspace A cannot view, export, or access payments, subscriptions, or invoices belonging to Workspace B.

---

## 2. Adversarial Security Validations
- **Forged Workspace ID**: Attempting to supply another workspace ID in the request body is rejected; membership is validated against trusted server session data.
- **Reused Payment ID**: Payment records are enforced with a unique index on `providerPaymentId`. A payment ID cannot be re-submitted to activate a second workspace.
- **M2W Realty Legacy Policy**: M2W Luxury Realty is granted an explicit `LEGACY_ENTITLED` status tied to its genuine workspace ID, preventing accidental billing charges while preserving full platform reference capabilities.
