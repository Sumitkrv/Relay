# RELAY DEMO PROMPT 3: BUSINESS SETTINGS & PERSISTENCE

## 1. Module Overview
The Settings page (`/settings`) allows the authenticated workspace owner to inspect and manage their user profile, business identity, preferences, integrations, security, and developer sandbox controls. Every editable field persists directly in MongoDB with zero fake save buttons.

### Supported Sections:
1. **User Profile:** Full display name, email, role, avatar.
2. **Business Profile:** Legal/Trading name, display name, category/industry, phone, email, website, description, city, state, country, postal code, support email, and interactive logo upload/delete.
3. **Security & Password:** Password change with bcrypt hashing, session expiry, security audit log.
4. **WhatsApp Integration:** Meta Cloud API connection readiness banner, execution mode (`MOCK` safe mode), internal sandbox queue health, and interactive diagnostic simulator.
5. **Preferences:** Timezone selection (`Asia/Kolkata` default), date formats, calling codes.
6. **Billing:** Mock subscription status, demo trial indicator, zero live Razorpay calls.
7. **About & Branding:** Independent brand preview card showing workspace identity, category, and initials fallback.
8. **Developer Testing Center:** In-depth mock diagnostics, webhook simulation, sandbox reset.

## 2. API Services & Persistence Architecture
- **Controller:** [`settingsController.js`](file:///Users/sumitthakur/Desktop/Relay/backend/src/controllers/settingsController.js)
- **Routes:** [`settingsRoutes.js`](file:///Users/sumitthakur/Desktop/Relay/backend/src/routes/settingsRoutes.js)
- **Frontend Client:** [`settings.js`](file:///Users/sumitthakur/Desktop/Relay/frontend/src/services/settings.js)

### Endpoints:
- `GET /api/settings/profile`: Fetches authenticated user info.
- `PATCH /api/settings/profile`: Updates display name and logs audit trail.
- `GET /api/settings/business`: Fetches business profile, completeness score, and logo.
- `PUT /api/settings/business`: Persists profile edits in `businessprofiles` and synchronizes `workspaces` (name, logoUrl, city, country) and `users.businessName`.
- `POST /api/settings/logo`: Uploads PNG/JPEG/WEBP logo (max 2MB), saves to `uploads/logos/`, updates `BusinessProfile` & `Workspace`.
- `DELETE /api/settings/logo`: Removes custom logo and resets `logoUrl` to empty string.
- `GET /api/settings/preferences`: Fetches regional timezone and formatting.
- `PUT /api/settings/preferences`: Persists timezone in `userpreferences` and synchronizes `Workspace.timezone`.
- `GET /api/settings/integrations`: WhatsApp Cloud API readiness state.
- `POST /api/auth/change-password`: Secure bcrypt password rotation with current password verification.

## 3. Strict Parameter Whitelisting & Immutability
Ordinary profile and business updates accept only explicitly permitted fields (`legalOrTradingName`, `displayName`, `businessCategory`, `email`, `phone`, `website`, `description`, `address`, `city`, `state`, `country`, `postalCode`, `supportEmail`).
Any attempts to inject or overwrite `ownerId`, `workspaceId`, `role`, or `paymentStatus` are strictly discarded.
