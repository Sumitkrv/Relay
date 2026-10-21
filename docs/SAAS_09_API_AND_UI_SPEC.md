# Relay SaaS — Connection Manager API & UI Specification (Phase 9 of 15)

## 1. REST API Endpoint Reference

All endpoints are mounted on `/api/workspaces/current/whatsapp` and require valid JWT authentication (`requireAuth`) and active workspace membership (`requireWorkspace`).

| Method | Endpoint | Description | Request Body | Response (200/201) |
|---|---|---|---|---|
| `GET` | `/connection` | Retrieves current workspace connection status. | None | `{ success: true, data: WhatsAppConnection }` |
| `GET` | `/readiness` | Evaluates independent readiness criteria. | None | `{ success: true, data: { overallStatus, checks, canActivateLive } }` |
| `GET` | `/diagnostics` | Retrieves technical diagnostic metadata. | None | `{ success: true, data: { syntheticSenderId, wabaId, ... } }` |
| `POST` | `/onboarding/start` | Initiates new onboarding session with state hash. | `{ requestedPhone, countryCode, connectionMethod }` | `{ success: true, data: WhatsAppOnboardingAttempt }` |
| `GET` | `/onboarding/current` | Fetches active non-expired onboarding session. | None | `{ success: true, data: WhatsAppOnboardingAttempt }` |
| `POST` | `/onboarding/method` | Updates connection method (Option A vs Option B). | `{ attemptId, connectionMethod }` | `{ success: true, data: WhatsAppOnboardingAttempt }` |
| `POST` | `/onboarding/mock-advance` | Advances mock step with deterministic scenario. | `{ attemptId, step, scenario, payload }` | `{ success: true, attempt, connection }` |
| `POST` | `/onboarding/cancel` | Safely cancels ongoing onboarding attempt. | `{ attemptId }` | `{ success: true, message: String }` |
| `POST` | `/disconnect` | Safely disconnects connection (preserves data). | `{ reason }` | `{ success: true, message, connection }` |
| `POST` | `/reconnect` | Resets connection for new setup session. | None | `{ success: true, message, connection }` |

---

## 2. Design Tokens & Visual Hierarchy

In compliance with Relay's Midnight Slate × Jade aesthetic:
- **Canvas Background:** `#F5F7FA`
- **Surface / Cards:** `#FFFFFF`
- **Dark Sidebar / Hero:** `#111827`
- **Primary Jade:** `#0D9488`
- **Primary Hover:** `#0F766E`
- **Primary Text:** `#111827`
- **Secondary Text:** `#667085`
- **Borders & Dividers:** `#E5E7EB`

---

## 3. Component Hierarchy

```
SettingsPage.jsx
└── WhatsAppConnectionManager.jsx
    ├── Connection Detail Grid (4 Cards: Sender, Type, Billing, Plan)
    ├── Expandable Diagnostics Panel (Technical Metadata)
    ├── Disconnect Confirmation Modal
    └── ConnectionWizardModal.jsx (7-Step Stepper)
        ├── Step 1: Number Entry Form
        ├── Step 2: Connection Type Selection Cards (Option A vs B)
        ├── Step 3: Meta Official Authorization Simulation
        ├── Step 4: Verification Code Input
        ├── Step 5: Customer Meta Messaging Billing Review
        ├── Step 6: Relay Software Plan Review
        └── Step 7: Readiness Checklist & Mock Activation
```
