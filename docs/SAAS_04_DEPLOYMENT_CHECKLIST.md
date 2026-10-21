# SaaS Deployment & Security Readiness Checklist
**Phase:** SaaS Prompt 4 of 15  
**Version:** 1.0.0  
**Scope:** Production Deployment Guidelines, Environment Configuration & Operational Readiness  

---

## 1. Environment Configuration

The following variables must be configured in `backend/.env` for production environments. **Never commit real secrets or credentials to source control.**

| Environment Variable | Required | Description | Example / Default |
|---|---|---|---|
| `NODE_ENV` | Yes | Runtime environment | `production` |
| `PORT` | Optional | Backend HTTP port | `5001` |
| `MONGO_URI` | Yes | MongoDB connection URI with replica set | `mongodb+srv://user:pass@cluster.mongodb.net/relay` |
| `JWT_SECRET` | Yes | High-entropy secret for JWT signing (> 32 bytes) | `e.g. openssl rand -hex 64` |
| `PUBLIC_APP_URL` | Yes | Authoritative public origin for frontend links | `https://app.relaycrm.io` |
| `FRONTEND_URL` | Yes | Authoritative frontend origin for CORS | `https://app.relaycrm.io` |
| `EMAIL_PROVIDER` | Yes | Transactional email provider (`resend`, `smtp`, `memory`) | `resend` |
| `EMAIL_FROM` | Yes | Authoritative verified sender email address | `Relay <notifications@relaycrm.io>` |
| `EMAIL_API_KEY` | Conditional | Required when `EMAIL_PROVIDER=resend` | `re_123456789...` |
| `SMTP_HOST` | Conditional | Required when `EMAIL_PROVIDER=smtp` | `smtp.postmarkapp.com` |
| `SMTP_PORT` | Conditional | SMTP port | `587` |
| `SMTP_USER` | Conditional | SMTP username | `api_token` |
| `SMTP_PASS` | Conditional | SMTP password | `secret` |
| `EMAIL_VERIFICATION_TTL` | Optional | Verification token validity window in ms | `86400000` (24 hours) |
| `PASSWORD_RESET_TTL` | Optional | Password reset token validity window in ms | `1800000` (30 minutes) |

---

## 2. Production Pre-Flight Checklist

### Database & Indexes
- [x] Normalized unique index on `User.email` (`{ unique: true, lowercase: true }`).
- [x] Compound index on `AuthToken` (`{ tokenHash: 1, purpose: 1, isConsumed: 1 }`).
- [x] TTL index on `AuthToken.expiresAt` (`{ expires: '7d' }`).
- [x] Compound index on `WorkspaceMembership` (`{ workspaceId: 1, userId: 1 }`).

### Security & Cookie Configuration
- [x] `cookie.secure: true` activated automatically when `NODE_ENV === 'production'`.
- [x] `cookie.httpOnly: true` prevents JavaScript read access.
- [x] `cookie.sameSite: 'lax'` prevents cross-site request forgery.
- [x] Rate limiting active on all public auth endpoints:
  - Registration: 5 requests / 15 min / IP
  - Login: 10 requests / 15 min / IP
  - Forgot Password: 5 requests / 15 min / IP
  - Resend Verification: 3 requests / 15 min / IP
- [x] Strict CORS origin validation: Wildcards (`*`) strictly disallowed when `credentials: true`.

### Transactional Email Delivery Readiness
- [x] Domain DNS records (SPF, DKIM, DMARC) verified on transactional email provider.
- [x] Transactional email sender matches verified sender domain.
- [x] Delivery failure fallback implemented (users stay pending with resend retry rather than false success).

### Operational Safety Gates
- [x] Meta WhatsApp Cloud API live sending remains strictly 403-blocked.
- [x] Razorpay payment integrations deferred until Prompt 11.
- [x] Newly verified customers are routed to `/onboarding` without fake workspace generation.
- [x] M2W Realty data boundaries remain 100% isolated and protected.
