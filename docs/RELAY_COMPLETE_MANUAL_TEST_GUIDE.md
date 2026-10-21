# Relay — Complete Manual QA & Testing Guide
## Single-Operator Real Estate WhatsApp Automation (Prompt 9 API-Free Release)

> **Document Version:** 1.0.0 (Prompt 9 Verified)  
> **Environment:** Local Offline Simulation Mode (Mock WhatsApp Provider)  
> **Execution Mode:** `MOCK` (Zero external network calls; Meta Cloud API strictly disconnected)  
> **Target Persona:** Real Estate Business Owner / Operator (Non-technical friendly)

---

## 1. Overview & System Safety

Relay operates with an **authentic internal operations architecture**: every button, filter, form, and trigger executes genuine backend routes and persists records directly to MongoDB. 

During Prompt 9, external WhatsApp message dispatch to Meta's servers is **strictly blocked** by a fail-closed server guard (returning HTTP 403 if `LIVE` mode is attempted). Instead, all message dispatches, carrier status updates, and customer inbound replies are driven through the **Relay Mock WhatsApp Provider** using deterministic synthetic events (`mock_msg_...` IDs, `SIMULATED_...` statuses, `synthetic_test` event sources).

### System Status Indicators
At the top-right of your navigation header, you will always see:
1. **API & Database Online**: Confirms Express backend and MongoDB are healthy.
2. **Mock Mode (Simulated Offline)**: Confirms WhatsApp Cloud API is disconnected for Prompt 10 readiness and no live messages can leave the server.

---

## 2. Screen-by-Screen Step-by-Step QA Instructions

---

### Screen 1: Operational Overview (Dashboard)
**URL:** `http://localhost:5174/`

| Action | What to Click / Enter | What Happens in Backend / MongoDB | What Updates in App | How to Identify Failure |
| :--- | :--- | :--- | :--- | :--- |
| **View Operational KPIs** | Navigate to Overview | Aggregates `Contact`, `Campaign`, and `Message` collections for the logged-in owner | 4 Primary KPI cards: Total Contacts, Active Campaigns, Messages Queued/Sent (Mock), Inquiries | Counts show loading spinner or error toast; numbers don't match database |
| **Verify Provider State** | Check header badge | Queries `/api/health` and `/api/settings/whatsapp-status` | Displays truthful "WhatsApp Disconnected (Mock Mode)" banner | Shows green "Connected to Meta" (forbidden before Prompt 10) |
| **Quick Action: New Contact** | Click "Add Contact" button | Routes to Contacts page drawer | Drawer opens ready for input | Dead button or broken link |
| **Quick Action: New Campaign** | Click "Create Campaign" button | Routes to Campaigns page wizard | Step 1 of campaign wizard opens | Wizard fails to initialize |

---

### Screen 2: Contacts & CSV/Excel Import
**URL:** `http://localhost:5174/contacts`

#### A. Add Single Contact
1. Click **+ Add Contact** at top right.
2. Fill in:
   - **Full Name:** `Vikramaditya Singhania`
   - **Phone Number:** `+919811223344` (Strict E.164 normalization)
   - **Property Interest:** `Penthouse / 4BHK`
   - **Location:** `Golf Course Road, Gurugram`
   - **Consent Status:** `Opted In` (Select explicit consent date and source)
3. Click **Save Contact**.
- **Backend/DB Evidence:** `POST /api/contacts` returns HTTP 201; MongoDB inserts new document in `contacts` collection with `ownerId` and normalized E.164 phone.
- **App Update:** Contact immediately appears in table; total count badge increments; Overview dashboard count updates.

#### B. CSV / Excel Import Wizard
1. Click **Import Contacts** button.
2. In Step 1, upload or select `test-fixtures/Relay_Demo_Contacts_60.csv` or `test-fixtures/Relay_Demo_Test_Pack.xlsx`.
3. In Step 2 (Header Mapping), map columns: `Name` → `fullName`, `Phone` → `phoneNumber`, `Project` → `interestedProject`, `City` → `location`.
4. In Step 3 (Validation & Duplicates), select duplicate strategy: `Skip Duplicates` or `Update Existing`.
5. Click **Confirm & Import**.
- **Backend/DB Evidence:** `POST /api/imports/preview` validates rows; `POST /api/imports/execute` writes `ImportBatch` and inserts contacts safely; duplicate phone records are handled according to policy. Formula injection prefixes (`=`, `+`, `-`, `@`) are neutralized.
- **App Update:** Import progress reaches 100%, displays summary of imported vs skipped rows, and populates the table.

#### C. Contact Groups & Dynamic Segments
1. Switch to **Groups** tab: Click **+ Create Group**, enter `DLF Phase 5 High Net Worth`, assign color Jade, save.
2. Select 2 contacts using checkboxes, click **Bulk Actions → Add to Group**, choose the group.
3. Switch to **Segments** tab: Click **+ New Segment**, add rule `location equals Gurugram` AND `propertyType equals Apartment`. Click **Preview Matches** to verify matching count before saving.
- **Backend/DB Evidence:** MongoDB updates `contactgroups` and evaluates allowlisted Mongo query operators for `segments`.

---

### Screen 3: Templates & Brochure Attachment
**URL:** `http://localhost:5174/templates`

#### A. Create Template with Real Estate Variables
1. Click **+ Create Template**.
2. Select Category: `Marketing` (Property Promotion).
3. Set Template Name: `luxury_penthouse_invitation`.
4. Header: Select `Document` or `Image`. Click **Upload Media File** and upload a sample PDF brochure (`.pdf`).
5. Body: Insert text with tokens:
   ```text
   Hi {{name}}, we have released an exclusive preview of {{project}} in {{city}}.
   Download the attached brochure for floor plans and payment schedules.
   ```
6. Buttons: Add Quick Reply `Request Brochure` and URL CTA `View Master Plan` (`https://relaycrm.io/brochure`).
7. Click **Save Template**.
- **Backend/DB Evidence:** `POST /api/templates` writes `MessageTemplate` record and pins initial `TemplateVersion` snapshot. Uploaded file is durably stored in `/uploads/` with sanitized filename.
- **App Update:** Live WhatsApp simulation phone preview renders dynamically with sample values for `{{name}}`, `{{project}}`, and `{{city}}`.

#### B. Template Mock Approval Lifecycle
1. In the template card, view the mock approval pill: `Simulated Approved`.
2. Go to **Settings → Developer / Test Mode**.
3. Under **Template Mock Approval Simulator**, select `luxury_penthouse_invitation`.
4. Test transitions: Click **Submit** (`Simulated Submission`) → Click **Pending** (`Simulated Pending Review`) → Click **Approve** (`Simulated Approved`).
- **Backend/DB Evidence:** `POST /api/templates/:id/mock-approval` modifies `mockProviderApprovalStatus`. The real `providerStatus` remains `Not Submitted`.

---

### Screen 4: Campaigns, Queue & Scheduling
**URL:** `http://localhost:5174/campaigns`

#### A. Create and Launch Mock Campaign
1. Click **+ New Campaign**.
2. **Step 1 (Template):** Select `luxury_penthouse_invitation`. Note the immutable pinned template snapshot badge.
3. **Step 2 (Audience):** Select Target: `Contact Group` (`DLF Phase 5 High Net Worth`) or `All Opted-In Contacts`. Review the **Live Audience Eligibility Breakdown**:
   - Total Selected
   - Eligible (Opted In with valid E.164 phone)
   - Excluded (Unknown Consent, Opted Out, Do Not Contact, Invalid Phone)
4. **Step 3 (Preview):** Browse personalized message previews with contact pager.
5. **Step 4 (Launch):**
   - Choose **Send Now (Mock Queue Execution)**.
   - Click **Confirm & Launch Campaign**.
- **Backend/DB Evidence:** `POST /api/campaigns` creates `Campaign` and `CampaignRun`. Recipient message intents are enqueued in `Message` collection with state `QUEUED`. Background worker leases messages with atomic locks, formats WhatsApp Cloud payloads, and passes them to `mockWhatsAppProvider`.
- **App Update:** Status badge turns to `Active / Completed`; live recipient table shows `Simulated Sent` / `Simulated Delivered` with synthetic `mock_msg_...` IDs.

#### B. Scheduled Campaign & Lifecycle Controls
1. Create another campaign, in Step 4 choose **Schedule for Later**.
2. Pick a future date/time (e.g. tomorrow at 11:00 AM). Click **Schedule Campaign**.
3. In Campaigns list:
   - Click **Pause**: Campaign transitions to `PAUSED`; queued messages cannot be leased.
   - Click **Resume**: Campaign transitions back to `SCHEDULED`.
   - Click **Cancel**: Future runs are marked `CANCELLED`; message records transition to `CANCELLED`.
- **Backend/DB Evidence:** Verifiable in MongoDB collections `campaigns` and `messages`. Survives backend restarts.

---

### Screen 5: Inbox, Quick Replies & Auto-Replies
**URL:** `http://localhost:5174/inbox`

#### A. View Conversations & Timeline
1. Left panel lists active conversations with unread indicators and lead status tags.
2. Center panel displays full chat history with timestamps and source badges:
   - `Synthetic Test Event`: Clearly distinguishes mock messages from real provider messages.
3. Right panel displays Contact Details, Property Interest, Consent Status (`Opted In`), Follow-up reminders, and Internal Notes.

#### B. Test Inbound Keywords (BROCHURE, PRICE, VISIT, STOP)
1. Go to **Settings → Developer / Test Mode**.
2. Select your contact in **Simulate Customer Inbound Reply**.
3. Test **BROCHURE**: Click `BROCHURE` preset, click **Simulate Incoming Reply**.
   - Result: Auto-reply rule fires, sending digital brochure link immediately.
4. Test **PRICE**: Click `PRICE` preset, click **Simulate Incoming Reply**.
   - Result: Price inquiry rule responds with base pricing and asks for configuration.
5. Test **VISIT**: Click `VISIT` preset, click **Simulate Incoming Reply**.
   - Result: Flags conversation as `Needs Attention`, invites user to sample flat, creates Internal Note.
6. Test **STOP**: Click `STOP` preset, click **Simulate Incoming Reply**.
   - Result: **Strict Opt-out Compliance** triggered! Contact's `whatsappConsentStatus` immediately flips to `Opted Out`, adding a suppression audit record. All future marketing campaigns for this contact are blocked.

#### C. Owner Takeover & Quick Replies
1. In Inbox conversation header, toggle **Auto-Reply Active** to **Manual Takeover (Automation Paused)**.
2. In composer at bottom, click **Quick Replies**, select `Experience Center & Site Visit`.
3. Notice variables like `{{first_name}}` and `{{city}}` automatically resolve!
4. Click **Send Mock Reply**. Message posts immediately to timeline.

---

### Screen 6: Reports & Exports
**URL:** `http://localhost:5174/reports`

#### A. Operational Analytics & Mock Delivery Stats
1. **Overview Tab:** Displays KPI cards with breakdown of Total Messages, Simulated Delivered, Simulated Read, Simulated Failed, and Verified Real Provider metrics (`Not Available (Prompt 10 Readiness)`).
2. **Campaigns Tab:** Multi-campaign comparative metrics, delivery rate graphs, and recipient exclusion audits.
3. **Consent Tab:** Opt-in breakdown (Explicit Opt-in, Imported, Unknown, Opted Out).

#### B. Secure CSV & Excel Export Testing
1. Click **Export Report** button.
2. Choose **Campaign Performance CSV** or **Excel Workbook (.xlsx)**.
3. Click **Download Export**.
- **Backend/DB Evidence:** Server streams generated bytes with `Content-Disposition: attachment`. All fields starting with formula symbols (`=`, `+`, `-`, `@`) are escaped with a leading single quote (`'`) to prevent spreadsheet injection attacks.
- **Verification:** Open downloaded file in Microsoft Excel or Google Sheets. Verify correct row counts, clean columns, and absence of formula execution warnings.

---

### Screen 7: Settings & Developer Testing Center
**URL:** `http://localhost:5174/settings`

#### A. Settings Tabs (Single-Operator Workspace)
1. **Profile:** Edit owner full name and email; updates header avatar and persisted User record.
2. **Business Profile:** Update Real Estate agency name (`M2W Luxury Realty`), office address, and RERA registration number.
3. **Security & Password:** Change password with strict entropy validation; invalidates older sessions.
4. **WhatsApp Integration:** Displays Provider status as `Disconnected`, mode `Mock Sandbox`, and 24-hr customer service window policy.
5. **Preferences:** Set operational timezone (`Asia/Kolkata`), date format, and marketing quiet hours.

#### B. Developer / Test Mode (Testing Center)
**Tab URL:** `http://localhost:5174/settings#developer`
- **Safeguards Status:** Displays fail-closed guard status and active execution mode.
- **Simulate Provider Outage (503):** Toggle to simulate Meta API outage; test how queue worker enters backoff mode.
- **Delivery & Read Status Simulator:** Paste any Message ID, click `Simulate Delivered` or `Simulate Read` to advance message lifecycle.
- **Fixtures Manager:** 
  - `Load Test Dataset`: Imports 60 realistic Indian real estate leads with property interests.
  - `Clear Demo Data Safely`: Deletes ONLY demo records (`isDemo: true`), preserving real workspace data with double confirmation dialog.
- **16-Subsystem Matrix:** Verifies live operational status of all platform subsystems.

---

## 3. How to Reset the Environment Safely

If you ever wish to reset demo data and return to a clean state:
1. Open **Settings → Developer / Test Mode**.
2. Scroll to **Demo Dataset & Fixtures Manager**.
3. Click **Clear Demo Data Safely**.
4. Confirm in the dialog. All synthetic records (`isDemo: true`) will be cleaned up while your business profile and real configurations remain intact.
5. Alternatively, run from terminal:
   ```bash
   npm run demo:reset
   ```
To reload the full 60-contact real estate demonstration dataset:
```bash
npm run demo:seed
```
