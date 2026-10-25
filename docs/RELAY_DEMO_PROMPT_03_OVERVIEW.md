# RELAY DEMO PROMPT 3: COMPLETE REAL-TIME BUSINESS OVERVIEW

## 1. Overview Architecture & Real MongoDB Sources
The Relay Overview dashboard (`/app`) provides an authoritative, real-time snapshot of the active workspace without hardcoded numbers, mock array fabrications, or cross-tenant leakage.

### Real Backend Source
- **API Endpoint:** `GET /api/dashboard/overview`
- **Controller:** [`dashboardController.overview`](file:///Users/sumitthakur/Desktop/Relay/backend/src/controllers/dashboardController.js)
- **Database Collections:**
  - `contacts`: Real count of non-deleted contacts scoped to `workspaceId` / `ownerId` (`whatsappConsentStatus` breakdown: Opted In, Opted Out, Unknown).
  - `messagetemplates`: Real count of workspace templates.
  - `campaigns`: Aggregation of status (`Draft`, `Validated for Preparation`, `Scheduled`, `Running`, `Completed`, `Failed`).
  - `messages`: Simulated message lifecycle aggregation (`sent`, `delivered`, `read`, `failed`).
  - `conversations`: Conversation statuses (`Open`, `Follow-up Required`, `Resolved`, `internalUnreadCount`).
  - `ruleexecutions`: Cumulative auto-reply rule executions and recent executions timeline.
  - `contactactivities`, `campaignactivities`, `conversationactivities`: Unified chronological audit timeline.

## 2. Supported Metrics Per Business

| Metric | M2W Realty | FitZone Gym | CarePlus Clinic | Source |
|---|---|---|---|---|
| Total Contacts | 5 (or user-created count) | 5 (or user-created count) | 5 (or user-created count) | `Contact.countDocuments({ workspaceId })` |
| Total Templates | 7 (draft templates) | 7 (draft templates) | 7 (draft templates) | `MessageTemplate.countDocuments({ workspaceId })` |
| Campaigns (Draft) | 1 (`Property Enquiry Follow-Up`) | 1 (`Membership Enquiry Follow-Up`) | 1 (`Clinic Enquiry Follow-Up`) | `Campaign.aggregate` |
| Mock Messages Sent | Authoritative count | Authoritative count | Authoritative count | `Message.aggregate({ status: 'sent' })` |
| Mock Messages Delivered | Authoritative count | Authoritative count | Authoritative count | `Message.aggregate({ status: 'delivered' })` |
| Mock Messages Read | Authoritative count | Authoritative count | Authoritative count | `Message.aggregate({ status: 'read' })` |
| Mock Failures | Authoritative count | Authoritative count | Authoritative count | `Message.aggregate({ status: 'failed' })` |
| Inbox Conversations | Scoped conversations | Scoped conversations | Scoped conversations | `Conversation.aggregate` |
| Auto-Reply Executions | Scoped executions | Scoped executions | Scoped executions | `RuleExecution.countDocuments` |

## 3. Dynamic Industry-Aware Copy
The Overview layout strictly preserves the original 7-screen dashboard layout while dynamically contextualizing text:
- **Real Estate (M2W Realty):** "Saved property enquiry records", "Upload XLSX or CSV property leads", "Personalized real estate messages".
- **Gym (FitZone Gym):** "Saved member records", "Upload XLSX or CSV member records", "Personalized fitness & class updates".
- **Clinic (CarePlus Clinic):** "Saved patient records", "Upload XLSX or CSV patient records", "Personalized appointment updates".

## 4. Real-Time Data Invalidation & Refetch
When contacts, templates, campaigns, or settings are created or updated, the dashboard recalculates metrics dynamically from MongoDB upon clicking "Refresh" or route re-entry. Paginated tables do not truncate or distort total collection counts.
