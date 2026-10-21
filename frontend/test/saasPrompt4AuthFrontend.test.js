import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('SaaS Prompt 4 — 1. Route Registry & Public Auth Routes in App.jsx', () => {
  const appPath = path.resolve(__dirname, '../src/App.jsx');
  const code = fs.readFileSync(appPath, 'utf8');

  // Verify all essential authentication and onboarding routes exist
  assert.ok(code.includes('/signup'), 'App.jsx must declare /signup route');
  assert.ok(code.includes('/login'), 'App.jsx must declare /login route');
  assert.ok(code.includes('/verify-email'), 'App.jsx must declare /verify-email route');
  assert.ok(code.includes('/forgot-password'), 'App.jsx must declare /forgot-password route');
  assert.ok(code.includes('/reset-password'), 'App.jsx must declare /reset-password route');
  assert.ok(code.includes('/onboarding'), 'App.jsx must declare /onboarding route');

  // Verify component imports
  assert.ok(code.includes('VerifyEmailPage'), 'App.jsx must import VerifyEmailPage');
  assert.ok(code.includes('ForgotPasswordPage'), 'App.jsx must import ForgotPasswordPage');
  assert.ok(code.includes('ResetPasswordPage'), 'App.jsx must import ResetPasswordPage');
  assert.ok(code.includes('OnboardingHandoffPage'), 'App.jsx must import OnboardingHandoffPage');
});

test('SaaS Prompt 4 — 2. AuthContext API Surface & State Machine', () => {
  const authContextPath = path.resolve(__dirname, '../src/context/AuthContext.jsx');
  const code = fs.readFileSync(authContextPath, 'utf8');

  // Must export AuthProvider and useAuth
  assert.ok(code.includes('export function AuthProvider'), 'Must export AuthProvider');
  assert.ok(code.includes('export function useAuth') || code.includes('export const useAuth'), 'Must export useAuth');

  // Must define complete customer auth lifecycle methods
  assert.ok(code.includes('register ='), 'AuthContext must export register method');
  assert.ok(code.includes('login ='), 'AuthContext must export login method');
  assert.ok(code.includes('logout ='), 'AuthContext must export logout method');
  assert.ok(code.includes('verifyEmail ='), 'AuthContext must export verifyEmail method');
  assert.ok(code.includes('resendVerification ='), 'AuthContext must export resendVerification method');
  assert.ok(code.includes('forgotPassword ='), 'AuthContext must export forgotPassword method');
  assert.ok(code.includes('resetPassword ='), 'AuthContext must export resetPassword method');
  assert.ok(code.includes('refreshUser ='), 'AuthContext must export refreshUser method');

  // Must track workspace awareness
  assert.ok(code.includes('workspaces'), 'AuthContext must track authorized workspaces');
  assert.ok(code.includes('hasWorkspace'), 'AuthContext must track hasWorkspace boolean');
  assert.ok(code.includes('authState'), 'AuthContext must expose authoritative authState');
});

test('SaaS Prompt 4 — 3. ProtectedRoute Workspace & Verification Enforcement', () => {
  const protectedRoutePath = path.resolve(__dirname, '../src/components/ProtectedRoute.jsx');
  const code = fs.readFileSync(protectedRoutePath, 'utf8');

  // Must inspect verification and workspace states
  assert.ok(code.includes('EMAIL_VERIFICATION_REQUIRED') || code.includes('/verify-email'), 'Must redirect unverified users');
  assert.ok(code.includes('AUTHENTICATED_NO_WORKSPACE') || code.includes('/onboarding'), 'Must direct accounts without workspace to /onboarding');
  assert.ok(code.includes('ACCOUNT_RESTRICTED') || code.includes('Restricted') || code.includes('Suspended'), 'Must handle suspended accounts');
  assert.ok(code.includes('/login'), 'Must redirect unauthenticated users to /login');
});

test('SaaS Prompt 4 — 4. SignupPage Real Customer Registration UI', () => {
  const signupPath = path.resolve(__dirname, '../src/marketing/pages/SignupPage.jsx');
  const code = fs.readFileSync(signupPath, 'utf8');

  // Must have name, email, password, confirmPassword
  assert.ok(code.includes('name="name"'), 'SignupPage must contain name input');
  assert.ok(code.includes('name="email"'), 'SignupPage must contain email input');
  assert.ok(code.includes('name="password"'), 'SignupPage must contain password input');
  assert.ok(code.includes('name="confirmPassword"'), 'SignupPage must contain confirmPassword input');
  assert.ok(code.includes('agreeToTerms'), 'SignupPage must require agreement to terms and privacy');

  // Password security & UI
  assert.ok(code.includes('passwordStrength'), 'SignupPage must include password strength calculation');
  assert.ok(code.includes('showPassword'), 'SignupPage must include password visibility toggle');
  assert.ok(code.includes('registeredEmail'), 'SignupPage must support verification pending screen');
  assert.ok(code.includes('handleResend') || code.includes('resendVerification'), 'SignupPage must offer resend action');
});

test('SaaS Prompt 4 — 5. AuthPage Login & Post-Login Redirection Logic', () => {
  const authPath = path.resolve(__dirname, '../src/pages/AuthPage.jsx');
  const code = fs.readFileSync(authPath, 'utf8');

  // Inputs and controls
  assert.ok(code.includes('type="email"'), 'AuthPage must contain email input');
  assert.ok(code.includes('name="password"') && (code.includes('type={show ?') || code.includes('type={showPassword')), 'AuthPage must contain password input with toggle');
  assert.ok(code.includes('/forgot-password'), 'AuthPage must link to /forgot-password');
  assert.ok(code.includes('/signup'), 'AuthPage must link to /signup');

  // Verification handling and post-login routing
  assert.ok(code.includes('EMAIL_NOT_VERIFIED') || code.includes('unverifiedEmail'), 'AuthPage must handle unverified account state');
  assert.ok(code.includes('/onboarding'), 'AuthPage must route new customers without workspace to /onboarding');
  assert.ok(code.includes('/app'), 'AuthPage must route authorized workspace owners to /app');
});

test('SaaS Prompt 4 — 6. VerifyEmailPage Token Validation & Resend Workflow', () => {
  const verifyPath = path.resolve(__dirname, '../src/pages/VerifyEmailPage.jsx');
  const code = fs.readFileSync(verifyPath, 'utf8');

  // States handling
  assert.ok(code.includes('verifying'), 'VerifyEmailPage must handle verifying state');
  assert.ok(code.includes('success'), 'VerifyEmailPage must handle success state');
  assert.ok(code.includes('expired'), 'VerifyEmailPage must handle expired state');
  assert.ok(code.includes('already_used'), 'VerifyEmailPage must handle already consumed state');
  assert.ok(code.includes('resendVerification'), 'VerifyEmailPage must allow resending verification email');
  assert.ok(code.includes('/login'), 'VerifyEmailPage must link to /login');
});

test('SaaS Prompt 4 — 7. ForgotPasswordPage & ResetPasswordPage Security', () => {
  const forgotPath = path.resolve(__dirname, '../src/pages/ForgotPasswordPage.jsx');
  const forgotCode = fs.readFileSync(forgotPath, 'utf8');

  assert.ok(forgotCode.includes('forgotPassword'), 'ForgotPasswordPage must call forgotPassword API');
  assert.ok(forgotCode.includes('isSubmitted'), 'ForgotPasswordPage must show anti-enumeration success message');
  assert.ok(forgotCode.includes('/login'), 'ForgotPasswordPage must link back to login');

  const resetPath = path.resolve(__dirname, '../src/pages/ResetPasswordPage.jsx');
  const resetCode = fs.readFileSync(resetPath, 'utf8');

  assert.ok(resetCode.includes('resetPassword'), 'ResetPasswordPage must call resetPassword API');
  assert.ok(resetCode.includes('passwordStrength'), 'ResetPasswordPage must check password strength');
  assert.ok(resetCode.includes('confirmPassword'), 'ResetPasswordPage must validate confirm password');
  assert.ok(resetCode.includes('isSuccess'), 'ResetPasswordPage must track success state');
  assert.ok(resetCode.includes('/login'), 'ResetPasswordPage must link to login after reset');
});

test('SaaS Prompt 4 — 8. OnboardingHandoffPage Boundary & Zero Fake Workspace', () => {
  const onboardingPath = path.resolve(__dirname, '../src/pages/OnboardingHandoffPage.jsx');
  const code = fs.readFileSync(onboardingPath, 'utf8');

  // Truthful Prompt 5 handoff
  assert.ok(code.includes('Phase 5') || code.includes('Prompt 5') || code.includes('Business Setup'), 'Must describe business onboarding');
  assert.ok(code.includes('logout'), 'Must allow user to log out safely');
  assert.ok(!code.includes('createWorkspace'), 'Must not create a fake workspace in Prompt 4');
});
