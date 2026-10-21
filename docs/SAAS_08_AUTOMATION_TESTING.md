# Relay SaaS — Automation Testing Console (Phase 8 of 15)

## 1. Zero-Side-Effect Dry-Run Engine

The Automation Testing Console provides business operators with a risk-free environment to preview and debug their auto-reply keyword logic without persisting messages or alerting real contacts.

Implemented in [`workspaceMockService.dryRunAutomationTest`](file:///c:/Users/Admin/Desktop/Relay-main/backend/src/services/workspaceMockService.js) and served via:
`POST /api/workspaces/current/mock/test-dryrun`

```json
{
  "incomingText": "Tell me about your TRIAL membership",
  "contactId": "67b000000000000000000001"
}
```

---

## 2. Execution Evaluation & Response Schema

The endpoint executes full rule resolution in memory with zero database writes:

```json
{
  "matchFound": true,
  "matchedRule": {
    "name": "Gym Free Trial Auto-Reply",
    "triggerKeyword": "TRIAL",
    "actionType": "SEND_MESSAGE"
  },
  "triggeredKeyword": "TRIAL",
  "suppressionOutcome": "NONE",
  "renderedReply": "Hi Alex! Welcome to FitZone Gym. Your 3-day complimentary pass is ready.",
  "variableResolution": {
    "customer_name": "Alex",
    "business_name": "FitZone Gym",
    "service_name": "Gym Membership"
  },
  "executionTrace": [
    { "stage": "AUTH_VERIFIED", "timestamp": "2026-10-21T07:20:00.000Z", "details": "Workspace scope resolved" },
    { "stage": "SUPPRESSION_CHECK", "timestamp": "2026-10-21T07:20:00.005Z", "outcome": "NONE" },
    { "stage": "RULE_MATCHED", "timestamp": "2026-10-21T07:20:00.010Z", "rule": "Gym Free Trial Auto-Reply", "keyword": "TRIAL" },
    { "stage": "VARIABLE_INTERPOLATION", "timestamp": "2026-10-21T07:20:00.015Z", "tokensResolved": 3 },
    { "stage": "DRY_RUN_COMPLETE", "timestamp": "2026-10-21T07:20:00.020Z", "sideEffects": "NONE" }
  ]
}
```

---

## 3. Industry Keyword Presets

The test console offers pre-configured presets reflecting the business's selected industry:

| Industry | Suggested Test Keywords | Expected Action |
|---|---|---|
| **Real Estate** | `BROCHURE`, `PRICE`, `VISIT` | Send project PDF link, schedule site visit |
| **Gym & Fitness** | `TRIAL`, `MEMBERSHIP`, `TIMINGS` | Issue day pass, membership tier rates |
| **Salon & Spa** | `SERVICES`, `PRICE`, `APPOINTMENT` | Price list, booking link |
| **Clinics & Healthcare** | `SERVICES`, `HOURS`, `LOCATION` | Consultation hours, clinic Google Maps link |
| **Education & Coaching** | `COURSES`, `FEES`, `ADMISSION` | Course catalog, batch admission details |
| **Automobile Dealership** | `MODEL`, `TESTDRIVE`, `BROCHURE` | Schedule test drive, spec sheet |

---

## 4. UI Implementation

The frontend component [`frontend/src/components/mock/AutomationTestConsole.jsx`](file:///c:/Users/Admin/Desktop/Relay-main/frontend/src/components/mock/AutomationTestConsole.jsx) embeds:
- Input textarea with 1-click industry preset chips.
- Test contact selector.
- Live rule match banner (Jade for match, Amber for unhandled).
- Rendered response preview card.
- Collapsible step-by-step execution trace inspector.
