import React, { useState } from 'react';
import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  TrendingUp,
  MessageSquare,
  Activity,
  ShieldCheck,
  Headphones,
  Settings,
  LogOut,
  ExternalLink,
  Shield,
  Menu,
  X,
  Radio,
} from 'lucide-react';

const NAV_ITEMS = [
  { name: 'Overview', path: '/platform-admin/overview', icon: LayoutDashboard },
  { name: 'Businesses', path: '/platform-admin/businesses', icon: Building2 },
  { name: 'Subscriptions', path: '/platform-admin/subscriptions', icon: CreditCard },
  { name: 'Revenue Analytics', path: '/platform-admin/revenue', icon: TrendingUp },
  { name: 'WhatsApp Health', path: '/platform-admin/whatsapp-connections', icon: MessageSquare },
  { name: 'System & Workers', path: '/platform-admin/system-health', icon: Activity },
  { name: 'Security & Audit', path: '/platform-admin/security', icon: ShieldCheck },
  { name: 'Support Operations', path: '/platform-admin/support', icon: Headphones },
  { name: 'Platform Settings', path: '/platform-admin/settings', icon: Settings },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex text-[#111827]">
      {/* Mobile Sidebar Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Midnight Slate */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-[#111827] text-white flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-gray-800">
          <Link to="/platform-admin/overview" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0D9488] flex items-center justify-center text-white font-bold text-lg shadow-md shadow-teal-900/30">
              R
            </div>
            <div>
              <div className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
                RELAY
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#0D9488]/30 text-teal-300 border border-[#0D9488]/50">
                  ADMIN
                </span>
              </div>
              <div className="text-[11px] text-gray-400 font-medium leading-none">
                Platform Operations
              </div>
            </div>
          </Link>
          <button
            className="lg:hidden text-gray-400 hover:text-white"
            onClick={() => setMobileMenuOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Platform Operations
          </div>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-[#0D9488] text-white shadow-sm shadow-teal-950/40'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`
                }
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Sidebar Footer with Role & Workspace Switch */}
        <div className="p-4 border-t border-gray-800 bg-[#0B0F17]/60 space-y-3">
          <div className="flex items-center gap-2.5 px-1">
            <div className="w-8 h-8 rounded-full bg-teal-500/20 text-teal-300 flex items-center justify-center font-bold text-xs border border-teal-500/30">
              {user?.name ? user.name[0].toUpperCase() : 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-white truncate">{user?.name}</div>
              <div className="text-[10px] font-mono text-teal-400 truncate">PLATFORM_SUPER_ADMIN</div>
            </div>
          </div>

          <div className="pt-1 flex flex-col gap-1.5">
            <Link
              to="/app"
              className="flex items-center justify-between text-xs text-gray-300 hover:text-white px-2 py-1.5 rounded hover:bg-gray-800 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <ExternalLink className="w-3.5 h-3.5 text-teal-400" />
                Customer Workspace
              </span>
              <span className="text-[10px] bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded">/app</span>
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 w-full text-xs text-red-400 hover:text-red-300 px-2 py-1.5 rounded hover:bg-red-950/30 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out Platform Admin
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:pl-64 min-w-0">
        {/* Top Operational Header */}
        <header className="h-16 bg-white border-b border-[#E5E7EB] sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden text-gray-600 hover:text-gray-900 p-1.5 rounded-md hover:bg-gray-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                OPERATIONAL COMMAND CENTER
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-slate-100 text-slate-700 border border-slate-200">
                <Radio className="w-3 h-3 text-[#0D9488]" />
                MOCK_DISPATCH_ONLY
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden md:inline-block text-xs text-[#667085]">
              Privilege Scope: <strong className="text-[#111827]">Global SaaS Tenant Operator</strong>
            </span>
            <div className="w-px h-5 bg-gray-200 hidden md:block" />
            <Link
              to="/app"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0D9488] hover:text-[#0F766E] bg-teal-50 px-3 py-1.5 rounded-lg border border-teal-200 transition-colors"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Customer Portal</span>
            </Link>
          </div>
        </header>

        {/* Page Outlet */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
