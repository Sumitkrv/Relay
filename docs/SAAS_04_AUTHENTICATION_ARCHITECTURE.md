# SaaS Architecture Document: Customer Authentication & Session Security
**Phase:** SaaS Prompt 4 of 15  
**Version:** 1.0.0  
**Scope:** Complete Production-Grade Customer Authentication, Session Management, Account Status Lifecycle & Workspace Handoff  

---

## 1. Executive Summary

SaaS Prompt 4 implements a complete, genuinely functioning, multi-tenant customer authentication and session management architecture inside the existing Relay WhatsApp Automation SaaS codebase. It transitions Relay from a single-business platform into a commercial SaaS capable of safely self-onboarding prospective customers while rigorously preserving the existing M2W Realty business workspace, data boundaries, and authorized operational workflows.

### Core Architectural Guarantees
1. **Real MongoDB Persistence:** Every customer registration creates an authoritative `User` record in MongoDB with password hashed using `bcrypt` (12 salt rounds) and status initialized to `PENDING_EMAIL_VERIFICATION`.
2. **Cryptographic Token Lifecycle:** Email verification and password reset tokens use 256-bit cryptographically secure pseudorandom numbers (`crypto.randomBytes(32)`). Tokens are stored only as SHA-256 hashes (`crypto.createHash('sha256')`) with explicit purpose binding (`EMAIL_VERIFICATION`, `PASSWORD_RESET`), TTL expiration, and atomic single-use consumption.
3. **Transactional Email Service Abstraction:** Reusable provider adapter supporting Resend, SMTP, and an in-process memory mailbox for zero-leak isolated automated testing.
4. **Authoritative Account Status Lifecycle:** Four validated operational states: `PENDING_EMAIL_VERIFICATION`, `ACTIVE`, `SUSPENDED`, and `DISABLED`. All authentication middleware (`requireAuth`, `requireTenant`) enforces account status before granting access.
5. **Session Revocation via `authVersion`:** Successful password resets or explicit session revocations atomically increment `authVersion` on the `User` record. All active JWTs signed with previous versions are invalidated immediately on subsequent requests.
6. **Workspace-Aware Post-Login Routing:** Post-login authorization inspects authorized `WorkspaceMembership` records. Existing workspace owners (M2W Realty) route directly to `/app`. Newly verified customers with zero workspaces route directly to `/onboarding` (the clean handoff boundary for Prompt 5). Unverified accounts are restricted to `/verify-email`.
7. **Strict Tenant & Legacy Protection:** Legacy M2W accounts with active memberships are grandfathered as verified without hardcoding email strings. Newly registered users receive zero default workspaces and cannot access M2W business records under any circumstance.

---

## 2. Component Architecture & System Boundaries

```
[ Public Web Visitor ]
          │
          ▼
   /signup (React 18)
          │  POST /api/auth/register
          ▼
[ Express API Router: /api/auth ]
   ├── authRateLimiter (Per-IP & Per-Account Abuse Guard)
   └── authController.register()
          │
          ├── Server-side Validation (Name, Email, Password, Terms)
          ├── Normalized Email & Uniqueness Check (User.findOne)
          ├── Strict Payload Whitelisting (Strip role, isPlatformAdmin, workspaceId)
          ├── Hash Password (bcryptjs, 12 rounds)
          ├── User.create({ accountStatus: 'PENDING_EMAIL_VERIFICATION' })
          │
          ├── authSecurityService.createEmailVerificationToken(user._id)
          │     ├── crypto.randomBytes(32).toString('hex')
          │     ├── SHA-256 hash
          │     └── AuthToken.create({ purpose: 'EMAIL_VERIFICATION', expiresAt: +24h })
          │
          └── emailService.sendVerificationEmail(email, name, rawToken)
                ├── Resend / SMTP / Test Sink
                └── Return Safe Sanitized User Response (No tokens, no hashes)
```

---

## 3. Database Schema & Data Models

### 3.1 User Model (`backend/src/models/User.js`)
Extended to support account status, verification timestamps, and security audit fields:

```javascript
{
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  role: { type: String, default: 'STAFF', enum: ['OWNER', 'STAFF', 'OPERATOR'] },
  accountStatus: {
    type: String,
    enum: ['PENDING_EMAIL_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DISABLED'],
    default: 'PENDING_EMAIL_VERIFICATION',
    index: true,
  },
  emailVerifiedAt: { type: Date, default: null },
  verificationEmailLastSentAt: { type: Date, default: null },
  authVersion: { type: Number, default: 1 },
  lastLoginAt: { type: Date, default: null }
}
```

### 3.2 AuthToken Model (`backend/src/models/AuthToken.js`)
Purpose-bound, cryptographically hashed token persistence:

```javascript
{
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tokenHash: { type: String, required: true, index: true },
  purpose: {
    type: String,
    enum: ['EMAIL_VERIFICATION', 'PASSWORD_RESET'],
    required: true,
    index: true,
  },
  expiresAt: { type: Date, required: true, index: { expires: '7d' } },
  isConsumed: { type: Boolean, default: false, index: true },
  consumedAt: { type: Date, default: null },
  metadata: {
    ip: { type: String },
    userAgent: { type: String }
  }
}
```

**Index Strategy:**
- Compound index `{ tokenHash: 1, purpose: 1, isConsumed: 1 }` for high-throughput single-query token validation.
- Index `{ userId: 1, purpose: 1, isConsumed: 1 }` for fast active token invalidation upon resend or rotation.
- TTL Index `{ expiresAt: 1 }` with 7-day retention for audit compliance before MongoDB background pruning.

---

## 4. Session & Cookie Architecture

Relay uses dual-mode session management:
1. **HttpOnly Session Cookie (`relay_jwt`):**
   - `httpOnly: true` (prevents XSS exfiltration).
   - `secure: process.env.NODE_ENV === 'production'` (enforces HTTPS in production).
   - `sameSite: 'lax'` (guards against CSRF on state-changing cross-site requests).
   - `path: '/'`
   - `maxAge: 7 * 24 * 60 * 60 * 1000` (7 days).
2. **Bearer Token Header (`Authorization: Bearer <jwt>`):**
   - Supported for programmatic clients, automated test suites, and mobile browsers where third-party cookie restrictions apply.

### JWT Payload
```json
{
  "id": "673f1234abcd5678ef901234",
  "ver": 3,
  "iat": 1729440000,
  "exp": 1730044800
}
```

### Verification & Session Revocation Policy
During every authenticated request, `requireAuth` middleware executes:
1. Decodes JWT token and validates signature using `process.env.JWT_SECRET`.
2. Fetches user from database via `User.findById(payload.id).select('+password')`.
3. Verifies `user.authVersion === payload.ver`. If `authVersion` was bumped (e.g., following a password reset or admin revocation), the request fails immediately with `401 Unauthorized` (`SESSION_REVOKED`).
4. Verifies `user.accountStatus` is not `'SUSPENDED'` or `'DISABLED'`. Suspended accounts are immediately rejected with `403 Forbidden` (`ACCOUNT_SUSPENDED`).

---

## 5. Legacy M2W Account Compatibility Policy

To uphold the zero-data-loss mandate from Prompts 1 and 2, existing M2W workspace owners must never lose access:
1. **No Hardcoded Emails:** Compatibility is strictly determined by authoritative database state via `authSecurityService.isLegacyOrAuthorizedUser(user)`.
2. **Membership Inspection:** If an account lacks `emailVerifiedAt` or has legacy status, the system inspects `WorkspaceMembership.find({ userId: user._id, status: 'ACTIVE' })`.
3. **Lazy Grandfathering:** If active business workspace memberships are present, the account is recognized as an authorized legacy operator and lazily grandfathered (`accountStatus = 'ACTIVE'`, `emailVerifiedAt = user.createdAt || new Date()`).
4. **Zero Impact on New Registrations:** Newly registered customers have zero workspace memberships and therefore must complete email verification before gaining login eligibility.

---

## 6. Workspace-Aware Redirect Policy

| Case | Account Status | Workspace Membership | Destination Route | Rationale |
|---|---|---|---|---|
| **Case A** | `ACTIVE` | Has active workspace (`OWNER`/`STAFF`) | `/app` | Existing M2W owner or onboarded customer accesses authorized business dashboard. |
| **Case B** | `ACTIVE` | No workspaces | `/onboarding` | Verified customer awaits Prompt 5 Business Onboarding Wizard. |
| **Case C** | `PENDING_EMAIL_VERIFICATION` | None | `/verify-email` | Unverified accounts are strictly blocked from dashboard and onboarding. |
| **Case D** | `SUSPENDED` / `DISABLED` | Any | `/login` (Restricted Notice) | Account is locked by platform security. |
| **Case E** | Unauthenticated | None | `/login` | Public user directed to authentication. |

---

## 7. Security Controls & Threat Defense Matrix

| Threat | Defense Implementation | Verified Test Scenario |
|---|---|---|
| **Privilege Escalation** | `register` handler explicitly extracts only `{ name, email, password }` and ignores malicious keys (`role`, `isPlatformAdmin`, `workspaceId`). | Test 10-12: Untrusted role/emailVerified/workspaceId injection |
| **Email Enumeration** | `forgotPassword` and `resendVerification` return generic success responses regardless of whether the email exists. | Test 38: Unknown-email enumeration protection |
| **Token Guessing / Brute Force** | 256-bit cryptographically secure tokens (entropy > 2^128). | Test 14-15: Token generation & SHA-256 storage |
| **Token Replay Attacks** | Atomic `findOneAndUpdate({ tokenHash, isConsumed: false }, { isConsumed: true })`. | Test 21 & 42: Token replay rejected |
| **Cross-Tenant Access** | Backend `requireTenant` middleware asserts membership on `x-workspace-id`. New accounts have 0 memberships. | Test 47-49: Cross-tenant isolation |
| **Concurrent Duplicate Signups** | MongoDB unique index on normalized `email` plus application-level handling of duplicate key error `11000`. | Test 7 & 9: Concurrent duplicate registration |
| **Zombie Sessions After Password Reset** | Atomically increment `user.authVersion += 1` on password reset; existing JWTs are rejected. | Test 45-46: Old password & old sessions revoked |
