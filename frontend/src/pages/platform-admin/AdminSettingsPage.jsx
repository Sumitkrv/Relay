import React, { useEffect, useState } from 'react';
import platformAdminApi from '../../services/platformAdmin';
import {
  Settings,
  Shield,
  Lock,
  Radio,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await platformAdminApi.getSettings();
      setSettings(res);
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  if (loading && !settings) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-2">
        <div className="w-8 h-8 border-4 border-[#0D9488] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-[#667085]">Retrieving platform configuration...</p>
      </div>
    );
  }

  const { platform, policy, maintenance } = settings || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#111827] tracking-tight">Platform Settings & Security Policy</h1>
          <p className="text-sm text-[#667085] mt-1">
            Global SaaS configuration, billing parameters, fail-closed security gates, and audit policies.
          </p>
        </div>
        <button
          onClick={fetchSettings}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-[#E5E7EB] text-[#111827] hover:bg-slate-50 transition-colors shadow-sm self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#0D9488]' : ''}`} />
          Refresh Policy
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Core Platform Identity */}
        <div className="bg-white p-5 rounded-xl border border-[#E5E7EB] shadow-sm space-y-3">
          <div className="flex items-center gap-2 font-bold text-sm text-[#111827] border-b border-slate-100 pb-3">
            <Settings className="w-4 h-4 text-[#0D9488]" />
            Platform Instance Metadata
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Platform Name:</span>
              <span className="font-semibold text-slate-900">{platform?.name}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Version:</span>
              <span className="font-mono text-slate-800">{platform?.version}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Execution Environment:</span>
              <span className="font-mono text-teal-700 font-bold uppercase">{platform?.environment}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Brand Tokens:</span>
              <span className="font-medium text-slate-800">{platform?.displayTheme}</span>
            </div>
          </div>
        </div>

        {/* Commercial Billing Policy */}
        <div className="bg-white p-5 rounded-xl border border-[#E5E7EB] shadow-sm space-y-3">
          <div className="flex items-center gap-2 font-bold text-sm text-[#111827] border-b border-slate-100 pb-3">
            <Lock className="w-4 h-4 text-[#0D9488]" />
            Commercial & Billing Policy
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Standard Free Trial:</span>
              <span className="font-semibold text-slate-900">{policy?.trialDays} Days (Server Enforced)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Launch Plan Pricing:</span>
              <span className="font-semibold text-emerald-700">{policy?.monthlyPlanFormatted}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Default Currency:</span>
              <span className="font-mono text-slate-800">{policy?.defaultCurrency}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Multi-Tenant Mock Engine:</span>
              <span className="font-semibold text-emerald-700">Available</span>
            </div>
          </div>
        </div>

        {/* Gating & Security Invariants */}
        <div className="bg-white p-5 rounded-xl border border-[#E5E7EB] shadow-sm space-y-3 md:col-span-2">
          <div className="flex items-center gap-2 font-bold text-sm text-[#111827] border-b border-slate-100 pb-3">
            <Shield className="w-4 h-4 text-[#0D9488]" />
            Platform Security & Privacy Invariants
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 text-xs">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="font-bold text-slate-900">Zero Customer Impersonation</div>
              <div className="text-slate-600 mt-1">
                "Login as Customer" is strictly prohibited by security architecture. Platform Administrators cannot browse private customer chat logs or export private contact directories.
              </div>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="font-bold text-slate-900">Fail-Closed Meta Gating</div>
              <div className="text-slate-600 mt-1">
                Real WhatsApp messaging is locked. Customer-direct billing must be authoritatively verified prior to any future Meta Cloud API live onboarding.
              </div>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="font-bold text-slate-900">Server-Side Admin RBAC</div>
              <div className="text-slate-600 mt-1">
                Platform admin privileges are granted strictly via server CLI bootstrap. No client token or workspace owner role can elevate to Platform Super Admin.
              </div>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="font-bold text-slate-900">Tamper-Resistant Audit Trail</div>
              <div className="text-slate-600 mt-1">
                All administrative mutations (workspace suspensions, reactivations, support cases) automatically record operator identity, correlation ID, and substantive reason.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
