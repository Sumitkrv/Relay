# RELAY SAAS 05 — WORKSPACE PROVISIONING ENGINE

## 1. Overview

The `workspaceProvisioningService.js` is the core architectural component responsible for converting validated onboarding drafts into production-ready Relay tenant workspaces. It coordinates database persistence, unique slug generation, owner role assignment, business profile initialization, and logo association with strict idempotency and zero duplicate creation.

---

## 2. Provisioning Algorithm & Workflow

```mermaid
flowchart TD
    A[Client Submits POST /api/onboarding/complete] --> B[Require Authentication]
    B --> C[Enforce Email Verification]
    C --> D[Fetch Onboarding Draft by userId]
    D --> E{Draft Exists & Valid?}
    E -- No --> F[Return 400 Incomplete Business Identity]
    E -- Yes --> G{User Already Owns Workspace?}
    G -- Yes (Idempotent) --> H[Return 200 with Existing Workspace & Membership]
    G -- No --> I[Generate Unique URL Slug]
    I --> J[Insert Workspace Document]
    J --> K[Insert WorkspaceMembership (Role: OWNER)]
    K --> L[Initialize BusinessProfile]
    L --> M[Update Draft Status: COMPLETED]
    M --> N[Return 201 Created with Workspace & Membership Payload]
```

---

## 3. Idempotency & Concurrency Safety

Provisioning requests are subjected to multi-layered idempotency controls:

1. **Pre-Flight Membership Inspection**:
   Before creating any records, the service queries `WorkspaceMembership.findOne({ userId, status: 'ACTIVE' })`. If an active workspace already exists for this user, the existing workspace and membership are returned immediately with HTTP `200 OK`.
2. **Database Unique Constraints**:
   - `Workspace.slug` is uniquely indexed.
   - `WorkspaceMembership` enforces `{ workspaceId: 1, userId: 1 }` compound uniqueness.
   - `OnboardingDraft.userId` enforces `{ userId: 1 }` uniqueness.
3. **Double-Click & Retry Resilience**:
   If network timeouts or aggressive user retries submit concurrent `POST /api/onboarding/complete` requests, the first request commits the workspace and the second request resolves the committed workspace via membership inspection, preventing duplicate tenant allocations.

---

## 4. Unique Workspace Slug Generation

Workspace URLs utilize safe, lowercase, alphanumeric slugs generated from the business name:

```javascript
export async function generateUniqueSlug(businessName) {
  let baseSlug = businessName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

  if (!baseSlug) baseSlug = 'workspace';

  let candidateSlug = baseSlug;
  let counter = 1;

  while (await Workspace.exists({ slug: candidateSlug })) {
    const suffix = `-${counter}`;
    candidateSlug = `${baseSlug.slice(0, 40 - suffix.length)}${suffix}`;
    counter++;
  }

  return candidateSlug;
}
```

### Collision Resolution:
- `FitZone Gym` → `fitzone-gym`
- Second registration of `FitZone Gym` → `fitzone-gym-1`
- Third registration → `fitzone-gym-2`

---

## 5. Owner Membership & Role Security

The provisioning service strictly sets:
```javascript
role: 'OWNER'
status: 'ACTIVE'
isDefaultWorkspace: true
joinedAt: new Date()
```
- **Adversarial Role Rejection**: Request payloads attempting to inject `role: 'SUPER_ADMIN'` or `membershipRole: 'PLATFORM_SUPERUSER'` are ignored; the server-side provisioning engine exclusively enforces the authoritative `OWNER` role.
- **Tenant Scope Enforcement**: The created membership ties `userId` to the newly minted `workspaceId`. The user is granted zero permissions across existing workspaces (such as M2W Realty).

---

## 6. BusinessProfile Synchronization & Boundaries

To preserve backward compatibility with legacy single-operator routes while guaranteeing multi-tenant scoping:
- `BusinessProfile` is created with:
  - `workspaceId`: `workspace._id` (Authoritative tenant key)
  - `ownerId`: `user._id` (Owner user reference)
  - `businessName`: Validated business identity name
  - `industry`: Validated industry vertical
  - `businessPhone`, `businessEmail`, `city`, `timezone`, `website`, `logoUrl`
- `Workspace` document owns structural configuration (`name`, `slug`, `industryKey`, `status`, `onboardingStatus`).
- Future profile modifications synchronize both collections within the tenant boundary.

---

## 7. Zero Synthetic Records Policy

Upon workspace provisioning, the newly created tenant environment starts in a genuine, clean state:
- **Contacts**: Exactly 0.
- **Campaigns**: Exactly 0.
- **Message Queues**: Exactly 0.
- **WhatsApp Consent Records**: Exactly 0.
- **Meta Cloud API Connections**: Unconnected (Mock mode; 403 live-mode protection intact).
- **Billing Status**: Unpaid / Trial (Zero mock Razorpay activations).
