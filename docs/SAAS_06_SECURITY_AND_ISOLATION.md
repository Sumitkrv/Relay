# RELAY SAAS — SAAS 06: MULTI-TENANT SECURITY & DATA ISOLATION

## 1. Threat Model & Adversarial Testing

Multi-tenant security in SaaS Prompt 6 was subjected to rigorous adversarial testing:

```
Attacker Profile: Authenticated User B (Member of Gym Workspace B)
Target Resource: Workspace A (Real Estate Workspace A owned by User A)
```

### Attack Vectors Tested & Neutralized

1. **Cross-Tenant Header Forgery**:
   - *Attack*: User B passes `x-workspace-id: <Workspace_A_ID>` with User B's JWT token to `GET /api/workspaces/current/industry-config`.
   - *Defense*: `workspaceContext` middleware verifies `WorkspaceMembership` for `(user._id, workspaceId)`. Because User B is not an active member of Workspace A, the request is blocked with `403 Forbidden` (`FORBIDDEN_WORKSPACE_ACCESS`).
   - *Result*: PASS.

2. **Cross-Tenant Preference Mutation**:
   - *Attack*: User B attempts `PUT /api/workspaces/current/industry-preferences` with Workspace A's ID in header or body.
   - *Defense*: Request blocked with `403 Forbidden`. User A's custom terminology remains intact.
   - *Result*: PASS.

3. **NoSQL Injection in Dynamic Contact Fields**:
   - *Attack*: Client submits `{"$gt": "", "$where": "sleep(5000)"}` in `industryData`.
   - *Defense*: `industryValidationService.js` strictly rejects any field key starting with `$` or containing dots (`.`). Returns `400 Bad Request` (`NOSQL_OPERATOR_DETECTED`).
   - *Result*: PASS.

4. **Prototype Pollution**:
   - *Attack*: Client submits `{"__proto__": {"isAdmin": true}, "constructor": {"prototype": {}}}`.
   - *Defense*: Cleaned and stripped at the validation layer before MongoDB persistence.
   - *Result*: PASS.

5. **Trigger Keyword Hijacking for Compliance Words**:
   - *Attack*: Tenant attempts to add a keyword preset triggering on `STOP` or `UNSUBSCRIBE` to intercept user opt-outs.
   - *Defense*: `validateTriggerKeywords()` detects reserved words and throws `400 Bad Request` (`RESERVED_COMPLIANCE_KEYWORD`). Opt-out suppression remains 100% authoritative.
   - *Result*: PASS.

6. **Live Meta WhatsApp Sending**:
   - *Attack*: Tenant attempts live WhatsApp broadcast or message send.
   - *Defense*: Blocked by `requireMetaIntegration` / mock guard with `403 Forbidden`. Zero live Meta API requests made.
   - *Result*: PASS.

---

## 2. Boundary Matrix

| Resource | Scope | Enforcement Mechanism |
|---|---|---|
| Industry Definitions | Global Static | Deep-frozen memory singleton; read-only; no tenant mutation |
| Workspace Config Resolution | Tenant Scoped | `requireAuth` + `workspaceContext` + `requireWorkspace` |
| Contact Dynamic Fields | Tenant Scoped | Stored in `Contact.industryData` with `workspaceId` index |
| Template Suggestions | Global Catalog | Read-only suggestion library |
| Template Drafts | Tenant Scoped | Persisted in `MessageTemplate` with `workspaceId: req.workspace._id` |
| Keyword Presets | Global Catalog | Read-only preset catalog |
| Keyword Auto-reply Rules | Tenant Scoped | Persisted in `AutoReplyRule` with `workspaceId: req.workspace._id` |
| Terminology Preferences | Tenant Scoped | Persisted in `BusinessProfile.metadata.industryPreferences` |
