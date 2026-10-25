# RELAY SAAS — PHASE 11: SAFE FIRST ADMIN BOOTSTRAP

## 1. Overview

In accordance with enterprise SaaS security standards, Relay does **not** provide a public "Become Admin" endpoint, automatic first-user elevation, or hardcoded admin credentials. Provisioning of the initial Platform Super Admin is conducted exclusively through a secure, server-side Command Line Interface (CLI) script:

`backend/src/scripts/bootstrapPlatformAdmin.js`

---

## 2. CLI Execution Instructions

### A. Bootstrap by Email

```bash
# In the repository root:
node backend/src/scripts/bootstrapPlatformAdmin.js --email operator@relayops.io
```

### B. Bootstrap by MongoDB User ID

```bash
node backend/src/scripts/bootstrapPlatformAdmin.js --userId 60c72b2f9b1d8b2bad5e1234
```

---

## 3. Operational Invariants

1. **Operator-Controlled Environment:**
   - Must be executed directly on the application host or secure bastion server with access to `process.env.MONGODB_URI`.
   - Never exposed over HTTP or public network endpoints.

2. **Explicit Target Identity:**
   - Requires an existing registered and verified `User` account.
   - Refuses to elevate `SUSPENDED` or `DISABLED` accounts.

3. **Idempotent Behavior:**
   - If the user already possesses an `ACTIVE` grant, the script exits cleanly (`code 0`) without duplicate mutations or database corruption.
   - If the user had a previously `REVOKED` grant, the script reactivates the grant, updates `approvedAt`, and records an audit log.

4. **Tamper-Evident Audit Trail:**
   - Automatically writes an entry to `PlatformAuditLog`:
     - `actionType`: `admin_grant_created` or `admin_grant_reactivated`
     - `targetResourceType`: `PLATFORM_GRANT`
     - `reason`: `Initial bootstrap via secure operator CLI`
     - `outcome`: `SUCCESS`

5. **No Automatic M2W Owner Elevation:**
   - Historical M2W Realty ownership is strictly a customer workspace relationship (`role: 'OWNER'`).
   - The M2W owner is not elevated to Platform Super Admin unless explicitly invoked by the platform operator via this CLI.
