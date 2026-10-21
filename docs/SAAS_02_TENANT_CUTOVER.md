# SAAS PROMPT 2 — TENANT CUTOVER & AUTHORIZATION STRATEGY

## 1. Transitional Dual-Access Model
During the transitional phase between Prompt 2 and complete route cutover (Prompt 7):
1. **Authenticated Context Resolution**:
   - `requireWorkspace` extracts tenant context from `x-workspace-id` HTTP header or user's active default membership (`user.defaultWorkspaceId`).
   - Ensures client cannot tamper with or forge workspace access (`FORBIDDEN_WORKSPACE_ACCESS` 403 returned on unauthorized header).
2. **Legacy Route Support**:
   - Single-owner routes using `ownerId: req.user._id` continue functioning seamlessly for existing single-operator M2W owner.
   - Newly registered workspace users have isolated `ownerId` and CANNOT access legacy M2W records.

---

## 2. Cross-Tenant Isolation Proof
- **Workspace A (M2W Realty)**: Owner Sumit R. Thakur (`m2w_owner@example.com`).
- **Workspace B (Iron Fitness Club)**: Owner Gym Operator (`gym_owner@example.com`).
- **Authorization Barrier**:
  - Request with User B token and `x-workspace-id: <m2w_workspace_id>` -> Returns HTTP 403 `FORBIDDEN_WORKSPACE_ACCESS`.
  - User B querying `/api/contacts` -> Returns 0 contacts from Workspace A.
  - User B cannot enumerate or guess IDs belonging to Workspace A.

---

## 3. Disconnected Live Messaging Safeguard
- `messagingProviderRegistry.getProvider('LIVE')` strictly throws HTTP 403 `LIVE_MODE_DISABLED`.
- Meta WhatsApp Cloud API credentials remain unconfigured and disconnected.
- All outbound operations remain safely executed by offline `mockWhatsAppProvider`.
