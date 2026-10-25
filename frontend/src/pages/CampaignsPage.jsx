import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Archive, ArrowLeft, ArrowRight, Ban, Boxes, Calendar, Check, ChevronDown, CircleAlert, Clock3, Copy, Download, Eye, FileText, Filter, ListChecks, LoaderCircle, MessageSquareText, Play, Plus, RefreshCw, RotateCcw, Search, ShieldAlert, ShieldCheck, Sparkles, Trash2, Users, X } from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';
import MessagePayloadModal from '../components/MessagePayloadModal';
import MessageEventsModal from '../components/MessageEventsModal';
import { listContacts } from '../services/contacts';
import { listImports } from '../services/imports';
import { listTemplates, getTemplateVersions } from '../services/templates';
import { listContactGroups } from '../services/contactGroups';
import { retryMessage, cancelMessage, getCampaignMessages, getCampaignQueueStatus } from '../services/messages';
import * as api from '../services/campaigns';
import { useWorkspace } from '../context/WorkspaceContext';
import '../campaigns.css';

const BLANK = {
  name: '',
  description: '',
  goal: '',
  customGoal: '',
  category: '',
  subcategory: '',
  service: '',
  location: '',
  language: 'en',
  tags: [],
  internalNotes: '',
  campaignType: 'one-time',
  executionMode: 'MOCK'
};

const STATUSES = ['Draft', 'Ready', 'Scheduled', 'Running', 'Paused', 'Completed', 'Failed', 'Cancelled', 'Archived'];

const error = e => e.response?.data?.message || e.message || 'Something went wrong.';
const date = v => (v ? new Date(v).toLocaleDateString() : '—');
const saveBlob = (data, name) => {
  const href = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
};

const FILTER_DEFAULT = {
  businessCategory: '',
  subcategory: '',
  industry: '',
  service: '',
  city: '',
  location: '',
  source: '',
  status: '',
  priority: '',
  batchId: '',
  tag: '',
  createdFrom: '',
  createdTo: '',
  lastContactedFrom: '',
  lastContactedTo: '',
  consent: '',
  archived: 'false',
  search: ''
};

const paramsFor = f =>
  Object.fromEntries(
    Object.entries({
      businessCategory: f.businessCategory,
      subcategory: f.subcategory,
      industry: f.industry,
      service: f.service,
      city: f.city,
      location: f.location,
      source: f.source,
      leadStatus: f.status,
      priority: f.priority,
      sourceImportJobId: f.batchId,
      tag: f.tag,
      createdFrom: f.createdFrom,
      createdTo: f.createdTo,
      lastContactedFrom: f.lastContactedFrom,
      lastContactedTo: f.lastContactedTo,
      whatsappConsentStatus: f.consent,
      archived: f.archived,
      search: f.search,
      limit: 100
    }).filter(([, v]) => v !== '' && v != null)
  );

const activeFilterCount = f => Object.entries(f).filter(([k, v]) => k !== 'archived' && v).length;

const detailsPayload = (d, step) => ({
  name: d.name,
  description: d.description,
  goal: d.goal,
  customGoal: d.customGoal,
  category: d.category,
  subcategory: d.subcategory,
  service: d.service,
  location: d.location,
  language: d.language,
  tags: d.tags,
  internalNotes: d.internalNotes,
  campaignType: d.campaignType || 'one-time',
  executionMode: 'MOCK',
  wizardStep: step
});

function Status({ value }) {
  const normalized = String(value || 'Draft').toLowerCase().replaceAll(' ', '-');
  return (
    <span className={`campaign-status campaign-status-${normalized}`}>
      <i />
      {value || 'Draft'}
    </span>
  );
}

function CampaignStats({ stats, currentStatus, onStatusSelect }) {
  const primary = [
    {
      label: 'Total Campaigns',
      value: stats?.totalCampaigns ?? 0,
      sub: 'Campaigns in this workspace',
      icon: Boxes,
      color: '#2563EB',
      bg: '#EFF6FF'
    },
    {
      label: 'Scheduled',
      value: stats?.scheduledMockCampaigns ?? 0,
      sub: 'Upcoming scheduled runs',
      icon: Calendar,
      color: '#2563EB',
      bg: '#EFF6FF'
    },
    {
      label: 'Running',
      value: stats?.runningMockCampaigns ?? 0,
      sub: 'Active background executions',
      icon: Clock3,
      color: '#D97706',
      bg: '#FFFBEB'
    },
    {
      label: 'Completed',
      displayTitle: 'Completed Mock Runs',
      value: stats?.completedMockCampaigns ?? 0,
      sub: 'Simulated executions completed',
      icon: Check,
      color: '#16A34A',
      bg: '#F0FDF4'
    }
  ];

  return (
    <div style={{ marginBottom: '20px' }}>
      <div className="cp-kpi-grid">
        {primary.map(card => {
          const Icon = card.icon;
          return (
            <div className="cp-kpi-card" key={card.label}>
              <div className="cp-kpi-head">
                <div className="cp-kpi-label-group">
                  <span className="cp-kpi-label">{card.displayTitle || card.label}</span>
                  <span className="cp-kpi-sub">{card.sub}</span>
                </div>
                <div className="cp-kpi-icon-wrap" style={{ color: card.color, backgroundColor: card.bg }}>
                  <Icon size={16} />
                </div>
              </div>
              <div className="cp-kpi-value">
                {Number(card.value).toLocaleString()}
              </div>
            </div>
          );
        })}
      </div>

      <div className="cp-status-chip-row">
        <span className="cp-status-chip-title">Status Breakdown:</span>
        <button
          type="button"
          className={`cp-status-chip cp-status-chip-draft ${currentStatus === 'Draft' ? 'active' : ''}`}
          onClick={() => onStatusSelect?.(currentStatus === 'Draft' ? '' : 'Draft')}
          title="Filter by Draft campaigns"
        >
          <span className="cp-status-chip-dot" />
          Drafts: <b>{stats?.draftCampaigns ?? 0}</b>
        </button>
        <button
          type="button"
          className={`cp-status-chip cp-status-chip-paused ${currentStatus === 'Paused' ? 'active' : ''}`}
          onClick={() => onStatusSelect?.(currentStatus === 'Paused' ? '' : 'Paused')}
          title="Filter by Paused simulations"
        >
          <span className="cp-status-chip-dot" />
          Paused: <b>{stats?.pausedMockCampaigns ?? 0}</b>
        </button>
        <button
          type="button"
          className={`cp-status-chip cp-status-chip-failed ${currentStatus === 'Failed' ? 'active' : ''}`}
          onClick={() => onStatusSelect?.(currentStatus === 'Failed' ? '' : 'Failed')}
          title="Filter by Failed mock executions"
        >
          <span className="cp-status-chip-dot" />
          Failed: <b>{stats?.failedMockCampaigns ?? 0}</b>
        </button>
        <button
          type="button"
          className={`cp-status-chip cp-status-chip-cancelled ${currentStatus === 'Cancelled' ? 'active' : ''}`}
          onClick={() => onStatusSelect?.(currentStatus === 'Cancelled' ? '' : 'Cancelled')}
          title="Filter by Cancelled campaigns"
        >
          <span className="cp-status-chip-dot" />
          Cancelled: <b>{stats?.cancelledMockCampaigns ?? 0}</b>
        </button>
        <button
          type="button"
          className={`cp-status-chip cp-status-chip-warning ${currentStatus === 'Needs Attention' ? 'active' : ''}`}
          onClick={() => onStatusSelect?.(currentStatus === 'Needs Attention' ? '' : 'Needs Attention')}
          title="Filter by Campaigns requiring attention"
        >
          <span className="cp-status-chip-dot" />
          Needs Attention: <b>{stats?.requiringAttention ?? 0}</b>
        </button>
        {currentStatus && (
          <button
            type="button"
            className="cp-status-chip-clear"
            onClick={() => onStatusSelect?.('')}
            title="Clear active status filter"
          >
            <X size={12} /> Clear Filter
          </button>
        )}
        <div className="cp-status-chip-audience" title="Aggregated unique contacts across campaigns in this workspace">
          <Users size={13} />
          <span>Audience Snapshot: <b>{Number(stats?.totalSelectedContacts ?? 0).toLocaleString()}</b> contacts</span>
        </div>
      </div>
    </div>
  );
}

export function CampaignsPage() {
  const navigate = useNavigate();
  const { currentWorkspace, industryConfig } = useWorkspace();
  const [starters, setStarters] = useState([]);
  useEffect(() => { let active = true; api.getStarterDrafts().then(({ data }) => { if (active) setStarters(data.records || []); }).catch(e => toast.error(error(e))); return () => { active = false; }; }, [currentWorkspace?._id]);
  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState('updatedAt');
  const [direction, setDirection] = useState('desc');

  const categoryPlaceholder = industryConfig.terminology.categoryLabel || 'Category';

  const industryCategories = industryConfig.ui.campaigns.categories;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data }, { data: s }] = await Promise.all([
        api.listCampaigns({ page, limit: 10, search, status, category, sort, direction }),
        api.campaignStats()
      ]);
      setRecords(data.records || []);
      setTotal(data.total || 0);
      setStats(s.stats);
    } catch (e) {
      toast.error(error(e));
    } finally {
      setLoading(false);
    }
  }, [page, search, status, category, sort, direction]);

  useEffect(() => {
    load();
  }, [load]);

  const refreshStatus = async id => {
    try {
      await api.validateCampaign(id);
      toast.success('Campaign revalidated.');
      await load();
    } catch (e) {
      toast.error(error(e));
    }
  };

  const duplicate = async id => {
    try {
      const { data } = await api.duplicateCampaign(id);
      toast.success('Campaign duplicated as a new draft.');
      navigate(`/campaigns/${data.campaign._id}/edit`);
    } catch (e) {
      toast.error(error(e));
    }
  };

  const archive = async id => {
    if (!window.confirm('Archive this campaign?')) return;
    try {
      await api.archiveCampaign(id);
      toast.success('Campaign archived.');
      await load();
    } catch (e) {
      toast.error(error(e));
    }
  };

  const remove = async c => {
    if (!window.confirm(`Delete draft “${c.name}”?`)) return;
    try {
      await api.deleteCampaign(c._id);
      toast.success('Draft deleted.');
      await load();
    } catch (e) {
      toast.error(error(e));
    }
  };

  const handlePause = async id => {
    try {
      await api.pauseCampaign(id);
      toast.success('Campaign simulation paused.');
      await load();
    } catch (e) {
      toast.error(error(e));
    }
  };

  const handleResume = async id => {
    try {
      await api.resumeCampaign(id);
      toast.success('Campaign simulation resumed.');
      await load();
    } catch (e) {
      toast.error(error(e));
    }
  };

  const handleCancel = async id => {
    if (!window.confirm('Cancel this campaign? Undispatched jobs will be stopped.')) return;
    try {
      await api.cancelCampaign(id);
      toast.success('Campaign cancelled.');
      await load();
    } catch (e) {
      toast.error(error(e));
    }
  };

  return (
    <div className="campaign-page">
      {starters.length > 0 && <details className="panel" style={{ padding: '16px', marginBottom: '16px' }}>
        <summary>{industryConfig.industryName} starter drafts ({starters.length}) · Unsaved</summary>
        {starters.map(s => <div key={s.campaignId} style={{ marginTop: '12px' }}>
          <strong>{s.campaignName || s.name}</strong><p>{s.description}</p>
          <button className="outline-btn small" onClick={() => navigate(`/campaigns/new?starter=${encodeURIComponent(s.campaignId)}`)}>Use starter draft</button>
        </div>)}
      </details>}
      <PageHeader
        eyebrow={`${(currentWorkspace?.name || 'YOUR WORKSPACE').toUpperCase()} · CAMPAIGNS`}
        title="Campaigns"
        subtitle="Create, schedule and monitor personalized messaging campaigns."
        actions={
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button className="outline-btn small" onClick={() => load()} title="Refresh campaign list">
              <RefreshCw size={14} /> Refresh
            </button>
            <button
              className={`outline-btn small ${status === 'Scheduled' ? 'active-filter-btn' : ''}`}
              onClick={() => {
                setStatus(prev => (prev === 'Scheduled' ? '' : 'Scheduled'));
                setPage(1);
              }}
              title="Filter scheduled campaigns"
            >
              <Clock3 size={14} /> View Scheduled
            </button>
            <Link className="primary-btn small cp-btn-primary" to="/campaigns/new">
              <Plus size={15} /> New Campaign
            </Link>
          </div>
        }
      />
      <CampaignStats stats={stats} currentStatus={status} onStatusSelect={s => { setStatus(s); setPage(1); }} />
      <section className="panel cp-management-surface">
        <div className="cp-toolbar">
          <div className="cp-search-wrap">
            <Search size={14} className="cp-search-icon" />
            <input
              className="cp-search-input"
              value={search}
              onChange={e => {
                setPage(1);
                setSearch(e.target.value);
              }}
              placeholder="Search campaigns by name, goal or service…"
            />
            {search && (
              <button
                type="button"
                className="cp-search-clear"
                onClick={() => {
                  setSearch('');
                  setPage(1);
                }}
                title="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="cp-filter-group">
            <select
              className="cp-select"
              value={status}
              onChange={e => {
                setPage(1);
                setStatus(e.target.value);
              }}
              title="Filter by campaign status"
            >
              <option value="">All Statuses</option>
              {STATUSES.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <div className="cp-category-filter-wrap">
              <input
                list="campaign-categories"
                className="cp-category-input"
                value={category}
                onChange={e => {
                  setPage(1);
                  setCategory(e.target.value);
                }}
                placeholder={categoryPlaceholder}
                title={categoryPlaceholder}
              />
              <datalist id="campaign-categories">
                {industryCategories.map(x => (
                  <option key={x} value={x} />
                ))}
              </datalist>
              {category && (
                <button
                  type="button"
                  className="cp-category-clear"
                  onClick={() => {
                    setCategory('');
                    setPage(1);
                  }}
                  title="Clear category filter"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <button
              type="button"
              className={`cp-sort-btn ${sort !== 'updatedAt' || direction !== 'desc' ? 'active' : ''}`}
              onClick={() => {
                if (sort === 'updatedAt' && direction === 'desc') {
                  setSort('name');
                  setDirection('asc');
                } else if (sort === 'name') {
                  setSort('createdAt');
                  setDirection('desc');
                } else {
                  setSort('updatedAt');
                  setDirection('desc');
                }
              }}
              title="Toggle sort field"
            >
              <Filter size={13} />
              <span>Sort: {sort === 'name' ? 'Name (A-Z)' : sort === 'createdAt' ? 'Newest Created' : 'Recently Updated'}</span>
              <ChevronDown size={12} />
            </button>
          </div>
        </div>

        {/* Active Filters Bar */}
        {(search || status || category || sort !== 'updatedAt' || direction !== 'desc') && (
          <div className="cp-active-filters-bar">
            <span className="cp-active-filters-label">Active filters:</span>
            {search && (
              <span className="cp-filter-tag">
                Query: “{search}”
                <button type="button" onClick={() => { setSearch(''); setPage(1); }}><X size={11} /></button>
              </span>
            )}
            {status && (
              <span className="cp-filter-tag">
                Status: {status}
                <button type="button" onClick={() => { setStatus(''); setPage(1); }}><X size={11} /></button>
              </span>
            )}
            {category && (
              <span className="cp-filter-tag">
                Category: {category}
                <button type="button" onClick={() => { setCategory(''); setPage(1); }}><X size={11} /></button>
              </span>
            )}
            {sort !== 'updatedAt' && (
              <span className="cp-filter-tag">
                Sort: {sort === 'name' ? 'Name' : 'Created'}
                <button type="button" onClick={() => { setSort('updatedAt'); setDirection('desc'); }}><X size={11} /></button>
              </span>
            )}
            <button
              type="button"
              className="cp-clear-all-filters"
              onClick={() => {
                setSearch('');
                setStatus('');
                setCategory('');
                setSort('updatedAt');
                setDirection('desc');
                setPage(1);
              }}
            >
              Reset all
            </button>
            <span className="cp-filtered-count-badge">
              {total} {total === 1 ? 'campaign' : 'campaigns'} found
            </span>
          </div>
        )}

        <div className="table-wrap cp-table-wrap">
          <table className="campaign-table cp-table">
            <thead>
              <tr>
                <th style={{ minWidth: '220px' }}>Campaign Name</th>
                <th>Type</th>
                <th>Selected Template</th>
                <th>Audience Summary</th>
                <th>Recipients</th>
                <th>Status</th>
                <th>Scheduled / Run</th>
                <th>Mode</th>
                <th>Last Updated</th>
                <th style={{ textAlign: 'right', paddingRight: '16px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 4 }, (_, i) => (
                  <tr key={i} className="campaign-skeleton-row">
                    <td colSpan="10">
                      <div className="cp-skeleton-bar" />
                    </td>
                  </tr>
                ))
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan="10">
                    <div className="cp-empty-state">
                      <div className="cp-empty-icon">
                        <ListChecks size={22} />
                      </div>
                      <strong className="cp-empty-title">
                        {search || status || category ? 'No campaigns match these filters' : 'No campaigns planned yet'}
                      </strong>
                      <p className="cp-empty-desc">
                        {search || status || category
                          ? 'Try adjusting your search query, category, or status filter.'
                          : 'Create a campaign draft to target contacts, select approved templates, and launch mock simulations.'}
                      </p>
                      {!search && !status && !category ? (
                        <Link className="primary-btn small cp-btn-primary" to="/campaigns/new">
                          <Plus size={14} /> Create campaign
                        </Link>
                      ) : (
                        <button
                          type="button"
                          className="outline-btn small"
                          onClick={() => {
                            setSearch('');
                            setStatus('');
                            setCategory('');
                            setPage(1);
                          }}
                        >
                          Clear all filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                records.map(c => {
                  const totalAudience = c.audienceCounts?.total ?? 0;
                  const eligibleAudience = c.audienceCounts?.eligible ?? totalAudience;
                  const excludedAudience = c.audienceCounts?.excluded ?? Math.max(0, totalAudience - eligibleAudience);

                  return (
                    <tr key={c._id} className="cp-table-row">
                      <td className="cp-cell-name">
                        <Link to={`/campaigns/${c._id}`} className="cp-campaign-name-link" title={`View details for ${c.name}`}>
                          <span className="cp-campaign-title">{c.name}</span>
                          {(c.customGoal || c.goal) && (
                            <span className="cp-campaign-goal">
                              {c.customGoal || c.goal}
                            </span>
                          )}
                        </Link>
                      </td>
                      <td>
                        <span className="cp-type-badge">
                          {c.campaignType || 'one-time'}
                        </span>
                      </td>
                      <td className="cp-cell-template">
                        {c.template?.name ? (
                          <div className="cp-template-info">
                            <span className="cp-template-name">{c.template.name}</span>
                            <span className="cp-template-meta">
                              v{c.template.currentVersionNumber || 1} · {(c.template.language || 'en').toUpperCase()}
                            </span>
                          </div>
                        ) : (
                          <span className="cp-text-muted">Not selected</span>
                        )}
                      </td>
                      <td>
                        <div className="cp-audience-info">
                          <span className="cp-audience-mode">
                            {c.audienceSelectionMode === 'group'
                              ? 'Contact Group'
                              : c.audienceSelectionMode === 'segment'
                              ? 'Dynamic Segment'
                              : c.audienceSelectionMode === 'filters'
                              ? 'Filtered Contacts'
                              : c.audienceSelectionMode === 'manual'
                              ? 'Manual Selection'
                              : 'All Contacts'}
                          </span>
                          <span className="cp-audience-cat">
                            {c.category || 'Real Estate'}
                          </span>
                        </div>
                      </td>
                      <td className="cp-cell-recipients">
                        <div
                          className="cp-recipients-pill"
                          title={
                            totalAudience > 0
                              ? `${eligibleAudience} mock-eligible contacts · ${excludedAudience} excluded (${c.audienceCounts?.optedOut || excludedAudience} opted out)`
                              : '0 recipients'
                          }
                        >
                          <span className="cp-recipients-eligible">
                            <b>{eligibleAudience}</b> of {totalAudience}
                          </span>
                          {excludedAudience > 0 ? (
                            <span className="cp-opted-out-tag">
                              {excludedAudience} excluded
                            </span>
                          ) : (
                            <span className="cp-eligible-tag">eligible</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <Status value={c.status} />
                      </td>
                      <td className="cp-cell-schedule">
                        <span className="cp-schedule-text">
                          {c.mockSchedule?.startAt
                            ? new Date(c.mockSchedule.startAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
                            : c.status === 'Running'
                            ? 'Executing Now'
                            : c.status === 'Completed'
                            ? 'Mock Run Completed'
                            : date(c.updatedAt)}
                        </span>
                      </td>
                      <td>
                        <span className="cp-mode-badge" title="Simulated WhatsApp execution — no real messages sent">
                          {c.executionMode || 'MOCK'}
                        </span>
                      </td>
                      <td className="cp-cell-date">{date(c.updatedAt)}</td>
                      <td style={{ textAlign: 'right', paddingRight: '16px' }}>
                        <div className="cp-row-actions">
                          <button className="cp-action-btn" title="View campaign details" onClick={() => navigate(`/campaigns/${c._id}`)}>
                            <Eye size={14} />
                          </button>
                          {['Draft', 'Needs Review', 'Ready'].includes(c.status) && (
                            <button className="cp-action-btn" title="Edit draft configuration" onClick={() => navigate(`/campaigns/${c._id}/edit`)}>
                              <FileText size={14} />
                            </button>
                          )}
                          <button className="cp-action-btn" title="Duplicate plan as a new draft" onClick={() => duplicate(c._id)}>
                            <Copy size={14} />
                          </button>
                          {c.status === 'Running' && (
                            <button className="cp-action-btn text-warning" title="Pause simulation" onClick={() => handlePause(c._id)}>
                              <Ban size={14} />
                            </button>
                          )}
                          {c.status === 'Paused' && (
                            <button className="cp-action-btn text-primary" title="Resume simulation" onClick={() => handleResume(c._id)}>
                              <Play size={14} />
                            </button>
                          )}
                          {['Scheduled', 'Running', 'Paused'].includes(c.status) && (
                            <button className="cp-action-btn text-danger" title="Cancel simulation" onClick={() => handleCancel(c._id)}>
                              <X size={14} />
                            </button>
                          )}
                          <button className="cp-action-btn" title="Archive campaign" onClick={() => archive(c._id)}>
                            <Archive size={14} />
                          </button>
                          {c.status === 'Draft' && (
                            <button className="cp-action-btn text-danger" title="Delete draft" onClick={() => remove(c)}>
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <footer className="campaign-footer cp-pagination">
          <span className="cp-pagination-info">Showing {records.length} of {total} {total === 1 ? 'campaign' : 'campaigns'}</span>
          <div className="cp-pagination-nav">
            <button
              className="outline-btn small"
              disabled={page <= 1 || loading}
              onClick={() => setPage(p => p - 1)}
              style={{ width: '28px', padding: 0 }}
              title="Previous page"
            >
              ←
            </button>
            <span className="cp-pagination-page">
              Page {page} of {Math.max(1, Math.ceil(total / 10))}
            </span>
            <button
              className="outline-btn small"
              disabled={page >= Math.ceil(total / 10) || loading}
              onClick={() => setPage(p => p + 1)}
              style={{ width: '28px', padding: 0 }}
              title="Next page"
            >
              →
            </button>
          </div>
        </footer>

        {stats?.completedMockCampaigns > 0 && (
          <div className="cp-recent-runs-summary">
            <div className="cp-recent-runs-head">
              <div className="cp-recent-runs-title">
                <span className="cp-live-indicator" />
                <span>Mock Automation Engine · Execution Telemetry</span>
              </div>
              <span className="cp-recent-runs-meta">
                <b>{stats.completedMockCampaigns}</b> simulated {stats.completedMockCampaigns === 1 ? 'run' : 'runs'} completed in workspace
              </span>
            </div>
            <p className="cp-recent-runs-note">
              WhatsApp messaging is operating in <strong>Mock Mode</strong>. Dispatched campaign runs simulate provider queuing, rate-limiting, message delivery and read receipts safely in MongoDB without live Meta API charges or external sends.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

// 4-STEP CAMPAIGN WIZARD (Template -> Audience -> Preview -> Launch)
const STEPS = ['Template', 'Audience', 'Preview', 'Launch'];
const WIZARD_STEPS = [
  { key: 1, label: 'Template', subtitle: 'Choose template & basics' },
  { key: 2, label: 'Audience', subtitle: 'Target contacts & groups' },
  { key: 3, label: 'Preview', subtitle: 'Personalization & review' },
  { key: 4, label: 'Launch', subtitle: 'Schedule or launch mock' }
];

export function CampaignWizardPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentWorkspace, industryConfig } = useWorkspace();
  const [campaignId, setCampaignId] = useState(id || null);
  const [draft, setDraft] = useState(BLANK);
  useEffect(() => {
    const key = searchParams.get('starter');
    if (id || !key) return;
    let active = true;
    api.getStarterDrafts().then(({ data }) => {
      const preset = data.records?.find(p => p.campaignId === key);
      if (active && preset) setDraft({ ...BLANK, name: preset.campaignName || preset.name, description: preset.description, goal: preset.goal });
    }).catch(e => toast.error(error(e)));
    return () => { active = false; };
  }, [id, searchParams]);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(Boolean(id));
  const [busy, setBusy] = useState(false);

  const availableGoals = industryConfig.ui.campaigns.goals;

  const availableCategories = industryConfig.ui.campaigns.categories;

  const serviceLabel = industryConfig.terminology.offeringLabel;

  const servicePlaceholder = industryConfig.terminology.offeringLabel;

  const categoryLabel = industryConfig.terminology.categoryLabel || 'Category';

  const interestFieldLabel = industryConfig.terminology.interestFieldLabel;

  const interestFieldPlaceholder = industryConfig.terminology.interestFieldLabel;

  const projectFieldLabel = industryConfig.ui.contacts.projectColumnLabel;

  const projectFieldPlaceholder = industryConfig.ui.contacts.projectColumnLabel;

  // Step 1: Template selection
  const [templates, setTemplates] = useState([]);
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [versionId, setVersionId] = useState('');
  const [versions, setVersions] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  // Step 2: Audience targeting
  const [audienceMode, setAudienceMode] = useState('group');
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [segments, setSegments] = useState([]);
  const [selectedSegment, setSelectedSegment] = useState('');
  const [imports, setImports] = useState([]);
  const [filters, setFilters] = useState(FILTER_DEFAULT);
  const [contacts, setContacts] = useState([]);
  const [totalContacts, setTotalContacts] = useState(0);
  const [contactPage, setContactPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState([]);
  const [excludedIds, setExcludedIds] = useState([]);
  const [audienceSummary, setAudienceSummary] = useState(null);
  const [liveEligibility, setLiveEligibility] = useState(null);
  const [calculatingEligibility, setCalculatingEligibility] = useState(false);
  const [categoryCounts, setCategoryCounts] = useState([]);

  // Step 3: Personalized Previews & Review
  const [previewRows, setPreviewRows] = useState([]);
  const [previewPage, setPreviewPage] = useState(1);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [validation, setValidation] = useState(null);

  // Step 4: Schedule or Launch Mock
  const [launchMode, setLaunchMode] = useState('now'); // 'now' or 'schedule'
  const [scheduleAt, setScheduleAt] = useState('');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata');
  const [confirmMockAcknowledged, setConfirmMockAcknowledged] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Initial load
  const readCampaign = useCallback(
    async key => {
      try {
        setLoading(true);
        const [{ data: d }, { data: a }, { data: s }, { data: i }, { data: t }, { data: cc }, { data: g }] = await Promise.all([
          api.getCampaign(key),
          api.listCampaignAudience(key, { limit: 100 }),
          api.listSegments({ limit: 100 }),
          listImports(),
          listTemplates({ archived: 'false' }),
          api.categoryCounts(),
          listContactGroups({ limit: 100 })
        ]);

        const c = d.campaign;
        setDraft({ ...BLANK, ...c });
        // Map 1-4 step range
        const stepNum = Math.min(4, Math.max(1, c.wizardStep || 1));
        setStep(stepNum);
        setAudienceMode(c.audienceSelectionMode || 'group');
        setFilters({ ...FILTER_DEFAULT, ...(c.audienceDefinition?.filters || {}) });
        setAudienceSummary({
          count: a.total,
          eligible: d.validation?.counts?.eligible || 0,
          excluded: Math.max(0, a.total - (d.validation?.counts?.eligible || 0))
        });
        setSelectedSegment(c.selectedSegmentId || '');
        if (c.audienceSelectionMode === 'group') setSelectedGroup(c.audienceDefinition?.groupId || '');
        setTemplateId(c.selectedTemplateId || '');
        setVersionId(c.selectedTemplateVersionId || '');
        setSelectedTemplate(
          d.template?.selectedVersion?.snapshot
            ? { ...d.template, ...d.template.selectedVersion.snapshot, _id: d.template._id }
            : d.template
        );
        setValidation(d.validation);
        setSegments(s.records || []);
        setGroups(g.records || g.groups || []);
        setImports(i.jobs || []);
        setTemplates(t.records || []);
        setCategoryCounts(cc.records || []);
        if (c.mockSchedule?.startAt) {
          setLaunchMode('schedule');
          setScheduleAt(new Date(c.mockSchedule.startAt).toISOString().slice(0, 16));
          if (c.mockSchedule.timezone) setTimezone(c.mockSchedule.timezone);
        }
      } catch (e) {
        toast.error(error(e));
        navigate('/campaigns');
      } finally {
        setLoading(false);
      }
    },
    [navigate]
  );

  useEffect(() => {
    if (id) readCampaign(id);
    else
      Promise.all([
        api.categoryCounts(),
        api.listSegments({ limit: 100 }),
        listImports(),
        listTemplates({ archived: 'false' }),
        listContactGroups({ limit: 100 })
      ])
        .then(([c, s, i, t, g]) => {
          setCategoryCounts(c.data.records || []);
          setSegments(s.data.records || []);
          setImports(i.data.jobs || []);
          setTemplates(t.data.records || []);
          setGroups(g.data.records || g.data.groups || []);
        })
        .catch(e => toast.error(error(e)));
  }, [id, readCampaign]);

  // Load versions when template selected
  useEffect(() => {
    if (templateId) {
      getTemplateVersions(templateId)
        .then(({ data }) => {
          const vers = data.records || [];
          setVersions(vers);
          if (!versionId && vers.length > 0) {
            setVersionId(vers[0]._id);
            setSelectedTemplate({ ...vers[0].snapshot, _id: templateId, versionNumber: vers[0].versionNumber, versionId: vers[0]._id });
          }
        })
        .catch(e => toast.error(error(e)));
    }
  }, [templateId, versionId]);

  // Load contacts list for Step 2
  useEffect(() => {
    if (step !== 2) return;
    let live = true;
    let queryParams = { ...paramsFor(filters), page: contactPage };
    if (audienceMode === 'group' && selectedGroup) queryParams.groupId = selectedGroup;
    const timer = setTimeout(() => {
      listContacts(queryParams)
        .then(({ data }) => {
          if (live) {
            setContacts(data.records || data.contacts || []);
            setTotalContacts(data.total || 0);
          }
        })
        .catch(e => toast.error(error(e)));
    }, 200);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [step, filters, contactPage, audienceMode, selectedGroup]);

  // Live audience eligibility calculation
  const calculateLiveEligibility = useCallback(async () => {
    setCalculatingEligibility(true);
    try {
      let definition = {};
      if (audienceMode === 'group') definition = { groupId: selectedGroup };
      else if (audienceMode === 'segment') definition = { segmentId: selectedSegment };
      else if (audienceMode === 'filters') definition = { filters };
      else if (audienceMode === 'manual') definition = { contactIds: selectedIds };
      else if (audienceMode === 'import') definition = { batchId: filters.batchId };
      if (audienceMode !== 'manual' && excludedIds.length) definition.excludedContactIds = excludedIds;

      const { data } = await api.previewAudience({
        mode: audienceMode,
        definition,
        templateId: templateId || undefined,
        templateVersionId: versionId || undefined,
        goal: draft.goal,
        service: draft.service
      });
      setLiveEligibility(data.summary);
      if (data.samplePreviews) setPreviewRows(data.samplePreviews);
    } catch (e) {
      console.warn('Audience preview error:', e.message);
    } finally {
      setCalculatingEligibility(false);
    }
  }, [audienceMode, selectedGroup, selectedSegment, filters, selectedIds, excludedIds, templateId, versionId, draft.goal, draft.service]);

  useEffect(() => {
    if (step === 2 || step === 3) {
      calculateLiveEligibility();
    }
  }, [step, calculateLiveEligibility]);

  // Save details helper
  const persistCampaign = async (nextStep = step) => {
    setBusy(true);
    try {
      const payload = detailsPayload(draft, nextStep);
      let c;
      if (campaignId) {
        const { data } = await api.updateCampaign(campaignId, {
          ...payload,
          selectedTemplateId: templateId || null,
          selectedTemplateVersionId: versionId || null
        });
        c = data.campaign;
      } else {
        const { data } = await api.createCampaign({
          ...payload,
          selectedTemplateId: templateId || null,
          selectedTemplateVersionId: versionId || null
        });
        c = data.campaign;
        setCampaignId(c._id);
        navigate(`/campaigns/${c._id}/edit`, { replace: true });
      }
      setDraft({ ...BLANK, ...c });
      return c;
    } catch (e) {
      toast.error(error(e));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const handleStep1Next = async () => {
    if (draft.name.trim().length < 3) return toast.error('Enter a campaign name (at least 3 characters).');
    if (!templateId || !versionId) return toast.error('Choose a message template and version.');
    const saved = await persistCampaign(2);
    if (saved) setStep(2);
  };

  const handleStep2Next = async () => {
    setBusy(true);
    try {
      let definition = {};
      if (audienceMode === 'group') definition = { groupId: selectedGroup };
      else if (audienceMode === 'segment') definition = { segmentId: selectedSegment };
      else if (audienceMode === 'filters') definition = { filters };
      else if (audienceMode === 'manual') definition = { contactIds: selectedIds };
      else if (audienceMode === 'import') definition = { batchId: filters.batchId };
      if (audienceMode !== 'manual' && excludedIds.length) definition.excludedContactIds = excludedIds;

      const { data } = await api.setCampaignAudience(campaignId, { mode: audienceMode, definition });
      setAudienceSummary(data.audience);
      await api.updateCampaign(campaignId, { wizardStep: 3 });
      toast.success(`${data.audience.count} contacts snapshotted for campaign.`);
      setStep(3);
    } catch (e) {
      toast.error(error(e));
    } finally {
      setBusy(false);
    }
  };

  const handleStep3Next = async () => {
    setBusy(true);
    try {
      const { data } = await api.validateCampaign(campaignId);
      setValidation(data.validation);
      await api.updateCampaign(campaignId, { wizardStep: 4 });
      setStep(4);
    } catch (e) {
      toast.error(error(e));
    } finally {
      setBusy(false);
    }
  };

  const handleFinalLaunch = async () => {
    if (!confirmMockAcknowledged) {
      return toast.error('Please confirm you acknowledge this campaign will run in Mock Mode.');
    }
    setBusy(true);
    try {
      if (launchMode === 'schedule') {
        if (!scheduleAt) return toast.error('Choose a future schedule date and time.');
        const at = new Date(scheduleAt);
        if (Number.isNaN(at.valueOf()) || at <= new Date()) return toast.error('Schedule date and time must be in the future.');
        await api.scheduleCampaign(campaignId, { startAt: at.toISOString(), timezone });
        toast.success('Mock campaign scheduled successfully.');
      } else {
        await api.launchCampaign(campaignId);
        toast.success('Mock campaign queued and started.');
      }
      navigate(`/campaigns/${campaignId}`);
    } catch (e) {
      toast.error(error(e));
    } finally {
      setBusy(false);
    }
  };

  const handleSaveDraftAndExit = async () => {
    if (draft.name.trim().length < 3) return toast.error('Enter a campaign name before saving draft.');
    await persistCampaign(step);
    toast.success('Campaign draft saved.');
    navigate('/campaigns');
  };

  const toggleContactSelection = contactId => {
    if (audienceMode === 'manual') {
      setSelectedIds(prev => (prev.includes(contactId) ? prev.filter(x => x !== contactId) : [...prev, contactId]));
    } else {
      setExcludedIds(prev => (prev.includes(contactId) ? prev.filter(x => x !== contactId) : [...prev, contactId]));
    }
  };

  const filteredTemplates = templates.filter(t => {
    if (t.localStatus === 'Archived') return false;
    if (templateCategoryFilter && t.category !== templateCategoryFilter) return false;
    if (templateSearch.trim()) {
      const term = templateSearch.toLowerCase();
      return (t.name || '').toLowerCase().includes(term) || (t.body || '').toLowerCase().includes(term);
    }
    return true;
  });

  if (loading) {
    return (
      <div className="campaign-loading">
        <LoaderCircle className="spin" size={24} /> Loading campaign draft…
      </div>
    );
  }

  return (
    <div className="campaign-wizard-page">
      <div className="campaign-wizard-top">
        <Link to="/campaigns" className="back-link">
          <ArrowLeft size={14} /> Campaigns
        </Link>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="outline-btn small" onClick={handleSaveDraftAndExit} disabled={busy}>
            {busy ? 'Saving…' : 'Save Draft & Exit'}
          </button>
        </div>
      </div>

      <div className="campaign-heading">
        <div>
          <div className="form-kicker">CAMPAIGN CREATION WIZARD · STEP {step} OF 4</div>
          <h1>{campaignId ? `Edit: ${draft.name || 'Campaign Draft'}` : `New ${currentWorkspace?.name ? `${currentWorkspace.name} ` : ''}Campaign`}</h1>
          <p>Four-step guided setup: choose template, target audience, preview personalized messages, and schedule or launch mock.</p>
        </div>
        <span className="cp-mode-badge" style={{ padding: '6px 12px', fontSize: '11.5px' }}>
          MOCK MODE ONLY
        </span>
      </div>

      {/* Stepper: Template -> Audience -> Preview -> Launch */}
      <div className="campaign-stepper">
        {WIZARD_STEPS.map((s, i) => (
          <div key={s.key} className={`${step === s.key ? 'active' : ''} ${step > s.key ? 'done' : ''}`}>
            <span>{step > s.key ? <Check size={13} /> : s.key}</span>
            <div>
              <b>{s.label}</b>
              <small>{s.subtitle}</small>
            </div>
          </div>
        ))}
      </div>

      {/* STEP 1: Choose Template & Campaign Basics */}
      {step === 1 && (
        <section className="campaign-wizard-card">
          <header>
            <span>STEP 1 OF 4</span>
            <h2>Choose Template & Campaign Basics</h2>
            <p>Configure campaign name, purpose, and select a pinned WhatsApp message template.</p>
          </header>

          <div className="campaign-form-grid">
            <label className="field wide">
              Campaign Name *
              <input
                value={draft.name}
                maxLength={120}
                onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                placeholder="e.g. Follow-Up Campaign"
              />
            </label>
            <label className="field">
              Campaign Goal / Purpose
              <select
                value={availableGoals.includes(draft.goal) ? draft.goal : draft.goal ? 'Other' : ''}
                onChange={e => setDraft(d => ({ ...d, goal: e.target.value, customGoal: e.target.value === 'Other' ? d.customGoal : '' }))}
              >
                <option value="">Select a purpose</option>
                {availableGoals.map(g => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </label>
            {draft.goal === 'Other' && (
              <label className="field">
                Custom Purpose
                <input
                  value={draft.customGoal || ''}
                  onChange={e => setDraft(d => ({ ...d, customGoal: e.target.value }))}
                  placeholder="Describe the campaign objective"
                />
              </label>
            )}
            <label className="field">
              {serviceLabel}
              <input
                value={draft.service}
                onChange={e => setDraft(d => ({ ...d, service: e.target.value }))}
                placeholder={servicePlaceholder}
              />
            </label>
          </div>

          {/* Advanced Campaign Options Toggle */}
          <div style={{ padding: '0 24px 16px' }}>
            <button
              type="button"
              className="outline-btn small"
              onClick={() => setShowAdvanced(v => !v)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              {showAdvanced ? 'Hide Advanced Options' : 'Show Advanced Options'}
              <ChevronDown size={14} style={{ transform: showAdvanced ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>
            {showAdvanced && (
              <div className="campaign-form-grid" style={{ marginTop: '14px', padding: '16px', background: 'var(--color-surface-subtle)', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                <label className="field wide">
                  Internal Description
                  <textarea
                    rows="2"
                    value={draft.description}
                    maxLength={1000}
                    onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
                    placeholder="Describe campaign objective and audience context..."
                  />
                </label>
                <label className="field">
                  {categoryLabel}
                  <input
                    list="wizard-categories"
                    value={draft.category}
                    onChange={e => setDraft(d => ({ ...d, category: e.target.value }))}
                    placeholder="e.g. Category"
                  />
                  <datalist id="wizard-categories">
                    {availableCategories.map(x => (
                      <option key={x} value={x} />
                    ))}
                  </datalist>
                </label>
                <label className="field">
                  Target City / Location
                  <input
                    value={draft.location}
                    onChange={e => setDraft(d => ({ ...d, location: e.target.value }))}
                    placeholder="e.g. Gurugram"
                  />
                </label>
                <label className="field">
                  Campaign Language
                  <select value={draft.language} onChange={e => setDraft(d => ({ ...d, language: e.target.value }))}>
                    <option value="en">English (en)</option>
                    <option value="hi">Hindi (hi)</option>
                    <option value="hinglish">Hinglish</option>
                  </select>
                </label>
                <label className="field wide">
                  Internal Tags (comma separated)
                  <input
                    value={(draft.tags || []).join(', ')}
                    onChange={e =>
                      setDraft(d => ({
                        ...d,
                        tags: e.target.value
                          .split(',')
                          .map(x => x.trim().toLowerCase())
                          .filter(Boolean)
                          .slice(0, 30)
                      }))
                    }
                    placeholder="gurugram, plots, high-budget"
                  />
                </label>
              </div>
            )}
          </div>

          {/* Template Selection Box */}
          <div style={{ padding: '0 24px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '14px', margin: 0, fontWeight: 700 }}>Select WhatsApp Message Template</h3>
                <small style={{ color: 'var(--color-text-muted)' }}>
                  The campaign preserves an immutable effective snapshot of the chosen template version.
                </small>
              </div>
              <Link to="/templates" target="_blank" className="outline-btn small">
                <Plus size={13} /> Create New Template
              </Link>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, background: 'var(--color-surface-muted)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '0 10px', height: '36px' }}>
                <Search size={14} color="var(--color-text-muted)" />
                <input
                  style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '13px' }}
                  value={templateSearch}
                  onChange={e => setTemplateSearch(e.target.value)}
                  placeholder="Search templates by name or content…"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px', maxHeight: '280px', overflowY: 'auto', paddingRight: '4px' }}>
              {filteredTemplates.map(t => (
                <div
                  key={t._id}
                  onClick={() => {
                    setTemplateId(t._id);
                    setVersionId('');
                    setSelectedTemplate(t);
                  }}
                  style={{
                    padding: '12px',
                    borderRadius: '10px',
                    border: templateId === t._id ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                    backgroundColor: templateId === t._id ? 'var(--color-primary-soft)' : 'var(--color-surface)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <b style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}>{t.name}</b>
                    <Status value={t.providerStatus || 'Approved'} />
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '0 0 6px', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {t.body}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                    <span>{t.category} · {t.language}</span>
                    <span>v{t.currentVersionNumber || 1}</span>
                  </div>
                </div>
              ))}
              {!filteredTemplates.length && (
                <div style={{ gridColumn: 'span 3', padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                  No templates match search. <Link to="/templates">Create a template in Template Studio</Link>.
                </div>
              )}
            </div>

            {templateId && versions.length > 1 && (
              <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label className="field" style={{ minWidth: '220px' }}>
                  Pin Template Version
                  <select value={versionId} onChange={e => setVersionId(e.target.value)}>
                    {versions.map(v => (
                      <option key={v._id} value={v._id}>
                        v{v.versionNumber} ({new Date(v.createdAt).toLocaleDateString()})
                      </option>
                    ))}
                  </select>
                </label>
                <small style={{ color: 'var(--color-text-muted)', marginTop: '16px' }}>
                  Snapshot will be locked on launch. Later template edits won't alter this campaign.
                </small>
              </div>
            )}
          </div>

          <footer className="campaign-wizard-actions">
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
              {templateId ? 'Template selected & pinned.' : 'Choose a template to continue.'}
            </span>
            <button className="primary-btn" disabled={busy || draft.name.trim().length < 3 || !templateId} onClick={handleStep1Next}>
              Save & Choose Audience <ArrowRight size={15} />
            </button>
          </footer>
        </section>
      )}

      {/* STEP 2: Choose Audience & Live Targeting */}
      {step === 2 && (
        <section className="campaign-wizard-card">
          <header>
            <span>STEP 2 OF 4</span>
            <h2>Select Audience & Filter Targeting</h2>
            <p>Target contacts by group, dynamic segment, city, customer interest, and review live eligibility exclusions.</p>
          </header>

          {/* Mode Selector */}
          <div className="audience-mode-row">
            {[
              ['group', 'Contact group'],
              ['segment', 'Saved segment'],
              ['filters', 'Matching filters'],
              ['manual', 'Select contacts'],
              ['import', 'Import batch'],
              ['all', 'All contacts']
            ].map(([val, label]) => (
              <button key={val} className={audienceMode === val ? 'active' : ''} onClick={() => setAudienceMode(val)}>
                {label}
              </button>
            ))}
          </div>

          <div style={{ padding: '16px 24px 0' }}>
            {audienceMode === 'group' && (
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <label className="field" style={{ flex: 1 }}>
                  Contact group
                  <select
                    value={selectedGroup}
                    onChange={e => {
                      setSelectedGroup(e.target.value);
                      setContactPage(1);
                    }}
                  >
                    <option value="">Choose a contact group</option>
                    {groups.map(g => (
                      <option value={g._id} key={g._id}>
                        {g.name} · {g.contactCount ?? g.memberCount ?? 0} members
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            {audienceMode === 'segment' && (
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <label className="field" style={{ flex: 1 }}>
                  Saved Dynamic Segment
                  <select
                    value={selectedSegment}
                    onChange={e => {
                      setSelectedSegment(e.target.value);
                      setContactPage(1);
                    }}
                  >
                    <option value="">Choose a segment</option>
                    {segments.map(s => (
                      <option value={s._id} key={s._id}>
                        {s.name} · {s.segmentType} · {s.totalMatchingContacts} matching
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            {audienceMode === 'import' && (
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <label className="field" style={{ flex: 1 }}>
                  Import Batch
                  <select value={filters.batchId} onChange={e => setFilters(f => ({ ...f, batchId: e.target.value }))}>
                    <option value="">Choose completed import</option>
                    {imports.map(i => (
                      <option key={i._id} value={i._id}>
                        {i.batchName} · {i.createdCount} contacts
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            {/* Real Estate Filters Grid */}
            <div className="campaign-form-grid" style={{ padding: '16px 0', gap: '12px' }}>
              <label className="field">
                Target City
                <input
                  value={filters.city || filters.location || ''}
                  onChange={e => {
                    setContactPage(1);
                    setFilters(f => ({ ...f, city: e.target.value, location: e.target.value }));
                  }}
                  placeholder="e.g. Gurugram, Noida, Delhi"
                />
              </label>
              <label className="field">
                {interestFieldLabel}
                <input
                  value={filters.service || ''}
                  onChange={e => {
                    setContactPage(1);
                    setFilters(f => ({ ...f, service: e.target.value }));
                  }}
                  placeholder={interestFieldPlaceholder}
                />
              </label>
              <label className="field">
                {projectFieldLabel}
                <input
                  value={filters.industry || ''}
                  onChange={e => {
                    setContactPage(1);
                    setFilters(f => ({ ...f, industry: e.target.value }));
                  }}
                  placeholder={projectFieldPlaceholder}
                />
              </label>
              <label className="field">
                Consent Status Filter
                <select
                  value={filters.consent || ''}
                  onChange={e => {
                    setContactPage(1);
                    setFilters(f => ({ ...f, consent: e.target.value }));
                  }}
                >
                  <option value="">All Consent States</option>
                  <option value="Opted In">Opted In Only</option>
                  <option value="Unknown">Unknown Consent</option>
                  <option value="Opted Out">Opted Out</option>
                </select>
              </label>
            </div>
          </div>

          {/* LIVE AUDIENCE ELIGIBILITY CARD */}
          <div className="eligibility-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={16} color="var(--color-primary)" />
                <strong style={{ fontSize: '13.5px' }}>Live Recipient Eligibility & Consent Breakdown</strong>
              </div>
              {calculatingEligibility ? (
                <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Calculating…</span>
              ) : (
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                  Deduplicated by contact ID · Authoritative backend calculation
                </span>
              )}
            </div>

            <div className="eligibility-stat-grid">
              <div className="eligibility-stat-box">
                <span>Matching Contacts</span>
                <strong>{liveEligibility?.matchingContacts ?? totalContacts}</strong>
              </div>
              <div className="eligibility-stat-box">
                <span>Valid Phone Numbers</span>
                <strong>{liveEligibility?.validPhoneCount ?? 0}</strong>
              </div>
              <div className="eligibility-stat-box">
                <span>Opted-In (With Audit)</span>
                <strong style={{ color: '#15803d' }}>{liveEligibility?.optedInCount ?? 0}</strong>
              </div>
              <div className="eligibility-stat-box highlight">
                <span>Currently Eligible</span>
                <strong>{liveEligibility?.currentlyEligibleRecipients ?? 0}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px', padding: '8px 12px', background: 'var(--color-surface-muted)', borderRadius: '8px', fontSize: '11.5px' }}>
              <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>Exclusions:</span>
              <span style={{ color: '#b45309' }}>Missing Consent: {liveEligibility?.exclusionBreakdown?.MISSING_CONSENT ?? 0}</span>
              <span style={{ color: '#b91c1c' }}>Opted Out: {liveEligibility?.exclusionBreakdown?.CONTACT_OPTED_OUT ?? 0}</span>
              <span style={{ color: '#b91c1c' }}>Do Not Contact: {liveEligibility?.exclusionBreakdown?.DO_NOT_CONTACT ?? 0}</span>
              <span style={{ color: '#64748b' }}>Invalid Phone: {liveEligibility?.exclusionBreakdown?.INVALID_PHONE ?? 0}</span>
              <span style={{ color: '#0369a1' }}>Demo Contacts: {liveEligibility?.exclusionBreakdown?.DEMO_CONTACT ?? 0}</span>
              {liveEligibility?.exclusionBreakdown?.UNRESOLVED_VARIABLE > 0 && (
                <span style={{ color: '#d97706' }}>Missing Variables: {liveEligibility?.exclusionBreakdown?.UNRESOLVED_VARIABLE}</span>
              )}
            </div>
          </div>

          {/* Contact Table Preview */}
          <div style={{ padding: '0 24px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                Showing matching contacts (select to include/exclude)
              </span>
              <button
                className="text-action"
                onClick={() => {
                  setFilters(FILTER_DEFAULT);
                  setSelectedIds([]);
                  setExcludedIds([]);
                }}
              >
                Reset filters
              </button>
            </div>

            <div className="table-wrap" style={{ maxHeight: '240px', overflowY: 'auto' }}>
              <table className="campaign-table">
                <thead>
                  <tr>
                    <th style={{ width: '36px' }}></th>
                    <th>Contact Name</th>
                    <th>Phone</th>
                    <th>City / Location</th>
                    <th>{interestFieldLabel}</th>
                    <th>Consent</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map(c => {
                    const isSelected = audienceMode === 'manual' ? selectedIds.includes(String(c._id)) : !excludedIds.includes(String(c._id));
                    return (
                      <tr key={c._id}>
                        <td>
                          <input type="checkbox" checked={isSelected} onChange={() => toggleContactSelection(String(c._id))} />
                        </td>
                        <td>
                          <b>{c.fullName}</b>
                          {c.companyName && <small style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: '11px' }}>{c.companyName}</small>}
                        </td>
                        <td>{c.phoneNumber}</td>
                        <td>{c.city || c.location || '—'}</td>
                        <td>{c.interestedPropertyType || c.interestedService || c.industryData?.courseInterest || c.industryData?.preferredService || c.industryData?.vehicleInterest || '—'}</td>
                        <td>
                          <Status value={c.whatsappConsentStatus} />
                        </td>
                      </tr>
                    );
                  })}
                  {!contacts.length && (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '20px', color: 'var(--color-text-muted)' }}>
                        No contacts match the current audience filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <footer className="campaign-wizard-actions">
            <button className="outline-btn" onClick={() => setStep(1)}>
              <ArrowLeft size={14} /> Back: Template
            </button>
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
              Eligible recipients: <b>{liveEligibility?.currentlyEligibleRecipients ?? 0}</b>
            </span>
            <button className="primary-btn" disabled={busy || (!totalContacts && !selectedIds.length)} onClick={handleStep2Next}>
              {busy ? 'Saving Snapshot…' : 'Save Audience & Continue'} <ArrowRight size={15} />
            </button>
          </footer>
        </section>
      )}

      {/* STEP 3: Preview & Review */}
      {step === 3 && (
        <section className="campaign-wizard-card">
          <header>
            <span>STEP 3 OF 4</span>
            <h2>Personalized Message Preview & Review</h2>
            <p>Preview rendered WhatsApp messages across sample contacts with dynamic personalization tokens resolved.</p>
          </header>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', padding: '24px' }}>
            {/* WhatsApp Phone Simulator */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <strong style={{ fontSize: '13px' }}>WhatsApp Interactive Mobile Preview</strong>
                {previewRows.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      className="outline-btn small"
                      disabled={previewIndex <= 0}
                      onClick={() => setPreviewIndex(i => i - 1)}
                      style={{ padding: '2px 8px' }}
                    >
                      ←
                    </button>
                    <span style={{ fontSize: '11.5px' }}>
                      Contact {previewIndex + 1} of {previewRows.length}
                    </span>
                    <button
                      className="outline-btn small"
                      disabled={previewIndex >= previewRows.length - 1}
                      onClick={() => setPreviewIndex(i => i + 1)}
                      style={{ padding: '2px 8px' }}
                    >
                      →
                    </button>
                  </div>
                )}
              </div>

              {previewRows.length > 0 && previewRows[previewIndex] ? (
                <div>
                  <div style={{ marginBottom: '8px', padding: '8px 12px', background: 'var(--color-surface-muted)', borderRadius: '8px', fontSize: '12px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>
                      Recipient: <b>{previewRows[previewIndex].fullName}</b> ({previewRows[previewIndex].phoneNumber})
                    </span>
                    <Status value={previewRows[previewIndex].isEligible ? 'Eligible' : 'Excluded'} />
                  </div>

                  {previewRows[previewIndex].missingVariables?.length > 0 && (
                    <div style={{ marginBottom: '8px', padding: '6px 10px', background: '#fee2e2', color: '#b91c1c', borderRadius: '6px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CircleAlert size={14} /> Missing Required Tokens: {previewRows[previewIndex].missingVariables.join(', ')}
                    </div>
                  )}

                  <div className="wa-simulator-wrap">
                    <div className="wa-simulator-device">
                      <div className="wa-simulator-top">
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#075e54', display: 'grid', placeItems: 'center', color: '#fff', fontSize: '13px', fontWeight: 700 }}>
                          {(currentWorkspace?.name || 'B').trim().charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600 }}>{currentWorkspace?.name || 'Your business'}</div>
                          <div style={{ fontSize: '10.5px', color: '#25d366' }}>Official WhatsApp Business Account</div>
                        </div>
                      </div>
                      <div className="wa-simulator-body">
                        <div className="wa-message-bubble">
                          {previewRows[previewIndex].renderedPreview?.header && (
                            <div className="wa-message-header">
                              {previewRows[previewIndex].renderedPreview.header}
                            </div>
                          )}
                          <div style={{ whiteSpace: 'pre-wrap' }}>
                            {previewRows[previewIndex].renderedPreview?.body ||
                              selectedTemplate?.body ||
                              'Message body preview.'}
                          </div>
                          {previewRows[previewIndex].renderedPreview?.footer && (
                            <div className="wa-message-footer">
                              {previewRows[previewIndex].renderedPreview.footer}
                            </div>
                          )}
                        </div>
                        {previewRows[previewIndex].renderedPreview?.buttons?.map((b, bi) => (
                          <div key={bi} className="wa-message-btn">
                            {b.text || `Action Button ${bi + 1}`}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                  Loading preview contacts…
                </div>
              )}
            </div>

            {/* Campaign Review Card */}
            <div>
              <strong style={{ fontSize: '13px', display: 'block', marginBottom: '8px' }}>Campaign Plan Review Summary</strong>
              <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface-muted)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <small style={{ color: 'var(--color-text-muted)', fontSize: '11px', display: 'block' }}>CAMPAIGN NAME</small>
                  <strong style={{ fontSize: '14px' }}>{draft.name}</strong>
                </div>
                <div>
                  <small style={{ color: 'var(--color-text-muted)', fontSize: '11px', display: 'block' }}>CAMPAIGN PURPOSE</small>
                  <span style={{ fontSize: '13px' }}>{draft.customGoal || draft.goal || 'General Information & Updates'}</span>
                </div>
                <div>
                  <small style={{ color: 'var(--color-text-muted)', fontSize: '11px', display: 'block' }}>PINNED TEMPLATE</small>
                  <span style={{ fontSize: '13px' }}>
                    <b>{selectedTemplate?.name || 'Selected Template'}</b> (v{selectedTemplate?.versionNumber || selectedTemplate?.currentVersionNumber || 1} · {selectedTemplate?.language || 'en'})
                  </span>
                </div>
                <div>
                  <small style={{ color: 'var(--color-text-muted)', fontSize: '11px', display: 'block' }}>AUDIENCE SUMMARY</small>
                  <span style={{ fontSize: '13px' }}>
                    {audienceSummary?.count ?? totalContacts} snapshotted contacts
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '10px 0', borderTop: '1px solid var(--color-border-subtle)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <div>
                    <small style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>ELIGIBLE TO SEND</small>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-primary)' }}>
                      {liveEligibility?.currentlyEligibleRecipients ?? audienceSummary?.eligible ?? 0}
                    </div>
                  </div>
                  <div>
                    <small style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>EXCLUDED</small>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#dc2626' }}>
                      {liveEligibility?.excludedRecipients ?? audienceSummary?.excluded ?? 0}
                    </div>
                  </div>
                </div>
                <div>
                  <small style={{ color: 'var(--color-text-muted)', fontSize: '11px', display: 'block' }}>EXECUTION MODE</small>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-primary)' }}>
                    MOCK SIMULATION (Deterministic Engine)
                  </span>
                </div>
              </div>
            </div>
          </div>

          <footer className="campaign-wizard-actions">
            <button className="outline-btn" onClick={() => setStep(2)}>
              <ArrowLeft size={14} /> Back: Audience
            </button>
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
              Ready for schedule or execution review.
            </span>
            <button className="primary-btn" disabled={busy} onClick={handleStep3Next}>
              Continue to Launch & Schedule <ArrowRight size={15} />
            </button>
          </footer>
        </section>
      )}

      {/* STEP 4: Schedule or Launch Mock */}
      {step === 4 && (
        <section className="campaign-wizard-card">
          <header>
            <span>STEP 4 OF 4</span>
            <h2>Schedule or Launch Mock Campaign</h2>
            <p>Execute immediately or schedule for future background processing in deterministic mock sandbox.</p>
          </header>

          <div style={{ padding: '24px' }}>
            <strong style={{ fontSize: '13.5px', display: 'block', marginBottom: '12px' }}>Choose Execution Timing</strong>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <div
                onClick={() => setLaunchMode('now')}
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  border: launchMode === 'now' ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                  backgroundColor: launchMode === 'now' ? 'var(--color-primary-soft)' : 'var(--color-surface)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <Play size={18} color="var(--color-primary)" />
                  <b style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>Run Mock Now</b>
                </div>
                <p style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)', margin: 0 }}>
                  Queue campaign immediately into the background messaging engine for execution.
                </p>
              </div>

              <div
                onClick={() => setLaunchMode('schedule')}
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  border: launchMode === 'schedule' ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                  backgroundColor: launchMode === 'schedule' ? 'var(--color-primary-soft)' : 'var(--color-surface)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <Calendar size={18} color="var(--color-primary)" />
                  <b style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>Schedule Mock for Later</b>
                </div>
                <p style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)', margin: 0 }}>
                  Set a specific future date and time for automatic background simulation.
                </p>
              </div>
            </div>

            {launchMode === 'schedule' && (
              <div style={{ padding: '16px', background: 'var(--color-surface-muted)', borderRadius: '10px', marginBottom: '24px', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <label className="field" style={{ flex: 1 }}>
                  Schedule Date & Time
                  <input
                    type="datetime-local"
                    value={scheduleAt}
                    onChange={e => setScheduleAt(e.target.value)}
                  />
                </label>
                <label className="field" style={{ width: '220px' }}>
                  Timezone
                  <select value={timezone} onChange={e => setTimezone(e.target.value)}>
                    <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                    <option value="UTC">UTC</option>
                    <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                    <option value="America/New_York">America/New_York (EST)</option>
                    <option value="Europe/London">Europe/London (GMT)</option>
                  </select>
                </label>
              </div>
            )}

            {/* MOCK SAFETY BANNER */}
            <div style={{ padding: '16px 20px', borderRadius: '10px', background: '#fef3c7', border: '1px solid #fde68a', color: '#92400e', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <ShieldAlert size={18} />
                <strong style={{ fontSize: '13.5px' }}>MOCK MODE — No real WhatsApp messages will be sent</strong>
              </div>
              <p style={{ fontSize: '12.5px', margin: '0 0 10px', lineHeight: 1.4 }}>
                Meta Cloud API remains disconnected. This campaign will execute through the local deterministic messaging engine and background worker queue.
              </p>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={confirmMockAcknowledged}
                  onChange={e => setConfirmMockAcknowledged(e.target.checked)}
                />
                I understand this campaign runs as a mock simulation in offline sandbox mode.
              </label>
            </div>
          </div>

          <footer className="campaign-wizard-actions">
            <button className="outline-btn" onClick={() => setStep(3)}>
              <ArrowLeft size={14} /> Back: Preview
            </button>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="outline-btn" onClick={handleSaveDraftAndExit} disabled={busy}>
                Save as Draft
              </button>
              {launchMode === 'schedule' ? (
                <button
                  className="primary-btn"
                  disabled={busy || !confirmMockAcknowledged || !scheduleAt}
                  onClick={handleFinalLaunch}
                >
                  <Clock3 size={15} /> Schedule Mock Campaign
                </button>
              ) : (
                <button
                  className="primary-btn"
                  disabled={busy || !confirmMockAcknowledged}
                  onClick={handleFinalLaunch}
                >
                  <Play size={15} /> Launch Mock Campaign Now
                </button>
              )}
            </div>
          </footer>
        </section>
      )}
    </div>
  );
}

// CAMPAIGN DETAIL PAGE
export function CampaignDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentWorkspace, industryConfig } = useWorkspace();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('overview');
  const [audience, setAudience] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [activity, setActivity] = useState([]);
  const [executions, setExecutions] = useState([]);
  const [execution, setExecution] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [scheduleAt, setScheduleAt] = useState('');
  const [rescheduleModal, setRescheduleModal] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [jobSearch, setJobSearch] = useState('');
  const [jobStatusFilter, setJobStatusFilter] = useState('all');
  const [selectedPayloadMsg, setSelectedPayloadMsg] = useState(null);
  const [selectedEventMsg, setSelectedEventMsg] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: d }, { data: a }, { data: p }, { data: x }, { data: ex }] = await Promise.all([
        api.getCampaign(id),
        api.listCampaignAudience(id, { page, limit: 25, search }),
        api.listCampaignPreviews(id, { page, limit: 25 }),
        api.listCampaignActivity(id),
        api.listCampaignExecutions(id)
      ]);
      setData(d);
      setAudience(a.records || []);
      setTotal(a.total);
      setPreviews(p.records || []);
      setActivity(x.records || []);
      setExecutions(ex.records || []);

      const active = ex.records?.find(r => ['queued', 'running', 'paused'].includes(r.status));
      if (active) {
        const [{ data: progress }, { data: queue }] = await Promise.all([
          api.getCampaignExecution(active._id),
          api.getCampaignExecutionJobs(active._id, { page: 1, limit: 100 })
        ]);
        try {
          const { data: qStatus } = await getCampaignQueueStatus(id);
          if (qStatus?.messageStats) progress.counts = { ...progress.counts, ...qStatus.messageStats };
        } catch (_) {}
        setExecution(progress);
        setJobs(queue.records || []);
      } else {
        setExecution(null);
        setJobs([]);
      }
    } catch (e) {
      toast.error(error(e));
      navigate('/campaigns');
    } finally {
      setLoading(false);
    }
  }, [id, page, search, navigate]);

  useEffect(() => {
    load();
  }, [load]);

  // Polling while execution is running
  useEffect(() => {
    if (!executions.some(x => ['queued', 'running'].includes(x.status))) return;
    const timer = setInterval(() => load(), 2500);
    return () => clearInterval(timer);
  }, [executions, load]);

  const duplicate = async () => {
    try {
      const { data: d } = await api.duplicateCampaign(id);
      navigate(`/campaigns/${d.campaign._id}/edit`);
    } catch (e) {
      toast.error(error(e));
    }
  };

  const archive = async () => {
    if (!window.confirm('Archive this campaign?')) return;
    try {
      await api.archiveCampaign(id);
      toast.success('Campaign archived.');
      await load();
    } catch (e) {
      toast.error(error(e));
    }
  };

  const handleLaunchNow = async () => {
    try {
      await api.launchCampaign(id);
      toast.success('Mock campaign execution started.');
      await load();
    } catch (e) {
      toast.error(error(e));
    }
  };

  const handlePause = async () => {
    try {
      await api.pauseCampaign(id);
      toast.success('Campaign simulation paused.');
      await load();
    } catch (e) {
      toast.error(error(e));
    }
  };

  const handleResume = async () => {
    try {
      await api.resumeCampaign(id);
      toast.success('Campaign simulation resumed.');
      await load();
    } catch (e) {
      toast.error(error(e));
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Cancel this campaign? Undispatched jobs will be halted.')) return;
    try {
      await api.cancelCampaign(id);
      toast.success('Campaign cancelled.');
      await load();
    } catch (e) {
      toast.error(error(e));
    }
  };

  const handleReschedule = async () => {
    if (!rescheduleDate) return toast.error('Choose a new date and time.');
    try {
      await api.rescheduleCampaign(id, { startAt: new Date(rescheduleDate).toISOString() });
      toast.success('Campaign rescheduled.');
      setRescheduleModal(false);
      await load();
    } catch (e) {
      toast.error(error(e));
    }
  };

  const handleRetryFailed = async () => {
    try {
      const { data: res } = await api.retryFailedCampaignMessages(id);
      toast.success(`Requeued ${res.retriedCount} eligible failed message jobs.`);
      await load();
    } catch (e) {
      toast.error(error(e));
    }
  };

  const download = async () => {
    try {
      const { data: blob } = await api.exportCampaignAudience(id);
      saveBlob(blob, 'campaign-audience.csv');
    } catch (e) {
      toast.error(error(e));
    }
  };

  if (loading || !data) {
    return (
      <div className="campaign-loading">
        <LoaderCircle className="spin" /> Loading campaign…
      </div>
    );
  }

  const c = data.campaign;
  const v = data.validation || {};

  const filteredJobs = jobs.filter(j => {
    if (jobStatusFilter !== 'all' && j.status !== jobStatusFilter) return false;
    if (jobSearch.trim()) {
      const term = jobSearch.trim().toLowerCase();
      const name = (j.contact?.fullName || '').toLowerCase();
      const phone = (j.contact?.phoneNumber || '').toLowerCase();
      const body = (j.preview?.body || '').toLowerCase();
      if (!name.includes(term) && !phone.includes(term) && !body.includes(term)) return false;
    }
    return true;
  });

  return (
    <div className="campaign-page campaign-detail-page">
      <div className="campaign-detail-top">
        <Link to="/campaigns" className="back-link">
          <ArrowLeft size={14} /> Campaigns
        </Link>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {['Draft', 'Ready'].includes(c.status) && (
            <>
              <button className="primary-btn small cp-btn-primary" onClick={handleLaunchNow}>
                <Play size={13} /> Launch Mock Now
              </button>
              <button className="outline-btn small" onClick={() => navigate(`/campaigns/${id}/edit`)}>
                <FileText size={13} /> Edit Draft
              </button>
            </>
          )}
          {c.status === 'Scheduled' && (
            <>
              <button className="outline-btn small" onClick={() => setRescheduleModal(true)}>
                <Clock3 size={13} /> Reschedule
              </button>
              <button className="outline-btn small text-danger" onClick={handleCancel}>
                <Ban size={13} /> Cancel Schedule
              </button>
            </>
          )}
          {c.status === 'Running' && (
            <>
              <button className="outline-btn small" onClick={handlePause}>
                <Ban size={13} style={{ color: '#d97706' }} /> Pause
              </button>
              <button className="outline-btn small text-danger" onClick={handleCancel}>
                <X size={13} /> Cancel
              </button>
            </>
          )}
          {c.status === 'Paused' && (
            <>
              <button className="primary-btn small cp-btn-primary" onClick={handleResume}>
                <Play size={13} /> Resume
              </button>
              <button className="outline-btn small text-danger" onClick={handleCancel}>
                <X size={13} /> Cancel
              </button>
            </>
          )}
          {c.status === 'Failed' && (
            <button className="primary-btn small cp-btn-primary" onClick={handleRetryFailed}>
              <RotateCcw size={13} /> Retry Eligible Failures
            </button>
          )}
          <button className="outline-btn small" onClick={duplicate}>
            <Copy size={13} /> Duplicate
          </button>
          <button className="outline-btn small" onClick={archive}>
            <Archive size={13} /> Archive
          </button>
        </div>
      </div>

      <div className="campaign-heading">
        <div>
          <div className="form-kicker">{`${(currentWorkspace?.name || 'CAMPAIGN').toUpperCase()} DETAIL · ${c.campaignType?.toUpperCase() || 'ONE-TIME'}`}</div>
          <h1>{c.name}</h1>
          <p>{c.description || c.customGoal || c.goal}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="cp-mode-badge" style={{ padding: '5px 12px', fontSize: '11px' }}>
            MOCK SIMULATION
          </span>
          <Status value={c.status} />
        </div>
      </div>

      <div className="campaign-detail-tabs">
        {[
          ['overview', 'Overview'],
          ['audience', 'Audience & Eligibility'],
          ['messages', 'Personalized Previews'],
          ['executions', 'Message Execution & Queue Monitoring'],
          ['activity', 'Activity & Audit Log']
        ].map(([key, label]) => (
          <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="campaign-detail-grid">
          <section className="campaign-panel">
            <h2>Campaign Overview</h2>
            <dl>
              <dt>Description</dt>
              <dd>{c.description || '—'}</dd>
              <dt>Purpose / Goal</dt>
              <dd>{c.customGoal || c.goal || '—'}</dd>
              <dt>Category</dt>
              <dd>{c.category || 'General'}{c.subcategory ? ` · ${c.subcategory}` : ''}</dd>
              <dt>Focus Service / Location</dt>
              <dd>{[c.service, c.location].filter(Boolean).join(' · ') || '—'}</dd>
              <dt>Campaign Type</dt>
              <dd>{c.campaignType || 'one-time'}</dd>
              <dt>Scheduled Date</dt>
              <dd>{c.mockSchedule?.startAt ? new Date(c.mockSchedule.startAt).toLocaleString() : 'Not scheduled'}</dd>
              <dt>Created</dt>
              <dd>{new Date(c.createdAt).toLocaleString()}</dd>
              <dt>Modified</dt>
              <dd>{new Date(c.updatedAt).toLocaleString()}</dd>
            </dl>
          </section>

          <section className="campaign-panel">
            <h2>Pinned Template Snapshot</h2>
            {data.template ? (
              <>
                <b>{data.template.name}</b>
                <p>
                  {data.template.category} · {data.template.language} · v{data.template.selectedVersion?.versionNumber || 1}
                </p>
                <Status value={data.template.providerStatus || 'Approved'} />
                <pre style={{ margin: '12px 0', background: 'var(--color-surface-muted)', padding: '12px', borderRadius: '8px', fontSize: '12.5px', whiteSpace: 'pre-wrap' }}>
                  {c.templateSnapshot?.body || data.template.selectedVersion?.snapshot?.body || 'No template body'}
                </pre>
              </>
            ) : (
              <p>No template version pinned.</p>
            )}
            <div className="campaign-requirement-note">
              <CircleAlert size={15} /> All executions run in offline mock sandbox. External Meta Graph APIs remain disconnected.
            </div>
          </section>
        </div>
      )}

      {tab === 'audience' && (
        <section className="campaign-panel">
          <div className="campaign-section-toolbar">
            <h2>Audience · {total} snapshotted contacts</h2>
            <div style={{ display: 'flex', gap: '8px' }}>
              <label className="template-search">
                <Search size={14} />
                <input
                  value={search}
                  onChange={e => {
                    setPage(1);
                    setSearch(e.target.value);
                  }}
                  placeholder="Search audience…"
                />
              </label>
              <button className="outline-btn small" onClick={download}>
                <Download size={13} /> Export Audience
              </button>
            </div>
          </div>
          <CampaignAudienceTable records={audience} onRemoved={load} />
        </section>
      )}

      {tab === 'messages' && (
        <section className="campaign-panel">
          <div className="campaign-section-toolbar">
            <h2>Personalized Message Previews</h2>
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Deterministic simulation preview</span>
          </div>
          <CampaignAudienceTable records={audience} previews={previews} onViewMessage={i => {}} onRemoved={load} />
        </section>
      )}

      {tab === 'executions' && (
        <section className="campaign-panel">
          <div className="campaign-section-toolbar">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <h2 style={{ margin: 0 }}>Message Execution & Queue Monitoring</h2>
                <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', background: 'var(--color-primary-soft)', color: 'var(--color-primary)', fontWeight: 600 }}>
                  MOCK SIMULATION
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--color-text-muted)' }}>
                Deterministic offline simulation engine · Real WhatsApp Cloud API remains disconnected in sandbox
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['Draft', 'Ready'].includes(c.status) && (
                <button className="primary-btn small" onClick={handleLaunchNow}>
                  <Play size={13} /> Start Simulation
                </button>
              )}
              <button className="outline-btn small" onClick={() => load()} title="Refresh execution status">
                <RefreshCw size={13} /> Refresh
              </button>
            </div>
          </div>

          {execution && (
            <div className="campaign-execution-banner" style={{ display: 'flex', flexDirection: 'column', gap: '10px', margin: '14px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <b>{execution.execution.status.toUpperCase()}</b>
                  <span>
                    {execution.execution.totalJobs} total jobs · {execution.progressPercentage}% complete
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {['queued', 'running'].includes(execution.execution.status) && (
                    <button className="outline-btn small" onClick={handlePause}>
                      Pause
                    </button>
                  )}
                  {execution.execution.status === 'paused' && (
                    <button className="outline-btn small" onClick={handleResume}>
                      Resume
                    </button>
                  )}
                  <button className="outline-btn small text-danger" onClick={handleCancel}>
                    Cancel
                  </button>
                </div>
              </div>
              {/* Real Progress Bar */}
              <div style={{ width: '100%', height: '7px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${execution.progressPercentage}%`, height: '100%', background: 'var(--color-primary)', transition: 'width 0.4s ease' }} />
              </div>
              <small style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>
                Simulated Sent: <b>{execution.counts.simulated_success || 0}</b> · Blocked: <b>{execution.counts.blocked || 0}</b> · Failed: <b>{execution.counts.failed || 0}</b> · Queued: <b>{execution.counts.queued || 0}</b> · Processing: <b>{execution.counts.processing || 0}</b> · Cancelled: <b>{execution.counts.cancelled || 0}</b>
              </small>
            </div>
          )}

          {/* Job Filter & Search Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '14px 0 10px', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label className="template-search" style={{ margin: 0 }}>
                <Search size={14} />
                <input value={jobSearch} onChange={e => setJobSearch(e.target.value)} placeholder="Filter messages by contact or text…" />
              </label>
              <select
                value={jobStatusFilter}
                onChange={e => setJobStatusFilter(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--color-border)', fontSize: '12.5px' }}
              >
                <option value="all">All Statuses ({jobs.length})</option>
                <option value="simulated_success">Simulated Sent ({execution?.counts?.simulated_success || 0})</option>
                <option value="blocked">Blocked ({execution?.counts?.blocked || 0})</option>
                <option value="queued">Queued ({execution?.counts?.queued || 0})</option>
                <option value="processing">Processing ({execution?.counts?.processing || 0})</option>
                <option value="failed">Failed ({execution?.counts?.failed || 0})</option>
                <option value="cancelled">Cancelled ({execution?.counts?.cancelled || 0})</option>
              </select>
            </div>
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
              Showing {filteredJobs.length} of {jobs.length} recipients
            </span>
          </div>

          <div className="campaign-table-wrap">
            <table className="campaign-audience-table">
              <thead>
                <tr>
                  <th>Contact</th>
                  <th>Company</th>
                  <th>Status</th>
                  <th>Attempts</th>
                  <th>Rendered Payload</th>
                  <th>Reason / Error</th>
                  <th>Processed</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.map(j => (
                  <tr key={j._id}>
                    <td>
                      <b>{j.contact?.fullName || 'Unavailable'}</b>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{j.contact?.phoneNumber || '—'}</div>
                    </td>
                    <td>{j.contact?.companyName || '—'}</td>
                    <td>
                      <Status value={j.status} />
                    </td>
                    <td>{j.attempts || 1}</td>
                    <td title={j.preview?.body || ''}>
                      {j.preview?.body ? `${j.preview.body.slice(0, 75)}${j.preview.body.length > 75 ? '…' : ''}` : '—'}
                    </td>
                    <td style={{ maxWidth: '180px', fontSize: '11.5px', color: j.error ? '#dc2626' : 'var(--color-text-muted)' }}>
                      {j.error || '—'}
                    </td>
                    <td style={{ fontSize: '11.5px', whiteSpace: 'nowrap' }}>
                      {j.processedAt ? new Date(j.processedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          className="icon-btn small"
                          title="View Rendered Payload Snapshot"
                          onClick={() =>
                            setSelectedPayloadMsg({
                              _id: j._id,
                              messageId: `msg_${j._id.slice(-8)}`,
                              recipientName: j.contact?.fullName,
                              recipientPhone: j.contact?.phoneNumber,
                              status: j.status === 'simulated_success' ? 'SIMULATED_SENT' : j.status.toUpperCase(),
                              attemptCount: j.attempts,
                              failureCode: j.error ? 'EXECUTION_REJECTED' : '',
                              failureReason: j.error,
                              queuedAt: j.createdAt,
                              simulatedSentAt: j.processedAt,
                              renderedContentSnapshot: {
                                header: j.preview?.header || '',
                                body: j.preview?.body || '',
                                footer: j.preview?.footer || '',
                                buttons: j.preview?.buttons || []
                              }
                            })
                          }
                        >
                          <Eye size={13} />
                        </button>
                        <button
                          className="icon-btn small"
                          title="View Lifecycle Audit Events"
                          onClick={() =>
                            setSelectedEventMsg({
                              _id: j._id,
                              messageId: `msg_${j._id.slice(-8)}`
                            })
                          }
                        >
                          <Clock3 size={13} />
                        </button>
                        {j.status === 'failed' && (
                          <button
                            className="icon-btn small"
                            title="Retry Failed Message"
                            onClick={async () => {
                              try {
                                await retryMessage(j._id);
                                toast.success('Message requeued.');
                                await load();
                              } catch (e) {
                                toast.error(error(e));
                              }
                            }}
                          >
                            <RotateCcw size={13} style={{ color: 'var(--color-primary)' }} />
                          </button>
                        )}
                        {j.status === 'queued' && (
                          <button
                            className="icon-btn small"
                            title="Cancel Pending Message"
                            onClick={async () => {
                              try {
                                await cancelMessage(j._id, 'Cancelled via Campaign table');
                                toast.success('Message cancelled.');
                                await load();
                              } catch (e) {
                                toast.error(error(e));
                              }
                            }}
                          >
                            <Ban size={13} style={{ color: '#ef4444' }} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!filteredJobs.length && (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-muted)' }}>
                      No messages matching current status filter or search term.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '20px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
              Simulation History & Past Runs
            </h3>
            {executions.map(run => (
              <div className="campaign-execution-history-row" key={run._id}>
                <b>{run._id}</b>
                <span>
                  {run.trigger.toUpperCase()} · <Status value={run.status} /> · {run.totalJobs} jobs
                </span>
                <small>{new Date(run.createdAt).toLocaleString()}</small>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === 'activity' && (
        <section className="campaign-panel">
          <h2>Campaign Activity & Audit Log</h2>
          <div className="campaign-activity-list">
            {activity.map(a => (
              <article key={a._id}>
                <span>
                  <Clock3 size={14} />
                </span>
                <div>
                  <b>{a.description}</b>
                  <small>
                    {new Date(a.createdAt).toLocaleString()} · {a.activityType.replaceAll('_', ' ')}
                  </small>
                </div>
              </article>
            ))}
            {!activity.length && <div className="campaign-empty-inline">Campaign activity will appear here.</div>}
          </div>
        </section>
      )}

      {/* Reschedule Modal */}
      {rescheduleModal && (
        <div className="campaign-modal-scrim" onClick={() => setRescheduleModal(false)}>
          <section className="campaign-segment-modal" onClick={e => e.stopPropagation()}>
            <header>
              <b>Reschedule Campaign</b>
              <button className="icon-btn" onClick={() => setRescheduleModal(false)}>
                <X size={16} />
              </button>
            </header>
            <label className="field">
              New Date & Time
              <input type="datetime-local" value={rescheduleDate} onChange={e => setRescheduleDate(e.target.value)} />
            </label>
            <small style={{ color: 'var(--color-text-muted)' }}>
              Execution will be updated in the durable background queue scheduler.
            </small>
            <footer>
              <button className="outline-btn" onClick={() => setRescheduleModal(false)}>
                Cancel
              </button>
              <button className="primary-btn small" onClick={handleReschedule}>
                Save Schedule
              </button>
            </footer>
          </section>
        </div>
      )}

      {/* Message Modals */}
      <MessagePayloadModal
        isOpen={Boolean(selectedPayloadMsg)}
        onClose={() => setSelectedPayloadMsg(null)}
        message={selectedPayloadMsg}
      />
      <MessageEventsModal
        isOpen={Boolean(selectedEventMsg)}
        onClose={() => setSelectedEventMsg(null)}
        message={selectedEventMsg}
      />
    </div>
  );
}

function CampaignAudienceTable({ records, previews = [], onRemoved, onViewMessage }) {
  return (
    <div className="campaign-table-wrap">
      <table className="campaign-audience-table">
        <thead>
          <tr>
            <th>Contact</th>
            <th>Company</th>
            <th>Phone</th>
            <th>Category</th>
            <th>Location / Service</th>
            <th>Consent</th>
            <th>Validation</th>
            <th>Reason</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r, i) => {
            const c = r.contact;
            const m = r.member;
            return (
              <tr key={m._id}>
                <td>{c?.fullName || 'Deleted contact'}</td>
                <td>{c?.companyName || '—'}</td>
                <td>{c?.phoneNumber || '—'}</td>
                <td>{c?.businessCategory || c?.industry || '—'}</td>
                <td>{[c?.location, c?.interestedService].filter(Boolean).join(' · ') || '—'}</td>
                <td>{c?.whatsappConsentStatus || 'Unavailable'}</td>
                <td>
                  <Status value={m.eligibilityStatus} />
                </td>
                <td>{m.exclusionReasons?.join(' · ') || '—'}</td>
                <td>
                  <div className="campaign-row-actions">
                    {onViewMessage && (
                      <button title="View message" onClick={() => onViewMessage(i)}>
                        <MessageSquareText size={14} />
                      </button>
                    )}
                    {onRemoved && (
                      <button
                        title="Remove from campaign"
                        onClick={async () => {
                          if (!c) return;
                          try {
                            await api.removeCampaignContact(m.campaignId, c._id);
                            toast.success('Contact removed from campaign.');
                            onRemoved();
                          } catch (e) {
                            toast.error(error(e));
                          }
                        }}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
          {!records.length && (
            <tr>
              <td colSpan="9">No audience members in this page.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
