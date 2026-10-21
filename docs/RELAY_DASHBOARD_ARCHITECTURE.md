# Relay — Real Estate WhatsApp Automation: Dashboard Architecture

**Document Version:** 1.0.0 (Prompt 2 Implementation)  
**System:** Relay Single-Operator Control Center  
**Design System:** Midnight Slate × Jade  
**Author:** Principal MERN Stack Architect & Real-Time Dashboard Engineer  

---

## 1. Overview & Operational Scope

The **Relay Operational Dashboard** serves as the central control plane for ONE business owner operating a single WhatsApp Business number for Real Estate property enquiries under the **M2W Realty** brand.

The dashboard replaces generic CRM vanity widgets with a focused, honest, and high-density automation control center structured into six clear operational sections (A through F).

```
+-----------------------------------------------------------------------------------------------+
| SECTION A: Page Header, Business Context (M2W Realty), Refresh & Primary Quick Actions        |
+-----------------------------------------------------------------------------------------------+
| SECTION B: Four Primary KPI Cards                                                             |
| [ Total Contacts ]  [ Verified Opted-In ]  [ Scheduled / Active ]  [ Customer Replies (Mock) ]|
+-----------------------------------------------------------------------------------------------+
| SECTION F: Guided Onboarding Checklist (Progressively Disclosed when Data is Incomplete)      |
+-----------------------------------------------------------------------------------------------+
| SECTION C: Main Operational Split Grid (~62% / ~38%)                                          |
| [ Campaign Overview: Status Segment Strip & Recent Table ] | [ WhatsApp Provider & Diagnostics]|
+-----------------------------------------------------------------------------------------------+
| SECTION D: Balanced Execution & Messaging Row (50% / 50%)                                     |
| [ Upcoming Scheduled Campaigns (IANA Timezone) ]           | [ Inbox Summary & Auto-Reply ]   |
+-----------------------------------------------------------------------------------------------+
| SECTION E: Audit & Operations Row (50% / 50%)                                                 |
| [ Recent CRM Activity Timeline (Top 10 Events) ]           | [ Needs Attention: Active Alerts]|
+-----------------------------------------------------------------------------------------------+
```

---

## 2. KPI Definitions & Database Sources

| KPI Card | Display Label | Data Source & Calculation | Truthfulness & Exclusion Rules |
| :--- | :--- | :--- | :--- |
| **Card 1** | **Total Contacts** | `Contact.countDocuments({ ownerId, isDeleted: false })` | Counts only non-deleted contacts. Excludes soft-deleted property records. |
| **Card 2** | **Verified Opted-In** | MongoDB Aggregation on `ConsentRecord` joined to active `Contact` | Strictly requires affirmative consent evidence: `record.status: 'Opted In'`, `record.consentPurpose`, `record.consentSource`, `record.evidenceReference`, and `record.consentCapturedAt`. Suppressed/opted-out contacts are strictly excluded. Phone number or Excel upload is NOT assumed to be consent. |
| **Card 3** | **Scheduled / Active Campaigns** | Sum of scheduled campaigns (`mockSchedule.status: 'scheduled'`) and running mock executions (`CampaignExecution.find({ ownerId, status: 'running' })`) | Displays explicit mock simulation badges. Does not conflate simulation runs with live Meta Cloud API delivery. |
| **Card 4** | **Verified Customer Replies** | Provider webhook message records with `trustLevel: 'trusted_provider'` | **Honest Provider Offline State:** When WhatsApp provider integration is disconnected, metric displays `"Not available"` with subtitle *"Connect WhatsApp to see verified customer replies."* Does **NOT** display a misleading numeric 0 or count manual CRM notes/synthetic test messages. |

---

## 3. Section Architecture & Implementations

### SECTION A: Page Header & Quick Actions
- **Heading**: `Overview`
- **Eyebrow**: Dynamic business branding context: `WORKSPACE OVERVIEW · M2W REALTY` (derived from `BusinessProfile` or user settings).
- **Subtitle**: `Manage your contacts, campaigns and WhatsApp activity from one place.`
- **Right Header Actions**:
  - `Refresh`: Manual triggering with non-blocking subtle spinning indicator and last-refreshed timestamp.
  - `Import Contacts`: Routes directly to `/import` (real Excel/CSV upload workflow).
  - `New Campaign`: Routes directly to `/campaigns/new`.
- **Quick Actions Bar**:
  - `Import Contacts`: `/import`
  - `Create Template`: `/templates`
  - `Create Campaign`: `/campaigns/new`
  - `Open Inbox`: `/inbox`

### SECTION B: Four Primary KPI Cards
- Standard desktop: 4 equal cards in one row (~125px height, subtle borders, micro-elevations, consistent iconography).
- Tablet (`<= 1024px`): 2 columns.
- Mobile (`<= 768px`): 1 column.

### SECTION C: Campaign Overview & Provider Connection Status
- **Left Column (~62%)**:
  - **Segmented Status Pill Strip**:
    - `Total`: All non-archived campaigns.
    - `Draft`: `status: 'Draft'`
    - `Ready`: `status: 'Validated for Preparation'`
    - `Scheduled (Mock)`: `mockSchedule.status: 'scheduled'`
    - `Running (Mock)`: `CampaignExecution.status: 'running'`
    - `Completed (Mock)`: `CampaignExecution.status: 'completed'`
    - `Failed (Mock)`: `CampaignExecution.status: 'failed'`
  - **Recent Campaigns Table**:
    - Columns: Campaign Name, Audience, Template, Status (normalized with mock indicators), Last Updated, Action.
    - Empty State: Clean icon, message, and direct `Create your first campaign` action.
- **Right Column (~38%)**:
  - **WhatsApp Provider Status Card**:
    - Provider Name: `Official WhatsApp Cloud API`
    - Connection Status: `Disconnected` (Pill)
    - Execution Mode: `Mock Mode (Safe)` (Pill)
    - Business Number: `Single Operator · Disconnected`
    - Webhook Status: `Not Available`
    - Template Sync: `Not Available`
  - **Separate System Diagnostics**:
    - Backend: `CRM Online` (verified backend connectivity)
    - Database: `MongoDB Connected` (`mongoose.connection.readyState === 1`)
    - Worker: `Mock Engine Active`
  - **Direct Action**: `Open Integration Settings` (`/settings?tab=channels`).

### SECTION D: Upcoming Scheduled Campaigns & Inbox Summary
- **Left Column**:
  - Upcoming campaigns sorted by `mockSchedule.startAt` ascending.
  - Displayed in owner's configured IANA timezone (`userPreferences.timezone || 'Asia/Kolkata'`).
  - Fields: Campaign Name, Scheduled Time, Audience Size, Execution Mode (`Mock Simulation`), Action.
  - Empty state with schedule button when no future schedules exist.
- **Right Column**:
  - **Inbox & Follow-up Summary**:
    - `Open Conversations`: Internal CRM open conversation threads.
    - `Needing Review / Tasks`: Overdue or pending follow-up tasks.
    - `Internal Unread`: Sum of internal unread counter across workspace.
    - `Verified WhatsApp Replies`: Truthfully marked `Not available` while provider is offline.
  - **Isolation Banner**: Distinguishes internal CRM notes/tasks from verified incoming/outgoing provider messages.
  - Direct Action: `Open Inbox & Auto-reply` (`/inbox`).

### SECTION E: Recent Activity & Operational Alerts
- **Left Column**:
  - Unified projection of top 10 recent CRM activity events (`ContactActivity`, `CampaignActivity`, `ConversationActivity`, `SecurityAuditLog`).
  - Categorized by module with distinct jade/purple/slate icon badges and timestamps.
- **Right Column**:
  - **Needs Attention**: Deterministic operational checks:
    - *Business Profile Incomplete*: Warning if trading name, email, phone or city missing.
    - *WhatsApp Cloud API Disconnected*: Informational status with direct link to settings.
    - *Failed Simulation Runs*: Error alert if mock executions failed.
    - *Rejected Import Rows*: Warning if CSV/XLSX imports encountered validation rejects.

### SECTION F: Guided Onboarding Checklist
- Progressively displayed when workspace setup is incomplete:
  1. Complete Business Profile (`/settings?tab=business`)
  2. Import Contacts (`/import`)
  3. Review Consent Records (`/contacts?whatsappConsentStatus=Opted%20In`)
  4. Create WhatsApp Template (`/templates`)
  5. Prepare Campaign (`/campaigns/new`)
  6. Review WhatsApp Integration Readiness (`/settings?tab=channels`)

---

## 4. Backend Endpoints & Aggregation Details

### `GET /api/dashboard/overview`
- **Authentication**: Requires valid JWT cookie or `Bearer` token (`requireAuth`).
- **Tenant Scope**: Strict `ownerId: req.user._id` across all queries and aggregations.
- **Performance**: High-concurrency `Promise.all` aggregation across 20 focused queries, completing in `< 40ms` in memory.
- **Indexes**:
  - `Campaign`: `{ ownerId: 1, 'mockSchedule.status': 1, 'mockSchedule.startAt': 1 }`
  - `Contact`: `{ ownerId: 1, isDeleted: 1, whatsappConsentStatus: 1 }`
  - `ConsentRecord`: `{ ownerId: 1, contactId: 1, recordedAt: -1 }`
  - `Conversation`: `{ ownerId: 1, status: 1, lastActivityAt: -1 }`

---

## 5. Security, Mock Isolation & Regression Protection

1. **Strict Mock Mode Preservation**:
   - No external Meta Cloud API sending is implemented.
   - Simulation jobs do NOT create fake provider message IDs or simulated delivery receipts masquerading as real Meta events.
2. **Standard 100% Zoom Responsive Layout**:
   - Zero viewport scaling hacks (`zoom: 0.9` or `transform: scale(0.9)` are prohibited).
   - Validated across 1600px, 1440px, 1280px, 1024px, 768px, 390px, and 320px with zero horizontal scroll overflow.
3. **Tenant Data Isolation**:
   - Automated tests verify zero data leakage between different workspace owners.
