# Relay SaaS — Multi-Tenant Security & Isolation Matrix (Phase 8 of 15)

## 1. Threat Model & Security Architecture

Relay enforces defense-in-depth isolation across all simulation, queue, campaign, and inbox modules.

```mermaid
graph TD
    Client[HTTP Client] --> AuthMw[requireAuth (JWT Verification)]
    AuthMw --> WsMw[requireWorkspace (Membership & Role Verification)]
    WsMw --> Controller[Controller Context (req.workspace._id)]
    Controller --> Service[Service Layer Scoped with workspaceId]
    Service --> Mongo[(MongoDB Indexed Queries { workspaceId: 1, ... })]
```

---

## 2. Threat Vector Mitigations

| Threat Vector | Severity | Mitigation Strategy | Verification Status |
|---|---|---|---|
| **Forged `workspaceId` Parameter** | Critical | Controller ignores client-supplied `workspaceId` bodies and binds strictly to `req.workspace._id` established by `requireWorkspace`. | **PASS (403/404 Blocked)** |
| **Cross-Tenant Conversation Access** | Critical | Inbox queries filter `{ workspaceId: req.workspace._id }`. Gym user cannot retrieve Salon threads. | **PASS (Zero Leakage)** |
| **Cross-Tenant Inbound Injection** | High | `/api/workspaces/current/mock/simulate-inbound` resolves conversations strictly inside the authenticated workspace. | **PASS (Rejected)** |
| **Demo Reset Accidental Data Loss** | Critical | `resetWorkspaceDemoData` executes with filter `{ workspaceId, isDemo: true }`. Genuine contacts and M2W Realty records are immune. | **PASS (Verified 0 Genuine Touched)** |
| **Queue Starvation / Cross-Tenant Claim** | High | Queue jobs indexed by `{ workspaceId: 1, status: 1 }`. Round-robin fair batching bounds tenant concurrency. | **PASS (Fairness Verified)** |
| **Unauthorized Live API Access** | High | Endpoint `/mock/attempt-live` returns HTTP 403 `LIVE_PROVIDER_DISABLED`. No live Meta credentials permitted. | **PASS (403 Enforced)** |

---

## 3. Automated Isolation Test Evidence

From [`backend/test/saasPrompt8MultiTenantDemo.test.js`](file:///c:/Users/Admin/Desktop/Relay-main/backend/test/saasPrompt8MultiTenantDemo.test.js):
- Test 3: Gym user attempting to read Salon conversation messages receives 0 messages; attempts to query Salon contacts return empty arrays.
- Test 4: M2W Realty genuine contacts and templates are audited before and after demo setups and resets, confirming 0 document mutations.
- Test 5: Safe demo reset on Gym workspace removes all Gym demo contacts while preserving 100% of Salon and M2W demo records.
