# SaaS 10 — 14-Day Free Mock Sandbox Trial System

## 1. Overview
Relay provides a 14-day Free Exploration trial that allows prospective customers to test all 7 dashboard modules, run simulated broadcasts, design rich templates, and evaluate keyword auto-replies in an offline mock environment without entering a credit card.

---

## 2. Server-Authoritative Timestamps
The trial duration is strictly determined by server-side UTC timestamps:
- `trialStartedAt`: `new Date()` at moment of activation.
- `trialEndsAt`: `new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)`.
- Browser clocks or local storage manipulation cannot extend the trial.
- Page reloads or logouts do not reset the trial countdown.

---

## 3. Abuse Prevention & One-Time Rule
Trial grants are tracked in the `trialgrants` MongoDB collection with unique compound indexing:
1. **Workspace Boundary**: A workspace can only claim a trial once. Subsequent attempts return 409 Conflict.
2. **Owner Boundary**: A user who has already utilized a trial on one workspace cannot create a new workspace and claim another trial.
3. **Concurrent Protection**: Race conditions during simultaneous trial start requests are safely prevented by unique MongoDB indexes on `{ workspaceId: 1 }`.

---

## 4. Trial Expiry Lifecycle & Data Preservation
When the 14-day period elapses:
1. `Subscription.internalStatus` transitions to `TRIAL_EXPIRED`.
2. `TrialGrant.status` transitions to `EXPIRED`.
3. **Data Preservation Guarantee**:
   - Zero customer records are deleted.
   - All contacts, groups, tags, segments, templates, inbound messages, and past campaign analytics remain 100% intact.
4. **Entitlement Restrictions**:
   - Creating or executing new campaigns is blocked.
   - Inbound simulation triggers are paused.
   - Read-only access and export capabilities are preserved.
   - A clear Upgrade CTA directs the user to subscribe to Relay Solo (₹799/mo).
