# SaaS Frontend Authentication & User Experience Architecture
**Phase:** SaaS Prompt 4 of 15  
**Version:** 1.0.0  
**Scope:** React Auth Flows, Context Integration, Route Guards & UI Design System  

---

## 1. Frontend System Overview

The Relay frontend authentication system is engineered using React 18, React Router v6, Tailwind CSS, Lucide icons, and Axios. It implements a cohesive, accessible, commercial-grade authentication experience adhering strictly to the **Midnight Slate × Jade** design system.

### Key UX Principles
- **No False Success:** Forms only report success after receiving explicit 200/201 responses from the backend.
- **Progressive Disclosure:** Helpful password strength indicators appear dynamically as the user types without cluttering empty forms.
- **Smart Autofocus & Keyboard Flow:** Native form submit triggers on `Enter` keypress; inputs feature accessible `autocomplete` attributes (`name`, `email`, `new-password`, `current-password`).
- **Resilient Route Guards:** Client-side guards navigate users to their authoritative next step without infinite loops or flicker.

---

## 2. Route Architecture & Public Entry Points

| Route | Component | Access Level | Description |
|---|---|---|---|
| `/signup` | `SignupPage.jsx` | Public | Real customer registration with password meter, terms agreement, and verification-pending state. |
| `/login` | `AuthPage.jsx` | Public | Unified login with password toggle, forgot-password link, and unverified-email resend banner. |
| `/verify-email` | `VerifyEmailPage.jsx` | Public | Token processing page supporting verifying, success, expired, and resend states. |
| `/forgot-password` | `ForgotPasswordPage.jsx` | Public | Password recovery request with anti-enumeration feedback. |
| `/reset-password` | `ResetPasswordPage.jsx` | Public | Cryptographic password reset form with strength meter and confirmation validation. |
| `/onboarding` | `OnboardingHandoffPage.jsx` | Authenticated (No Workspace) | Route boundary for verified customers awaiting Prompt 5 business workspace wizard. |
| `/app/*` | `AppLayout.jsx` | Authenticated (With Workspace) | Existing 7-module business dashboard (Overview, Contacts, Templates, Campaigns, Inbox, Reports, Settings). |

---

## 3. AuthContext State Machine

```
                            ┌─────────────────────┐
                            │    AUTH_LOADING     │
                            └──────────┬──────────┘
                                       │ (Initial /api/auth/me)
                     ┌─────────────────┴─────────────────┐
                     ▼                                   ▼
          ┌───────────────────────┐            ┌────────────────────┐
          │    UNAUTHENTICATED    │            │   AUTHENTICATED    │
          └───────────────────────┘            └─────────┬──────────┘
                                                         │
                        ┌────────────────────────────────┼────────────────────────────────┐
                        ▼                                ▼                                ▼
            ┌────────────────────────┐      ┌─────────────────────────┐      ┌─────────────────────────┐
            │   EMAIL_VERIFICATION   │      │    AUTHENTICATED_NO     │      │   AUTHENTICATED_WITH    │
            │        REQUIRED        │      │        WORKSPACE        │      │        WORKSPACE        │
            └───────────┬────────────┘      └────────────┬────────────┘      └────────────┬────────────┘
                        │                                │                                │
                        ▼                                ▼                                ▼
                 /verify-email                      /onboarding                          /app
```

### Context Methods Exported by `useAuth()`
- `register({ name, email, password, confirmPassword })`: Dispatches registration request; triggers verification pending view.
- `login(email, password)`: Authenticates credentials; returns `{ user, workspaces, hasWorkspace }`.
- `logout()`: Dispatches POST `/api/auth/logout`, clears session cookies and local storage, redirects to `/login`.
- `verifyEmail(token)`: Consumes cryptographic verification token and activates account.
- `resendVerification(email)`: Dispatches new verification link with rate-limiting cooldown.
- `forgotPassword(email)`: Requests password reset email with anti-enumeration feedback.
- `resetPassword({ token, newPassword, confirmPassword })`: Submits new password; invalidates prior sessions.
- `refreshUser()`: Silently re-syncs user profile and workspace permissions from `/api/auth/me`.

---

## 4. ProtectedRoute Enforcement Engine

`frontend/src/components/ProtectedRoute.jsx` acts as the client-side router guardian:
```javascript
export default function ProtectedRoute({ children }) {
  const { authState, loading, hasWorkspace, user } = useAuth();

  if (loading) {
    return <FullScreenLoadingSpinner message="Checking authentication..." />;
  }

  if (authState === 'UNAUTHENTICATED') {
    return <Navigate to="/login" replace />;
  }

  if (authState === 'EMAIL_VERIFICATION_REQUIRED') {
    return <Navigate to={`/verify-email?email=${encodeURIComponent(user?.email || '')}`} replace />;
  }

  if (authState === 'ACCOUNT_RESTRICTED') {
    return <AccountRestrictedScreen user={user} />;
  }

  if (authState === 'AUTHENTICATED_NO_WORKSPACE' || !hasWorkspace) {
    return <Navigate to="/onboarding" replace />;
  }

  return children;
}
```

---

## 5. Design System: Midnight Slate × Jade Palette

All authentication pages adhere to Relay's premium visual tokens:

| Token Name | Hex Code | Usage |
|---|---|---|
| **Dark Slate** | `#111827` | Brand cards, primary buttons, high-contrast headings |
| **Slate Gray** | `#1E293B` | Secondary dark surfaces, borders |
| **Jade / Teal Primary** | `#0D9488` | Active focus rings, brand accents, verification badges |
| **Jade Dark Hover** | `#0F766E` | Button hover states |
| **Canvas Background** | `#F8FAFC` | Page backgrounds |
| **Card Surface** | `#FFFFFF` | Form containers with `shadow-xl` and `rounded-3xl` |
| **Muted Text** | `#64748B` | Field descriptions, helper labels, disclaimers |
| **Border Neutral** | `#E2E8F0` | Subtle form boundaries, dividers |
| **Error Red** | `#EF4444` | Form validation alerts and invalid fields |
| **Success Emerald** | `#10B981` | Verification confirmation and strong password indicators |
