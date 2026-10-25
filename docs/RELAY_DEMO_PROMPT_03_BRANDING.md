# RELAY DEMO PROMPT 3: INDEPENDENT WORKSPACE BRANDING & LOGO MANAGEMENT

## 1. Independent Business Identities
Each of the three demo businesses possesses an independent, distinct business profile and branding configuration:

| Business | Industry | Slug | Primary Brand Mark | Brand Text in Sidebar | Initials Fallback |
|---|---|---|---|---|---|
| **M2W Realty** | Real Estate | `m2w-realty` | Official `/logo.png` | `M2W Realty.` · WhatsApp Automation | `MR` |
| **FitZone Gym** | Gym / Fitness | `fitzone-gym` | Custom uploaded logo or `FG` initials badge | `FitZone Gym.` · Gym | `FG` |
| **CarePlus Clinic** | Clinic | `careplus-clinic` | Custom uploaded logo or `CC` initials badge | `CarePlus Clinic.` · Clinic | `CC` |

## 2. Root Cause Analysis: Broken Logo Box Elimination
Previous screenshots exhibited an empty or broken white square in FitZone Gym and CarePlus Clinic.
### Root Causes:
1. `AppLayout.jsx` had `const isM2W = !currentWorkspace || currentWorkspace.slug === 'm2w-realty'`. During the initial async loading interval before `currentWorkspace` resolved, `!currentWorkspace` evaluated to `true`, mistakenly attempting to render `/logo.png` and "M2W Realty".
2. When the custom image failed to load or was absent, an `<img src={null}>` or broken asset URL produced the browser's default broken image placeholder inside a white frame.
3. `SettingsPage.jsx` had static references to `/logo.png` and "M2W Realty · Single Operator Owner".

### Resolution:
1. `isM2W` logic refined to strictly verify `currentWorkspace ? currentWorkspace.slug === 'm2w-realty' : (user?.businessName?.includes('M2W') ?? false)`.
2. Implemented intelligent initials generation: multi-word names are parsed to extract first-letter initials (e.g., "FitZone Gym" $\rightarrow$ `FG`, "CarePlus Clinic" $\rightarrow$ `CC`, "M2W Realty" $\rightarrow$ `MR`).
3. Added automated `logoFailed` fallback state with a `useEffect` resetting on workspace ID changes.
4. If a custom logo exists, it is loaded via `resolveMediaUrl(logoUrl)`. If absent, a crisp gradient initials badge (`#0F766E` to `#0D9488` with `#FFFFFF` text) renders cleanly without broken image icons.

## 3. Logo Upload & Removal Architecture
- **Upload Endpoint:** `POST /api/settings/logo`
  - Accepts `multipart/form-data` with field `logo`.
  - Max file size: 2MB.
  - Allowed MIME types: `image/png`, `image/jpeg`, `image/webp`.
  - Storage location: `uploads/logos/` with sanitized timestamp-prefixed filenames.
  - Updates both `BusinessProfile.logoUrl` and `Workspace.logoUrl`.
- **Remove Endpoint:** `DELETE /api/settings/logo`
  - Clears `logoUrl` in `BusinessProfile` and `Workspace`, instantly restoring the initials avatar.
- **Frontend UI:** Interactive "Upload Logo" / "Replace Logo" and "Remove" controls directly in Settings > Business Profile tab.
