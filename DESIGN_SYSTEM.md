# RELAY — DESIGN SYSTEM SPECIFICATION
## Midnight Navy × Electric Blue Edition (v2.0)

> **Document Version:** 2.0.0 (Master Visual & Component Standard)  
> **Target Application:** Relay SaaS (M2W Realty & Multi-Tenant Application Shell)  
> **Source Stylesheets:**  
> - Shell & Navigation: [`frontend/src/layout/appShell.css`](file:///Users/sumitthakur/Desktop/Relay/frontend/src/layout/appShell.css)  
> - Templates Studio: [`frontend/src/templates.css`](file:///Users/sumitthakur/Desktop/Relay/frontend/src/templates.css)  
> - Contacts Module: [`frontend/src/contacts.css`](file:///Users/sumitthakur/Desktop/Relay/frontend/src/contacts.css)  
> - Campaigns Module: [`frontend/src/campaigns.css`](file:///Users/sumitthakur/Desktop/Relay/frontend/src/campaigns.css)  
> - Inbox Module: [`frontend/src/inbox.css`](file:///Users/sumitthakur/Desktop/Relay/frontend/src/inbox.css)  
> - Reports Module: [`frontend/src/reports.css`](file:///Users/sumitthakur/Desktop/Relay/frontend/src/reports.css)  

---

## 1. Visual Philosophy & Design Identity

Relay embodies an enterprise-grade, high-productivity B2B SaaS aesthetic inspired by modern industry standards (Linear, Attio, Stripe, and Intercom).

### Core Principles
1. **Restraint & Clarity:** High information density without visual clutter. Clean 1px borders, subtle surface elevations, and deliberate whitespace.
2. **Deterministic Layouts:** Native browser zoom (100%) with CSS Grid (`minmax(0, 1fr)`) and Flexbox. Zero synthetic zoom transforms or arbitrary fixed-width breaks.
3. **Strict Color Semantics:** Color is used purposefully. **Midnight Navy** grounds structure and navigation; **Electric Blue** drives primary actions; neutral slates format readable text and borders.
4. **Namespaced Architecture:** Shell components use `.rs-*` prefixes, and modules use dedicated tokens (`.tp-*` for templates, `.cp-*` for campaigns, `.ib-*` for inbox) to eliminate CSS cross-contamination.

---

## 2. Core Color Palette & Design Tokens

### 2.1 Master Brand & Interface Colors
```css
:root {
  /* Surfaces & Backgrounds */
  --relay-bg: #F4F7FC;               /* Canvas page background */
  --relay-surface: #FFFFFF;          /* Primary white card background */
  --relay-surface-muted: #F8FAFC;    /* Subtle hover & secondary surface */
  --relay-surface-subtle: #F1F5F9;   /* Inset container / disabled surface */

  /* Navigation: Midnight Navy */
  --relay-navy-950: #0B1220;         /* Primary sidebar background */
  --relay-navy-900: #111C30;         /* Sidebar elevated surface */
  --relay-navy-800: #172554;         /* Active nav item background */
  --relay-navy-700: #26354C;         /* Sidebar border & divider */
  --relay-navy-hover: #14213A;       /* Sidebar link hover */

  /* Brand Action: Electric Blue */
  --relay-blue-600: #2563EB;         /* Primary brand accent & button */
  --relay-blue-700: #1D4ED8;         /* Button hover state */
  --relay-blue-800: #1E40AF;         /* Active / pressed state */
  --relay-blue-500: #3B82F6;         /* Highlight borders */
  --relay-blue-400: #60A5FA;         /* Rail indicator bar */
  --relay-blue-100: #DBEAFE;         /* Pill & active text */
  --relay-blue-50:  #EFF6FF;         /* Selection tint / active card */

  /* Typography & Slate Neutrals */
  --relay-text-primary: #0F172A;     /* Primary headings and body */
  --relay-text-secondary: #64748B;   /* Subtitles, labels, helpers */
  --relay-text-muted: #94A3B8;       /* Meta notes, placeholders */
  --relay-sidebar-text: #E2E8F0;     /* Sidebar readable white-slate */
  --relay-sidebar-muted: #94A3B8;    /* Sidebar secondary labels */

  /* Borders & Dividers */
  --relay-border: #E2E8F0;          /* Standard 1px card/input border */
  --relay-border-strong: #CBD5E1;   /* Active / emphasized border */
  --relay-border-subtle: #F1F5F9;   /* Inset divider */

  /* Semantic Status Colors */
  --relay-success: #16A34A;         /* Verified, Active, Approved */
  --relay-success-bg: #DCFCE7;
  --relay-warning: #D97706;         /* Pending, Needs Review, Scheduled */
  --relay-warning-bg: #FEF3C7;
  --relay-danger: #DC2626;          /* Opted-Out, Rejected, Error */
  --relay-danger-bg: #FEE2E2;
  --relay-info: #2563EB;            /* Mock Mode, Information */
  --relay-info-bg: #DBEAFE;

  /* Shadows & Elevations */
  --relay-shadow-sm: 0 1px 3px rgba(11, 18, 32, 0.04), 0 1px 2px rgba(11, 18, 32, 0.02);
  --relay-shadow-md: 0 4px 6px -1px rgba(11, 18, 32, 0.05), 0 2px 4px -2px rgba(11, 18, 32, 0.03);
  --relay-shadow-lg: 0 10px 15px -3px rgba(11, 18, 32, 0.08), 0 4px 6px -4px rgba(11, 18, 32, 0.04);
}
```

---

## 3. Typography Scale & Hierarchy

Fonts: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif.

| Element | Font Size | Font Weight | Line Height | Color | Usage |
|---|---|---|---|---|---|
| **Page Title** | 26–28px | 700 (Bold) | 1.25 | `#0F172A` | Page header (`h1`), e.g., "Message Templates Studio" |
| **Section Heading** | 16–18px | 600 (Semi-bold) | 1.35 | `#0F172A` | Card & panel titles (`h2`, `h3`) |
| **KPI Metric** | 26–30px | 700 (Bold) | 1.2 | `#0F172A` | Large numeric dashboard indicators |
| **Body Primary** | 14–15px | 400 (Regular) | 1.5 | `#0F172A` | Standard body text, textarea content |
| **Body Medium** | 13–14px | 500 (Medium) | 1.45 | `#0F172A` | Navigation links, table primary cells |
| **Form Label** | 12.5–13px | 600 (Semi-bold) | 1.4 | `#334155` | Input labels, radio headers |
| **Helper / Caption** | 12–12.5px | 400 (Regular) | 1.4 | `#64748B` | Helper instructions, character counters |
| **Badge / Pill** | 11.5–12px | 600 (Semi-bold) | 1.3 | Semantic | Status chips (Approved, Pending, Opted-In) |
| **Eyebrow / Kicker** | 10.5–11px | 700 (Bold) | 1.2 | `#64748B` | Uppercase category kickers (`letter-spacing: 0.05em`) |

---

## 4. Component Standards

### 4.1 Buttons
- **Primary Button:** Electric Blue (`background: #2563EB; color: #FFFFFF; font-weight: 600; border-radius: 9px;`). Hover: `#1D4ED8`. Active: `#1E40AF`. Focus: 3px ring `rgba(37, 99, 235, 0.3)`.
- **Secondary Button:** Surface White (`background: #FFFFFF; color: #0F172A; border: 1px solid #E2E8F0; border-radius: 9px;`). Hover: `#F8FAFC`.
- **Ghost / Link Button:** Transparent (`background: transparent; color: #2563EB; font-weight: 500;`). Hover: underline or subtle background tint.
- **Danger Button:** Red Soft or Solid (`background: #DC2626; color: #FFFFFF;` or `background: #FEE2E2; color: #DC2626;`).
- **Standard Heights:** Standard control: `38px–40px`. Compact table/list action: `32px–34px`.

### 4.2 Form Controls & Inputs
- **Height & Spacing:** Standard `38px–40px` with `padding: 8px 12px;`.
- **Borders & Radii:** `border: 1px solid #E2E8F0; border-radius: 8px; font-size: 13.5px;`.
- **Focus State:** `border-color: #2563EB; outline: none; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);`.
- **Error State:** `border-color: #DC2626; box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.15);`.
- **Textarea:** Min height `120px`, `line-height: 1.5`, monospace-capable for token variable insertion.

### 4.3 Cards & Panels
- **Container:** `background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; box-shadow: var(--relay-shadow-sm);`.
- **Padding:** Standard cards use `20px–24px` internal padding. Dense studio panels use `16px–20px`.
- **Header Structure:** Border-bottom `1px solid #E2E8F0` separating panel title and action buttons from content.

### 4.4 Data Tables
- **Header:** Sticky or static, `background: #F8FAFC; border-bottom: 1px solid #E2E8F0; font-size: 12px; font-weight: 600; text-transform: uppercase; color: #64748B;`.
- **Row:** `background: #FFFFFF; border-bottom: 1px solid #F1F5F9; font-size: 13.5px; transition: background 120ms;`. Hover: `#F8FAFC`.
- **Cell Spacing:** `padding: 12px 16px; vertical-align: middle;`.

### 4.5 Modals & Slide-out Drawers
- **Backdrop Scrim:** `background: rgba(11, 18, 32, 0.6); backdrop-filter: blur(2px); z-index: 50;`.
- **Centered Dialog:** Max width `560px–680px`, `border-radius: 14px`, `background: #FFFFFF`, focus-trapped, dismissible via Escape and backdrop click.
- **Detail Drawer:** Right-docked, width `480px–640px`, full height `100vh`, smooth slide-in transform (`translateX(0)`), independent vertical scroll.

---

## 5. Application Shell Architecture

```
+-----------------------------------------------------------------------------------------+
|                                    APP TOPBAR (68px)                                   |
| [Menu] [Breadcrumbs: Workspace > Templates]         [Readiness Chip] [Bell (3)] [Avatar]|
+-----------------------+-----------------------------------------------------------------+
|   SIDEBAR (252px)     |                         PAGE CONTENT CANVAS                     |
|  Midnight Navy        |                         Background: #F4F7FC                     |
|  --rs-nav-base        |                                                                 |
|                       |                                                                 |
|  [Relay Brand Mark]   |                                                                 |
|  [Workspace Selector] |                                                                 |
|                       |                                                                 |
|  WORKSPACE            |                                                                 |
|  * Overview           |                                                                 |
|  * Contacts           |                                                                 |
|  * Templates (Active) |                                                                 |
|  * Campaigns          |                                                                 |
|  * Inbox & Auto-reply |                                                                 |
|                       |                                                                 |
|  MANAGEMENT           |                                                                 |
|  * Reports            |                                                                 |
|  * Settings           |                                                                 |
|                       |                                                                 |
|  [User Profile / Out] |                                                                 |
+-----------------------+-----------------------------------------------------------------+
```

- **Expanded Sidebar Width:** `252px`.
- **Collapsed Sidebar (Desktop Rail):** `72px` with hover tooltips fixed in position.
- **Topbar Height:** `68px` with sticky positioning (`z-index: 30`).
- **Active Navigation Indicator:** Electric Blue left bar (`width: 3px; background: #60A5FA;`), Navy tint (`#172554`), and light blue text (`#DBEAFE`).

---

## 6. Responsive Breakpoints

| Breakpoint Tier | Screen Range | Layout Behavior |
|---|---|---|
| **Large Desktop** | $\ge 1440\text{px}$ | Full 3-panel studio layout (Library 260px, Editor 1fr, WhatsApp Preview 310px). |
| **Standard Desktop** | $1200\text{px} - 1439\text{px}$ | 3-panel layout maintained with fluid center editor (`minmax(0, 1fr)`). |
| **Laptop / Compact** | $1024\text{px} - 1199\text{px}$ | Preview collapses into slide-over drawer toggled via "Show Preview" button. |
| **Tablet Portrait** | $768\text{px} - 1023\text{px}$ | Segmented tab controls (`Library`, `Editor`, `Preview`) to provide 100% width workspaces. |
| **Mobile** | $< 768\text{px}$ | Sidebar transforms into slide-in drawer with backdrop scrim. Mobile tabs for multi-panel screens. |

---

## 7. Accessibility (A11y) & Usability

1. **Color Contrast:** All body text (`#0F172A`) on cards (`#FFFFFF`) exceeds WCAG AAA standards ($> 12:1$). Sidebar text (`#E2E8F0`) on Midnight Navy (`#0B1220`) exceeds $10:1$.
2. **Focus Visibility:** Interactive elements feature explicit `:focus-visible` styles with a 2px–3px tinted ring (`rgba(37, 99, 235, 0.4)`).
3. **Screen Readers:** ARIA attributes (`aria-current="page"`, `aria-expanded`, `aria-label`, `role="dialog"`) are implemented on all navigation, modals, and collapsible panels.
4. **Keyboard Trapping:** Modals and mobile drawers trap `Tab`/`Shift+Tab` within the dialog and dismiss on `Escape`.
