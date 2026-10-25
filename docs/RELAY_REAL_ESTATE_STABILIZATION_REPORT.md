# Relay Real Estate stabilization — verification report

**Date:** 23 October 2026 (Asia/Kolkata). **Overall acceptance: partial; remaining checks listed below. M2W sign-in is restored.**

The stabilization changes and the isolated QA checks below are implemented. The existing M2W account initially rejected the supplied credentials with HTTP **401: Invalid email or password** because they did not match the stored hash. The old authentication code accepted several hardcoded passwords without matching that hash; that bypass was removed. In a subsequent follow-up, the user explicitly authorized resetting only the M2W owner account to the supplied password and invalidating its old sessions. That targeted reset is complete. Actual browser login and authenticated `/auth/me` now return **200**, and M2W identity survives navigation and refresh on all seven major routes. See the [live account verification](qa/real-estate/m2w-live-login.json).

## Root causes and changes

- Auth tokens and the selected workspace were shared through localStorage, and the backend preferred a shared cookie over explicit bearer credentials. An intermittent concurrent-registration assertion was found on a fresh database. Registration now waits for the unique email index before admitting concurrent writes, and the final duplicate-registration test passes. Sessions use tab-local random cookie selectors, separate HttpOnly cookies, per-session server revocation, and tab-local workspace selection. Existing bearer/cookie API clients remain compatible. Password-version revocation is preserved. A new login forks a selector inherited from an opener tab.
- Workspace resolution could silently fall back after an unauthorized explicit selection, and several core operations used only owner IDs. Explicit foreign/invalid workspace selection now fails closed. Contacts, templates, campaigns, recipient snapshots, messaging, reports and related new records carry the verified tenant context. Workspace loading/errors gate the outlet; changing workspace remounts page state. Existing owner-scoped planning libraries remain compatible; campaign recipient selection is narrowed to the active workspace. The shared shell was not redesigned.
- The template library contained a separate hardcoded Real Estate list. It now reads the existing industry pack, uses the verified workspace, maps descriptive preset categories to supported saved-template categories, and keeps presets unsaved until an explicit save. The existing Real Estate pack supplies 15 templates, eight replies, five marketing rules and two campaign starters.
- Loading a preset into a blank editor was a no-op. Draft/selected state and preset loading were repaired. Unavailable preview values are no longer replaced with invented customer/property data or dates. Variable controls and labels follow the workspace industry.
- Library GETs created records. They are now read-only; starter installation is an explicit additive action with deterministic IDs and concurrency protection. New marketing rules remain disabled; existing reviewed states are preserved. Historical duplicate records were not deleted or modified.
- STOP handling could be bypassed by takeover/cooldown or configured in multiple saved rules. One protected path now runs before marketing automation, claims an inbound event once, preserves opt-out history, prevents synthetic STOP from changing genuine contacts, and never opts a customer in merely for sending START. Historical saved compliance definitions are retained but do not run as additional compliance handlers.
- Template/library controls, responsive drawers, campaign actions and Inbox headers/composers needed layout repairs. Runtime references to undefined Inbox setters/loaders were also found through actual browser testing and repaired. Settings no longer reports a localStorage/timer-based simulated connection as an API result.

## Files modified

See the [per-file manifest](qa/real-estate/changed-files.md). It distinguishes the stabilization pass from the extensive uncommitted work present at entry, and identifies other changes observed during the session. The credential recovery follow-up changed no application source files; it updated this report and added `qa/real-estate/m2w-live-login.json`. No commit, repository/database reset, destructive seed or deployment was performed.

## Real Estate module status

**PASS below applies to the executed isolated checks, not full existing-account acceptance.** Unexercised flows are listed afterward. Existing-M2W sign-in, seven-route navigation/refresh and dashboard viewport checks now pass; existing-record CRUD was not performed.

| Module | Frontend | Functionality | Backend/Data | Result |
|---|---|---|---|---|
| Dashboard | Browser render/refresh and viewport sweep | Existing aggregation regression cases | Genuine fixture counts from scoped APIs | PASS |
| Contacts | Add form, details, refresh, responsive table | Create/reload; API update, duplicates, metadata, consent/import regression coverage | Disposable persisted contacts; original five M2W contacts preserved | PASS |
| Templates | Preset/editor/preview/mobile controls | Explicit save, reload, update and version two | 15 registry presets; scoped saved templates/version APIs | PASS |
| Campaigns | List and starter wizard | Starter saved as Draft; scheduling/execution/eligibility API regression cases | No automatic schedule or dispatch | PASS |
| Inbox | Actual history, header, composer and adaptive panes | Existing message/note/follow-up regression cases | Tenant metadata retained on new conversation records | PASS |
| Auto-Reply | Starter definitions and saved rules | Five disabled rules; matching, concurrency, STOP/takeover/idempotency tests | Protected compliance path and preserved history | PASS |
| Quick Replies | Review/save eight definitions, refresh | Explicit additive save; stable IDs; CRUD regression cases | No new records on GET | PASS |
| Reports | All five tabs opened in browser | Aggregation, consent, CSV/XLSX API regression cases | Workspace-scoped real fixture records; mock labeling | PASS |
| Settings | All eight panels and real integration-status refresh | Profile/security/preferences/billing regression cases | Persisted fixture identity; provider stays disconnected/mock | PASS |

## Cross-account results

| Check | Existing accounts | Isolated browser/API accounts |
|---|---|---|
| M2W login | **PASS** — HTTP 200 after explicitly authorized credential reset | PASS |
| M2W authenticated refresh | **PASS** — identity retained across all seven main routes | PASS |
| Clinic login/refresh | NOT TESTED — current credentials unavailable | PASS |
| Gym login/refresh | NOT TESTED — no active Gym workspace found in the inspected local workspace list | PASS |
| Independent logout | NOT TESTED on existing accounts | PASS — shared browser cookie jar, other tabs remain authenticated |
| Identity/title/industry isolation | M2W identity/title PASS; existing cross-account isolation NOT TESTED | PASS — three accounts and correct libraries |
| Authorization tampering | Not run against private existing records | PASS — foreign workspace denied; invalid selectors rejected; private IDs scoped |

The browser fixtures are explicitly named **M2W Realty (isolated QA)**, **Clinic QA**, and **Fitness QA**. They use a separate disposable MongoDB server and API on port 5001; QA Vite runs on 5174. The original 5000/5173 services were reused for inspection and not replaced.

## Executed verification

| Command/check | Actual result |
|---|---|
| `npm --prefix backend test` | **324 passed, 0 failed** in the guarded isolated runner |
| Targeted industry/template/inbox run: `node --test backend/test/realEstateStabilization.test.js backend/test/prompt4Templates.test.js backend/test/prompt7Inbox.test.js` | **26 passed, 0 failed** after final industry wording/strict-resolution adjustments |
| `npm --prefix frontend test` | **142 passed, 0 failed** |
| `npm --prefix frontend run build` | PASS; Vite warns that a JavaScript chunk exceeds 500 kB |
| `node backend/qa/browserCheck.cjs` with local Playwright/Chromium paths | **12 workflow checks, 70 viewport checks**, zero uncaught exceptions, zero unexpected API failures, zero document overflows |
| `node backend/qa/moduleCheck.cjs` with local Playwright/Chromium paths | **14 checks**: contact form/save/reload/details, five Reports tabs, eight Settings panels; no uncaught exceptions or unexpected API errors |
| Existing M2W browser login and authenticated `/auth/me` | **200** after authorized reset; seven route refreshes pass; dashboard fits 1525×1024, 1280×800 and 430×932; zero uncaught exceptions or authenticated HTTP failures |
| `git diff --check` | Existing whitespace findings remain in `requireWorkspace.js` and the untouched `settingsRoutes.js`; no unrelated formatting pass performed |
| Lint/typecheck | NOT TESTED — no lint or typecheck scripts are configured |

The initial unguarded backend baseline was stopped after inspection revealed legacy suites that can reset demo credentials. The default backend test script now selects isolated/pure suites and preloads a guard that permits only MongoDB instances created by that test process. These six local-database suites are explicitly excluded, not reported as passing: `e2eClinicAndM2W.test.js`, `prompt1DemoSetup.test.js`, `prompt2MockCampaignAutomation.test.js`, `prompt3OverviewReportsSettings.test.js`, `prompt91DryRunE2E.test.js`, `prompt9MockFinishing.test.js`.

Raw evidence: [backend log](qa/real-estate/backend-tests.log), [final targeted log](qa/real-estate/targeted-tests.log), [frontend log](qa/real-estate/frontend-tests.log), [build log](qa/real-estate/frontend-build.log), [browser results](qa/real-estate/results.json), [module results](qa/real-estate/module-results.json).

The credential recovery follow-up reran `npm --prefix frontend test` (**142 passed, 0 failed**) and `npm --prefix frontend run build` (**PASS**, same chunk-size warning). Its [live verification evidence](qa/real-estate/m2w-live-login.json) records the actual local M2W account separately from the disposable fixtures.

## Browser evidence and limits

Rendered widths: **1920, 1525, 1440, 1366, 1280, 1024, 768, 430, 390 and 375 pixels**. Heights: desktop/laptop 800, reference desktop 1024, tablet 1024, mobile 932. The seven major routes were refreshed, measured, captured, and visually reviewed using screenshot sheets. Additional mobile Template Preview/Editor controls were exercised.

- [Template Studio desktop](qa/real-estate/templates-desktop.png), [Templates mobile](qa/real-estate/templates-430.png), [Templates viewport sheet](qa/real-estate/templates-viewport-sheet.jpg).
- [Inbox desktop](qa/real-estate/inbox-1525.png), [Inbox mobile](qa/real-estate/inbox-375.png), [Inbox viewport sheet](qa/real-estate/inbox-viewport-sheet.jpg).
- [Contacts details](qa/real-estate/contact-detail-desktop.png), [Contacts viewport sheet](qa/real-estate/contacts-viewport-sheet.jpg), [Campaigns viewport sheet](qa/real-estate/campaigns-viewport-sheet.jpg).
- [Dashboard viewport sheet](qa/real-estate/app-viewport-sheet.jpg), [Reports viewport sheet](qa/real-estate/reports-viewport-sheet.jpg), [Settings viewport sheet](qa/real-estate/settings-viewport-sheet.jpg), [Settings integration status](qa/real-estate/settings-integration-desktop.png).

This is not exhaustive proof of every button, browser, dataset or accessibility interaction. The complete bulk-import wizard, every group/saved-audience combination, campaign scheduling/retry controls, export dialog/download clicks, destructive controls, production mail/billing/provider connections, and every settings save were **not exhaustively exercised in the browser**. Existing isolated API suites cover many of those underlying operations; they do not replace missing browser evidence.

## Data safety and duplicate remediation

- Read-only before/after hashes confirm **all seven original M2W saved templates and all five original M2W contacts are unchanged**. No original document was deleted; see the [data-preservation audit](qa/real-estate/data-preservation.json). No existing workspace was deleted or reset.
- QA CRUD, successful multi-account logins, mock message tests and cleanup ran on disposable MongoDB instances. No global demo seeder or reset command was run. The failed existing-account login created its normal `login_failure` security-audit entry. The subsequently authorized local recovery changed only the M2W owner's password hash, password-change timestamp, authentication version and update timestamp, and wrote a `password_changed` audit entry. Increasing the authentication version invalidates old sessions; there were zero unrevoked M2W server-session records to mark revoked. Successful browser verification then created its normal login timestamp, session and security-audit entry.
- Before/after hashes across the authorized recovery and browser check confirm **297 business records across 74 collections and all six other user accounts remained unchanged**. The evidence contains no password, hash, session cookie or token.
- Separate live Clinic activity was observed during the pass, including new records and login sessions from a Chrome client. It is recorded as concurrent activity, not represented as this pass's isolated QA or reverted. Therefore this report does **not** claim that the entire live database had zero writes.
- The original 15 unscoped M2W quick replies contain **five groups of three fully identical business definitions**. Ten redundant candidates and their rule references are documented in the [read-only duplicate remediation report](qa/real-estate/duplicate-dry-run.json). Nothing was archived, reassigned or deleted. Tenant attribution and any archival need explicit written authorization.
- Meta, Razorpay and production SMTP were not connected. Offline Mock Mode remains in place.

## Remaining acceptance work

1. Review the targeted dry run before authorizing legacy quick-reply workspace attribution/archival. Until then, the unscoped historical replies remain preserved outside the active workspace library; the eight industry definitions are available for explicit review/save.
2. Supply authorized current Clinic/Gym test sessions if existing-account cross-industry browser acceptance is required. No Gym workspace was created to satisfy a test.
3. Finish the untested browser interactions listed above before declaring universal acceptance. Existing-account CRUD was deliberately not used as a test. The large bundle warning and pre-existing whitespace findings remain.

No second-industry dashboard work or next phase was started.
