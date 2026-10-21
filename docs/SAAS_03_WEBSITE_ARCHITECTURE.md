# RELAY SAAS — PROMPT 3 ARCHITECTURE DOCUMENTATION
## World-Class Premium Multi-Industry WhatsApp Automation SaaS Marketing Frontend

**Document Version:** 1.0.0  
**Phase:** SaaS Prompt 3 of 15  
**Brand Identity:** RELAY — Multi-Industry WhatsApp Automation SaaS  
**Visual System:** Midnight Slate (`#111827`) × Jade (`#0D9488` / `teal-600`) × Clean Surface (`#F5F7FA`, `#FFFFFF`)  
**Tagline:** ONE PLATFORM. EVERY BUSINESS.  
**Sub-positioning:** WhatsApp automation built around the way your business works.

---

## 1. Executive Summary

In SaaS Prompt 3, we engineered a customer-facing marketing website for Relay layered seamlessly around the existing 7-module authenticated application. The marketing frontend presents Relay as a multi-industry WhatsApp automation SaaS serving Real Estate, Gym & Fitness, Healthcare Clinics, Education, Salon & Beauty, Automobile Dealerships, and other modern businesses.

### Critical Safety Commitments Upheld:
1. **Zero Dashboard Regression:** The authenticated application and its 7 core modules (Overview, Contacts, Templates, Campaigns, Inbox & Auto-reply, Reports, Settings) were strictly preserved without modification to business logic.
2. **Backward Compatibility:** All existing bookmarks and deep-links (`/contacts`, `/templates`, `/campaigns`, `/inbox`, `/reports`, `/settings`, etc.) remain fully functional under `<ProtectedRoute><AppLayout>`, while new namespaced routes (`/app`, `/app/overview`, etc.) provide future-proof routing.
3. **No Unfinished Self-Serve Registrations:** Public self-serve account creation is deferred to SaaS Prompt 4. The `/signup` route acts as an Early Access registration priority queue, integrating directly with the secured `/api/public/contact` endpoint without creating partial or orphan database records.
4. **No Live Meta API Dispatch:** Meta WhatsApp Cloud API live message sending remains strictly blocked with a 403 status guard (reserved for Prompt 14).
5. **No Razorpay Charge Integration:** Real payment checkout is deferred to Prompt 11. Proposed introductory launch pricing (₹0 Mock Sandbox, ₹799/mo Relay Solo) is clearly disclosed as subject to final business owner confirmation.
6. **Separated Billing Model:** Relay platform subscription charges are clearly distinguished from Meta WhatsApp per-conversation charges, which are settled directly between the customer and Meta with zero markup from Relay.

---

## 2. Route Architecture & Directory Organization

### Public Marketing Routes (`MarketingLayout`)
| Path | Component | Description |
| :--- | :--- | :--- |
| `/` | `HomePage.jsx` | Hero with interactive tabbed product preview, 6 core capabilities, 7-industry showcase, 6-step journey, coexistence vs dedicated Cloud API breakdown, tenant data isolation, and final CTA. |
| `/features` | `FeaturesPage.jsx` | In-depth breakdown of all 6 modules: Contact Management, Template Studio, Campaign Management, Unified Inbox, Auto-Reply Automation, and Analytics Reporting. |
| `/industries` | `IndustriesPage.jsx` | Multi-industry hub comparing shared core capabilities and industry-specific workflows across all 7 categories. |
| `/industries/:slug` | `IndustryDetailPage.jsx` | Dynamic, tailored landing page for all 7 supported industries with custom hero metrics, feature deep-dives, use cases, keyword presets, and 404 guard for unknown slugs. |
| `/how-it-works` | `HowItWorksPage.jsx` | 6-step operational blueprint explaining workspace creation, Mock Mode sandbox, coexistence vs Cloud API setup, and customer-direct Meta billing. |
| `/pricing` | `PricingPage.jsx` | Proposed pricing tiers (Free Exploration ₹0, Relay Solo ₹799/mo, Agency Coming Soon), side-by-side capability breakdown, Meta vs Relay billing card, and pricing FAQs. |
| `/faq` | `FAQPage.jsx` | Searchable, categorized accordion addressing platform capabilities, WhatsApp connectivity, billing, Mock Mode, and compliance. |
| `/contact` | `ContactPage.jsx` | Accessible contact form submitting to `POST /api/public/contact` with honeypot bot trap, field validation, and confirmation reference IDs. |
| `/privacy` | `PrivacyPage.jsx` | Legal privacy disclosure detailing data controller/processor roles, multi-tenant database isolation, Meta API transmission, and STOP opt-out suppression. |
| `/terms` | `TermsPage.jsx` | Service agreement outlining Meta compliance obligations, prohibited spam activities, separated billing, and cancellation terms. |
| `/signup` | `SignupPage.jsx` | Early Access / Priority Queue onboarding shell reserving workspace slots without creating premature database accounts. |

### Authenticated Routes (`ProtectedRoute` + `AppLayout`)
- `/app` & `/app/overview` — Single-Operator Dashboard & KPIs
- `/app/contacts` & `/contacts` — Contact Directory & 5-Step Excel Import
- `/app/templates` & `/templates` — Template Studio & Brochure Uploads
- `/app/campaigns` & `/campaigns` — 4-Step Broadcast Campaign Stepper & Scheduling
- `/app/inbox` & `/inbox` — Unified 3-Panel Inbox & Keyword Automation Rules
- `/app/reports` & `/reports` — 5-Tab Operational & Consent Audit Analytics
- `/app/settings` & `/settings` — 6-Tab Business, Security & Developer Testing Center

---

## 3. Marketing Components Architecture

Located in `frontend/src/marketing/components/`:
- **`MarketingLayout.jsx`**: Global layout wrapper with `AnnouncementBar`, `MarketingNavbar`, `<Outlet/>`, and `MarketingFooter`.
- **`AnnouncementBar.jsx`**: Top banner highlighting Early Access preview and instant link to interactive Mock Mode sandbox.
- **`MarketingNavbar.jsx`**: Responsive navbar with desktop Product dropdown (6 modules), Industries dropdown (7 industries), How It Works, Pricing, FAQ, Contact, dynamic authenticated state detection ("Go to Dashboard" to `/app`), mobile drawer, and keyboard Escape listener.
- **`HeroSection.jsx`**: High-impact editorial hero with primary/secondary CTAs, trust chips, and responsive flex layout.
- **`HeroProductPreview.jsx`**: Interactive, tabbed product demonstration simulating real application workflows (Campaigns, Inbox, Templates, Analytics) with fictional data.
- **`CapabilitiesGrid.jsx`**: 6 core module capability cards with icons, realistic industry examples, and deep-links to `/features`.
- **`IndustriesShowcase.jsx`**: Responsive grid displaying all 7 supported industries with tailored taglines and flagship M2W badge.
- **`HowItWorksSteps.jsx`**: Visual 6-step timeline illustrating onboarding, mock exploration, Meta pairing, and analytics.
- **`ConnectionOptionsSection.jsx`**: Side-by-side comparison of WhatsApp Business App Coexistence vs Dedicated Cloud API.
- **`DataIsolationSection.jsx`**: Architectural explanation of multi-tenant MongoDB scoping and zero cross-tenant leakage.
- **`CTASection.jsx`**: Impactful final call-to-action with dual action buttons and satisfaction guarantees.
- **`MarketingFooter.jsx`**: Comprehensive 5-column footer with brand overview, product links, 7 industry links, legal links, and copyright notice.

---

## 4. Public Backend API Addition

### `POST /api/public/contact`
To support genuine public inquiries and Early Access registrations without granting anonymous access to workspace collections or creating orphan user accounts, a secure public endpoint was mounted at `/api/public/contact`:

- **Model:** `PublicEnquiry.js`
  - Fields: `fullName`, `businessEmail`, `businessName`, `industry`, `contactReason`, `phone`, `message`, `ipHash`, `status`, `createdAt`.
  - Stored in a separate, isolated collection (`public_enquiries`) with strict indexes.
- **Controller:** `publicContactController.js`
  - Email format normalization (`cleanEmail.toLowerCase().trim()`).
  - Strict length limits: Name (120 chars), Email (254 chars), Business (160 chars), Message (2,000 chars).
  - SHA-256 IP address hashing for privacy-preserving rate limiting.
- **Security & Rate Limiting:**
  - Protected by `express-rate-limit`: max 10 requests per 15-minute window per IP.
  - Honeypot form parameter (`honeypot`) silently traps automated spam bots without executing database writes.

---

## 5. Verification & Test Coverage Summary

- **Frontend Tests (`frontend/test/`):** **82 / 82 passing (0 failures)**
  - `saasPrompt3Website.test.js`: 9 comprehensive tests covering public route architecture, 7 industry configurations, pricing truthfulness, FAQ coverage, navbar interactions, contact form API integration, signup shell boundaries, and legal privacy/terms.
  - All 73 legacy frontend unit & integration tests passing with zero regressions.
- **Backend Tests (`backend/test/`):** **220 / 220 passing (0 failures)**
  - `publicContact.test.js`: 4 automated tests verifying valid submissions, invalid email rejections, missing required field rejections, and safe defaulting.
  - All 216 existing backend tests passing (including Prompt 1 multi-tenant authorization, Prompt 2 M2W migration, and legacy controllers).
- **Vite Production Build:** Successfully built 2,470 modules with zero bundling errors.
