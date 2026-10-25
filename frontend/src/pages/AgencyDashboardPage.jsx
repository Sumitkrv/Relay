import React, { useState, useEffect, useCallback } from 'react';
import {
  Briefcase,
  Users,
  Building2,
  Palette,
  Globe,
  Plus,
  CheckCircle2,
  Clock,
  ExternalLink,
  Shield,
  ArrowLeft,
  Mail,
  RefreshCw,
  Sparkles,
  AlertTriangle,
  X,
  Copy,
  Check,
  Menu,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import agencyService from '../services/agency.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useWorkspace } from '../context/WorkspaceContext.jsx';
import toast from 'react-hot-toast';
import './agencyDashboard.css';

export default function AgencyDashboardPage() {
  const { user } = useAuth();
  const { selectWorkspace } = useWorkspace();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [agencyContext, setAgencyContext] = useState(null);
  const [clients, setClients] = useState([]);
  const [staff, setStaff] = useState([]);

  // Invite states
  const [clientEmail, setClientEmail] = useState('');
  const [clientSlug, setClientSlug] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffRole, setStaffRole] = useState('AGENCY_MANAGER');
  const [inviteLoading, setInviteLoading] = useState(false);

  // Branding states
  const [savingBranding, setSavingBranding] = useState(false);
  const [branding, setBranding] = useState({
    companyName: 'Spark Digital Agency',
    brandColor: '#2563EB',
    portalTitle: 'Client Automation Portal',
    supportEmail: 'support@sparkagency.test',
    supportPhone: '+919876500000',
    logoUrl: '',
    customDomain: 'crm.sparkagency.test',
    domainStatus: 'ACTIVE',
  });

  // Domain states
  const [domainLoading, setDomainLoading] = useState(false);
  const [copiedTxt, setCopiedTxt] = useState(false);

  const fetchAgencyData = useCallback(async () => {
    try {
      setLoading(true);
      const [contextData, clientsData, staffData] = await Promise.all([
        agencyService.getContext().catch(() => null),
        agencyService.getClients().catch(() => ({ clients: [] })),
        agencyService.getStaff().catch(() => ({ staff: [] })),
      ]);

      if (contextData?.agency) {
        setAgencyContext(contextData);
        if (contextData.agency.branding) {
          setBranding((prev) => ({
            ...prev,
            ...contextData.agency.branding,
            brandColor: contextData.agency.branding.brandColor || '#2563EB',
          }));
        }
      }

      if (clientsData?.clients) {
        setClients(clientsData.clients);
      } else if (contextData?.clients) {
        setClients(contextData.clients);
      }

      if (staffData?.staff) {
        setStaff(staffData.staff);
      }
    } catch (err) {
      toast.error('Failed to load agency dashboard: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgencyData();
  }, [fetchAgencyData]);

  // Handle entering a delegated client workspace
  const handleEnterWorkspace = async (workspaceId, workspaceName) => {
    try {
      await selectWorkspace(workspaceId);
      toast.success(`Entering ${workspaceName} under delegated agency access.`, { duration: 4000 });
      navigate('/app/overview');
    } catch (err) {
      toast.error('Could not switch to client workspace: ' + (err.response?.data?.message || err.message));
    }
  };

  // Revoke client delegation
  const handleRevokeClient = async (relationId, workspaceName) => {
    if (!window.confirm(`Are you sure you want to revoke agency access for "${workspaceName}"? This client will be detached from your portal.`)) {
      return;
    }

    try {
      await agencyService.revokeClient(relationId);
      toast.success(`Delegated access for "${workspaceName}" has been revoked.`);
      fetchAgencyData();
    } catch (err) {
      toast.error('Revocation failed: ' + (err.response?.data?.message || err.message));
    }
  };

  // Save branding
  const handleSaveBranding = async (e) => {
    e.preventDefault();
    try {
      setSavingBranding(true);
      await agencyService.updateBranding(branding);
      toast.success('Agency branding updated and saved to MongoDB.');
      fetchAgencyData();
    } catch (err) {
      toast.error('Failed to update branding: ' + (err.response?.data?.message || err.message));
    } finally {
      setSavingBranding(false);
    }
  };

  // Simulate domain verification
  const handleVerifyDomain = async () => {
    try {
      setDomainLoading(true);
      const res = await agencyService.verifyDomain();
      toast.success(`Custom domain simulated verification updated to: ${res.domainStatus}`);
      fetchAgencyData();
    } catch (err) {
      toast.error('Domain simulation failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setDomainLoading(false);
    }
  };

  // Invite Client
  const handleInviteClient = async (e) => {
    e.preventDefault();
    if (!clientEmail) return;

    try {
      setInviteLoading(true);
      await agencyService.inviteClient({
        clientEmail,
        workspaceSlug: clientSlug,
      });
      toast.success(`Client invitation dispatched to ${clientEmail}! Link stored in Local Mailbox (/dev/mailbox).`, { duration: 5000 });
      setClientEmail('');
      setClientSlug('');
      fetchAgencyData();
    } catch (err) {
      toast.error('Client invitation failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setInviteLoading(false);
    }
  };

  // Invite Staff
  const handleInviteStaff = async (e) => {
    e.preventDefault();
    if (!staffEmail) return;

    try {
      setInviteLoading(true);
      await agencyService.inviteStaff({
        email: staffEmail,
        role: staffRole,
      });
      toast.success(`Staff member ${staffEmail} added! Invitation stored in Local Mailbox (/dev/mailbox).`, { duration: 5000 });
      setStaffEmail('');
      fetchAgencyData();
    } catch (err) {
      toast.error('Staff invitation failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setInviteLoading(false);
    }
  };

  // Remove Staff
  const handleRemoveStaff = async (membershipId, staffName) => {
    if (!window.confirm(`Are you sure you want to remove team member "${staffName}"?`)) return;

    try {
      await agencyService.removeStaff(membershipId);
      toast.success(`Team member removed.`);
      fetchAgencyData();
    } catch (err) {
      toast.error('Removal failed: ' + (err.response?.data?.message || err.message));
    }
  };

  const copyTxtRecord = () => {
    const txt = `_relay-verification.${branding.customDomain || 'crm.agency.test'} IN TXT "relay-site-verification=mock-token-${branding.companyName.toLowerCase().replace(/\s+/g, '-')}"`;
    navigator.clipboard.writeText(txt);
    setCopiedTxt(true);
    setTimeout(() => setCopiedTxt(false), 2000);
    toast.success('DNS TXT record copied to clipboard');
  };

  return (
    <div className="ag-container">
      {/* ---------- AGENCY SIDEBAR ---------- */}
      <aside className={`ag-sidebar ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="ag-sidebar-header">
          <div className="ag-brand-lockup">
            <div
              className="ag-brand-icon"
              style={{ backgroundColor: branding.brandColor || '#2563EB' }}
            >
              <Briefcase size={18} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <span className="ag-brand-title">{branding.companyName || 'Agency Partner'}</span>
              <span className="ag-brand-sub">Client Portal</span>
            </div>
          </div>
        </div>

        <nav className="ag-nav">
          <div className="ag-nav-heading">Agency Operations</div>

          <button
            onClick={() => { setActiveTab('overview'); setMobileMenuOpen(false); }}
            className={`ag-nav-item ${activeTab === 'overview' ? 'active' : ''}`}
          >
            <Briefcase size={18} />
            <span>Overview</span>
          </button>

          <button
            onClick={() => { setActiveTab('clients'); setMobileMenuOpen(false); }}
            className={`ag-nav-item ${activeTab === 'clients' ? 'active' : ''}`}
          >
            <Building2 size={18} />
            <span>Client Workspaces</span>
            <span style={{ marginLeft: 'auto', fontSize: '11px', background: '#1E293B', padding: '1px 6px', borderRadius: '10px' }}>
              {clients.length}
            </span>
          </button>

          <button
            onClick={() => { setActiveTab('staff'); setMobileMenuOpen(false); }}
            className={`ag-nav-item ${activeTab === 'staff' ? 'active' : ''}`}
          >
            <Users size={18} />
            <span>Staff &amp; Access</span>
            <span style={{ marginLeft: 'auto', fontSize: '11px', background: '#1E293B', padding: '1px 6px', borderRadius: '10px' }}>
              {staff.length}
            </span>
          </button>

          <div className="ag-nav-heading">White-Label Customization</div>

          <button
            onClick={() => { setActiveTab('branding'); setMobileMenuOpen(false); }}
            className={`ag-nav-item ${activeTab === 'branding' ? 'active' : ''}`}
          >
            <Palette size={18} />
            <span>Branding &amp; Theme</span>
          </button>

          <button
            onClick={() => { setActiveTab('domains'); setMobileMenuOpen(false); }}
            className={`ag-nav-item ${activeTab === 'domains' ? 'active' : ''}`}
          >
            <Globe size={18} />
            <span>Custom Domain</span>
          </button>
        </nav>

        <div className="ag-sidebar-footer">
          <Link
            to="/dev/mailbox"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              background: '#111C30',
              border: '1px solid #26354C',
              color: '#38BDF8',
              textDecoration: 'none',
              fontSize: '12.5px',
              fontWeight: '500',
              padding: '7px 10px',
              borderRadius: '6px',
            }}
          >
            <Mail size={15} /> Local Dev Mailbox
          </Link>

          <Link
            to="/app"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              background: '#0B1220',
              border: '1px solid #1E293B',
              color: '#CBD5E1',
              textDecoration: 'none',
              fontSize: '12.5px',
              padding: '7px 10px',
              borderRadius: '6px',
            }}
          >
            <ArrowLeft size={15} /> Back to Relay App
          </Link>
        </div>
      </aside>

      {/* ---------- MAIN CONTENT ---------- */}
      <main className="ag-main">
        {/* Topbar */}
        <header className="ag-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{ display: 'none', background: 'transparent', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '6px' }}
              className="ag-mobile-btn"
            >
              <Menu size={18} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', color: '#64748B' }}>
              <span>Agency Portal</span>
              <span>/</span>
              <span style={{ color: '#0F172A', fontWeight: '600' }}>
                {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className="ag-badge ag-badge-active" style={{ fontSize: '12px', padding: '4px 10px' }}>
              {agencyContext?.role || 'AGENCY_OWNER'}
            </span>
            <button
              onClick={fetchAgencyData}
              disabled={loading}
              className="ag-btn-secondary"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </header>

        {/* Content Body */}
        <div className="ag-content">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <>
              <div>
                <h1 style={{ fontSize: '22px', fontWeight: '800', margin: 0, color: '#0F172A' }}>
                  {branding.companyName || 'Agency'} Partner Command
                </h1>
                <p style={{ fontSize: '13.5px', color: '#64748B', margin: '4px 0 0' }}>
                  Delegated client management, white-label branding, and team role authorization.
                </p>
              </div>

              {/* Informational banner */}
              <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '8px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', color: '#1E40AF' }}>
                <Shield size={18} />
                <div>
                  <strong>Strict Agency Isolation Active:</strong> You can only inspect and manage client workspaces that have explicitly delegated operational access to <strong>{branding.companyName}</strong>. Other agency relationships and unassigned businesses remain isolated.
                </div>
              </div>

              {/* KPI Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div className="ag-panel" style={{ padding: '18px 20px' }}>
                  <div style={{ fontSize: '12.5px', color: '#64748B', marginBottom: '8px' }}>Connected Client Workspaces</div>
                  <div style={{ fontSize: '26px', fontWeight: '800', color: '#0F172A' }}>{clients.length}</div>
                  <div style={{ fontSize: '11.5px', color: '#16A34A', marginTop: '6px' }}>Delegated and manageable</div>
                </div>

                <div className="ag-panel" style={{ padding: '18px 20px' }}>
                  <div style={{ fontSize: '12.5px', color: '#64748B', marginBottom: '8px' }}>Agency Team Members</div>
                  <div style={{ fontSize: '26px', fontWeight: '800', color: '#0F172A' }}>{staff.length || 3}</div>
                  <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '6px' }}>Managers &amp; Viewers</div>
                </div>

                <div className="ag-panel" style={{ padding: '18px 20px' }}>
                  <div style={{ fontSize: '12.5px', color: '#64748B', marginBottom: '8px' }}>Custom Domain Status</div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#2563EB', marginTop: '4px' }}>
                    {branding.domainStatus || 'DNS_PENDING'}
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '6px', fontFamily: 'monospace' }}>
                    {branding.customDomain || 'crm.sparkagency.test'}
                  </div>
                </div>

                <div className="ag-panel" style={{ padding: '18px 20px' }}>
                  <div style={{ fontSize: '12.5px', color: '#64748B', marginBottom: '8px' }}>White-Label Portal Title</div>
                  <div style={{ fontSize: '17px', fontWeight: '700', color: '#0F172A', marginTop: '6px' }}>
                    {branding.portalTitle || 'Client Automation Portal'}
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '6px' }}>
                    Color: <span style={{ color: branding.brandColor, fontWeight: '700' }}>{branding.brandColor}</span>
                  </div>
                </div>
              </div>

              {/* Connected Clients Quick Table */}
              <div className="ag-panel">
                <div className="ag-panel-header">
                  <span className="ag-panel-title">Delegated Client Businesses</span>
                  <button onClick={() => setActiveTab('clients')} className="ag-btn-secondary" style={{ fontSize: '12px', padding: '4px 10px' }}>
                    View All Clients →
                  </button>
                </div>

                <table className="ag-table">
                  <thead>
                    <tr>
                      <th>Business Workspace</th>
                      <th>Industry</th>
                      <th>Delegated Permissions</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.slice(0, 3).map((c, i) => {
                      const wsName = c.name || c.workspace?.name || 'Client Workspace';
                      const wsId = c.workspaceId || c.workspace?._id || c._id;
                      const industry = c.industryKey || c.workspace?.industryKey || 'general';
                      const perms = c.delegatedPermissions || ['contacts:read', 'campaigns:manage'];

                      return (
                        <tr key={i}>
                          <td>
                            <div style={{ fontWeight: '600', color: '#0F172A' }}>{wsName}</div>
                            <div style={{ fontSize: '11px', color: '#64748B' }}>slug: {c.slug || c.workspace?.slug}</div>
                          </td>
                          <td>
                            <span className="ag-badge" style={{ background: '#F1F5F9', color: '#475569' }}>
                              {industry}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                              {perms.map((p) => (
                                <span key={p} style={{ fontSize: '11px', background: '#EFF6FF', color: '#1D4ED8', padding: '2px 6px', borderRadius: '4px' }}>
                                  {p}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              onClick={() => handleEnterWorkspace(wsId, wsName)}
                              className="ag-btn-primary"
                              style={{ padding: '5px 10px', fontSize: '12px' }}
                            >
                              Open CRM →
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* TAB 2: CLIENT WORKSPACES */}
          {activeTab === 'clients' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Invite Client Box */}
              <div className="ag-panel" style={{ padding: '20px 24px' }}>
                <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: '700' }}>Invite Client Workspace</h3>
                <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#64748B' }}>
                  Send an agency invitation to a business owner. The verification link is securely intercepted in your local test mailbox (/dev/mailbox).
                </p>

                <form onSubmit={handleInviteClient} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', maxWidth: '640px' }}>
                  <input
                    type="email"
                    className="ag-input"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="client-owner@example.test"
                    required
                    style={{ flex: 1, minWidth: '220px' }}
                  />
                  <input
                    type="text"
                    className="ag-input"
                    value={clientSlug}
                    onChange={(e) => setClientSlug(e.target.value)}
                    placeholder="optional-workspace-slug"
                    style={{ width: '180px' }}
                  />
                  <button
                    type="submit"
                    disabled={inviteLoading}
                    className="ag-btn-primary"
                  >
                    <Plus size={15} />
                    <span>{inviteLoading ? 'Sending...' : 'Send Invite'}</span>
                  </button>
                </form>
              </div>

              {/* Clients Directory Table */}
              <div className="ag-panel">
                <div className="ag-panel-header">
                  <div>
                    <span className="ag-panel-title">Connected Client Workspaces ({clients.length})</span>
                    <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                      Businesses with delegated administrative privileges
                    </div>
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table className="ag-table">
                    <thead>
                      <tr>
                        <th>Client Workspace</th>
                        <th>Industry</th>
                        <th>Relationship Status</th>
                        <th>Delegated Scopes</th>
                        <th>Contacts / Campaigns</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clients.length > 0 ? (
                        clients.map((c, i) => {
                          const wsName = c.name || c.workspace?.name || 'Client Workspace';
                          const wsId = c.workspaceId || c.workspace?._id || c._id;
                          const relId = c.relationId || c._id;
                          const industry = c.industryKey || c.workspace?.industryKey || 'general';
                          const status = c.status || 'ACTIVE';
                          const perms = c.delegatedPermissions || ['contacts:read', 'campaigns:manage'];

                          return (
                            <tr key={i}>
                              <td>
                                <div style={{ fontWeight: '600', color: '#0F172A' }}>{wsName}</div>
                                <div style={{ fontSize: '11px', color: '#64748B', fontFamily: 'monospace' }}>
                                  {c.slug || c.workspace?.slug}
                                </div>
                              </td>
                              <td>
                                <span className="ag-badge" style={{ background: '#F1F5F9', color: '#475569' }}>
                                  {industry}
                                </span>
                              </td>
                              <td>
                                <span className={`ag-badge ${status === 'ACTIVE' ? 'ag-badge-active' : status === 'REVOKED' ? 'ag-badge-revoked' : 'ag-badge-pending'}`}>
                                  {status}
                                </span>
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', maxWidth: '280px' }}>
                                  {perms.map((p) => (
                                    <span key={p} style={{ fontSize: '11px', background: '#EFF6FF', color: '#1D4ED8', padding: '2px 6px', borderRadius: '4px' }}>
                                      {p}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td style={{ fontSize: '12.5px', color: '#475569' }}>
                                {c.contactsCount !== undefined ? `${c.contactsCount} contacts` : 'Metadata ready'}
                                {c.campaignsCount !== undefined ? ` • ${c.campaignsCount} campaigns` : ''}
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <div style={{ display: 'inline-flex', gap: '8px' }}>
                                  {status === 'ACTIVE' && (
                                    <button
                                      onClick={() => handleEnterWorkspace(wsId, wsName)}
                                      className="ag-btn-primary"
                                      style={{ padding: '5px 10px', fontSize: '12px' }}
                                    >
                                      Enter CRM →
                                    </button>
                                  )}
                                  {status !== 'REVOKED' && (
                                    <button
                                      onClick={() => handleRevokeClient(relId, wsName)}
                                      className="ag-btn-danger"
                                    >
                                      Revoke
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan="6" style={{ padding: '36px', textAlign: 'center', color: '#94A3B8' }}>
                            No client workspaces currently delegated. Send an invite above to connect a business.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: STAFF & DELEGATIONS */}
          {activeTab === 'staff' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Invite Staff Box */}
              <div className="ag-panel" style={{ padding: '20px 24px' }}>
                <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: '700' }}>Delegate Agency Team Member</h3>
                <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#64748B' }}>
                  Assign colleagues to manage client workspaces. Managers have operational permissions; Viewers have read-only inspection.
                </p>

                <form onSubmit={handleInviteStaff} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', maxWidth: '680px' }}>
                  <input
                    type="email"
                    className="ag-input"
                    value={staffEmail}
                    onChange={(e) => setStaffEmail(e.target.value)}
                    placeholder="colleague@sparkagency.test"
                    required
                    style={{ flex: 1, minWidth: '220px' }}
                  />
                  <select
                    className="ag-input"
                    value={staffRole}
                    onChange={(e) => setStaffRole(e.target.value)}
                    style={{ width: '220px' }}
                  >
                    <option value="AGENCY_MANAGER">Agency Manager (Operational)</option>
                    <option value="AGENCY_VIEWER">Agency Viewer (Read Only)</option>
                  </select>
                  <button
                    type="submit"
                    disabled={inviteLoading}
                    className="ag-btn-primary"
                  >
                    <Plus size={15} />
                    <span>{inviteLoading ? 'Inviting...' : 'Add Team Member'}</span>
                  </button>
                </form>
              </div>

              {/* Staff List */}
              <div className="ag-panel">
                <div className="ag-panel-header">
                  <span className="ag-panel-title">Authorized Agency Staff ({staff.length})</span>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table className="ag-table">
                    <thead>
                      <tr>
                        <th>Team Member</th>
                        <th>Agency Role</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staff.length > 0 ? (
                        staff.map((m) => (
                          <tr key={m._id}>
                            <td>
                              <div style={{ fontWeight: '600', color: '#0F172A' }}>{m.user?.name || 'Staff Member'}</div>
                              <div style={{ fontSize: '11.5px', color: '#64748B' }}>{m.user?.email}</div>
                            </td>
                            <td>
                              <span className="ag-badge ag-badge-role">{m.role}</span>
                            </td>
                            <td>
                              <span className="ag-badge ag-badge-active">{m.status}</span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {m.role !== 'AGENCY_OWNER' && (
                                <button
                                  onClick={() => handleRemoveStaff(m._id, m.user?.name || 'Staff')}
                                  className="ag-btn-danger"
                                >
                                  Remove
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="4" style={{ padding: '36px', textAlign: 'center', color: '#94A3B8' }}>
                            No additional team members added.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: WHITE-LABEL BRANDING */}
          {activeTab === 'branding' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
              {/* Branding Form */}
              <div className="ag-panel" style={{ padding: '24px' }}>
                <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: '700' }}>Agency White-Label Branding</h3>
                <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#64748B' }}>
                  Customize your brand colors, company identity, and portal title. These settings dynamically skin the client portal interface.
                </p>

                <form onSubmit={handleSaveBranding} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                      Agency Display Name
                    </label>
                    <input
                      type="text"
                      className="ag-input"
                      value={branding.companyName}
                      onChange={(e) => setBranding({ ...branding, companyName: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                      Brand Primary Accent Color (HEX)
                    </label>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <input
                        type="color"
                        value={branding.brandColor}
                        onChange={(e) => setBranding({ ...branding, brandColor: e.target.value })}
                        style={{ width: '42px', height: '36px', border: '1px solid #CBD5E1', borderRadius: '6px', cursor: 'pointer', background: 'transparent' }}
                      />
                      <input
                        type="text"
                        className="ag-input"
                        value={branding.brandColor}
                        onChange={(e) => setBranding({ ...branding, brandColor: e.target.value })}
                        style={{ flex: 1, fontFamily: 'monospace' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                      Client Portal Title
                    </label>
                    <input
                      type="text"
                      className="ag-input"
                      value={branding.portalTitle}
                      onChange={(e) => setBranding({ ...branding, portalTitle: e.target.value })}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                        Support Email
                      </label>
                      <input
                        type="email"
                        className="ag-input"
                        value={branding.supportEmail}
                        onChange={(e) => setBranding({ ...branding, supportEmail: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                        Support Phone
                      </label>
                      <input
                        type="text"
                        className="ag-input"
                        value={branding.supportPhone}
                        onChange={(e) => setBranding({ ...branding, supportPhone: e.target.value })}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={savingBranding}
                    className="ag-btn-primary"
                    style={{ marginTop: '8px', padding: '10px 18px', backgroundColor: branding.brandColor || '#2563EB' }}
                  >
                    <Sparkles size={16} />
                    <span>{savingBranding ? 'Saving Branding...' : 'Save Agency Branding'}</span>
                  </button>
                </form>
              </div>

              {/* Live Preview Card */}
              <div className="ag-panel" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '700', color: '#0F172A' }}>
                    Client Portal Live Preview
                  </span>
                  <span style={{ fontSize: '11px', background: '#F1F5F9', color: '#64748B', padding: '2px 8px', borderRadius: '4px' }}>
                    Instant Skin Rendering
                  </span>
                </div>

                <div style={{ border: '1px solid #CBD5E1', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)' }}>
                  {/* Mock Portal Header */}
                  <div style={{ backgroundColor: branding.brandColor || '#2563EB', padding: '16px 20px', color: '#FFFFFF', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '28px', height: '28px', background: 'rgba(255, 255, 255, 0.25)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800' }}>
                        {branding.companyName ? branding.companyName.charAt(0).toUpperCase() : 'A'}
                      </div>
                      <span style={{ fontWeight: '700', fontSize: '15px' }}>{branding.companyName || 'Agency Partner'}</span>
                    </div>
                    <span style={{ fontSize: '11px', background: 'rgba(255, 255, 255, 0.2)', padding: '2px 8px', borderRadius: '4px' }}>
                      Client Access Mode
                    </span>
                  </div>

                  {/* Mock Portal Body */}
                  <div style={{ padding: '20px', background: '#FFFFFF' }}>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: '#0F172A', marginBottom: '4px' }}>
                      {branding.portalTitle || 'Client Automation Portal'}
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#64748B', marginBottom: '16px' }}>
                      Connected to: {branding.customDomain || 'crm.sparkagency.test'}
                    </div>

                    <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '14px', fontSize: '12.5px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div><strong>Support Contact:</strong> {branding.supportEmail || 'support@agency.test'}</div>
                      <div><strong>Helpline:</strong> {branding.supportPhone || '+91 98765 00000'}</div>
                      <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '4px' }}>
                        White-labeled experience powered by Relay infrastructure.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: CUSTOM DOMAIN SIMULATION */}
          {activeTab === 'domains' && (
            <div className="ag-panel" style={{ padding: '24px', maxWidth: '820px' }}>
              <h3 style={{ margin: '0 0 6px', fontSize: '17px', fontWeight: '700' }}>
                Agency Custom Domain Setup &amp; Verification
              </h3>
              <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#64748B' }}>
                Map a branded domain for your agency portal. Complete verification using standard DNS challenge records.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                    Configured Hostname
                  </label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input
                      type="text"
                      className="ag-input"
                      value={branding.customDomain}
                      onChange={(e) => setBranding({ ...branding, customDomain: e.target.value })}
                      placeholder="crm.sparkagency.test"
                      style={{ flex: 1, fontFamily: 'monospace' }}
                    />
                    <button
                      onClick={handleSaveBranding}
                      disabled={savingBranding}
                      className="ag-btn-secondary"
                    >
                      Save Domain
                    </button>
                  </div>
                </div>

                {/* DNS Instructions Box */}
                <div style={{ background: '#0B1220', color: '#E2E8F0', borderRadius: '8px', padding: '18px 20px', border: '1px solid #1E293B' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#60A5FA' }}>
                      Required DNS TXT Verification Record:
                    </span>
                    <button
                      onClick={copyTxtRecord}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#1E293B', border: '1px solid #334155', color: '#F8FAFC', padding: '4px 10px', borderRadius: '5px', fontSize: '11.5px', cursor: 'pointer' }}
                    >
                      {copiedTxt ? <Check size={13} color="#10B981" /> : <Copy size={13} />}
                      <span>{copiedTxt ? 'Copied' : 'Copy Record'}</span>
                    </button>
                  </div>

                  <div style={{ background: '#070D18', padding: '12px 14px', borderRadius: '6px', fontFamily: 'monospace', fontSize: '12px', color: '#CBD5E1', wordBreak: 'break-all' }}>
                    _relay-verification.{branding.customDomain || 'crm.agency.test'} IN TXT "relay-site-verification=mock-token-{branding.companyName.toLowerCase().replace(/\s+/g, '-')}"
                  </div>

                  <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '10px' }}>
                    CNAME Target: <span style={{ fontFamily: 'monospace', color: '#38BDF8' }}>proxy.relaycrm.test</span>
                  </div>
                </div>

                {/* State Machine Status */}
                <div style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#0F172A' }}>
                      Domain Verification Lifecycle
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748B', marginTop: '3px' }}>
                      Current Status:{' '}
                      <span className={`ag-badge ${branding.domainStatus === 'ACTIVE' ? 'ag-badge-active' : 'ag-badge-pending'}`}>
                        {branding.domainStatus}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={handleVerifyDomain}
                    disabled={domainLoading}
                    className="ag-btn-primary"
                  >
                    <RefreshCw size={14} className={domainLoading ? 'animate-spin' : ''} />
                    <span>{domainLoading ? 'Verifying...' : 'Simulate DNS & TLS Verification'}</span>
                  </button>
                </div>

                <div style={{ fontSize: '12px', color: '#64748B', fontStyle: 'italic' }}>
                  * Development Notice: Simulated state machine for local validation. Public DNS registration and external Let's Encrypt certificates are not issued in offline development mode.
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
