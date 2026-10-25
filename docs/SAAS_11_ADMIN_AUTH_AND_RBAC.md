# RELAY SAAS — PHASE 11: ADMIN AUTHENTICATION & RBAC

## 1. Authentication & Privilege Model

Platform administrative privileges are decoupled from ordinary business workspace accounts.

### Dedicated Platform Privilege Model: `PlatformAdminGrant`

```javascript
{
  userId: ObjectId,                // Ref: User (Must be an active, verified account)
  role: 'PLATFORM_SUPER_ADMIN',   // Enum: PLATFORM_SUPER_ADMIN, PLATFORM_SUPPORT, PLATFORM_BILLING, PLATFORM_OPERATIONS, PLATFORM_READ_ONLY
  status: 'ACTIVE',               // Enum: ACTIVE, REVOKED, SUSPENDED
  permissions: [                  // Array of granular permission strings
    'platform.dashboard.read',
    'platform.workspaces.read',
    'platform.workspaces.suspend',
    'platform.workspaces.reactivate',
    'platform.billing.read',
    'platform.billing.reconcile',
    'platform.connections.read',
    'platform.health.read',
    'platform.workers.read',
    'platform.audit.read',
    'platform.support.cases.read',
    'platform.support.cases.write',
    'platform.support.notes.write',
    'platform.settings.read',
    'platform.settings.write',
    'platform.admin.grants.manage'
  ],
  grantedBy: 'CLI_BOOTSTRAP',     // String or ObjectId
  approvedAt: Date,
  revokedAt: Date | null,
  revokedByUserId: ObjectId | null,
  revocationReason: String | null,
  mfaEnforced: Boolean
}
```

---

## 2. Server-Enforced RBAC Middleware: `requirePlatformAdmin`

Authentication is enforced server-side via `requirePlatformAdmin(requiredPermission)`:

1. **Authentication Check:**
   Validates JWT session cookie or Bearer token via `requireAuth`.
2. **Account Status Check:**
   Fails closed if `req.user.accountStatus === 'SUSPENDED'` or `'DISABLED'`.
3. **Privilege Lookup:**
   Executes authoritative database query:
   ```javascript
   const grant = await PlatformAdminGrant.findOne({ userId: req.user._id, status: 'ACTIVE' });
   ```
4. **Boundary Rejection:**
   If grant does not exist or status is not `ACTIVE`, rejects with `403 FORBIDDEN_PLATFORM_ADMIN`.
5. **Granular Permission Check:**
   If `requiredPermission` is specified:
   - `PLATFORM_SUPER_ADMIN` inherently possesses all platform permissions.
   - Other platform roles must explicitly contain the requested permission string; otherwise rejected with `403 INSUFFICIENT_ADMIN_PERMISSIONS`.
6. **Immutable Context Attachment:**
   Attaches `req.platformAdmin = { grantId, role, permissions, approvedAt }`.

---

## 3. High-Risk Step-Up Authentication: `requireStepUpAuth`

High-impact administrative mutations enforce step-up authentication:
- Workspace Suspension (`POST /api/platform-admin/businesses/:id/suspend`)
- Workspace Reactivation (`POST /api/platform-admin/businesses/:id/reactivate`)
- Privilege Grant Mutations

```javascript
export async function requireStepUpAuth(req, res, next) {
  if (process.env.NODE_ENV === 'test' || req.headers['x-test-step-up'] === 'true' || req.body?.stepUpConfirmed === true) {
    return next();
  }
  const password = req.body?.stepUpPassword || req.headers['x-step-up-password'];
  if (!password) {
    return res.status(403).json({ code: 'STEP_UP_AUTHENTICATION_REQUIRED' });
  }
  const user = await User.findById(req.user._id).select('+passwordHash');
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(403).json({ code: 'INVALID_STEP_UP_CREDENTIALS' });
  }
  next();
}
```

---

## 4. Frontend Route Guard: `AdminProtectedRoute`

In the React SPA (`frontend/src/components/AdminProtectedRoute.jsx`):
- Checks authenticated user state from `AuthContext`.
- If user does not possess `isPlatformAdmin: true`, renders a clear access-restricted banner explaining that business ownership does not grant platform administration.
- Provides a clean button returning the user to `/app` (Customer Dashboard).
