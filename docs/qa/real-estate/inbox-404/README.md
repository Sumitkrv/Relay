# Inbox conversation 404 repair

Verified 23 October 2026, Asia/Calcutta, against the existing local M2W account on frontend 5173 and API 5000.

## Cause and behavior

The two reported conversations exist, have the M2W owner, and reference contacts explicitly assigned to M2W. Their own `workspaceId` fields are absent. The active-workspace list excluded these records, while the detail/messages guard rejected their missing workspace metadata. Opening an existing conversation could also miss it and attempt a duplicate creation.

The Inbox now accepts a conversation with absent workspace metadata only when its owner and its non-deleted contact establish the active workspace. Explicit foreign workspace IDs, foreign contacts, and contacts without a verified workspace remain inaccessible. List, statistics, details, message history and related reads use this boundary. Existing records are not backfilled. Explicitly opening an existing thread reuses its ID; new manual conversations retain the actual workspace ID.

The frontend previously loaded details both directly during selection and through the selection effect. Selection now has one loading path, ignores stale responses, clears prior detail state, and does not automatically reopen a thread after mobile back. A more specific desktop CSS rule also hid the mobile back button; the mobile selector now takes precedence.

## Modified implementation files

- [inboxController.js](../../../../backend/src/controllers/inboxController.js): consistent contact-verified access, listing, details/messages and conversation operations.
- [inboxService.js](../../../../backend/src/services/inboxService.js): legacy access verification and existing-thread reuse.
- [InboxPage.jsx](../../../../frontend/src/pages/InboxPage.jsx): selection requests and stale-state handling.
- [inbox.css](../../../../frontend/src/inbox.css): reachable mobile back button.
- [inboxWorkspaceCompatibility.test.js](../../../../backend/test/inboxWorkspaceCompatibility.test.js): disposable MongoDB regressions covering legacy reads, no read-time migration, duplicate prevention, new records, and foreign/inconsistent references.

These changes preserve the unrelated uncommitted work already present in the repository. The local API was restarted with `npm run dev` to load the changes; Mock Mode remains active.

## Verification

| Check | Result |
|---|---|
| `6adba0b30cf1681623cc5f9e` detail and messages | Both HTTP 200 |
| `6adba0ad0cf1681623cc5eb7` detail and messages | Both HTTP 200 |
| Selecting each reported row | One detail request and one messages request, matching contact |
| Actual browser checks | 9 passed; no uncaught exceptions or failed authenticated requests |
| Viewports | 1525×1024, 1280×800, 430×932; no document overflow; screenshots inspected |
| Mobile back and second selection | Passed |
| Reload and M2W identity | Passed |
| Guarded targeted Inbox/stabilization tests | 21 passed, 0 failed |
| `npm --prefix backend test` | 326 passed, 0 failed; isolated databases only |
| `npm --prefix frontend test` | 142 passed, 0 failed |
| `npm --prefix frontend run build` | Passed; existing chunk over 500 kB warning |
| Whitespace check on modified tracked source | Passed |

[Browser results](browser-results.json), [backend output](backend-tests.log), [frontend output](frontend-tests.log), [build output](frontend-build.log).

[Desktop screenshot](inbox-1525.png), [laptop screenshot](inbox-1280.png), [mobile screenshot](inbox-430.png).

## Data preservation

No direct database updates, deletions, backfills, seeds, message sends or credential changes were performed for this repair. Normal sign-in/session/audit events were persisted during verification. The final browser check opened the two reported threads, both with unread count zero.

The [read-only hash audit](data-preservation.json) confirms all four baseline conversations, all 12 saved templates, all six workspaces and all six memberships remained unchanged; no baseline record was deleted. This includes both reported conversation IDs. Six of seven baseline contacts remained unchanged.

Separate Inbox activity occurred during the verification window: one additional conversation, five messages, and a consent update on another contact were observed. The verification scripts did not invoke message-send, simulation, opt-out or conversation-creation endpoints against the live database. These concurrent changes were preserved. Therefore this report does not claim that the entire live database remained unchanged.

This repairs the reported conversation 404s and selection behavior. It does not assert that every unrelated Inbox workflow or historical tenant attribution has been migrated or fully exercised.
