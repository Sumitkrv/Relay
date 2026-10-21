import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Sparkles,
  CheckCircle2,
  Building,
  ArrowRight,
  LogOut,
  ShieldCheck,
  Smartphone,
  Layers,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function OnboardingHandoffPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Top Navbar */}
      <header className="max-w-6xl mx-auto w-full flex items-center justify-between py-4 border-b border-slate-800">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-teal-500 flex items-center justify-center text-slate-950 font-bold">
            R
          </div>
          <span className="text-xl font-bold tracking-tight text-white">
            RELAY<span className="text-teal-400">.</span>
          </span>
        </Link>

        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-800 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </header>

      {/* Main Card */}
      <main className="max-w-2xl mx-auto w-full my-12 bg-slate-800/80 border border-slate-700/80 rounded-3xl p-8 sm:p-12 shadow-2xl backdrop-blur-sm text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-900/60 border border-teal-500/30 text-teal-300 text-xs font-semibold uppercase tracking-wider mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Account Verified & Active</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-4">
          Welcome to Relay, {user?.name || 'Partner'}!
        </h1>

        <p className="text-sm sm:text-base text-slate-300 max-w-lg mx-auto leading-relaxed mb-8">
          Your customer account is verified. You do not have an active business workspace yet. Workspace creation and industry-specific dashboard configuration will be available here.
        </p>

        {/* Phase 5 Preview Modules */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left mb-8">
          <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-4">
            <Building className="w-5 h-5 text-teal-400 mb-2" />
            <h3 className="text-xs font-bold text-white">1. Business Setup</h3>
            <p className="text-[11px] text-slate-400 mt-1">Configure company name, timezone, and business profile.</p>
          </div>

          <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-4">
            <Layers className="w-5 h-5 text-teal-400 mb-2" />
            <h3 className="text-xs font-bold text-white">2. Industry Presets</h3>
            <p className="text-[11px] text-slate-400 mt-1">Choose from 7 categories: Real Estate, Gym, Clinic, and more.</p>
          </div>

          <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-4">
            <Smartphone className="w-5 h-5 text-teal-400 mb-2" />
            <h3 className="text-xs font-bold text-white">3. WhatsApp Setup</h3>
            <p className="text-[11px] text-slate-400 mt-1">Connect your official WhatsApp Business number.</p>
          </div>
        </div>

        {/* Boundary Notice */}
        <div className="bg-teal-950/40 border border-teal-500/20 rounded-2xl p-4 text-xs text-teal-300 flex items-start gap-3 text-left mb-8">
          <ShieldCheck className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
          <div>
            <strong className="block font-bold mb-0.5">SaaS Phase 4 Handoff Boundary</strong>
            Customer authentication and email verification are 100% operational. Automated workspace provisioning and the multi-step business onboarding wizard arrive in <strong>SaaS Prompt 5</strong>.
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold transition-all shadow-md"
          >
            <span>Explore Marketing Site</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold transition-all"
          >
            <span>Sign Out</span>
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto w-full text-center text-xs text-slate-500 py-4">
        &copy; {new Date().getFullYear()} Relay SaaS. Logged in as {user?.email}.
      </footer>
    </div>
  );
}
