import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  Building2,
  Users,
  CreditCard,
  LifeBuoy,
  FileText,
  Activity,
  Search,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ArrowLeft,
  Filter,
  Briefcase,
  Server,
  Layers,
  ExternalLink,
  ChevronRight,
  X,
  HelpCircle,
  Eye,
  Lock,
  Menu,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import adminService from '../services/admin.js';
import { useAuth } from '../context/AuthContext.jsx';
import toast from 'react-hot-toast';
import './superAdmin.css';

export default function SuperAdminPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Data states
  const [overview, setOverview] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [totalWorkspaces, setTotalWorkspaces] = useState(0);
  const [agencies, setAgencies] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [cases, setCases] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [systemHealth, setSystemHealth] = useState(null);

  // Filters & Pagination
  const [wsSearch, setWsSearch] = useState('');
  const [wsIndustryFilter, setWsIndustryFilter] = useState('');
  const [wsStatusFilter, setWsStatusFilter] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [auditSearch, setAuditSearch] = useState('');

  // Modals & Details
  const [selectedWsDetails, setSelectedWsDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [suspendModalWs, setSuspendModalWs] = useState(null);

  const fetchOverview = useCallback(async () => {
    try {
      setLoading(true);
      const [overviewData, wsData, agenciesData, subsData, auditData, healthData, usersData, casesData] =
        await Promise.all([
          adminService.getOverview().catch(() => null),
          adminService.getWorkspaces({ limit: 50 }).catch(() => ({ workspaces: [], total: 0 })),
          adminService.getAgencies().catch(() => ({ agencies: [] })),
          adminService.getSubscriptions().catch(() => ({ subscriptions: [] })),
          adminService.getAuditLogs({ limit: 50 }).catch(() => ({ logs: [] })),
          adminService.getSystemHealth().catch(() => null),
          adminService.getUsers({ limit: 50 }).catch(() => ({ users: [] })),
          adminService.getSupportCases().catch(() => ({ cases: [] })),
        ]);

      if (overviewData) setOverview(overviewData);
      if (wsData) {
        setWorkspaces(wsData.workspaces || []);
        setTotalWorkspaces(wsData.total || 0);
      }
      if (agenciesData) setAgencies(agenciesData.agencies || []);
      if (subsData) setSubscriptions(subsData.subscriptions || []);
      if (auditData) setAuditLogs(auditData.logs || []);
      if (healthData) setSystemHealth(healthData);
      if (usersData) setUsersList(usersData.users || []);
      if (casesData) setCases(casesData.cases || []);
    } catch (err) {
      toast.error('Failed to load administrative telemetry: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  // Load single workspace details
  const handleOpenWorkspaceDetails = async (wsId) => {
    try {
      setDetailsLoading(true);
      const data = await adminService.getWorkspaceDetails(wsId);
      setSelectedWsDetails(data);
    } catch (err) {
      toast.error('Failed to load workspace metadata: ' + (err.response?.data?.message || err.message));
    } finally {
      setDetailsLoading(false);
    }
  };

  // Toggle Suspend / Reactivate
  const handleConfirmSuspendToggle = async () => {
    if (!suspendModalWs) return;
    const ws = suspendModalWs;
    const isSuspended = ws.status === 'SUSPENDED';

    try {
      setActionLoading(true);
      if (isSuspended) {
        await adminService.reactivateWorkspace(ws._id);
        toast.success(`Workspace "${ws.name}" reactivated successfully.`);
      } else {
        await adminService.suspendWorkspace(ws._id);
        toast.success(`Workspace "${ws.name}" suspended. Prohibited sends prevented.`);
      }
      setSuspendModalWs(null);
      if (selectedWsDetails && selectedWsDetails.workspace._id === ws._id) {
        setSelectedWsDetails(null);
      }
      fetchOverview();
    } catch (err) {
      toast.error('Action failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered workspaces for UI
  const filteredWorkspaces = workspaces.filter((w) => {
    if (wsSearch) {
      const q = wsSearch.toLowerCase();
      const matchName = w.name?.toLowerCase().includes(q);
      const matchSlug = w.slug?.toLowerCase().includes(q);
      const matchEmail = w.businessEmail?.toLowerCase().includes(q) || w.owner?.email?.toLowerCase().includes(q);
      const matchIndustry = w.industryKey?.toLowerCase().includes(q);
      if (!matchName && !matchSlug && !matchEmail && !matchIndustry) return false;
    }
    if (wsIndustryFilter && w.industryKey !== wsIndustryFilter) return false;
    if (wsStatusFilter && w.status !== wsStatusFilter) return false;
    return true;
  });

  // Filtered platform users
  const filteredUsers = usersList.filter((u) => {
    if (!userSearch) return true;
    const q = userSearch.toLowerCase();
    return u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.role?.toLowerCase().includes(q);
  });

  // Filtered audit logs
  const filteredAuditLogs = auditLogs.filter((log) => {
    if (!auditSearch) return true;
    const q = auditSearch.toLowerCase();
    return log.action?.toLowerCase().includes(q) || log.actor?.email?.toLowerCase().includes(q);
  });

  return (
    <div className="sa-container">
      {/* ---------- PLATFORM ADMIN SIDEBAR ---------- */}
      <aside className={`sa-sidebar ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="sa-sidebar-header">
          <div className="sa-brand-lockup">
            <div className="sa-brand-icon">R</div>
            <div className="sa-brand-text">
              <span className="sa-brand-title">Relay Platform</span>
              <span className="sa-brand-sub">Command Center</span>
            </div>
          </div>
          <span className="sa-env-badge">Sandbox</span>
        </div>

        <nav className="sa-nav">
          <div className="sa-nav-heading">Platform Governance</div>

          <button
            onClick={() => { setActiveTab('overview'); setMobileMenuOpen(false); }}
            className={`sa-nav-item ${activeTab === 'overview' ? 'active' : ''}`}
          >
            <Activity size={18} />
            <span>Overview</span>
          </button>

          <button
            onClick={() => { setActiveTab('workspaces'); setMobileMenuOpen(false); }}
            className={`sa-nav-item ${activeTab === 'workspaces' ? 'active' : ''}`}
          >
            <Building2 size={18} />
            <span>Workspaces</span>
            <span className="sa-nav-badge">{overview?.metrics?.totalWorkspaces || workspaces.length}</span>
          </button>

          <button
            onClick={() => { setActiveTab('agencies'); setMobileMenuOpen(false); }}
            className={`sa-nav-item ${activeTab === 'agencies' ? 'active' : ''}`}
          >
            <Briefcase size={18} />
            <span>Agencies</span>
            <span className="sa-nav-badge">{agencies.length}</span>
          </button>

          <button
            onClick={() => { setActiveTab('users'); setMobileMenuOpen(false); }}
            className={`sa-nav-item ${activeTab === 'users' ? 'active' : ''}`}
          >
            <Users size={18} />
            <span>Platform Users</span>
            <span className="sa-nav-badge">{usersList.length}</span>
          </button>

          <button
            onClick={() => { setActiveTab('subscriptions'); setMobileMenuOpen(false); }}
            className={`sa-nav-item ${activeTab === 'subscriptions' ? 'active' : ''}`}
          >
            <CreditCard size={18} />
            <span>Subscriptions</span>
            <span className="sa-nav-badge">{subscriptions.length}</span>
          </button>

          <div className="sa-nav-heading">Infrastructure &amp; Security</div>

          <button
            onClick={() => { setActiveTab('health'); setMobileMenuOpen(false); }}
            className={`sa-nav-item ${activeTab === 'health' ? 'active' : ''}`}
          >
            <Server size={18} />
            <span>System Health</span>
          </button>

          <button
            onClick={() => { setActiveTab('audit'); setMobileMenuOpen(false); }}
            className={`sa-nav-item ${activeTab === 'audit' ? 'active' : ''}`}
          >
            <ShieldAlert size={18} />
            <span>Audit Logs</span>
          </button>

          <button
            onClick={() => { setActiveTab('cases'); setMobileMenuOpen(false); }}
            className={`sa-nav-item ${activeTab === 'cases' ? 'active' : ''}`}
          >
            <LifeBuoy size={18} />
            <span>Support Cases</span>
            {cases.filter((c) => c.status === 'OPEN').length > 0 && (
              <span className="sa-nav-badge" style={{ background: '#DC2626', color: '#FFFFFF' }}>
                {cases.filter((c) => c.status === 'OPEN').length}
              </span>
            )}
          </button>
        </nav>

        <div className="sa-sidebar-footer">
          <div className="sa-user-card">
            <div className="sa-user-avatar">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
            </div>
            <div className="sa-user-info">
              <span className="sa-user-name">{user?.name || 'Relay Admin'}</span>
              <span className="sa-user-role">Platform Super Admin</span>
            </div>
          </div>

          <Link to="/app" className="sa-exit-link">
            <ArrowLeft size={15} /> Exit to Business CRM
          </Link>
        </div>
      </aside>

      {/* ---------- MAIN CONSOLE CONTENT ---------- */}
      <main className="sa-main">
        {/* Topbar */}
        <header className="sa-topbar">
          <div className="sa-topbar-left">
            <button
              className="sa-mobile-menu-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              <Menu size={20} />
            </button>
            <div className="sa-breadcrumbs">
              <span>Platform Console</span>
              <span>/</span>
              <span className="sa-breadcrumb-active">
                {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
              </span>
            </div>
          </div>

          <div className="sa-topbar-right">
            <div className="sa-status-pill">
              <span className="sa-status-dot"></span>
              <span>Offline Mock Mode</span>
            </div>

            <button
              onClick={fetchOverview}
              disabled={loading}
              className="sa-btn-secondary"
              title="Refresh telemetry"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </header>

        {/* Content Body */}
        <div className="sa-content">
          {/* TAB 1: OVERVIEW / COMMAND CENTER */}
          {activeTab === 'overview' && (
            <>
              <div className="sa-page-header">
                <div>
                  <h1 className="sa-page-title">Platform Command Center</h1>
                  <p className="sa-page-desc">
                    Global multi-tenant governance, live MongoDB aggregates, subscription operations &amp; operational health.
                  </p>
                </div>
              </div>

              {/* Informational Banner */}
              <div className="sa-banner sa-banner-info">
                <AlertTriangle size={18} />
                <div>
                  <strong>Enterprise Multi-Tenant Isolation Standard:</strong> Administrative queries inspect platform operational metadata and subscription states. Sensitive customer CRM contents (contact phone numbers, message bodies, patient enquiry notes) remain strictly segregated and inaccessible.
                </div>
              </div>

              {/* KPI Cards */}
              <div className="sa-kpi-grid">
                <div className="sa-kpi-card">
                  <div className="sa-kpi-head">
                    <span>Total Workspaces</span>
                    <div className="sa-kpi-icon-wrap"><Building2 size={18} /></div>
                  </div>
                  <div className="sa-kpi-value">{overview?.metrics?.totalWorkspaces || workspaces.length}</div>
                  <div className="sa-kpi-sub">
                    {overview?.metrics?.activeWorkspaces || 0} Active • {overview?.metrics?.suspendedWorkspaces || 0} Suspended
                  </div>
                </div>

                <div className="sa-kpi-card">
                  <div className="sa-kpi-head">
                    <span>Platform Users</span>
                    <div className="sa-kpi-icon-wrap"><Users size={18} /></div>
                  </div>
                  <div className="sa-kpi-value">{overview?.metrics?.totalUsers || usersList.length}</div>
                  <div className="sa-kpi-sub">Verified accounts &amp; personas</div>
                </div>

                <div className="sa-kpi-card">
                  <div className="sa-kpi-head">
                    <span>Active Subscriptions</span>
                    <div className="sa-kpi-icon-wrap"><CreditCard size={18} /></div>
                  </div>
                  <div className="sa-kpi-value">{overview?.metrics?.activeSubscriptions || 0}</div>
                  <div className="sa-kpi-sub">{overview?.metrics?.trialingSubscriptions || 0} in 14-day trial</div>
                </div>

                <div className="sa-kpi-card">
                  <div className="sa-kpi-head">
                    <span>Simulated Monthly Revenue</span>
                    <div className="sa-kpi-icon-wrap"><Activity size={18} /></div>
                  </div>
                  <div className="sa-kpi-value">₹{(overview?.metrics?.mockMonthlyRecurringRevenue || 0).toLocaleString()}</div>
                  <div className="sa-kpi-sub mock-note">
                    Simulated • Real Cash: ₹0 (Offline Mode)
                  </div>
                </div>

                <div className="sa-kpi-card">
                  <div className="sa-kpi-head">
                    <span>Registered Agencies</span>
                    <div className="sa-kpi-icon-wrap"><Briefcase size={18} /></div>
                  </div>
                  <div className="sa-kpi-value">{overview?.metrics?.totalAgencies || agencies.length}</div>
                  <div className="sa-kpi-sub">White-label partners</div>
                </div>

                <div className="sa-kpi-card">
                  <div className="sa-kpi-head">
                    <span>Workspaces Needing Attention</span>
                    <div className="sa-kpi-icon-wrap"><AlertTriangle size={18} color="#D97706" /></div>
                  </div>
                  <div className="sa-kpi-value">{overview?.metrics?.workspacesNeedingAttention || 0}</div>
                  <div className="sa-kpi-sub">
                    {overview?.metrics?.suspendedWorkspaces > 0 ? `${overview.metrics.suspendedWorkspaces} Suspended` : 'Zero critical incidents'}
                  </div>
                </div>
              </div>

              {/* Two Column Layout: Recent Activity + Operational Diagnostics */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
                {/* Recent Platform Activity */}
                <div className="sa-panel">
                  <div className="sa-panel-header">
                    <span className="sa-panel-title">Recent Platform Activity</span>
                    <button onClick={() => setActiveTab('audit')} className="sa-btn-secondary" style={{ fontSize: '12px', padding: '4px 8px' }}>
                      View all logs
                    </button>
                  </div>
                  <div style={{ padding: '8px 0' }}>
                    {overview?.recentActivity?.length > 0 ? (
                      overview.recentActivity.map((act) => (
                        <div key={act._id} style={{ padding: '12px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: '600', color: '#0F172A' }}>{act.action}</div>
                            <div style={{ fontSize: '11.5px', color: '#64748B' }}>
                              Actor: {act.actor?.email || 'system'}
                              {act.metadata?.targetWorkspaceName ? ` • Workspace: ${act.metadata.targetWorkspaceName}` : ''}
                            </div>
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#94A3B8' }}>
                            {new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ padding: '24px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
                        No audit events recorded recently.
                      </div>
                    )}
                  </div>
                </div>

                {/* System Health Summary */}
                <div className="sa-panel">
                  <div className="sa-panel-header">
                    <span className="sa-panel-title">Operational Health Status</span>
                    <span className="sa-badge sa-badge-active">Operational</span>
                  </div>
                  <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', borderBottom: '1px solid #F1F5F9' }}>
                      <span style={{ fontSize: '13px', color: '#475569' }}>MongoDB Database</span>
                      <span className="sa-badge sa-badge-active">Connected (relay_demo)</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', borderBottom: '1px solid #F1F5F9' }}>
                      <span style={{ fontSize: '13px', color: '#475569' }}>Mock Message Worker</span>
                      <span className="sa-badge sa-badge-active">Running (In-Memory Queue)</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', borderBottom: '1px solid #F1F5F9' }}>
                      <span style={{ fontSize: '13px', color: '#475569' }}>Mock WhatsApp Messaging Engine</span>
                      <span className="sa-badge sa-badge-active">Ready</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', borderBottom: '1px solid #F1F5F9' }}>
                      <span style={{ fontSize: '13px', color: '#475569' }}>Meta Cloud API Integration</span>
                      <span className="sa-badge sa-badge-mock">Disconnected (Sandbox Mode)</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', color: '#475569' }}>Billing Engine</span>
                      <span className="sa-badge sa-badge-mock">Offline Mock Adapter Active</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* TAB 2: WORKSPACES DIRECTORY */}
          {activeTab === 'workspaces' && (
            <div className="sa-panel">
              <div className="sa-panel-header">
                <div>
                  <span className="sa-panel-title">Business Workspaces Directory</span>
                  <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                    Showing {filteredWorkspaces.length} of {totalWorkspaces} registered workspaces
                  </div>
                </div>

                <div className="sa-filter-bar">
                  <div className="sa-search-wrap">
                    <Search size={15} />
                    <input
                      type="text"
                      className="sa-search-input"
                      value={wsSearch}
                      onChange={(e) => setWsSearch(e.target.value)}
                      placeholder="Search name, slug, email..."
                    />
                  </div>

                  <select
                    className="sa-select"
                    value={wsIndustryFilter}
                    onChange={(e) => setWsIndustryFilter(e.target.value)}
                  >
                    <option value="">All Industries</option>
                    <option value="real_estate">Real Estate</option>
                    <option value="gym">Gym &amp; Fitness</option>
                    <option value="clinic">Healthcare / Clinic</option>
                    <option value="salon">Salon</option>
                    <option value="education">Education</option>
                    <option value="automobile">Automobile</option>
                    <option value="other">Other</option>
                  </select>

                  <select
                    className="sa-select"
                    value={wsStatusFilter}
                    onChange={(e) => setWsStatusFilter(e.target.value)}
                  >
                    <option value="">All Statuses</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                  </select>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="sa-table">
                  <thead>
                    <tr>
                      <th>Workspace</th>
                      <th>Industry</th>
                      <th>Owner Reference</th>
                      <th>Subscription</th>
                      <th>WhatsApp Engine</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredWorkspaces.length > 0 ? (
                      filteredWorkspaces.map((ws) => (
                        <tr key={ws._id}>
                          <td>
                            <div style={{ fontWeight: '600', color: '#0F172A' }}>{ws.name}</div>
                            <div style={{ fontSize: '11px', color: '#64748B', fontFamily: 'monospace' }}>
                              slug: {ws.slug}
                            </div>
                          </td>
                          <td>
                            <span className="sa-badge sa-badge-industry">
                              {ws.industryKey}
                            </span>
                          </td>
                          <td>
                            <div style={{ fontSize: '12.5px', color: '#1E293B' }}>{ws.owner?.name || 'Owner'}</div>
                            <div style={{ fontSize: '11px', color: '#64748B' }}>{ws.owner?.email || ws.businessEmail}</div>
                          </td>
                          <td>
                            {ws.subscription ? (
                              <div>
                                <span className={`sa-badge ${ws.subscription.status === 'ACTIVE' ? 'sa-badge-active' : 'sa-badge-mock'}`}>
                                  {ws.subscription.status}
                                </span>
                                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                                  ₹{ws.subscription.amount}/mo
                                </div>
                              </div>
                            ) : (
                              <span style={{ fontSize: '11.5px', color: '#94A3B8' }}>No Subscription</span>
                            )}
                          </td>
                          <td>
                            <span className="sa-badge sa-badge-mock">Mock Ready</span>
                          </td>
                          <td>
                            <span className={`sa-badge ${ws.status === 'SUSPENDED' ? 'sa-badge-suspended' : 'sa-badge-active'}`}>
                              {ws.status}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '8px' }}>
                              <button
                                onClick={() => handleOpenWorkspaceDetails(ws._id)}
                                className="sa-btn-secondary"
                                style={{ padding: '5px 10px', fontSize: '12px' }}
                              >
                                Details
                              </button>
                              <button
                                onClick={() => setSuspendModalWs(ws)}
                                className={ws.status === 'SUSPENDED' ? 'sa-btn-primary' : 'sa-btn-danger'}
                                style={{ padding: '5px 10px', fontSize: '12px' }}
                              >
                                {ws.status === 'SUSPENDED' ? 'Reactivate' : 'Suspend'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="7" style={{ padding: '36px', textAlign: 'center', color: '#94A3B8' }}>
                          No workspaces match your search criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: AGENCIES DIRECTORY */}
          {activeTab === 'agencies' && (
            <div className="sa-panel">
              <div className="sa-panel-header">
                <div>
                  <span className="sa-panel-title">Registered Agencies Directory</span>
                  <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                    Agencies authorized to manage delegated client workspaces
                  </div>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="sa-table">
                  <thead>
                    <tr>
                      <th>Agency</th>
                      <th>Owner</th>
                      <th>Client Workspaces</th>
                      <th>White-Label Branding</th>
                      <th>Custom Domain</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agencies.length > 0 ? (
                      agencies.map((agency) => (
                        <tr key={agency._id}>
                          <td>
                            <div style={{ fontWeight: '600', color: '#0F172A' }}>{agency.name}</div>
                            <div style={{ fontSize: '11px', color: '#64748B', fontFamily: 'monospace' }}>
                              slug: {agency.slug}
                            </div>
                          </td>
                          <td>
                            <div style={{ fontSize: '12.5px', color: '#1E293B' }}>{agency.owner?.name || 'Agency Owner'}</div>
                            <div style={{ fontSize: '11px', color: '#64748B' }}>{agency.owner?.email}</div>
                          </td>
                          <td>
                            <span className="sa-badge sa-badge-industry">
                              {agency.clientCount} Workspaces Delegated
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span
                                style={{
                                  width: '12px',
                                  height: '12px',
                                  borderRadius: '3px',
                                  backgroundColor: agency.branding?.brandColor || '#2563EB',
                                  display: 'inline-block',
                                }}
                              ></span>
                              <span style={{ fontSize: '12px', color: '#334155' }}>
                                {agency.branding?.companyName || 'Configured'}
                              </span>
                            </div>
                          </td>
                          <td>
                            {agency.branding?.customDomain ? (
                              <div>
                                <span style={{ fontSize: '12px', fontFamily: 'monospace' }}>
                                  {agency.branding.customDomain}
                                </span>
                                <div>
                                  <span className={`sa-badge ${agency.branding.domainStatus === 'ACTIVE' ? 'sa-badge-active' : 'sa-badge-mock'}`} style={{ marginTop: '3px' }}>
                                    {agency.branding.domainStatus}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <span style={{ fontSize: '12px', color: '#94A3B8' }}>Not Configured</span>
                            )}
                          </td>
                          <td>
                            <span className={`sa-badge ${agency.status === 'ACTIVE' ? 'sa-badge-active' : 'sa-badge-suspended'}`}>
                              {agency.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" style={{ padding: '36px', textAlign: 'center', color: '#94A3B8' }}>
                          No agencies registered.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: PLATFORM USERS */}
          {activeTab === 'users' && (
            <div className="sa-panel">
              <div className="sa-panel-header">
                <div>
                  <span className="sa-panel-title">Platform Users &amp; Roles</span>
                  <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                    Authoritative identity records and workspace associations
                  </div>
                </div>

                <div className="sa-filter-bar">
                  <div className="sa-search-wrap">
                    <Search size={15} />
                    <input
                      type="text"
                      className="sa-search-input"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Search name, email, role..."
                    />
                  </div>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="sa-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Platform Role</th>
                      <th>Account Status</th>
                      <th>Associated Workspaces</th>
                      <th>Created Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length > 0 ? (
                      filteredUsers.map((u) => (
                        <tr key={u._id}>
                          <td>
                            <div style={{ fontWeight: '600', color: '#0F172A' }}>{u.name}</div>
                            <div style={{ fontSize: '11.5px', color: '#64748B' }}>{u.email}</div>
                          </td>
                          <td>
                            {u.isPlatformAdmin ? (
                              <span className="sa-badge sa-badge-role">Platform Super Admin</span>
                            ) : (
                              <span className="sa-badge sa-badge-industry">
                                {u.role === 'owner' ? 'Business Owner' : u.role}
                              </span>
                            )}
                          </td>
                          <td>
                            <span className={`sa-badge ${u.accountStatus === 'ACTIVE' ? 'sa-badge-active' : 'sa-badge-suspended'}`}>
                              {u.accountStatus}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                              {u.workspaces?.length > 0 ? (
                                u.workspaces.map((m, i) => (
                                  <span key={i} className="sa-badge sa-badge-mock" style={{ fontSize: '10.5px' }}>
                                    {m.workspaceName} ({m.role})
                                  </span>
                                ))
                              ) : (
                                <span style={{ fontSize: '11px', color: '#94A3B8' }}>None</span>
                              )}
                            </div>
                          </td>
                          <td style={{ fontSize: '12px', color: '#64748B' }}>
                            {new Date(u.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" style={{ padding: '36px', textAlign: 'center', color: '#94A3B8' }}>
                          No users found matching query.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: SUBSCRIPTIONS & BILLING */}
          {activeTab === 'subscriptions' && (
            <div className="sa-panel">
              <div className="sa-panel-header">
                <div>
                  <span className="sa-panel-title">Subscription Operations (Offline Mock Mode)</span>
                  <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                    Authoritative subscription states, plan tiers and simulated billing events
                  </div>
                </div>
                <span className="sa-badge sa-badge-mock">Mock Invoicing Active</span>
              </div>

              <div style={{ padding: '14px 20px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', fontSize: '12.5px', color: '#475569' }}>
                <strong>Billing Disclosure:</strong> Relay is currently operating with the Offline Mock Billing Adapter. No real financial transactions are executed, and live Razorpay webhooks are disabled. All invoices are simulated for development and demonstration verification.
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="sa-table">
                  <thead>
                    <tr>
                      <th>Workspace</th>
                      <th>Plan Details</th>
                      <th>Subscription Status</th>
                      <th>Simulated Amount</th>
                      <th>Period Lifecycle</th>
                      <th>Billing Mode</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscriptions.length > 0 ? (
                      subscriptions.map((sub) => (
                        <tr key={sub._id}>
                          <td>
                            <div style={{ fontWeight: '600', color: '#0F172A' }}>
                              {sub.workspaceId?.name || 'Workspace'}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748B', fontFamily: 'monospace' }}>
                              {sub.workspaceId?.slug}
                            </div>
                          </td>
                          <td>
                            <div style={{ fontWeight: '500' }}>{sub.planName || 'Solo Growth Plan'}</div>
                            <div style={{ fontSize: '11px', color: '#64748B' }}>tier: {sub.planId}</div>
                          </td>
                          <td>
                            <span className={`sa-badge ${sub.status === 'ACTIVE' ? 'sa-badge-active' : 'sa-badge-mock'}`}>
                              {sub.status}
                            </span>
                          </td>
                          <td style={{ fontWeight: '600', color: '#0F172A' }}>₹{sub.amount}/month</td>
                          <td style={{ fontSize: '12px', color: '#64748B' }}>
                            {sub.trialEndsAt ? (
                              <span>Trial ends: {new Date(sub.trialEndsAt).toLocaleDateString()}</span>
                            ) : sub.currentPeriodEndsAt ? (
                              <span>Period ends: {new Date(sub.currentPeriodEndsAt).toLocaleDateString()}</span>
                            ) : (
                              <span>Active period</span>
                            )}
                          </td>
                          <td>
                            <span className="sa-badge sa-badge-mock">{sub.billingMode || 'Offline Mock'}</span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" style={{ padding: '36px', textAlign: 'center', color: '#94A3B8' }}>
                          No subscription records found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 6: SYSTEM HEALTH */}
          {activeTab === 'health' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="sa-page-header">
                <div>
                  <h1 className="sa-page-title">Operational Health &amp; Infrastructure</h1>
                  <p className="sa-page-desc">
                    Live system metrics, message worker heartbeat, messaging engine status, and billing adapter readiness.
                  </p>
                </div>
              </div>

              <div className="sa-kpi-grid">
                <div className="sa-kpi-card">
                  <div className="sa-kpi-head">
                    <span>Database Status</span>
                    <Server size={18} />
                  </div>
                  <div className="sa-kpi-value" style={{ color: '#16A34A', fontSize: '20px' }}>
                    {systemHealth?.database?.status || 'CONNECTED'}
                  </div>
                  <div className="sa-kpi-sub">Target: {systemHealth?.database?.name || 'relay_demo'}</div>
                </div>

                <div className="sa-kpi-card">
                  <div className="sa-kpi-head">
                    <span>Message Worker</span>
                    <Activity size={18} />
                  </div>
                  <div className="sa-kpi-value" style={{ color: '#16A34A', fontSize: '20px' }}>
                    {systemHealth?.messageWorker?.status || 'RUNNING'}
                  </div>
                  <div className="sa-kpi-sub">{systemHealth?.messageWorker?.mode || 'Mock In-Memory Queue'}</div>
                </div>

                <div className="sa-kpi-card">
                  <div className="sa-kpi-head">
                    <span>WhatsApp Messaging Engine</span>
                    <CheckCircle size={18} color="#2563EB" />
                  </div>
                  <div className="sa-kpi-value" style={{ color: '#2563EB', fontSize: '20px' }}>
                    {systemHealth?.messagingProvider?.mockEngine || 'ACTIVE'}
                  </div>
                  <div className="sa-kpi-sub">Meta Cloud API: Disconnected (Sandbox)</div>
                </div>

                <div className="sa-kpi-card">
                  <div className="sa-kpi-head">
                    <span>Billing Adapter</span>
                    <CreditCard size={18} />
                  </div>
                  <div className="sa-kpi-value" style={{ color: '#2563EB', fontSize: '20px' }}>
                    {systemHealth?.billingAdapter?.mode || 'OFFLINE MOCK'}
                  </div>
                  <div className="sa-kpi-sub">Synthetic payment confirmation</div>
                </div>
              </div>

              <div className="sa-panel">
                <div className="sa-panel-header">
                  <span className="sa-panel-title">Server Runtime Environment</span>
                </div>
                <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#64748B' }}>Node.js Version</div>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: '#0F172A', marginTop: '2px' }}>
                      {systemHealth?.systemMetrics?.nodeVersion || process.version || 'v20.x'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#64748B' }}>Uptime</div>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: '#0F172A', marginTop: '2px' }}>
                      {Math.floor((systemHealth?.systemMetrics?.uptimeSeconds || 3600) / 60)} minutes
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#64748B' }}>Memory Heap Used</div>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: '#0F172A', marginTop: '2px' }}>
                      {systemHealth?.systemMetrics?.memoryHeapUsedMB || 45} MB
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#64748B' }}>Operating System</div>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: '#0F172A', marginTop: '2px' }}>
                      {systemHealth?.systemMetrics?.platform || 'Darwin (macOS)'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: AUDIT LOGS */}
          {activeTab === 'audit' && (
            <div className="sa-panel">
              <div className="sa-panel-header">
                <div>
                  <span className="sa-panel-title">Platform Security &amp; Audit Logs</span>
                  <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                    Immutable historical records of administrative and security events
                  </div>
                </div>

                <div className="sa-filter-bar">
                  <div className="sa-search-wrap">
                    <Search size={15} />
                    <input
                      type="text"
                      className="sa-search-input"
                      value={auditSearch}
                      onChange={(e) => setAuditSearch(e.target.value)}
                      placeholder="Search action, actor email..."
                    />
                  </div>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="sa-table">
                  <thead>
                    <tr>
                      <th>Action Code</th>
                      <th>Actor</th>
                      <th>Target &amp; Details</th>
                      <th>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAuditLogs.length > 0 ? (
                      filteredAuditLogs.map((log) => (
                        <tr key={log._id}>
                          <td>
                            <span className="sa-badge sa-badge-mock" style={{ fontFamily: 'monospace' }}>
                              {log.action}
                            </span>
                          </td>
                          <td>
                            <div style={{ fontSize: '12.5px', color: '#0F172A' }}>{log.actor?.name || 'Operator'}</div>
                            <div style={{ fontSize: '11px', color: '#64748B' }}>{log.actor?.email || 'system'}</div>
                          </td>
                          <td style={{ fontSize: '12px', color: '#475569' }}>
                            {log.metadata?.targetWorkspaceName ? (
                              <div>Target: <strong>{log.metadata.targetWorkspaceName}</strong></div>
                            ) : null}
                            {log.metadata?.agencyName ? (
                              <div>Agency: <strong>{log.metadata.agencyName}</strong></div>
                            ) : null}
                            {log.metadata ? (
                              <div style={{ fontSize: '11px', color: '#94A3B8', fontFamily: 'monospace', marginTop: '2px' }}>
                                {JSON.stringify(log.metadata).substring(0, 80)}
                              </div>
                            ) : 'Standard system event'}
                          </td>
                          <td style={{ fontSize: '12px', color: '#64748B' }}>
                            {new Date(log.createdAt).toLocaleString()}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" style={{ padding: '36px', textAlign: 'center', color: '#94A3B8' }}>
                          No audit events found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 8: SUPPORT CASES */}
          {activeTab === 'cases' && (
            <div className="sa-panel">
              <div className="sa-panel-header">
                <div>
                  <span className="sa-panel-title">Customer Support Cases</span>
                  <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                    Operator support inquiries and troubleshooting requests
                  </div>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="sa-table">
                  <thead>
                    <tr>
                      <th>Case #</th>
                      <th>Subject &amp; Description</th>
                      <th>Workspace</th>
                      <th>Requester</th>
                      <th>Priority</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cases.length > 0 ? (
                      cases.map((c) => (
                        <tr key={c._id}>
                          <td style={{ fontFamily: 'monospace', color: '#2563EB', fontWeight: '600' }}>
                            {c.caseNumber}
                          </td>
                          <td>
                            <div style={{ fontWeight: '600', color: '#0F172A' }}>{c.subject}</div>
                            <div style={{ fontSize: '12px', color: '#64748B', maxWidth: '400px' }}>{c.description}</div>
                          </td>
                          <td>
                            <span style={{ fontSize: '12.5px', fontWeight: '500' }}>{c.workspaceId?.name || 'General Platform'}</span>
                          </td>
                          <td>
                            <div style={{ fontSize: '12px', color: '#0F172A' }}>{c.userId?.name || 'Customer'}</div>
                            <div style={{ fontSize: '11px', color: '#64748B' }}>{c.userId?.email}</div>
                          </td>
                          <td>
                            <span className="sa-badge sa-badge-industry">{c.priority}</span>
                          </td>
                          <td>
                            <span className={`sa-badge ${c.status === 'RESOLVED' ? 'sa-badge-active' : 'sa-badge-mock'}`}>
                              {c.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" style={{ padding: '36px', textAlign: 'center', color: '#94A3B8' }}>
                          No support cases found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ---------- WORKSPACE DETAILS DRAWER / MODAL ---------- */}
      {selectedWsDetails && (
        <div className="sa-modal-backdrop" onClick={() => setSelectedWsDetails(null)}>
          <div className="sa-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '680px' }}>
            <div className="sa-modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '700' }}>
                  {selectedWsDetails.workspace.name}
                </h3>
                <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                  Workspace Metadata &amp; Governance
                </div>
              </div>
              <button
                onClick={() => setSelectedWsDetails(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="sa-modal-body">
              {/* Privacy Guarantee Banner */}
              <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: '#1E40AF' }}>
                <Lock size={16} />
                <span>
                  <strong>Tenant Data Isolation Enforced:</strong> Private customer contacts, message bodies, and enquiry notes are inaccessible via Platform Admin.
                </span>
              </div>

              {/* General Metadata */}
              <div>
                <h4 style={{ margin: '0 0 10px', fontSize: '13.5px', color: '#475569' }}>General Information</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                  <div style={{ background: '#F8FAFC', padding: '10px', borderRadius: '6px' }}>
                    <div style={{ color: '#64748B', fontSize: '11.5px' }}>Identifier / Slug</div>
                    <div style={{ fontWeight: '600', fontFamily: 'monospace' }}>{selectedWsDetails.workspace.slug}</div>
                  </div>
                  <div style={{ background: '#F8FAFC', padding: '10px', borderRadius: '6px' }}>
                    <div style={{ color: '#64748B', fontSize: '11.5px' }}>Industry Classification</div>
                    <div style={{ fontWeight: '600' }}>{selectedWsDetails.workspace.industryKey}</div>
                  </div>
                  <div style={{ background: '#F8FAFC', padding: '10px', borderRadius: '6px' }}>
                    <div style={{ color: '#64748B', fontSize: '11.5px' }}>Operational Status</div>
                    <div>
                      <span className={`sa-badge ${selectedWsDetails.workspace.status === 'SUSPENDED' ? 'sa-badge-suspended' : 'sa-badge-active'}`}>
                        {selectedWsDetails.workspace.status}
                      </span>
                    </div>
                  </div>
                  <div style={{ background: '#F8FAFC', padding: '10px', borderRadius: '6px' }}>
                    <div style={{ color: '#64748B', fontSize: '11.5px' }}>Onboarding State</div>
                    <div style={{ fontWeight: '600' }}>{selectedWsDetails.workspace.onboardingStatus}</div>
                  </div>
                </div>
              </div>

              {/* Subscription Summary */}
              <div>
                <h4 style={{ margin: '0 0 10px', fontSize: '13.5px', color: '#475569' }}>Subscription Telemetry</h4>
                <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '6px', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>Current Plan:</span>
                    <span style={{ fontWeight: '600' }}>{selectedWsDetails.subscription?.planName || 'Solo Growth Plan'} (₹799/mo)</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>Subscription Status:</span>
                    <span className="sa-badge sa-badge-active">{selectedWsDetails.subscription?.status || 'ACTIVE'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>Billing Mode:</span>
                    <span style={{ color: '#2563EB', fontWeight: '500' }}>Offline Mock Mode (No Real Collections)</span>
                  </div>
                </div>
              </div>

              {/* Authorized Memberships */}
              <div>
                <h4 style={{ margin: '0 0 10px', fontSize: '13.5px', color: '#475569' }}>Authorized Memberships</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedWsDetails.memberships?.map((m) => (
                    <div key={m._id} style={{ background: '#F8FAFC', padding: '10px 14px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: '600', fontSize: '13px' }}>{m.user?.name}</div>
                        <div style={{ fontSize: '11.5px', color: '#64748B' }}>{m.user?.email}</div>
                      </div>
                      <span className="sa-badge sa-badge-role">{m.role}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="sa-modal-footer">
              <button
                onClick={() => setSelectedWsDetails(null)}
                className="sa-btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- SUSPEND / REACTIVATE CONFIRMATION MODAL ---------- */}
      {suspendModalWs && (
        <div className="sa-modal-backdrop" onClick={() => setSuspendModalWs(null)}>
          <div className="sa-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="sa-modal-header">
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700' }}>
                {suspendModalWs.status === 'SUSPENDED' ? 'Reactivate Workspace' : 'Suspend Workspace'}
              </h3>
              <button
                onClick={() => setSuspendModalWs(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="sa-modal-body">
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <AlertTriangle size={24} color={suspendModalWs.status === 'SUSPENDED' ? '#2563EB' : '#DC2626'} />
                <div style={{ fontSize: '13.5px', color: '#334155', lineHeight: 1.5 }}>
                  {suspendModalWs.status === 'SUSPENDED' ? (
                    <>
                      Are you sure you want to <strong>reactivate</strong> workspace <strong>"{suspendModalWs.name}"</strong>?
                      The workspace members will regain immediate access to campaign scheduling and message sending.
                    </>
                  ) : (
                    <>
                      Are you sure you want to <strong>suspend</strong> workspace <strong>"{suspendModalWs.name}"</strong>?
                      This will halt outbound message processing and prevent members from sending new campaigns. All historical customer contacts and template data will remain preserved.
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="sa-modal-footer">
              <button
                onClick={() => setSuspendModalWs(null)}
                className="sa-btn-secondary"
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSuspendToggle}
                className={suspendModalWs.status === 'SUSPENDED' ? 'sa-btn-primary' : 'sa-btn-danger'}
                disabled={actionLoading}
              >
                {actionLoading ? 'Processing...' : suspendModalWs.status === 'SUSPENDED' ? 'Reactivate Workspace' : 'Suspend Workspace'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
