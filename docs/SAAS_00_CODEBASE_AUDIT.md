# RELAY SAAS — PROMPT 0 CODEBASE AUDIT & TECHNICAL INVENTORY
## Complete Baseline Inspection, Architecture Inventory, Hardcoded Assumptions & Risk Analysis

> **Audit Date:** October 20, 2026  
> **Auditor:** Principal SaaS Software Architect & Lead Security Engineer  
> **Phase:** SAAS PROMPT 0 (Baseline Verification, Audit & Migration Planning)  
> **Current Mode:** Single-Operator Real Estate WhatsApp Automation Platform (M2W Luxury Realty Reference)  
> **Target Architecture:** Multi-Tenant, Multi-Industry, Subscription-Based Commercial WhatsApp SaaS  

---

## 1. Executive Summary & Repository Identity

Relay is an existing, fully functional, production-structured MERN application developed originally for a single business: **M2W Luxury Realty**. It features a complete CRM and automation suite with an offline, contract-compliant Mock WhatsApp Provider, durable MongoDB-based background queue workers, and 237 automated tests passing with a 100% success rate.

### Baseline Repository Metrics
- **Repository Root:** `/Users/sumitthakur/Desktop/Relay`
- **Git Version Control Status:** Not initialized (`fatal: not a git repository`). No `.git` directory exists in the workspace.
- **Frontend Framework:** React 18.3.1, React Router DOM 7.18.4, TailwindCSS 4.3.3 via `@tailwindcss/vite`, Vite 6.0.5, Lucide-React 0.468.0, Recharts 2.15.0, `@xyflow/react` 12.12.0.
- **Backend Framework:** Node.js ES Modules (`"type": "module"`), Express 4.21.2, Mongoose 8.9.5, Helmet 8.0.0, Express Rate Limit 7.5.0, Cookie-Parser 1.4.7, ExcelJS 4.4.0, CSV-Parse 7.0.3, Libphonenumber-js 1.13.15, Bcryptjs 2.4.3, JWT 9.0.2, Multer 2.4.0.
- **Database Engine:** MongoDB (configured via Mongoose 8.9.5, native `mongodb-memory-server` 11.3.0 for automated testing).
- **Automated Test Results (Independently Verified):**
  - Backend Test Suite: **169 / 169 passing** (`node --test`, execution duration: ~38.1s)
  - Frontend Test Suite: **68 / 68 passing** (`node --test frontend/test/*.test.js`, execution duration: 141ms)
  - Total Tests: **237 automated tests with 0 failures, 0 skipped**.
- **Frontend Production Build:** Verified clean build via `vite build` in 9.38s generating `dist/` bundle (HTML: 0.71 kB, CSS: 99.86 kB, JS: 1.49 MB across 4 chunks).

---

## 2. Repository Structure & File Layout

```
/Users/sumitthakur/Desktop/Relay
├── .DS_Store
├── .gitignore
├── README.md
├── package.json                   # Root orchestrator scripts
├── node_modules/                  # Root dependencies
├── test-fixtures/                 # 4 sample CSV/XLSX contact and edge case datasets
├── uploads/                       # Root uploads directory
├── docs/                          # Architecture & QA specifications (17 markdown documents)
│   ├── PROJECT_QUALITY_GATES.md
│   ├── RELAY_API_FREE_DEMO_GUIDE.md
│   ├── RELAY_CAMPAIGN_MANAGEMENT_ARCHITECTURE.md
│   ├── RELAY_COMPLETE_MANUAL_TEST_GUIDE.md
│   ├── RELAY_CONTACTS_ARCHITECTURE.md
│   ├── RELAY_DASHBOARD_ARCHITECTURE.md
│   ├── RELAY_DEMO_QA_RESULTS.md
│   ├── RELAY_FEATURE_COMPLETION_MATRIX.md
│   ├── RELAY_FINAL_QA_REPORT.md
│   ├── RELAY_INBOX_AUTOREPLY_ARCHITECTURE.md
│   ├── RELAY_MESSAGING_ENGINE_ARCHITECTURE.md
│   ├── RELAY_META_INTEGRATION_READINESS.md
│   ├── RELAY_MODULE_INVENTORY.md
│   ├── RELAY_REAL_ESTATE_SCOPE.md
│   ├── RELAY_REPORTING_ARCHITECTURE.md
│   ├── RELAY_TEMPLATE_STUDIO_ARCHITECTURE.md
│   └── RELAY_UI_DESIGN_SYSTEM.md
├── backend/                       # Express + Mongoose API Backend
│   ├── .env                       # Local environment variables
│   ├── .env.example               # Reference environment configuration
│   ├── package.json               # Backend dependencies & scripts
│   ├── uploads/                   # Runtime file upload storage
│   ├── test/                      # 20 automated test files (169 tests)
│   └── src/
│       ├── app.js                 # Express application & route mounts
│       ├── server.js              # Server lifecycle & worker startup
│       ├── config/                # Database connection (db.js)
│       ├── middleware/            # auth.js, errors.js
│       ├── models/                # 63 Mongoose models
│       ├── routes/                # 30 Express route modules
│       ├── controllers/           # 22 Controller modules
│       ├── services/              # 22 Business logic & provider services
│       ├── utils/                 # asyncHandler, contactValidation, templateEngine, cookies
│       └── scripts/               # seedDemoData.js, resetDemoData.js
└── frontend/                      # Vite + React Single-Page Application
    ├── index.html                 # App shell
    ├── vite.config.js             # Vite + Tailwind + React config
    ├── package.json               # Frontend dependencies & scripts
    ├── public/                    # Static assets (logo.png, etc.)
    ├── dist/                      # Production build output
    ├── test/                      # 11 frontend test suites (68 tests)
    └── src/
        ├── main.jsx               # React entry point
        ├── App.jsx                # Router configuration & protected routes
        ├── styles.css             # Main styling & component design system
        ├── sales.css              # Pipeline and sales layout styles
        ├── importPage.css         # CSV/XLSX import wizard styles
        ├── layout/                # AppLayout.jsx (sidebar, topbar, status)
        ├── context/               # AuthContext.jsx
        ├── theme/                 # tokens.js (Midnight Slate × Jade design tokens)
        ├── components/            # 20 reusable UI components
        ├── pages/                 # 18 Page views (7 primary + secondary tools)
        ├── services/              # 10 Axios API client wrappers
        └── utils/                 # Formatters, validators, CSV helpers
```

---

## 3. Technology Versions & Runtime Dependencies

| Layer | Component | Version | Role in Architecture |
| :--- | :--- | :--- | :--- |
| **Runtime** | Node.js | v20+ / v22+ | ES Modules, native `node:test` runner |
| **Backend** | Express | 4.21.2 | HTTP routing, JSON API handling |
| **Backend** | Mongoose | 8.9.5 | MongoDB ODM, validation, compound indexing |
| **Backend** | Helmet | 8.0.0 | HTTP security headers, X-Frame-Options |
| **Backend** | Bcryptjs | 2.4.3 | Password hashing (rounds: 10) |
| **Backend** | JsonWebToken | 9.0.2 | Session token generation & signature verification |
| **Backend** | ExcelJS | 4.4.0 | Streaming XLSX file parsing and workbook export |
| **Backend** | CSV-Parse | 7.0.3 | Synchronous and streaming CSV ingestion |
| **Backend** | Libphonenumber-js | 1.13.15 | Strict E.164 phone parsing & country normalization |
| **Backend** | Multer | 2.4.0 | Multipart form upload handling (diskStorage) |
| **Backend Test**| MongoMemoryServer | 11.3.0 | Ephemeral in-memory database for automated tests |
| **Frontend** | React | 18.3.1 | Core UI view rendering |
| **Frontend** | React Router | 7.18.4 | Client-side routing with nested layout |
| **Frontend** | TailwindCSS | 4.3.3 | Utility CSS engine via `@tailwindcss/vite` |
| **Frontend** | Vite | 6.0.5 | Bundler, HMR dev server |
| **Frontend** | Lucide React | 0.468.0 | Icon system |
| **Frontend** | Recharts | 2.15.0 | SVG charting for KPI trends and analytics |
| **Frontend** | React-Hot-Toast | 2.4.1 | Notification toast alerts |
| **Frontend** | @xyflow/react | 12.12.0 | Node-based workflow editor canvas |

---

## 4. Database Collections & Model Inventory (All 63 Models)

The backend defines 63 distinct Mongoose models. Every business-domain model currently implements single-operator tenant scoping using `ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }`.

### 4.1 Categorized Model Roster

| Domain Category | Models | Current Ownership Key | Notes / Multi-Tenant Impact |
| :--- | :--- | :--- | :--- |
| **Identity & Access** | `User.js`, `UserPreferences.js`, `SecurityAuditLog.js` | Global email / `ownerId` | `User` is currently business owner. Must decouple into `User` + `WorkspaceMembership` + `Workspace`. |
| **Business Profile** | `BusinessProfile.js` | `ownerId` (unique) | Holds agency legal name, branding, logo. Will migrate into authoritative `Workspace` model. |
| **Contacts & CRM** | `Contact.js`, `ContactGroup.js`, `ContactCategory.js`, `ContactActivity.js`, `ConsentRecord.js`, `InternalNote.js` | `ownerId` | Compound unique index `owner_phone_unique` on `{ownerId, phoneNumber}`. Must transition to `{workspaceId, phoneNumber}`. |
| **Audience & Segmentation** | `AudienceSegment.js`, `AudienceSegmentMember.js` | `ownerId` / `segmentId` | Dynamic query filter segments and static lists. Scoped to workspace. |
| **Imports** | `ImportJob.js`, `ImportRow.js`, `ImportError.js`, `ImportMappingPreset.js` | `ownerId` / `importJobId` | Batched spreadsheet imports with formula protection. File paths in temp directory. |
| **Templates** | `MessageTemplate.js`, `TemplateVersion` (exported), `TemplateMedia.js` | `ownerId` | Template studio documents, version snapshots, media attachments in `uploads/template-media`. |
| **Campaigns & Orchestration**| `Campaign.js`, `CampaignExecution.js`, `CampaignAudience.js`, `CampaignMessageJob.js`, `CampaignActivity.js` | `ownerId` | 4-step wizard campaigns, frozen snapshots, worker lease locks, immutable execution logs. |
| **Messaging & Queue** | `Message.js`, `MessageDraft.js`, `MessageEvent.js`, `ProviderEvent.js` | `ownerId` | Durable MongoDB queue with 30s leases, exponential backoff retries, state event logs. |
| **Inbox & Automation** | `Conversation.js`, `ConversationMessage.js`, `ConversationActivity.js`, `AutoReplyRule.js`, `RuleExecution.js`, `QuickReply.js`, `InboxNotification.js` | `ownerId` | Two-way thread timeline, manual takeover toggle, keyword auto-replies (`BROCHURE`, `PRICE`, `VISIT`, `STOP`). |
| **Sales & Deals** | `Deal.js`, `DealActivity.js`, `DealConversion.js`, `PipelineStage.js`, `Proposal.js`, `ProposalTemplate.js`, `ProposalVersion.js`, `CRMInsight.js`, `FollowUpTask.js`, `FollowUpRecommendation.js`, `LeadConversion.js`, `LeadScore.js`, `LeadScoreHistory.js`, `LeadScoreJob.js`, `LeadScoringRuleSet.js`, `LeadScoringRuleHistory.js` | `ownerId` | Pipeline stages, deal tracking, lead scoring rules, proposal generator. |
| **Workflows & Chatbots** | `AutomationWorkflow.js`, `WorkflowVersion.js`, `WorkflowExecution.js`, `WorkflowStepExecution.js`, `WorkflowSchedule.js`, `WorkflowSettings.js`, `WorkflowWait.js`, `WorkflowEvent.js`, `ChatbotDefinition.js`, `ChatbotVersion.js`, `ChatbotTestSession.js` | `ownerId` | Visual graph workflows, cron scheduling, timer waits, bot simulator. |
| **Reporting & Analytics** | `ReportGeneration.js`, `SavedReport.js` | `ownerId` | Export records, saved analytical report presets. |

---

## 5. Authentication, Sessions & Security Middleware

### Current Implementation (`backend/src/middleware/auth.js`)
- Tokens: Signed JWTs using `process.env.JWT_SECRET` (validated at startup to be >= 32 characters).
- Storage: Verified from `req.cookies.session` or HTTP header `Authorization: Bearer <token>`.
- Token Payload: `{ sub: user._id, ver: user.authVersion }`.
- Session Revocation: Incrementing `authVersion` on password change invalidates all pre-existing sessions.
- In-Route User Resolution: Sets `req.user = user`.
- **CRITICAL GAP:** There is currently NO workspace/tenant middleware. Authorization assumes `req.user._id === ownerId` for all resources. A user has direct access to whatever matches `ownerId: req.user._id`.

---

## 6. Durable Queue Worker Architecture

### Current Implementation (`backend/src/services/messageQueueService.js`)
- **Queue Storage:** MongoDB `messages` collection.
- **Worker Process:** Started in `server.js` via `startMessageWorker()`. Polling tick interval: 1000ms.
- **Leasing Mechanism:** Atomic `findOneAndUpdate` on `{ _id: messageId, $or: [{ status: 'QUEUED' }, { status: 'PROCESSING', leaseUntil: { $lt: now } }] }` with a 30-second lease window (`leaseUntil: now + 30000`) and worker PID identifier.
- **Worker Recovery:** On startup and tick, recovers abandoned or expired leases back to `QUEUED`.
- **Scheduled Messages:** Queries `{ status: 'SCHEDULED', scheduledAt: { $lte: now } }` with limit 50, transitioning them to `QUEUED`.
- **Exponential Backoff:** Up to 3 attempts with formula `baseDelay * (2 ** (attempts - 1))`.
- **CRITICAL MULTI-TENANT ISSUE:** The queue worker poll query currently scans globally without tenant scoping or per-workspace fair-share scheduling. If Workspace A enqueues 20,000 messages, Workspace B's messages will be blocked in the FIFO queue. Furthermore, workers do not verify workspace subscription status or resolve sender credentials by workspace.

---

## 7. Mock WhatsApp Provider & Safety Guards

### Current Implementation (`backend/src/services/mockWhatsAppProvider.js`)
- **Contract Interface:** Implements 13 standardized methods (`validateConfiguration`, `getConnectionStatus`, `prepareTemplatePayload`, `sendTemplateMessage`, `sendSessionMessage`, `normalizeInboundMessage`, `normalizeStatusEvent`, `normalizeProviderError`, etc.).
- **Identifier Prefix:** All generated IDs use prefix `mock_msg_...`.
- **Lifecycle Statuses:** Outputs `SIMULATED_SENT`, `SIMULATED_DELIVERED`, `SIMULATED_READ`, or structured failures.
- **Live Disconnect Guard:** `messagingProviderRegistry.js` throws an explicit HTTP 403 `LIVE_MODE_DISABLED` if any caller requests `'LIVE'` provider mode. Real Meta Cloud API integration is intentionally disconnected.
- **Developer Simulation Routes:** In `devMessagingRoutes.js`, developer routes are guarded by `process.env.NODE_ENV !== 'production'`.

---

## 8. Existing Seven Dashboard Modules & Functional Matrix

All seven primary screens required by the platform are developed, fully populated, and verified:

| Screen | Frontend Component | Primary Routes | Backend Service | DB Models | Current Hardcoded Assumption | Observed Baseline Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Overview** | `Dashboard.jsx` | `GET /api/dashboard/overview` | `reportService.js` | `Campaign`, `Contact`, `Message`, `Conversation` | Copy mentions "property leads", "real estate messages". | **PASS** (100% verified) |
| **2. Contacts** | `ContactsPage.jsx` | `GET/POST /api/contacts`, `/imports` | `contactController.js`, `importController.js` | `Contact`, `ContactGroup`, `AudienceSegment`, `ImportJob` | Real estate fields (`interestedPropertyType`, `interestedProject`, `budgetRange`, sources: 99acres, Magicbricks). | **PASS** (100% verified) |
| **3. Templates** | `TemplatesPage.jsx` | `GET/POST /api/templates`, `/template-media` | `templateController.js` | `MessageTemplate`, `TemplateVersion`, `TemplateMedia` | Sample variables focus on `{{project}}`, `{{city}}`, property brochures. | **PASS** (100% verified) |
| **4. Campaigns** | `CampaignsPage.jsx` | `GET/POST /api/campaigns` | `campaignExecutionService.js` | `Campaign`, `CampaignExecution`, `CampaignAudience`, `CampaignMessageJob` | Real estate goal categories ("Property Launch", "Site Visit Invitation"). | **PASS** (100% verified) |
| **5. Inbox & Auto-reply** | `InboxPage.jsx` | `GET /api/inbox/*`, `/api/dev/mock-messaging/*` | `inboxService.js`, `autoReplyRuleService.js` | `Conversation`, `ConversationMessage`, `AutoReplyRule`, `QuickReply` | Hardcoded default rules: `BROCHURE`, `PRICE` (1BHK/2BHK), `VISIT` (sample flat), default name "M2W Luxury Realty". | **PASS** (100% verified) |
| **6. Reports** | `ReportsPage.jsx` | `GET /api/reports/*`, `/api/reports/export` | `reportService.js` | `Message`, `Campaign`, `ConsentRecord`, `ReportGeneration` | Aggregates only by `ownerId: req.user._id`. Export filename defaults to `relay_campaign_report`. | **PASS** (100% verified) |
| **7. Settings** | `SettingsPage.jsx` | `GET/PATCH /api/settings/*` | `settingsController.js` | `User`, `BusinessProfile`, `UserPreferences` | Real estate category default; "Single Operator" badge in UI. | **PASS** (100% verified) |

---

## 9. File Upload & Storage Architecture

### Current Implementation
- **Brochure / Template Media:** Handled by Multer in `templateMediaRoutes.js`. Stored in local directory `/Users/sumitthakur/Desktop/Relay/uploads/template-media/`. Filenames are randomized with timestamp + random bytes. Scoped to `ownerId: req.user._id`. Magic byte content inspection verifies valid file types.
- **Import Spreadsheets:** Handled in `importRoutes.js`. Stored in system temp directory `os.tmpdir()/relay-imports/`. Cleaned up on server restart for files older than 24 hours.
- **Logo Storage:** `BusinessProfile.logoUrl` stores either a URL or static asset reference (`/logo.png`).
- **CRITICAL MULTI-TENANT ISSUE:** File storage is unpartitioned by workspace. While database queries scope download to `ownerId`, files share a single flat filesystem folder without workspace quotas, workspace subdirectories, or S3/object-storage abstractions.

---

## 10. Reporting Aggregations & Export Services

### Current Implementation (`backend/src/services/reportService.js`)
- Total lines: 1,457 lines of aggregation logic.
- Methods: `getOverview`, `getCampaignPerformance`, `getMessageStatusSummary`, `getConsentAudit`, `exportReportStream`.
- Metrics calculation enforces the 12-status lifecycle breakdown.
- Exports support streaming CSV and ExcelJS workbooks with formula injection sanitization (`'` prefix on `=, +, -, @`).
- **CRITICAL MULTI-TENANT ISSUE:** Every pipeline starts with `{ $match: { ownerId: owner } }`. To migrate safely, this query must match `{ workspaceId: workspace }` without breaking existing cached reports or single-business owner references.

---

## 11. Complete List of Hardcoded Business & Real Estate Assumptions

The audit revealed the following specific hardcoded real estate assumptions:

1. **Frontend Sidebar Branding (`AppLayout.jsx` lines 214–229):** Hardcoded `alt="M2W Realty"`, `<strong>{user?.businessName || 'M2W Realty'}</strong>`, and subtitle `Single Operator`.
2. **Dashboard Copy (`Dashboard.jsx` lines 206–220):** "Upload XLSX or CSV property leads", "Personalized real estate messages".
3. **Contact Form Dropdowns (`ContactFormModal.jsx` lines 19–48):** Property types (2 BHK, 3 BHK, Villas, Penthouse, Residential Plots) and lead sources (99acres, Magicbricks, Housing.com) hardcoded in constant arrays.
4. **Auto-Reply Rules (`autoReplyRuleService.js` lines 48–145):**
   - Fallback business name `'M2W Luxury Realty'`.
   - Fallback city `'Gurugram'`.
   - Default rules for `BROCHURE` (linking to `https://relaycrm.io/brochure/prestige-park`), `PRICE` (asking for 2BHK/3BHK/Villa), `VISIT` (inviting to experience center).
5. **Business Profile Defaults (`BusinessProfile.js` line 27):** Default `businessCategory: 'Real Estate'`, default country `'India'`.
6. **Unique Phone Index (`Contact.js` line 33):** Scoped to `{ ownerId: 1, phoneNumber: 1 }`. Under a multi-tenant model, if User A owns Workspace 1 and Workspace 2, User A could not add the same contact to both workspaces!

---

## 12. Security Risks & Technical Debt Inventory

| ID | Severity | Category | Risk Description | Remediation Plan |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | **P0** | **Multi-Tenancy** | No workspace authorization middleware. All controllers rely solely on `req.user._id`. | Introduce `WorkspaceMembership`, `requireWorkspace` middleware, validate membership on every route. |
| **SEC-02** | **P0** | **Data Isolation** | Phone number uniqueness is `{ownerId, phoneNumber}` rather than `{workspaceId, phoneNumber}`. | Update compound unique index to `{workspaceId: 1, phoneNumber: 1}`. |
| **SEC-03** | **P1** | **Queue Isolation** | Message worker tick claims jobs globally without workspace isolation or fair-share rate limits. | Partition queue dispatch by workspace; verify active workspace subscription before processing. |
| **SEC-04** | **P1** | **Storage Scoping** | Uploaded media stored in flat local folder without workspace folder partitioning or quota tracking. | Partition media directories by `uploads/workspaces/:workspaceId/media/`; enforce storage limits. |
| **SEC-05** | **P2** | **Version Control** | No `.git` repository initialized in the project directory. | Initialize git repository; establish strict branching strategy before SaaS migration. |
| **SEC-06** | **P2** | **Public Registration** | Public signup does not exist yet. Current system only supports login for pre-seeded or manual users. | Build secure self-serve registration with email verification and onboarding wizard. |

---

## 13. Audit Conclusion & Baseline Readiness

The Relay codebase is in an exceptionally stable, thoroughly tested, and clean baseline state:
- **237 / 237 automated tests passing.**
- **0 runtime syntax errors or broken imports.**
- **Offline Mock Provider prevents any external API leaks.**
- **No data loss has occurred.**
- **M2W Realty functional reference is intact.**

The codebase is **100% READY** for architectural blueprinting and multi-tenant preparation.
