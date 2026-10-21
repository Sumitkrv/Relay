# Relay — API-Free Live Demonstration Guide
## Step-by-Step Stakeholder Walkthrough & Script (100% Offline Mock Mode)

> **Document Version:** 2.0.0 (Prompt 9.2 Release Hardening)  
> **Target Audience:** Agency Owners, Real Estate Sales Directors, QA Leads, Product Reviewers  
> **Runtime Environment:** Single-Operator Real Estate WhatsApp Automation Platform  
> **Connectivity:** 100% Offline Sandbox (Zero external WhatsApp Cloud API credentials required)

---

## 1. Demonstration Overview & Setup

This guide provides an end-to-end script for demonstrating the full capabilities of **Relay** to clients and stakeholders. Every feature functions realistically without sending live WhatsApp messages or paying Meta message fees.

### 1.1 Prerequisites
1. **MongoDB Database:** Running on `mongodb://127.0.0.1:27017/freelance-crm`
2. **Backend API Daemon:** Running on `http://localhost:5000`
3. **Frontend Application:** Running on `http://localhost:5174`
4. **Browser:** Google Chrome / Chromium at standard 100% zoom

### 1.2 Demo Credentials Configuration
- **Login URL:** `http://localhost:5174/`
- **Owner Account:** Configured workspace owner (e.g. `admin@relaycrm.io` or account created via `POST /api/auth/register`)
- **Password:** Configured via local `.env` (`DEMO_OWNER_PASSWORD`) or chosen during local owner setup. *Passwords are never exposed in version-controlled documentation.*

---

## 2. Eleven-Stage Demonstration Script

### Stage 1: Welcome & Owner Workspace Settings
**Narrative:** *"Relay is architected specifically for high-end luxury real estate brokerages where client trust and compliance are paramount."*

1. Open `http://localhost:5174/` and log in with owner credentials.
2. Direct attention to the top-right header: note the **Single-Operator Profile** and **Provider Status Pill** (`Mock Sandbox Active — Meta Disconnected`).
3. Click **Settings** in the left sidebar (Screen 7).
4. Inspect the **Workspace Profile** tab:
   - Point out the legal name: `M2W Luxury Realty LLC`.
   - Point out the RERA registration number: `RERA-2026-9941`.
   - Show the operational timezone: `Asia/Kolkata` (or `Asia/Dubai`).
5. Open the **WhatsApp Integration** tab:
   - Highlight that Relay operates with a strict fail-closed safety guard: live sending is intentionally blocked, ensuring no live messages can accidentally dispatch during testing.

---

### Stage 2: Importing Leads & Protecting Contact Lists
**Narrative:** *"Brokers acquire leads from portals, exhibitions, and social ads. Relay makes importing effortless while protecting against duplicates and spreadsheet formula injections."*

1. Click **Contacts** in the left sidebar (Screen 2).
2. Click **Import Contacts** button to open the 5-step **Smart Import Wizard**.
3. Point out the demo fixture file option or upload a sample real estate CSV.
4. Advance through the wizard steps:
   - **Step 1:** Upload file (CSV or XLSX).
   - **Step 2:** Column Mapping — show automatic mapping of *Full Name*, *Phone Number*, *City*, *Budget*, *Project Interest*, and *Consent Status*.
   - **Step 3:** Preview & Duplicate Policy — show duplicate detection setting (Skip duplicates vs. Update existing).
   - **Step 4:** Consent Confirmation — explain that Relay never assumes opt-in: imported numbers default to unconsented unless explicit proof is provided.
   - **Step 5:** Execution — click Execute and show the summary card indicating accepted rows, skipped duplicates, and sanitized fields.

---

### Stage 3: Contact Groups & Dynamic Segmentation
**Narrative:** *"Effective marketing requires hyper-targeted audiences. Relay provides both static groups and dynamic condition-based segments."*

1. In the **Contacts** screen, click the **Contact Groups** tab:
   - Show existing groups: `Palm Jumeirah VIPs`, `Emaar Investors`.
   - Click **Create Group**: create a group named `Downtown High-Net-Worth`, select jade color, and save.
2. Click the **Segments** tab:
   - Show dynamic rule evaluation: segment filtering contacts where `City = Dubai` and `Budget > 5,000,000 AED`.
   - Show how the segment membership updates dynamically as contacts are added or edited.

---

### Stage 4: Template Studio & Personalized PDF Brochures
**Narrative:** *"WhatsApp templates must be visually engaging and personalized. Relay's Template Studio lets brokers build rich messages with live phone previews."*

1. Click **Templates** in the left sidebar (Screen 3).
2. Point out existing templates or click **New Template**:
   - Enter Template Name: `palm_villa_exclusive`.
   - Select Category: `MARKETING`.
3. In the **Editor Panel** (center):
   - Type message body using variable tokens from the toolbar:  
     `"Hello {{first_name}}, we are pleased to present an exclusive preview of {{project}} in {{city}}."`
   - Attach a header document: select **Document (PDF)** and choose a brochure file.
   - Add Call-to-Action buttons: **Quick Reply** (`"Request Brochure"`) and **Visit Website** (`"View Virtual Tour"`).
4. Direct attention to the **WhatsApp Phone Preview** (right panel):
   - Show how the preview updates in real-time as tokens are typed.
   - Switch preview contacts using the contact selector to demonstrate live variable resolution.
5. Click **Save Template**: note that a permanent version snapshot (`v1`) is created.

---

### Stage 5: Mock Template Approval Simulation
**Narrative:** *"In production, Meta requires templates to be submitted for review. In Relay's offline sandbox, brokers can test the approval lifecycle without waiting for Meta reviewers."*

1. Navigate to **Settings → Developer / Test Mode** (`#developer`).
2. Locate the **Template Mock Approval** section.
3. Select your newly created template (`palm_villa_exclusive`).
4. Click **Simulate Meta Approval**:
   - The status immediately updates to `Approved (Mock Sandbox)`.
   - The template is now unlocked and available in the Campaign Wizard.

---

### Stage 6: The 4-Step Campaign Wizard & Consent Exclusion
**Narrative:** *"Relay's 4-step wizard guides the broker through campaign setup, ensuring strict compliance with opt-in regulations before any message can be dispatched."*

1. Click **Campaigns** in the left sidebar (Screen 4).
2. Click **Create Campaign** to launch the wizard:
   - **Step 1 (Template):** Select `palm_villa_exclusive`. Show that Relay creates an **immutable pinned snapshot** of the template, so future edits to the template do not corrupt active campaigns.
   - **Step 2 (Audience):** Select your target group (`Palm Jumeirah VIPs`).
     - Point out the **Live Audience Eligibility Preview**:
     - Explain the breakdown: total selected contacts vs. eligible (opted-in) vs. excluded (unconsented or opted-out).
     - Emphasize that unconsented contacts are strictly prevented from entering the dispatch queue.
   - **Step 3 (Preview):** Browse personalized message previews for specific contacts in the audience.
   - **Step 4 (Launch):** Select **Immediate Dispatch** and click **Launch Campaign**.

---

### Stage 7: Background Queue Worker & Simulated Status Lifecycle
**Narrative:** *"Once launched, Relay's durable background queue leases messages, dispatches them through the mock provider, and records status transitions."*

1. On the Campaigns dashboard, click on your newly launched campaign to open **Campaign Details**.
2. Point out the recipient message table:
   - Status begins as `QUEUED`.
   - The background queue worker leases the batch using concurrency locks.
   - Messages transition to `DISPATCHED` with simulated provider message IDs (`mock_msg_...`).
3. To demonstrate delivery updates:
   - Navigate to **Settings → Developer / Test Mode**.
   - Under **Simulate Status Event**, choose a message ID and trigger `SIMULATED_DELIVERED` and `SIMULATED_READ`.
   - Return to Campaign Details to show the updated status badges and timestamp logs.

---

### Stage 8: Two-Way Inbox & Real Estate Auto-Reply Automation
**Narrative:** *"When clients reply, Relay's intelligent auto-reply engine answers common inquiries instantly, 24/7."*

1. Click **Inbox** in the left sidebar (Screen 5).
2. To simulate a client reply:
   - Open **Settings → Developer / Test Mode**.
   - Under **Simulated Inbound Message**, enter the contact's phone number and the text: `"Please send me the BROCHURE"`.
   - Click **Send Synthetic Inbound**.
3. Return to **Inbox**:
   - Show the unread conversation thread at the top of the list.
   - Click to open the conversation:
     - Show the incoming message: `"Please send me the BROCHURE"`.
     - Show the **instant automated reply** dispatched by Relay's rule engine containing the brochure link and property details.
4. Demonstrate other keyword triggers:
   - Test `"PRICE"`: Relay responds with project details and requests unit layout preferences (1BHK/2BHK/Villa) without hardcoding fictitious numbers.
   - Test `"VISIT"`: Relay marks the conversation as **Needs Attention** and adds an internal private note for the sales director.
   - Test `"STOP"`: When tested on a demo contact, Relay immediately executes an authoritative opt-out, logs a consent revocation audit entry, and halts all future marketing. Authentic customer records are safely isolated.

---

### Stage 9: Manual Owner Takeover
**Narrative:** *"When a high-net-worth client wants a personal conversation, the broker can take over the chat and suspend automated rules."*

1. In the open conversation, locate the **Automation Status** toggle in the header.
2. Click **Take Over Conversation** (switches status to `MANUAL_TAKEOVER_ACTIVE`).
3. Send a synthetic inbound message: `"Can I negotiate the payment plan?"`.
4. Point out that the automated keyword engine **does not fire**: the broker has full personal control.
5. Compose and send a manual reply from the chat composer.
6. Click **Resume Automation** to return the conversation to normal automated monitoring.

---

### Stage 10: Operational Reports & Secure Data Exports
**Narrative:** *"Relay delivers real-time visibility into message delivery, lead engagement, and consent health with enterprise-grade data export capabilities."*

1. Click **Reports** in the left sidebar (Screen 6).
2. Inspect the **Overview** tab:
   - Highlight the 12-Status Metrics Breakdown: Intended, Eligible, Blocked, Queued, Processing, Completed Mock Attempts, Simulated Sent, Simulated Delivered, Simulated Read, Failed, Cancelled, and Retried.
   - Note that queued, processing, and blocked messages are excluded from processed counts, ensuring absolute metric honesty.
   - Point out that Official Sent Messages displays `None (Disconnected)` — emphasizing complete honesty about system state.
3. Click the **Campaign Comparison** tab:
   - Select 2 campaigns to show side-by-side performance metrics.
4. Click **Export Report**:
   - Select **CSV Export**: download and inspect the file — demonstrate that all formula characters (`=`, `+`, `-`, `@`) are safely escaped and UTF-8 BOM is preserved.
   - Select **Excel (.xlsx) Export**: download and inspect the multi-sheet formatted workbook with headers, styling, and isolated tenant records.

---

### Stage 11: Developer Diagnostics & Clean Demo Reset
**Narrative:** *"For continuous testing and demonstration, Relay includes built-in diagnostic tools and safe fixture management."*

1. Open **Settings → Developer / Test Mode** (`#developer`).
2. Show the **Simulate Outage (HTTP 503)** toggle:
   - Activate the outage toggle to demonstrate how queue workers handle upstream provider downtime with exponential backoff retries.
3. Show the **16-Subsystem Verification Matrix**:
   - Point out that all 16 core subsystems display `PASS (API-Free Mode)`.
4. Demonstrate **Safe Demo Reset**:
   - Click **Reset Demo Data**: explain that this deletes *only* synthetic test records marked `{ isDemo: true }`, ensuring real business data is never wiped.
   - Click **Load Standard Demo Fixtures**: instantly repopulates 60 realistic luxury real estate leads and templates for the next presentation.

---

## 3. Summary of Key Talking Points

| Capability | Demonstration Highlight |
| :--- | :--- |
| **Zero Setup Barrier** | Functions out-of-the-box in mock mode; no Meta Business Verification delays. |
| **Strict Compliance** | Guaranteed protection against spamming unconsented leads; hard STOP opt-out. |
| **Sales Acceleration** | Instant automated responses for brochures, prices, and viewing bookings. |
| **Human In The Loop** | Seamless manual takeover protects high-value personal client relationships. |
| **Data Integrity** | Formula-injection-safe exports; immutable campaign template versioning. |
| **Production Ready** | One-step switch to official Meta Cloud API in Prompt 10 with zero CRM rewrites. |
