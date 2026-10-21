# Relay — Real Estate WhatsApp Automation
## Reporting & Analytics Architecture Specification

> **PHASE**: PROMPT 8 OF 11  
> **SCOPE**: Single-Operator Real Estate WhatsApp Automation Platform  
> **MODULE**: `/reports` Workspace, Centralized Aggregations, Message Tracking, Consent & Opt-Out Reporting, Failure Analysis, Campaign Comparisons, Secure CSV/XLSX Exports, and Truthful Source Classification.

---

## 1. Executive Summary & Purpose

The **Reporting & Analytics** module transforms Relay into a professional, data-driven operational intelligence workspace for single-operator real estate WhatsApp automations. It consolidates metrics across campaigns, message preparation, queue execution, audience eligibility, consent suppression, and inbox activities.

Crucially, Relay implements **Authoritative Reporting Source Classification** to ensure absolute truthfulness: simulated mock outcomes are never conflated with genuine WhatsApp Cloud API delivery, and unavailable provider measurements display honest `Not Available` placeholders rather than fabricated zeros or artificial rates.

---

## 2. Core Architecture & Data Sources

```
┌────────────────────────────────────────────────────────────────────────┐
│                         Relay /reports UI                              │
│  [Overview] [Campaign Performance] [Message Activity] [Consent] [Exports]│
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP API Requests
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                Express API Controller: reportController.js             │
│   Auth Verification · Owner Scoping · Parameter & Date Validation      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Central Service Calls
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Report Service: reportService.js                     │
│  Aggregations · Timezone Parsing · Formula Injection Sanitization       │
└──────┬──────────────┬──────────────┬──────────────┬─────────────┬──────┘
       │              │              │              │             │
       ▼              ▼              ▼              ▼             ▼
┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐
│ Campaigns  │ │ Campaign   │ │  Messages  │ │  Contacts  │ │  Inbox &   │
│ & Runs     │ │ Audiences  │ │  & Events  │ │ & Consent  │ │ Auto-reply │
│ (Campaign) │ │ (Audience) │ │  (Message) │ │ (Consent)  │ │ (Conv/Rule)│
└────────────┘ └────────────┘ └────────────┘ └────────────┘ └────────────┘
```

### Authoritative Data Sources

| Domain | Authoritative Model | Key Fields & Scope |
| :--- | :--- | :--- |
| **Campaigns** | `Campaign` | `ownerId`, `name`, `status`, `category`, `executionMode`, `mockSchedule` |
| **Campaign Runs** | `CampaignExecution` | `ownerId`, `campaignId`, `status`, `startedAt`, `completedAt`, `totalJobs` |
| **Audience Snapshots** | `CampaignAudience` | `ownerId`, `campaignId`, `contactId`, `eligibilityStatus`, `exclusionReasons` |
| **Execution Jobs** | `CampaignMessageJob` | `ownerId`, `campaignId`, `executionId`, `contactId`, `status`, `attempts` |
| **Message Dispatches** | `Message` | `ownerId`, `messageId`, `campaignId`, `status`, `failureCode`, `attemptCount` |
| **Audit Events** | `MessageEvent` | `ownerId`, `messageId`, `eventType`, `attemptNumber`, `timestamp` |
| **Contacts & Consent** | `Contact`, `ConsentRecord` | `whatsappConsentStatus`, `isSuppressed`, `suppressionReason`, `consentSource` |
| **Inbox & Automation** | `Conversation`, `RuleExecution` | `status`, `internalUnreadCount`, `ruleName`, `matchedKeyword`, `executionMode` |

---

## 3. Authoritative Source Classification & Truthfulness

### Three Strict Data Classes

1. **TYPE A — INTERNAL CRM DATA**:
   - Contact records, dynamic segments, contact groups.
   - Template drafts, template versions, campaign configurations.
   - Scheduled campaign runs and planned audience snapshots.
2. **TYPE B — MOCK / SYNTHETIC TEST DATA**:
   - Mock message queue jobs and worker leases.
   - Simulated transport outcomes (`SIMULATED_SENT`, `SIMULATED_DELIVERED`, `SIMULATED_READ`).
   - Simulated failure codes (`MOCK_TIMEOUT`, `MOCK_RATE_LIMIT`, `MOCK_TEMPORARY_FAILURE`, `MOCK_PERMANENT_FAILURE`).
   - Synthetic inbox keyword simulator messages (`BROCHURE`, `PRICE`, `VISIT`, `STOP`).
3. **TYPE C — VERIFIED PROVIDER DATA**:
   - Trusted WhatsApp Cloud API webhooks (`accepted`, `delivered`, `read`, `failed`).
   - Verified customer inbound replies.
   - **Current State**: Disconnected. Meta WhatsApp Cloud API credentials are not active until official provider ingestion in Prompt 10.

### Zero vs Unavailable Semantics

| Condition | Semantics | Display Value | Rationale |
| :--- | :--- | :--- | :--- |
| **No campaigns created** | Authoritative Zero | `0 Campaigns` | Data source available, count is genuinely 0 |
| **No failures occurred** | Authoritative Zero | `0 Failures` | Pipeline ran with zero failure codes |
| **Meta API Disconnected** | Provider Unavailable | `Not Available` / `—` | Denominator & trusted provider are offline |
| **No Verified Deliveries** | Rate Unavailable | `—` | Denominator is 0; never display false 0% or positive rate |

---

## 4. Formal Metric Definitions Matrix

| Metric Name | Authoritative Source | Numerator / Value | Denominator | Missing / Offline Behavior |
| :--- | :--- | :--- | :--- | :--- |
| **Total Campaigns** | `Campaign` | Count of non-archived campaigns for owner | N/A | Displays `0` if empty |
| **Scheduled / Running** | `Campaign` | Count with status in `['Scheduled', 'Running']` | N/A | Displays `0` if empty |
| **Mock Messages Processed** | `Message` | Messages in `['SIMULATED_SENT', 'SIMULATED_DELIVERED', 'SIMULATED_READ', 'TEMPORARY_FAILURE', 'PERMANENT_FAILURE']` | N/A | Displays `0` if empty |
| **Verified Messages Sent** | Trusted Provider | Verified accepted outbound dispatches | N/A | **`Not Available` (Provider Disconnected)** |
| **Audience Size** | `CampaignAudience` | Count of audience snapshot members for campaign | N/A | Displays `0` if empty |
| **Eligible Recipients** | `CampaignAudience` | Count where `eligibilityStatus === 'Eligible for Campaign Preparation'` | Audience Size | Displays `0` if empty |
| **Excluded Recipients** | `CampaignAudience` | Count where `eligibilityStatus !== 'Eligible for Campaign Preparation'` | Audience Size | Displays `0` if empty |
| **Retry Attempts** | `Message` | `sum(attemptCount - 1)` for messages with `attemptCount > 1` | N/A | Displays `0` if empty |
| **Messages Requiring Retry** | `Message` | Unique messages where `attemptCount > 1` | N/A | Displays `0` if empty |
| **Retries Succeeded (Mock)** | `Message` | Messages with `attemptCount > 1` ending in simulated success | Retried Messages | Displays `0` if empty |
| **Retries Exhausted** | `Message` | Messages with `status === 'PERMANENT_FAILURE'` and `attempts >= maxAttempts` | Retried Messages | Displays `0` if empty |
| **Recorded Opt-Outs** | `Contact` | Count with `whatsappConsentStatus === 'Opted Out'` or `isSuppressed === true` | Total Contacts | Displays `0` if empty |

---

## 5. Campaign Performance & Multi-Campaign Comparison

### Campaign Performance Table
Located under the **Campaign Performance** tab, this view provides deep operational visibility:
- **Columns**: Campaign Name, Status Badge, Template Name, Intended Audience, Eligible Recipients, Excluded Recipients, Mock Messages Processed, Simulated Failures, Retry Attempts, Scheduled Date, Actual Run Date, and Actions.
- **Search & Filter**: Search by campaign name or category; filter by lifecycle status.
- **Server-Side Pagination**: Bounded limit (default 10) prevents unbounded memory consumption.
- **Drilldown**: "Details" action opens a focused campaign breakdown modal showing status, execution mode, audience metrics, and job stats.

### Multi-Campaign Comparison Engine
- Allows selecting **2 to 4 campaigns** via table checkboxes.
- Clicking **Compare Side-by-Side** calls `GET /api/reports/campaigns/compare?ids=id1,id2`.
- Renders an aligned matrix comparing:
  * Execution Mode (`MOCK` vs `VERIFIED_PROVIDER`)
  * Campaign Lifecycle Status
  * Pinned Template Name
  * Intended Audience Size
  * Eligible Contacts vs Excluded Contacts
  * Mock Messages Dispatched
  * Simulated Failures & Failure Reasons Breakdown
  * Total Retry Attempts & Run Duration (Formatted)
- Displays an explicit mode disclaimer preventing false equivalence between mock simulations and live provider outcomes.

---

## 6. Message Activity, Failure Analysis & Retries

### Message Status Lifecycle
Status counts are grouped into 3 explicit categories:
1. **Internal Preparation**: `DRAFT`, `PENDING_VALIDATION`, `BLOCKED`, `SCHEDULED`, `QUEUED`, `PROCESSING`, `CANCELLED`.
2. **Mock Results**: `SIMULATED_SENT`, `SIMULATED_DELIVERED`, `SIMULATED_READ`, `TEMPORARY_FAILURE`, `PERMANENT_FAILURE`.
3. **Verified Provider**: `ACCEPTED`, `DELIVERED`, `READ`, `FAILED`, `INCOMING_REPLY` (all returned as `available: false`, value: `null`).

### Normalized Failure Analysis
Failures are categorized into three distinct architectural layers:
- **Eligibility Exclusions**: Handled before message queue creation (`INVALID_PHONE`, `MISSING_CONSENT`, `CONTACT_OPTED_OUT`, `DO_NOT_CONTACT`).
- **Preparation Failures**: Occurred during personalization or template rendering (`UNRESOLVED_VARIABLE`, `TEMPLATE_INVALID`).
- **Transport Attempt Failures**: Occurred during mock engine execution (`MOCK_TIMEOUT`, `MOCK_RATE_LIMIT`, `MOCK_TEMPORARY_FAILURE`, `MOCK_PERMANENT_FAILURE`, `QUEUE_UNAVAILABLE`).

Every failure row reports the normalized code, pipeline layer, affected logical messages, total attempts made, and an actionable operator explanation.

### Retry Semantics & Deduplication
- Retries are attempts on a single persistent `Message` document identity.
- Retries do not inflate recipient totals: 1 recipient with 3 attempts is reported as **1 Unique Logical Message**, **3 Total Attempts**, and **2 Retry Attempts**.

---

## 7. Consent, Opt-Outs & Audience Exclusion Reporting

### Current State vs Historical Reconstructions
- **Current State**: Sourced directly from `Contact.whatsappConsentStatus` and `Contact.isSuppressed`.
- **Historical Events**: Sourced from immutable `ConsentRecord` events with timestamps and captured business names.
- The UI explicitly clarifies that current-state consent numbers reflect the live database snapshot.

### Exclusion Reason Multiplicity
An excluded contact may trigger multiple exclusion criteria simultaneously (e.g., `Missing Consent` + `Invalid Phone`).
- **Unique Excluded Contacts**: Count of distinct contacts excluded from campaign preparation.
- **Total Exclusion Reasons**: Sum of all triggered exclusion reason tags across all contacts.
- The reporting service makes this distinction explicit: `totalExclusionReasons >= uniqueExcludedContacts`.

---

## 8. Export Subsystem & Data Security

### Supported Formats
1. **CSV (Comma Separated Values)**:
   - UTF-8 encoded with Byte Order Mark (`\uFEFF`) for universal Excel compatibility.
   - Standard RFC 4180 escaping with double-quotes.
2. **XLSX (Microsoft Excel Workbook)**:
   - Generated using `ExcelJS`.
   - **Sheet 1 (`Summary`)**: Metadata sheet including report type, timestamp, record count, timezone, and active filters.
   - **Sheet 2 (`Details`)**: Stylized table with bold header, Midnight Slate fill (`#111827`), white text, and auto-sized columns.

### Spreadsheet Formula Injection Protection (CSV Injection)
To prevent malicious formulas from executing when an exported report is opened in Microsoft Excel, Google Sheets, or LibreOffice:
- Any cell value beginning with `= `, `+ `, `- `, `@ `, `\t`, or `\r` is automatically escaped by prepending a single quote (`'`).
- Phone numbers (e.g. `+919876543210`) are preserved while preventing spreadsheet command execution.
- Quoting ensures that spreadsheet formula triggers cannot escape cell boundaries.

### Export Security Controls
- **Authenticated Owner Scoping**: All export queries enforce `ownerId: req.user._id`.
- **Field Allowlist**: Internal password hashes, session tokens, JWTs, and internal database references are excluded.
- **Audit Archiving**: Every generated export creates an immutable `ReportGeneration` record logging the report type, filters, row count, file name, and timestamp.

---

## 9. Backend API Endpoint Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/reports/overview` | 4 Primary KPIs, secondary metrics, and responsive chart datasets |
| `GET` | `/api/reports/campaigns` | Paginated campaign performance summary table with live metrics |
| `GET` | `/api/reports/campaigns/compare` | Side-by-side comparison matrix for 2 to 4 campaigns (`?ids=id1,id2`) |
| `GET` | `/api/reports/campaigns/:id` | Detailed single campaign report |
| `GET` | `/api/reports/campaigns/:id/recipients`| Paginated recipient logs for a specific campaign |
| `GET` | `/api/reports/messages` | Paginated message logs with search and status filtering |
| `GET` | `/api/reports/messages/status` | Message status lifecycle breakdown (internal vs mock vs provider) |
| `GET` | `/api/reports/messages/failures` | Normalized failure code analysis with actionable explanations |
| `GET` | `/api/reports/messages/retries` | Retry attempts, successes in mock mode, and exhausted retries |
| `GET` | `/api/reports/scheduling` | Scheduled campaigns, due runs, and completed mock executions |
| `GET` | `/api/reports/consent` | Workspace consent overview and suppression totals |
| `GET` | `/api/reports/opt-outs` | Paginated opt-out and suppression audit trail |
| `GET` | `/api/reports/audience-exclusions` | Breakdown of audience exclusion reasons and uniqueness ratio |
| `GET` | `/api/reports/inbox` | Open, needs attention, and unread conversation statistics |
| `GET` | `/api/reports/auto-replies` | Keyword auto-reply execution counts and status breakdown |
| `GET` | `/api/reports/filters` | Available campaign IDs, statuses, and date ranges for toolbar |
| `POST` | `/api/reports/export` | Generates secure CSV or XLSX export file buffer |
| `GET` | `/api/reports/exports` | Lists archived export generation history |
| `GET` | `/api/reports/exports/:id/download` | Re-downloads an archived export file |

---

## 10. Automated Test Results

### Backend Automated Test Suite (`backend/test/prompt8Reports.test.js`)
All 8 comprehensive test scenarios executed and passed with 100% success rate:
- **Scenario A**: Empty Database Handling (Zero vs Unavailable Truthfulness) — **PASS**
- **Scenario B**: Mock Campaign & Audience Aggregations — **PASS**
- **Scenario C**: Consent & Opt-Out Reporting — **PASS**
- **Scenario D**: Retry Analytics & Logical Message Isolation — **PASS**
- **Scenario E**: Campaign Comparison (2-4 Campaigns) — **PASS**
- **Scenario F**: CSV Export Filter Matching & Formula Injection Protection — **PASS**
- **Scenario G**: XLSX (Excel) Workbook Generation — **PASS**
- **Scenario H**: Multi-Tenant Owner Isolation — **PASS**

### Total Full-Repository Verification
- **Backend Test Suite**: 114 tests passing across 15 test files (`node --test backend/test/*.test.js`).
- **Frontend Test Suite**: 61 tests passing across 10 test files (`node --test frontend/test/*.test.js`).
- **Frontend Production Build**: `vite build` completed in 2.98s with 0 errors.
- **Browser Subagent Walkthrough**: Complete visual and responsive walkthrough at 100% zoom recorded to `reports_qa_demo_1792486553593.webp`.

---

## 11. Known Limitations & Transition Path to Prompt 9 & 10

1. **Official Meta Provider Disconnected**:
   - Outbound message sends and inbound customer messages are currently generated by Relay's high-fidelity mock engine and synthetic keyword simulator.
   - Provider delivery rates, customer read rates, and verified inbound replies will activate upon official Meta WhatsApp Cloud API integration in Prompt 10.
2. **Synchronous In-Memory Exports**:
   - Current CSV and XLSX exports are generated synchronously with a bounded limit of 5,000 records, which easily covers single-operator workloads. Unbounded streaming exports can be layered in if enterprise datasets exceed 100,000 records.
