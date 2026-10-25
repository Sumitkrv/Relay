# RELAY — CODE STYLE & ARCHITECTURAL CONVENTIONS
## Engineering Standards, Patterns, Naming Conventions & Anti-Patterns

> **Document Version:** 1.0.0 (Master Engineering Style Guide)  
> **Status:** Active / Source of Truth  
> **Target Audience:** Core Engineers & AI Coding Agents  
> **Repository Root:** `/Users/sumitthakur/Desktop/Relay`  

---

## 1. Core Engineering Principles

1. **Simplicity over Over-Engineering:** Prefer readable, deterministic vanilla React and Express patterns over complex state abstraction layers or heavy meta-frameworks.
2. **Strict Multi-Tenant Awareness:** Every backend controller and database query must respect workspace boundaries (`req.workspaceId`).
3. **No Phantom State:** Client-side state must reflect genuine MongoDB data. Never manufacture mock arrays or optimistic success states if the backend call fails.
4. **Preserve Legacy Coexistence:** When refactoring or fixing UI bugs, maintain backwards-compatible route aliases, CSS classes, and legacy model fields.

---

## 2. Directory & File Organization

```
Relay/
├── backend/
│   └── src/
│       ├── config/        # Database connection, constants, environment setup
│       ├── controllers/   # HTTP handlers (e.g. contactController.js)
│       ├── middleware/    # Auth, workspace guards, validation, errors
│       ├── models/        # Mongoose schemas (e.g. Contact.js, MessageTemplate.js)
│       ├── routes/        # Route declarations (e.g. contactRoutes.js)
│       ├── services/      # Reusable business logic (e.g. messageQueueService.js)
│       └── utils/         # Helper utilities (phone normalization, regex, tokens)
└── frontend/
    └── src/
        ├── components/    # Reusable shared UI widgets (Modals, Breadcrumbs, ErrorBoundary)
        ├── context/       # Global React Contexts (AuthContext.jsx, WorkspaceContext.jsx)
        ├── layout/        # Application shell (AppLayout.jsx, appShell.css, shellRoutes.js)
        ├── marketing/     # Public SaaS marketing pages & layout
        ├── pages/         # Primary application screens (Dashboard.jsx, ContactsPage.jsx, TemplatesPage.jsx)
        ├── services/      # Axios API client modules (contacts.js, templates.js, campaigns.js)
        └── utils/         # Pure formatting helpers (dates, currency, media resolution)
```

---

## 3. Naming Conventions

| Entity | Convention | Example |
|---|---|---|
| **React Components** | `PascalCase` | `TemplatesPage.jsx`, `ContactFormModal.jsx` |
| **Custom React Hooks** | `camelCase` (prefixed with `use`) | `useWorkspace()`, `useAuth()`, `useIsDesktop()` |
| **Mongoose Models** | `PascalCase` (Singular) | `MessageTemplate.js`, `WorkspaceMembership.js` |
| **Controllers & Services** | `camelCase` (descriptive suffix) | `campaignController.js`, `reportService.js` |
| **Route Modules** | `camelCase` (prefixed with domain) | `campaignRoutes.js`, `inboxRoutes.js` |
| **Constants / Enums** | `UPPER_SNAKE_CASE` | `LEAD_STATUSES`, `VALID_INDUSTRIES`, `NAV_GROUPS` |
| **CSS Class Names** | `kebab-case` (namespaced) | `.rs-shell`, `.tp-editor-panel`, `.cp-wizard-step` |

---

## 4. Frontend Conventions (React 18 & CSS)

### 4.1 Component Structure & Lifecycle
- **Functional Components:** Always write functional components with standard React Hooks. Class components are prohibited except for `ErrorBoundary.jsx`.
- **Import Order:**
  1. Core React and routing (`react`, `react-router-dom`).
  2. Third-party UI libraries and icons (`lucide-react`, `recharts`, `react-hot-toast`).
  3. Context hooks (`useAuth`, `useWorkspace`).
  4. Services and API utilities (`api.js`, `templates.js`).
  5. Shared components (`Breadcrumbs`, `Modal`).
  6. Stylesheets and CSS modules (`import './templates.css'`).

```javascript
// Example: Standard Component Import Pattern
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Files, Plus, Search, Filter } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { listTemplates, createTemplate } from '../services/templates';
import Breadcrumbs from '../components/Breadcrumbs';
import './templates.css';

export default function TemplatesPage() {
  // 1. Hooks & Context
  const { currentWorkspace } = useWorkspace();
  const navigate = useNavigate();

  // 2. Local State
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  // 3. Callbacks & Effects
  const loadData = useCallback(async () => {
    // ...
  }, [currentWorkspace?._id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 4. Render
  return (
    <div className="tp-workspace">
      {/* ... */}
    </div>
  );
}
```

### 4.2 Styling & Layout Rules
- **CSS Namespacing:** To prevent global style leakage, each major module must namespace its class selectors:
  - App Shell: `.rs-*` (`.rs-sidebar`, `.rs-topbar`)
  - Templates Studio: `.tp-*` (`.tp-workspace`, `.tp-editor-panel`)
  - Contacts: `.ct-*` (`.ct-directory`, `.ct-table`)
  - Campaigns: `.cp-*` (`.cp-stepper`, `.cp-audience`)
  - Inbox: `.ib-*` (`.ib-thread`, `.ib-composer`)
- **Native Browser Zoom (100%):** Do not apply `zoom: 0.85` or `transform: scale()`. Layouts must adapt using CSS Grid (`minmax(0, 1fr)`) and Flexbox.
- **Scroll Container Containment:** In multi-panel screens (Templates Studio, Inbox), make the outer container `height: 100%; overflow: hidden;` and attach `overflow-y: auto;` to inner content panes. Footers and headers must dock cleanly without floating over inputs.

---

## 5. Backend Conventions (Node.js & Express)

### 5.1 Asynchronous Handlers & Error Forwarding
- Use `async/await` syntax for all asynchronous operations.
- Always wrap controller logic in `try/catch` and forward unhandled exceptions to `next(err)`:

```javascript
// Example: Standard Backend Controller Pattern
export async function getContacts(req, res, next) {
  try {
    const { page = 1, limit = 50, search, status } = req.query;
    const query = {
      workspaceId: req.workspaceId,
      isDeleted: { $ne: true }
    };

    if (status) query.leadStatus = status;
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const [records, total] = await Promise.all([
      Contact.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit)),
      Contact.countDocuments(query)
    ]);

    return res.status(200).json({
      success: true,
      data: records,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    next(err);
  }
}
```

### 5.2 Mongoose Schema Definitions
- Always define `timestamps: true` to generate automatic `createdAt` and `updatedAt` properties.
- Enforce `strict: 'throw'` or `strict: true` to reject unsupported fields.
- Include compound indexes for tenant-scoped lookups:
  ```javascript
  contactSchema.index({ workspaceId: 1, phoneNumber: 1 }, { unique: true });
  ```

---

## 6. Anti-Patterns & Prohibited Practices

| Anti-Pattern | Why It Is Prohibited | Acceptable Alternative |
|---|---|---|
| **Hardcoding Database IDs** | Breaks tenant portability and test isolation. | Resolve IDs dynamically from `req.workspaceId` or config. |
| **Direct External WhatsApp Calls** | Incurs real Meta API charges and risks number bans. | Route dispatches through `mockWhatsAppProvider.js`. |
| **Floating Overlapping Sticky Bars** | Covers form fields and breaks responsive scrolling. | Use flex containers with docked sticky footers. |
| **Arbitrary Seed Resets** | Deletes authentic M2W Realty demo data. | Perform additive, isolated migrations. |
| **Global CSS Overrides** | Causes regression across unrelated modules. | Scope CSS rules using feature namespaces (`.tp-*`). |
| **Swallowing Errors Silently** | Masks database failures and leaves UI in a corrupt state. | Propagate errors with truthful user notifications. |
