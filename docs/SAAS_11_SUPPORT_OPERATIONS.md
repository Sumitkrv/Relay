# RELAY SAAS — PHASE 11: SUPPORT OPERATIONS & CASING

## 1. Support Casing Model: `SupportCase`

Platform operators can triage customer assistance tickets, track onboarding issues, and record internal operational notes (`/platform-admin/support`) without browsing customer private chats or impersonating users.

### Schema:
```javascript
{
  caseNumber: 'CASE-M2W9A-402',     // Unique human-readable case identifier
  workspaceId: ObjectId,            // Target workspace reference
  createdByAdmin: ObjectId,         // Operator who initiated the case
  issueCategory: 'ONBOARDING',      // ONBOARDING, BILLING, WHATSAPP_CONNECTION, MESSAGING_QUEUE, ACCOUNT_ACCESS, TECHNICAL_ERROR, GENERAL_SUPPORT
  priority: 'MEDIUM',               // LOW, MEDIUM, HIGH, CRITICAL
  status: 'OPEN',                   // OPEN, IN_PROGRESS, WAITING_CUSTOMER, RESOLVED, CLOSED
  summary: String,                  // Brief summary (min 5, max 250 characters)
  internalNotes: [
    {
      noteId: 'note_1729500000_123',
      adminUserId: ObjectId,
      adminName: 'Platform Admin',
      text: 'Investigated webhook timeout; DNS configuration verified.',
      createdAt: Date
    }
  ],
  resolvedAt: Date | null,
  resolvedByAdmin: ObjectId | null,
  resolutionSummary: String
}
```

---

## 2. Zero Impersonation Standard

- In order to preserve privacy and prevent credential compromise, Relay strictly forbids synthetic customer impersonation ("Login as Customer").
- Support cases focus on operational health, webhook diagnostics, onboarding checklist statuses, and payment reconciliation.
