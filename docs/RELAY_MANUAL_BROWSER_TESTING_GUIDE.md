# RELAY SAAS — COMPLETE MANUAL BROWSER TESTING GUIDE

**Document:** Relay SaaS Master Prompt 13.5 Manual Browser Verification Walkthrough  
**Purpose:** Step-by-step instructions for the owner/developer to personally test every feature in the browser without any third-party APIs.  
**Frontend URL:** `http://localhost:5174`  
**Backend API URL:** `http://localhost:5000`  
**Default Password for all seeded personas:** `DemoPass123!`

---

## Quick Navigation Links
- **Offline Testing Control Center:** [`http://localhost:5174/dev/testing`](http://localhost:5174/dev/testing)
- **Development Local Mailbox:** [`http://localhost:5174/dev/mailbox`](http://localhost:5174/dev/mailbox)
- **Public Landing Page:** [`http://localhost:5174/`](http://localhost:5174/)
- **Super Admin Dashboard:** [`http://localhost:5174/admin`](http://localhost:5174/admin)
- **Agency Partner Portal:** [`http://localhost:5174/agency`](http://localhost:5174/agency)

---

## WORKFLOW A — PRESEEDED ACCOUNT EXPLORATION (GYM & REAL ESTATE)

### TEST 01: Customer Login (FitZone Gym Owner)
- **Account:** `gym-owner@relay-demo.test` (Password: `DemoPass123!`)
- **Route:** `http://localhost:5174/login`
- **Action:** Enter credentials and click **Sign In**. (Or visit `/dev/testing` and click **Login Real Session** beside FitZone Gym).
- **Expected Result:** Successfully authenticates via Express and redirects to `/app/overview`. The top navigation bar shows "FitZone Gym".
- **Database Record Changed:** `User.lastLoginAt` updates in MongoDB.
- **Security Check:** Must not load M2W Realty or Glow Salon contacts.
- [ ] **PASS / FAIL**

---

### TEST 02: Dashboard Overview & Real Calculated Metrics
- **Account:** FitZone Gym Owner
- **Route:** `http://localhost:5174/app/overview`
- **Action:** Inspect the dashboard counters (Total Contacts, Templates, Campaigns, Messages).
- **Expected Result:** Counters match actual database records (4 contacts pre-seeded). Setup progress reflects active industry configuration.
- **Database Record Changed:** Read-only aggregate; no mutation.
- **Security Check:** Metrics must only reflect the FitZone Gym workspace.
- [ ] **PASS / FAIL**

---

### TEST 03: Contacts CRUD with Dynamic Industry Fields
- **Account:** FitZone Gym Owner
- **Route:** `http://localhost:5174/app/contacts`
- **Action:**
  1. Click **+ Add Contact**.
  2. Enter:
     - Full Name: `Vikram Malhotra`
     - Phone Number: `+919876500901`
     - Membership Type: Select `Annual Membership`
     - Fitness Program: Select `Strength Training`
     - Trial Session Interest: Select `Requested`
  3. Click **Save Contact**.
- **Expected Result:** Contact is saved to MongoDB and immediately appears in the contact list table. Table displays industry-specific badges (`Annual Membership`, `Strength Training`).
- **Database Record Changed:** New document inserted into `contacts` collection with `workspaceId: gymWs._id` and `industryData`.
- **Security Check:** Must not alter contacts in other workspaces.
- [ ] **PASS / FAIL**

---

### TEST 04: Message Templates with Variable Placeholders
- **Account:** FitZone Gym Owner
- **Route:** `http://localhost:5174/app/templates`
- **Action:**
  1. Click **+ New Template**.
  2. Select Industry Preset: `Membership Packages & Rates`.
  3. Notice dynamic placeholders: `{{customer_name}}`, `{{business_name}}`.
  4. Edit text and click **Save Template**.
- **Expected Result:** Template saves to MongoDB with status `Draft` or `Simulated Ready`.
- **Database Record Changed:** Document inserted into `messagetemplates`.
- **Security Check:** Meta approval state remains unverified (no fake "Officially Approved" badges).
- [ ] **PASS / FAIL**

---

### TEST 05: Mock Campaign Execution & Queue Worker
- **Account:** FitZone Gym Owner
- **Route:** `http://localhost:5174/app/campaigns/new`
- **Action:**
  1. Campaign Name: `Gym Diwali Special Offer`.
  2. Select the template created in Test 04.
  3. Select Audience: `All Contacts (Opted In)`.
  4. Select Mock Connection.
  5. Click **Launch Campaign**.
- **Expected Result:** Campaign execution state transitions: `Draft` -> `Queued` -> `Processing` -> `Completed`. Simulated delivery timestamps persist in the database.
- **Database Record Changed:** Document created in `campaigns` and `campaignexecutions`.
- **Security Check:** Zero real WhatsApp API calls made; external provider adapter fails closed.
- [ ] **PASS / FAIL**

---

### TEST 06: Interactive Inbox & Inbound Auto-Reply Simulation
- **Account:** FitZone Gym Owner
- **Route:** `http://localhost:5174/app/inbox`
- **Action:**
  1. Select conversation with `Rahul Sharma (+919876500101)`.
  2. Observe previous simulated conversation thread.
  3. Type incoming message simulation: `Hi, do you offer a TRIAL session?`
  4. Click **Simulate Inbound Message**.
- **Expected Result:** Message appears as an inbound bubble in the thread. The Gym `TRIAL` Auto-Reply rule activates, and a simulated automated reply appears: *"Thanks for asking about our Free Trial! Reply YES to confirm tomorrow 10am."*
- **Database Record Changed:** Inbound and outbound message records inserted into `conversationmessages`.
- **Security Check:** Auto-reply only matches enabled workspace rules; no real WhatsApp transmission.
- [ ] **PASS / FAIL**

---

### TEST 07: Reports Calculation from Database State
- **Account:** FitZone Gym Owner
- **Route:** `http://localhost:5174/app/reports`
- **Action:** Review delivery and activity analytics.
- **Expected Result:** Charts calculate dynamically from stored contacts and simulated messages. All simulated messaging volume is clearly designated as mock telemetry.
- **Database Record Changed:** Read-only aggregation.
- **Security Check:** Zero fabricated graph arrays.
- [ ] **PASS / FAIL**

---

### TEST 08: Mock WhatsApp Connection Wizard
- **Account:** FitZone Gym Owner
- **Route:** `http://localhost:5174/app/settings#integrations`
- **Action:**
  1. Scroll to **WhatsApp Business Connection Manager (Mock Simulation)**.
  2. Select **WhatsApp Business App (Coexistence Mode)**.
  3. Enter Test Number: `+919876500100`.
  4. Click **Simulate Meta Connection**.
- **Expected Result:** Shows progress indicator, then transitions badge to `MOCK_SIMULATED_READY`. Displays connected test phone number. Click **Disconnect Mock Number** to test clean disconnection.
- **Database Record Changed:** Workspace connection status updated.
- **Security Check:** Clearly states `MOCK_SIMULATED_READY`; never displays fake official Meta verification.
- [ ] **PASS / FAIL**

---

### TEST 09: Mock Billing & 14-Day Free Trial
- **Account:** FitZone Gym Owner
- **Route:** `http://localhost:5174/app/settings#billing`
- **Action:**
  1. Observe subscription status: Shows **Relay Solo — ₹799/month**, badge `ACTIVE` or `TRIALING`.
  2. Click **+15 Days (Expire)** button in the Test Clock section.
  3. Observe status transitions to `EXPIRED` or `PAST_DUE`.
  4. Click **Simulate ₹799 Mock Checkout**.
  5. Observe status transitions back to `ACTIVE` with a new simulated receipt recorded in the invoice table below.
  6. Click **View Mock Receipt** to inspect the itemized PDF-style test voucher.
- **Database Record Changed:** Updates `workspacesubscriptions` and inserts new record in `billinginvoices`.
- **Security Check:** Never connects to live Razorpay or uses real credit cards.
- [ ] **PASS / FAIL**

---

## WORKFLOW B — BRAND NEW CUSTOMER JOURNEY (MODE B)

### TEST 10: Registration & Local Email Verification
- **Account:** Fresh Unregistered User
- **Route:** `http://localhost:5174/register`
- **Action:**
  1. Enter:
     - Name: `Pooja Sharma`
     - Email: `pooja-clinic@relay-demo.test`
     - Password: `DemoPass123!`
     - Confirm Password: `DemoPass123!`
  2. Click **Create Account**.
  3. See notice: "Please check your email to verify your account."
  4. Open new browser tab to `http://localhost:5174/dev/mailbox`.
  5. Locate incoming email: **"Verify your Relay account email"**.
  6. Click **Open Link** (or click the verification button in the email preview).
  7. Verification page opens and confirms: *"Email verified successfully. You can now log in."*
- **Database Record Changed:** Creates `User` with `accountStatus: 'ACTIVE'` and `isEmailVerified: true`.
- **Security Check:** Email was intercepted locally; no real SMTP or Resend network calls occurred.
- [ ] **PASS / FAIL**

---

### TEST 11: Business Onboarding Wizard
- **Account:** `pooja-clinic@relay-demo.test`
- **Route:** `http://localhost:5174/login`
- **Action:**
  1. Sign in with newly verified credentials.
  2. User is redirected to `/onboarding`.
  3. Step 1: Business Identity:
     - Business Name: `Apex Dental & Skin Clinic`
     - Business Phone: `+919876543999`
  4. Step 2: Industry Selection: Select **Healthcare Clinic**.
  5. Step 3: Location: City: `Pune`, Timezone: `Asia/Kolkata`.
  6. Step 4: Complete onboarding.
- **Expected Result:** Backend atomically provisions a new `Workspace` (`industryKey: clinic`), creates an `OWNER` `WorkspaceMembership`, and redirects to `/app/overview`.
- **Database Record Changed:** New document in `workspaces` and `workspacememberships`.
- **Security Check:** Newly created user starts with 0 contacts and 0 cross-tenant contamination.
- [ ] **PASS / FAIL**

---

## WORKFLOW C — PLATFORM SUPER ADMIN GOVERNANCE

### TEST 12: Super Admin Platform Directory & Telemetry
- **Account:** `admin@relay-demo.test` (Password: `DemoPass123!`)
- **Route:** `http://localhost:5174/admin`
- **Action:**
  1. Login via `/dev/testing` as Platform Super Admin.
  2. Navigate to `/admin`.
  3. Inspect platform overview telemetry (Workspaces count, Active subscriptions, Simulated revenue ₹11,988, Live revenue ₹0).
  4. In the Workspace Directory table, locate `FitZone Gym`.
  5. Click **Suspend**.
- **Expected Result:** FitZone Gym status updates to `SUSPENDED` in red.
- **Database Record Changed:** `Workspace.status` updated to `SUSPENDED`.
- **Security Check:** Attempting to access `/admin` with `gym-owner@relay-demo.test` returns HTTP 403 Forbidden.
- [ ] **PASS / FAIL**

---

### TEST 13: Super Admin Workspace Reactivation
- **Account:** Platform Super Admin
- **Route:** `http://localhost:5174/admin`
- **Action:**
  1. Locate suspended `FitZone Gym`.
  2. Click **Reactivate**.
- **Expected Result:** Workspace status returns to `ACTIVE`.
- **Database Record Changed:** `Workspace.status` set to `ACTIVE`.
- [ ] **PASS / FAIL**

---

## WORKFLOW D — AGENCY & WHITE-LABEL PARTNER SYSTEM

### TEST 14: Agency Multi-Client Overview
- **Account:** `agency-owner@relay-demo.test` (Password: `DemoPass123!`)
- **Route:** `http://localhost:5174/agency`
- **Action:**
  1. Login as Agency Owner.
  2. Open `/agency`.
  3. View linked client workspaces (`FitZone Gym`, `Glow Studio`, `CarePlus Clinic`) and delegated permissions.
- **Expected Result:** Displays all authorized client workspaces without exposing unlinked tenants (e.g. M2W Realty remains private).
- **Security Check:** Agency permissions are validated server-side.
- [ ] **PASS / FAIL**

---

### TEST 15: Client Invitation via Local Mailbox Sink
- **Account:** Agency Owner
- **Route:** `http://localhost:5174/agency`
- **Action:**
  1. Under **Invite Client Workspace**, enter `client-partner@relay-demo.test`.
  2. Click **Send Client Invite**.
  3. Open `http://localhost:5174/dev/mailbox`.
  4. Find the intercepted invitation email with the secure client acceptance link.
- **Expected Result:** Invitation recorded in database and link intercepted in local mailbox.
- [ ] **PASS / FAIL**

---

### TEST 16: White-Label Branding Customization
- **Account:** Agency Owner
- **Route:** `http://localhost:5174/agency`
- **Action:**
  1. Switch to **White-Label Branding** tab.
  2. Change Agency Display Name to: `Quantum Growth Agency`.
  3. Select Brand Color: Pick `#6366F1` (Indigo).
  4. Change Portal Title to: `Quantum Automated Growth Hub`.
  5. Click **Save Agency Branding**.
- **Expected Result:** "Agency branding updated and saved to MongoDB" toast appears. The Live Client Portal Preview dynamically updates in real time with the new color and brand title.
- **Database Record Changed:** `Agency.branding` updated in MongoDB.
- [ ] **PASS / FAIL**

---

### TEST 17: Mock Custom Domain Lifecycle Simulator
- **Account:** Agency Owner
- **Route:** `http://localhost:5174/agency`
- **Action:**
  1. Switch to **Custom Domain Simulation** tab.
  2. Enter Hostname: `crm.quantumagency.test`.
  3. Click **Step 1: Simulate DNS Verification**.
  4. Status changes to `DNS_VERIFIED` / `VERIFIED`.
  5. Click **Step 2: Simulate TLS Provisioning**.
  6. Status changes to `ACTIVE` in green.
- **Expected Result:** Clean state transitions through the domain lifecycle state machine.
- **Security Check:** Disclaimer clearly notes that real public DNS and TLS certificates are not issued.
- [ ] **PASS / FAIL**

---

## WORKFLOW E — ADVERSARIAL CROSS-TENANT SECURITY

### TEST 18: Malicious Header Injection Blockage
- **Account:** FitZone Gym Owner (`gym-owner@relay-demo.test`)
- **Action:** Attempt to forge an `x-workspace-id` header to point to Glow Studio or M2W Realty.
- **Expected Result:** Server authorization middleware detects that the Gym Owner has no membership in that target workspace and strictly blocks the request or forces scoping to the Gym's legitimate records.
- **Database Record Changed:** Zero data mutation.
- **Security Check:** Gym cannot read or alter another tenant's contacts, templates, or conversations.
- [ ] **PASS / FAIL**

---

## Summary of Completed Tests

| Section | Tests | Pass | Fail | Notes |
|---|---|---|---|---|
| Workflow A: Preseeded Explorations | Tests 01–09 | [ ] | [ ] | Gym & Real Estate Verticals |
| Workflow B: Brand New Customer | Tests 10–11 | [ ] | [ ] | Registration, Verification & Onboarding |
| Workflow C: Platform Super Admin | Tests 12–13 | [ ] | [ ] | Telemetry & Suspension |
| Workflow D: Agency & White-Label | Tests 14–17 | [ ] | [ ] | Delegations, Branding & Domains |
| Workflow E: Cross-Tenant Security | Test 18 | [ ] | [ ] | Adversarial Boundaries |
