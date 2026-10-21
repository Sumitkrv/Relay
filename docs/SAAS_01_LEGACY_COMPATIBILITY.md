# RELAY SAAS — LEGACY M2W REALTY COMPATIBILITY SPECIFICATION
## Single-Operator Data Protection, Non-Destructive Isolation & Prompt 2 Cutover Strategy

> **Document Version:** 1.0.0  
> **Phase:** SAAS PROMPT 1 OF 15  
> **Status:** Active Transitional Boundary (Prompt 1) → Scheduled Cutover (Prompt 2)  
> **Reference Tenant:** M2W Luxury Realty  

---

## 1. The Transitional Dilemma & The Solution

In the baseline Relay codebase:
- All 63 Mongoose models store tenant records using `ownerId: ObjectId (ref: User)`.
- Existing CRUD routes (`/api/contacts`, `/api/campaigns`, `/api/templates`, `/api/inbox`, `/api/reports`) filter documents using `{ ownerId: req.user._id }`.
- M2W Luxury Realty's contacts, templates, campaigns, and consent records do NOT possess a `workspaceId` field yet.

### The Catastrophic Mistake Avoided in Prompt 1
If Prompt 1 had modified existing CRUD controllers to immediately require `workspaceId` or filter by `{ workspaceId: req.workspaceId }`:
- All existing M2W contacts, campaigns, and templates would have immediately disappeared from the user's dashboard.
- M2W's dashboard would appear wiped out.
- Automated tests expecting M2W single-operator records would have failed.

### The Prompt 1 Architectural Solution
Relay implements a **Strict Transitional Boundary**:
1. **Existing Routes Remain Unbroken:** Pre-existing CRUD routes continue to execute safely scoped to `req.user._id` (the authenticated owner).
2. **New Workspace APIs Are Fully Tenant-Aware:** Endpoints under `/api/workspaces/*` strictly enforce `requireAuth` and `requireWorkspace`.
3. **No Automatic Backfill in Prompt 1:** No migration script has been run; no `workspaceId` has been retroactively injected into legacy documents.
4. **No Mixed Queries / No Dangerous Fallbacks:** Controllers do NOT do `find({ $or: [{ workspaceId }, { ownerId }] })`. A query either operates in the verified workspace domain or the legacy owner domain.
5. **New Workspaces Cannot Access Legacy Records:** When a new user (User A) is provisioned with Workspace A, their queries cannot see, modify, or leak any legacy M2W records (`ownerId === legacyOwner._id`).

---

## 2. Legacy Boundary Verification & Test Evidence

The transitional boundary was verified through automated integration tests in `backend/test/saasPrompt1Workspace.test.js`:

| Test ID | Test Name | Invariant Verified | Result |
| :--- | :--- | :--- | :--- |
| **Test 26** | Existing M2W owner authentication | Legacy owner signs in with existing credentials; session token valid; `/api/auth/me` returns 200 with `M2W Luxury Realty` business profile. | **PASS** |
| **Test 27** | Existing single-owner routes work | `GET /api/contacts` returns legacy contacts created before the SaaS transition. | **PASS** |
| **Test 28** | New workspace isolation from legacy | User A (Workspace A) queries `/api/contacts` and receives an isolated array that excludes all legacy M2W contacts. | **PASS** |
| **Test 29** | Zero automatic record mutation | Direct MongoDB query confirms legacy contacts retain `ownerId: legacyOwner._id` and have `workspaceId: undefined`. | **PASS** |
| **Test 30** | Disconnected Meta API guard | Provider registry rejects `LIVE` mode with HTTP 403 `LIVE_MODE_DISABLED`. | **PASS** |

---

## 3. Database Indexes Preserved

No existing database indexes were dropped or mutated:
- `Contact`: Retains `{ ownerId: 1, phoneNumber: 1 }` (unique).
- `MessageTemplate`: Retains `{ ownerId: 1, name: 1 }`.
- `ContactGroup`: Retains `{ ownerId: 1, normalizedName: 1 }`.
- `Campaign`: Retains `{ ownerId: 1, status: 1, updatedAt: -1 }`.
- `Conversation`: Retains `{ activeWorkspaceKey: 1 }`.

The new workspace-specific indexes were created **exclusively on the new models**:
- `workspaces`: `{ slug: 1 }` (unique), `{ status: 1, createdAt: -1 }`, `{ createdBy: 1, status: 1 }`.
- `workspacememberships`: `{ workspaceId: 1, userId: 1 }` (compound unique), `{ userId: 1, status: 1 }`.

---

## 4. Controlled Cutover Plan for SAAS Prompt 2

Prompt 2 will execute the formal data migration and cutover. The exact prerequisites and steps are:

### Prompt 2 Prerequisites (All Met in Prompt 1):
1. `Workspace` model is active, validated, and tested.
2. `WorkspaceMembership` model is active with compound uniqueness.
3. `requireWorkspace` middleware and query helper services are functional.
4. Git baseline is safely committed and working tree is clean.

### Prompt 2 Execution Sequence:
1. **Full Pre-Migration Binary Backup:** `mongodump` of all collections.
2. **Provision Workspace #1:** Create `Workspace` document for M2W Luxury Realty (`slug: 'm2w-realty'`, `industryKey: 'real_estate'`).
3. **Provision Owner Membership:** Create `WorkspaceMembership` for M2W owner with `role: 'OWNER'`.
4. **Batch Backfill `workspaceId`:** Run idempotent update assigning `workspaceId: m2wWorkspace._id` across all 21 collections matching `ownerId: m2wOwner._id`.
5. **Reconciliation Checks:** Assert `countDocuments({ workspaceId: m2wWorkspace._id }) === countDocuments({ ownerId: m2wOwner._id })`.
6. **Compound Index Cutover:** Add `{ workspaceId: 1, phoneNumber: 1 }` unique index on `contacts`; drop legacy `{ ownerId: 1, phoneNumber: 1 }`.
7. **Switch Route Middleware:** Mount `requireWorkspace` on business routes and update query filters to `{ workspaceId: req.workspaceId }`.
8. **Retain `ownerId` on Documents:** Keep `ownerId` as creator audit trail; zero legacy data is deleted.
