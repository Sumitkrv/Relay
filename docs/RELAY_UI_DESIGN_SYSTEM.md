# RELAY UI DESIGN SYSTEM SPECIFICATION
## Midnight Slate × Jade Edition (v1.0)

### 1. Overview & Product Scope
- **Product Name**: Relay — Real Estate WhatsApp Automation
- **Target Persona**: Single Business Owner operating a single WhatsApp Business number for property enquiry automation, contact follow-up, and outreach campaigns.
- **Visual Design Identity**: **Midnight Slate × Jade**
  - Modern, restrained B2B SaaS aesthetic (inspired by PayPerWA, Linear, Attio, and Intercom).
  - Premium, calm, trustworthy, functional, and uncluttered.
  - Zero cartoonish gradients, zero oversaturated colors, zero glowing outlines, zero artificial zoom scaling.
  - **100% Standard Browser Zoom**: Built entirely with native responsive CSS flexbox and grid, fluid column sizing (`minmax()`, `min-width: 0`), and strict responsive breakpoints.

---

### 2. Design Tokens & Color Palette

#### CSS Variables (`:root`)
```css
:root {
  /* Surface & Background */
  --color-bg: #F5F7FA;
  --color-surface: #FFFFFF;
  --color-surface-muted: #F8FAFC;
  --color-surface-subtle: #F1F5F9;

  /* Sidebar (Midnight Slate) */
  --color-sidebar: #111827;
  --color-sidebar-hover: #1F2937;
  --color-sidebar-active: #263A3E;
  --color-sidebar-text: #E5E7EB;
  --color-sidebar-text-muted: #9CA3AF;
  --color-sidebar-border: #1F2937;

  /* Brand & Primary (Jade / Deep Teal) */
  --color-primary: #0D9488;
  --color-primary-hover: #0F766E;
  --color-primary-active: #115E59;
  --color-primary-soft: #E6F6F3;
  --color-primary-border: #99F6E4;

  /* Typography & Neutral Colors */
  --color-text-primary: #111827;
  --color-text-secondary: #4B5563;
  --color-text-muted: #6B7280;
  --color-text-subtle: #9CA3AF;

  /* Borders & Dividers */
  --color-border: #E5E7EB;
  --color-border-strong: #D1D5DB;
  --color-border-subtle: #F3F4F6;

  /* Semantic Status Colors */
  --color-success: #16A34A;
  --color-success-soft: #DCFCE7;
  --color-success-border: #86EFAC;

  --color-warning: #D97706;
  --color-warning-soft: #FEF3C7;
  --color-warning-border: #FDE68A;

  --color-danger: #DC2626;
  --color-danger-soft: #FEE2E2;
  --color-danger-border: #FCA5A5;

  --color-info: #2563EB;
  --color-info-soft: #DBEAFE;
  --color-info-border: #93C5FD;

  /* Focus & Elevation */
  --color-focus: rgba(13, 148, 136, 0.28);
  --shadow-xs: 0 1px 2px rgba(17, 24, 39, 0.05);
  --shadow-sm: 0 1px 3px rgba(17, 24, 39, 0.08), 0 1px 2px rgba(17, 24, 39, 0.04);
  --shadow-md: 0 4px 6px -1px rgba(17, 24, 39, 0.08), 0 2px 4px -2px rgba(17, 24, 39, 0.05);
  --shadow-lg: 0 10px 15px -3px rgba(17, 24, 39, 0.08), 0 4px 6px -4px rgba(17, 24, 39, 0.03);
  --shadow-popover: 0 12px 30px rgba(17, 24, 39, 0.15);
}
```

---

### 3. Typography Scale & Hierarchy

| Element | Size | Weight | Line Height | Usage |
|---|---|---|---|---|
| **Page Title** | 28–30px | 700 | 1.25 | Primary page header (`h1`) |
| **Section Heading** | 17–19px | 600 | 1.35 | Panel and card group headers (`h2`, `h3`) |
| **KPI Value** | 26–28px | 700 | 1.2 | Key performance indicator numbers |
| **Body Text** | 14–15px | 400 / 500 | 1.5 | Standard paragraphs, modal descriptions |
| **Navigation Text** | 14px | 500 / 600 | 1.4 | Sidebar and topbar links |
| **Table Cell Text** | 13–14px | 400 / 500 | 1.4 | Primary table cell values |
| **Input Labels** | 13px | 600 | 1.4 | Form field labels |
| **Small / Badges** | 12–13px | 500 / 600 | 1.3 | Metadata, status badges, timestamps |
| **Eyebrow / Kicker**| 10–11px | 700 | 1.2 | Uppercase section kickers (`letter-spacing: 0.08em`) |

---

### 4. Layout Dimensions & 8pt Spacing Scale

- **Sidebar Width (Desktop Expanded)**: `252px`
- **Sidebar Width (Desktop Collapsed)**: `72px`
- **Topbar Height**: `68px`
- **Content Max Width**: `1440px` (centered with fluid gutters)
- **Gutters**:
  - Desktop: `28px–32px`
  - Tablet: `20px–24px`
  - Mobile: `16px`
- **Corner Radii**:
  - Cards: `12px`
  - Buttons & Inputs: `9px`
  - Status Badges / Pills: `9999px` (full pill)
  - Modals / Drawers: `14px`
- **Component Heights**:
  - Input Height: `40px–42px`
  - Button Height: `40px–42px` (Small button: `34px`)

---

### 5. Standard Component Specifications

#### A. AppShell & Navigation
- **Persistent Sidebar**: Dark midnight slate background (`#111827`).
- **Brand Wordmark**: `relay.` with jade dot (`#0D9488`) and subtitle `Real Estate Automation`.
- **Single-Operator Profile**: Displays Owner avatar, "Owner Workspace · Single Operator", with quick settings access.
- **Exact 7 Navigation Items**:
  1. Overview (`/`)
  2. Contacts (`/contacts`)
  3. Templates (`/templates`)
  4. Campaigns (`/campaigns`)
  5. Inbox & Auto-reply (`/inbox`)
  6. Reports (`/reports`)
  7. Settings (`/settings`)
- **Active Navigation Indicator**: Soft dark-teal background (`#263A3E`), jade icon & label accent (`#0D9488`).
- **Footer**: Collapse/Expand toggle, Sign Out button, and user summary.

#### B. PageHeader Component
- Standardized across all 7 pages:
  ```jsx
  <PageHeader
    eyebrow="YOUR WORKSPACE · CONTACTS"
    title="Contacts"
    subtitle="Manage your property enquiry contacts and follow-ups."
    actions={
      <>
        <button className="btn btn-secondary">Import Contacts</button>
        <button className="btn btn-primary">Add Contact</button>
      </>
    }
  />
  ```

#### C. Forms & Inputs
- Labels positioned above fields with `13px` font size and `600` weight.
- Focus-visible ring: `outline: none; border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--color-focus);`.
- Clear placeholder styling with `#9CA3AF`.

#### D. Tables
- Contained within `.table-container` with `overflow-x: auto; min-width: 0;`.
- Sticky/clean header row (`#F8FAFC`) with subtle bottom border (`#E5E7EB`).
- Row height: `48px–56px` with hover state (`#F8FAFC`).
- Truncation with tooltip/full title on long text fields.

#### E. Overlays (Modals & Drawers)
- Backdrop with subtle blur (`backdrop-filter: blur(2px); background: rgba(17, 24, 39, 0.5);`).
- Proper z-index layering (`z-index: 50` for modals, `z-index: 40` for drawers).
- Escape key support, click-outside dismissal, and clear close button.

---

### 6. Responsive Breakpoints & Rules (100% Standard Zoom)

1. **Large Desktop (1440px+)**:
   - Sidebar expanded (`252px`), 4 KPI columns, 3-panel workspace for Inbox & Templates.
2. **Standard Desktop (1280px–1439px)**:
   - Sidebar expanded (`252px`), 4 KPI columns, 3-panel workspace with responsive panel flexibility.
3. **Compact Laptop (1024px–1279px)**:
   - Sidebar collapsible to `72px`, 2–4 KPI columns, Templates Preview in collapsible drawer/tab, Inbox Contact details behind drawer toggle.
4. **Tablet (768px–1023px)**:
   - Sidebar collapses or renders as slide-over drawer; 2 KPI columns; tables scroll horizontally within card.
5. **Mobile (<768px)**:
   - Slide-over drawer navigation, 1–2 KPI columns, single-panel segmented Inbox navigation (List <-> Conversation), full-width modals.

---

### 7. Accessibility & Strict Quality Gates
- **Keyboard Navigation**: All interactive elements have accessible `:focus-visible` states (`box-shadow: 0 0 0 3px var(--color-focus)`).
- **Color Contrast**: Foreground/background pairings meet WCAG AA (4.5:1 for normal text, 3:1 for large text).
- **Reduced Motion**: All animations respect `@media (prefers-reduced-motion: reduce)` with instantaneous fallback.
- **Zero Real Sending**: Mock mode safeguards clearly communicated on every screen without fabricating Meta delivery metrics.

---

### 8. Visual Regression & Quality Assurance Checklist

Every screen and component in Relay Real Estate Automation must satisfy this checklist prior to release:

1. **100% Standard Browser Zoom**:
   - [x] Zero global `zoom: 0.9` or `transform: scale(0.9)` artificial scaling hacks.
   - [x] All layouts use fluid flexbox, `minmax(0, 1fr)`, and `min-width: 0` on flex items.
   - [x] Zero horizontal page overflow (`scrollWidth === clientWidth`) across 1440x900, 1366x768, 1280x800, 1024x768, 768x1024, 390x844, and 320x700.
2. **Layout & Collision Checks**:
   - [x] Inbox search and filter controls must NEVER overlap or collide. Less-frequent filters reside in popover/drawer.
   - [x] Template Studio retains comfortable reading width on Desktop and collapses Preview into drawer on narrow screens.
   - [x] Overview KPI cards limited to exact 4 metrics (Total Contacts, Verified Opted-in, Scheduled/Active, Verified Customer Replies [0 · Mock Mode]).
   - [x] Campaigns page limits primary metrics to 4 cards + compact status row; eliminates scattered 11 metrics.
   - [x] Reports page uses standard 220–260px chart containers; zero giant blank charts.
   - [x] Settings tabs navigate correctly via deep link (`/settings#security`, `/settings#profile`, `/settings#integrations`, etc.) and render ONLY the active panel.
3. **Data Integrity & Safety**:
   - [x] All 53 MongoDB collections preserved. Zero database resets or destructive migrations.
   - [x] Internal backend routes and controllers preserved without unnecessary API rewrites.
   - [x] WhatsApp Cloud API kept safely in Mock Mode without live outbound delivery.
4. **Interactive Overlays**:
   - [x] Modals render on top of headers (`z-index: 50`), support `Escape` key close, and fit within mobile viewport.
   - [x] Dropdown menus and date pickers stay within viewport boundaries.

---

### 9. Automated Viewport & Browser Zoom Verification Matrix

| Route | 1440x900 | 1366x768 | 1280x800 | 1024x768 | 768x1024 | 390x844 | 320x700 | 90% Zoom | 100% Zoom | 110% Zoom | 125% Zoom |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Overview (`/`)** | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| **Contacts (`/contacts`)** | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| **Templates (`/templates`)**| PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| **Campaigns (`/campaigns`)**| PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| **Inbox (`/inbox`)** | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| **Reports (`/reports`)** | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| **Settings (`/settings`)** | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| **Settings Security (`/settings#security`)** | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |

*All 38 viewport screenshots and CDP zoom captures verified in `docs/screenshots/` and `docs/screenshots/zoom_levels/`.*

---

### 10. Rules for Future Prompts
1. Always import and use the centralized theme tokens from `frontend/src/theme/tokens.js` and CSS variables from `:root`.
2. Do NOT invent new page-specific color classes or ad-hoc button styles.
3. Every page MUST use `<PageHeader>` for consistent hierarchy.
4. Tables MUST be wrapped in `.table-wrap` / `.table-container` with `overflow-x: auto; min-width: 0`.
5. Maintain single-operator real estate scope: never introduce multi-tenant agency billing, team seat management, or generic freelance CRM copy.

