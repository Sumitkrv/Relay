# RELAY SAAS 05 — INDUSTRY SELECTION & METADATA ARCHITECTURE

## 1. Overview

Relay is designed as a specialized, multi-industry WhatsApp Business automation platform. Step 2 of the onboarding wizard allows customers to select their primary operational vertical. This choice configures the business profile and sets the baseline for the upcoming **Industry Configuration Engine** (SaaS Prompt 6).

---

## 2. Supported Industry Verticals

The backend defines a strict server-side whitelist of 7 supported industry keys:

```javascript
export const VALID_INDUSTRIES = [
  'real_estate',
  'gym',
  'clinic',
  'education',
  'salon',
  'automobile',
  'other',
];
```

### Vertical Specifications

| Key | Industry Name | Description | Key Capabilities Highlighted in Onboarding |
|---|---|---|---|
| `real_estate` | Real Estate & Housing | Properties, site visits & buyer qualification | Project launches, floor plans, automated site visit booking |
| `gym` | Fitness & Wellness | Membership inquiries, trial sessions & renewals | Trial booking, class schedules, renewal reminders |
| `clinic` | Healthcare & Clinics | Consultations, appointments & clinic hours | OPD timings, doctor schedules, booking confirmations |
| `education` | Education & Coaching | Admissions, courses & batch updates | Syllabus PDFs, batch timings, fee reminders |
| `salon` | Salons & Personal Care | Beauty services, appointments & rate cards | Service menus, booking reminders, stylist availability |
| `automobile` | Automotive & Dealerships | Vehicle inquiries, test drives & service booking | Test drive scheduling, model brochures, service reminders |
| `other` | Professional Services | Custom customer workflows & inquiries | Versatile lead capture, automated replies, business catalogs |

Any attempt to submit arbitrary JavaScript objects, unexpected keys, or non-whitelisted strings results in an HTTP `400 INVALID_INDUSTRY` rejection.

---

## 3. Dynamic Business Details (Step 3)

Step 3 dynamically renders tailored, lightweight field groups based on the selected vertical:
- **`real_estate`**: Primary operating city, property types (Apartments, Villas, Commercial, Plots), project focus.
- **`gym`**: Facility type (Fitness Center, Crossfit Box, Yoga Studio), primary programs.
- **`clinic`**: Clinic specialization, operating hours.
- **`education`**: Institution type, course categories, learning mode (In-person, Online, Hybrid).
- **`salon`**: Main services, stylist count, working hours.
- **`automobile`**: Dealership type (New Cars, Pre-owned, 2-Wheeler, Service Center), vehicle brands.
- **`other`**: Service description, operating hours.

---

## 4. Metadata Sanitization & Prototype Pollution Defense

Onboarding metadata is validated and sanitized on every draft save (`PUT /api/onboarding/draft`):

```javascript
export function sanitizeMetadata(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const clean = {};
  for (const [key, value] of Object.entries(raw)) {
    // Prevent prototype pollution and NoSQL operator injection
    if (
      key === '__proto__' ||
      key === 'constructor' ||
      key === 'prototype' ||
      key.startsWith('$')
    ) {
      continue;
    }
    if (typeof value === 'string') {
      clean[key] = value.trim().slice(0, 500);
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      clean[key] = value;
    } else if (Array.isArray(value)) {
      clean[key] = value
        .filter((item) => typeof item === 'string')
        .map((item) => item.trim().slice(0, 100))
        .slice(0, 20);
    }
  }
  return clean;
}
```

This defense ensures that:
- Object prototype chains cannot be polluted.
- MongoDB query selectors (`$gt`, `$ne`, `$where`) cannot be injected into subdocuments.
- Array sizes and string lengths are bounded to prevent memory consumption attacks.

---

## 5. Clean Handoff to SaaS Prompt 6

SaaS Prompt 6 will implement the full **Industry Configuration Engine**. Prompt 5 establishes the foundational handoff by securely persisting:
1. `workspace.industryKey`: Authoritative vertical identifier.
2. `draft.industryKey`: Persisted selection across draft edits.
3. `workspace.onboardingStatus`: Set to `COMPLETED`, allowing Prompt 6 to identify workspaces ready for automated industry template, tag, and keyword preset initialization.
