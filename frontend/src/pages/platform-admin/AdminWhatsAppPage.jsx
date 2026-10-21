import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import platformAdminApi from '../../services/platformAdmin';
import {
  MessageSquare,
  RefreshCw,
  Radio,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export default function AdminWhatsAppPage() {
  const [connections, setConnections] = useState([]);
  const [summary, setSummary] = useState({ mockReady: 0, disconnected: 0, billingUnverified: 0, total: 0 });
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  const fetchConnections = async (page = pagination.page) => {
    setLoading(true);
    try {
      const res = await platformAdminApi.getWhatsAppConnections({ page, limit: 15 });
      setConnections(res.connections || []);
      setSummary(res.summary || { mockReady: 0, disconnected: 0, billingUnverified: 0, total: 0 });
      setPagination(res.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 });
    } catch (err) {
      console.error('Failed to load WhatsApp connections:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections(1);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#111827] tracking-tight">WhatsApp Connection Health</h1>
          <p className="text-sm text-[#667085] mt-1">
            Global monitoring of customer WhatsApp onboarding readiness, Mock simulation states, and Meta Cloud API gating.
          </p>
        </div>
        <button
          onClick={() => fetchConnections(pagination.page)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-[#E5E7EB] text-[#111827] hover:bg-slate-50 transition-colors shadow-sm self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#0D9488]' : ''}`} />
          Refresh Connections
        </button>
      </div>

      {/* Security Architecture Banner */}
      <div className="bg-teal-50/70 border border-teal-200 rounded-xl p-4 flex items-start gap-3">
        <Radio className="w-5 h-5 text-[#0D9488] flex-shrink-0 mt-0.5" />
        <div className="text-xs text-teal-900 space-y-1">
          <div className="font-bold uppercase tracking-wider">
            CUSTOMER-DIRECT META BILLING & MOCK ENGINE ARCHITECTURE
          </div>
          <div>
            • <strong>Fail-Closed Safety:</strong> Live Meta WhatsApp message dispatch is disabled platform-wide.
          </div>
          <div>
            • <strong>Billing Responsibility:</strong> Relay never attaches its payment credentials to customer Meta accounts. Customer-direct billing is strictly verified before future live activation.
          </div>
          <div>
            • <strong>Data Privacy:</strong> Customer Meta tokens and private message contents are NEVER exposed to Platform Administrators.
          </div>
        </div>
      </div>

      {/* Status Summary Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-[#E5E7EB] shadow-sm">
          <span className="text-xs font-semibold text-slate-400 block mb-1">Total Connections</span>
          <span className="text-2xl font-bold text-[#111827]">{summary.total}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-[#E5E7EB] shadow-sm">
          <span className="text-xs font-semibold text-slate-400 block mb-1">Mock Ready (Simulated)</span>
          <span className="text-2xl font-bold text-teal-700">{summary.mockReady}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-[#E5E7EB] shadow-sm">
          <span className="text-xs font-semibold text-slate-400 block mb-1">Billing Unverified</span>
          <span className="text-2xl font-bold text-amber-600">{summary.billingUnverified}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-[#E5E7EB] shadow-sm">
          <span className="text-xs font-semibold text-slate-400 block mb-1">Disconnected / Setup</span>
          <span className="text-2xl font-bold text-slate-500">{summary.disconnected}</span>
        </div>
      </div>

      {/* Connections Table */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        {loading && connections.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2">
            <div className="w-7 h-7 border-4 border-[#0D9488] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-[#667085]">Querying connection health...</p>
          </div>
        ) : connections.length === 0 ? (
          <div className="py-16 text-center text-xs text-[#667085]">
            No customer WhatsApp connections recorded.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-5">Workspace</th>
                  <th className="py-3 px-5">Type</th>
                  <th className="py-3 px-5">Mode</th>
                  <th className="py-3 px-5">Connection Status</th>
                  <th className="py-3 px-5">Meta Billing</th>
                  <th className="py-3 px-5">Sender Verification</th>
                  <th className="py-3 px-5">Webhooks</th>
                  <th className="py-3 px-5 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {connections.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-5">
                      <div className="font-semibold text-[#111827]">{c.workspace.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">/{c.workspace.slug}</div>
                    </td>
                    <td className="py-3 px-5 font-mono text-[11px] text-slate-700">
                      {c.connectionType}
                    </td>
                    <td className="py-3 px-5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-teal-50 text-teal-800 border border-teal-200">
                        {c.connectionMode}
                      </span>
                    </td>
                    <td className="py-3 px-5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-800">
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3 px-5">
                      <span
                        className={`text-[11px] font-medium ${
                          c.billingStatus === 'CUSTOMER_DIRECT_VERIFIED'
                            ? 'text-emerald-700'
                            : 'text-amber-700'
                        }`}
                      >
                        {c.billingStatus}
                      </span>
                    </td>
                    <td className="py-3 px-5 text-slate-600">
                      {c.phoneVerificationStatus}
                    </td>
                    <td className="py-3 px-5 text-slate-600">
                      {c.webhookStatus}
                    </td>
                    <td className="py-3 px-5 text-right">
                      <Link
                        to={`/platform-admin/businesses/${c.workspace.id}`}
                        className="text-[#0D9488] hover:underline font-medium"
                      >
                        Profile
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        <div className="p-4 border-t border-[#E5E7EB] flex items-center justify-between text-xs text-[#667085]">
          <div>
            Showing {connections.length} of {pagination.total} connections
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchConnections(pagination.page - 1)}
              disabled={pagination.page <= 1 || loading}
              className="p-1.5 border border-[#E5E7EB] rounded hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => fetchConnections(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || loading}
              className="p-1.5 border border-[#E5E7EB] rounded hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
