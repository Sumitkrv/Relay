import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Building2,
  CheckCircle2,
  ShieldCheck,
  Clock,
  MapPin,
  Mail,
  Phone,
  LogOut,
  ArrowRight,
  ContactRound,
  MessageSquareText,
  Boxes,
  Inbox,
  FileBarChart2,
  Settings,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';

export default function WorkspaceGettingStartedPage() {
  const { user, logout } = useAuth();
  const { currentWorkspace, membership } = useWorkspace();
  const [logoFailed, setLogoFailed] = useState(false);
  const navigate = useNavigate();
  const [showInboundModal, setShowInboundModal] = useState(false);
  const [showTestConsole, setShowTestConsole] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const ws = currentWorkspace || {
    name: user?.name ? `${user.name}'s Business` : 'Your Workspace',
    slug: 'my-workspace',
    industryKey: 'other',
    timezone: 'Asia/Kolkata',
    country: 'India',
    businessEmail: user?.email,
  };

  const resolvedLogo = ws.logoUrl ? resolveMediaUrl(ws.logoUrl) : null;
  const initials = (ws.name || 'RE').slice(0, 2).toUpperCase();

  const quickActions = [
    {
      title: 'Contacts & Client CRM',
      description: 'Add individual leads, import CSV/Excel spreadsheets, and view consent audit trails.',
      to: '/contacts',
      icon: ContactRound,
      actionText: 'Open Contacts',
    },
    {
      title: 'Message Template Studio',
      description: 'Create broadcast templates with personalized tokens, quick replies, and preview modes.',
      to: '/templates',
      icon: MessageSquareText,
      actionText: 'Design Templates',
    },
    {
      title: 'Mock Campaign Automation',
      description: 'Draft, validate audience targeting, and simulate scheduled broadcast executions safely.',
      to: '/campaigns',
      icon: Boxes,
      actionText: 'Launch Campaign',
    },
    {
      title: 'Inbox & Smart Auto-Replies',
      description: 'Test synthetic inbound client messages, keyword matching rules, and follow-up tasks.',
      to: '/inbox',
      icon: Inbox,
      actionText: 'Open Inbox',
    },
    {
      title: 'Analytics & Compliance Reports',
      description: 'Inspect verified delivery stats, opt-in/opt-out ratios, and export executive summaries.',
      to: '/reports',
      icon: FileBarChart2,
      actionText: 'View Reports',
    },
    {
      title: 'Business Profile & Settings',
      description: 'Configure your company details, regional timezone, branding logo, and team permissions.',
      to: '/settings',
      icon: Settings,
      actionText: 'Workspace Settings',
    },
  ];

  return (
    <div className="min-h-screen bg-[#F4F7FC] text-slate-900 flex flex-col justify-between">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Link to="/app" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white font-extrabold text-sm shadow">
              R
            </div>
            <span className="text-xl font-black tracking-tight text-slate-900">
              RELAY<span className="text-blue-600">.</span>
            </span>
          </Link>

          <span className="hidden sm:inline-block h-4 w-px bg-slate-200" />
          <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 border border-blue-200 text-blue-800">
            Workspace Hub
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/app')}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-colors"
          >
            <span>Enter Dashboard</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Role:</span>
            <strong className="text-slate-800 font-semibold">{membership?.role || 'OWNER'}</strong>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-xs font-semibold transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12 flex-1 space-y-8">
        {/* Welcome Hero Banner */}
        <div className="bg-[#0B1220] text-white rounded-3xl p-6 sm:p-10 shadow-xl overflow-hidden relative border border-slate-800">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start sm:items-center gap-5">
              {resolvedLogo && !logoFailed ? (
                <div className="w-20 h-20 rounded-2xl bg-white p-2 border border-slate-700 flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
                  <img
                    src={resolvedLogo}
                    alt={ws.name}
                    className="max-w-full max-h-full object-contain"
                    onError={() => setLogoFailed(true)}
                  />
                </div>
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-blue-600 text-white font-black text-2xl flex items-center justify-center shrink-0 shadow-md">
                  {initials}
                </div>
              )}

              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-900/60 border border-blue-500/30 text-blue-300 text-[10px] font-bold uppercase tracking-wider mb-2">
                  <Sparkles className="w-3 h-3" />
                  <span>Workspace Authorized</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  Welcome to {ws.name}!
                </h1>
                <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl leading-relaxed">
                  Your dedicated Relay workspace is active. Database records, templates, and communication channels are isolated under your ownership.
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => navigate('/app')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition-colors"
                  >
                    <span>Launch Overview Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700 text-left text-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Workspace Slug</span>
                <span className="font-mono font-bold text-blue-300">{ws.slug}</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700 text-left text-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Industry Vertical</span>
                <span className="font-bold text-white capitalize">{ws.industryKey?.replace('_', ' ')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Workspace Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2.5 text-xs font-bold text-slate-800">
              <Building2 className="w-4 h-4 text-blue-600" />
              <span>Business Profile</span>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-2 text-slate-600">
                <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{ws.businessEmail || user?.email}</span>
              </div>
              {ws.businessPhone && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{ws.businessPhone}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-slate-600">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{[ws.city, ws.country].filter(Boolean).join(', ') || 'India'}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2.5 text-xs font-bold text-slate-800">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>Regional Timezone</span>
            </div>
            <div className="space-y-1 text-xs">
              <p className="font-bold text-slate-900 text-sm">{ws.timezone || 'Asia/Kolkata'}</p>
              <p className="text-slate-500 text-[11px]">
                All automated campaigns and follow-up schedules run according to this zone.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2.5 text-xs font-bold text-slate-800">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span>Tenant Security</span>
            </div>
            <div className="space-y-1 text-xs">
              <p className="font-semibold text-emerald-600 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Isolated Workspace Scope</span>
              </p>
              <p className="text-slate-500 text-[11px]">
                Dedicated tenant boundaries enforce strict isolation in MongoDB.
              </p>
            </div>
          </div>
        </div>

        {/* Industry Configuration & Presets Hub (SaaS Prompt 6) */}
        <IndustryConfigHub />

        {/* Multi-Tenant WhatsApp Mock Engine (SaaS Prompt 8) */}
        <div className="space-y-6">
          <MockConnectionCard
            onOpenInboundModal={() => setShowInboundModal(true)}
            onOpenTestConsole={() => setShowTestConsole(true)}
          />
          <DemoJourneyProgress
            onOpenInboundModal={() => setShowInboundModal(true)}
            onOpenTestConsole={() => setShowTestConsole(true)}
          />
        </div>

        {/* Inbound Simulator Modal */}
        <InboundSimulatorModal
          isOpen={showInboundModal}
          onClose={() => setShowInboundModal(false)}
        />

        {/* Automation Test Console Modal */}
        <AutomationTestConsole
          isOpen={showTestConsole}
          onClose={() => setShowTestConsole(false)}
        />

        {/* Actionable Business Modules Grid */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Explore Your Workspace Modules</h2>
            <p className="text-xs text-slate-500 mt-1">
              All core CRM and automation capabilities are ready for your business. Select any module to get started.
            </p>
          </div>

          <div className="space-y-4">
            {/* Step 1: Industry Config (Prompt 6) */}
            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center font-bold text-sm shrink-0">
                1
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">
                    Industry Presets & Dynamic CRM Fields
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 border border-amber-200 text-amber-800">
                    SaaS Prompt 6
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Relay will initialize tailored fields, broadcast templates, and keyword auto-reply rules specifically for your selected industry (<strong>{ws.industryKey}</strong>).
                </p>
              </div>
            </div>

            {/* Step 2: Multi-Tenant Module Enablement (Prompt 7) */}
            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm shrink-0">
                2
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">
                    Shared Seven-Module Dashboard Access
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">
                    SaaS Prompt 7
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Safety Boundary Notice */}
        <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong className="block font-bold text-blue-950 mb-0.5">Tenant Isolation & Legacy Protection Active</strong>
            Your account is verified and your workspace is provisioned with authoritative OWNER status. Legacy M2W Realty data records remain protected and inaccessible.
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-6 text-xs text-slate-400 border-t border-slate-200 bg-white">
        © {new Date().getFullYear()} Relay Automation Inc. All rights reserved. • Multi-Tenant WhatsApp Business Automation
      </footer>
    </div>
  );
}
