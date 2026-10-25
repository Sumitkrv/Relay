# RELAY — TESTING STRATEGY & VERIFICATION GUIDE
## Test Execution, Regression Suites, Browser Verification & Quality Gates

> **Document Version:** 1.0.0 (Master QA & Testing Guide)  
> **Status:** Active / Source of Truth  
> **Test Framework:** Node.js Built-in Test Runner (`node --test`), `supertest`, `mongodb-memory-server`  
> **Repository Root:** `/Users/sumitthakur/Desktop/Relay`  

---

## 1. Testing Philosophy & Quality Gates

Relay enforces a rigorous verification pipeline before any code change is merged:
1. **Zero-Error Frontend Build:** `npm --prefix frontend run build` must compile cleanly without Vite bundling errors.
2. **Deterministic Test Execution:** Tests run headless using the native Node.js test runner (`node --test`) without external dependencies.
3. **Database Safety:** Tests must not truncate or delete production/demo collections in the live MongoDB instance; integration tests utilize ephemeral memory servers (`mongodb-memory-server`) or isolated test mock identifiers.
4. **Honest Reporting:** Engineers and AI agents must **never** claim tests passed without actual execution output.

---

## 2. Test Suite Inventory

### 2.1 Backend Test Suites (`backend/test/`)
Total Suites: 32 test files covering all domain modules.

| Test File | Domain / Scope | Key Assertions |
|---|---|---|
| [`prompt1DemoSetup.test.js`](file:///Users/sumitthakur/Desktop/Relay/backend/test/prompt1DemoSetup.test.js) | Environment & Seeding | Verified demo accounts, workspace initialization, and tenant keys. |
| [`saasPrompt1Workspace.test.js`](file:///Users/sumitthakur/Desktop/Relay/backend/test/saasPrompt1Workspace.test.js) | Multi-Tenant Isolation | Verifies `requireWorkspace` authorization, cross-tenant 403 blocks. |
| [`saasPrompt4Auth.test.js`](file:///Users/sumitthakur/Desktop/Relay/backend/test/saasPrompt4Auth.test.js) | Authentication Engine | JWT generation, bcrypt password hashing, `authVersion` session invalidation. |
| [`contacts.test.js`](file:///Users/sumitthakur/Desktop/Relay/backend/test/contacts.test.js) | Contacts CRUD | E.164 normalization, deduplication, search filters, affirmative consent logging. |
| [`prompt4Templates.test.js`](file:///Users/sumitthakur/Desktop/Relay/backend/test/prompt4Templates.test.js) | Templates Studio API | Version snapshots, token extraction, media header attachments. |
| [`prompt5MessagingEngine.test.js`](file:///Users/sumitthakur/Desktop/Relay/backend/test/prompt5MessagingEngine.test.js) | Mock Queue & Provider | Queue worker polling, simulated status transitions (QUEUED → DELIVERED). |
| [`prompt6Campaigns.test.js`](file:///Users/sumitthakur/Desktop/Relay/backend/test/prompt6Campaigns.test.js) | Campaign Broadcasts | Audience preparation, affirmative consent gating, batch execution. |
| [`prompt7Inbox.test.js`](file:///Users/sumitthakur/Desktop/Relay/backend/test/prompt7Inbox.test.js) | Inbox & Auto-reply | Inbound message simulator, keyword regex matching, opt-out suppression. |
| [`prompt8Reports.test.js`](file:///Users/sumitthakur/Desktop/Relay/backend/test/prompt8Reports.test.js) | Analytics & Export | Metric aggregation, CSV export file generation, token validation. |

### 2.2 Frontend Test Suites (`frontend/test/`)
Total Suites: 19 test files covering layouts, components, and service clients.

| Test File | Domain / Scope | Key Assertions |
|---|---|---|
| [`appShell.test.js`](file:///Users/sumitthakur/Desktop/Relay/frontend/test/appShell.test.js) | Application Shell | 7 primary navigation links, Midnight Navy tokens, mobile drawer accessibility. |
| [`prompt4Templates.test.js`](file:///Users/sumitthakur/Desktop/Relay/frontend/test/prompt4Templates.test.js) | Templates UI & Studio | 3-panel layout, token picker, live WhatsApp preview, docked save bar. |
| [`prompt6Campaigns.test.js`](file:///Users/sumitthakur/Desktop/Relay/frontend/test/prompt6Campaigns.test.js) | Campaign Stepper | 4-step wizard navigation, recipient pager, compliance disclaimer. |
| [`prompt7Inbox.test.js`](file:///Users/sumitthakur/Desktop/Relay/frontend/test/prompt7Inbox.test.js) | Inbox Components | 3-tab layout, quick reply inserter, synthetic inbound message simulator. |
| [`prompt8Reports.test.js`](file:///Users/sumitthakur/Desktop/Relay/frontend/test/prompt8Reports.test.js) | Reports Tabs | KPI cards, Recharts visualization wrappers, CSV export modal dialog. |
| [`saasPrompt1WorkspaceContext.test.js`](file:///Users/sumitthakur/Desktop/Relay/frontend/test/saasPrompt1WorkspaceContext.test.js) | Workspace Provider | Injects `x-workspace-id` into Axios interceptor, workspace switching. |

---

## 3. Verified Executable Test Commands

All commands below have been tested and verified to execute cleanly:

### 3.1 Run Complete Frontend Test Suite
```bash
npm --prefix frontend test
```
*Expected Result:* 135/135 tests passing (~210ms).

### 3.2 Run Frontend Production Bundle Build
```bash
npm --prefix frontend run build
```
*Expected Result:* Clean Vite build, outputting to `frontend/dist/` in ~3.8s with 0 errors.

### 3.3 Run Targeted Module Integration Tests
```bash
# Verify Templates Studio API & Frontend components
node --test backend/test/prompt4Templates.test.js
node --test frontend/test/prompt4Templates.test.js

# Verify Messaging Engine & Queue Simulation
node --test backend/test/prompt5MessagingEngine.test.js

# Verify Campaign Execution & Consent Gating
node --test backend/test/prompt6Campaigns.test.js

# Verify Inbox & Keyword Auto-Reply
node --test backend/test/prompt7Inbox.test.js

# Verify Reports & Export Generation
node --test backend/test/prompt8Reports.test.js

# Verify Multi-Tenant Workspace Isolation
node --test backend/test/saasPrompt1Workspace.test.js
```

### 3.4 Run Full Repository Integration Suite
```bash
npm run test:all
```

---

## 4. Browser Verification & Responsive QA Matrix

Every UI pass must be verified across standard viewport resolutions using browser subagent tooling or manual browser checks:

| Viewport | Device Profile | Mandatory Verification Checklist |
|---|---|---|
| **1525 × 1024** | Reference Desktop Viewport | 3 panels balanced, library list unclipped, Save Bar docked, zero field overlap. |
| **1440 × 900** | Standard 14" Laptop | Full 3-column view, uniform header buttons, comfortable message textarea. |
| **1280 × 800** | Compact 13" Laptop | Proportions scale cleanly, live preview updates with real contact data. |
| **1024 × 768** | Small Laptop / iPad Landscape | Preview cleanly collapses, accessible via "Show Preview" drawer toggle button. |
| **768 × 1024** | Tablet Portrait | Segmented tabs (`Saved`, `Editor`, `Preview`) provide focused 100% width workspaces. |
| **430 × 932** | Mobile (iPhone 14/15 Pro Max) | Full form usability, no horizontal overflow, docked save bar. |

---

## 5. Accessibility & Contrast Verification

1. **Color Contrast:** Verify all body text achieves $\ge 4.5:1$ contrast against card backgrounds (`#FFFFFF`).
2. **Keyboard Navigation:** Confirm all interactive elements are reachable via `Tab` and indicate focus with a distinct focus ring.
3. **Modal & Drawer Traps:** Ensure slide-out panels lock body scroll and trap keyboard focus until dismissed with `Escape` or close buttons.
