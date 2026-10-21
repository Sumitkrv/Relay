# SaaS Password Reset Security & Session Invalidation Architecture
**Phase:** SaaS Prompt 4 of 15  
**Version:** 1.0.0  
**Scope:** Password Recovery Threat Model, Cryptographic Reset Tokens & Global Session Revocation  

---

## 1. Threat Model & Security Objectives

Account recovery is one of the highest-risk attack vectors in commercial SaaS. An insecure password reset implementation can allow unauthorized account takeovers, session hijacking, or user enumeration.

### Security Guarantees Enforced
1. **Zero Enumeration Leakage:** Requesting a password reset never reveals whether an account exists in the database.
2. **Short Token TTL (30 Minutes):** Password reset tokens expire strictly within 30 minutes, minimizing the window of vulnerability.
3. **Purpose-Bound Segregation:** Tokens created for `PASSWORD_RESET` are mathematically prevented from being used for `EMAIL_VERIFICATION`.
4. **Immediate Global Session Revocation:** Upon successful password reset, the user's `authVersion` is atomically incremented. Every active session cookie and JWT token issued prior to the reset is immediately invalidated across all devices.
5. **No Password Hashes or Secrets in Emails:** Emails contain only a single-use random token link. Plaintext passwords or hashes are never transmitted or logged.

---

## 2. Password Recovery Sequence

```
1. Customer visits /forgot-password
2. Enters registered business email -> POST /api/auth/forgot-password
3. Backend checks User.findOne({ email: normalizedEmail })
   ├── If User Found & Active:
   │     ├── Invalidate prior unused PASSWORD_RESET tokens for user
   │     ├── Generate crypto.randomBytes(32).toString('hex')
   │     ├── Compute SHA-256 hash
   │     ├── Store in AuthToken with expiresAt = +30 minutes
   │     └── Dispatch transactional email via emailService
   └── If User Not Found or Suspended:
         └── Do not throw error; do not send email
4. Backend returns HTTP 200: "If an eligible account exists, instructions have been sent."
5. Customer clicks link in email: /reset-password?token=<rawToken>
6. Frontend validates password strength & confirmation match
7. Submits POST /api/auth/reset-password { token, newPassword }
8. Backend executes atomic token consumption & user password update:
   ├── AuthToken.findOneAndUpdate({ tokenHash, purpose: 'PASSWORD_RESET', isConsumed: false, expiresAt: > now })
   ├── Hash new password with bcryptjs (12 salt rounds)
   ├── User.findByIdAndUpdate(userId, { password: hashedPassword, $inc: { authVersion: 1 } })
   └── Clear existing session cookie (Set-Cookie: relay_jwt=; Max-Age=0)
9. Customer redirected to /login with fresh credentials required.
```

---

## 3. Global Session Invalidation via `authVersion`

### The "Zombie Session" Problem
In stateless JWT architectures, changing a password does not automatically invalidate active JWT tokens held by attackers or lost devices because the signature remains mathematically valid until JWT expiration (e.g., 7 days).

### The Relay Solution: Versioned JWT Verification
1. Every `User` document in MongoDB maintains an integer field: `authVersion` (default `1`).
2. When a JWT is signed at login, the payload embeds the current `authVersion`:
   ```json
   { "id": "673f1234abcd5678ef901234", "ver": 1 }
   ```
3. During every request, the `requireAuth` middleware verifies:
   ```javascript
   // backend/src/middleware/auth.js
   if (user.authVersion !== payload.ver) {
     return res.status(401).json({
       success: false,
       code: 'SESSION_REVOKED',
       message: 'Your session has expired or was revoked. Please sign in again.'
     });
   }
   ```
4. On password reset, `authSecurityService.consumePasswordResetToken` executes:
   ```javascript
   user.password = hashedPassword;
   user.authVersion = (user.authVersion || 1) + 1;
   await user.save();
   ```
5. Result: **All prior JWTs are instantly rejected with 401 Unauthorized.**

---

## 4. Password Policy & Complexity Standards

Relay enforces a robust, user-friendly password standard aligned with modern NIST SP 800-63B guidelines:
- **Minimum Length:** 8 characters.
- **Passphrase Friendly:** No arbitrary character restrictions (spaces and symbols allowed).
- **Password Manager Compatible:** Standard HTML `<input type="password" autocomplete="new-password">` with clear show/hide toggles.
- **Client-Side Real-Time Strength Meter:** 4-tier visual feedback (Weak, Fair, Good, Strong) based on length, mixed case, numbers, and symbols.
- **Safe Payload Size Limit:** Passwords exceeding 128 characters are rejected to prevent bcrypt computational DoS attacks.
