# RELAY SAAS — PHASE 11: BUSINESS DIRECTORY & WORKSPACE MANAGEMENT

## 1. Business Directory & Filtering

The Platform Admin Business Directory (`/platform-admin/businesses`) provides comprehensive visibility into all registered SaaS tenant businesses.

### Search & Filtering Capabilities:
- **Search Query:** Matches workspace name, slug, or business email using safe regex escaping.
- **Status Filter:** `ACTIVE`, `SUSPENDED`, `PROVISIONING` (excludes `ARCHIVED` by default).
- **Industry Filter:** `real_estate`, `gym`, `clinic`, `education`, `salon`, `automobile`, `other`.
- **Subscription Filter:** `ACTIVE`, `TRIALING`, `PAST_DUE`, `PAYMENT_PENDING`, `HALTED`, `CANCELLED`.
- **Server Pagination:** Paginated skip/limit execution (`default 15, max 100`) preventing unbounded database reads.
- **Sorting Allowlist:** `-createdAt`, `createdAt`, `name`, `-name`, `status`.

---

## 2. Workspace Suspension Architecture

When a business workspace requires suspension (e.g. Terms of Service violation, payment fraud, or administrative investigation):

```
+---------------------------------------------------------------------------------+
|                       WORKSPACE SUSPENSION SAFETY LIFECYCLE                     |
+---------------------------------------------------------------------------------+
|                                                                                 |
|   1. Operator Request:                                                          |
|      POST /api/platform-admin/businesses/:id/suspend                            |
|      • Verified Platform Admin Session                                          |
|      • Substantive Reason (min 5 characters)                                    |
|      • Step-Up Password Confirmation                                            |
|                                                                                 |
|   2. Database Mutation:                                                         |
|      • Workspace.status = 'SUSPENDED'                                           |
|      • Workspace.suspendedAt = now                                              |
|      • Workspace.suspendedReason = reason                                       |
|      • Workspace.suspendedBy = adminUserId                                      |
|                                                                                 |
|   3. Customer Route Fail-Closed Enforcement:                                    |
|      • requireWorkspace middleware immediately rejects all requests from this   |
|        tenant with:                                                             |
|        403 { code: 'WORKSPACE_SUSPENDED', message: 'Workspace is suspended' }   |
|                                                                                 |
|   4. Queue Dispatch Safety:                                                     |
|      • messageQueueService checks workspace status on every claimed job:        |
|        If SUSPENDED -> message reverted to QUEUED, lease released, dispatch     |
|        paused. Jobs are NEVER deleted or silently failed.                       |
|                                                                                 |
|   5. Data Preservation:                                                         |
|      • Contacts, templates, campaigns, inboxes, and historical analytics        |
|        remain 100% intact in MongoDB.                                           |
|                                                                                 |
|   6. Platform Audit Log:                                                        |
|      • Action recorded in PlatformAuditLog with operator identity & reason.     |
|                                                                                 |
+---------------------------------------------------------------------------------+
```

---

## 3. Workspace Reactivation Architecture

When the suspension trigger is resolved:
1. Operator invokes `POST /api/platform-admin/businesses/:id/reactivate` with a documented reason and step-up authentication.
2. `Workspace.status` reverts to `'ACTIVE'`.
3. `reactivatedAt` and `reactivationReason` are stamped.
4. `requireWorkspace` automatically restores customer access.
5. Background worker resumes processing queued campaign messages safely.
6. The entire lifecycle is recorded in `PlatformAuditLog`.
