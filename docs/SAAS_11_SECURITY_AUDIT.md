# RELAY SAAS — PHASE 11: SECURITY AUDITING & COMPLIANCE

## 1. Audit Logging Architecture

Every administrative mutation is recorded in `PlatformAuditLog` (`/platform-admin/security`).

### Stored Record Schema:
```javascript
{
  adminUserId: ObjectId,           // Operator user identity
  platformRole: String,            // PLATFORM_SUPER_ADMIN, PLATFORM_SUPPORT, etc.
  actionType: String,              // workspace_suspended, workspace_reactivated, admin_grant_created, etc.
  targetResourceType: String,      // WORKSPACE, PLATFORM_GRANT, BILLING, SUPPORT_CASE, SYSTEM
  targetResourceId: String,        // Target ObjectId string
  reason: String,                  // Substantive reason (min 5 characters)
  outcome: 'SUCCESS' | 'FAILED',   // Operation result
  ipAddress: String,               // Masked client IP
  userAgent: String,
  correlationId: String,           // Unique trace ID (e.g. adm_1729500000_abc123)
  metadata: Object,                // Sanitized before/after metadata
  createdAt: Date                  // Immutable timestamp
}
```

---

## 2. Automatic Credential & Content Redaction

Before writing to MongoDB, the `sanitizeAuditMetadata` pre-save hook recursively inspects all metadata keys and sanitizes sensitive fields:

```javascript
const REDACTED_KEYS = new Set([
  'password', 'passwordhash', 'token', 'session', 'secret',
  'key_secret', 'authorization', 'card', 'cvv', 'body',
  'messagetext', 'accesstoken', 'refreshtoken'
]);
```

Any key that matches or contains `token`, `password`, `secret`, `card`, `cvv`, `session`, or `messagetext` is automatically replaced with `'[REDACTED]'`.

---

## 3. Immutability Protections

1. **No Mutation Endpoints:** No administrative endpoint exists to edit or delete `PlatformAuditLog` entries.
2. **Strict Mongoose Schema:** `strict: 'throw'` and `timestamps: { createdAt: true, updatedAt: false }`.
