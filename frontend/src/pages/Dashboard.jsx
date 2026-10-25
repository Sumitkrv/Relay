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
  Inbox,
  Info,
  MessageSquareText,
  Plus,
  Reply,
  RotateCw,
  Send,
  Settings as SettingsIcon,
  ShieldAlert,
  ShieldCheck,
  Target,
  Bot,
  MessagesSquare,
  Lock,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getDashboardOverview } from '../services/dashboard';
import PageHeader from '../components/PageHeader';
import { useWorkspace } from '../context/WorkspaceContext';
import '../overview.css';

/* ---- Industry-aware copy (single central mapping) ------------------------ */
/* ---- Time helpers (workspace timezone) ----------------------------------- */
function dayKey(d, timeZone) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export function formatEventTime(dateVal, timeZone = 'Asia/Kolkata', now = new Date()) {
  if (!dateVal) return '—';
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return '—';
  try {
    const time = new Intl.DateTimeFormat('en-IN', { timeZone, hour: 'numeric', minute: '2-digit', hour12: true }).format(d);
    const today = dayKey(now, timeZone);
    const yesterday = dayKey(new Date(now.getTime() - 86400000), timeZone);
    const key = dayKey(d, timeZone);
    if (key === today) return `Today, ${time}`;
    if (key === yesterday) return `Yesterday, ${time}`;
    const date = new Intl.DateTimeFormat('en-IN', { timeZone, day: '2-digit', month: 'short' }).format(d);
    return `${date}, ${time}`;
  } catch {
    return d.toLocaleString();
  }
}

function formatExact(dateVal, timeZone = 'Asia/Kolkata') {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return `${new Intl.DateTimeFormat('en-IN', { timeZone, day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).format(d)} (${timeZone})`;
  } catch {
    return d.toISOString();
  }
}

function formatDateTime(dateVal, timeZone = 'Asia/Kolkata') {
  const s = formatExact(dateVal, timeZone);
  return s ? s.replace(/ \(.*\)$/, '') : '—';
}

function sentenceCase(text = '') {
  const t = String(text).replaceAll('_', ' ').trim().toLowerCase();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
}

const MODULE_META = {
  Contacts: { icon: ContactRound, tone: 'blue', label: 'Contacts' },
  Campaigns: { icon: Target, tone: 'violet', label: 'Campaign' },
  Inbox: { icon: MessagesSquare, tone: 'blue', label: 'Inbox' },
  Settings: { icon: SettingsIcon, tone: '', label: 'Settings' },
};

// Hide descriptions that merely repeat the title (e.g. "login success" / "Security: login success").
function showDesc(title, description) {
  const norm = (t) => String(t || '').toLowerCase().replace(/^security:\s*/, '').replace(/[^a-z0-9 ]/g, '').trim();
  return Boolean(description) && norm(description) !== norm(title);
}

function eventMeta(a) {
  if (a.eventType === 'auto_reply_executed') return { icon: Bot, tone: 'violet', label: 'Auto-reply' };
  if (a.source === 'Security Audit') return { icon: Lock, tone: 'amber', label: 'Security' };
  return MODULE_META[a.module] || { icon: Activity, tone: '', label: 'Activity' };
}

/* ---- Small building blocks ----------------------------------------------- */
function Kpi({ label, value, icon: Icon, to, loading, foot, badge }) {
  const Tag = to ? Link : 'div';
  const props = to ? { to } : {};
  return (
    <Tag {...props} className="ov-card ov-kpi" aria-label={`${label}: ${loading ? 'loading' : value}`}>
      <div className="ov-kpi-top">
        <span className="ov-kpi-label">{label}</span>
        <span className="ov-kpi-icon" aria-hidden="true"><Icon size={17} /></span>
      </div>
      <div className="ov-kpi-value">{loading ? <span className="ov-skeleton" aria-hidden="true" /> : value}</div>
      <div className="ov-kpi-foot">
        <span>{foot}</span>
        {badge ? <span className="ov-badge">{badge}</span> : null}
      </div>
    </Tag>
  );
}

function Mini({ label, value, help, dot, loading }) {
  return (
    <div className="ov-card ov-mini">
      <span className="ov-mini-label"><i className={`ov-dot ${dot}`} aria-hidden="true" />{label}</span>
      <strong className="ov-mini-value">{loading ? '—' : Number(value || 0).toLocaleString()}</strong>
      <span className="ov-mini-help">{help}</span>
    </div>
  );
}

function Card({ title, subtitle, action, children, id }) {
  return (
    <section className="ov-card" aria-labelledby={id}>
      <div className="ov-card-head">
        <div>
          <h2 className="ov-card-title" id={id}>{title}</h2>
          {subtitle && <p className="ov-card-sub">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="ov-card-body">{children}</div>
    </section>
  );
}

export default function Dashboard() {
  const { currentWorkspace, industryConfig } = useWorkspace();

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

  const mockMessages = data?.mockMessages || { total: 0, sent: 0, delivered: 0, read: 0, failed: 0 };
  const autoReplyExecutions = data?.autoReplyExecutions || 0;

  const industryKey = industryConfig.industryKey;
  const copy = industryConfig.ui.dashboard;
  const workspaceName = currentWorkspace?.name || businessContext.businessName || 'Workspace';

  const totalContacts = contacts.total ?? 0;
  const verifiedOptedIn = contacts.verifiedOptedIn ?? 0;
  const scheduledCount = campaigns.scheduled ?? 0;
  const runningCount = campaigns.running ?? 0;
  const scheduledOrActive = scheduledCount + runningCount;
  const openConversations = inbox.openConversations ?? 0;
  const needsReview = inbox.needsReview ?? 0;
  const liveRepliesAvailable = inbox.verifiedReplies !== null && inbox.verifiedReplies !== undefined;

  // Health: only show a positive state when the backend actually told us so.
  const known = Boolean(data) && !error;
  const backendOk = known && /online/i.test(system.backendHealth || '');
  const dbOk = known && /connected/i.test(system.databaseHealth || '') && !/degraded/i.test(system.databaseHealth || '');
  const workerOk = known && system.workerRunning === true;
  const appStatus = !known ? 'Unavailable' : backendOk && dbOk ? 'Operational' : 'Degraded';
  const appDot = !known ? '' : backendOk && dbOk ? 'ok' : 'bad';
  const liveConnected = /^connected$/i.test(provider.connectionStatus || '');

  // Action center: only genuinely actionable items count.
  const visibleAlerts = alerts.filter((a) => !dismissedAlerts[a.id]);
  const actionable = visibleAlerts.filter((a) => !a.optional && a.severity !== 'info');
  const optional = visibleAlerts.filter((a) => a.optional || a.severity === 'info');

  const progressPct = onboarding && onboarding.totalSteps
    ? Math.round((onboarding.completedCount / onboarding.totalSteps) * 100)
    : 0;
  const nextStep = onboarding?.steps?.find((s) => !s.completed);

  if (error && !data) return <div className="ov-error" role="alert"><p>{error}</p><button onClick={() => fetchDashboard(true)}>Retry dashboard</button></div>;

  return (
    <div className="dashboard-page ov-page">
      {/* SECTION 1: Header */}
      <PageHeader
        eyebrow={`Workspace overview · ${workspaceName}`}
        title="Overview"
        subtitle={copy.subtitle}
        actions={
          <>
            <button
              type="button"
              className="ov-btn ghost small"
              onClick={() => fetchDashboard(true)}
              disabled={refreshing || loading}
              title={lastRefreshedAt ? `Last updated: ${lastRefreshedAt.toLocaleTimeString()}` : 'Refresh dashboard'}
              aria-label="Refresh dashboard data"
            >
              <RotateCw size={14} className={refreshing ? 'refresh-spinning' : ''} />
              <span>{refreshing ? 'Refreshing…' : 'Refresh'}</span>
            </button>
            <Link className="ov-btn small" to="/import">
              <FileSpreadsheet size={14} /> Import contacts
            </Link>
            <Link className="ov-btn primary small" to="/campaigns/new">
              <Plus size={14} /> New campaign
            </Link>
          </>
        }
      />

      {error && (
        <div className="ov-error" role="alert">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button type="button" onClick={() => fetchDashboard(true)} className="ov-link" style={{ marginLeft: 'auto' }}>
            Retry
          </button>
        </div>
      )}

      {/* SECTION 2: Compact status strip (single source of top-level status) */}
      <div className="ov-status" role="status" aria-label="Workspace status">
        <span className="ov-status-item"><span className="k">Workspace</span><strong>{workspaceName}</strong></span>
        <span className="ov-status-item"><i className={`ov-dot ${appDot}`} aria-hidden="true" /><span className="k">Application</span><strong>{appStatus}</strong></span>
        <span className="ov-status-item"><i className="ov-dot blue" aria-hidden="true" /><span className="k">Mode</span><strong>Mock Simulation</strong></span>
        <span className="ov-status-item">
          <i className={`ov-dot ${liveConnected ? 'ok' : ''}`} aria-hidden="true" />
          <span className="k">Live WhatsApp</span>
          <strong>{known ? (liveConnected ? 'Connected' : 'Not connected') : 'Unknown'}</strong>
        </span>
        <span className="ov-status-spacer" />
        <Link to="/settings?tab=channels">Integration settings</Link>
      </div>

      {/* SECTION 3: Primary KPIs */}
      <div className="ov-kpi-grid">
        <Kpi
          label="Total Contacts"
          value={totalContacts.toLocaleString()}
          icon={ContactRound}
          to="/contacts"
          loading={loading}
          foot="Contacts in this workspace"
        />
        <Kpi
          label="Verified Opted-in Contacts"
          value={verifiedOptedIn.toLocaleString()}
          icon={ShieldCheck}
          to="/contacts?whatsappConsentStatus=Opted%20In"
          loading={loading}
          foot="Affirmative recorded consent"
          badge={totalContacts > 0 ? `${Math.round((verifiedOptedIn / totalContacts) * 100)}% of contacts` : null}
        />
        <Kpi
          label="Scheduled / Active Campaigns"
          value={scheduledOrActive.toLocaleString()}
          icon={Target}
          to="/campaigns"
          loading={loading}
          foot={`${scheduledCount} scheduled · ${runningCount} running (Mock)`}
        />
        <Kpi
          label="Open Conversations"
          value={openConversations.toLocaleString()}
          icon={Inbox}
          to="/inbox"
          loading={loading}
          foot="Conversations requiring or awaiting follow-up."
          badge={needsReview > 0 ? `${needsReview} need review` : null}
        />
      </div>

      {/* SECTION 4: Secondary automation KPIs */}
      <div className="ov-mini-grid" aria-label="Mock automation metrics">
        <Mini label="Simulated Sent" value={mockMessages.sent} help="Mock engine queue" dot="blue" loading={loading} />
        <Mini label="Simulated Delivered" value={mockMessages.delivered} help="Mock receipts" dot="ok" loading={loading} />
        <Mini label="Simulated Read" value={mockMessages.read} help="Simulated reads" dot="violet" loading={loading} />
        <Mini label="Mock Failures" value={mockMessages.failed} help="Invalid or suppressed" dot={mockMessages.failed > 0 ? 'bad' : ''} loading={loading} />
        <Mini label="Auto-Reply Executions" value={autoReplyExecutions} help="Keyword rules fired" dot="blue" loading={loading} />
      </div>

      {/* SECTION 5: Quick actions */}
      <div className="quick-actions-bar ov-actions">
        {[
          {
            to: industryConfig.ui.contactAction.to,
            icon: industryConfig.ui.contactAction.icon === 'ContactRound' ? ContactRound : FileSpreadsheet,
            title: industryConfig.ui.contactAction.title,
            text: industryConfig.ui.contactAction.text,
          },
          {
            to: '/templates',
            icon: MessageSquareText,
            title: 'Create Template',
            text: copy.templateHint,
          },
          { to: '/campaigns/new', icon: Boxes, title: 'Create Campaign', text: copy.campaignHint },
          { to: '/inbox', icon: Inbox, title: 'Open Inbox', text: 'Review conversations and follow-ups' },
        ].map((a) => (
          <Link key={a.title} to={a.to} className="ov-card ov-action">
            <span className="ov-action-icon" aria-hidden="true"><a.icon size={18} /></span>
            <span className="ov-action-text">
              <strong>{a.title}</strong>
              <span title={a.text}>{a.text}</span>
            </span>
            <ArrowRight size={15} className="ov-action-arrow" aria-hidden="true" />
          </Link>
        ))}
      </div>

      {/* SECTION 6: Setup progress (compact, expandable) */}
      {onboarding && !onboarding.isComplete && (
        <div className="ov-card">
          <button
            type="button"
            className="ov-check-head"
            onClick={() => setChecklistOpen((v) => !v)}
            aria-expanded={checklistOpen}
            aria-controls="ov-setup-steps"
          >
            <div>
              <div className="ov-check-title">Relay Setup &amp; Readiness Checklist</div>
              <div className="ov-check-sub">
                {nextStep ? `Next: ${nextStep.label}` : 'All steps reviewed'}
              </div>
            </div>
            <span className="ov-badge">{onboarding.completedCount} of {onboarding.totalSteps} completed</span>
            <div
              className="ov-progress"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progressPct}
              aria-label="Setup progress"
            >
              <i style={{ width: `${progressPct}%` }} />
            </div>
            <ChevronDown size={18} className={`ov-check-chev ${checklistOpen ? 'open' : ''}`} aria-hidden="true" />
          </button>
          {checklistOpen && (
            <div className="ov-steps" id="ov-setup-steps">
              {onboarding.steps.map((step) => (
                <Link key={step.id} to={step.path} className={`ov-step ${step.completed ? 'done' : ''}`}>
                  <span className="ov-step-top">
                    <strong>{step.label}</strong>
                    {step.completed ? (
                      <CheckCircle2 size={16} color="#16A34A" aria-label="Completed" />
                    ) : (
                      <span className="ov-badge muted">Pending</span>
                    )}
                  </span>
                  <span className="d">{step.description}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SECTION 7: Main operational grid */}
      <div className="ov-main">
        <div className="ov-col">
          {/* Campaign Command Center */}
          <Card
            id="ov-campaigns-h"
            title="Campaign Command Center"
            subtitle="Campaign records, mock runs and what is coming up"
            action={
              <Link to="/campaigns" className="ov-link">View all campaigns <ArrowRight size={13} /></Link>
            }
          >
            <div className="ov-pills">
              <span className="ov-pill">Campaigns <strong>{campaigns.total ?? 0}</strong></span>
              <span className="ov-pill">Draft <strong>{campaigns.draft ?? 0}</strong></span>
              <span className="ov-pill">Ready <strong>{campaigns.readyForPreparation ?? 0}</strong></span>
              {(campaigns.awaitingApproval ?? 0) > 0 && (
                <span className="ov-pill">Awaiting template approval <strong>{campaigns.awaitingApproval}</strong></span>
              )}
              <span className="ov-pill hl">Scheduled (Mock) <strong>{campaigns.scheduled ?? 0}</strong></span>
              <span className="ov-pill">Running (Mock) <strong>{campaigns.running ?? 0}</strong></span>
              <span
                className="ov-pill"
                title="Number of completed mock execution runs (a campaign can be run more than once)."
              >
                Completed mock runs <strong>{campaigns.completedRuns ?? campaigns.completed ?? 0}</strong>
              </span>
              {campaigns.failed > 0 && (
                <span className="ov-pill bad">Failed runs <strong>{campaigns.failed}</strong></span>
              )}
            </div>

            {campaigns.recent && campaigns.recent.length > 0 ? (
              <div className="ov-table-wrap">
                <table className="ov-table">
                  <thead>
                    <tr>
                      <th>Campaign</th>
                      <th>Audience</th>
                      <th>Template</th>
                      <th>Status</th>
                      <th>Updated</th>
                      <th className="num">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.recent.map((c) => {
                      const active = /scheduled|running/i.test(c.status || '');
                      return (
                        <tr key={c._id}>
                          <td><span className="name ov-trunc" title={c.name}>{c.name}</span></td>
                          <td>{c.audience} contacts</td>
                          <td>
                            {c.requiresTemplate ? (
                              <Link to={`/campaigns/${c._id}/edit`} className="ov-badge warn">{c.template}</Link>
                            ) : (
                              <span className="ov-trunc" title={c.template}>{c.template}</span>
                            )}
                          </td>
                          <td><span className={`ov-badge ${active ? '' : 'muted'}`}>{c.status}</span></td>
                          <td style={{ color: 'var(--ov-muted)', whiteSpace: 'nowrap' }}>
                            {c.updatedAt ? formatEventTime(c.updatedAt, timezone) : '—'}
                          </td>
                          <td className="num"><Link to={`/campaigns/${c._id}`} className="ov-link">Details</Link></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="ov-empty">
                <span className="ov-empty-icon" aria-hidden="true"><Boxes size={17} /></span>
                <div className="ov-empty-text">
                  <strong>No campaigns created yet</strong>
                  <span>Create a campaign to prepare an audience snapshot and preview messages safely.</span>
                </div>
                <div className="ov-empty-cta">
                  <Link to="/campaigns/new" className="ov-btn primary small"><Plus size={14} /> Create campaign</Link>
                </div>
              </div>
            )}

            <div className="ov-sub-head">
              <h3>Upcoming scheduled campaigns</h3>
              {upcomingCampaigns.length > 0 && <span className="ov-badge muted">{timezone}</span>}
            </div>
            {upcomingCampaigns.length > 0 ? (
              <div className="ov-table-wrap">
                <table className="ov-table">
                  <thead>
                    <tr>
                      <th>Campaign</th>
                      <th>Scheduled</th>
                      <th>Audience</th>
                      <th>Mode</th>
                      <th className="num">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcomingCampaigns.map((c) => (
                      <tr key={c._id}>
                        <td>
                          <span className="name ov-trunc" title={c.name}>{c.name}</span>
                          {c.requiresTemplate && (
                            <Link to={`/campaigns/${c._id}/edit`} className="ov-badge warn" style={{ marginLeft: 6 }}>
                              <AlertTriangle size={11} /> Template required
                            </Link>
                          )}
                        </td>
                        <td style={{ whiteSpace: 'nowrap', color: 'var(--ov-muted)' }}>
                          {formatDateTime(c.scheduledStartAt, c.timezone || timezone)}
                        </td>
                        <td>{c.audienceSize} contacts</td>
                        <td><span className="ov-badge">{c.executionMode}</span></td>
                        <td className="num"><Link to={`/campaigns/${c._id}`} className="ov-link">View</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="ov-empty">
                <span className="ov-empty-icon" aria-hidden="true"><Clock3 size={17} /></span>
                <div className="ov-empty-text">
                  <strong>No campaigns scheduled</strong>
                  <span>{copy.scheduleHint}</span>
                </div>
                <div className="ov-empty-cta">
                  <Link to="/campaigns" className="ov-btn small">Schedule campaign</Link>
                  <Link to="/campaigns" className="ov-link" style={{ alignSelf: 'center' }}>View campaigns</Link>
                </div>
              </div>
            )}
          </Card>

          {/* Recent Activity timeline */}
          <Card
            id="ov-activity-h"
            title="Recent Activity"
            subtitle="Latest contact, campaign and inbox events"
            action={<Link to="/activity" className="ov-link">All logs <ArrowRight size={13} /></Link>}
          >
            {activities.length > 0 ? (
              <ol className="ov-timeline">
                {activities.slice(0, 6).map((a) => {
                  const meta = eventMeta(a);
                  const Icon = meta.icon;
                  const title = a.eventType === 'auto_reply_executed' ? a.title : sentenceCase(a.title);
                  return (
                    <li key={a._id} className="ov-event">
                      <span className={`ov-event-icon ${meta.tone}`} aria-hidden="true"><Icon size={15} /></span>
                      <div className="ov-event-body">
                        <div className="ov-event-title">
                          <strong>{title}</strong>
                          <time dateTime={a.timestamp} title={formatExact(a.timestamp, timezone)}>
                            {formatEventTime(a.timestamp, timezone)}
                          </time>
                        </div>
                        {showDesc(title, a.description) && <span className="ov-event-desc">{a.description}</span>}
                        <span className="ov-badge muted ov-event-cat">{meta.label}</span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <div className="ov-empty">
                <span className="ov-empty-icon" aria-hidden="true"><Activity size={17} /></span>
                <div className="ov-empty-text">
                  <strong>No recent activity yet</strong>
                  <span>Activity appears as contacts are added and campaigns are created.</span>
                </div>
                <div className="ov-empty-cta">
                  <Link to="/contacts" className="ov-btn small">Open Contacts</Link>
                </div>
              </div>
            )}
          </Card>
        </div>

        <div className="ov-col">
          {/* Messaging Health: the one place with provider + system details */}
          <Card
            id="ov-health-h"
            title="Messaging Health"
            subtitle="Provider mode and system readiness"
            action={<Link to="/settings?tab=channels" className="ov-link">Settings <ArrowRight size={13} /></Link>}
          >
            <div className="ov-health">
              <div className="ov-health-row">
                <span className="k"><Send size={14} aria-hidden="true" /> Active provider</span>
                <span className="v">Mock WhatsApp engine</span>
              </div>
              <div className="ov-health-row">
                <span className="k">Execution mode</span>
                <span className="v"><span className="ov-badge">Mock</span></span>
              </div>
              <div className="ov-health-row">
                <span className="k">Live WhatsApp ({provider.providerName ? 'Cloud API' : 'Meta'})</span>
                <span className="v"><i className={`ov-dot ${liveConnected ? 'ok' : ''}`} aria-hidden="true" />{known ? (provider.connectionStatus || 'Not connected') : 'Unknown'}</span>
              </div>
              <div className="ov-health-row">
                <span className="k">Backend</span>
                <span className="v"><i className={`ov-dot ${!known ? '' : backendOk ? 'ok' : 'bad'}`} aria-hidden="true" />{known ? (system.backendHealth || 'Unknown') : 'Unavailable'}</span>
              </div>
              <div className="ov-health-row">
                <span className="k">Database</span>
                <span className="v"><i className={`ov-dot ${!known ? '' : dbOk ? 'ok' : 'bad'}`} aria-hidden="true" />{known ? (system.databaseHealth || 'Unknown') : 'Unavailable'}</span>
              </div>
              <div className="ov-health-row">
                <span className="k">Worker</span>
                <span className="v" title={system.workerLastHeartbeat ? `Last heartbeat ${formatExact(system.workerLastHeartbeat, timezone)}` : undefined}>
                  <i className={`ov-dot ${!known ? '' : workerOk ? 'ok' : 'bad'}`} aria-hidden="true" />
                  {known ? (system.workerHealth || 'Unknown') : 'Unavailable'}
                </span>
              </div>
            </div>
            <div className="ov-note">
              <Info size={15} aria-hidden="true" />
              <span>Relay is running in Mock Mode. Campaigns and conversations are simulated; no live WhatsApp messages are sent.</span>
            </div>
          </Card>

          {/* Inbox & Follow-up Summary */}
          <Card
            id="ov-inbox-h"
            title="Inbox & Follow-up"
            subtitle="Internal CRM conversations"
            action={<Link to="/inbox" className="ov-link">Open Inbox &amp; Auto-reply <ArrowRight size={13} /></Link>}
          >
            <div className="ov-inbox-grid">
              <div className="ov-inbox-box"><span>Open</span><strong>{openConversations}</strong></div>
              <div className="ov-inbox-box"><span>Needs review</span><strong>{needsReview}</strong></div>
              <div className="ov-inbox-box"><span>Unread</span><strong>{inbox.internalUnread ?? 0}</strong></div>
            </div>
            <div className="ov-inbox-live">
              <Reply size={13} aria-hidden="true" style={{ flex: 'none', marginTop: 2 }} />
              <span>
                {liveRepliesAvailable
                  ? <>Verified WhatsApp replies: <strong>{inbox.verifiedReplies}</strong></>
                  : 'Verified WhatsApp replies appear once live WhatsApp is connected. These counts are internal CRM conversations.'}
              </span>
            </div>
          </Card>

          {/* Action Center */}
          <Card
            id="ov-ac-h"
            title="Action Center"
            subtitle={actionable.length > 0 ? `${actionable.length} item${actionable.length === 1 ? '' : 's'} ${actionable.length === 1 ? 'needs' : 'need'} attention` : 'Nothing needs attention'}
          >
            {visibleAlerts.length === 0 ? (
              <div className="ov-ac-ok"><CheckCircle2 size={18} color="#16A34A" aria-hidden="true" /> All checks passed.</div>
            ) : (
              <div className="ov-ac-list">
                {[...actionable, ...optional].map((alert) => {
                  const isOptional = alert.optional || alert.severity === 'info';
                  const Icon = alert.severity === 'error' ? ShieldAlert : alert.severity === 'warning' ? AlertTriangle : Info;
                  const color = alert.severity === 'error' ? '#DC2626' : alert.severity === 'warning' ? '#D97706' : '#2563EB';
                  return (
                    <div key={alert.id} className="ov-ac-row">
                      <Icon size={17} color={color} className="ov-ac-icon" aria-hidden="true" />
                      <div className="ov-ac-main">
                        <strong>{alert.title}</strong>{' '}
                        {isOptional && <span className="ov-badge muted">Optional</span>}
                        <p>{alert.message}</p>
                        <div className="ov-ac-links">
                          <Link to={alert.actionPath} className="ov-link">{alert.actionLabel} <ArrowRight size={12} /></Link>
                          {isOptional && (
                            <button
                              type="button"
                              className="ov-link"
                              style={{ color: 'var(--ov-muted)', fontWeight: 500 }}
                              onClick={() => setDismissedAlerts((prev) => ({ ...prev, [alert.id]: true }))}
                            >
                              Dismiss
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
