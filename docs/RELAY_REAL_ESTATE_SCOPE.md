# Relay — Real Estate WhatsApp Automation
## Project Scope & Architectural Contract

> **AUTHORITATIVE SCOPE DEFINITION**: This document defines the exact functional boundaries, operator model, and product architecture for **Relay — Real Estate WhatsApp Automation**. All future prompts and implementation phases are bound by this contract.

---

## 1. Product Objective

Relay is a lightweight, focused WhatsApp automation platform designed exclusively for a real estate business. It automates repetitive real estate messaging tasks (lead outreach, project launch brochures, site-visit callbacks, basic keyword replies) without requiring additional personnel or complicated CRM software.

**The Golden Rules**:
- **ONE PERSON**: Operated by a single owner/broker. No multi-agent assignments, team invites, or employee roles.
- **ONE ACCOUNT**: Single owner login and operational workspace.
- **ONE BUSINESS NUMBER**: Connected to exactly one official WhatsApp Business number (WABA Phone Number ID).
- **ONE CENTRALIZED DASHBOARD**: Seven focused navigation screens; no sprawling multi-module CRM.

---

## 2. Seven-Screen Primary Navigation

The application navigation is strictly limited to exactly seven primary screens:

| # | Screen Label | Route | Purpose & Primary Features |
| :-: | :--- | :--- | :--- |
| **1** | **Overview** | `/` | Centralized snapshot: total property contacts, scheduled campaigns, inbound replies, recent campaigns, provider status, and fast quick actions. |
| **2** | **Contacts** | `/contacts` | Property enquiry contacts, smart audience filters (city, project, property interest), tag management, consent audit trail, and seamless Excel/CSV import. |
| **3** | **Templates** | `/templates` | Reusable WhatsApp message templates, variable interpolation (`{{name}}`, `{{project}}`, `{{location}}`), live mobile preview, media header attachments, and submission readiness. |
| **4** | **Campaigns** | `/campaigns` | Bulk campaign management, audience filter selection, personalized contact previews, scheduling, execution monitoring, and safe pause/cancel controls. |
| **5** | **Inbox & Auto-reply** | `/inbox` | Two-way unified customer message timeline, saved quick replies, keyword-based auto-replies ("BROCHURE", "PRICE", "VISIT", "STOP"), and manual owner takeover. |
| **6** | **Reports** | `/reports` | Campaign delivery performance, read receipts, inbound reply rates, excluded/failed contacts, and owner-protected CSV/Excel exports. |
| **7** | **Settings** | `/settings` | Single-owner profile, business information, WhatsApp Business API connection configuration, operational defaults, and security settings. |

### Secondary / Structural Shell Elements
- **Sidebar Collapse/Expand**: Persisted toggle for compact (72px) vs expanded (248px) sidebar on desktop; overlay drawer on mobile.
- **Owner Profile**: Located in sidebar footer and topbar avatar menu with direct link to `/settings`.
- **Sign Out**: Clean session termination and redirect to `/login`.

---

## 3. End-to-End User Journey

The real estate operator follows a disciplined 6-step lifecycle:
```text
1. CONNECT      --> Link the official WhatsApp Business Account (Phone Number ID, credentials).
2. IMPORT       --> Upload property enquiry spreadsheets (.xlsx, .csv) with field mapping & duplicate check.
3. FILTER       --> Filter eligible target audience by City (e.g. Gurugram, Noida), Project, or Property Interest (Plots, Villas).
4. PREVIEW      --> Select an approved template, personalize variables per contact, and verify live WhatsApp preview.
5. CONFIRM      --> Operator authorizes campaign; sends immediately or schedules for a specific date/time.
6. TRACK/REPLY  --> Inbound questions arrive in Inbox; keyword rules answer common queries; owner takes over when needed; delivery results appear in Reports.
```

---

## 4. Feature Boundaries: Included vs. Excluded

### INCLUDED IN THE PRODUCT:
- Single-owner secure authentication (HTTP-only JWT sessions, bcrypt hashing).
- Single WhatsApp Business number connectivity.
- Property lead import (Excel `.xlsx` and `.csv`) with normalization, duplicate detection, and country defaults.
- Real estate audience segmentation: City, Property Interest (Plots, Apartments, Farmhouses, Villas, Commercial), Project, Tags, Opt-in Status.
- Reusable WhatsApp message templates with dynamic contact placeholders and media header support.
- WhatsApp mobile rendering preview before launching campaigns.
- Bulk campaign creation, personalized per-recipient preview, campaign scheduling, pause/resume, and status tracking.
- Two-way WhatsApp inbox timeline with unread tracking and saved quick replies.
- Keyword-based auto-reply rules (e.g. "BROCHURE", "PRICE", "VISIT", "STOP").
- Manual owner takeover for high-touch customer conversations.
- Delivery performance and reply reports with CSV export capabilities.
- Official Meta WhatsApp Cloud API connection in the final integration phase.
- Live system status monitoring (Backend, MongoDB, WhatsApp Provider, Mock Mode).

### STRICTLY EXCLUDED FROM THE PRODUCT:
- **No Multi-Agent / Team Collaboration**: No team invitations, agent assignments, sales manager hierarchies, or employee permissions.
- **No Full CRM Deal Pipeline**: No deal Kanban boards, pipeline stages, proposals, client contracts, or quotations.
- **No Property Inventory Platform**: No MLS-style listing portals, unit availability matrices, floorplan viewers, or site-visit route planners.
- **No Billing / SaaS Reseller Tools**: No subscription billing, payment gateway collections, prepaid wallets, or multi-tenant white-labeling.
- **No Complex Chatbot DAG Builders**: No visual flowchart node-graph builders, AI voice bots, or multi-agent LLM systems.
- **No External Multi-Channel Outreach**: No SMS gateways, email newsletters, or Meta Ads campaign managers.

---

## 5. Mock Mode vs. Live Provider Distinction

To maintain strict regulatory compliance and prevent accidental message blasts:
1. **Mock Mode (Development & Testing Phases)**:
   - Outbound campaign sends are durably simulated within the database and internal queue workers.
   - Provider state displays as **Disconnected**.
   - Interface clearly displays **Mock Mode** badges.
   - Zero external HTTP calls to Meta's servers are executed.
   - Delivery and read events in mock mode are explicitly identified as simulated tests.

2. **Verified Live Mode (Final Meta Integration Phase Only)**:
   - Enabled only after valid Meta App ID, System User Access Token, and WABA Phone Number ID are authenticated.
   - External messages are dispatched exclusively via Meta's Graph API endpoints.
   - Delivery receipts and replies are driven exclusively by verified, cryptographically signed Meta webhooks (`hub.signature_256`).

---

## 6. Security & Consent Policy

1. **Explicit Affirmative Consent Required**:
   - Every contact defaults to `Unknown` consent upon spreadsheet import.
   - Marketing campaigns strictly filter for contacts with verified `Opted In` status and affirmative consent records.
   - An opt-out request ("STOP", "Unsubscribe", or verbal request) immediately suppresses the contact from all marketing campaigns.

2. **Server-Side Data Isolation**:
   - Every database query and mutation is strictly scoped to the authenticated owner's `_id`.
   - Client-side filtering alone is never accepted as authorization.

3. **Secret Protection**:
   - Meta access tokens and system secrets are never stored in browser `localStorage` or client bundles.
   - Cookies use `HttpOnly`, `SameSite=Lax`, and `Secure` attributes.

---

## 7. Definition of Done (DoD)

A development phase is considered **DONE** only when:
1. The code builds cleanly (`npm --prefix frontend run build`).
2. All automated tests pass without errors (`npm test` on frontend and backend).
3. Data changes are verified against the local MongoDB instance.
4. UI displays correctly across all target viewports (1600px to 320px).
5. No regressions are introduced to previously working features.
6. The implementation strictly adheres to the single-operator, single-number scope.
