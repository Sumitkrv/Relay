# Relay — Real Estate WhatsApp Automation
## Comprehensive Module & Codebase Inventory

> **AUDIT & CODEBASE SNAPSHOT**: This document catalogs every existing module, page component, Express endpoint, Mongoose model, working feature, and architectural disposition in the repository.

---

## Module Inventory Matrix

### 1. Overview Dashboard
- **Current Route**: `/`
- **Frontend Page**: `frontend/src/pages/Dashboard.jsx`
- **Backend Endpoints**:
  * `GET /api/dashboard/stats`
  * `GET /api/dashboard/activity`
  * `GET /api/health`
- **MongoDB Models**: `Contact`, `Campaign`, `ConversationMessage`, `ContactActivity`
- **Working Features**:
  * Real contact totals and verified consent counts aggregated from MongoDB.
  * Real scheduled campaigns count.
  * Recent activity feed from real workspace events.
  * Provider readiness card showing WhatsApp Cloud API connection status and Mock Mode safety.
  * Fast quick-action tiles for common workflows.
- **Incomplete Features / Gaps**:
  * Real WhatsApp webhook delivery stats are not connected yet (operating in Mock Mode).
- **Known Issues**: None.
- **Target Placement**: **Primary Screen 1 — Overview** (`/`).
- **Decision**: **PRESERVE & ALIGN** with Real Estate WhatsApp single-operator scope.
- **Development Phase**: Prompt 0 (Foundational shell alignment) & Prompt 2.

---

### 2. Contacts & Lead Directory
- **Current Route**: `/contacts`
- **Frontend Page**: `frontend/src/pages/ContactsPage.jsx`, `ContactFormModal.jsx`
- **Backend Endpoints**:
  * `GET /api/contacts` (search, pagination, filters, sort)
  * `POST /api/contacts`
  * `GET /api/contacts/:id`
  * `PATCH /api/contacts/:id`
  * `DELETE /api/contacts/:id`
  * `POST /api/contacts/:id/consent` (audit trail)
  * `PATCH /api/contacts/:id/archive`, `PATCH /api/contacts/:id/restore`
  * `PATCH /api/contacts/bulk`
  * `GET /api/contacts/export` (CSV, XLSX)
  * `GET /api/contacts/stats`
  * `GET /api/contact-categories`, `POST /api/contact-categories`
- **MongoDB Models**: `Contact`, `ConsentRecord`, `ContactActivity`, `ContactCategory`
- **Working Features**:
  * Owner-scoped contact CRUD with E.164 phone normalization and deduplication.
  * WhatsApp affirmative consent audit trail with evidence reference and timestamp.
  * CSV/Excel export (filtered, all, or selected).
  * Bulk status, category, priority, and archive updates.
  * Slide-out contact profile drawer with timeline and notes.
- **Incomplete Features / Gaps**:
  * Needs real estate-specific fields: `interestedPropertyType` (Plots, Apartments, Villas, etc.), `interestedProject`, and `city` filters.
- **Known Issues**: None. All 25 backend tests pass.
- **Target Placement**: **Primary Screen 2 — Contacts** (`/contacts`).
- **Decision**: **PRESERVE & ENHANCE** in Prompt 3.
- **Development Phase**: Prompt 3 (Real Estate Contact Architecture & Custom Properties).

---

### 3. Contact Import (Excel & CSV)
- **Current Route**: `/import`
- **Frontend Page**: `frontend/src/pages/ImportPage.jsx`
- **Backend Endpoints**:
  * `POST /api/imports/upload`
  * `GET /api/imports/:id/preview`
  * `PATCH /api/imports/:id/mapping`
  * `POST /api/imports/:id/validate`
  * `POST /api/imports/:id/execute`
  * `GET /api/imports/:id/status`
  * `GET /api/imports/history`
  * `GET /api/imports/:id/errors`, `GET /api/imports/:id/error-report`
  * `GET /api/imports/template`, `GET /api/imports/mapping-presets`
- **MongoDB Models**: `ImportJob`, `ImportRow`, `ImportError`, `ImportMappingPreset`
- **Working Features**:
  * Multi-step import wizard: Upload (.xlsx, .csv) -> Column Mapping -> Validation -> Duplicate Handling -> Execution.
  * Automatic sheet detection and column mapping suggestions.
  * Formula execution prevention and file size validation (max 10MB, 10k rows).
  * Asynchronous processing with polling and error report downloads.
  * Safety rule: All imported contacts default to `Unknown` WhatsApp consent.
- **Incomplete Features / Gaps**:
  * Add real estate default fields (Property Type, Project, City) to column mapping presets.
- **Known Issues**: None.
- **Target Placement**: **Integrated into Contacts** (`/contacts` action + dedicated `/import` route).
- **Decision**: **MERGE INTO CONTACTS NAVIGATION** while preserving full route compatibility.
- **Development Phase**: Prompt 3.

---

### 4. Message Templates
- **Current Route**: `/templates`
- **Frontend Page**: `frontend/src/pages/TemplatesPage.jsx`
- **Backend Endpoints**:
  * `GET /api/templates`
  * `POST /api/templates`
  * `GET /api/templates/:id`
  * `PATCH /api/templates/:id`
  * `DELETE /api/templates/:id`
  * `POST /api/templates/:id/duplicate`
  * `POST /api/templates/:id/preview`
  * `POST /api/templates/:id/bulk-preview`
  * `POST /api/templates/:id/validate`
  * `GET /api/templates/:id/versions`
  * `GET /api/templates/library`
- **MongoDB Models**: `MessageTemplate`, `MessageDraft`
- **Working Features**:
  * Template CRUD with versioning snapshots and archive support.
  * Dynamic named variable substitution (`{{name}}`, `{{service}}`, etc.) with fallback defaults.
  * Real contact preview and bounded bulk previews without sending.
  * Separate local draft validation and Meta submission readiness checks.
  * Template library with pre-built message templates.
- **Incomplete Features / Gaps**:
  * Real estate-tailored templates (Plots launch, site visit callbacks, price quote responses).
  * Media-header brochure attachments (PDF/images) support.
- **Known Issues**: Previous regression `listTemplates is not defined` fixed and covered by regression test.
- **Target Placement**: **Primary Screen 3 — Templates** (`/templates`).
- **Decision**: **PRESERVE & ENHANCE** in Prompt 4.
- **Development Phase**: Prompt 4 (Real Estate WhatsApp Template Studio).

---

### 5. Campaigns & Broadcast Planner
- **Current Route**: `/campaigns`, `/campaigns/new`, `/campaigns/:id`, `/campaigns/:id/edit`
- **Frontend Page**: `frontend/src/pages/CampaignsPage.jsx`
- **Backend Endpoints**:
  * `GET /api/campaigns`
  * `POST /api/campaigns`
  * `GET /api/campaigns/:id`
  * `PATCH /api/campaigns/:id`
  * `DELETE /api/campaigns/:id`
  * `POST /api/campaigns/:id/prepare-audience`
  * `POST /api/campaigns/:id/preview`
  * `POST /api/campaigns/:id/schedule`
  * `POST /api/campaigns/:id/execute-mock`
  * `POST /api/campaigns/:id/pause`, `POST /api/campaigns/:id/cancel`
- **MongoDB Models**: `Campaign`, `CampaignAudience`, `CampaignMessageJob`, `CampaignExecution`, `CampaignActivity`
- **Working Features**:
  * Multi-step Campaign Wizard: Audience selection -> Template selection -> Recipient preview -> Confirmation & Scheduling.
  * Strict consent gate: Only contacts with verified `Opted In` status can be included in campaigns.
  * Pause, resume, and cancel capabilities.
  * Durable mock execution engine that never contacts real external APIs.
- **Incomplete Features / Gaps**:
  * Real estate audience filters (filter by City, Project, Property Interest).
- **Known Issues**: None.
- **Target Placement**: **Primary Screen 4 — Campaigns** (`/campaigns`).
- **Decision**: **PRESERVE & ENHANCE** in Prompt 6.
- **Development Phase**: Prompt 5 (Queue/Worker Engine) & Prompt 6 (Campaign Management).

---

### 6. WhatsApp Inbox & Auto-reply
- **Current Route**: `/inbox`
- **Frontend Page**: `frontend/src/pages/InboxPage.jsx`
- **Backend Endpoints**:
  * `GET /api/inbox/conversations`
  * `GET /api/inbox/conversations/:id`
  * `GET /api/inbox/conversations/:id/messages`
  * `POST /api/inbox/conversations/:id/messages` (mock send / note)
  * `POST /api/inbox/conversations/:id/read`
  * `POST /api/inbox/conversations/:id/takeover`
  * `POST /api/inbox/manual-communication`
  * `GET /api/inbox/quick-replies`, `POST /api/inbox/quick-replies`
- **MongoDB Models**: `Conversation`, `ConversationMessage`, `InternalNote`, `ConversationActivity`, `ProviderEvent`
- **Working Features**:
  * Two-way conversation timeline view with unread badges.
  * Manual communication logging (calls, offline meetings) with audit trail.
  * Saved quick replies insertion into composer.
  * Manual owner takeover flag.
- **Incomplete Features / Gaps**:
  * Keyword-based auto-replies ("BROCHURE", "PRICE", "VISIT", "STOP").
  * Immediate marketing opt-out suppression upon receiving "STOP".
- **Known Issues**: None.
- **Target Placement**: **Primary Screen 5 — Inbox & Auto-reply** (`/inbox`).
- **Decision**: **PRESERVE & ENHANCE** in Prompt 7.
- **Development Phase**: Prompt 7 (Two-Way Real Estate Inbox & Keyword Auto-Reply).

---

### 7. Reports & Outreach Analytics
- **Current Route**: `/reports`, `/analytics`
- **Frontend Page**: `frontend/src/pages/ReportsPage.jsx`, `frontend/src/pages/AnalyticsPage.jsx`
- **Backend Endpoints**:
  * `GET /api/reports`, `POST /api/reports`
  * `GET /api/reports/:id`, `PATCH /api/reports/:id`, `DELETE /api/reports/:id`
  * `POST /api/reports/:id/generate` (CSV, XLSX, PDF)
  * `GET /api/report-generations/:id/download`
  * `GET /api/analytics/overview`, `GET /api/analytics/campaigns`, `GET /api/analytics/sources`
- **MongoDB Models**: `SavedReport`, `ReportGeneration`
- **Working Features**:
  * Unified report builder with customizable date ranges and type presets.
  * Asynchronous export file generation with download token management.
  * Delivery and audience breakdown by campaign.
- **Incomplete Features / Gaps**:
  * Direct Meta delivery webhook statistics (to be connected in Prompt 9).
- **Known Issues**: None.
- **Target Placement**: **Primary Screen 6 — Reports** (`/reports`).
- **Decision**: **CONSOLIDATE**: Merged performance analytics into Reports tab; preserved `/analytics` for deep links.
- **Development Phase**: Prompt 8 (Delivery, Reply & Conversion Reports).

---

### 8. System & Account Settings
- **Current Route**: `/settings`
- **Frontend Page**: `frontend/src/pages/SettingsPage.jsx`
- **Backend Endpoints**:
  * `GET /api/auth/me`, `PATCH /api/auth/profile`, `PATCH /api/auth/password`
  * `GET /api/health`
- **MongoDB Models**: `User`
- **Working Features**:
  * Single-owner profile details (name, email) and secure password change.
  * Messaging provider status review card.
  * System operational mode status (Mock Mode active).
- **Incomplete Features / Gaps**:
  * Dedicated WhatsApp Business API credentials form (Phone Number ID, WABA ID, Access Token) for the final phase.
- **Known Issues**: None.
- **Target Placement**: **Primary Screen 7 — Settings** (`/settings`).
- **Decision**: **PRESERVE & KEEP IN PRIMARY NAV**.
- **Development Phase**: Prompt 0 & Prompt 9.

---

### 9. Hidden Legacy Modules (Preserved for Compatibility, Hidden from Primary Nav)

| Module | Route(s) | Models | Disposition | Rationale |
| :--- | :--- | :--- | :---: | :--- |
| **Sales Pipeline & Deals** | `/pipeline`, `/deals/:id`, `/clients`, `/clients/:id` | `Deal`, `DealActivity`, `DealConversion`, `PipelineStage` | **HIDDEN** | Real estate single-operator focus excludes complex multi-stage deal pipelines. Data and APIs preserved. |
| **Proposals** | `/proposals`, `/proposals/new`, `/proposals/:id` | `Proposal`, `ProposalTemplate`, `ProposalVersion` | **HIDDEN** | Proposals and quotations are out of scope for the messaging platform. Data and APIs preserved. |
| **Automation Workflows** | `/workflows`, `/workflows/new`, `/workflows/:id` | `AutomationWorkflow`, `WorkflowExecution`, `WorkflowSchedule`, `WorkflowStepExecution`, `WorkflowVersion`, `WorkflowWait`, `WorkflowEvent` | **HIDDEN** | Advanced n8n-style visual workflow builder replaced by clean campaign scheduling and keyword auto-replies. Data and APIs preserved. |
| **Chatbot Studio** | `/chatbots`, `/chatbots/:id` | `ChatbotDefinition`, `ChatbotVersion`, `ChatbotTestSession` | **HIDDEN** | Standalone complex DAG chatbot replaced by focused keyword rules ("BROCHURE", "PRICE", "VISIT", "STOP"). Data and APIs preserved. |
| **Follow-ups Module** | `/follow-ups` | `FollowUpTask`, `FollowUpRecommendation` | **HIDDEN** | Standalone CRM task manager hidden; follow-ups remain accessible inside individual contact profiles and inbox. |
| **Hot Leads & Lead Scoring** | `/hot-leads`, `/lead-scoring/settings` | `LeadScore`, `LeadScoreHistory`, `LeadScoreJob`, `LeadScoringRuleSet`, `LeadScoringRuleHistory` | **HIDDEN** | Complex numeric lead scoring algorithm hidden from primary navigation; high interest property enquiries handled via contact interest tags. |
| **Activity Logs** | `/activity` | `ContactActivity`, `ConversationActivity`, `CampaignActivity` | **HIDDEN** | Reached via Settings, Campaigns, and Contact profiles rather than cluttering primary navigation. |
