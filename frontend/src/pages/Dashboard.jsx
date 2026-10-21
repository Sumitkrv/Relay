import React, { useEffect, useState, useCallback } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  ChevronDown,
  Clock3,
  ContactRound,
  FileSpreadsheet,
  Globe,
  Inbox,
  Info,
  Layers,
  MessageSquareText,
  Plus,
  Radio,
  RotateCw,
  Server,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  UserCheck,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getDashboardOverview } from '../services/dashboard';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import SectionCard from '../components/SectionCard';
import { useWorkspace } from '../context/WorkspaceContext';
import WorkspaceGettingStartedPage from './WorkspaceGettingStartedPage';

function formatDateTime(dateVal, timezone = 'Asia/Kolkata') {
  if (!dateVal) return '—';
  try {
    const d = new Date(dateVal);
    if (Number.isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: timezone,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    return new Date(dateVal).toLocaleString();
  }
}

export default function Dashboard() {
  const { currentWorkspace } = useWorkspace();

  // Non-legacy newly provisioned tenants are safely gated to the Getting Started area
  if (currentWorkspace && currentWorkspace.slug !== 'm2w-realty') {
    return <WorkspaceGettingStartedPage />;
  }

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);
  const [dismissedAlerts, setDismissedAlerts] = useState({});
  const [checklistOpen, setChecklistOpen] = useState(false);

  const fetchDashboard = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await getDashboardOverview();
      setData(res);
      setError(null);
      setLastRefreshedAt(new Date());
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.message ||
        'Unable to load complete dashboard data. Verify your connection.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard(false);
  }, [fetchDashboard]);

  const contacts = data?.contacts || {};
  const campaigns = data?.campaigns || {};
  const upcomingCampaigns = data?.upcomingCampaigns || [];
  const inbox = data?.inbox || {};
  const provider = data?.provider || {};
  const system = data?.system || {};
  const activities = data?.activity || [];
  const alerts = data?.alerts || [];
  const onboarding = data?.onboarding || null;
  const businessContext = data?.businessContext || {};
  const timezone = businessContext.timezone || 'Asia/Kolkata';

  const totalContacts = contacts.total ?? 0;
  const verifiedOptedIn = contacts.verifiedOptedIn ?? 0;
  const scheduledCount = campaigns.scheduled ?? 0;
  const runningCount = campaigns.running ?? 0;
  const scheduledOrActive = scheduledCount + runningCount;

  // Filter alerts by session dismissal
  const activeAlerts = alerts.filter((a) => !dismissedAlerts[a.id]);

  return (
    <div className="dashboard-page">
      {/* SECTION A: Page Header & Quick Actions */}
      <PageHeader
        eyebrow={`WORKSPACE OVERVIEW · ${businessContext.businessName || 'M2W REALTY'}`}
        title="Overview"
        subtitle="Manage your contacts, campaigns and WhatsApp activity from one place."
        actions={
          <>
            <button
              type="button"
              className="outline-btn small"
              onClick={() => fetchDashboard(true)}
              disabled={refreshing || loading}
              title={lastRefreshedAt ? `Last updated: ${lastRefreshedAt.toLocaleTimeString()}` : 'Refresh dashboard'}
              aria-label="Refresh dashboard data"
            >
              <RotateCw size={13} className={refreshing ? 'refresh-spinning' : ''} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
            <Link className="outline-btn small" to="/import">
              <FileSpreadsheet size={14} /> Import contacts
            </Link>
            <Link className="primary-btn small" to="/campaigns/new">
              <Plus size={14} /> New campaign
            </Link>
          </>
        }
      />

      {/* Global Error Banner */}
      {error && (
        <div className="inline-error" role="alert" style={{ marginBottom: '4px' }}>
          <AlertCircle size={16} />
          <span>{error}</span>
          <button
            type="button"
            onClick={() => fetchDashboard(true)}
            className="text-link"
            style={{ marginLeft: 'auto', fontWeight: 600 }}
          >
            Retry
          </button>
        </div>
      )}

      {/* SECTION B: Four Primary KPI Cards */}
      <div className="stat-grid">
        <StatCard
          label="Total Contacts"
          value={loading ? null : totalContacts.toLocaleString()}
          icon={ContactRound}
          to="/contacts"
          tint={0}
          loading={loading}
          footerText="Saved property enquiry records"
        />
        <StatCard
          label="Verified Opted-in Contacts"
          value={loading ? null : verifiedOptedIn.toLocaleString()}
          icon={ShieldCheck}
          to="/contacts?whatsappConsentStatus=Opted%20In"
          tint={1}
          loading={loading}
          footerText="Affirmative recorded consent"
          badgeText={
            totalContacts > 0
              ? `${Math.round((verifiedOptedIn / totalContacts) * 100)}% eligible`
              : null
          }
        />
        <StatCard
          label="Scheduled / Active Campaigns"
          value={loading ? null : scheduledOrActive.toLocaleString()}
          icon={Target}
          to="/campaigns"
          tint={2}
          loading={loading}
          footerText={`${scheduledCount} scheduled · ${runningCount} running (Mock)`}
        />
        <StatCard
          label="Verified Customer Replies"
          value={loading ? null : (inbox.verifiedReplies !== null ? inbox.verifiedReplies : 'Not available')}
          icon={Inbox}
          to="/inbox"
          tint={3}
          loading={loading}
          footerText="Connect WhatsApp to see verified customer replies."
        />
      </div>

      {/* Quick Actions Row */}
      <div className="quick-actions-bar">
        <Link to="/import" className="quick-action-card">
          <div className="quick-action-icon">
            <FileSpreadsheet size={16} />
          </div>
          <div className="quick-action-text">
            <strong>Import Contacts</strong>
            <span>Upload XLSX or CSV property leads</span>
          </div>
          <ArrowRight size={14} className="text-muted" style={{ marginLeft: 'auto' }} />
        </Link>
        <Link to="/templates" className="quick-action-card">
          <div className="quick-action-icon">
            <MessageSquareText size={16} />
          </div>
          <div className="quick-action-text">
            <strong>Create Template</strong>
            <span>Personalized real estate messages</span>
          </div>
          <ArrowRight size={14} className="text-muted" style={{ marginLeft: 'auto' }} />
        </Link>
        <Link to="/campaigns/new" className="quick-action-card">
          <div className="quick-action-icon">
            <Boxes size={16} />
          </div>
          <div className="quick-action-text">
            <strong>Create Campaign</strong>
            <span>Plan audience snapshot & schedule</span>
          </div>
          <ArrowRight size={14} className="text-muted" style={{ marginLeft: 'auto' }} />
        </Link>
        <Link to="/inbox" className="quick-action-card">
          <div className="quick-action-icon">
            <Inbox size={16} />
          </div>
          <div className="quick-action-text">
            <strong>Open Inbox</strong>
            <span>Review conversations & follow-ups</span>
          </div>
          <ArrowRight size={14} className="text-muted" style={{ marginLeft: 'auto' }} />
        </Link>
      </div>

      {/* SECTION F: Onboarding Guidance (Collapsible Setup Widget) */}
      {onboarding && !onboarding.isComplete && (
        <div className="onboarding-card">
          <div
            className="onboarding-head"
            onClick={() => setChecklistOpen((v) => !v)}
            style={{ cursor: 'pointer', userSelect: 'none' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ChevronDown
                size={16}
                style={{
                  transform: checklistOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.2s ease',
                  color: 'var(--color-primary)',
                  flexShrink: 0
                }}
              />
              <div>
                <strong style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>
                  Relay Setup &amp; Readiness Checklist
                </strong>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                  {checklistOpen
                    ? 'Review core steps for property contacts, templates and campaign readiness.'
                    : `${onboarding.completedCount} of ${onboarding.totalSteps} steps completed · Click to view checklist`}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                className="neutral-chip"
                style={{
                  backgroundColor: 'var(--color-primary-soft)',
                  color: 'var(--color-primary)',
                  fontWeight: 600,
                }}
              >
                {onboarding.completedCount} of {onboarding.totalSteps} Completed
              </span>
              <span className="text-link" style={{ fontSize: '12px', fontWeight: 600 }}>
                {checklistOpen ? 'Collapse' : 'Expand'}
              </span>
            </div>
          </div>
          {checklistOpen && (
            <div className="onboarding-step-grid" style={{ marginTop: '14px' }}>
              {onboarding.steps.map((step) => (
                <Link
                  key={step.id}
                  to={step.path}
                  className={`onboarding-step-box ${step.completed ? 'completed' : ''}`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                      {step.label}
                    </span>
                    {step.completed ? (
                      <CheckCircle2 size={16} color="var(--color-success)" />
                    ) : (
                      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Action required</span>
                    )}
                  </div>
                  <span style={{ fontSize: '11.5px', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                    {step.description}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SECTION C: Campaign Overview & WhatsApp Provider Connection Status */}
      <div className="dashboard-grid-split">
        {/* Left: Campaign Overview */}
        <SectionCard
          title="Campaign Overview"
          subtitle="Lifecycle monitoring and recent audience plans"
          action={
            <Link to="/campaigns" className="text-link">
              View all campaigns <ArrowRight size={13} />
            </Link>
          }
        >
          {/* Segmented Status Pill Strip */}
          <div className="status-pill-strip">
            <span className="status-pill-item">
              Total <strong>{campaigns.total ?? 0}</strong>
            </span>
            <span className="status-pill-item">
              Draft <strong>{campaigns.draft ?? 0}</strong>
            </span>
            <span className="status-pill-item">
              Ready <strong>{campaigns.readyForPreparation ?? 0}</strong>
            </span>
            <span className="status-pill-item active">
              Scheduled (Mock) <strong>{campaigns.scheduled ?? 0}</strong>
            </span>
            <span className="status-pill-item">
              Running (Mock) <strong>{campaigns.running ?? 0}</strong>
            </span>
            <span className="status-pill-item">
              Completed (Mock) <strong>{campaigns.completed ?? 0}</strong>
            </span>
            {campaigns.failed > 0 && (
              <span className="status-pill-item" style={{ borderColor: 'var(--color-danger-border)', color: 'var(--color-danger)' }}>
                Failed <strong>{campaigns.failed}</strong>
              </span>
            )}
          </div>

          {/* Recent Campaigns Table */}
          {campaigns.recent && campaigns.recent.length > 0 ? (
            <div className="dashboard-table-container">
              <table className="dashboard-compact-table">
                <thead>
                  <tr>
                    <th>Campaign Name</th>
                    <th>Audience</th>
                    <th>Template</th>
                    <th>Status</th>
                    <th>Last Updated</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.recent.map((c) => (
                    <tr key={c._id}>
                      <td>
                        <strong style={{ color: 'var(--color-text-primary)' }}>{c.name}</strong>
                      </td>
                      <td>{c.audience} contacts</td>
                      <td style={{ color: c.requiresTemplate ? 'var(--color-warning)' : 'var(--color-text-secondary)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.requiresTemplate ? (
                          <Link to={`/campaigns/${c._id}/edit`} style={{ color: 'var(--color-warning)', fontWeight: 600, textDecoration: 'underline' }}>
                            {c.template}
                          </Link>
                        ) : (
                          c.template
                        )}
                      </td>
                      <td>
                        <span
                          className="status-badge"
                          style={{
                            backgroundColor:
                              c.status.includes('Scheduled') || c.status.includes('Running')
                                ? 'var(--color-primary-soft)'
                                : 'var(--color-surface-subtle)',
                            color:
                              c.status.includes('Scheduled') || c.status.includes('Running')
                                ? 'var(--color-primary)'
                                : 'var(--color-text-secondary)',
                            fontSize: '11px',
                          }}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td style={{ color: 'var(--color-text-muted)', fontSize: '11.5px' }}>
                        {c.updatedAt ? new Date(c.updatedAt).toLocaleDateString() : 'Recent'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Link to={`/campaigns/${c._id}`} className="text-link" style={{ fontSize: '12px' }}>
                          Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '36px 16px', textAlign: 'center' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'var(--color-surface-muted)', display: 'grid', placeItems: 'center', color: 'var(--color-text-muted)', marginBottom: '10px' }}>
                <Boxes size={22} />
              </div>
              <strong style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>No campaigns created yet</strong>
              <p style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)', maxWidth: '340px', margin: '4px 0 14px' }}>
                Create a campaign to prepare an audience snapshot and preview messages safely.
              </p>
              <Link to="/campaigns/new" className="primary-btn small">
                <Plus size={14} /> Create your first campaign
              </Link>
            </div>
          )}
        </SectionCard>

        {/* Right: WhatsApp Provider Connection Status */}
        <SectionCard
          title="WhatsApp Provider Status"
          subtitle="Meta Cloud API integration & system health"
          action={
            <Link to="/settings?tab=channels" className="text-link">
              Settings <ArrowRight size={13} />
            </Link>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="provider-health-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Radio size={15} color="var(--color-primary)" />
                <strong>Provider</strong>
              </div>
              <span className="provider-health-pill disconnected">
                {provider.providerName || 'Official WhatsApp Cloud API'}
              </span>
            </div>

            <div className="provider-health-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={15} color="var(--color-text-muted)" />
                <span>Connection Status</span>
              </div>
              <span className="provider-health-pill disconnected">
                {provider.connectionStatus || 'Disconnected'}
              </span>
            </div>

            <div className="provider-health-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={15} color="var(--color-primary)" />
                <span>Execution Mode</span>
              </div>
              <span className="provider-health-pill mock">
                {provider.executionMode || 'Mock Mode (Safe)'}
              </span>
            </div>

            {/* Separate System Diagnostics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '4px' }}>
              <div style={{ padding: '8px 10px', background: 'var(--color-surface-muted)', border: '1px solid var(--color-border)', borderRadius: '8px', textAlign: 'center' }}>
                <span style={{ fontSize: '10.5px', color: 'var(--color-text-muted)', display: 'block' }}>Backend</span>
                <strong style={{ fontSize: '11.5px', color: 'var(--color-success)' }}>
                  {system.backendHealth || 'CRM Online'}
                </strong>
              </div>
              <div style={{ padding: '8px 10px', background: 'var(--color-surface-muted)', border: '1px solid var(--color-border)', borderRadius: '8px', textAlign: 'center' }}>
                <span style={{ fontSize: '10.5px', color: 'var(--color-text-muted)', display: 'block' }}>Database</span>
                <strong style={{ fontSize: '11.5px', color: 'var(--color-success)' }}>
                  {system.databaseHealth || 'Connected'}
                </strong>
              </div>
              <div style={{ padding: '8px 10px', background: 'var(--color-surface-muted)', border: '1px solid var(--color-border)', borderRadius: '8px', textAlign: 'center' }}>
                <span style={{ fontSize: '10.5px', color: 'var(--color-text-muted)', display: 'block' }}>Worker</span>
                <strong style={{ fontSize: '11.5px', color: 'var(--color-primary)' }}>
                  {system.workerHealth || 'Active'}
                </strong>
              </div>
            </div>

            <p style={{ fontSize: '11.5px', color: 'var(--color-text-muted)', lineHeight: 1.45, margin: '2px 0 0' }}>
              External WhatsApp Cloud API sending is disabled in safe sandbox mode. All campaign executions run in isolated simulation without sending live WhatsApp messages.
            </p>

            <Link
              to="/settings?tab=channels"
              className="outline-btn small"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              Open Integration Settings <ArrowRight size={13} />
            </Link>
          </div>
        </SectionCard>
      </div>

      {/* SECTION D: Upcoming Scheduled Campaigns & Inbox Summary */}
      <div className="dashboard-grid-equal">
        {/* Left: Upcoming Scheduled Campaigns */}
        <SectionCard
          title="Upcoming Scheduled Campaigns"
          subtitle={`Genuinely persisted future mock runs (${timezone})`}
          action={
            <Link to="/campaigns" className="text-link">
              View campaigns <ArrowRight size={13} />
            </Link>
          }
        >
          {upcomingCampaigns.length > 0 ? (
            <div className="dashboard-table-container">
              <table className="dashboard-compact-table">
                <thead>
                  <tr>
                    <th>Campaign</th>
                    <th>Scheduled Time</th>
                    <th>Audience</th>
                    <th>Mode</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingCampaigns.map((c) => (
                    <tr key={c._id}>
                      <td>
                        <strong style={{ color: 'var(--color-text-primary)' }}>{c.name}</strong>
                        {c.requiresTemplate && (
                          <small style={{ display: 'block', color: 'var(--color-warning)', fontWeight: 600, fontSize: '11px' }}>
                            <Link to={`/campaigns/${c._id}/edit`} style={{ color: 'inherit', textDecoration: 'underline' }}>
                              ⚠️ Template Required
                            </Link>
                          </small>
                        )}
                      </td>
                      <td style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>
                        {formatDateTime(c.scheduledStartAt, c.timezone || timezone)}
                      </td>
                      <td>{c.audienceSize} contacts</td>
                      <td>
                        <span className="status-badge" style={{ backgroundColor: 'var(--color-primary-soft)', color: 'var(--color-primary)', fontSize: '11px' }}>
                          {c.executionMode}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Link to={`/campaigns/${c._id}`} className="text-link" style={{ fontSize: '12px' }}>
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '36px 16px', textAlign: 'center' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--color-surface-muted)', display: 'grid', placeItems: 'center', color: 'var(--color-text-muted)', marginBottom: '8px' }}>
                <Clock3 size={20} />
              </div>
              <strong style={{ fontSize: '13.5px', color: 'var(--color-text-primary)' }}>No campaigns scheduled</strong>
              <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', maxWidth: '300px', margin: '4px 0 12px' }}>
                Upcoming campaign schedules will appear here in your configured timezone.
              </p>
              <Link to="/campaigns" className="outline-btn small">
                <Clock3 size={13} /> Schedule a Campaign
              </Link>
            </div>
          )}
        </SectionCard>

        {/* Right: Inbox Summary */}
        <SectionCard
          title="Inbox & Follow-up Summary"
          subtitle="Internal CRM conversations & auto-reply readiness"
          action={
            <Link to="/inbox" className="text-link">
              Open Inbox <ArrowRight size={13} />
            </Link>
          }
        >
          <div className="inbox-summary-grid">
            <div className="inbox-summary-box">
              <span>Open Conversations</span>
              <strong>{inbox.openConversations ?? 0}</strong>
            </div>
            <div className="inbox-summary-box">
              <span>Needing Review / Tasks</span>
              <strong>{inbox.needsReview ?? 0}</strong>
            </div>
            <div className="inbox-summary-box">
              <span>Internal Unread</span>
              <strong>{inbox.internalUnread ?? 0}</strong>
            </div>
            <div className="inbox-summary-box">
              <span>Verified WhatsApp Replies</span>
              <strong style={{ fontSize: '14px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                {inbox.verifiedReplies !== null ? inbox.verifiedReplies : 'Not available'}
              </strong>
            </div>
          </div>

          <div className="inbox-provider-notice">
            <Info size={16} color="var(--color-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>Internal CRM vs Live WhatsApp:</strong> Conversation records, follow-up notes, and auto-reply rules are fully operational in your internal CRM. Verified customer replies will display once official WhatsApp Cloud API is connected.
            </div>
          </div>

          <Link
            to="/inbox"
            className="outline-btn small"
            style={{ width: '100%', justifyContent: 'center', marginTop: '12px' }}
          >
            Open Inbox & Auto-reply <ArrowRight size={13} />
          </Link>
        </SectionCard>
      </div>

      {/* SECTION E: Recent Activity & Needs Attention */}
      <div className="dashboard-grid-equal">
        {/* Left: Recent Activity Timeline */}
        <SectionCard
          title="Recent Activity"
          subtitle="Audit trail of property contacts, campaigns & security"
          action={
            <Link to="/activity" className="text-link">
              All logs <ArrowRight size={13} />
            </Link>
          }
        >
          {activities.length > 0 ? (
            <div className="activity-list">
              {activities.slice(0, 6).map((a) => (
                <div
                  key={a._id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '9px 0',
                    borderBottom: '1px solid var(--color-border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '30px',
                        height: '30px',
                        borderRadius: '8px',
                        backgroundColor:
                          a.module === 'Contacts'
                            ? 'var(--color-primary-soft)'
                            : a.module === 'Campaigns'
                            ? '#F3E8FF'
                            : 'var(--color-surface-muted)',
                        color:
                          a.module === 'Contacts'
                            ? 'var(--color-primary)'
                            : a.module === 'Campaigns'
                            ? '#9333EA'
                            : 'var(--color-text-secondary)',
                        display: 'grid',
                        placeItems: 'center',
                      }}
                    >
                      {a.module === 'Contacts' ? (
                        <ContactRound size={14} />
                      ) : a.module === 'Campaigns' ? (
                        <Target size={14} />
                      ) : (
                        <Activity size={14} />
                      )}
                    </div>
                    <div>
                      <strong style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}>
                        {a.title}
                      </strong>
                      <span style={{ fontSize: '11.5px', color: 'var(--color-text-muted)', display: 'block' }}>
                        {a.description}
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span
                      className="neutral-chip"
                      style={{ fontSize: '10px', padding: '2px 6px', display: 'inline-block' }}
                    >
                      {a.source}
                    </span>
                    <time style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block', marginTop: '2px' }}>
                      {a.timestamp ? new Date(a.timestamp).toLocaleDateString() : 'Recent'}
                    </time>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px', background: 'var(--color-surface-muted)', borderRadius: '8px' }}>
              <Activity size={16} color="var(--color-text-muted)" />
              <span style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)' }}>
                No recent activity logged yet. Activity appears as contacts are imported and campaigns are created.
              </span>
            </div>
          )}
        </SectionCard>

        {/* Right: Needs Attention Operational Alerts */}
        <SectionCard
          title="Needs Attention"
          subtitle="Operational checks and workspace condition alerts"
          action={
            <span style={{ fontSize: '11.5px', color: 'var(--color-text-muted)' }}>
              {activeAlerts.length} active
            </span>
          }
        >
          {activeAlerts.length > 0 ? (
            <div className="attention-list">
              {activeAlerts.map((alert) => (
                <div key={alert.id} className={`attention-item ${alert.severity}`}>
                  {alert.severity === 'error' ? (
                    <ShieldAlert size={18} color="var(--color-danger)" style={{ flexShrink: 0, marginTop: '2px' }} />
                  ) : alert.severity === 'warning' ? (
                    <AlertTriangle size={18} color="var(--color-warning)" style={{ flexShrink: 0, marginTop: '2px' }} />
                  ) : (
                    <Info size={18} color="var(--color-info)" style={{ flexShrink: 0, marginTop: '2px' }} />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <strong style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}>
                        {alert.title}
                      </strong>
                      <span className="neutral-chip" style={{ fontSize: '10.5px' }}>
                        {alert.module}
                      </span>
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '3px 0 6px' }}>
                      {alert.message}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Link to={alert.actionPath} className="text-link" style={{ fontSize: '12px', fontWeight: 600 }}>
                        {alert.actionLabel} &rarr;
                      </Link>
                      {alert.severity === 'info' && (
                        <button
                          type="button"
                          onClick={() => setDismissedAlerts((prev) => ({ ...prev, [alert.id]: true }))}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            fontSize: '11px',
                            color: 'var(--color-text-muted)',
                            cursor: 'pointer',
                          }}
                        >
                          Dismiss notice
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px', background: 'var(--color-surface-muted)', borderRadius: '10px' }}>
              <CheckCircle2 size={18} color="var(--color-success)" />
              <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                All system checks nominal. Workspace operating safely in mock execution mode.
              </span>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
