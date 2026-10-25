import React from 'react';
import { Navigate, Outlet, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export default function AdminProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-[#0D9488] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-[#667085]">Verifying platform administrator session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }

  if (!user.isPlatformAdmin) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-[#E5E7EB] p-8 text-center">
          <div className="w-14 h-14 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-[#111827] mb-2">Platform Admin Access Restricted</h2>
          <p className="text-sm text-[#667085] mb-6">
            Your account ({user.email}) is a verified customer workspace user, but does not possess an active Platform Super Admin privilege grant.
          </p>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 text-left mb-6 space-y-1">
            <div className="font-semibold text-slate-800">Security Invariant:</div>
            <div>• Business ownership (OWNER) does not grant platform administration.</div>
            <div>• Platform administration privileges must be explicitly granted via secure server CLI.</div>
          </div>
          <Link
            to="/app"
            className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-[#0D9488] hover:bg-[#0F766E] text-white text-sm font-medium rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Return to Customer Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
