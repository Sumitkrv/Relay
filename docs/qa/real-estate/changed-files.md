# Files changed in this stabilization pass

The repository was already extensively dirty. This list is relative to the source snapshot taken before edits, not the Git HEAD diff. Existing unrelated work was preserved.

| File | Change |
|---|---|
| [backend/package.json](../../../backend/package.json) | Default backend tests use the isolated, guarded runner. |
| [backend/qa/browserCheck.cjs](../../../backend/qa/browserCheck.cjs) | Disposable QA environment, browser verification, or live-database protection. |
| [backend/qa/fixtureServer.js](../../../backend/qa/fixtureServer.js) | Disposable QA environment, browser verification, or live-database protection. |
| [backend/qa/moduleCheck.cjs](../../../backend/qa/moduleCheck.cjs) | Disposable QA environment, browser verification, or live-database protection. |
| [backend/qa/noLiveDatabase.js](../../../backend/qa/noLiveDatabase.js) | Disposable QA environment, browser verification, or live-database protection. |
| [backend/qa/runTests.js](../../../backend/qa/runTests.js) | Disposable QA environment, browser verification, or live-database protection. |
| [backend/src/config/industries/definitions/realEstate.js](../../../backend/src/config/industries/definitions/realEstate.js) | Workspace-scoped messaging, industry library, opt-out or duplicate-prevention repair. |
| [backend/src/controllers/authController.js](../../../backend/src/controllers/authController.js) | Cookie selection, explicit-credential precedence and session-specific revocation. |
| [backend/src/controllers/campaignController.js](../../../backend/src/controllers/campaignController.js) | Reuse unsaved starter drafts and preserve tenant context through planning/execution. |
| [backend/src/controllers/campaignExecutionController.js](../../../backend/src/controllers/campaignExecutionController.js) | Reuse unsaved starter drafts and preserve tenant context through planning/execution. |
| [backend/src/controllers/contactController.js](../../../backend/src/controllers/contactController.js) | Persist supported real-estate metadata and scope CRM operations. |
| [backend/src/controllers/dashboardController.js](../../../backend/src/controllers/dashboardController.js) | Scope aggregates, history and exports to the authorized workspace. |
| [backend/src/controllers/inboxController.js](../../../backend/src/controllers/inboxController.js) | Workspace-scoped messaging, industry library, opt-out or duplicate-prevention repair. |
| [backend/src/controllers/messageController.js](../../../backend/src/controllers/messageController.js) | Workspace-scoped messaging, industry library, opt-out or duplicate-prevention repair. |
| [backend/src/controllers/reportController.js](../../../backend/src/controllers/reportController.js) | Scope aggregates, history and exports to the authorized workspace. |
| [backend/src/controllers/settingsController.js](../../../backend/src/controllers/settingsController.js) | Display backend integration state and persisted business identity without simulated client success. |
| [backend/src/controllers/templateController.js](../../../backend/src/controllers/templateController.js) | Use the industry registry, valid draft categories and honest variables/previews. |
| [backend/src/middleware/auth.js](../../../backend/src/middleware/auth.js) | Cookie selection, explicit-credential precedence and session-specific revocation. |
| [backend/src/middleware/requireWorkspace.js](../../../backend/src/middleware/requireWorkspace.js) | Workspace-scoped messaging, industry library, opt-out or duplicate-prevention repair. |
| [backend/src/models/AuthSession.js](../../../backend/src/models/AuthSession.js) | Persist tenant metadata or tab-session/inbound-event lifecycle state; existing records unchanged. |
| [backend/src/models/BusinessProfile.js](../../../backend/src/models/BusinessProfile.js) | Persist tenant metadata or tab-session/inbound-event lifecycle state; existing records unchanged. |
| [backend/src/models/CampaignAudience.js](../../../backend/src/models/CampaignAudience.js) | Persist tenant metadata or tab-session/inbound-event lifecycle state; existing records unchanged. |
| [backend/src/models/CampaignExecution.js](../../../backend/src/models/CampaignExecution.js) | Persist tenant metadata or tab-session/inbound-event lifecycle state; existing records unchanged. |
| [backend/src/models/ContactActivity.js](../../../backend/src/models/ContactActivity.js) | Persist tenant metadata or tab-session/inbound-event lifecycle state; existing records unchanged. |
| [backend/src/models/ConversationActivity.js](../../../backend/src/models/ConversationActivity.js) | Persist tenant metadata or tab-session/inbound-event lifecycle state; existing records unchanged. |
| [backend/src/models/ConversationMessage.js](../../../backend/src/models/ConversationMessage.js) | Persist tenant metadata or tab-session/inbound-event lifecycle state; existing records unchanged. |
| [backend/src/models/FollowUpTask.js](../../../backend/src/models/FollowUpTask.js) | Persist tenant metadata or tab-session/inbound-event lifecycle state; existing records unchanged. |
| [backend/src/models/InboundRuleClaim.js](../../../backend/src/models/InboundRuleClaim.js) | Persist tenant metadata or tab-session/inbound-event lifecycle state; existing records unchanged. |
| [backend/src/models/InternalNote.js](../../../backend/src/models/InternalNote.js) | Persist tenant metadata or tab-session/inbound-event lifecycle state; existing records unchanged. |
| [backend/src/models/MessageDraft.js](../../../backend/src/models/MessageDraft.js) | Persist tenant metadata or tab-session/inbound-event lifecycle state; existing records unchanged. |
| [backend/src/models/QuickReply.js](../../../backend/src/models/QuickReply.js) | Persist tenant metadata or tab-session/inbound-event lifecycle state; existing records unchanged. |
| [backend/src/models/ReportGeneration.js](../../../backend/src/models/ReportGeneration.js) | Persist tenant metadata or tab-session/inbound-event lifecycle state; existing records unchanged. |
| [backend/src/models/RuleExecution.js](../../../backend/src/models/RuleExecution.js) | Persist tenant metadata or tab-session/inbound-event lifecycle state; existing records unchanged. |
| [backend/src/routes/authRoutes.js](../../../backend/src/routes/authRoutes.js) | Cookie selection, explicit-credential precedence and session-specific revocation. |
| [backend/src/routes/campaignRoutes.js](../../../backend/src/routes/campaignRoutes.js) | Register explicit starter-library actions or asynchronous auth handling. |
| [backend/src/routes/inboxRoutes.js](../../../backend/src/routes/inboxRoutes.js) | Register explicit starter-library actions or asynchronous auth handling. |
| [backend/src/services/audienceSelectionService.js](../../../backend/src/services/audienceSelectionService.js) | Reuse unsaved starter drafts and preserve tenant context through planning/execution. |
| [backend/src/services/autoReplyRuleService.js](../../../backend/src/services/autoReplyRuleService.js) | Workspace-scoped messaging, industry library, opt-out or duplicate-prevention repair. |
| [backend/src/services/campaignExecutionService.js](../../../backend/src/services/campaignExecutionService.js) | Reuse unsaved starter drafts and preserve tenant context through planning/execution. |
| [backend/src/services/inboxService.js](../../../backend/src/services/inboxService.js) | Workspace-scoped messaging, industry library, opt-out or duplicate-prevention repair. |
| [backend/src/services/reportService.js](../../../backend/src/services/reportService.js) | Scope aggregates, history and exports to the authorized workspace. |
| [backend/src/utils/contactValidation.js](../../../backend/src/utils/contactValidation.js) | Persist supported real-estate metadata and scope CRM operations. |
| [backend/src/utils/sessionCookie.js](../../../backend/src/utils/sessionCookie.js) | Cookie selection, explicit-credential precedence and session-specific revocation. |
| [backend/src/utils/templateEngine.js](../../../backend/src/utils/templateEngine.js) | Use the industry registry, valid draft categories and honest variables/previews. |
| [backend/src/utils/tenantScope.js](../../../backend/src/utils/tenantScope.js) | Workspace-scoped messaging, industry library, opt-out or duplicate-prevention repair. |
| [backend/test/prompt4Templates.test.js](../../../backend/test/prompt4Templates.test.js) | Regression coverage for intentional industry/session/consent behavior. |
| [backend/test/prompt7Inbox.test.js](../../../backend/test/prompt7Inbox.test.js) | Regression coverage for intentional industry/session/consent behavior. |
| [backend/test/prompt92ReleaseHardening.test.js](../../../backend/test/prompt92ReleaseHardening.test.js) | Regression coverage for intentional industry/session/consent behavior. |
| [backend/test/realEstateStabilization.test.js](../../../backend/test/realEstateStabilization.test.js) | Regression coverage for intentional industry/session/consent behavior. |
| [backend/test/saasPrompt4Auth.test.js](../../../backend/test/saasPrompt4Auth.test.js) | Preserve duplicate-registration assertions and print returned statuses on failure. |
| [backend/test/saasPrompt5Onboarding.test.js](../../../backend/test/saasPrompt5Onboarding.test.js) | Regression coverage for intentional industry/session/consent behavior. |
| [frontend/src/campaigns.css](../../../frontend/src/campaigns.css) | Scoped responsive editor, drawer, header, or action layout repairs. |
| [frontend/src/components/ContactFormModal.jsx](../../../frontend/src/components/ContactFormModal.jsx) | Persist supported real-estate metadata and scope CRM operations. |
| [frontend/src/context/AuthContext.jsx](../../../frontend/src/context/AuthContext.jsx) | Tab-isolated session/workspace restoration and stale-state protection. |
| [frontend/src/context/WorkspaceContext.jsx](../../../frontend/src/context/WorkspaceContext.jsx) | Tab-isolated session/workspace restoration and stale-state protection. |
| [frontend/src/inbox.css](../../../frontend/src/inbox.css) | Scoped responsive editor, drawer, header, or action layout repairs. |
| [frontend/src/layout/AppLayout.jsx](../../../frontend/src/layout/AppLayout.jsx) | Workspace loading/error gate and keyed outlet only; shell design preserved. |
| [frontend/src/marketing/pages/PrivacyPage.jsx](../../../frontend/src/marketing/pages/PrivacyPage.jsx) | Describe tab-local session storage and HttpOnly cookies accurately. |
| [frontend/src/pages/CampaignsPage.jsx](../../../frontend/src/pages/CampaignsPage.jsx) | Reuse unsaved starter drafts and preserve tenant context through planning/execution. |
| [frontend/src/pages/DevTestingHubPage.jsx](../../../frontend/src/pages/DevTestingHubPage.jsx) | Use the shared real sign-in flow instead of shared localStorage credentials. |
| [frontend/src/pages/InboxPage.jsx](../../../frontend/src/pages/InboxPage.jsx) | Workspace-scoped messaging, industry library, opt-out or duplicate-prevention repair. |
| [frontend/src/pages/SettingsPage.jsx](../../../frontend/src/pages/SettingsPage.jsx) | Display backend integration state and persisted business identity without simulated client success. |
| [frontend/src/pages/TemplatesPage.jsx](../../../frontend/src/pages/TemplatesPage.jsx) | Use the industry registry, valid draft categories and honest variables/previews. |
| [frontend/src/services/api.js](../../../frontend/src/services/api.js) | Tab-isolated session/workspace restoration and stale-state protection. |
| [frontend/src/services/campaigns.js](../../../frontend/src/services/campaigns.js) | Reuse unsaved starter drafts and preserve tenant context through planning/execution. |
| [frontend/src/services/inbox.js](../../../frontend/src/services/inbox.js) | Workspace-scoped messaging, industry library, opt-out or duplicate-prevention repair. |
| [frontend/src/services/tabSession.js](../../../frontend/src/services/tabSession.js) | Tab-isolated session/workspace restoration and stale-state protection. |
| [frontend/src/templates.css](../../../frontend/src/templates.css) | Scoped responsive editor, drawer, header, or action layout repairs. |
| [frontend/test/prompt4Templates.test.js](../../../frontend/test/prompt4Templates.test.js) | Regression coverage for intentional industry/session/consent behavior. |

Supporting artifacts: `docs/RELAY_REAL_ESTATE_STABILIZATION_REPORT.md` and this QA directory.

Other changes observed during the pass but not authored here: `frontend/src/utils/industryResolver.js`, industry-label adjustments in `frontend/src/pages/ContactsPage.jsx`, and `backend/src/scripts/test_live_api.js`. The latter script was not executed by this pass. `.DS_Store` files were also left untouched.
