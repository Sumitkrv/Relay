# RELAY SAAS — SAAS 06: KEYWORD AUTOMATION PRESET LIBRARY

## 1. Automation Architecture & Compliance Safeguards

Relay's Keyword Automation engine matches incoming inbound WhatsApp messages and drafts contextual automated responses.

### Critical Compliance Invariant: Reserved Suppression Keywords
The keyword engine strictly protects compliance keywords. Any attempt to register an automation rule triggered by:
- `STOP`
- `UNSUBSCRIBE`
- `CANCEL`
- `QUIT`
- `END`
- `OPTOUT`

is immediately rejected by `validateTriggerKeywords()` in `industryValidationService.js`. These keywords are reserved exclusively for product-level opt-out suppression and revocation. Inbound messages matching these keywords immediately record opt-out consent status and cease automated marketing.

### Inactive by Default
All rules created from presets persist with:
- `enabled: false`
- `actionType: 'RUN_MOCK_REPLY'`
- `workspaceId: workspace._id`

No messages are ever dispatched merely because an industry was selected.

---

## 2. Default Keyword Presets by Vertical

| Vertical | Trigger Keywords | Match Type | Priority | Suggested Response Summary |
|---|---|---|---|---|
| **Real Estate** | `BROCHURE`, `PDF`, `CATALOG` | CONTAINS | 10 | Delivers project brochure link & summary |
| **Real Estate** | `PRICE`, `COST`, `PRICING`, `BUDGET` | CONTAINS | 10 | Shares general pricing range & offers consultation |
| **Real Estate** | `VISIT`, `SITEVISIT`, `TOUR` | CONTAINS | 15 | Facilitates site tour scheduling |
| **Real Estate** | `LOCATION`, `ADDRESS`, `MAP` | CONTAINS | 10 | Provides site address and landmarks |
| **Gym** | `MEMBERSHIP`, `PLANS`, `JOIN` | CONTAINS | 10 | Shares membership plans (monthly, annual) |
| **Gym** | `TRIAL`, `DEMO`, `FREE PASS` | CONTAINS | 15 | Invites to complimentary trial workout |
| **Gym** | `TIMINGS`, `HOURS`, `SCHEDULE` | CONTAINS | 10 | Informs facility hours (6 AM - 10 PM) |
| **Gym** | `PROGRAMS`, `CLASSES`, `WORKOUT` | CONTAINS | 10 | Lists fitness disciplines (Yoga, CrossFit, HIIT) |
| **Clinic** | `SERVICES`, `SPECIALTIES`, `TREATMENTS` | CONTAINS | 10 | Lists available consultation departments |
| **Clinic** | `HOURS`, `TIMINGS`, `OPEN` | CONTAINS | 10 | Provides clinic consultation hours |
| **Clinic** | `LOCATION`, `ADDRESS`, `BRANCH` | CONTAINS | 10 | Shares facility address and parking details |
| **Clinic** | `APPOINTMENT`, `CONSULT`, `BOOK` | CONTAINS | 15 | Guides client to book consultation slot |
| **Education** | `COURSES`, `PROGRAMS`, `CLASSES` | CONTAINS | 10 | Details available coaching programs |
| **Education** | `FEES`, `PRICING`, `COST` | CONTAINS | 10 | Shares fee structures & scholarship info |
| **Education** | `ADMISSION`, `ENROLL`, `JOIN` | CONTAINS | 15 | Provides admission procedure guidelines |
| **Education** | `BATCH`, `TIMINGS`, `SCHEDULE` | CONTAINS | 10 | Lists morning, evening & weekend batches |
| **Salon** | `SERVICES`, `MENU`, `TREATMENTS` | CONTAINS | 10 | Outlines hair, skin, and makeup services |
| **Salon** | `PRICE`, `COST`, `RATE CARD` | CONTAINS | 10 | Shares rate card for grooming packages |
| **Salon** | `TIMINGS`, `HOURS`, `OPEN` | CONTAINS | 10 | Informs salon opening times |
| **Salon** | `APPOINTMENT`, `BOOKING`, `SLOT` | CONTAINS | 15 | Coordinates stylist appointment requests |
| **Automobile** | `MODEL`, `MODELS`, `CARS` | CONTAINS | 10 | Details available vehicle lineup & trims |
| **Automobile** | `BROCHURE`, `SPECS`, `FEATURES` | CONTAINS | 10 | Sends digital vehicle brochure & specs |
| **Automobile** | `TESTDRIVE`, `TEST DRIVE`, `DRIVE` | CONTAINS | 15 | Schedules personalized showroom test drive |
| **Automobile** | `PRICE`, `ONROAD`, `QUOTATION` | CONTAINS | 10 | Explains ex-showroom & EMI estimates |
| **Other** | `SERVICES`, `OFFERINGS`, `INFO` | CONTAINS | 10 | Describes core business service offerings |
| **Other** | `PRICE`, `RATES`, `QUOTE` | CONTAINS | 10 | Explains pricing and estimates policy |
| **Other** | `HOURS`, `OPEN`, `SCHEDULE` | CONTAINS | 10 | Informs business operating hours |
| **Other** | `LOCATION`, `ADDRESS`, `WHERE` | CONTAINS | 10 | Outlines physical address and contact info |

---

## 3. Normalization & Collision Rules

1. **Case & Whitespace Normalization**: All keywords are stripped of surrounding whitespace and converted to uppercase (e.g., `' brochure '` → `'BROCHURE'`).
2. **Priority Ordering**: Higher priority numbers take precedence during message rule evaluation (e.g., Priority 15 test drive rules take precedence over Priority 10 general brochure rules).
3. **Mock Provider Safety**: In Prompt 6, all newly drafted rules have `actionType: 'RUN_MOCK_REPLY'`. No live Meta API credentials or charges are invoked.
