import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import platformAdminApi from '../../services/platformAdmin';
import {
  Building2,
  Users,
  CreditCard,
  TrendingUp,
  MessageSquare,
  Activity,
  AlertTriangle,
  Shield,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  Clock,
  Radio,
} from 'lucide-react';

export default function AdminOverviewPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOverview = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await platformAdminApi.getOverview();
      setData(res);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load platform overview.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="w-8 h-8 border-4 border-[#0D9488] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-[#667085]">Aggregating platform metrics across all SaaS tenants...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-xl">
        <div className="flex items-center gap-2 font-semibold text-base mb-1">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          Failed to load Platform Overview
        </div>
        <p className="text-sm">{error}</p>
        <button
          onClick={fetchOverview}
          className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg"
        >
          Retry
        </button>
      </div>
    );
  }

  const { workspaces, subscriptions, revenue, whatsapp, queue, industryDistribution, recentAuditLogs } = data || {};

  return (
    <div className="space-y-8">
      {/* Top Banner & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#111827] tracking-tight">Platform Command Center</h1>
          <p className="text-sm text-[#667085] mt-1">
            Real-time aggregate observability, verified billing collections, and infrastructure health.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchOverview}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-white border border-[#E5E7EB] text-[#111827] hover:bg-slate-50 transition-colors shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#0D9488]' : ''}`} />
            Refresh Telemetry
          </button>
        </div>
      </div>

      {/* Safety Notice */}
      <div className="bg-teal-50/60 border border-teal-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <Radio className="w-5 h-5 text-[#0D9488] flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-bold text-teal-900 uppercase tracking-wide">
              MOCK ENGINE ACTIVE • META LIVE SENDING DISABLED
            </div>
            <div className="text-xs text-teal-800 mt-0.5">
              Strict platform safeguards are engaged: Meta Cloud API Live messaging is disabled. All outbound campaigns execute via multi-tenant simulated queue workers.
            </div>
          </div>
        </div>
        <span className="text-[11px] font-mono font-medium px-2 py-1 rounded bg-teal-100/70 text-teal-900 whitespace-nowrap self-start sm:self-auto">
          SAFEGUARDS: FAIL-CLOSED
        </span>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Workspaces Card */}
        <div className="bg-white p-5 rounded-xl border border-[#E5E7EB] shadow-sm hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-[#667085] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Workspaces</span>
            <Building2 className="w-4 h-4 text-[#0D9488]" />
          </div>
          <div className="text-2xl font-bold text-[#111827]">{workspaces?.total || 0}</div>
          <div className="flex items-center justify-between text-xs text-[#667085] mt-3 pt-3 border-t border-slate-100">
            <span>
              <strong className="text-emerald-700">{workspaces?.active || 0}</strong> Active
            </span>
            <span>
              <strong className="text-amber-700">{workspaces?.suspended || 0}</strong> Suspended
            </span>
            <span className="text-teal-700 font-medium">+{workspaces?.newThisMonth || 0} this mo</span>
          </div>
        </div>

        {/* Subscriptions Card */}
        <div className="bg-white p-5 rounded-xl border border-[#E5E7EB] shadow-sm hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-[#667085] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Paid Subscriptions</span>
            <CreditCard className="w-4 h-4 text-[#0D9488]" />
          </div>
          <div className="text-2xl font-bold text-[#111827]">{subscriptions?.activePaid || 0}</div>
          <div className="flex items-center justify-between text-xs text-[#667085] mt-3 pt-3 border-t border-slate-100">
            <span>
              <strong className="text-teal-700">{subscriptions?.trialing || 0}</strong> Trialing
            </span>
            <span>
              <strong className="text-rose-600">{subscriptions?.needingAttention || 0}</strong> Attention
            </span>
          </div>
        </div>

        {/* Verified Collections Card */}
        <div className="bg-white p-5 rounded-xl border border-[#E5E7EB] shadow-sm hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-[#667085] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Verified Live Collections</span>
            <TrendingUp className="w-4 h-4 text-[#0D9488]" />
          </div>
          <div className="text-2xl font-bold text-[#111827]">{revenue?.liveGrossFormatted || '₹0.00'}</div>
          <div className="flex items-center justify-between text-xs text-[#667085] mt-3 pt-3 border-t border-slate-100">
            <span>Test Collections: <strong>{revenue?.testGrossFormatted || '₹0.00'}</strong></span>
          </div>
        </div>

        {/* Message Queue Card */}
        <div className="bg-white p-5 rounded-xl border border-[#E5E7EB] shadow-sm hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-[#667085] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Queue Health</span>
            <Activity className="w-4 h-4 text-[#0D9488]" />
          </div>
          <div className="text-2xl font-bold text-[#111827]">{queue?.queued || 0} <span className="text-sm font-normal text-slate-500">queued</span></div>
          <div className="flex items-center justify-between text-xs text-[#667085] mt-3 pt-3 border-t border-slate-100">
            <span>Processing: <strong className="text-teal-700">{queue?.processing || 0}</strong></span>
            <span>Workers: <strong className="text-emerald-700">{queue?.activeWorkers || 0}</strong></span>
          </div>
        </div>
      </div>

      {/* Middle Section: Industry Distribution & Quick Operations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Industry Distribution */}
        <div className="bg-white p-6 rounded-xl border border-[#E5E7EB] shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-[#111827]">Workspace Industry Distribution</h2>
            <Link to="/platform-admin/businesses" className="text-xs font-medium text-[#0D9488] hover:underline flex items-center gap-1">
              View All <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {industryDistribution && industryDistribution.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
              {industryDistribution.map((item) => (
                <div key={item.industry} className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-xs font-semibold uppercase text-slate-500 tracking-wider">
                    {item.industry.replace('_', ' ')}
                  </div>
                  <div className="text-xl font-bold text-[#111827] mt-1">{item.count}</div>
                  <div className="text-[11px] text-[#667085]">
                    {workspaces?.total ? `${Math.round((item.count / workspaces.total) * 100)}% of total` : '0%'}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[#667085] py-8 text-center">No industry data available.</p>
          )}
        </div>

        {/* WhatsApp & Telemetry Status Card */}
        <div className="bg-white p-6 rounded-xl border border-[#E5E7EB] shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-[#111827] mb-3">WhatsApp Infrastructure</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-slate-100 text-xs">
                <span className="text-slate-600 font-medium">Mock Simulated Connections</span>
                <span className="font-bold text-[#111827]">{whatsapp?.mockConnections || 0}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100 text-xs">
                <span className="text-slate-600 font-medium">Official Cloud API Connections</span>
                <span className="font-bold text-slate-400">0 (Blocked)</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100 text-xs">
                <span className="text-slate-600 font-medium">Customer-Direct Meta Billing</span>
                <span className="font-semibold text-emerald-700">Enforced by Policy</span>
              </div>
              <div className="flex items-center justify-between py-2 text-xs">
                <span className="text-slate-600 font-medium">Worker Heartbeat</span>
                <span className="font-mono text-teal-700">{queue?.workerRunning ? 'ACTIVE' : 'IDLE'}</span>
              </div>
            </div>
          </div>
          <Link
            to="/platform-admin/whatsapp-connections"
            className="mt-6 inline-flex items-center justify-center gap-1.5 w-full py-2 px-3 text-xs font-semibold rounded-lg bg-teal-50 text-[#0D9488] hover:bg-teal-100 transition-colors border border-teal-200"
          >
            Inspect WhatsApp Connections <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Recent Security & Operational Audit Events */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        <div className="p-6 border-b border-[#E5E7EB] flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#111827]">Recent Platform Audit Signals</h2>
            <p className="text-xs text-[#667085] mt-0.5">Authoritative audit log of privileged administrative operations.</p>
          </div>
          <Link to="/platform-admin/security" className="text-xs font-medium text-[#0D9488] hover:underline flex items-center gap-1">
            Full Audit Trail <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentAuditLogs && recentAuditLogs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-6">Timestamp</th>
                  <th className="py-3 px-6">Action</th>
                  <th className="py-3 px-6">Target Resource</th>
                  <th className="py-3 px-6">Administrator</th>
                  <th className="py-3 px-6">Reason / Context</th>
                  <th className="py-3 px-6 text-right">Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {recentAuditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50">
                    <td className="py-3.5 px-6 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-6 font-mono font-semibold text-[#111827]">
                      {log.actionType}
                    </td>
                    <td className="py-3.5 px-6">
                      <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-[10px] text-slate-700">
                        {log.targetResourceType}:{log.targetResourceId ? log.targetResourceId.slice(-6) : 'SYS'}
                      </span>
                    </td>
                    <td className="py-3.5 px-6">
                      <div className="font-medium text-[#111827]">{log.adminName}</div>
                      <div className="text-[10px] text-slate-400">{log.adminEmailMasked}</div>
                    </td>
                    <td className="py-3.5 px-6 max-w-xs truncate text-slate-600">
                      {log.reason || 'Routine operational execution'}
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                        log.outcome === 'SUCCESS' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {log.outcome}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center text-xs text-[#667085]">
            No administrative audit events recorded yet.
          </div>
        )}
      </div>
    </div>
  );
}
