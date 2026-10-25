# RELAY DEMO PROMPT 3: MULTI-TENANT REPORTS & SETTINGS SECURITY

## 1. Tenant Scoping Architecture
Relay enforces multi-tenant boundaries at the database, service, and routing layers. Cross-tenant access is blocked regardless of client-supplied headers or request body payloads.

### Boundary Enforcement Rules:
1. **Trusted Identity:** User identity is established strictly via JWT bearer tokens verified by `authMiddleware`.
2. **Workspace Verification:** Any `x-workspace-id` header provided by the client is validated against the authenticated user's authorized workspaces (`ownerId: req.user._id` or `createdBy: req.user._id` or verified membership). A forged `x-workspace-id` is rejected or ignored.
3. **MongoDB Aggregation Pipelines:** All aggregation pipelines in [`reportService.js`](file:///Users/sumitthakur/Desktop/Relay/backend/src/services/reportService.js) prepend a mandatory `$match: { ownerId: owner }` stage before any `$lookup`, `$group`, or `$facet` stages. Joining campaigns with messages or templates never crosses tenant boundaries.
4. **Report Exports:** `exportReportData` resolves the tenant strictly from `req.user._id`. FitZone Gym cannot export M2W campaigns; CarePlus Clinic cannot export FitZone message histories.
5. **Settings Protection:** Modifications in [`settingsController.js`](file:///Users/sumitthakur/Desktop/Relay/backend/src/controllers/settingsController.js) only update the `BusinessProfile` of `req.user._id` and the `Workspace` owned by `req.user._id`. Attempts to pass another tenant's `workspaceId` or `ownerId` in request bodies are filtered out by strict property allowlists.

## 2. Automated Multi-Tenant Security Tests
The automated test suite in [`backend/test/prompt3OverviewReportsSettings.test.js`](file:///Users/sumitthakur/Desktop/Relay/backend/test/prompt3OverviewReportsSettings.test.js) verifies:
- `Cross-tenant profile update fails or isolates changes to authorized workspace`: Passing M2W's workspace ID in a request by Clinic Owner leaves M2W records unmodified.
- `Cannot modify ownerId or workspaceId via business profile update`: Immutable metadata fields cannot be altered through profile endpoints.
- `exportReportData produces safe CSV stream without cross-tenant leak`: Gym export contains only Gym records; zero M2W rows appear in the CSV stream.
- `Formula Injection Escaping`: Sanitization protects downstream spreadsheet applications from formula code execution.
