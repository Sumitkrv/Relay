# RELAY SAAS — MASTER IMPLEMENTATION ROADMAP (16 PHASES)
## Progressive SaaS Transformation, Zero-Regression Milestones, Dependencies & Quality Gates

> **Document Version:** 1.0.0 (Master Execution Plan)  
> **Architecture:** Modular, Stepwise, Non-Destructive Progression  
> **Baseline Proof:** 237 / 237 Automated Tests Passing; 0 Broken Imports; Clean Vite Build  

---

## 1. Roadmap Overview & Phasing Principles

The transition from a single-business tool to a multi-tenant SaaS platform is divided into **16 focused, independently verifiable phases (SAAS 0 through SAAS 15)**.

### Golden Rules Across All Phases
1. **Never combine two complex phases into one prompt.**
2. **Every phase must achieve 100% test pass rate before proceeding to the next.**
3. **M2W Luxury Realty data is preserved at every step.**
4. **Existing functional features (the 7 primary screens) must never suffer regression.**
5. **Real WhatsApp Cloud API calls remain disconnected until Phase 14.**

```
SAAS 0 ──► SAAS 1 ──► SAAS 2 ──► SAAS 3 ──► SAAS 4 ──► SAAS 5 ──► SAAS 6 ──► SAAS 7
Audit      Tenant     M2W        Public     Auth &     Onboard    Industry   7 Modules
& Plan     Models     Migrate    Website    Signup     Wizard     Engine     Scoped
  │
  └───► SAAS 8 ──► SAAS 9 ──► SAAS 10 ──► SAAS 11 ──► SAAS 12 ──► SAAS 13 ──► SAAS 14 ──► SAAS 15
        Mock       WhatsApp   Razorpay    Super      White      Staging    Official   Pilot &
        Automate   Manager    Subscript   Admin      Label      & QA       Meta Live  Launch
```

---

## 2. Phase-by-Phase Execution Blueprints

---

### SAAS 0: Complete Audit, Baseline Verification & SaaS Architecture Blueprint
- **Objective:** Deep inspection of existing codebase, validation of 237 tests, zero-destructive analysis, risk assessment, and delivery of master architectural documents.
- **Dependencies:** None.
- **Existing Code Reused:** Entire existing repository audited.
- **New Components:** 5 Master Architecture Documents in `docs/`.
- **Database Changes:** **NONE.** No drops, no deletes, no field modifications, no migrations.
- **API Changes:** None.
- **Frontend Changes:** None.
- **Tests Required:** Verification of existing 169 backend + 68 frontend tests; clean Vite production build.
- **Acceptance Criteria:** Codebase inventory verified; 0 tests broken; 5 architecture documents created; explicit sign-off on non-destructive roadmap.
- **Risk Level:** **ZERO.** Read-only audit.
- **Data-Safety Notes:** No database connections altered; no real messages sent.

---

### SAAS 1: Secure Multi-Tenant Foundation, Workspace Models & User-Workspace Authorization
- **Objective:** Create `Workspace` and `WorkspaceMembership` models, introduce `requireWorkspace` middleware, update `User` model, and build tenant isolation test harnesses without breaking existing endpoints.
- **Dependencies:** SAAS 0.
- **Existing Code Reused:** `backend/src/middleware/auth.js`, `backend/src/models/User.js`.
- **New Components:** `Workspace.js`, `WorkspaceMembership.js`, `backend/src/middleware/requireWorkspace.js`, multi-tenant test suites.
- **Database Changes:** New collections `workspaces`, `workspacememberships`. Updated fields in `users` (`defaultWorkspaceId`, `isEmailVerified`, `isPlatformAdmin`).
- **API Changes:** Dual-compatible tenant middleware; workspace resolution endpoints (`GET /api/workspaces/current`).
- **Frontend Changes:** Auth context stores `workspace` alongside `user`; `x-workspace-id` attached to Axios request headers.
- **Tests Required:** Unit & integration tests for workspace creation, unauthorized tenant switching rejection (403), and membership role enforcement.
- **Acceptance Criteria:** Tenant middleware blocks cross-tenant tampering; legacy requests without workspace gracefully fall back to user's default workspace.
- **Risk Level:** Low.
- **Data-Safety Notes:** Additive schema changes only; no legacy fields removed.

---

### SAAS 2: Zero-Data-Loss M2W Realty Tenant Migration & Reference Verification
- **Objective:** Safely provision M2W Luxury Realty as Workspace #1, link existing owner, batch-assign `workspaceId` to all pre-existing records, and re-index with scoped uniqueness.
- **Dependencies:** SAAS 1.
- **Existing Code Reused:** All 63 existing models, `backend/src/scripts/seedDemoData.js`.
- **New Components:** `backend/src/scripts/migrateM2WToWorkspace.js`, `backend/test/m2wMigrationVerification.test.js`.
- **Database Changes:** Existing records in all 21 core collections receive `workspaceId`. New compound unique index `{ workspaceId: 1, phoneNumber: 1 }` on `contacts`.
- **API Changes:** None.
- **Frontend Changes:** None.
- **Tests Required:** Verification queries comparing pre- and post-migration document counts, referential integrity assertions, and zero orphan checks.
- **Acceptance Criteria:** M2W owner logs in; all 7 screens show 100% identical data; contact counts and campaigns match exactly; 0 data lost.
- **Risk Level:** Medium.
- **Data-Safety Notes:** Requires full binary `mongodump` backup before script execution; automated rollback procedure ready.

---

### SAAS 3: Responsive Public SaaS Website & Marketing Presence
- **Objective:** Build the public marketing website showcasing Relay's value proposition, features, 7 supported industries, transparent pricing, and FAQ.
- **Dependencies:** SAAS 0.
- **Existing Code Reused:** Midnight Slate × Jade theme tokens, Lucide icons, button and typography styles.
- **New Components:** Public layout (`PublicLayout.jsx`), Homepage (`HomePage.jsx`), Features (`FeaturesPage.jsx`), Industries (`IndustriesPage.jsx`), Pricing (`PricingPage.jsx`), FAQ (`FaqPage.jsx`), Public navigation & footer.
- **Database Changes:** None.
- **API Changes:** Public inquiry contact form submission endpoint (`POST /api/public/contact`).
- **Frontend Changes:** React Router adds public routes at `/`, `/features`, `/industries`, `/pricing`, `/faq`, `/how-it-works`.
- **Tests Required:** Responsive layout verification across 7 viewports (1600px to 320px); SEO meta tag assertions; link integrity checks.
- **Acceptance Criteria:** Modern, wow-factor public marketing website; zero broken links; clear explanation of customer-direct Meta billing; transparent pricing.
- **Risk Level:** Low.
- **Data-Safety Notes:** Purely frontend and marketing route additions.

---

### SAAS 4: User Registration, Secure Email Verification & Password Recovery
- **Objective:** Implement public user registration with input validation, rate limiting, cryptographic email verification tokens, and secure password reset.
- **Dependencies:** SAAS 1.
- **Existing Code Reused:** `backend/src/controllers/authController.js`, `backend/src/middleware/auth.js`.
- **New Components:** Email verification service, password reset tokens, `SignupPage.jsx`, `VerifyEmailPage.jsx`, `ForgotPasswordPage.jsx`.
- **Database Changes:** Storage of hashed verification tokens and expiry timestamps on `User`.
- **API Changes:** `POST /api/auth/signup`, `POST /api/auth/verify-email`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`.
- **Frontend Changes:** Polished signup and account recovery views with real-time password strength validation.
- **Tests Required:** Anti-enumeration tests, expired token rejection, duplicate email prevention, rate limit enforcement.
- **Acceptance Criteria:** New user can register, receive simulated or transactional email verification, and verify their account safely.
- **Risk Level:** Medium (security critical).
- **Data-Safety Notes:** Strict rate limits on auth endpoints; passwords hashed with bcrypt (10 rounds).

---

### SAAS 5: Self-Serve Business Onboarding Wizard & Workspace Auto-Provisioning
- **Objective:** Build a 5-step guided wizard that gathers business details, industry selection, and branding, and automatically provisions an isolated workspace.
- **Dependencies:** SAAS 1, SAAS 4.
- **Existing Code Reused:** Business profile forms, image upload utility.
- **New Components:** `OnboardingWizardPage.jsx`, `workspaceProvisioningService.js`.
- **Database Changes:** Creation of new `Workspace` and `WorkspaceMembership` during wizard completion.
- **API Changes:** `POST /api/onboarding/provision-workspace`.
- **Frontend Changes:** Post-signup onboarding flow at `/onboarding`.
- **Tests Required:** Idempotency tests (prevent duplicate workspaces on double-click), atomic provisioning verification.
- **Acceptance Criteria:** User completes wizard in under 2 minutes; lands directly in their fully configured Relay dashboard without developer intervention.
- **Risk Level:** Low.
- **Data-Safety Notes:** Wizard writes strictly to new workspace; no impact on existing tenants.

---

### SAAS 6: Industry Configuration Engine & Seven Domain Presets
- **Objective:** Implement the versioned industry configuration engine controlling custom contact fields, lead sources, keyword auto-replies, and dashboard copy.
- **Dependencies:** SAAS 5.
- **Existing Code Reused:** `Contact.js` customFields, `autoReplyRuleService.js`.
- **New Components:** `backend/src/config/industryPresets.js`, `frontend/src/config/industryPresets.js`, dynamic field rendering helpers.
- **Database Changes:** `Workspace.industryKey`, `Workspace.industryConfigOverrides`.
- **API Changes:** `GET /api/workspaces/industry-config`.
- **Frontend Changes:** Dynamic form fields in `ContactFormModal`, dynamic columns in `ContactsPage`, industry-tailored copy in `Dashboard`.
- **Tests Required:** Schema validation across all 7 industry presets; custom field persistence tests.
- **Acceptance Criteria:** Selecting "Gym" displays "Member Interest" and "Fitness Goal"; selecting "Real Estate" displays "Property Type" and "Project". Core code remains 100% shared.
- **Risk Level:** Low.
- **Data-Safety Notes:** Custom fields are validated against strict allowed types; no arbitrary operator injections.

---

### SAAS 7: Tenant Scoping Across All Seven Existing Modules
- **Objective:** Update all controller queries and aggregation pipelines across the 7 screens to strictly filter by `workspaceId: req.workspace._id`.
- **Dependencies:** SAAS 1, SAAS 2, SAAS 6.
- **Existing Code Reused:** Controllers for contacts, templates, campaigns, inbox, reports, settings, and dashboard.
- **New Components:** Scoped query helpers.
- **Database Changes:** Query filter updates from `{ ownerId }` to `{ workspaceId }`.
- **API Changes:** All business endpoints now enforce `requireWorkspace`.
- **Frontend Changes:** UI reflects active workspace details and branding.
- **Tests Required:** Cross-tenant authorization tests (Tenant A attempts to GET/PATCH/DELETE Tenant B's contacts, templates, or campaigns and receives 404/403).
- **Acceptance Criteria:** 100% multi-tenant data isolation verified across all 7 modules; 0 cross-tenant data leakage.
- **Risk Level:** High (core tenant isolation).
- **Data-Safety Notes:** Staged rollout with dual-read fallback for M2W Realty records.

---

### SAAS 8: Tenant-Aware Mock Automation & Isolated Developer Testing Center
- **Objective:** Ensure mock messaging simulator, synthetic inbound replies, keyword auto-replies, and demo resets operate strictly within the tenant's workspace boundary.
- **Dependencies:** SAAS 7.
- **Existing Code Reused:** `mockWhatsAppProvider.js`, `DeveloperTestingCenter.jsx`, `autoReplyRuleService.js`.
- **New Components:** Workspace-scoped synthetic event router.
- **Database Changes:** `ProviderEvent.workspaceId`, `RuleExecution.workspaceId`.
- **API Changes:** `POST /api/dev/mock-messaging/*` scoped to `req.workspaceId`.
- **Frontend Changes:** Developer Testing Center displays active workspace context.
- **Tests Required:** Synthetic events in Workspace A do not trigger auto-replies or notifications in Workspace B.
- **Acceptance Criteria:** Two different browser tabs open to two different workspaces test auto-replies in parallel with zero collision.
- **Risk Level:** Low.
- **Data-Safety Notes:** Synthetic events remain flagged with `trustLevel: 'synthetic'`; production guard blocks synthetic route exposure.

---

### SAAS 9: Customer WhatsApp Connection Manager (Coexistence & Cloud API)
- **Objective:** Build the UI and backend service for managing WhatsApp Business connections, supporting official Coexistence and dedicated Cloud API options with mock connection flows.
- **Dependencies:** SAAS 7.
- **Existing Code Reused:** `SettingsPage.jsx` WhatsApp tab, `messagingProviderRegistry.js`.
- **New Components:** `WhatsAppConnection.js` model, `WhatsAppConnectionManager.jsx` component, connection state machine.
- **Database Changes:** New `whatsappconnections` collection.
- **API Changes:** `GET/POST/DELETE /api/settings/whatsapp-connection`.
- **Frontend Changes:** Redesigned WhatsApp Connection tab in Settings with guided setup cards.
- **Tests Required:** Connection lifecycle tests (Pending → Connected → Disconnected), state transition audits.
- **Acceptance Criteria:** User can review requirements, select Option A (Coexistence) or Option B (Dedicated Number), and simulate connection in Mock Mode.
- **Risk Level:** Low.
- **Data-Safety Notes:** Encryption at rest for future API tokens; real Meta API remains disconnected.

---

### SAAS 10: Razorpay Subscriptions & Customer-Direct Billing Validation
- **Objective:** Implement Relay software subscription billing via Razorpay, with webhook-driven entitlement provisioning and automated checks verifying customer-direct Meta billing.
- **Dependencies:** SAAS 7, SAAS 9.
- **Existing Code Reused:** Settings billing tab.
- **New Components:** `Subscription.js` model, `Invoice.js` model, `billingService.js`, Razorpay checkout modal integration, webhook signature verifier.
- **Database Changes:** `subscriptions`, `invoices`, `workspaces.subscriptionId`.
- **API Changes:** `POST /api/billing/create-subscription`, `POST /api/billing/webhook`.
- **Frontend Changes:** Subscription tier selection, billing history table, upgrade modal.
- **Tests Required:** Razorpay webhook signature verification tests, idempotent webhook handling, downgrade/cancellation entitlement tests.
- **Acceptance Criteria:** Subscription purchase upgrades workspace entitlements; past-due status restricts campaign launches; customer-direct billing requirement is explicitly enforced.
- **Risk Level:** Medium (financial & entitlement security).
- **Data-Safety Notes:** Webhook idempotency keys prevent double-crediting; no payment card details stored locally.

---

### SAAS 11: Platform Super Admin Health & Operational Monitoring Console
- **Objective:** Build a restricted, audited administrative console for Relay platform operators to monitor system health, business counts, subscription revenues, queue performance, and provider status.
- **Dependencies:** SAAS 1, SAAS 7, SAAS 10.
- **Existing Code Reused:** Recharts analytics cards, security audit logger.
- **New Components:** `PlatformAdminLayout.jsx`, `AdminWorkspacesPage.jsx`, `AdminQueueHealthPage.jsx`, `requirePlatformAdmin` middleware.
- **Database Changes:** Audit logs for super admin operations.
- **API Changes:** `/api/platform-admin/*` namespace.
- **Frontend Changes:** Admin portal accessible only to users with `isPlatformAdmin === true`.
- **Tests Required:** Privilege escalation tests (regular workspace owner cannot access `/api/platform-admin`), admin action audit logging.
- **Acceptance Criteria:** Super admin view displays platform-wide KPIs without exposing private customer conversations.
- **Risk Level:** Medium.
- **Data-Safety Notes:** Absolute wall between platform admin and tenant private communications.

---

### SAAS 12: White-Label Agency Infrastructure & Branding Engine
- **Objective:** Lay the foundational data architecture and styling engine for future agency resellers to brand client workspaces with custom logos, product names, and theme colors.
- **Dependencies:** SAAS 7, SAAS 11.
- **Existing Code Reused:** Design system tokens (`tokens.js`), workspace branding models.
- **New Components:** `AgencyAccount.js` model, dynamic theme provider, reseller workspace provisioning APIs.
- **Database Changes:** `AgencyAccount` collection, `workspaces.agencyId`.
- **API Changes:** `/api/agency/*` management endpoints.
- **Frontend Changes:** Dynamic CSS variable injection based on workspace/agency theme settings.
- **Tests Required:** Reseller isolation tests (Agency A cannot manage Agency B's clients).
- **Acceptance Criteria:** Agency can provision client workspaces branded with custom logo and theme; clients see agency branding.
- **Risk Level:** Low.
- **Data-Safety Notes:** Client workspaces remain logically isolated even under the same agency.

---

### SAAS 13: Complete End-to-End QA, Multi-Viewport Browser Verification & Staging
- **Objective:** Comprehensive testing of the entire multi-tenant system across all 7 supported industries, running unit, integration, multi-tenant isolation, export, and responsive browser test suites.
- **Dependencies:** SAAS 1 through SAAS 12.
- **Existing Code Reused:** All existing test files in `backend/test/` and `frontend/test/`.
- **New Components:** Automated multi-tenant E2E test suite (`backend/test/saasMultiTenantE2E.test.js`).
- **Database Changes:** None.
- **API Changes:** None.
- **Frontend Changes:** Minor UX polishes identified during staging QA.
- **Tests Required:** Minimum 260+ automated tests passing with 100% success rate; Playwright/browser subagent verification across 7 viewports (1600px to 320px).
- **Acceptance Criteria:** Zero dead buttons; zero console errors; 100% multi-tenant data isolation certified; M2W Realty data intact.
- **Risk Level:** Low.
- **Data-Safety Notes:** Executed on isolated staging databases.

---

### SAAS 14: Official Meta WhatsApp Cloud API Integration & Embedded Signup
- **Objective:** Introduce `MetaCloudWhatsAppProvider.js` adhering to the 13-method provider contract, implement Meta Embedded Signup OAuth exchange, and activate secure inbound webhook verification.
- **Dependencies:** SAAS 9, SAAS 13.
- **Existing Code Reused:** `messagingProviderRegistry.js`, `mockWhatsAppProvider.js` interface contract, `autoReplyRuleService.js`.
- **New Components:** `MetaCloudWhatsAppProvider.js`, webhook signature verification middleware, Meta token encryption service.
- **Database Changes:** `WhatsAppConnection` populated with live credentials.
- **API Changes:** `GET/POST /api/webhooks/whatsapp` (Meta signature verification).
- **Frontend Changes:** Embedded Signup launch button linking to Meta OAuth pop-up.
- **Tests Required:** Webhook signature verification tests, payload contract validation, failover circuit breaker tests.
- **Acceptance Criteria:** Live Meta WhatsApp Cloud API sends verified messages; customer-direct billing confirmed before launch; fail-closed safeguards active.
- **Risk Level:** High (live external provider integration).
- **Data-Safety Notes:** Raw tokens encrypted at rest via AES-256-GCM; webhook validation drops forged signatures.

---

### SAAS 15: Controlled Pilot Rollout, Production Launch & Observability
- **Objective:** Deploy production multi-tenant infrastructure, execute live M2W Realty migration on production, onboard first 5 external pilot businesses (Gym, Clinic, Salon, Education, Auto), and establish 24/7 monitoring.
- **Dependencies:** SAAS 14.
- **Existing Code Reused:** All application modules.
- **New Components:** Production deployment manifests, Prometheus/health metrics exporter, backup cron jobs.
- **Database Changes:** Production migration execution with verified backups.
- **API Changes:** None.
- **Frontend Changes:** None.
- **Tests Required:** Production smoke tests, live webhook heartbeat validation, real message delivery verification for pilot businesses.
- **Acceptance Criteria:** M2W Realty active on production; 5 external pilot businesses onboarded and operating; zero data leakage; 99.9% uptime.
- **Risk Level:** Medium (production release).
- **Data-Safety Notes:** 24-hour monitoring with instant rollback capability if anomalies occur.
