# RELAY — SECURITY ARCHITECTURE & DATA GOVERNANCE
## Multi-Tenant Isolation, Authentication, Consent Compliance & Platform Hardening

> **Document Version:** 1.0.0 (Master Security Specification)  
> **Status:** Active / Source of Truth  
> **Security Baseline:** OWASP Top 10 API Security Compliance  
> **Primary Enforcement Middleware:**  
> - [`backend/src/middleware/auth.js`](file:///Users/sumitthakur/Desktop/Relay/backend/src/middleware/auth.js)  
> - [`backend/src/middleware/requireWorkspace.js`](file:///Users/sumitthakur/Desktop/Relay/backend/src/middleware/requireWorkspace.js)  
> - [`backend/src/middleware/adminAuth.js`](file:///Users/sumitthakur/Desktop/Relay/backend/src/middleware/adminAuth.js)  

---

## 1. Authentication & Session Management

### 1.1 JSON Web Token (JWT) Security
- **Algorithm & Secret:** Signed with HMAC-SHA256 (`HS256`).
- **Secret Length Enforcement:** The backend enforces startup verification in [`backend/src/server.js`](file:///Users/sumitthakur/Desktop/Relay/backend/src/server.js):
  ```javascript
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be configured with at least 32 characters');
  }
  ```
- **Cookie Flags:** Stored in a secure `httpOnly` cookie (`session`) with flags:
  - `httpOnly: true` (inaccessible to JavaScript `document.cookie` to mitigate XSS attacks).
  - `SameSite: 'Lax'` (mitigates Cross-Site Request Forgery / CSRF).
  - `secure: true` in production environments (transmitted exclusively over HTTPS).

### 1.2 Session Invalidation & Rotation (`authVersion`)
To prevent hijacked or stale sessions from remaining active after password changes or administrative revocation:
- Each `User` model stores an integer: `authVersion: { type: Number, default: 1 }`.
- When an account rotates its password or triggers a security logout, `authVersion` increments in MongoDB.
- [`requireAuth`](file:///Users/sumitthakur/Desktop/Relay/backend/src/middleware/auth.js) compares the token payload `ver` against the database `user.authVersion`. If they mismatch, the session is rejected with `401 Session has expired due to security updates`.

### 1.3 Password Hashing Standards
- **Hashing Algorithm:** `bcryptjs` with salt round cost factor $\ge 10$.
- **Plaintext Prohibition:** Passwords are never stored in plaintext, logged, or included in JSON responses (`select: false` on the Mongoose schema).
- **Password Reset Mechanism:** Password reset tokens are generated using cryptographically secure random bytes (`crypto.randomBytes(32)`), stored as a SHA-256 hash in the database, and bound to a 60-minute expiration window.

---

## 2. Multi-Tenant Authorization & Data Isolation

### 2.1 Workspace Resolution Pipeline (`requireWorkspace.js`)
Multi-tenant isolation is enforced at the network entry point via [`requireWorkspace.js`](file:///Users/sumitthakur/Desktop/Relay/backend/src/middleware/requireWorkspace.js):
1. **Authentication Precondition:** Rejects unauthenticated requests with `401 AUTHENTICATION_REQUIRED`.
2. **Format Validation:** Validates `x-workspace-id` using `mongoose.isObjectIdOrHexString` to block NoSQL injection vectors.
3. **Database Authorization Verification:** Queries `WorkspaceMembership` to guarantee the authenticated `req.user._id` holds an active membership for the requested `workspaceId`.
4. **Tenant Status Verification:** Checks workspace lifecycle. If `SUSPENDED` or `ARCHIVED`, access is immediately denied (`403 FORBIDDEN`).
5. **Tamper-Proof Request Context:** Attaches immutable request properties via `Object.defineProperty`:
   - `req.workspace` (the verified Workspace document)
   - `req.workspaceId` (the active Workspace ObjectId)
   - `req.workspaceMembership` (the user's role and permission set)

### 2.2 Role-Based Access Control (RBAC) Hierarchy
- `OWNER`: Full administrative control, billing management, user invitation, workspace deletion.
- `ADMIN`: Campaign execution, template publishing, contact export, rule management.
- `MEMBER`: View contacts, compose messages, review analytics, author drafts.
- `AGENCY_DELEGATE`: Delegated agency access bound to strict client workspace permissions.
- `SUPERADMIN`: Platform-wide administrative oversight (isolated behind `/api/admin` and `requireSuperAdmin`).

---

## 3. WhatsApp Consent Compliance & Anti-Spam Architecture

Relay is architected to adhere strictly to Meta's WhatsApp Business Messaging Policies and global telecommunications anti-spam regulations (TRAI DND, TCPA, GDPR).

### 3.1 Affirmative Consent Verification Gate
- **Pre-Broadcast Gating:** The [`eligibilityValidationService.js`](file:///Users/sumitthakur/Desktop/Relay/backend/src/services/eligibilityValidationService.js) checks every contact prior to inclusion in any campaign or automated broadcast.
- **Strict Rule:** A contact is eligible for automated WhatsApp messaging **only if**:
  $$\text{whatsappConsentStatus} === \text{'Opted In'} \quad \land \quad \text{isSuppressed} === \text{false} \quad \land \quad \text{isArchived} === \text{false}$$
- **Default State:** All imported or newly created contacts default to `whatsappConsentStatus: 'Unknown'` until explicit consent evidence is recorded in `consentrecords`.

### 3.2 Instant Compliance Opt-Out ("STOP" Processing)
- **Keyword Monitoring:** The auto-reply engine monitors inbound messages for compliance keywords: `STOP`, `UNSUBSCRIBE`, `CANCEL`, `HALT`, `OPT-OUT`.
- **Immediate Action:** When matched, the system automatically:
  1. Sets `contact.whatsappConsentStatus = 'Opted Out'`.
  2. Sets `contact.isSuppressed = true` with `suppressionReason: 'User requested opt-out via keyword'`.
  3. Appends an audit record to `consentrecords` (`action: 'OPT_OUT'`).
  4. Ceases all automated message jobs for that phone number across the workspace.

---

## 4. Mock Mode & External API Safeguards

### 4.1 Zero-Egress Mock Sandbox
- Relay operates in an offline **Mock Mode** (`mockMode: true`).
- The messaging provider registry routes outbound dispatches to [`mockWhatsAppProvider.js`](file:///Users/sumitthakur/Desktop/Relay/backend/src/services/mockWhatsAppProvider.js).
- **Physical Barrier:** No HTTP calls to `graph.facebook.com` or live Meta webhooks are executed.
- **Accidental Send Prevention:** Test simulators (`/dev/mock-messaging`) create internal `ConversationMessage` records tagged with `trustLevel: 'synthetic'`, preventing any leakage into genuine customer channels.

### 4.2 Local Developer Mailbox
- In development/test mode, password reset links and email verification tokens are routed to an internal in-memory collection (`devMailboxController.js`).
- Tokens are viewable at `/dev/mailbox` without connecting to external SMTP gateways or transmitting emails across public networks.

---

## 5. Security Vulnerability Mitigation & Code Evidence

| OWASP Threat Category | Mitigation Implemented | Verified Source Code Reference |
|---|---|---|
| **Broken Object Level Auth (BOLA)** | Every database query filters by `workspaceId: req.workspaceId` or `ownerId: req.user._id`. | `backend/src/controllers/contactController.js` |
| **Broken User Auth** | Salted bcrypt passwords, `authVersion` session invalidation, minimum 32-char JWT secret. | `backend/src/middleware/auth.js` |
| **Excessive Data Exposure** | Password hashes and sensitive credentials explicitly omitted from JSON responses (`select: false`). | `backend/src/models/User.js` |
| **Rate Limiting & DoS** | `express-rate-limit` throttles auth endpoints to prevent brute-force attacks (max 20 req/min). | `backend/src/routes/authRoutes.js` |
| **NoSQL Injection** | Mongoose schemas enforce `strict: 'throw'`, casting object IDs before querying database. | `backend/src/middleware/requireWorkspace.js` |
| **Security Misconfiguration** | `helmet()` sets standard HTTP security headers (HSTS, X-Content-Type-Options, Frameguard). | `backend/src/app.js` |
| **Cross-Site Scripting (XSS)** | React JSX escapes output by default; cookies use `httpOnly: true`. | `backend/src/controllers/authController.js` |

---

## 6. Audit Logging & Data Provenance

1. **Security Audit Log:** Critical events (failed logins, workspace membership changes, role elevations, data exports) are written to `securityauditlogs`.
2. **Contact Activity Timeline:** Changes to contact status, phone number updates, and consent transitions append records to `contactactivities`.
3. **Template Snapshot Pinning:** Campaign executions freeze an exact copy of the message template in `templateSnapshot` to ensure historical legal reviewability.
