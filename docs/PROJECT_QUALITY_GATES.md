# Relay — Real Estate WhatsApp Automation
## Permanent Project Quality Gates & Engineering Standard

> **MANDATORY GOVERNANCE DIRECTIVE**: This document defines the non-negotiable quality gates, development lifecycle, and verification discipline for all 11 phases of the **Relay — Real Estate WhatsApp Automation Platform**. Every development phase must strictly enforce these standards before declaring completion.

---

## 1. Core Principles & Philosophy

1. **Working Code First, Code Preservation Always**:
   - Never rewrite an existing working service or module from scratch.
   - Do not re-initialize the frontend, backend, or database.
   - Do not delete or overwrite historical MongoDB records.
   - Every phase must build on top of existing architecture and preserve established patterns.

2. **Functional Evidence Over Assumptions**:
   - A build passing alone is **not sufficient**.
   - A route merely rendering is **not sufficient**.
   - A button merely existing on screen is **not sufficient**.
   - Verifiable functional evidence (executed tests, database queries, network responses, and visual browser validation) is mandatory.

3. **Honest Reporting & Zero Hallucination**:
   - Never report a test as passed if it was not executed.
   - Never claim a provider or integration is live when it is disconnected or simulated.
   - Distinguish cleanly between **Mock Mode** simulation and **Verified Meta Provider Results**.

4. **Single-Operator Real Estate Focus**:
   - The platform is strictly designed for **One Owner, One Account, One Business Number, and One Centralized Dashboard**.
   - Resist scope creep: No multi-agent hierarchy, no team assignment, no deal pipeline boards, no complex DAG builders, no paid wallet systems.

---

## 2. The 13 Mandatory Quality Gates (Workflow A through M)

Every prompt/phase must execute and document these thirteen sequential steps:

### STEP A: Inspect Existing Module & Dependencies
- Inspect the current repository state, relevant frontend components, backend controllers, routes, Mongoose models, and shared utilities.
- Verify active dependencies in `package.json` before assuming libraries exist.
- Inspect Git working status and identify uncommitted or in-progress work.

### STEP B: Run Baseline Checks
- Run the frontend build (`npm --prefix frontend run build`).
- Run the frontend test suite (`npm --prefix frontend test`).
- Run the backend test suite (`npm --prefix backend test`).
- Verify database connectivity and verify that no preexisting regressions are hidden.
- Document preexisting errors separately from newly introduced defects.

### STEP C: Define Exact Acceptance Criteria
- Cross-reference the requirements against `docs/RELAY_REAL_ESTATE_SCOPE.md` and the single-operator presentation (`Relay_Real_Estate_WhatsApp_Automation_Single_Operator.pptx`).
- Establish binary (pass/fail) functional criteria for every user action, button, form, and modal.

### STEP D: Reuse Existing Architecture
- Utilize existing Mongoose schemas, service layers, and shared UI primitives (`StatCard`, `SectionCard`, `Breadcrumbs`, `ErrorBoundary`).
- Adhere strictly to the established styling tokens (Emerald `#059669`, Dark Slate `#10251f`, Neutral Gray `#64748b`, Background `#f6f8f7`, Card `#ffffff`).

### STEP E: Implement Complete Frontend
- Build full component states:
  * **Default State**: Initial clean layout.
  * **Loading State**: Accessible spinners or skeletons, with disabled inputs during submission.
  * **Empty State**: Clear contextual explanation and primary call-to-action.
  * **Error State**: Non-blocking, contextual inline error alerts and deduplicated toast notifications.
  * **Success State**: Clear confirmation messages and visual state updates.
  * **Disabled State**: Proper disabled styles on buttons and forms when unauthorized or invalid.
  * **Keyboard Focus State**: Visible outline and standard focus indicators for accessibility.
  * **Responsive State**: Responsive at all specified viewports.

### STEP F: Implement or Complete Backend APIs
- Implement Express routes using `asyncHandler` and appropriate HTTP methods.
- Enforce `requireAuth` session protection on all private endpoints.
- Ensure tenant/owner-scoped filtering (`ownerId: req.user._id` or `userId: req.user._id`) on all queries.

### STEP G: Ensure MongoDB Persistence
- Ensure all business data is persisted in real MongoDB collections via Mongoose models.
- Never use in-memory state or localStorage as a substitute for database persistence.
- Ensure soft-delete and audit trail conventions (`isArchived`, `deletedAt`, activity logs) are honored where required.

### STEP H: Validate User Input & Authorization
- Validate all incoming request bodies, query params, and file uploads.
- Sanitize inputs against injection and CSV formula execution.
- Validate E.164 phone numbers using `libphonenumber-js`.
- Never trust client-provided IDs without verifying owner ownership.

### STEP I: Run Module-Specific Tests
- Write and execute automated tests targeting the newly created or updated endpoints and components.
- Verify edge cases, invalid inputs, unauthorized access, and empty collections.

### STEP J: Run Integration & Regression Checks
- Re-run all existing backend tests (`npm --prefix backend test`).
- Re-run all existing frontend tests (`npm --prefix frontend test`).
- Specifically ensure known regression bugs (such as `listTemplates is not defined`) do not re-emerge.

### STEP K: Test Responsive Behavior
- Validate layout stability across seven target viewport breakpoints:
  * **1600px** (Large Desktop)
  * **1440px** (Standard Desktop)
  * **1280px** (Compact Desktop / Small Laptop)
  * **1024px** (Tablet Landscape / Desktop Collapse threshold)
  * **768px** (Tablet Portrait / Mobile Drawer threshold)
  * **390px** (Modern Mobile)
  * **320px** (Small Mobile)
- Verify that no horizontal page overflow occurs, table columns scroll within containers, and popovers/modals fit within the viewport.

### STEP L: Repair Discovered Regressions
- Immediately address any regression detected in existing functionality or automated suites.
- Confirm zero newly introduced defects.

### STEP M: Provide an Honest Completion Report
- Detail exactly what was changed, created, tested, and verified.
- Deliver the final verification matrix using only **PASS**, **FAIL**, **BLOCKED**, or **NOT TESTED** statuses with supporting factual evidence.

---

## 3. WhatsApp Regulatory & Safety Gates

1. **Consent Is Mandatory**:
   - A saved contact number does not equate to marketing permission.
   - Excel uploads must never automatically set WhatsApp consent to "Opted In".
   - Contacts default to `Unknown` consent upon import until affirmative evidence is recorded.
   - Any opt-out request ("STOP", "Unsubscribe", manual flag) must suppress all outbound marketing campaigns immediately.

2. **Template Compliance**:
   - Bulk messages may only use approved WhatsApp templates conforming to Meta WhatsApp Business API categories (`MARKETING`, `UTILITY`).
   - Drafts edited locally remain `Not Submitted` until verified against the provider in the final integration phase.

3. **No Unofficial Bots or Scrapers**:
   - Never use unofficial WhatsApp Web libraries (e.g. puppeteer-based WhatsApp Web bots) or rate-limit bypasses.
   - All external sending must route exclusively through the official Meta WhatsApp Cloud API once integrated.

4. **Honest Simulation Transparency**:
   - When running in Mock Mode, the interface must explicitly label actions as **Mock Mode** or **Simulation**.
   - Never present mock sent/delivered counts as real Meta events.

---

## 4. Quality Gate Verification Matrix Standard

At the conclusion of each prompt, report the module verification status in this format:

| Module / Area | UI Readiness | Functionality | MongoDB Persistence | Security / Auth | Tests Status |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Overview | PASS | PASS | PASS | PASS | PASS |
| Contacts | PASS | PASS | PASS | PASS | PASS |
| Templates | PASS | PASS | PASS | PASS | PASS |
| Campaigns | PASS | PASS | PASS | PASS | PASS |
| Inbox & Auto-reply | PASS | PASS | PASS | PASS | PASS |
| Reports | PASS | PASS | PASS | PASS | PASS |
| Settings | PASS | PASS | PASS | PASS | PASS |

*Permitted values: `PASS`, `FAIL`, `BLOCKED`, `NOT TESTED`.*
