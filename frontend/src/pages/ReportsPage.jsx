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
  RotateCcw
} from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';
import * as reportsApi from '../services/reports';

const STATUS_COLORS = {
  Draft: '#94A3B8',
  'Needs Review': '#F59E0B',
  'Validated for Preparation': '#3B82F6',
  Ready: '#0D9488',
  Scheduled: '#8B5CF6',
  Running: '#0284C7',
  Paused: '#D97706',
  Completed: '#10B981',
  Failed: '#EF4444',
  Cancelled: '#64748B'
};

const CHART_PIE_COLORS = ['#0D9488', '#F59E0B', '#EF4444', '#8B5CF6', '#3B82F6', '#64748B'];

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
      toast.error(err?.response?.data?.message || 'Failed to load report data.');
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

  return (
    <div className="reports-page" style={{ paddingBottom: '40px' }}>
      {/* 1. Header */}
      <PageHeader
        eyebrow="WHATSAPP AUTOMATION · REPORTING & ANALYTICS"
        title="Reports & Analytics"
        subtitle="Understand campaign execution, message activity and operational performance."
      />

      {/* 2. Top Action & Responsive Filter Toolbar */}
      <div
        className="panel"
        style={{
          marginBottom: '20px',
          padding: '14px 18px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          background: 'var(--color-surface)',
          borderRadius: '12px'
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
          {/* Date Range Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={15} color="var(--color-text-muted)" />
            <select
              className="form-control"
              value={range}
              onChange={(e) => setRange(e.target.value)}
              style={{ height: '36px', fontSize: '13px', minWidth: '130px' }}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="date"
                className="form-control"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                style={{ height: '36px', fontSize: '12.5px', width: '135px' }}
              />
              <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>to</span>
              <input
                type="date"
                className="form-control"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                style={{ height: '36px', fontSize: '12.5px', width: '135px' }}
              />
            </div>
          )}

          {/* Campaign Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Filter size={15} color="var(--color-text-muted)" />
            <select
              className="form-control"
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
              style={{ height: '36px', fontSize: '13px', maxWidth: '200px' }}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Radio size={15} color="var(--color-text-muted)" />
            <select
              className="form-control"
              value={executionMode}
              onChange={(e) => setExecutionMode(e.target.value)}
              style={{ height: '36px', fontSize: '13px', minWidth: '130px' }}
            >
              <option value="ALL">All Modes</option>
              <option value="MOCK">Mock Engine Only</option>
              <option value="VERIFIED_PROVIDER">Verified Provider</option>
            </select>
          </div>

          {/* Status Filter */}
          <select
            className="form-control"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ height: '36px', fontSize: '13px', minWidth: '120px' }}
          >
            <option value="all">All Statuses</option>
            <option value="Completed">Completed</option>
            <option value="Running">Running</option>
            <option value="Scheduled">Scheduled</option>
            <option value="Draft">Draft</option>
            <option value="Failed">Failed</option>
          </select>
        </div>

        {/* Right Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {lastUpdated && (
            <span style={{ fontSize: '11.5px', color: 'var(--color-text-muted)', marginRight: '4px' }}>
              Refreshed {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            className="btn btn-secondary"
            onClick={() => loadActiveTabData(true)}
            disabled={refreshing || loading}
            style={{ height: '36px', padding: '0 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Refresh current report dataset"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setExportModalOpen(true)}
            style={{ height: '36px', padding: '0 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Download size={14} />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {/* 3. Navigation Tabs */}
      <div className="inbox-filter-tabs" style={{ marginBottom: '22px', borderRadius: '10px' }}>
        <button
          className={activeTab === 'overview' ? 'active' : ''}
          onClick={() => setActiveTab('overview')}
        >
          <TrendingUp size={15} style={{ marginRight: '6px', verticalAlign: '-2px' }} />
          Overview
        </button>
        <button
          className={activeTab === 'campaigns' ? 'active' : ''}
          onClick={() => setActiveTab('campaigns')}
        >
          <Columns size={15} style={{ marginRight: '6px', verticalAlign: '-2px' }} />
          Campaign Performance
        </button>
        <button
          className={activeTab === 'messages' ? 'active' : ''}
          onClick={() => setActiveTab('messages')}
        >
          <Layers size={15} style={{ marginRight: '6px', verticalAlign: '-2px' }} />
          Message Activity
        </button>
        <button
          className={activeTab === 'consent' ? 'active' : ''}
          onClick={() => setActiveTab('consent')}
        >
          <ShieldCheck size={15} style={{ marginRight: '6px', verticalAlign: '-2px' }} />
          Consent & Opt-outs
        </button>
        <button
          className={activeTab === 'exports' ? 'active' : ''}
          onClick={() => setActiveTab('exports')}
        >
          <FileSpreadsheet size={15} style={{ marginRight: '6px', verticalAlign: '-2px' }} />
          Exports
        </button>
      </div>

      {/* =========================================================================
          TAB 1: OVERVIEW
          ========================================================================= */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {/* 4 Primary KPI Cards */}
          <div className="stat-grid">
            {/* Card 1: Total Campaigns */}
            <div className="stat-card">
              <div className="stat-head">
                <span>Total Campaigns</span>
                <div className="stat-icon tint-0">
                  <FileBarChart2 size={16} />
                </div>
              </div>
              <div className="stat-value">{overviewData?.kpis?.totalCampaigns ?? 0}</div>
              <div className="stat-foot">
                <CheckCircle2 size={13} color="var(--color-primary)" />
                <span>Non-archived campaigns in database</span>
              </div>
            </div>

            {/* Card 2: Scheduled / Running */}
            <div className="stat-card">
              <div className="stat-head">
                <span>Scheduled / Running</span>
                <div className="stat-icon tint-1">
                  <Clock size={16} />
                </div>
              </div>
              <div className="stat-value">{overviewData?.kpis?.scheduledRunningCampaigns ?? 0}</div>
              <div className="stat-foot">
                <span>Queued or active orchestrations</span>
              </div>
            </div>

            {/* Card 3: Mock Messages Processed */}
            <div className="stat-card">
              <div className="stat-head">
                <span>Mock Messages Processed</span>
                <div className="stat-icon tint-2">
                  <Layers size={16} />
                </div>
              </div>
              <div className="stat-value">{overviewData?.kpis?.mockMessagesProcessed ?? 0}</div>
              <div className="stat-foot">
                <span className="status-badge" style={{ fontSize: '11px', padding: '1px 6px', background: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}>
                  Mock Engine
                </span>
                <span>Simulated outbound dispatches</span>
              </div>
            </div>

            {/* Card 4: Verified WhatsApp Messages Sent */}
            <div className="stat-card" style={{ borderLeft: '3px solid var(--color-warning)' }}>
              <div className="stat-head">
                <span>Verified Messages Sent</span>
                <div className="stat-icon tint-3">
                  <Radio size={16} />
                </div>
              </div>
              <div className="stat-value" style={{ fontSize: '20px', color: 'var(--color-text-muted)', paddingTop: '4px' }}>
                Not Available
              </div>
              <div className="stat-foot">
                <span className="status-badge" style={{ fontSize: '11px', padding: '1px 6px', background: 'var(--color-warning-soft)', color: 'var(--color-warning)' }}>
                  Provider Disconnected
                </span>
                <span>Meta API offline</span>
              </div>
            </div>
          </div>

          {/* Compact Secondary Metrics Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '12px'
            }}
          >
            <div className="panel" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Draft Campaigns</div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--color-text-primary)', marginTop: '2px' }}>
                {overviewData?.secondaryMetrics?.draftCampaigns ?? 0}
              </div>
            </div>
            <div className="panel" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Ready for Preparation</div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--color-primary)', marginTop: '2px' }}>
                {overviewData?.secondaryMetrics?.readyCampaigns ?? 0}
              </div>
            </div>
            <div className="panel" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Completed Mock Runs</div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--color-success)', marginTop: '2px' }}>
                {overviewData?.secondaryMetrics?.completedMockRuns ?? 0}
              </div>
            </div>
            <div className="panel" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Failed Mock Runs</div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: overviewData?.secondaryMetrics?.failedMockRuns ? 'var(--color-danger)' : 'var(--color-text-primary)', marginTop: '2px' }}>
                {overviewData?.secondaryMetrics?.failedMockRuns ?? 0}
              </div>
            </div>
            <div className="panel" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Excluded Recipients</div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--color-warning)', marginTop: '2px' }}>
                {overviewData?.secondaryMetrics?.excludedRecipients ?? 0}
              </div>
            </div>
            <div className="panel" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Retry Attempts</div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--color-text-primary)', marginTop: '2px' }}>
                {overviewData?.secondaryMetrics?.retryAttempts ?? 0}
              </div>
            </div>
            <div className="panel" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Unread Inbox Threads</div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--color-info)', marginTop: '2px' }}>
                {overviewData?.secondaryMetrics?.unreadConversations ?? 0}
              </div>
            </div>
            <div className="panel" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Verified Customer Replies</div>
              <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                —
              </div>
            </div>
            <div className="panel" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Recorded Opt-Outs</div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--color-danger)', marginTop: '2px' }}>
                {overviewData?.secondaryMetrics?.recordedOptOuts ?? 0}
              </div>
            </div>
          </div>

          {/* Visual Charts: 2 Column Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '20px' }}>
            {/* Chart 1: Message Processing Trend */}
            <div className="panel">
              <div className="panel-head">
                <div>
                  <div className="panel-title">Mock Message Processing Trend</div>
                  <div className="panel-subtitle">Daily dispatches and failures in selected period</div>
                </div>
              </div>
              <div style={{ padding: '16px 20px', height: '260px' }}>
                {((overviewData?.charts?.messageTrend || []).length > 0 && (overviewData.charts.messageTrend.some(d => (d.simulatedSent > 0 || d.failed > 0 || d.total > 0)))) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={overviewData.charts.messageTrend}>
                      <defs>
                        <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0D9488" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#0D9488" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="colorFail" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#EF4444" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#EF4444" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis dataKey="date" stroke="#94A3B8" fontSize={11} tickLine={false} />
                      <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1E293B',
                          borderColor: '#334155',
                          borderRadius: '8px',
                          color: '#F8FAFC',
                          fontSize: '12px'
                        }}
                      />
                      <Legend verticalAlign="top" height={36} iconType="circle" />
                      <Area type="monotone" dataKey="simulatedSent" name="Simulated Sent" stroke="#0D9488" fillOpacity={1} fill="url(#colorSent)" />
                      <Area type="monotone" dataKey="failed" name="Simulated Failed" stroke="#EF4444" fillOpacity={1} fill="url(#colorFail)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px' }}>
                    <Layers size={28} style={{ color: 'var(--color-text-muted)', opacity: 0.5, marginBottom: '8px' }} />
                    <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>No mock message dispatches in this date range.</span>
                    <span style={{ fontSize: '12px', maxWidth: '320px' }}>Daily dispatch trends will render here once campaigns are executed in mock simulation mode.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Chart 2: Campaign Status Distribution */}
            <div className="panel">
              <div className="panel-head">
                <div>
                  <div className="panel-title">Campaign Status Distribution</div>
                  <div className="panel-subtitle">Count of campaigns grouped by current state</div>
                </div>
              </div>
              <div style={{ padding: '16px 20px', height: '260px' }}>
                {(overviewData?.charts?.campaignStatusDistribution || []).length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={overviewData.charts.campaignStatusDistribution}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis dataKey="status" stroke="#94A3B8" fontSize={11} tickLine={false} />
                      <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1E293B',
                          borderColor: '#334155',
                          borderRadius: '8px',
                          color: '#F8FAFC',
                          fontSize: '12px'
                        }}
                      />
                      <Bar dataKey="count" name="Campaigns" radius={[4, 4, 0, 0]}>
                        {(overviewData.charts.campaignStatusDistribution || []).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.status] || '#0D9488'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
                    No campaigns created yet.
                  </div>
                )}
              </div>
            </div>

            {/* Chart 3: Failure Breakdown */}
            <div className="panel">
              <div className="panel-head">
                <div>
                  <div className="panel-title">Top Failure Reasons</div>
                  <div className="panel-subtitle">Normalized error codes from transport & preparation</div>
                </div>
              </div>
              <div style={{ padding: '16px 20px', height: '260px' }}>
                {(overviewData?.charts?.failureBreakdown || []).length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={overviewData.charts.failureBreakdown} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis type="number" stroke="#94A3B8" fontSize={11} tickLine={false} allowDecimals={false} />
                      <YAxis type="category" dataKey="reason" stroke="#94A3B8" fontSize={11} width={130} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1E293B',
                          borderColor: '#334155',
                          borderRadius: '8px',
                          color: '#F8FAFC',
                          fontSize: '12px'
                        }}
                      />
                      <Bar dataKey="count" name="Occurrences" fill="#EF4444" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
                    No message failure codes recorded in this date range.
                  </div>
                )}
              </div>
            </div>

            {/* Chart 4: Audience Eligibility Distribution */}
            <div className="panel">
              <div className="panel-head">
                <div>
                  <div className="panel-title">Audience Eligibility Ratio</div>
                  <div className="panel-subtitle">Eligible contacts vs excluded from dispatch</div>
                </div>
              </div>
              <div style={{ padding: '16px 20px', height: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                        <Cell fill="#0D9488" />
                        <Cell fill="#F59E0B" />
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1E293B',
                          borderColor: '#334155',
                          borderRadius: '8px',
                          color: '#F8FAFC',
                          fontSize: '12px'
                        }}
                      />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>
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
              className="panel"
              style={{
                padding: '12px 20px',
                background: 'var(--color-primary-soft)',
                border: '1px solid var(--color-primary-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Columns size={18} color="var(--color-primary)" />
                <span style={{ fontSize: '13.5px', fontWeight: '600', color: 'var(--color-primary-active)' }}>
                  {selectedForCompare.length} Campaign{selectedForCompare.length > 1 ? 's' : ''} Selected for Comparison
                </span>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                  (Select between 2 and 4 campaigns to compare side-by-side)
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setSelectedForCompare([])}
                  style={{ height: '32px', fontSize: '12px' }}
                >
                  Clear Selection
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleOpenComparison}
                  disabled={selectedForCompare.length < 2 || comparing}
                  style={{ height: '32px', fontSize: '12px' }}
                >
                  {comparing ? 'Comparing...' : 'Compare Side-by-Side'}
                </button>
              </div>
            </div>
          )}

          {/* Search & Actions Panel */}
          <div className="panel">
            <div
              style={{
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--color-border-subtle)',
                gap: '10px',
                flexWrap: 'wrap'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1', minWidth: '220px' }}>
                <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
                  <Search size={15} style={{ position: 'absolute', left: '12px', top: '11px', color: 'var(--color-text-muted)' }} />
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search campaign by name or category..."
                    value={campaignSearch}
                    onChange={(e) => {
                      setCampaignSearch(e.target.value);
                      setCampaignPage(1);
                    }}
                    style={{ paddingLeft: '34px', height: '36px', fontSize: '13px' }}
                  />
                </div>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                Showing {campaignData.records.length} of {campaignData.pagination.total} campaigns
              </div>
            </div>

            {/* Campaign Table */}
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: 'var(--color-surface-subtle)', borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ padding: '12px 14px', width: '40px' }}>
                      <input
                        type="checkbox"
                        disabled
                        title="Select individual campaigns to compare"
                      />
                    </th>
                    <th style={{ padding: '12px 14px' }}>Campaign Name</th>
                    <th style={{ padding: '12px 14px' }}>Status</th>
                    <th style={{ padding: '12px 14px' }}>Template</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>Audience</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>Eligible</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>Excluded</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>Mock Sent</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>Failures</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>Retries</th>
                    <th style={{ padding: '12px 14px' }}>Scheduled / Run</th>
                    <th style={{ padding: '12px 14px', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {campaignData.records.length > 0 ? (
                    campaignData.records.map((c) => {
                      const isSelected = selectedForCompare.includes(c._id);
                      return (
                        <tr key={c._id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                          <td style={{ padding: '12px 14px' }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleCompare(c._id)}
                            />
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ fontWeight: '600', color: 'var(--color-text-primary)' }}>{c.name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{c.category || 'General'}</div>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span
                              className="status-badge"
                              style={{
                                background: STATUS_COLORS[c.status] ? `${STATUS_COLORS[c.status]}1A` : '#F1F5F9',
                                color: STATUS_COLORS[c.status] || '#475569'
                              }}
                            >
                              {c.status}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px', color: 'var(--color-text-secondary)' }}>{c.templateName}</td>
                          <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '500' }}>{c.audienceSize}</td>
                          <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--color-success)', fontWeight: '500' }}>
                            {c.eligibleRecipients}
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'right', color: c.excludedRecipients > 0 ? 'var(--color-warning)' : 'var(--color-text-muted)' }}>
                            {c.excludedRecipients}
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '600' }}>{c.mockMessagesProcessed}</td>
                          <td style={{ padding: '12px 14px', textAlign: 'right', color: c.simulatedFailures > 0 ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
                            {c.simulatedFailures}
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--color-text-muted)' }}>{c.retryAttempts}</td>
                          <td style={{ padding: '12px 14px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                            {c.actualRunDate ? new Date(c.actualRunDate).toLocaleDateString() : c.scheduledDate ? new Date(c.scheduledDate).toLocaleDateString() : '—'}
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <button
                                className="btn btn-secondary"
                                onClick={() => setDetailCampaign(c)}
                                style={{ height: '28px', padding: '0 8px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                title="View detailed breakdown"
                              >
                                <Eye size={12} />
                                <span>Details</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={12} style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
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
                  padding: '12px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderTop: '1px solid var(--color-border-subtle)',
                  fontSize: '12.5px'
                }}
              >
                <button
                  className="btn btn-secondary"
                  disabled={campaignPage <= 1}
                  onClick={() => setCampaignPage((p) => Math.max(1, p - 1))}
                  style={{ height: '30px', fontSize: '12px' }}
                >
                  Previous
                </button>
                <span>
                  Page {campaignPage} of {campaignData.pagination.pages}
                </span>
                <button
                  className="btn btn-secondary"
                  disabled={campaignPage >= campaignData.pagination.pages}
                  onClick={() => setCampaignPage((p) => Math.min(campaignData.pagination.pages, p + 1))}
                  style={{ height: '30px', fontSize: '12px' }}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {/* Status Lifecycle Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
            {/* 1. Internal Preparation */}
            <div className="panel" style={{ padding: '16px 18px' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--color-text-primary)', marginBottom: '12px' }}>
                Internal Preparation States
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Queued in Background</span>
                  <span style={{ fontWeight: '600' }}>{messageStatusData?.internalPreparation?.QUEUED ?? 0}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Leased / Processing</span>
                  <span style={{ fontWeight: '600' }}>{messageStatusData?.internalPreparation?.PROCESSING ?? 0}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Scheduled for Future</span>
                  <span style={{ fontWeight: '600' }}>{messageStatusData?.internalPreparation?.SCHEDULED ?? 0}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Blocked (Consent / Opt-out)</span>
                  <span style={{ fontWeight: '600', color: 'var(--color-warning)' }}>{messageStatusData?.internalPreparation?.BLOCKED ?? 0}</span>
                </div>
              </div>
            </div>

            {/* 2. Mock Results */}
            <div className="panel" style={{ padding: '16px 18px' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--color-text-primary)', marginBottom: '12px' }}>
                Mock Engine Outcomes
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Simulated Sent</span>
                  <span style={{ fontWeight: '600', color: 'var(--color-success)' }}>{messageStatusData?.mockResults?.SIMULATED_SENT ?? 0}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Simulated Delivered</span>
                  <span style={{ fontWeight: '600', color: 'var(--color-success)' }}>{messageStatusData?.mockResults?.SIMULATED_DELIVERED ?? 0}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Temporary Failures (Retrying)</span>
                  <span style={{ fontWeight: '600', color: 'var(--color-warning)' }}>{messageStatusData?.mockResults?.TEMPORARY_FAILURE ?? 0}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Permanent Failures (Exhausted)</span>
                  <span style={{ fontWeight: '600', color: 'var(--color-danger)' }}>{messageStatusData?.mockResults?.PERMANENT_FAILURE ?? 0}</span>
                </div>
              </div>
            </div>

            {/* 3. Verified Provider */}
            <div className="panel" style={{ padding: '16px 18px', borderLeft: '3px solid var(--color-warning)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--color-text-primary)' }}>
                  Verified WhatsApp Provider
                </div>
                <span className="status-badge" style={{ fontSize: '11px', background: 'var(--color-warning-soft)', color: 'var(--color-warning)' }}>
                  Disconnected
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Official Provider Accepted</span>
                  <span style={{ color: 'var(--color-text-muted)' }}>Unavailable</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Provider Webhook Delivered</span>
                  <span style={{ color: 'var(--color-text-muted)' }}>Unavailable</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Customer Read Receipts</span>
                  <span style={{ color: 'var(--color-text-muted)' }}>Unavailable</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Customer Inbound Replies</span>
                  <span style={{ color: 'var(--color-text-muted)' }}>Unavailable</span>
                </div>
              </div>
            </div>
          </div>

          {/* Retry Analytics Summary Panel */}
          {retryData && (
            <div
              className="panel"
              style={{
                padding: '16px 20px',
                background: 'var(--color-surface)',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '14px'
              }}
            >
              <div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Messages Requiring Retry</div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--color-text-primary)', marginTop: '2px' }}>
                  {retryData.messagesRequiringRetry}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Unique logical messages with &gt;1 attempt</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Total Retry Attempts</div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--color-text-primary)', marginTop: '2px' }}>
                  {retryData.totalRetryAttempts}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Sum of (attemptCount - 1)</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Retries Succeeded in Mock</div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--color-success)', marginTop: '2px' }}>
                  {retryData.retriesSucceededInMockMode}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Eventual terminal success</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Retries Exhausted</div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--color-danger)', marginTop: '2px' }}>
                  {retryData.retriesExhausted}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Max attempts reached</div>
              </div>
            </div>
          )}

          {/* Failure Breakdown Table */}
          <div className="panel">
            <div className="panel-head">
              <div>
                <div className="panel-title">Failure & Exclusion Analysis</div>
                <div className="panel-subtitle">Normalized reason codes, classified by pipeline layer</div>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: 'var(--color-surface-subtle)', borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ padding: '12px 14px' }}>Failure Code</th>
                    <th style={{ padding: '12px 14px' }}>Category</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>Affected Messages</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>Total Attempts</th>
                    <th style={{ padding: '12px 14px' }}>Actionable Explanation</th>
                  </tr>
                </thead>
                <tbody>
                  {failuresData.length > 0 ? (
                    failuresData.map((f, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                        <td style={{ padding: '12px 14px' }}>
                          <code style={{ fontSize: '12px', background: 'var(--color-surface-subtle)', padding: '2px 6px', borderRadius: '4px' }}>
                            {f.failureCode}
                          </code>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span
                            className="status-badge"
                            style={{
                              fontSize: '11px',
                              background:
                                f.category === 'Eligibility Exclusion'
                                  ? 'var(--color-warning-soft)'
                                  : f.category === 'Preparation Failure'
                                  ? 'var(--color-info-soft)'
                                  : 'var(--color-danger-soft)',
                              color:
                                f.category === 'Eligibility Exclusion'
                                  ? 'var(--color-warning)'
                                  : f.category === 'Preparation Failure'
                                  ? 'var(--color-info)'
                                  : 'var(--color-danger)'
                            }}
                          >
                            {f.category}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '600' }}>{f.affectedLogicalMessages}</td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--color-text-muted)' }}>{f.totalAttempts}</td>
                        <td style={{ padding: '12px 14px', color: 'var(--color-text-secondary)', fontSize: '12.5px' }}>
                          {f.actionableExplanation}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} style={{ padding: '30px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
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
            <div className="panel">
              <div className="panel-head">
                <div>
                  <div className="panel-title">Campaign Recipient Details</div>
                  <div className="panel-subtitle">Individual contact eligibility and mock dispatch outcomes</div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search recipient..."
                    value={recipientSearch}
                    onChange={(e) => {
                      setRecipientSearch(e.target.value);
                      setRecipientPage(1);
                    }}
                    style={{ height: '32px', fontSize: '12px', width: '180px' }}
                  />
                  <select
                    className="form-control"
                    value={recipientStatusFilter}
                    onChange={(e) => {
                      setRecipientStatusFilter(e.target.value);
                      setRecipientPage(1);
                    }}
                    style={{ height: '32px', fontSize: '12px' }}
                  >
                    <option value="all">All Eligibility</option>
                    <option value="Eligible for Campaign Preparation">Eligible</option>
                    <option value="Missing Consent">Missing Consent</option>
                    <option value="Opted Out">Opted Out</option>
                  </select>
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-surface-subtle)', borderBottom: '1px solid var(--color-border)' }}>
                      <th style={{ padding: '10px 14px' }}>Recipient Name</th>
                      <th style={{ padding: '10px 14px' }}>Phone Number</th>
                      <th style={{ padding: '10px 14px' }}>Eligibility</th>
                      <th style={{ padding: '10px 14px' }}>Execution Status</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right' }}>Attempts</th>
                      <th style={{ padding: '10px 14px' }}>Exclusion / Failure</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recipientData.records.length > 0 ? (
                      recipientData.records.map((r, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                          <td style={{ padding: '10px 14px', fontWeight: '500' }}>{r.contactName}</td>
                          <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{r.contactPhone}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <span
                              className="status-badge"
                              style={{
                                fontSize: '11px',
                                background: r.eligibilityStatus === 'Eligible for Campaign Preparation' ? 'var(--color-success-soft)' : 'var(--color-warning-soft)',
                                color: r.eligibilityStatus === 'Eligible for Campaign Preparation' ? 'var(--color-success)' : 'var(--color-warning)'
                              }}
                            >
                              {r.eligibilityStatus}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px' }}>{r.executionStatus}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}>{r.attemptCount}</td>
                          <td style={{ padding: '10px 14px', color: 'var(--color-text-muted)', fontSize: '12px' }}>
                            {r.failureCode || (r.exclusionReasons || []).join('; ') || '—'}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {/* Consent Metric Cards */}
          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-head">
                <span>Total Contacts</span>
                <div className="stat-icon tint-0">
                  <Users size={16} />
                </div>
              </div>
              <div className="stat-value">{consentData?.totalContacts ?? 0}</div>
              <div className="stat-foot">Workspace contact base</div>
            </div>

            <div className="stat-card">
              <div className="stat-head">
                <span>Recorded WhatsApp Opt-In</span>
                <div className="stat-icon tint-0">
                  <ShieldCheck size={16} />
                </div>
              </div>
              <div className="stat-value" style={{ color: 'var(--color-success)' }}>
                {consentData?.validRecordedOptIn ?? 0}
              </div>
              <div className="stat-foot">Valid consent recorded</div>
            </div>

            <div className="stat-card">
              <div className="stat-head">
                <span>Unknown Consent</span>
                <div className="stat-icon tint-3">
                  <HelpCircle size={16} />
                </div>
              </div>
              <div className="stat-value">{consentData?.unknownConsent ?? 0}</div>
              <div className="stat-foot">Requires explicit consent capture</div>
            </div>

            <div className="stat-card">
              <div className="stat-head">
                <span>Opted Out / Suppressed</span>
                <div className="stat-icon tint-3">
                  <ShieldAlert size={16} />
                </div>
              </div>
              <div className="stat-value" style={{ color: 'var(--color-danger)' }}>
                {(consentData?.contactsOptedOut || 0) + (consentData?.suppressedDNC || 0)}
              </div>
              <div className="stat-foot">Zero-policy blocked contacts</div>
            </div>
          </div>

          {/* Audience Exclusion Breakdown Panel */}
          {exclusionsData && (
            <div className="panel">
              <div className="panel-head">
                <div>
                  <div className="panel-title">Campaign Audience Exclusion Reasons</div>
                  <div className="panel-subtitle">
                    Unique excluded contacts: <strong>{exclusionsData.uniqueExcludedContacts}</strong> | Total exclusion reason triggers:{' '}
                    <strong>{exclusionsData.totalExclusionReasons}</strong>
                  </div>
                </div>
              </div>
              <div style={{ padding: '16px 20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                  {(exclusionsData.breakdown || []).map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '12px 14px',
                        background: 'var(--color-surface-subtle)',
                        borderRadius: '8px',
                        border: '1px solid var(--color-border)'
                      }}
                    >
                      <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{item.reason}</div>
                      <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--color-text-primary)', marginTop: '4px' }}>
                        {item.count}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: '12px', fontSize: '11.5px', color: 'var(--color-text-muted)' }}>
                  {exclusionsData.note}
                </div>
              </div>
            </div>
          )}

          {/* Opt-Out Events Table */}
          <div className="panel">
            <div className="panel-head">
              <div>
                <div className="panel-title">Recorded Opt-Out & Suppression Events</div>
                <div className="panel-subtitle">Authoritative suppression records with audit provenance</div>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: 'var(--color-surface-subtle)', borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ padding: '12px 14px' }}>Contact Name</th>
                    <th style={{ padding: '12px 14px' }}>Phone Number</th>
                    <th style={{ padding: '12px 14px' }}>Consent Status</th>
                    <th style={{ padding: '12px 14px' }}>Source Classification</th>
                    <th style={{ padding: '12px 14px' }}>Suppression Reason</th>
                    <th style={{ padding: '12px 14px' }}>Event Date</th>
                  </tr>
                </thead>
                <tbody>
                  {optOutData.records.length > 0 ? (
                    optOutData.records.map((r, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                        <td style={{ padding: '12px 14px', fontWeight: '500' }}>{r.contactName}</td>
                        <td style={{ padding: '12px 14px', fontFamily: 'monospace' }}>{r.contactPhone}</td>
                        <td style={{ padding: '12px 14px' }}>
                          <span className="status-badge" style={{ background: 'var(--color-danger-soft)', color: 'var(--color-danger)' }}>
                            {r.consentStatus}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span
                            className="status-badge"
                            style={{
                              fontSize: '11px',
                              background: r.source === 'VERIFIED_CUSTOMER_OPTOUT' ? 'var(--color-success-soft)' : 'var(--color-surface-subtle)',
                              color: r.source === 'VERIFIED_CUSTOMER_OPTOUT' ? 'var(--color-success)' : 'var(--color-text-secondary)'
                            }}
                          >
                            {r.source}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', color: 'var(--color-text-secondary)' }}>{r.suppressionReason}</td>
                        <td style={{ padding: '12px 14px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                          {r.eventDate ? new Date(r.eventDate).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} style={{ padding: '30px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
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
            <div className="panel">
              <div className="panel-head">
                <div>
                  <div className="panel-title">Inbox & Auto-Reply Rule Execution</div>
                  <div className="panel-subtitle">Automation rules triggered by inbound simulated or test keywords</div>
                </div>
              </div>
              <div style={{ padding: '16px 20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '16px' }}>
                  <div style={{ padding: '12px 14px', background: 'var(--color-surface-subtle)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Open Conversations</div>
                    <div style={{ fontSize: '18px', fontWeight: '700' }}>{inboxAnalytics.openConversations}</div>
                  </div>
                  <div style={{ padding: '12px 14px', background: 'var(--color-surface-subtle)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Needs Attention (e.g. VISIT)</div>
                    <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--color-warning)' }}>{inboxAnalytics.needsAttention}</div>
                  </div>
                  <div style={{ padding: '12px 14px', background: 'var(--color-surface-subtle)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Total Rules Triggered</div>
                    <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--color-primary)' }}>{inboxAnalytics.autoReplyRulesTriggered}</div>
                  </div>
                </div>

                {(inboxAnalytics.autoReplies || []).length > 0 ? (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
                      <thead>
                        <tr style={{ background: 'var(--color-surface-subtle)', borderBottom: '1px solid var(--color-border)' }}>
                          <th style={{ padding: '8px 12px' }}>Rule Name</th>
                          <th style={{ padding: '8px 12px' }}>Matched Keyword</th>
                          <th style={{ padding: '8px 12px' }}>Execution Mode</th>
                          <th style={{ padding: '8px 12px' }}>Status</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right' }}>Executions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inboxAnalytics.autoReplies.map((ar, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                            <td style={{ padding: '8px 12px', fontWeight: '500' }}>{ar.ruleName}</td>
                            <td style={{ padding: '8px 12px' }}>
                              <code>{ar.keyword}</code>
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <span className="status-badge" style={{ fontSize: '10.5px' }}>
                                {ar.executionMode}
                              </span>
                            </td>
                            <td style={{ padding: '8px 12px' }}>{ar.status}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '600' }}>{ar.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>No rule executions recorded yet.</div>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {/* Export Generator Card */}
          <div className="panel" style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--color-text-primary)', marginBottom: '4px' }}>
              Generate Custom Export
            </div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '18px' }}>
              Export sanitized, formula-injection-protected reports adhering to owner isolation and active toolbar filters.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', marginBottom: '6px' }}>
                  Report Dataset
                </label>
                <select
                  className="form-control"
                  value={exportType}
                  onChange={(e) => setExportType(e.target.value)}
                  style={{ height: '38px', fontSize: '13px' }}
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
                  className="form-control"
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value)}
                  style={{ height: '38px', fontSize: '13px' }}
                >
                  <option value="csv">CSV (Comma Separated Values)</option>
                  <option value="xlsx">XLSX (Microsoft Excel Workbook)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', marginBottom: '6px' }}>
                  Applied Filter Scope
                </label>
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', padding: '9px 12px', background: 'var(--color-surface-subtle)', borderRadius: '6px' }}>
                  Range: <strong>{range}</strong> | Mode: <strong>{executionMode}</strong>
                </div>
              </div>
            </div>

            <button
              className="btn btn-primary"
              onClick={handleExportDownload}
              disabled={exporting}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '0 18px', height: '38px', fontSize: '13px' }}
            >
              <Download size={15} />
              <span>{exporting ? 'Generating Secure Export...' : `Download ${exportFormat.toUpperCase()}`}</span>
            </button>
          </div>

          {/* Export History Table */}
          <div className="panel">
            <div className="panel-head">
              <div>
                <div className="panel-title">Archived Export History</div>
                <div className="panel-subtitle">Previously generated files available for re-download</div>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: 'var(--color-surface-subtle)', borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ padding: '12px 14px' }}>File Name</th>
                    <th style={{ padding: '12px 14px' }}>Report Type</th>
                    <th style={{ padding: '12px 14px' }}>Format</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>Row Count</th>
                    <th style={{ padding: '12px 14px' }}>Generated Date</th>
                    <th style={{ padding: '12px 14px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {exportHistory.length > 0 ? (
                    exportHistory.map((item) => (
                      <tr key={item._id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                        <td style={{ padding: '12px 14px', fontWeight: '500', color: 'var(--color-text-primary)' }}>
                          {item.fileName}
                        </td>
                        <td style={{ padding: '12px 14px' }}>{item.reportType}</td>
                        <td style={{ padding: '12px 14px' }}>
                          <span className="status-badge" style={{ fontSize: '11px', textTransform: 'uppercase' }}>
                            {item.format}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '600' }}>{item.rowCount}</td>
                        <td style={{ padding: '12px 14px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                          {new Date(item.createdAt).toLocaleString()}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          <button
                            className="btn btn-secondary"
                            onClick={() => handleDownloadHistoryItem(item)}
                            style={{ height: '28px', padding: '0 8px', fontSize: '11.5px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Download size={12} />
                            <span>Download</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} style={{ padding: '30px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
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
            className="panel"
            style={{
              width: '100%',
              maxWidth: '960px',
              maxHeight: '90vh',
              overflowY: 'auto',
              background: 'var(--color-surface)',
              borderRadius: '14px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
            }}
          >
            <div className="panel-head" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <div>
                <div className="panel-title" style={{ fontSize: '17px' }}>
                  Campaign Performance Comparison
                </div>
                <div className="panel-subtitle">Side-by-side evaluation of {comparisonResults.count} selected campaigns</div>
              </div>
              <button
                className="btn btn-secondary"
                onClick={() => setCompareModalOpen(false)}
                style={{ width: '32px', height: '32px', padding: 0, display: 'grid', placeItems: 'center' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '20px' }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-surface-subtle)', borderBottom: '2px solid var(--color-border)' }}>
                      <th style={{ padding: '12px', width: '220px', fontWeight: '700' }}>Metric / Dimension</th>
                      {comparisonResults.campaigns.map((c) => (
                        <th key={c._id} style={{ padding: '12px', minWidth: '180px', fontWeight: '700', color: 'var(--color-primary)' }}>
                          {c.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: '600' }}>Execution Mode</td>
                      {comparisonResults.campaigns.map((c) => (
                        <td key={c._id} style={{ padding: '10px 12px' }}>
                          <span className="status-badge" style={{ fontSize: '11px' }}>
                            {c.executionMode}
                          </span>
                        </td>
                      ))}
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: '600' }}>Status</td>
                      {comparisonResults.campaigns.map((c) => (
                        <td key={c._id} style={{ padding: '10px 12px' }}>
                          <span className="status-badge" style={{ fontSize: '11px', background: `${STATUS_COLORS[c.status] || '#64748B'}1A`, color: STATUS_COLORS[c.status] || '#64748B' }}>
                            {c.status}
                          </span>
                        </td>
                      ))}
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: '600' }}>Template</td>
                      {comparisonResults.campaigns.map((c) => (
                        <td key={c._id} style={{ padding: '10px 12px' }}>{c.templateName}</td>
                      ))}
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', background: 'var(--color-surface-subtle)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: '600' }}>Audience Size</td>
                      {comparisonResults.campaigns.map((c) => (
                        <td key={c._id} style={{ padding: '10px 12px', fontWeight: '700' }}>{c.audienceSize}</td>
                      ))}
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: '600' }}>Eligible Contacts</td>
                      {comparisonResults.campaigns.map((c) => (
                        <td key={c._id} style={{ padding: '10px 12px', color: 'var(--color-success)', fontWeight: '600' }}>
                          {c.eligibleContacts}
                        </td>
                      ))}
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: '600' }}>Excluded Contacts</td>
                      {comparisonResults.campaigns.map((c) => (
                        <td key={c._id} style={{ padding: '10px 12px', color: c.excludedContacts > 0 ? 'var(--color-warning)' : 'inherit' }}>
                          {c.excludedContacts}
                        </td>
                      ))}
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', background: 'var(--color-surface-subtle)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: '600' }}>Mock Messages Processed</td>
                      {comparisonResults.campaigns.map((c) => (
                        <td key={c._id} style={{ padding: '10px 12px', fontWeight: '700' }}>{c.mockMessagesProcessed}</td>
                      ))}
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: '600' }}>Simulated Failures</td>
                      {comparisonResults.campaigns.map((c) => (
                        <td key={c._id} style={{ padding: '10px 12px', color: c.failureCount > 0 ? 'var(--color-danger)' : 'inherit' }}>
                          {c.failureCount}
                        </td>
                      ))}
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: '600' }}>Retry Attempts</td>
                      {comparisonResults.campaigns.map((c) => (
                        <td key={c._id} style={{ padding: '10px 12px' }}>{c.retryAttempts}</td>
                      ))}
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: '600' }}>Run Duration</td>
                      {comparisonResults.campaigns.map((c) => (
                        <td key={c._id} style={{ padding: '10px 12px' }}>{c.runDurationFormatted}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: '16px', fontSize: '11.5px', color: 'var(--color-text-muted)', lineHeight: '1.4' }}>
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
            className="panel"
            style={{
              width: '100%',
              maxWidth: '680px',
              maxHeight: '90vh',
              overflowY: 'auto',
              background: 'var(--color-surface)',
              borderRadius: '14px'
            }}
          >
            <div className="panel-head" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <div>
                <div className="panel-title">{detailCampaign.name}</div>
                <div className="panel-subtitle">Campaign Execution & Audience Breakdown</div>
              </div>
              <button
                className="btn btn-secondary"
                onClick={() => setDetailCampaign(null)}
                style={{ width: '32px', height: '32px', padding: 0, display: 'grid', placeItems: 'center' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', fontSize: '13px' }}>
                <div style={{ padding: '10px 12px', background: 'var(--color-surface-subtle)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Status</div>
                  <div style={{ fontWeight: '600', marginTop: '2px' }}>{detailCampaign.status}</div>
                </div>
                <div style={{ padding: '10px 12px', background: 'var(--color-surface-subtle)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Execution Mode</div>
                  <div style={{ fontWeight: '600', marginTop: '2px' }}>{detailCampaign.executionMode}</div>
                </div>
                <div style={{ padding: '10px 12px', background: 'var(--color-surface-subtle)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Template Pinned</div>
                  <div style={{ fontWeight: '600', marginTop: '2px' }}>{detailCampaign.templateName}</div>
                </div>
                <div style={{ padding: '10px 12px', background: 'var(--color-surface-subtle)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Category / Project</div>
                  <div style={{ fontWeight: '600', marginTop: '2px' }}>{detailCampaign.category}</div>
                </div>
              </div>

              <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', background: 'var(--color-surface-subtle)', fontWeight: '600', fontSize: '13px' }}>
                  Audience & Messaging Metrics
                </div>
                <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Total Intended Audience</span>
                    <strong>{detailCampaign.audienceSize}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Eligible for Dispatch</span>
                    <strong style={{ color: 'var(--color-success)' }}>{detailCampaign.eligibleRecipients}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Excluded (Consent / Suppressed)</span>
                    <strong style={{ color: 'var(--color-warning)' }}>{detailCampaign.excludedRecipients}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Mock Messages Dispatched</span>
                    <strong>{detailCampaign.mockMessagesProcessed}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Simulated Failures</span>
                    <strong style={{ color: 'var(--color-danger)' }}>{detailCampaign.simulatedFailures}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Retry Attempts</span>
                    <strong>{detailCampaign.retryAttempts}</strong>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  className="btn btn-secondary"
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
            className="panel"
            style={{
              width: '100%',
              maxWidth: '520px',
              background: 'var(--color-surface)',
              borderRadius: '14px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
            }}
          >
            <div className="panel-head" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <div>
                <div className="panel-title">Export Report</div>
                <div className="panel-subtitle">Generate CSV or XLSX with active toolbar filters</div>
              </div>
              <button
                className="btn btn-secondary"
                onClick={() => setExportModalOpen(false)}
                style={{ width: '32px', height: '32px', padding: 0, display: 'grid', placeItems: 'center' }}
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
                  className="form-control"
                  value={exportType}
                  onChange={(e) => setExportType(e.target.value)}
                  style={{ height: '38px', fontSize: '13px' }}
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
                      border: '1px solid var(--color-border)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: exportFormat === 'csv' ? 'var(--color-primary-soft)' : 'transparent',
                      borderColor: exportFormat === 'csv' ? 'var(--color-primary)' : 'var(--color-border)'
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
                      border: '1px solid var(--color-border)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: exportFormat === 'xlsx' ? 'var(--color-primary-soft)' : 'transparent',
                      borderColor: exportFormat === 'xlsx' ? 'var(--color-primary)' : 'var(--color-border)'
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
                  background: 'var(--color-surface-subtle)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: 'var(--color-text-secondary)',
                  lineHeight: '1.4'
                }}
              >
                <strong>Security & Integrity Notice:</strong> All cell strings starting with formula characters (=, +, -, @) are automatically sanitized to prevent spreadsheet formula injection. Confidential tokens and passwords are excluded.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setExportModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
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
