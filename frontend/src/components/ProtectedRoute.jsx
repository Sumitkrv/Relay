import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, LogOut } from 'lucide-react';

export default function ProtectedRoute() {
  const { user, loading, authState, logout } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-4">
        <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold tracking-wide text-slate-300">Loading your workspace session...</p>
      </div>
    );
  }

  // Unauthenticated visitors redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Account restricted state
  if (authState === 'ACCOUNT_RESTRICTED') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-xl border border-slate-200">
          <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Account Access Restricted</h2>
          <p className="text-sm text-slate-600 mt-2">
            Your account status is currently <strong>{user.accountStatus}</strong>. Access to Relay workspaces has been temporarily restricted.
          </p>
          <div className="mt-6 pt-6 border-t border-slate-100 flex flex-col gap-3">
            <a
              href="mailto:support@relayautomation.io"
              className="w-full py-2.5 px-4 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors"
            >
              Contact Platform Support
            </a>
            <button
              type="button"
              onClick={logout}
              className="w-full py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Unverified users must verify email
  if (authState === 'EMAIL_VERIFICATION_REQUIRED') {
    return <Navigate to={`/verify-email?email=${encodeURIComponent(user.email)}`} replace />;
  }

  // Verified users without a workspace are redirected to the onboarding handoff boundary
  if (authState === 'AUTHENTICATED_NO_WORKSPACE') {
    return <Navigate to="/onboarding" replace />;
  }

  // Authenticated users with an active workspace proceed to dashboard modules
  return <Outlet />;
}
