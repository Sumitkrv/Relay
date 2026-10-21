# RELAY SAAS — PHASE 11: PLATFORM SUPER ADMIN ARCHITECTURE

## 1. System Overview

The **Relay Platform Super Admin** is an enterprise-grade administration and observability command center designed to operate the Relay Multi-Tenant WhatsApp Automation SaaS platform. It establishes a completely separate, server-enforced privilege domain (`/platform-admin` and `/api/platform-admin`) that is entirely isolated from tenant customer workspaces (`/app`).

```
+--------------------------------------------------------------------------------------------------+
|                                    RELAY PLATFORM ARCHITECTURE                                   |
+--------------------------------------------------------------------------------------------------+
|                                                                                                  |
|   +------------------------------------+             +---------------------------------------+   |
|   |   CUSTOMER WORKSPACE (/app)        |             |   PLATFORM SUPER ADMIN                |   |
|   |   • Multi-Tenant Business Users    |             |   (/platform-admin)                   |   |
|   |   • Workspace Membership (OWNER)   |             |   • Platform Operator                 |   |
|   |   • Contacts, Campaigns, Inboxes   |             |   • PlatformAdminGrant                |   |
|   |   • Tenant Settings & Billing      |             |   • Telemetry, Health, Revenue        |   |
|   +-----------------+------------------+             +-------------------+-------------------+   |
|                     |                                                    |                       |
|                     v                                                    v                       |
|   +------------------------------------+             +---------------------------------------+   |
|   |   requireWorkspace Middleware      |             |   requirePlatformAdmin Middleware     |   |
|   |   • Checks Membership.role         |             |   • Checks PlatformAdminGrant         |   |
|   |   • Enforces Workspace Status      |             |   • Ignores Client Flags/Workspace    |   |
|   |   • Tenant-Scoped Projections      |             |   • Granular Permission Matrix        |   |
|   +-----------------+------------------+             +-------------------+-------------------+   |
|                     |                                                    |                       |
|                     +-----------------------+   +------------------------+                       |
|                                             |   |                                                |
|                                             v   v                                                |
|                     +------------------------------------------------+                           |
|                     |           MONGODB PERSISTENCE LAYER            |                           |
|                     |   • Workspaces & WorkspaceMemberships          |                           |
|                     |   • Subscriptions & BillingPayments            |                           |
|                     |   • WhatsAppConnections & Messages             |                           |
|                     |   • PlatformAdminGrants & PlatformAuditLogs    |                           |
|                     |   • SupportCases & Internal Notes              |                           |
|                     +------------------------------------------------+                           |
|                                                                                                  |
+--------------------------------------------------------------------------------------------------+
```

---

## 2. Core Architectural Principles

1. **Strict Privilege Separation:**
   - Business ownership (`WorkspaceMembership.role === 'OWNER'`) grants rights *only* within that tenant's workspace boundary. It conveys **zero** platform administration rights.
   - Platform administration requires an explicit `PlatformAdminGrant` stored in MongoDB and verified server-side on every request.

2. **Zero Customer Impersonation:**
   - No "Login as Customer" or synthetic session generation is implemented. Platform operators cannot inspect private customer message bodies or browse private contact directories.

3. **Data Redaction & Privacy Preservation:**
   - Administrative APIs return masked identifiers (e.g. `a***n@domain.com`, `+9198****321`).
   - Audit logging automatically intercepts and redacts sensitive keys (passwords, tokens, sessions, API secrets, private chat contents).

4. **Fail-Closed Meta WhatsApp Safety:**
   - Live Meta Cloud API outbound sending is disabled platform-wide. All outbound campaigns execute exclusively through the multi-tenant simulated queue worker.

5. **Financial Ledger Integrity:**
   - Revenue analytics calculate verified cash collections from captured provider transactions (`BillingPayment`).
   - Sandbox test checkouts are strictly separated from Live revenue metrics. Operational entitlement grants (`LEGACY_ENTITLED`) are never counted as revenue.

---

## 3. Component Architecture

| Module | Route / Endpoint | Description |
|---|---|---|
| **Overview Command Center** | `/platform-admin/overview` | Platform KPI telemetry: non-archived workspaces, paid subscriptions, trialing counts, verified live revenue, queue backlog, and industry distribution. |
| **Business Directory** | `/platform-admin/businesses` | Tenant search, industry filtering, status filtering, pagination, operational workspace detail, and controlled suspension/reactivation. |
| **Workspace Profile** | `/platform-admin/businesses/:id` | Operational telemetry per workspace (owner summary, plan status, connection state, message counts, and audit logs). |
| **Subscription Monitoring**| `/platform-admin/subscriptions` | Centralized tracking of tenant subscription plans, trial expiration dates, billing environments (TEST vs LIVE), and renewal states. |
| **Verified Revenue** | `/platform-admin/revenue` | Authoritative financial ledger reporting gross collections, refunds, net collections, and monthly trends with strict Test vs Live mode isolation. |
| **WhatsApp Health** | `/platform-admin/whatsapp-connections` | Health observability for customer connections, mock simulation states, and customer-direct Meta billing enforcement verification. |
| **System & Worker Health** | `/platform-admin/system-health` | MongoDB connection status, queue backlog depth, worker daemon heartbeats, and fail-closed safety state monitoring. |
| **Security & Audit** | `/platform-admin/security` | Append-only audit trail logging administrative actions, operator identities, correlation IDs, substantive reasons, and sanitized parameters. |
| **Support Operations** | `/platform-admin/support` | Scoped customer support cases, issue categories, triage priorities, and internal administrative notes. |
| **Platform Settings** | `/platform-admin/settings` | Read-only configuration inspection: 14-day trial policy, ₹799 launch plan, branding tokens, and security invariants. |
