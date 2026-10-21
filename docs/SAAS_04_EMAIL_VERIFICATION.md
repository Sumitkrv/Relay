# SaaS Email Verification Architecture & Token Lifecycle
**Phase:** SaaS Prompt 4 of 15  
**Version:** 1.0.0  
**Scope:** Email Verification Security, Token Lifecycle, Resend Policy & Delivery Abstraction  

---

## 1. Overview & Security Principles

Email verification ensures that every customer onboarding into Relay genuinely owns and controls their registered business email address before gaining login eligibility. It prevents automated bot spam, identity spoofing, and unauthorized account creation.

### Non-Negotiable Security Policies
- **No Plaintext Tokens in Database:** Plaintext tokens are sent strictly to the customer's email inbox. Only a one-way SHA-256 cryptographic hash is stored in MongoDB.
- **Single-Use Atomic Consumption:** Tokens cannot be replayed. Verification uses MongoDB atomic updates (`findOneAndUpdate`) checking `isConsumed: false`.
- **Purpose Binding:** Tokens issued for `EMAIL_VERIFICATION` cannot be consumed by password reset endpoints, and vice versa.
- **Strict Time-to-Live (TTL):** Tokens expire after 24 hours. Expired tokens are immediately rejected.
- **Anti-Enumeration Safeguards:** Resending verification links or querying account verification status never reveals whether an arbitrary email address exists.

---

## 2. Complete Verification Journey

```
Customer               Relay Frontend            Express Backend            MongoDB            Email Provider
   │                          │                         │                      │                      │
   │─── Fill Signup Form ────▶│                         │                      │                      │
   │                          │── POST /api/auth/reg ──▶│                      │                      │
   │                          │                         │── User.create() ────▶│ (PENDING_VERIF)      │
   │                          │                         │── Create Token ─────▶│ (Store SHA-256 Hash) │
   │                          │                         │── Send Email ──────────────────────────────▶│
   │                          │◀── Return Safe User ────│                      │                      │
   │◀── Verification Pending ─│                         │                      │                      │
   │                          │                         │                      │                      │
   │─── Opens Email & Clicks ──────────────────────────▶│ (GET /verify-email?token=...)              │
   │    Link in Browser       │                         │                      │                      │
   │                          │── POST /verify-email ──▶│                      │                      │
   │                          │   { token }             │── Atomic Consume ───▶│ (Mark Consumed)      │
   │                          │                         │── Activate User ────▶│ (status: ACTIVE)     │
   │                          │◀── Verification Success │                      │                      │
   │◀── Success Screen ───────│                         │                      │                      │
   │    "Proceed to Login"    │                         │                      │                      │
```

---

## 3. Cryptographic Token Lifecycle

### 3.1 Token Generation
```javascript
// backend/src/services/authSecurityService.js
const rawToken = crypto.randomBytes(32).toString('hex'); // 64 hex characters (256 bits of entropy)
const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 Hours
```

### 3.2 Secure Persistence
Previous unused verification tokens for the user are invalidated upon issuing a new token to prevent dangling tokens:
```javascript
await AuthToken.updateMany(
  { userId, purpose: 'EMAIL_VERIFICATION', isConsumed: false },
  { $set: { isConsumed: true, consumedAt: new Date() } }
);

await AuthToken.create({
  userId,
  tokenHash,
  purpose: 'EMAIL_VERIFICATION',
  expiresAt,
  isConsumed: false,
  metadata: { ip, userAgent }
});
```

### 3.3 Atomic Consumption
Token consumption verifies five conditions simultaneously:
```javascript
const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');

const tokenDoc = await AuthToken.findOneAndUpdate(
  {
    tokenHash,
    purpose: 'EMAIL_VERIFICATION',
    isConsumed: false,
    expiresAt: { $gt: new Date() }
  },
  {
    $set: {
      isConsumed: true,
      consumedAt: new Date()
    }
  },
  { new: true }
);

if (!tokenDoc) {
  // Inspect if expired or already consumed for precise user feedback
  const existing = await AuthToken.findOne({ tokenHash, purpose: 'EMAIL_VERIFICATION' });
  if (existing?.isConsumed) throw new Error('TOKEN_ALREADY_USED');
  if (existing && existing.expiresAt <= new Date()) throw new Error('TOKEN_EXPIRED');
  throw new Error('TOKEN_INVALID');
}

// Atomically activate user
await User.findByIdAndUpdate(tokenDoc.userId, {
  accountStatus: 'ACTIVE',
  emailVerifiedAt: new Date(),
  verificationEmailLastSentAt: null
});
```

---

## 4. Resend Verification Policy & Anti-Spam Controls

### 4.1 Endpoint
`POST /api/auth/resend-verification`
- **Payload:** `{ "email": "customer@company.com" }`
- **Rate Limit:** 3 requests per 15 minutes per IP; 60-second cooldown per account.
- **Anti-Enumeration Response:** If the email does not exist or is already verified, the server returns HTTP 200 with the exact same generic message:
  ```json
  {
    "success": true,
    "message": "If an unverified account exists for this email, a new verification link has been sent."
  }
  ```

### 4.2 Frontend Cooldown Timer
The frontend `SignupPage.jsx` and `VerifyEmailPage.jsx` enforce a 60-second local visual countdown to prevent rapid double-clicks while the backend independently enforces server-side rate limits.

---

## 5. Transactional Email Service Abstraction (`emailService.js`)

The email delivery layer supports three distinct runtime environments:

| Environment | Provider | Configuration | Behavior |
|---|---|---|---|
| **Production** | Resend API / SMTP | `EMAIL_PROVIDER=resend`<br>`EMAIL_API_KEY=re_...`<br>`EMAIL_FROM=Relay <noreply@relaycrm.io>` | Dispatches real transactional email via HTTPS API. Throws genuine operational error on failure. |
| **Development** | Console / SMTP Sink | `EMAIL_PROVIDER=smtp`<br>`SMTP_HOST=localhost` | Dispatches to local SMTP sink (e.g. MailHog / Mailpit). |
| **Automated Testing** | In-Memory Mailbox | `NODE_ENV=test` | Captures messages in private in-memory array (`getEmailHistory()`). Zero network calls, zero credential exposure. |

### Verification Email Template Specifications
- **Brand Colors:** Midnight Slate (`#111827`) header, Jade (`#0D9488`) call-to-action button, Neutral Gray (`#F9FAFB`) background.
- **Subject:** `Verify your Relay account`
- **Direct CTA:** `Verify Email Address` pointing to `${PUBLIC_APP_URL}/verify-email?token=${rawToken}`
- **Fallback URL:** Full plain-text URL provided for clients blocking HTML buttons.
- **Security Notice:** *"If you did not create a Relay account, please disregard this email. No action is required."*
- **Plaintext Alternative:** Full RFC-compliant multipart plain-text fallback generated automatically.
