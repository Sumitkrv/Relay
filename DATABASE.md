# RELAY — DATABASE SCHEMA & DATA DICTIONARY
## MongoDB Collections, Mongoose Models, Tenancy Scoping & Data Provenance

> **Document Version:** 1.0.0 (Master Database Reference)  
> **Status:** Active / Source of Truth  
> **Database Engine:** MongoDB Community Server (Database Name: `relay_demo`)  
> **Primary Workspace Reference:** `6adaf2ccbaacf0587d451ae6` (M2W Realty)  
> **Repository Location:** [`backend/src/models/`](file:///Users/sumitthakur/Desktop/Relay/backend/src/models/)  

---

## 1. Database Architecture & Tenancy Model

Relay implements a **Shared Database, Multi-Tenant Partitioned Architecture**.
- Every business tenant is represented by a durable record in the `workspaces` collection.
- All core business entities contain a foreign key reference: `workspaceId: { type: ObjectId, ref: 'Workspace', index: true }`.
- Compound unique indexes prevent cross-tenant collisions (for example, two different businesses can have the same customer phone number without conflicts).
- Soft deletion (`isDeleted: true`, `isArchived: true`) is strictly enforced across core records to preserve historical auditability and message reference integrity.

---

## 2. Core M2W Realty Collections & Schema Dictionary

### 2.1 Workspace & Tenancy Management

#### `Workspace` (Collection: `workspaces`)
Defines the business tenant entity.
```javascript
{
  _id: ObjectId,
  name: String,                  // e.g. "M2W Realty" (min 2, max 120)
  slug: String,                  // e.g. "m2w-realty" (unique, lowercase, URL-safe)
  industryKey: String,           // enum: ['real_estate', 'gym', 'clinic', 'education', 'salon', 'automobile', 'other']
  businessEmail: String,         // Official company contact email
  businessPhone: String,         // International E.164 format (e.g. +919811223344)
  country: String,               // Default: "India"
  city: String,                  // e.g. "Gurugram"
  timezone: String,              // IANA format, default: "Asia/Kolkata"
  currency: String,              // 3-letter ISO code, default: "INR"
  status: String,                // enum: ['PROVISIONING', 'ACTIVE', 'SUSPENDED', 'ARCHIVED', 'FAILED_PROVISIONING']
  onboardingStatus: String,      // enum: ['PENDING_PROFILE', 'PENDING_INDUSTRY', 'PENDING_BRANDING', 'COMPLETED']
  logoUrl: String,               // Reference to branding asset
  createdBy: ObjectId,           // ref: 'User'
  timestamps: true               // createdAt, updatedAt
}
// Primary Indexes:
// - { slug: 1 } (unique)
// - { status: 1, createdAt: -1 }
// - { createdBy: 1, status: 1 }
```

#### `WorkspaceMembership` (Collection: `workspacememberships`)
Maps user accounts to workspaces with role-based permissions.
```javascript
{
  _id: ObjectId,
  workspaceId: ObjectId,         // ref: 'Workspace', required, indexed
  userId: ObjectId,              // ref: 'User', required, indexed
  role: String,                  // enum: ['OWNER', 'ADMIN', 'MEMBER', 'AGENCY_DELEGATE']
  status: String,                // enum: ['ACTIVE', 'INVITED', 'SUSPENDED']
  isDefaultWorkspace: Boolean,   // Indicates primary workspace on login
  permissions: [String],         // Custom granular overrides
  timestamps: true
}
// Primary Indexes:
// - { workspaceId: 1, userId: 1 } (unique)
// - { userId: 1, status: 1 }
```

---

### 2.2 Contacts & Directory Management

#### `Contact` (Collection: `contacts`)
Stores real estate leads, buyers, investors, and past clients.
```javascript
{
  _id: ObjectId,
  ownerId: ObjectId,                 // ref: 'User', required, indexed
  workspaceId: ObjectId,             // ref: 'Workspace', indexed
  fullName: String,                  // Lead name (min 2, max 120)
  phoneNumber: String,               // E.164 format (e.g. +919811223344), required
  countryCode: String,               // Default: "IN"
  email: String,                     // Optional email address
  companyName: String,
  leadStatus: String,                // enum: ['New', 'Contacted', 'Interested', 'Follow-up Required', 'Negotiation', 'Converted', 'Not Interested', 'Closed']
  clientClassification: String,      // enum: ['Prospect', 'Active Client', 'Previous Client', 'Inactive Client']
  priority: String,                  // enum: ['Low', 'Medium', 'High', 'Urgent']
  whatsappConsentStatus: String,     // enum: ['Unknown', 'Opted In', 'Opted Out']
  isSuppressed: Boolean,             // true prevents any outbound broadcast
  suppressionReason: String,         // Reason for opt-out or delivery failure
  
  // Real Estate Specific Fields:
  interestedPropertyType: String,    // e.g. "3 BHK", "Plots", "Villa", "Commercial"
  interestedProject: String,         // e.g. "Smart World The Edition", "DLF The Arbour"
  preferredLocation: String,         // e.g. "Golf Course Extension, Sector 66"
  budgetRange: String,               // e.g. "₹1 Cr - ₹2.5 Cr"
  city: String,                      // e.g. "Gurugram"
  state: String,                     // e.g. "Haryana"
  
  // Audit & System Flags:
  isArchived: Boolean,               // Default: false
  isDeleted: Boolean,                // Default: false
  isDemo: Boolean,                   // Marks demo seed data
  timestamps: true
}
// Primary Indexes:
// - { workspaceId: 1, phoneNumber: 1 } (unique, partialFilterExpression: { workspaceId: { $type: 'objectId' } })
// - { ownerId: 1, phoneNumber: 1 } (unique)
// - { workspaceId: 1, isDeleted: 1, isArchived: 1, createdAt: -1 }
// - { workspaceId: 1, leadStatus: 1, priority: 1 }
```

#### `ConsentRecord` (Collection: `consentrecords`)
Immutable audit trail verifying affirmative WhatsApp consent.
```javascript
{
  _id: ObjectId,
  workspaceId: ObjectId,         // ref: 'Workspace', indexed
  contactId: ObjectId,           // ref: 'Contact', required, indexed
  phoneNumber: String,           // E.164 phone at time of consent
  action: String,                // enum: ['OPT_IN', 'OPT_OUT', 'REVOKE', 'RECONFIRM']
  source: String,                // enum: ['WEB_FORM', 'INBOUND_MESSAGE', 'MANUAL_IMPORT', 'PAPER_FORM', 'DIRECT_INQUIRY']
  evidenceType: String,          // enum: ['DIGITAL_SIGNATURE', 'CHAT_LOG', 'CSV_COLUMN', 'RECORDING']
  evidenceReference: String,     // File URL, message ID, or form submission reference
  capturedAt: Date,              // Exact timestamp of consent capture
  capturedBy: ObjectId,          // ref: 'User'
  timestamps: true
}
```

---

### 2.3 Message Templates Studio

#### `MessageTemplate` (Collection: `messagetemplates`)
Pre-approved property announcement and follow-up templates.
```javascript
{
  _id: ObjectId,
  ownerId: ObjectId,                     // ref: 'User', required, indexed
  workspaceId: ObjectId,                 // ref: 'Workspace', indexed
  name: String,                          // Template identifier (e.g. "site_visit_reminder_v1")
  description: String,                   // Internal purpose description
  category: String,                      // enum: ['Marketing', 'Utility', 'Authentication']
  language: String,                      // enum: ['en', 'hi', 'hinglish']
  headerType: String,                    // enum: ['NONE', 'TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT']
  header: String,                        // Text title if headerType is TEXT
  headerMediaUrl: String,                // Brochure URL or CDN media link
  body: String,                          // Body text with tokens: e.g. "Hi {{customer_name}},..."
  footer: String,                        // Subtle footer text (max 60 chars)
  buttons: [{                            // CTA buttons array
    type: { type: String, enum: ['QUICK_REPLY', 'URL', 'PHONE_NUMBER'] },
    text: String,
    value: String
  }],
  internalVariables: [String],           // Extracted tokens: ['customer_name', 'project_name']
  localStatus: String,                   // enum: ['Draft', 'Ready for Review', 'Ready for Submission', 'Archived']
  providerStatus: String,                // enum: ['Not Submitted', 'Pending', 'Approved', 'Rejected', 'Paused', 'Disabled']
  mockProviderApprovalStatus: String,    // enum: ['Not Submitted', 'Simulated Submission', 'Simulated Approved', ...]
  currentVersionNumber: Number,          // Incremental version integer
  isFavorite: Boolean,                   // Quick access flag
  isArchived: Boolean,
  timestamps: true
}
```

#### `TemplateVersion` (Collection: `templateversions`)
Immutable historical snapshots created on each saved revision.
```javascript
{
  _id: ObjectId,
  workspaceId: ObjectId,         // ref: 'Workspace', indexed
  templateId: ObjectId,          // ref: 'MessageTemplate', required, indexed
  versionNumber: Number,         // e.g. 1, 2, 3
  revisionNotes: String,         // User change log
  snapshot: Mixed,               // Full serialized copy of template state
  internalVariables: [String],
  createdBy: ObjectId,           // ref: 'User'
  createdAt: Date
}
// Unique Index: { templateId: 1, versionNumber: -1 }
```

---

### 2.4 Campaigns & Broadcast Engine

#### `Campaign` (Collection: `campaigns`)
Defines an outreach broadcast event.
```javascript
{
  _id: ObjectId,
  ownerId: ObjectId,                 // ref: 'User', required, indexed
  workspaceId: ObjectId,             // ref: 'Workspace', indexed
  name: String,                      // Campaign title (e.g. "Gurugram High-Rise Launch Q4")
  description: String,
  goal: String,                      // e.g. "Site Visit Registrations"
  selectedTemplateId: ObjectId,      // ref: 'MessageTemplate'
  selectedTemplateVersionId: ObjectId, // ref: 'TemplateVersion' (pinned version)
  templateSnapshot: Mixed,           // Frozen copy of template used at launch time
  audienceSelectionMode: String,     // enum: ['manual', 'all', 'import', 'filters', 'segment', 'group']
  audienceDefinition: Mixed,         // Query criteria: { propertyType: '3 BHK', budget: 'High' }
  campaignType: String,              // enum: ['one-time', 'scheduled']
  executionMode: String,             // Default: 'MOCK'
  status: String,                    // enum: ['Draft', 'Needs Review', 'Ready', 'Scheduled', 'Running', 'Paused', 'Completed', 'Failed', 'Cancelled']
  mockSchedule: {
    startAt: Date,
    status: String
  },
  timestamps: true
}
```

#### `CampaignMessageJob` (Collection: `campaignmessagejobs`)
Individual recipient message delivery tracking record.
```javascript
{
  _id: ObjectId,
  workspaceId: ObjectId,         // ref: 'Workspace', indexed
  campaignId: ObjectId,          // ref: 'Campaign', required, indexed
  contactId: ObjectId,           // ref: 'Contact', required, indexed
  phoneNumber: String,           // Recipient E.164 phone
  renderedBody: String,          // Message body with tokens substituted
  status: String,                // enum: ['PENDING', 'PROCESSING', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'SUPPRESSED']
  deliveryAttempts: Number,      // Retry counter
  deliveredAt: Date,
  readAt: Date,
  timestamps: true
}
```

---

### 2.5 Two-Way Conversations & Messaging

#### `Conversation` (Collection: `conversations`)
Tracks active dialog between a customer and the business.
```javascript
{
  _id: ObjectId,
  ownerId: ObjectId,                 // ref: 'User', required, indexed
  workspaceId: ObjectId,             // ref: 'Workspace', indexed
  contactId: ObjectId,               // ref: 'Contact', required, indexed
  channel: String,                   // Default: 'whatsapp'
  status: String,                    // enum: ['Open', 'Pending', 'Follow-up Required', 'Needs Attention', 'Resolved', 'Closed', 'Archived']
  automationStatus: String,          // enum: ['ACTIVE', 'PAUSED'] (PAUSED when human agent takes over)
  internalUnreadCount: Number,       // Unread messages indicator
  lastActivityAt: Date,              // Sort key for inbox thread listing
  timestamps: true
}
```

#### `ConversationMessage` (Collection: `conversationmessages`)
Individual inbound or outbound message bubble.
```javascript
{
  _id: ObjectId,
  workspaceId: ObjectId,         // ref: 'Workspace', indexed
  conversationId: ObjectId,      // ref: 'Conversation', required, indexed
  contactId: ObjectId,           // ref: 'Contact', required, indexed
  direction: String,             // enum: ['inbound', 'outbound', 'internal', 'system']
  messageType: String,           // enum: ['text', 'image', 'video', 'document', 'audio', 'interactive_reply']
  messageSource: String,         // enum: ['manual', 'synthetic_test', 'mock_simulation', 'provider', 'internal_note']
  messageBody: String,           // Text content (max 10,000 chars)
  providerStatus: String,        // enum: ['Created', 'Queued', 'Submitted', 'Sent', 'Delivered', 'Read', 'Failed']
  occurredAt: Date,
  timestamps: true
}
```

#### `AutoReplyRule` (Collection: `autoreplyrules`)
Keyword-triggered inbound automation rules.
```javascript
{
  _id: ObjectId,
  workspaceId: ObjectId,         // ref: 'Workspace', indexed
  name: String,                  // e.g. "Brochure Request Auto-Reply"
  triggerKeyword: String,        // e.g. "BROCHURE" (uppercase, trimmed)
  synonyms: [String],            // e.g. ['CATALOG', 'PDF', 'FLOORPLAN']
  matchType: String,             // enum: ['EXACT_MATCH', 'WHOLE_WORD', 'CONTAINS']
  actionType: String,            // enum: ['RUN_MOCK_REPLY', 'MARK_NEEDS_ATTENTION', 'CREATE_INTERNAL_NOTE', 'RECORD_OPT_OUT']
  responseMessage: String,       // Automated reply body
  priority: Number,              // Higher executes first (default: 10)
  enabled: Boolean,              // Active switch
  executionCount: Number,        // Metrics counter
  timestamps: true
}
```

---

## 3. Data Integrity & Migration Safeguards

1. **No Destructive Operations:** Seed and migration scripts must **never** call `dropDatabase()` or `collection.deleteMany({})` against production or demo collections.
2. **Deterministic Workspace References:** M2W Realty data is anchored to `workspaceId: ObjectId('6adaf2ccbaacf0587d451ae6')`.
3. **Historical Version Snapshots:** Modifying a message template must create an immutable `TemplateVersion` record before updating `MessageTemplate`.
4. **Phone Uniqueness:** E.164 normalization is applied prior to database insertion; partial index enforcement guarantees workspace-level deduplication.
