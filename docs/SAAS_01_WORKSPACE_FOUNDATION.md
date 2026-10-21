# RELAY SAAS — WORKSPACE FOUNDATION SPECIFICATION (PROMPT 1)
## Production-Grade Workspace & Membership Models, Schemas, Lifecycle & Provisioning Engine

> **Document Version:** 1.0.0  
> **Phase:** SAAS PROMPT 1 OF 15  
> **Status:** Implemented & Fully Verified  

---

## 1. Overview & Architectural Role

In SAAS Prompt 1, Relay establishes the authoritative multi-tenant foundation. The fundamental entity is the **Workspace**, which represents an independent business tenant (e.g., M2W Luxury Realty, FitZone Gym, CarePlus Clinic). 

The platform supports:
- **One Application Codebase & Infrastructure:** Shared Node/Express backend and MongoDB cluster.
- **Multiple Business Workspaces:** Each with independent business details, branding, contacts, templates, campaigns, inbox threads, and operational preferences.
- **Explicit User-Workspace Memberships:** Decoupling global human identity (`User`) from tenant authorization (`WorkspaceMembership`).
- **Fail-Closed Tenancy:** No operation on workspace-scoped data is permitted without an authoritatively verified, active membership.

---

## 2. Implemented Models & Schemas

### 2.1 Workspace Model (`backend/src/models/Workspace.js`)
The `Workspace` model captures complete business identity and operational configurations:

```javascript
const workspaceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 60,
      match: /^[a-z0-9-]+$/,
    },
    industryKey: {
      type: String,
      required: true,
      enum: ['real_estate', 'gym', 'clinic', 'education', 'salon', 'automobile', 'other'],
      default: 'other',
    },
    businessEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 120,
    },
    businessPhone: {
      type: String,
      required: true,
      trim: true,
      match: /^\+[1-9]\d{7,14}$/, // Strict E.164
    },
    country: { type: String, default: 'India', trim: true, maxlength: 80 },
    city: { type: String, default: '', trim: true, maxlength: 80 },
    timezone: {
      type: String,
      default: 'Asia/Kolkata',
      trim: true,
      maxlength: 60,
      validate: {
        validator(val) {
          try {
            new Intl.DateTimeFormat('en-US', { timeZone: val });
            return true;
          } catch {
            return false;
          }
        },
        message: 'Invalid IANA timezone.',
      },
    },
    currency: { type: String, default: 'INR', uppercase: true, match: /^[A-Z]{3}$/ },
    status: {
      type: String,
      enum: ['PROVISIONING', 'ACTIVE', 'SUSPENDED', 'ARCHIVED', 'FAILED_PROVISIONING'],
      default: 'ACTIVE',
      index: true,
    },
    onboardingStatus: {
      type: String,
      enum: ['PENDING_PROFILE', 'PENDING_INDUSTRY', 'PENDING_BRANDING', 'COMPLETED'],
      default: 'COMPLETED',
    },
    logoReference: { type: String, default: '', trim: true, maxlength: 500 },
    logoUrl: { type: String, default: '', trim: true, maxlength: 500 },
    setupVersion: { type: Number, default: 1, min: 1 },
    configurationVersion: { type: Number, default: 1, min: 1 },
    settings: { type: mongoose.Schema.Types.Mixed, default: {} },
    archivedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true, strict: 'throw' }
);
```

#### Key Validations & Invariants:
- **Slug Normalization:** Pre-validation middleware automatically converts raw strings into lowercase, hyphen-separated, alphanumeric slugs.
- **Unique Slugs:** Backed by MongoDB unique index on `{ slug: 1 }`.
- **Supported Industries:** Restricted to 7 validated keys (`real_estate`, `gym`, `clinic`, `education`, `salon`, `automobile`, `other`).
- **Strict Mode:** Extra unmapped fields trigger Mongoose validation rejection (`strict: 'throw'`).

---

### 2.2 WorkspaceMembership Model (`backend/src/models/WorkspaceMembership.js`)
The `WorkspaceMembership` model defines the binding between an authenticated `User` and an authorized `Workspace`:

```javascript
const workspaceMembershipSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, enum: ['OWNER', 'ADMIN', 'MEMBER'], default: 'OWNER', uppercase: true },
    status: { type: String, enum: ['ACTIVE', 'INVITED', 'SUSPENDED', 'REVOKED'], default: 'ACTIVE', uppercase: true },
    isDefaultWorkspace: { type: Boolean, default: true },
    joinedAt: { type: Date, default: Date.now },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true, strict: 'throw' }
);
```

#### Compound Indexes & Integrity:
- **Compound Unique Index:** `{ workspaceId: 1, userId: 1 }` prevents duplicate active memberships for the same user in a workspace.
- **Lookup Index:** `{ userId: 1, status: 1 }` enables sub-millisecond retrieval of all active workspaces belonging to a user.

---

### 2.3 User Model Updates (`backend/src/models/User.js`)
The `User` model remains 100% backward compatible with existing session cookies, password rotation, and authentication mechanisms while adding multi-tenant linkages:
- `defaultWorkspaceId: { type: ObjectId, ref: 'Workspace', default: null }`
- `isEmailVerified: { type: Boolean, default: true }`
- `isPlatformAdmin: { type: Boolean, default: false }`

---

## 3. Workspace Lifecycle State Machine

```
              ┌────────────────────────┐
              │      PROVISIONING      │
              └───────────┬────────────┘
                          │
            ┌─────────────┴─────────────┐
            ▼                           ▼
  ┌──────────────────┐        ┌──────────────────┐
  │      ACTIVE      │        │FAILED_PROVISIONING│
  └─────────┬────────┘        └──────────────────┘
            │
      ┌─────┴─────┐
      ▼           ▼
┌───────────┐ ┌──────────┐
│ SUSPENDED │ │ ARCHIVED │
└───────────┘ └──────────┘
```

1. **PROVISIONING:** Workspace resources are being initialized.
2. **ACTIVE:** Workspace is fully operational; mock sandbox or live messaging allowed.
3. **SUSPENDED:** Blocked by platform admin or billing failure. All API operations reject with HTTP 403 `WORKSPACE_SUSPENDED`.
4. **ARCHIVED:** Soft-deleted business tenant. Preserved for regulatory compliance. Returns HTTP 403 `WORKSPACE_ARCHIVED`.
5. **FAILED_PROVISIONING:** Recoverable error state during creation.

---

## 4. Internal Workspace Provisioning Service

Located in `backend/src/services/workspaceContextService.js`:
- `provisionWorkspaceInternal({ ownerId, name, slug, industryKey, ... })`:
  1. Validates owner user account in database.
  2. Generates sanitized URL-safe slug.
  3. Checks slug collision and idempotently returns existing workspace if caller is already the owner.
  4. Atomically creates `Workspace` and `WorkspaceMembership` (role: `OWNER`).
  5. Sets `user.defaultWorkspaceId`.

---

## 5. Summary of Prompt 1 Deliverables

| Deliverable | Location | Status |
| :--- | :--- | :--- |
| Workspace Model | `backend/src/models/Workspace.js` | Verified (Unit + Integration Tests) |
| WorkspaceMembership Model | `backend/src/models/WorkspaceMembership.js` | Verified (Compound unique index) |
| User Model Updates | `backend/src/models/User.js` | Verified (Zero regressions) |
| Context & Query Service | `backend/src/services/workspaceContextService.js` | Verified (Fail-closed assertions) |
| Internal Provisioning | `backend/src/services/workspaceContextService.js` | Verified (Idempotent) |
| Workspace Routes | `backend/src/routes/workspaceRoutes.js` | Mounted at `/api/workspaces` |
| Workspace Controller | `backend/src/controllers/workspaceController.js` | Verified |
