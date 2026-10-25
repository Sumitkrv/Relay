# RELAY — AI CODING AGENT RULES & CONVENTIONS
## Mandatory Operational Guidelines for AI Assistants & Autonomous Coding Agents

> **File:** `AGENTS.md` (Repository Root)  
> **Status:** STRICT & MANDATORY  
> **Target Audience:** All AI Coding Assistants (Antigravity, Cursor, Claude Code, GitHub Copilot)  
> **Current Business Priority:** **M2W REALTY ONLY** (`slug: m2w-realty`, Workspace ID: `6adaf2ccbaacf0587d451ae6`)  

---

## 1. The 16 Golden Invariants (Strictly Enforced)

1. **Read Documentation First:** Before proposing or executing any code modification, thoroughly inspect [`PRD.md`](file:///Users/sumitthakur/Desktop/Relay/PRD.md), [`DESIGN_SYSTEM.md`](file:///Users/sumitthakur/Desktop/Relay/DESIGN_SYSTEM.md), [`ARCHITECTURE.md`](file:///Users/sumitthakur/Desktop/Relay/ARCHITECTURE.md), and [`DATABASE.md`](file:///Users/sumitthakur/Desktop/Relay/DATABASE.md).
2. **Inspect Existing Code First:** Never assume how a module works. Inspect the actual React components, Express routes, and Mongoose schemas before making changes.
3. **M2W Realty First & Only:** All current work must serve the **M2W Realty** business priority. Do not build or expand gym, clinic, salon, or agency features until M2W is fully stabilized.
4. **Single-Task Scope:** Work strictly on the single user prompt or task requested. Never bundle unsolicited refactorings, optimizations, or feature expansions.
5. **Preserve MongoDB Records:** **NEVER DELETE OR MUTATE EXISTING DATABASE RECORDS** without explicit written user instruction. The 7 M2W demo templates and saved contacts in MongoDB must be preserved.
6. **Zero Destructive Database Scripts:** Never run `demo:reset`, `dropDatabase()`, or destructive seed commands.
7. **Never Delete Existing Workspaces:** The multi-tenant workspace architecture (`workspaces`, `workspacememberships`) must remain intact.
8. **No Fake Business Data in UI:** Client-side state must come from genuine backend API endpoints. Do not manufacture fake hardcoded arrays to populate empty screens.
9. **No Fake API Success Responses:** Never replace real backend API calls with client-side simulated `setTimeout` success responses. If an API call fails, handle the error truthfully.
10. **Preserve Tenant Isolation:** Every database query in controllers and services must be explicitly scoped by `workspaceId: req.workspaceId` or `ownerId: req.user._id`.
11. **Strict Design System Adherence:** Keep Relay's **Midnight Navy** (`#0B1220`) × **Electric Blue** (`#2563EB`) design system. Do not introduce teal, green, or arbitrary third-party color palettes.
12. **No Real Provider Egress:** Do not connect live Meta WhatsApp Cloud API credentials, live Razorpay billing keys, or production SMTP servers without explicit user instruction. The offline **Mock Mode** must remain active and truthfully labeled.
13. **Do Not Redesign Shared Shell:** Never redesign Relay's Sidebar, Topbar, or AppLayout unless specifically requested.
14. **Always Execute Verification Tests:** Run `npm --prefix frontend test` and `npm --prefix frontend run build` after modifying frontend code. Never report tests passed unless they have been executed.
15. **Truthful & Transparent Reporting:** Always report actual modified files, execution outputs, and any remaining open issues.
16. **Stop After Completion:** Once the explicitly requested task is finished, report the final delivery and **STOP**. Do not preemptively start the next phase.

---

## 2. Environment & Service Registry

- **Frontend Dev Server:** Port `5173` (Vite)
- **Backend API Server:** Port `5000` (Node.js Express)
- **Database Engine:** Port `27017` (MongoDB Community Server, Database: `relay_demo`)
- **Default M2W Operator Account:** `owner.m2w@relay-demo.test` / `password123`
- **Default M2W Workspace ID:** `6adaf2ccbaacf0587d451ae6`

---

## 3. Standard Verification Checklist for Every Pass

Before concluding any task, verify:
- [ ] `git status -s` shows only the intended files modified.
- [ ] No secrets, passwords, or environment variables were exposed.
- [ ] `npm --prefix frontend test` passes with 0 failures.
- [ ] `npm --prefix frontend run build` builds cleanly in Vite without bundling errors.
- [ ] Rendered screens adapt cleanly across Desktop (1525×1024), Laptop (1280×800), and Mobile (430×932).
- [ ] Browser console has zero uncaught exceptions.
