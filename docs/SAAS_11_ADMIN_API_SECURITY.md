# RELAY SAAS — PHASE 11: ADMIN API RESPONSE SECURITY & DATA MINIMIZATION

## 1. Principles of Data Minimization

The Platform Super Admin API (`/api/platform-admin`) aggregates across all SaaS tenants. To guarantee zero tenant data leakage and protect privacy, explicit response Data Transfer Objects (DTOs) and field projection allowlists are enforced:

1. **Owner Identifier Masking:**
   Customer email addresses are masked before transmission:
   `coach@fitzone.io` $\rightarrow$ `c***h@fitzone.io`.
   Customer phone numbers are masked:
   `+919876543210` $\rightarrow$ `+9198****210`.

2. **Zero Content Exposure:**
   Customer contact databases, private two-way chat messages, campaign message bodies, and media attachments are **excluded** from all Platform Admin API responses.

3. **No Credential Leakage:**
   `passwordHash`, JWT session cookies, email verification tokens, password reset tokens, Razorpay `key_secret`, and Meta WhatsApp system access tokens are never returned in responses.

4. **NoSQL Query Injection Prevention:**
   All search, status, and industry filter parameters are validated against strict compile-time allowlists. Raw user input is never passed directly to MongoDB query objects without escaping.
