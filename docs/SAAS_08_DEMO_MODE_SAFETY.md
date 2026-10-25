# Relay SaaS — Demo Mode Safety & Data Protection (Phase 8 of 15)

## 1. Safety Directive & Non-Negotiable Invariants

Demo mode allows prospective and onboarding customers to safely explore Relay's automation capabilities without compromising production integrity or confusing test records with real customer contacts.

### Critical Invariants:
1. **Never Touch Genuine Records:** Existing M2W Realty contacts, consent records, templates, campaigns, and inbox messages must never be altered or wiped during demo operations.
2. **Strict Provenance Tagging:** All synthetic records are permanently tagged with `isDemo: true`.
3. **Non-Routable Identifiers:** Demo phone numbers use designated North American test prefixes (`+15550000001` through `+15550000999`) or synthetic international test ranges.
4. **No Legal Consent Contamination:** Mock deliveries and test campaigns record `SIMULATED_TEST_ELIGIBILITY` and never populate genuine consent audit ledgers.

---

## 2. Idempotent Demo Setup

Executed via [`workspaceMockService.setupWorkspaceDemoData`](file:///c:/Users/Admin/Desktop/Relay-main/backend/src/services/workspaceMockService.js):

- **Synthetic Contacts:** Provisions 3 industry-aligned demo contacts with `isDemo: true`.
- **Draft Templates:** Creates 1 industry sample template draft (e.g., "Welcome & Offer Notification").
- **Auto-Reply Rules:** Activates top 2 relevant keyword rules tailored to the workspace's industry (e.g., `TRIAL` for Gym, `SERVICES` for Salon).
- **Sample Conversation:** Seeds 1 initial test thread for immediate inbox exploration.
- **Idempotency Guarantee:** If demo records already exist for the workspace, the setup returns the existing IDs without creating duplicates.

---

## 3. Scoped Demo Reset Engine

Customers can clear demo data at any time via:
`POST /api/workspaces/current/mock/demo-reset`

### Safe Deletion Logic:
```javascript
// Strictly scoped to isDemo: true and workspaceId
await Contact.deleteMany({ workspaceId, isDemo: true });
await Conversation.deleteMany({ workspaceId, isDemo: true });
await ConversationMessage.deleteMany({ workspaceId, isDemo: true });
await AutoReplyRule.deleteMany({ workspaceId, isDemo: true });
```

### Prohibited Operations:
- ❌ No `Contact.deleteMany({})` without `isDemo: true`.
- ❌ No collection drops.
- ❌ No cross-workspace queries.
- ❌ No modification of genuine customer opt-in/opt-out status.
