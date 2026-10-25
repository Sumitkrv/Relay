# SaaS 10 — Centralized Workspace Entitlement Engine

## 1. Overview
The Entitlement Engine (`workspaceEntitlementService.js`) provides authoritative, server-owned access control for all workspace operations. Frontend "PAID" booleans or client-side flags are never trusted.

---

## 2. Core Entitlement Checks
Every sensitive backend operation verifies capability through the engine:
- `canAccessFeature(workspaceId, featureName)`
- `canCreateCampaign(workspaceId)`
- `canRunMockCampaign(workspaceId)`
- `canScheduleCampaign(workspaceId)` (Requires paid `relay_solo` plan; blocked in trial)
- `canUseLiveMessaging(workspaceId)` (**Strictly returns `false` in Phase 10**)

---

## 3. Status Mapping to Capabilities
| Subscription Status | Mock Simulator | Campaign Executions | Template Studio | Unified Inbox | Reports & Exports | Live Messaging |
|---|---|---|---|---|---|---|
| `NO_SUBSCRIPTION` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `TRIALING` | ✅ (Active) | ✅ (Mock only) | ✅ (Up to 5) | ✅ | ✅ | ❌ |
| `TRIAL_EXPIRED` | ❌ (Paused) | ❌ (Blocked) | Read-only | Read-only | Read-only | ❌ |
| `ACTIVE` | ✅ | ✅ (Within quota) | ✅ (Up to 50) | ✅ | ✅ | ❌ |
| `CANCEL_AT_PERIOD_END` | ✅ | ✅ (Until end date) | ✅ | ✅ | ✅ | ❌ |
| `PAST_DUE` (Grace) | ✅ | ⚠️ Warning banner | ✅ | ✅ | ✅ | ❌ |
| `HALTED` / `CANCELLED` | ❌ | ❌ | Read-only | Read-only | Read-only | ❌ |
| `LEGACY_ENTITLED` (M2W) | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |

---

## 4. Phase 10 Critical Rule: Zero Live Messaging
Even with an `ACTIVE` subscription and verified recurring payments, **live WhatsApp sending to real numbers remains strictly disabled**.
Live messaging activation requires official Meta embedded signup verification, registered phone sender, approved Meta templates, and explicit deployment-level live-provider enablement in future phases.
