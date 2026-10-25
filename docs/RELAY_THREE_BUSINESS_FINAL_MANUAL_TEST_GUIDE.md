# Relay — Three-Business Final Manual Test Guide (Local Demo)

Mock-only demo. No SMTP, Razorpay, Meta or real WhatsApp is used. Database: `relay_demo`.

## 0. Run locally

| Item | Command / URL |
|---|---|
| MongoDB | `mongod --dbpath scratch/mongodb-data --port 27017 --bind_ip 127.0.0.1` |
| Backend | `npm --prefix backend run dev` (port 5000; the queue worker runs inside it) |
| Frontend | `npm --prefix frontend run dev` → http://localhost:5174 |
| Health | http://localhost:5000/api/health (expects `ok`, `mockMode: true`) |
| Seeder (only if fixtures are missing) | `npm --prefix backend run seed:initial` |
| Backend tests | `npm --prefix backend test` |
| Frontend tests / build | `npm --prefix frontend test`, `npm --prefix frontend run build` |
| E2E | No Playwright configured — manual only |

Backend errors and worker activity appear in the terminal running the backend.
Passwords: read them from `scratch/.demo-passwords.json` (keyed by email). Do not paste them into logs.

Accounts: `owner.m2w@relay-demo.test`, `owner.gym@relay-demo.test`, `owner.clinic@relay-demo.test`.
Start with M2W.

Routes: `/login`, `/app` (Overview), `/app/contacts`, `/app/templates`, `/app/campaigns`, `/app/inbox`, `/app/reports`, `/app/settings`.
Confirm the exact paths in the sidebar links if one differs.

Each test: Account · Route · Action · Expected · DB effect · Security · [ ] PASS [ ] FAIL

## 1. Per-business tests (repeat for M2W = A, Gym = B, Clinic = C)

| ID | Route | Action | Expected | DB effect | Security | Result |
|---|---|---|---|---|---|---|
| X-01 | `/login` | Log in with the owner email and password | Lands on `/app` (real dashboard, not Getting Started) | Session issued | Own workspace only | [ ] PASS [ ] FAIL |
| X-02 | `/app` | Refresh | Stays logged in, same business name | None | — | [ ] PASS [ ] FAIL |
| X-03 | `/app/contacts` | View list | 5 seeded contacts (plus any you added) | `contacts` owned by this owner | No other business's names | [ ] PASS [ ] FAIL |
| X-04 | `/app/contacts` | Add contact "AUDIT Test", phone `+919999000001` | Appears in list | New `contacts` doc | — | [ ] PASS [ ] FAIL |
| X-05 | `/app/contacts` | Edit, search, set industry fields, refresh | Changes persist | Doc updated | — | [ ] PASS [ ] FAIL |
| X-06 | `/app/contacts` | Submit an empty name or invalid email | Meaningful error | No doc created | — | [ ] PASS [ ] FAIL |
| X-07 | `/app/contacts` | Delete only "AUDIT Test" | Removed | Doc removed | Seeds untouched | [ ] PASS [ ] FAIL |
| X-08 | `/app/templates` | View | 7 generic drafts, "Not Submitted" | `templates` | — | [ ] PASS [ ] FAIL |
| X-09 | `/app/templates` | Edit Welcome Message, save, refresh, preview with a contact | Persists; rendered name uses this business | Doc updated | Other businesses unchanged | [ ] PASS [ ] FAIL |
| X-10 | `/app/templates` | Create then archive a test draft | Created, then hidden | Doc created, then archived | 7 originals intact | [ ] PASS [ ] FAIL |
| X-11 | `/app/campaigns` | Open the seeded demo draft | Correct template and audience | — | Same-workspace only | [ ] PASS [ ] FAIL |
| X-12 | `/app/campaigns` | Launch in Mock Mode | Moves Running → Completed | Execution, 5 jobs, 5 messages `SIMULATED_SENT` | No external call | [ ] PASS [ ] FAIL |
| X-13 | `/app/inbox` | Create a conversation with a synthetic contact and send a simulated inbound | Thread persists after refresh | Conversation and messages | — | [ ] PASS [ ] FAIL |
| X-14 | `/app/inbox` | Activate one rule, send a matching keyword | Mock reply uses the business name | `ruleexecutions` SUCCESS | — | [ ] PASS [ ] FAIL |
| X-15 | `/app/inbox` | Deactivate the rule, send the keyword again | No new reply | No SUCCESS record | — | [ ] PASS [ ] FAIL |
| X-16 | `/app/inbox` | Pause automation (manual takeover) and send a keyword | No reply | PAUSED_TAKEOVER record | — | [ ] PASS [ ] FAIL |
| X-17 | `/app/inbox` | Send STOP from a synthetic contact | Contact "Opted Out"; excluded from campaigns | Contact status changed | Synthetic provenance | [ ] PASS [ ] FAIL |
| X-18 | `/app/reports` | Check counts and filters (Today, 7d, 30d, Month, Custom) | Matches actual activity | — | Own data only | [ ] PASS [ ] FAIL |
| X-19 | `/app/settings` | Edit the business phone or location, save, refresh, logout, login | Persists | Profile updated | — | [ ] PASS [ ] FAIL |
| X-20 | Sidebar | Check logo | M2W logo only for M2W; FG / CC initials for Gym / Clinic; no broken image | — | — | [ ] PASS [ ] FAIL |
| X-21 | Any | Click Logout, press Back | Redirected to `/login` | Session cleared | Protected | [ ] PASS [ ] FAIL |

## 2. Login errors

| ID | Action | Expected | Result |
|---|---|---|---|
| L-01 | Wrong password | Error message, no session | [ ] |
| L-02 | Unknown email | Generic error | [ ] |
| L-03 | Open `/app/contacts` while logged out | Redirect to `/login` | [ ] |

## 3. Cross-tenant checks (as one owner, using another's IDs via the API)

| ID | Action | Expected | Result |
|---|---|---|---|
| T-01 | Log in as Gym after Clinic | No Clinic contacts, templates, reports or logo visible | [ ] |
| T-02 | Request a foreign contact, template, campaign or conversation ID | 404/403 with no data | [ ] |
| T-03 | Send a forged `x-workspace-id` | Settings returns 403 | [ ] |

## 4. Mobile navigation

Test at 390px and 320px: the sidebar opens and closes, tables scroll inside their container, the Save button is visible, and the page has no horizontal overflow. [ ] PASS [ ] FAIL

## 5. Notes

- A STOP simulation leaves that synthetic contact "Opted Out". This is intended.
- The 15s cooldown is bypassed for the synthetic inbound simulator (non-production only).
