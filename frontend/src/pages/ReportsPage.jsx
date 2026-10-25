import { useEffect, useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import {
  FileBarChart2,
  Calendar,
  Filter,
  RefreshCw,
  Download,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Radio,
  ShieldCheck,
  ShieldAlert,
  Users,
  Search,
  Eye,
  Columns,
  Layers,
  ArrowRight,
  X,
  FileSpreadsheet,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  Inbox,
  RotateCcw,
  Check,
  Info
} from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';
import * as reportsApi from '../services/reports';
import '../reports.css';

// Locked Design System Status & Chart Colors
const STATUS_COLORS = {
  Draft: '#94A3B8',
  'Needs Review': '#F59E0B',
  'Validated for Preparation': '#3B82F6',
  Ready: '#2563EB',
  Scheduled: '#8B5CF6',
  Running: '#0284C7',
  Paused: '#D97706',
  Completed: '#16A34A',
  Failed: '#DC2626',
  Cancelled: '#64748B'
};

const CHART_PIE_COLORS = ['#2563EB', '#8B5CF6', '#3B82F6', '#D97706', '#DC2626', '#64748B'];

export default function ReportsPage() {
  // Navigation & Tabs
  const [activeTab, setActiveTab] = useState('overview');

  // Filters State
  const [range, setRange] = useState('30d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [executionMode, setExecutionMode] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('all');
  const [filterOptions, setFilterOptions] = useState({ campaigns: [], statuses: [] });

  // Data Loading & Refresh
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Tab Data States
  const [overviewData, setOverviewData] = useState(null);
  const [campaignData, setCampaignData] = useState({ records: [], pagination: { total: 0, page: 1, limit: 10, pages: 1 } });
  const [campaignPage, setCampaignPage] = useState(1);
  const [campaignSearch, setCampaignSearch] = useState('');

  // Comparison State (2-4 campaigns)
  const [selectedForCompare, setSelectedForCompare] = useState([]);
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [comparisonResults, setComparisonResults] = useState(null);
  const [comparing, setComparing] = useState(false);

  // Campaign Detail Drawer
  const [detailCampaign, setDetailCampaign] = useState(null);

  // Message Activity State
  const [messageStatusData, setMessageStatusData] = useState(null);
  const [failuresData, setFailuresData] = useState([]);
  const [retryData, setRetryData] = useState(null);
  const [recipientData, setRecipientData] = useState({ records: [], pagination: { total: 0, page: 1, limit: 10, pages: 1 } });
  const [recipientPage, setRecipientPage] = useState(1);
  const [recipientSearch, setRecipientSearch] = useState('');
  const [recipientStatusFilter, setRecipientStatusFilter] = useState('all');

  // Consent & Opt-Outs State
  const [consentData, setConsentData] = useState(null);
  const [optOutData, setOptOutData] = useState({ records: [], pagination: { total: 0, page: 1, limit: 10, pages: 1 } });
  const [optOutPage, setOptOutPage] = useState(1);
  const [exclusionsData, setExclusionsData] = useState(null);
  const [inboxAnalytics, setInboxAnalytics] = useState(null);

  // Exports State
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportType, setExportType] = useState('campaign_summary');
  const [exportFormat, setExportFormat] = useState('csv');
  const [exporting, setExporting] = useState(false);
  const [exportHistory, setExportHistory] = useState([]);
  const [loadError, setLoadError] = useState('');

  // Load available filter options once
  useEffect(() => {
    reportsApi
      .getFilters()
      .then((data) => setFilterOptions(data))
      .catch(() => {});
  }, []);

  // Compute active query parameters for reporting endpoints
  const queryParams = useMemo(() => {
    const p = { range, executionMode };
    if (range === 'custom') {
      if (customStart) p.start = customStart;
      if (customEnd) p.end = customEnd;
    }
    if (selectedCampaignId) p.campaignId = selectedCampaignId;
    if (statusFilter && statusFilter !== 'all') p.status = statusFilter;
    return p;
  }, [range, customStart, customEnd, selectedCampaignId, executionMode, statusFilter]);

  // Main Loader
  const loadActiveTabData = async (isManual = false) => {
    setLoadError('');
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      if (activeTab === 'overview') {
        const data = await reportsApi.getOverview(queryParams);
        setOverviewData(data);
      } else if (activeTab === 'campaigns') {
        const data = await reportsApi.getCampaignPerformance({
          ...queryParams,
          page: campaignPage,
          limit: 10,
          search: campaignSearch
        });
        setCampaignData(data);
      } else if (activeTab === 'messages') {
        const [statusRes, failRes, retriesRes] = await Promise.all([
          reportsApi.getMessageStatus(queryParams),
          reportsApi.getFailures(queryParams),
          reportsApi.getRetries(queryParams)
        ]);
        setMessageStatusData(statusRes);
        setFailuresData(failRes.failures || []);
        setRetryData(retriesRes);

        if (selectedCampaignId) {
          const recips = await reportsApi.getCampaignRecipients(selectedCampaignId, {
            page: recipientPage,
            limit: 10,
            search: recipientSearch,
            eligibilityStatus: recipientStatusFilter
          });
          setRecipientData(recips);
        } else {
          setRecipientData({ records: [], pagination: { total: 0, page: 1, limit: 10, pages: 1 } });
        }
      } else if (activeTab === 'consent') {
        const [consRes, optRes, exclRes, inbRes] = await Promise.all([
          reportsApi.getConsent(queryParams),
          reportsApi.getOptOuts({ page: optOutPage, limit: 10 }),
          reportsApi.getAudienceExclusions(queryParams),
          reportsApi.getInboxAnalytics(queryParams)
        ]);
        setConsentData(consRes);
        setOptOutData(optRes);
        setExclusionsData(exclRes);
        setInboxAnalytics(inbRes);
      } else if (activeTab === 'exports') {
        const history = await reportsApi.getExportHistory();
        setExportHistory(history.records || []);
      }
      setLastUpdated(new Date());
    } catch (err) {
      setLoadError(err?.response?.data?.message || 'Failed to load report data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadActiveTabData();
  }, [activeTab, queryParams, campaignPage, campaignSearch, recipientPage, recipientSearch, recipientStatusFilter, optOutPage]);

  // Campaign Comparison Handler
  const handleToggleCompare = (campaignId) => {
    setSelectedForCompare((prev) => {
      if (prev.includes(campaignId)) {
        return prev.filter((id) => id !== campaignId);
      }
      if (prev.length >= 4) {
        toast.error('You can compare a maximum of 4 campaigns.');
        return prev;
      }
      return [...prev, campaignId];
    });
  };

  const handleOpenComparison = async () => {
    if (selectedForCompare.length < 2) {
      toast.error('Please select at least 2 campaigns to compare.');
      return;
    }
    setComparing(true);
    try {
      const data = await reportsApi.compareCampaigns(selectedForCompare);
      setComparisonResults(data);
      setCompareModalOpen(true);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to compare campaigns.');
    } finally {
      setComparing(false);
    }
  };

  // Export Report Download
  const handleExportDownload = async () => {
    setExporting(true);
    try {
      const payload = {
        reportType: exportType,
        format: exportFormat,
        filters: queryParams
      };
      const res = await reportsApi.exportReport(payload);
      const blob = new Blob([res.data], {
        type: exportFormat === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv'
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${exportType}-${new Date().toISOString().slice(0, 10)}.${exportFormat}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(`${exportFormat.toUpperCase()} report exported successfully.`);
      setExportModalOpen(false);

      // Refresh export history if on exports tab
      if (activeTab === 'exports') {
        const history = await reportsApi.getExportHistory();
        setExportHistory(history.records || []);
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Export failed.');
    } finally {
      setExporting(false);
    }
  };

  // Download past generation
  const handleDownloadHistoryItem = async (item) => {
    try {
      const res = await reportsApi.downloadExport(item._id);
      const blob = new Blob([res.data], { type: item.mimeType || 'application/octet-stream' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = item.fileName || `report.${item.format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('File downloaded.');
    } catch (err) {
      toast.error('Failed to download archived export.');
    }
  };

  if (loadError) return <div className="reports-page" role="alert"><p>{loadError}</p><button className="outline-btn" onClick={() => loadActiveTabData(true)}>Retry reports</button></div>;

  return (
    <div className="reports-page">
      {/* 1. Header */}
      <PageHeader
        eyebrow="WHATSAPP AUTOMATION · REPORTING & ANALYTICS"
        title="Reports & Analytics"
        subtitle="Track campaign performance, messaging activity and operational insights."
      />

      {/* 2. Global Filter Toolbar */}
      <div className="reports-toolbar">
        <div className="reports-toolbar-left">
          {/* Date Range Selector */}
          <div className="reports-filter-group">
            <Calendar size={15} className="reports-filter-icon" />
            <select
              className="reports-select"
              value={range}
              onChange={(e) => setRange(e.target.value)}
              aria-label="Select Date Range"
            >
              <option value="today">Today</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="this_month">This Month</option>
              <option value="previous_month">Last Month</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {/* Custom Date Inputs if custom selected */}
          {range === 'custom' && (
            <div className="reports-filter-group">
              <input
                type="date"
                className="reports-date-input"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                aria-label="Custom Start Date"
              />
              <span style={{ color: 'var(--rp-muted)', fontSize: '12px' }}>to</span>
              <input
                type="date"
                className="reports-date-input"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                aria-label="Custom End Date"
              />
            </div>
          )}

          {/* Campaign Selector */}
          <div className="reports-filter-group">
            <Filter size={15} className="reports-filter-icon" />
            <select
              className="reports-select"
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
              style={{ maxWidth: '220px' }}
              aria-label="Filter by Campaign"
            >
              <option value="">All Campaigns</option>
              {(filterOptions.campaigns || []).map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Execution Mode */}
          <div className="reports-filter-group">
            <Radio size={15} className="reports-filter-icon" />
            <select
              className="reports-select"
              value={executionMode}
              onChange={(e) => setExecutionMode(e.target.value)}
              aria-label="Select Execution Mode"
            >
              <option value="ALL">All Modes</option>
              <option value="MOCK">Mock Engine Only</option>
              <option value="VERIFIED_PROVIDER">Verified Provider</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="reports-filter-group">
            <select
              className="reports-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by Status"
            >
              <option value="all">All Statuses</option>
              <option value="Completed">Completed</option>
              <option value="Running">Running</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Draft">Draft</option>
              <option value="Failed">Failed</option>
            </select>
          </div>
        </div>

        {/* Right Action Buttons */}
        <div className="reports-toolbar-right">
          {lastUpdated && (
            <span className="reports-timestamp-badge">
              <Clock size={13} />
              Refreshed {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            className="reports-btn"
            onClick={() => loadActiveTabData(true)}
            disabled={refreshing || loading}
            title="Refresh current report dataset"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <button
            className="reports-btn primary"
            onClick={() => setExportModalOpen(true)}
          >
            <Download size={14} />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {/* 3. Navigation Tabs */}
      <div className="reports-nav-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === 'overview'}
          className={`reports-nav-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <TrendingUp size={15} />
          <span>Overview</span>
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'campaigns'}
          className={`reports-nav-tab ${activeTab === 'campaigns' ? 'active' : ''}`}
          onClick={() => setActiveTab('campaigns')}
        >
          <Columns size={15} />
          <span>Campaign Performance</span>
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'messages'}
          className={`reports-nav-tab ${activeTab === 'messages' ? 'active' : ''}`}
          onClick={() => setActiveTab('messages')}
        >
          <Layers size={15} />
          <span>Message Activity</span>
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'consent'}
          className={`reports-nav-tab ${activeTab === 'consent' ? 'active' : ''}`}
          onClick={() => setActiveTab('consent')}
        >
          <ShieldCheck size={15} />
          <span>Consent & Opt-outs</span>
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'exports'}
          className={`reports-nav-tab ${activeTab === 'exports' ? 'active' : ''}`}
          onClick={() => setActiveTab('exports')}
        >
          <FileSpreadsheet size={15} />
          <span>Exports</span>
        </button>
      </div>

      {/* =========================================================================
          TAB 1: OVERVIEW
          ========================================================================= */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* 4 Primary KPI Cards */}
          <div className="reports-kpi-grid">
            {/* Card 1: Total Campaigns */}
            <div className="reports-kpi-card">
              <div className="reports-kpi-head">
                <span className="reports-kpi-label">Total Campaigns</span>
                <div className="reports-kpi-icon blue">
                  <FileBarChart2 size={18} />
                </div>
              </div>
              <div className="reports-kpi-value">{overviewData?.kpis?.totalCampaigns ?? 0}</div>
              <div className="reports-kpi-foot">
                <CheckCircle2 size={13} color="var(--rp-blue)" />
                <span>Non-archived campaigns in database</span>
              </div>
            </div>

            {/* Card 2: Scheduled / Running */}
            <div className="reports-kpi-card">
              <div className="reports-kpi-head">
                <span className="reports-kpi-label">Scheduled / Running</span>
                <div className="reports-kpi-icon violet">
                  <Clock size={18} />
                </div>
              </div>
              <div className="reports-kpi-value">{overviewData?.kpis?.scheduledRunningCampaigns ?? 0}</div>
              <div className="reports-kpi-foot">
                <Clock size={13} color="var(--rp-violet)" />
                <span>Queued or active orchestrations</span>
              </div>
            </div>

            {/* Card 3: Mock Messages Processed */}
            <div className="reports-kpi-card">
              <div className="reports-kpi-head">
                <span className="reports-kpi-label">Mock Messages Processed</span>
                <div className="reports-kpi-icon blue">
                  <Layers size={18} />
                </div>
              </div>
              <div className="reports-kpi-value">{overviewData?.kpis?.mockMessagesProcessed ?? 0}</div>
              <div className="reports-kpi-foot">
                <span className="rp-badge blue" style={{ fontSize: '11px', padding: '1px 6px' }}>
                  Mock Engine
                </span>
                <span>Simulated outbound dispatches</span>
              </div>
            </div>

            {/* Card 4: Verified WhatsApp Messages Sent */}
            <div className="reports-kpi-card" style={{ borderLeft: '3px solid var(--rp-warning)' }}>
              <div className="reports-kpi-head">
                <span className="reports-kpi-label">Verified Messages Sent</span>
                <div className="reports-kpi-icon warning">
                  <Radio size={18} />
                </div>
              </div>
              <div className="reports-kpi-value" style={{ fontSize: '22px', color: 'var(--rp-muted)', paddingTop: '4px' }}>
                Not Available
              </div>
              <div className="reports-kpi-foot">
                <span className="rp-badge warning" style={{ fontSize: '11px', padding: '1px 6px' }}>
                  Provider Disconnected
                </span>
                <span>Meta API offline</span>
              </div>
            </div>
          </div>

          {/* Secondary Operational Metrics Structured Grouping */}
          <div className="reports-secondary-section">
            {/* Group A: Campaign Lifecycle */}
            <div className="reports-secondary-group">
              <div className="reports-secondary-group-head">
                <span className="reports-secondary-group-title">Campaign Lifecycle</span>
                <span style={{ fontSize: '11.5px', color: 'var(--rp-muted)' }}>Status Breakdown</span>
              </div>
              <div className="reports-secondary-group-grid">
                <div className="reports-secondary-tile">
                  <span className="reports-secondary-tile-label">Draft Campaigns</span>
                  <span className="reports-secondary-tile-value">{overviewData?.secondaryMetrics?.draftCampaigns ?? 0}</span>
                </div>
                <div className="reports-secondary-tile">
                  <span className="reports-secondary-tile-label">Ready for Preparation</span>
                  <span className="reports-secondary-tile-value" style={{ color: 'var(--rp-blue)' }}>
                    {overviewData?.secondaryMetrics?.readyCampaigns ?? 0}
                  </span>
                </div>
                <div className="reports-secondary-tile">
                  <span className="reports-secondary-tile-label" title="Historical completed execution runs across campaigns">
                    Completed Mock Runs
                  </span>
                  <span className="reports-secondary-tile-value" style={{ color: 'var(--rp-success)' }}>
                    {overviewData?.secondaryMetrics?.completedMockRuns ?? 0}
                  </span>
                </div>
                <div className="reports-secondary-tile">
                  <span className="reports-secondary-tile-label">Failed Mock Runs</span>
                  <span
                    className="reports-secondary-tile-value"
                    style={{ color: overviewData?.secondaryMetrics?.failedMockRuns ? 'var(--rp-danger)' : 'var(--rp-navy)' }}
                  >
                    {overviewData?.secondaryMetrics?.failedMockRuns ?? 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Group B: Messaging Operations */}
            <div className="reports-secondary-group">
              <div className="reports-secondary-group-head">
                <span className="reports-secondary-group-title">Messaging Operations</span>
                <span style={{ fontSize: '11.5px', color: 'var(--rp-muted)' }}>Dispatch & Queue</span>
              </div>
              <div className="reports-secondary-group-grid">
                <div className="reports-secondary-tile">
                  <span className="reports-secondary-tile-label">Excluded Recipients</span>
                  <span className="reports-secondary-tile-value" style={{ color: 'var(--rp-warning)' }}>
                    {overviewData?.secondaryMetrics?.excludedRecipients ?? 0}
                  </span>
                </div>
                <div className="reports-secondary-tile">
                  <span className="reports-secondary-tile-label" title="Additional delivery attempts across all message runs">
                    Retry Attempts
                  </span>
                  <span className="reports-secondary-tile-value">{overviewData?.secondaryMetrics?.retryAttempts ?? 0}</span>
                </div>
                <div className="reports-secondary-tile">
                  <span className="reports-secondary-tile-label">Unread Inbox Threads</span>
                  <span className="reports-secondary-tile-value" style={{ color: 'var(--rp-blue)' }}>
                    {overviewData?.secondaryMetrics?.unreadConversations ?? 0}
                  </span>
                </div>
                <div className="reports-secondary-tile">
                  <span className="reports-secondary-tile-label">Queue Health</span>
                  <span className="reports-secondary-tile-value" style={{ fontSize: '14px', color: 'var(--rp-success)', marginTop: '4px' }}>
                    100% Operational
                  </span>
                </div>
              </div>
            </div>

            {/* Group C: Compliance & Provider */}
            <div className="reports-secondary-group">
              <div className="reports-secondary-group-head">
                <span className="reports-secondary-group-title">Compliance & Replies</span>
                <span style={{ fontSize: '11.5px', color: 'var(--rp-muted)' }}>Audit Safeguards</span>
              </div>
              <div className="reports-secondary-group-grid">
                <div className="reports-secondary-tile">
                  <span className="reports-secondary-tile-label">Recorded Opt-Outs</span>
                  <span className="reports-secondary-tile-value" style={{ color: 'var(--rp-danger)' }}>
                    {overviewData?.secondaryMetrics?.recordedOptOuts ?? 0}
                  </span>
                </div>
                <div className="reports-secondary-tile">
                  <span className="reports-secondary-tile-label">Verified Customer Replies</span>
                  <span className="reports-secondary-tile-value" style={{ fontSize: '16px', color: 'var(--rp-muted)', marginTop: '4px' }}>
                    —
                  </span>
                </div>
                <div className="reports-secondary-tile" style={{ gridColumn: 'span 2' }}>
                  <span className="reports-secondary-tile-label">Provider Connection Status</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                    <span className="rp-badge warning" style={{ fontSize: '11px' }}>
                      Mock Mode Active
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--rp-muted)' }}>Official Meta provider disconnected</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Visual Charts: 2 Column Grid */}
          <div className="reports-charts-grid">
            {/* Chart 1: Message Processing Trend */}
            <div className="reports-panel">
              <div className="reports-panel-head">
                <div>
                  <div className="reports-panel-title">Mock Message Processing Trend</div>
                  <div className="reports-panel-subtitle">Daily dispatches and failures in selected period</div>
                </div>
                <span className="rp-badge blue" style={{ fontSize: '11px' }}>
                  Mock Telemetry
                </span>
              </div>
              <div style={{ padding: '16px 20px', height: '280px' }}>
                {(overviewData?.charts?.messageTrend || []).length > 0 &&
                overviewData.charts.messageTrend.some((d) => d.simulatedSent > 0 || d.failed > 0 || d.total > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={overviewData.charts.messageTrend}>
                      <defs>
                        <linearGradient id="colorSentBlue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563EB" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="colorFailRed" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#DC2626" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#DC2626" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis dataKey="date" stroke="#94A3B8" fontSize={11} tickLine={false} />
                      <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0F172A',
                          borderColor: '#1E293B',
                          borderRadius: '8px',
                          color: '#F8FAFC',
                          fontSize: '12px',
                          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.2)'
                        }}
                      />
                      <Legend verticalAlign="top" height={36} iconType="circle" />
                      <Area
                        type="monotone"
                        dataKey="simulatedSent"
                        name="Simulated Sent"
                        stroke="#2563EB"
                        strokeWidth={2}
                        dot={{ r: 4, fill: '#2563EB', strokeWidth: 1, stroke: '#FFFFFF' }}
                        fillOpacity={1}
                        fill="url(#colorSentBlue)"
                      />
                      <Area
                        type="monotone"
                        dataKey="failed"
                        name="Simulated Failed"
                        stroke="#DC2626"
                        strokeWidth={2}
                        dot={{ r: 4, fill: '#DC2626', strokeWidth: 1, stroke: '#FFFFFF' }}
                        fillOpacity={1}
                        fill="url(#colorFailRed)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div
                    style={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--rp-muted)',
                      fontSize: '13px',
                      textAlign: 'center',
                      padding: '20px'
                    }}
                  >
                    <Layers size={32} style={{ color: 'var(--rp-muted)', opacity: 0.4, marginBottom: '10px' }} />
                    <span style={{ fontWeight: 600, color: 'var(--rp-navy)', marginBottom: '4px' }}>
                      No mock message dispatches in this date range.
                    </span>
                    <span style={{ fontSize: '12px', maxWidth: '320px', color: 'var(--rp-muted)' }}>
                      Daily dispatch trends will render here once campaigns are executed in mock simulation mode.
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Chart 2: Campaign Status Distribution */}
            <div className="reports-panel">
              <div className="reports-panel-head">
                <div>
                  <div className="reports-panel-title">Campaign Status Distribution</div>
                  <div className="reports-panel-subtitle">Count of campaigns grouped by current state</div>
                </div>
              </div>
              <div style={{ padding: '16px 20px', height: '280px' }}>
                {(overviewData?.charts?.campaignStatusDistribution || []).length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={overviewData.charts.campaignStatusDistribution}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis dataKey="status" stroke="#94A3B8" fontSize={11} tickLine={false} />
                      <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0F172A',
                          borderColor: '#1E293B',
                          borderRadius: '8px',
                          color: '#F8FAFC',
                          fontSize: '12px'
                        }}
                      />
                      <Bar dataKey="count" name="Campaigns" radius={[4, 4, 0, 0]}>
                        {(overviewData.charts.campaignStatusDistribution || []).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.status] || '#2563EB'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'var(--rp-muted)', fontSize: '13px' }}>
                    No campaigns created yet.
                  </div>
                )}
              </div>
            </div>

            {/* Chart 3: Failure Breakdown */}
            <div className="reports-panel">
              <div className="reports-panel-head">
                <div>
                  <div className="reports-panel-title">Top Failure Reasons</div>
                  <div className="reports-panel-subtitle">Normalized error codes from transport & preparation</div>
                </div>
              </div>
              <div style={{ padding: '16px 20px', height: '280px' }}>
                {(overviewData?.charts?.failureBreakdown || []).length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={overviewData.charts.failureBreakdown} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis type="number" stroke="#94A3B8" fontSize={11} tickLine={false} allowDecimals={false} />
                      <YAxis type="category" dataKey="reason" stroke="#94A3B8" fontSize={11} width={130} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0F172A',
                          borderColor: '#1E293B',
                          borderRadius: '8px',
                          color: '#F8FAFC',
                          fontSize: '12px'
                        }}
                      />
                      <Bar dataKey="count" name="Occurrences" fill="#DC2626" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'var(--rp-muted)', fontSize: '13px' }}>
                    No message failure codes recorded in this date range.
                  </div>
                )}
              </div>
            </div>

            {/* Chart 4: Audience Eligibility Ratio */}
            <div className="reports-panel">
              <div className="reports-panel-head">
                <div>
                  <div className="reports-panel-title">Audience Eligibility Ratio</div>
                  <div className="reports-panel-subtitle">Eligible contacts vs excluded from dispatch</div>
                </div>
              </div>
              <div style={{ padding: '16px 20px', height: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {overviewData?.charts?.audienceBreakdown?.totalAudienceSnapshots > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Eligible for Preparation', value: overviewData.charts.audienceBreakdown.eligible },
                          { name: 'Excluded (Consent / Issues)', value: overviewData.charts.audienceBreakdown.excluded }
                        ]}
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        <Cell fill="#2563EB" />
                        <Cell fill="#D97706" />
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0F172A',
                          borderColor: '#1E293B',
                          borderRadius: '8px',
                          color: '#F8FAFC',
                          fontSize: '12px'
                        }}
                      />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ color: 'var(--rp-muted)', fontSize: '13px' }}>
                    No audience snapshots prepared yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: CAMPAIGN PERFORMANCE
          ========================================================================= */}
      {activeTab === 'campaigns' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Comparison Action Bar */}
          {selectedForCompare.length > 0 && (
            <div
              className="reports-panel"
              style={{
                padding: '14px 20px',
                background: 'var(--rp-blue-soft)',
                border: '1px solid var(--rp-blue-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Columns size={18} color="var(--rp-blue)" />
                <span style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--rp-blue)' }}>
                  {selectedForCompare.length} Campaign{selectedForCompare.length > 1 ? 's' : ''} Selected for Comparison
                </span>
                <span style={{ fontSize: '12px', color: 'var(--rp-muted)' }}>
                  (Select between 2 and 4 campaigns to compare side-by-side)
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  className="reports-btn sm"
                  onClick={() => setSelectedForCompare([])}
                >
                  Clear Selection
                </button>
                <button
                  className="reports-btn primary sm"
                  onClick={handleOpenComparison}
                  disabled={selectedForCompare.length < 2 || comparing}
                >
                  {comparing ? 'Comparing...' : 'Compare Side-by-Side'}
                </button>
              </div>
            </div>
          )}

          {/* Search & Actions Panel */}
          <div className="reports-panel">
            <div
              style={{
                padding: '14px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--rp-border-subtle)',
                gap: '12px',
                flexWrap: 'wrap'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1', minWidth: '260px' }}>
                <div style={{ position: 'relative', width: '100%', maxWidth: '380px' }}>
                  <Search size={15} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--rp-muted)' }} />
                  <input
                    type="text"
                    className="reports-date-input"
                    placeholder="Search campaign by name or category..."
                    value={campaignSearch}
                    onChange={(e) => {
                      setCampaignSearch(e.target.value);
                      setCampaignPage(1);
                    }}
                    style={{
                      paddingLeft: '36px',
                      height: '38px',
                      fontSize: '13px',
                      width: '100%',
                      background: 'var(--rp-surface-subtle)',
                      border: '1px solid var(--rp-border)',
                      borderRadius: '8px',
                      paddingRight: campaignSearch ? '30px' : '10px'
                    }}
                  />
                  {campaignSearch && (
                    <button
                      onClick={() => setCampaignSearch('')}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        top: '10px',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--rp-muted)'
                      }}
                      title="Clear search"
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--rp-muted)' }}>
                Showing {campaignData.records.length} of {campaignData.pagination.total} campaigns
              </div>
            </div>

            {/* Campaign Table */}
            <div className="reports-table-container">
              <table className="reports-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        disabled
                        title="Select individual campaigns to compare"
                      />
                    </th>
                    <th>Campaign Name</th>
                    <th>Status</th>
                    <th>Template</th>
                    <th style={{ textAlign: 'right' }}>Audience</th>
                    <th style={{ textAlign: 'right' }}>Eligible</th>
                    <th style={{ textAlign: 'right' }}>Excluded</th>
                    <th style={{ textAlign: 'right' }}>Mock Sent</th>
                    <th style={{ textAlign: 'right' }}>Failures</th>
                    <th style={{ textAlign: 'right' }}>Retries</th>
                    <th>Scheduled / Run</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {campaignData.records.length > 0 ? (
                    campaignData.records.map((c) => {
                      const isSelected = selectedForCompare.includes(c._id);
                      return (
                        <tr key={c._id}>
                          <td style={{ textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleCompare(c._id)}
                              aria-label={`Select ${c.name} for comparison`}
                            />
                          </td>
                          <td>
                            <div style={{ fontWeight: '600', color: 'var(--rp-navy)' }}>{c.name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--rp-muted)' }}>{c.category || 'General'}</div>
                          </td>
                          <td>
                            <span
                              className="rp-badge"
                              style={{
                                background: STATUS_COLORS[c.status] ? `${STATUS_COLORS[c.status]}1A` : '#F1F5F9',
                                color: STATUS_COLORS[c.status] || '#475569'
                              }}
                            >
                              {c.status}
                            </span>
                          </td>
                          <td style={{ color: 'var(--rp-text-secondary)' }}>{c.templateName}</td>
                          <td style={{ textAlign: 'right', fontWeight: '500' }}>{c.audienceSize}</td>
                          <td style={{ textAlign: 'right', color: 'var(--rp-success)', fontWeight: '600' }}>
                            {c.eligibleRecipients}
                          </td>
                          <td style={{ textAlign: 'right', color: c.excludedRecipients > 0 ? 'var(--rp-warning)' : 'var(--rp-muted)' }}>
                            {c.excludedRecipients}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: '700' }}>{c.mockMessagesProcessed}</td>
                          <td style={{ textAlign: 'right', color: c.simulatedFailures > 0 ? 'var(--rp-danger)' : 'var(--rp-muted)' }}>
                            {c.simulatedFailures}
                          </td>
                          <td style={{ textAlign: 'right', color: 'var(--rp-muted)' }}>{c.retryAttempts}</td>
                          <td style={{ fontSize: '12px', color: 'var(--rp-muted)' }}>
                            {c.actualRunDate ? new Date(c.actualRunDate).toLocaleDateString() : c.scheduledDate ? new Date(c.scheduledDate).toLocaleDateString() : '—'}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              className="reports-btn sm"
                              onClick={() => setDetailCampaign(c)}
                              title="View detailed breakdown"
                            >
                              <Eye size={12} />
                              <span>Details</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={12} style={{ padding: '40px', textAlign: 'center', color: 'var(--rp-muted)' }}>
                        No campaigns found matching selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {campaignData.pagination.pages > 1 && (
              <div
                style={{
                  padding: '12px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderTop: '1px solid var(--rp-border-subtle)',
                  fontSize: '12.5px'
                }}
              >
                <button
                  className="reports-btn sm"
                  disabled={campaignPage <= 1}
                  onClick={() => setCampaignPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <span style={{ color: 'var(--rp-muted)' }}>
                  Page {campaignPage} of {campaignData.pagination.pages}
                </span>
                <button
                  className="reports-btn sm"
                  disabled={campaignPage >= campaignData.pagination.pages}
                  onClick={() => setCampaignPage((p) => Math.min(campaignData.pagination.pages, p + 1))}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: MESSAGE ACTIVITY
          ========================================================================= */}
      {activeTab === 'messages' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Status Lifecycle Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
            {/* 1. Internal Preparation */}
            <div className="reports-panel" style={{ padding: '18px 20px' }}>
              <div style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--rp-navy)', marginBottom: '12px' }}>
                Internal Preparation States
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12.5px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--rp-muted)' }}>Queued in Background</span>
                  <span style={{ fontWeight: '600' }}>{messageStatusData?.internalPreparation?.QUEUED ?? 0}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--rp-muted)' }}>Leased / Processing</span>
                  <span style={{ fontWeight: '600' }}>{messageStatusData?.internalPreparation?.PROCESSING ?? 0}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--rp-muted)' }}>Scheduled for Future</span>
                  <span style={{ fontWeight: '600' }}>{messageStatusData?.internalPreparation?.SCHEDULED ?? 0}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--rp-muted)' }}>Blocked (Consent / Opt-out)</span>
                  <span style={{ fontWeight: '600', color: 'var(--rp-warning)' }}>{messageStatusData?.internalPreparation?.BLOCKED ?? 0}</span>
                </div>
              </div>
            </div>

            {/* 2. Mock Results */}
            <div className="reports-panel" style={{ padding: '18px 20px' }}>
              <div style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--rp-navy)', marginBottom: '12px' }}>
                Mock Engine Outcomes
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12.5px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--rp-muted)' }}>Simulated Sent</span>
                  <span style={{ fontWeight: '600', color: 'var(--rp-success)' }}>{messageStatusData?.mockResults?.SIMULATED_SENT ?? 0}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--rp-muted)' }}>Simulated Delivered</span>
                  <span style={{ fontWeight: '600', color: 'var(--rp-success)' }}>{messageStatusData?.mockResults?.SIMULATED_DELIVERED ?? 0}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--rp-muted)' }}>Temporary Failures (Retrying)</span>
                  <span style={{ fontWeight: '600', color: 'var(--rp-warning)' }}>{messageStatusData?.mockResults?.TEMPORARY_FAILURE ?? 0}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--rp-muted)' }}>Permanent Failures (Exhausted)</span>
                  <span style={{ fontWeight: '600', color: 'var(--rp-danger)' }}>{messageStatusData?.mockResults?.PERMANENT_FAILURE ?? 0}</span>
                </div>
              </div>
            </div>

            {/* 3. Verified Provider */}
            <div className="reports-panel" style={{ padding: '18px 20px', borderLeft: '3px solid var(--rp-warning)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--rp-navy)' }}>
                  Verified WhatsApp Provider
                </div>
                <span className="rp-badge warning" style={{ fontSize: '11px' }}>
                  Disconnected
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12.5px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--rp-muted)' }}>Official Provider Accepted</span>
                  <span style={{ color: 'var(--rp-muted)' }}>Unavailable</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--rp-muted)' }}>Provider Webhook Delivered</span>
                  <span style={{ color: 'var(--rp-muted)' }}>Unavailable</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--rp-muted)' }}>Customer Read Receipts</span>
                  <span style={{ color: 'var(--rp-muted)' }}>Unavailable</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--rp-muted)' }}>Customer Inbound Replies</span>
                  <span style={{ color: 'var(--rp-muted)' }}>Unavailable</span>
                </div>
              </div>
            </div>
          </div>

          {/* Retry Analytics Summary Panel */}
          {retryData && (
            <div className="reports-panel">
              <div className="reports-panel-head">
                <div>
                  <div className="reports-panel-title">Retry & Attempt Reconciliation</div>
                  <div className="reports-panel-subtitle">Durable retry telemetry for message delivery resilience</div>
                </div>
                <span className="rp-badge blue" style={{ fontSize: '11px' }}>
                  Persistent Queue
                </span>
              </div>
              <div
                style={{
                  padding: '18px 20px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '16px'
                }}
              >
                <div className="reports-secondary-tile">
                  <div className="reports-secondary-tile-label">Messages Requiring Retry</div>
                  <div className="reports-secondary-tile-value">{retryData.messagesRequiringRetry}</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--rp-muted)', marginTop: '2px' }}>
                    Unique logical messages with &gt;1 attempt
                  </div>
                </div>
                <div className="reports-secondary-tile">
                  <div className="reports-secondary-tile-label">Total Retry Attempts</div>
                  <div className="reports-secondary-tile-value">{retryData.totalRetryAttempts}</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--rp-muted)', marginTop: '2px' }}>
                    Sum of (attemptCount - 1)
                  </div>
                </div>
                <div className="reports-secondary-tile">
                  <div className="reports-secondary-tile-label">Retries Succeeded in Mock</div>
                  <div className="reports-secondary-tile-value" style={{ color: 'var(--rp-success)' }}>
                    {retryData.retriesSucceededInMockMode}
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--rp-muted)', marginTop: '2px' }}>
                    Eventual terminal success
                  </div>
                </div>
                <div className="reports-secondary-tile">
                  <div className="reports-secondary-tile-label">Retries Exhausted</div>
                  <div className="reports-secondary-tile-value" style={{ color: 'var(--rp-danger)' }}>
                    {retryData.retriesExhausted}
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--rp-muted)', marginTop: '2px' }}>
                    Max retry threshold reached
                  </div>
                </div>
              </div>
              <div style={{ padding: '0 20px 16px', fontSize: '12px', color: 'var(--rp-muted)' }}>
                <Info size={13} style={{ verticalAlign: '-2px', marginRight: '4px' }} />
                Unique recipient counts are never inflated by delivery retries. Each retry is an attempt on a single persistent message identity.
              </div>
            </div>
          )}

          {/* Failure Breakdown Table */}
          <div className="reports-panel">
            <div className="reports-panel-head">
              <div>
                <div className="reports-panel-title">Failure & Exclusion Analysis</div>
                <div className="reports-panel-subtitle">Normalized reason codes, classified by pipeline layer</div>
              </div>
            </div>
            <div className="reports-table-container">
              <table className="reports-table">
                <thead>
                  <tr>
                    <th>Failure Code</th>
                    <th>Category</th>
                    <th style={{ textAlign: 'right' }}>Affected Messages</th>
                    <th style={{ textAlign: 'right' }}>Total Attempts</th>
                    <th>Actionable Explanation</th>
                  </tr>
                </thead>
                <tbody>
                  {failuresData.length > 0 ? (
                    failuresData.map((f, idx) => (
                      <tr key={idx}>
                        <td>
                          <code style={{ fontSize: '12px', background: 'var(--rp-surface-subtle)', padding: '3px 6px', borderRadius: '4px', border: '1px solid var(--rp-border)' }}>
                            {f.failureCode}
                          </code>
                        </td>
                        <td>
                          <span
                            className="rp-badge"
                            style={{
                              fontSize: '11px',
                              background:
                                f.category === 'Eligibility Exclusion'
                                  ? 'var(--rp-warning-soft)'
                                  : f.category === 'Preparation Failure'
                                  ? 'var(--rp-blue-soft)'
                                  : 'var(--rp-danger-soft)',
                              color:
                                f.category === 'Eligibility Exclusion'
                                  ? 'var(--rp-warning)'
                                  : f.category === 'Preparation Failure'
                                  ? 'var(--rp-blue)'
                                  : 'var(--rp-danger)'
                            }}
                          >
                            {f.category}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: '700' }}>{f.affectedLogicalMessages}</td>
                        <td style={{ textAlign: 'right', color: 'var(--rp-muted)' }}>{f.totalAttempts}</td>
                        <td style={{ color: 'var(--rp-text-secondary)', fontSize: '12.5px' }}>
                          {f.actionableExplanation}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--rp-muted)' }}>
                        No failure records found for active filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recipient-Level Log Table if Campaign is selected */}
          {selectedCampaignId && (
            <div className="reports-panel">
              <div className="reports-panel-head">
                <div>
                  <div className="reports-panel-title">Campaign Recipient Details</div>
                  <div className="reports-panel-subtitle">Individual contact eligibility and mock dispatch outcomes</div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    className="reports-date-input"
                    placeholder="Search recipient..."
                    value={recipientSearch}
                    onChange={(e) => {
                      setRecipientSearch(e.target.value);
                      setRecipientPage(1);
                    }}
                    style={{
                      height: '34px',
                      fontSize: '12.5px',
                      width: '180px',
                      background: 'var(--rp-surface-subtle)',
                      border: '1px solid var(--rp-border)',
                      borderRadius: '6px',
                      padding: '0 8px'
                    }}
                  />
                  <select
                    className="reports-select"
                    value={recipientStatusFilter}
                    onChange={(e) => {
                      setRecipientStatusFilter(e.target.value);
                      setRecipientPage(1);
                    }}
                    style={{
                      height: '34px',
                      fontSize: '12.5px',
                      background: 'var(--rp-surface-subtle)',
                      border: '1px solid var(--rp-border)',
                      borderRadius: '6px',
                      padding: '0 8px'
                    }}
                  >
                    <option value="all">All Eligibility</option>
                    <option value="Eligible for Campaign Preparation">Eligible</option>
                    <option value="Missing Consent">Missing Consent</option>
                    <option value="Opted Out">Opted Out</option>
                  </select>
                </div>
              </div>
              <div className="reports-table-container">
                <table className="reports-table">
                  <thead>
                    <tr>
                      <th>Recipient Name</th>
                      <th>Phone Number</th>
                      <th>Eligibility</th>
                      <th>Execution Status</th>
                      <th style={{ textAlign: 'right' }}>Attempts</th>
                      <th>Exclusion / Failure</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recipientData.records.length > 0 ? (
                      recipientData.records.map((r, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: '500' }}>{r.contactName}</td>
                          <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{r.contactPhone}</td>
                          <td>
                            <span
                              className="rp-badge"
                              style={{
                                fontSize: '11px',
                                background: r.eligibilityStatus === 'Eligible for Campaign Preparation' ? 'var(--rp-success-soft)' : 'var(--rp-warning-soft)',
                                color: r.eligibilityStatus === 'Eligible for Campaign Preparation' ? 'var(--rp-success)' : 'var(--rp-warning)'
                              }}
                            >
                              {r.eligibilityStatus}
                            </span>
                          </td>
                          <td>{r.executionStatus}</td>
                          <td style={{ textAlign: 'right', fontWeight: '600' }}>{r.attemptCount}</td>
                          <td style={{ color: 'var(--rp-muted)', fontSize: '12px' }}>
                            {r.failureCode || (r.exclusionReasons || []).join('; ') || '—'}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--rp-muted)' }}>
                          No recipient records found for this campaign.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 4: CONSENT & OPT-OUTS
          ========================================================================= */}
      {activeTab === 'consent' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Compliance & Suppression Informational Callout */}
          <div className="reports-compliance-banner">
            <ShieldCheck size={20} color="var(--rp-blue)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>Compliance & Suppression Architecture:</strong> Contact consent status is mutually exclusive per contact (Opt-In / Unknown / Opted Out). Suppression is a zero-policy compliance guard. A contact who has opted out is also added to the suppression list to ensure zero-policy dispatch blocking across all campaigns.
            </div>
          </div>

          {/* Consent Metric Cards */}
          <div className="reports-kpi-grid">
            <div className="reports-kpi-card">
              <div className="reports-kpi-head">
                <span className="reports-kpi-label">Total Contacts</span>
                <div className="reports-kpi-icon blue">
                  <Users size={18} />
                </div>
              </div>
              <div className="reports-kpi-value">{consentData?.totalContacts ?? 0}</div>
              <div className="reports-kpi-foot">Workspace contact base</div>
            </div>

            <div className="reports-kpi-card">
              <div className="reports-kpi-head">
                <span className="reports-kpi-label">Recorded WhatsApp Opt-In</span>
                <div className="reports-kpi-icon success">
                  <ShieldCheck size={18} />
                </div>
              </div>
              <div className="reports-kpi-value" style={{ color: (consentData?.validRecordedOptIn ?? 0) > 0 ? 'var(--rp-success)' : 'var(--rp-navy)' }}>
                {consentData?.validRecordedOptIn ?? 0}
              </div>
              <div className="reports-kpi-foot">Valid consent recorded</div>
            </div>

            <div className="reports-kpi-card">
              <div className="reports-kpi-head">
                <span className="reports-kpi-label">Unknown Consent</span>
                <div className="reports-kpi-icon warning">
                  <HelpCircle size={18} />
                </div>
              </div>
              <div className="reports-kpi-value" style={{ color: 'var(--rp-warning)' }}>
                {consentData?.unknownConsent ?? 0}
              </div>
              <div className="reports-kpi-foot">Requires explicit consent capture</div>
            </div>

            <div className="reports-kpi-card" style={{ borderLeft: '3px solid var(--rp-danger)' }}>
              <div className="reports-kpi-head">
                <span className="reports-kpi-label">Opted Out / Suppressed</span>
                <div className="reports-kpi-icon" style={{ background: 'var(--rp-danger-soft)', color: 'var(--rp-danger)' }}>
                  <ShieldAlert size={18} />
                </div>
              </div>
              <div className="reports-kpi-value" style={{ color: 'var(--rp-danger)' }}>
                {(consentData?.contactsOptedOut || 0) + (consentData?.suppressedDNC || 0)}
              </div>
              <div className="reports-kpi-foot">Zero-policy blocked contacts</div>
            </div>
          </div>

          {/* Audience Exclusion Breakdown Panel */}
          {exclusionsData && (
            <div className="reports-panel">
              <div className="reports-panel-head">
                <div>
                  <div className="reports-panel-title">Campaign Audience Exclusion Reasons</div>
                  <div className="reports-panel-subtitle">
                    Unique excluded contacts: <strong>{exclusionsData.uniqueExcludedContacts}</strong> | Total exclusion reason triggers:{' '}
                    <strong>{exclusionsData.totalExclusionReasons}</strong>
                  </div>
                </div>
                <span className="rp-badge warning" style={{ fontSize: '11px' }}>
                  Safety Guards
                </span>
              </div>
              <div style={{ padding: '18px 20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                  {(exclusionsData.breakdown || []).map((item, idx) => (
                    <div
                      key={idx}
                      className="reports-secondary-tile"
                    >
                      <div className="reports-secondary-tile-label">{item.reason}</div>
                      <div className="reports-secondary-tile-value">
                        {item.count}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--rp-muted)' }}>
                  {exclusionsData.note}
                </div>
              </div>
            </div>
          )}

          {/* Opt-Out Events Table */}
          <div className="reports-panel">
            <div className="reports-panel-head">
              <div>
                <div className="reports-panel-title">Recorded Opt-Out & Suppression Events</div>
                <div className="reports-panel-subtitle">Authoritative suppression records with audit provenance</div>
              </div>
            </div>
            <div className="reports-table-container">
              <table className="reports-table">
                <thead>
                  <tr>
                    <th>Contact Name</th>
                    <th>Phone Number</th>
                    <th>Consent Status</th>
                    <th>Source Classification</th>
                    <th>Suppression Reason</th>
                    <th>Event Date</th>
                  </tr>
                </thead>
                <tbody>
                  {optOutData.records.length > 0 ? (
                    optOutData.records.map((r, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: '500' }}>{r.contactName}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{r.contactPhone}</td>
                        <td>
                          <span className="rp-badge danger">
                            {r.consentStatus}
                          </span>
                        </td>
                        <td>
                          <span
                            className="rp-badge"
                            style={{
                              fontSize: '11px',
                              background: r.source === 'VERIFIED_CUSTOMER_OPTOUT' ? 'var(--rp-success-soft)' : 'var(--rp-surface-subtle)',
                              color: r.source === 'VERIFIED_CUSTOMER_OPTOUT' ? 'var(--rp-success)' : 'var(--rp-muted)',
                              border: '1px solid var(--rp-border)'
                            }}
                          >
                            {r.source}
                          </span>
                        </td>
                        <td style={{ color: 'var(--rp-text-secondary)' }}>{r.suppressionReason}</td>
                        <td style={{ fontSize: '12px', color: 'var(--rp-muted)' }}>
                          {r.eventDate ? new Date(r.eventDate).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: 'var(--rp-muted)' }}>
                        No opt-out or suppression records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Inbox & Auto-Reply Activity */}
          {inboxAnalytics && (
            <div className="reports-panel">
              <div className="reports-panel-head">
                <div>
                  <div className="reports-panel-title">Inbox & Auto-Reply Rule Execution</div>
                  <div className="reports-panel-subtitle">Automation rules triggered by inbound simulated or test keywords</div>
                </div>
                <span className="rp-badge blue" style={{ fontSize: '11px' }}>
                  Automation
                </span>
              </div>
              <div style={{ padding: '18px 20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '16px' }}>
                  <div className="reports-secondary-tile">
                    <div className="reports-secondary-tile-label">Open Conversations</div>
                    <div className="reports-secondary-tile-value">{inboxAnalytics.openConversations}</div>
                  </div>
                  <div className="reports-secondary-tile">
                    <div className="reports-secondary-tile-label">Needs Attention (e.g. VISIT)</div>
                    <div className="reports-secondary-tile-value" style={{ color: 'var(--rp-warning)' }}>
                      {inboxAnalytics.needsAttention}
                    </div>
                  </div>
                  <div className="reports-secondary-tile">
                    <div className="reports-secondary-tile-label">Total Rules Triggered</div>
                    <div className="reports-secondary-tile-value" style={{ color: 'var(--rp-blue)' }}>
                      {inboxAnalytics.autoReplyRulesTriggered}
                    </div>
                  </div>
                </div>

                {(inboxAnalytics.autoReplies || []).length > 0 ? (
                  <div className="reports-table-container">
                    <table className="reports-table">
                      <thead>
                        <tr>
                          <th>Rule Name</th>
                          <th>Matched Keyword</th>
                          <th>Execution Mode</th>
                          <th>Status</th>
                          <th style={{ textAlign: 'right' }}>Executions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inboxAnalytics.autoReplies.map((ar, i) => (
                          <tr key={i}>
                            <td style={{ fontWeight: '500' }}>{ar.ruleName}</td>
                            <td>
                              <code style={{ fontSize: '11.5px', background: 'var(--rp-surface-subtle)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--rp-border)' }}>
                                {ar.keyword}
                              </code>
                            </td>
                            <td>
                              <span className="rp-badge neutral" style={{ fontSize: '10.5px' }}>
                                {ar.executionMode}
                              </span>
                            </td>
                            <td>{ar.status}</td>
                            <td style={{ textAlign: 'right', fontWeight: '700' }}>{ar.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: 'var(--rp-muted)' }}>No rule executions recorded yet.</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 5: EXPORTS
          ========================================================================= */}
      {activeTab === 'exports' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Export Generator Card */}
          <div className="reports-panel" style={{ padding: '22px 24px' }}>
            <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--rp-navy)', marginBottom: '4px' }}>
              Generate Custom Export
            </div>
            <div style={{ fontSize: '13px', color: 'var(--rp-muted)', marginBottom: '18px' }}>
              Export sanitized, formula-injection-protected reports adhering to owner isolation and active toolbar filters.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', marginBottom: '6px' }}>
                  Report Dataset
                </label>
                <select
                  className="reports-select"
                  value={exportType}
                  onChange={(e) => setExportType(e.target.value)}
                  style={{
                    width: '100%',
                    height: '38px',
                    fontSize: '13px',
                    background: 'var(--rp-surface-subtle)',
                    border: '1px solid var(--rp-border)',
                    borderRadius: '8px',
                    padding: '0 10px'
                  }}
                >
                  <option value="campaign_summary">Campaign Performance Summary</option>
                  <option value="campaign_recipients">Campaign Recipients & Eligibility</option>
                  <option value="failure_analysis">Failure Analysis Breakdown</option>
                  <option value="consent_summary">Consent & Suppression Summary</option>
                  <option value="opt_outs">Opt-Out & Suppression Events</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', marginBottom: '6px' }}>
                  File Format
                </label>
                <select
                  className="reports-select"
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value)}
                  style={{
                    width: '100%',
                    height: '38px',
                    fontSize: '13px',
                    background: 'var(--rp-surface-subtle)',
                    border: '1px solid var(--rp-border)',
                    borderRadius: '8px',
                    padding: '0 10px'
                  }}
                >
                  <option value="csv">CSV (Comma Separated Values)</option>
                  <option value="xlsx">XLSX (Microsoft Excel Workbook)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', marginBottom: '6px' }}>
                  Applied Filter Scope
                </label>
                <div style={{ fontSize: '12px', color: 'var(--rp-text-secondary)', padding: '9px 12px', background: 'var(--rp-surface-subtle)', borderRadius: '8px', border: '1px solid var(--rp-border)' }}>
                  Range: <strong>{range}</strong> | Mode: <strong>{executionMode}</strong>
                </div>
              </div>
            </div>

            <button
              className="reports-btn primary"
              onClick={handleExportDownload}
              disabled={exporting}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '0 20px', height: '40px', fontSize: '13px' }}
            >
              <Download size={15} />
              <span>{exporting ? 'Generating Secure Export...' : `Download ${exportFormat.toUpperCase()}`}</span>
            </button>
          </div>

          {/* Export History Table */}
          <div className="reports-panel">
            <div className="reports-panel-head">
              <div>
                <div className="reports-panel-title">Archived Export History</div>
                <div className="reports-panel-subtitle">Previously generated files available for re-download</div>
              </div>
            </div>
            <div className="reports-table-container">
              <table className="reports-table">
                <thead>
                  <tr>
                    <th>File Name</th>
                    <th>Report Type</th>
                    <th>Format</th>
                    <th style={{ textAlign: 'right' }}>Row Count</th>
                    <th>Generated Date</th>
                    <th style={{ textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {exportHistory.length > 0 ? (
                    exportHistory.map((item) => (
                      <tr key={item._id}>
                        <td style={{ fontWeight: '500', color: 'var(--rp-navy)' }}>
                          {item.fileName}
                        </td>
                        <td>{item.reportType}</td>
                        <td>
                          <span className="rp-badge neutral" style={{ fontSize: '11px', textTransform: 'uppercase' }}>
                            {item.format}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: '600' }}>
                          {item.rowCount === 0 ? (
                            <span title="No records matched the filter scope at export time" style={{ color: 'var(--rp-muted)', fontSize: '12px' }}>
                              0 (Filtered)
                            </span>
                          ) : (
                            item.rowCount
                          )}
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--rp-muted)' }}>
                          {new Date(item.createdAt).toLocaleString()}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            className="reports-btn sm"
                            onClick={() => handleDownloadHistoryItem(item)}
                            title="Download archived copy"
                          >
                            <Download size={12} />
                            <span>Download</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: 'var(--rp-muted)' }}>
                        No export files archived yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: CAMPAIGN COMPARISON (SIDE-BY-SIDE)
          ========================================================================= */}
      {compareModalOpen && comparisonResults && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
        >
          <div
            className="reports-panel"
            style={{
              width: '100%',
              maxWidth: '960px',
              maxHeight: '90vh',
              overflowY: 'auto',
              borderRadius: '14px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
            }}
          >
            <div className="reports-panel-head" style={{ borderBottom: '1px solid var(--rp-border)' }}>
              <div>
                <div className="reports-panel-title" style={{ fontSize: '17px' }}>
                  Campaign Performance Comparison
                </div>
                <div className="reports-panel-subtitle">Side-by-side evaluation of {comparisonResults.count} selected campaigns</div>
              </div>
              <button
                className="reports-btn sm"
                onClick={() => setCompareModalOpen(false)}
                style={{ width: '32px', height: '32px', padding: 0 }}
                aria-label="Close comparison modal"
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '20px' }}>
              <div className="reports-table-container">
                <table className="reports-table">
                  <thead>
                    <tr style={{ background: 'var(--rp-surface-subtle)', borderBottom: '2px solid var(--rp-border)' }}>
                      <th style={{ padding: '12px', width: '220px', fontWeight: '700' }}>Metric / Dimension</th>
                      {comparisonResults.campaigns.map((c) => (
                        <th key={c._id} style={{ padding: '12px', minWidth: '180px', fontWeight: '700', color: 'var(--rp-blue)' }}>
                          {c.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ padding: '10px 12px', fontWeight: '600' }}>Execution Mode</td>
                      {comparisonResults.campaigns.map((c) => (
                        <td key={c._id} style={{ padding: '10px 12px' }}>
                          <span className="rp-badge neutral" style={{ fontSize: '11px' }}>
                            {c.executionMode}
                          </span>
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td style={{ padding: '10px 12px', fontWeight: '600' }}>Status</td>
                      {comparisonResults.campaigns.map((c) => (
                        <td key={c._id} style={{ padding: '10px 12px' }}>
                          <span className="rp-badge" style={{ fontSize: '11px', background: `${STATUS_COLORS[c.status] || '#64748B'}1A`, color: STATUS_COLORS[c.status] || '#64748B' }}>
                            {c.status}
                          </span>
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td style={{ padding: '10px 12px', fontWeight: '600' }}>Template</td>
                      {comparisonResults.campaigns.map((c) => (
                        <td key={c._id} style={{ padding: '10px 12px' }}>{c.templateName}</td>
                      ))}
                    </tr>
                    <tr style={{ background: 'var(--rp-surface-subtle)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: '600' }}>Audience Size</td>
                      {comparisonResults.campaigns.map((c) => (
                        <td key={c._id} style={{ padding: '10px 12px', fontWeight: '700' }}>{c.audienceSize}</td>
                      ))}
                    </tr>
                    <tr>
                      <td style={{ padding: '10px 12px', fontWeight: '600' }}>Eligible Contacts</td>
                      {comparisonResults.campaigns.map((c) => (
                        <td key={c._id} style={{ padding: '10px 12px', color: 'var(--rp-success)', fontWeight: '600' }}>
                          {c.eligibleContacts}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td style={{ padding: '10px 12px', fontWeight: '600' }}>Excluded Contacts</td>
                      {comparisonResults.campaigns.map((c) => (
                        <td key={c._id} style={{ padding: '10px 12px', color: c.excludedContacts > 0 ? 'var(--rp-warning)' : 'inherit' }}>
                          {c.excludedContacts}
                        </td>
                      ))}
                    </tr>
                    <tr style={{ background: 'var(--rp-surface-subtle)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: '600' }}>Mock Messages Processed</td>
                      {comparisonResults.campaigns.map((c) => (
                        <td key={c._id} style={{ padding: '10px 12px', fontWeight: '700' }}>{c.mockMessagesProcessed}</td>
                      ))}
                    </tr>
                    <tr>
                      <td style={{ padding: '10px 12px', fontWeight: '600' }}>Simulated Failures</td>
                      {comparisonResults.campaigns.map((c) => (
                        <td key={c._id} style={{ padding: '10px 12px', color: c.failureCount > 0 ? 'var(--rp-danger)' : 'inherit' }}>
                          {c.failureCount}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td style={{ padding: '10px 12px', fontWeight: '600' }}>Retry Attempts</td>
                      {comparisonResults.campaigns.map((c) => (
                        <td key={c._id} style={{ padding: '10px 12px' }}>{c.retryAttempts}</td>
                      ))}
                    </tr>
                    <tr>
                      <td style={{ padding: '10px 12px', fontWeight: '600' }}>Run Duration</td>
                      {comparisonResults.campaigns.map((c) => (
                        <td key={c._id} style={{ padding: '10px 12px' }}>{c.runDurationFormatted}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: '16px', fontSize: '11.5px', color: 'var(--rp-muted)', lineHeight: '1.4' }}>
                {comparisonResults.modeDisclaimer}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: CAMPAIGN DETAIL BREAKDOWN
          ========================================================================= */}
      {detailCampaign && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
        >
          <div
            className="reports-panel"
            style={{
              width: '100%',
              maxWidth: '680px',
              maxHeight: '90vh',
              overflowY: 'auto',
              borderRadius: '14px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
            }}
          >
            <div className="reports-panel-head" style={{ borderBottom: '1px solid var(--rp-border)' }}>
              <div>
                <div className="reports-panel-title">{detailCampaign.name}</div>
                <div className="reports-panel-subtitle">Campaign Execution & Audience Breakdown</div>
              </div>
              <button
                className="reports-btn sm"
                onClick={() => setDetailCampaign(null)}
                style={{ width: '32px', height: '32px', padding: 0 }}
                aria-label="Close detail modal"
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', fontSize: '13px' }}>
                <div style={{ padding: '10px 12px', background: 'var(--rp-surface-subtle)', borderRadius: '8px', border: '1px solid var(--rp-border)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--rp-muted)' }}>Status</div>
                  <div style={{ fontWeight: '600', marginTop: '2px' }}>{detailCampaign.status}</div>
                </div>
                <div style={{ padding: '10px 12px', background: 'var(--rp-surface-subtle)', borderRadius: '8px', border: '1px solid var(--rp-border)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--rp-muted)' }}>Execution Mode</div>
                  <div style={{ fontWeight: '600', marginTop: '2px' }}>{detailCampaign.executionMode}</div>
                </div>
                <div style={{ padding: '10px 12px', background: 'var(--rp-surface-subtle)', borderRadius: '8px', border: '1px solid var(--rp-border)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--rp-muted)' }}>Template Pinned</div>
                  <div style={{ fontWeight: '600', marginTop: '2px' }}>{detailCampaign.templateName}</div>
                </div>
                <div style={{ padding: '10px 12px', background: 'var(--rp-surface-subtle)', borderRadius: '8px', border: '1px solid var(--rp-border)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--rp-muted)' }}>Category / Project</div>
                  <div style={{ fontWeight: '600', marginTop: '2px' }}>{detailCampaign.category}</div>
                </div>
              </div>

              <div style={{ border: '1px solid var(--rp-border)', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', background: 'var(--rp-surface-subtle)', fontWeight: '600', fontSize: '13px' }}>
                  Audience & Messaging Metrics
                </div>
                <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Total Intended Audience</span>
                    <strong>{detailCampaign.audienceSize}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Eligible for Dispatch</span>
                    <strong style={{ color: 'var(--rp-success)' }}>{detailCampaign.eligibleRecipients}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Excluded (Consent / Suppressed)</span>
                    <strong style={{ color: 'var(--rp-warning)' }}>{detailCampaign.excludedRecipients}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Mock Messages Dispatched</span>
                    <strong>{detailCampaign.mockMessagesProcessed}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Simulated Failures</span>
                    <strong style={{ color: 'var(--rp-danger)' }}>{detailCampaign.simulatedFailures}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Retry Attempts</span>
                    <strong>{detailCampaign.retryAttempts}</strong>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  className="reports-btn sm"
                  onClick={() => setDetailCampaign(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: EXPORT REPORT DIALOG
          ========================================================================= */}
      {exportModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
        >
          <div
            className="reports-panel"
            style={{
              width: '100%',
              maxWidth: '520px',
              borderRadius: '14px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
            }}
          >
            <div className="reports-panel-head" style={{ borderBottom: '1px solid var(--rp-border)' }}>
              <div>
                <div className="reports-panel-title">Export Report</div>
                <div className="reports-panel-subtitle">Generate CSV or XLSX with active toolbar filters</div>
              </div>
              <button
                className="reports-btn sm"
                onClick={() => setExportModalOpen(false)}
                style={{ width: '32px', height: '32px', padding: 0 }}
                aria-label="Close export dialog"
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>
                  Select Report Type
                </label>
                <select
                  className="reports-select"
                  value={exportType}
                  onChange={(e) => setExportType(e.target.value)}
                  style={{
                    width: '100%',
                    height: '38px',
                    fontSize: '13px',
                    background: 'var(--rp-surface-subtle)',
                    border: '1px solid var(--rp-border)',
                    borderRadius: '8px',
                    padding: '0 10px'
                  }}
                >
                  <option value="campaign_summary">Campaign Performance Summary</option>
                  <option value="campaign_recipients">Campaign Recipients & Eligibility</option>
                  <option value="failure_analysis">Failure Analysis Breakdown</option>
                  <option value="consent_summary">Consent & Suppression Summary</option>
                  <option value="opt_outs">Opt-Out & Suppression Events</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>
                  Format
                </label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <label
                    style={{
                      flex: 1,
                      padding: '10px',
                      border: '1px solid var(--rp-border)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: exportFormat === 'csv' ? 'var(--rp-blue-soft)' : 'transparent',
                      borderColor: exportFormat === 'csv' ? 'var(--rp-blue)' : 'var(--rp-border)'
                    }}
                  >
                    <input
                      type="radio"
                      name="format"
                      value="csv"
                      checked={exportFormat === 'csv'}
                      onChange={() => setExportFormat('csv')}
                    />
                    <span style={{ fontSize: '13px', fontWeight: '500' }}>CSV (Tabular text)</span>
                  </label>
                  <label
                    style={{
                      flex: 1,
                      padding: '10px',
                      border: '1px solid var(--rp-border)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: exportFormat === 'xlsx' ? 'var(--rp-blue-soft)' : 'transparent',
                      borderColor: exportFormat === 'xlsx' ? 'var(--rp-blue)' : 'var(--rp-border)'
                    }}
                  >
                    <input
                      type="radio"
                      name="format"
                      value="xlsx"
                      checked={exportFormat === 'xlsx'}
                      onChange={() => setExportFormat('xlsx')}
                    />
                    <span style={{ fontSize: '13px', fontWeight: '500' }}>Excel (XLSX)</span>
                  </label>
                </div>
              </div>

              <div
                style={{
                  padding: '12px',
                  background: 'var(--rp-surface-subtle)',
                  borderRadius: '8px',
                  border: '1px solid var(--rp-border-subtle)',
                  fontSize: '12px',
                  color: 'var(--rp-text-secondary)',
                  lineHeight: '1.4'
                }}
              >
                <strong>Security & Integrity Notice:</strong> All cell strings starting with formula characters (=, +, -, @) are automatically sanitized to prevent spreadsheet formula injection. Confidential tokens and passwords are excluded.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button
                  className="reports-btn sm"
                  onClick={() => setExportModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="reports-btn primary sm"
                  onClick={handleExportDownload}
                  disabled={exporting}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Download size={14} />
                  <span>{exporting ? 'Generating...' : 'Download File'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
