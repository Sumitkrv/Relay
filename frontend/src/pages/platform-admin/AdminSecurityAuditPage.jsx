import React, { useEffect, useState } from 'react';
import platformAdminApi from '../../services/platformAdmin';
import {
  ShieldCheck,
  RefreshCw,
  Search,
  Filter,
  Lock,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';

export default function AdminSecurityAuditPage() {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [actionType, setActionType] = useState('');
  const [targetResourceType, setTargetResourceType] = useState('');

  const fetchLogs = async (page = pagination.page) => {
    setLoading(true);
    try {
      const res = await platformAdminApi.getAuditLogs({
        page,
        limit: 20,
        actionType,
        targetResourceType,
      });
      setLogs(res.logs || []);
      setPagination(res.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 });
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1);
  }, [actionType, targetResourceType]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#111827] tracking-tight">Security & Audit Trail</h1>
          <p className="text-sm text-[#667085] mt-1">
            Authoritative, append-only security log recording every administrative operation and privilege invocation.
          </p>
        </div>
        <button
          onClick={() => fetchLogs(pagination.page)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-[#E5E7EB] text-[#111827] hover:bg-slate-50 transition-colors shadow-sm self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#0D9488]' : ''}`} />
          Refresh Audit Trail
        </button>
      </div>

      {/* Security Invariants Box */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-start gap-3">
        <Lock className="w-5 h-5 text-[#0D9488] flex-shrink-0 mt-0.5" />
        <div className="text-xs text-slate-700 space-y-1">
          <div className="font-bold text-slate-900 uppercase tracking-wide">
            AUTOMATIC METADATA SANITIZATION & REDACTION ACTIVE
          </div>
          <div>
            • Sensitive credentials (passwords, tokens, sessions, API secrets, private customer messages) are automatically stripped before writing to audit storage.
          </div>
          <div>
            • Audit records cannot be altered or removed through administrative APIs.
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-[#E5E7EB] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select
            value={actionType}
            onChange={(e) => setActionType(e.target.value)}
            className="text-xs border border-[#E5E7EB] rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:border-[#0D9488]"
          >
            <option value="">All Action Types</option>
            <option value="workspace_suspended">Workspace Suspended</option>
            <option value="workspace_reactivated">Workspace Reactivated</option>
            <option value="admin_grant_created">Admin Grant Created</option>
            <option value="admin_grant_reactivated">Admin Grant Reactivated</option>
            <option value="billing_reconciliation_requested">Reconciliation Requested</option>
            <option value="support_case_created">Support Case Created</option>
          </select>

          <select
            value={targetResourceType}
            onChange={(e) => setTargetResourceType(e.target.value)}
            className="text-xs border border-[#E5E7EB] rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:border-[#0D9488]"
          >
            <option value="">All Resource Types</option>
            <option value="WORKSPACE">WORKSPACE</option>
            <option value="PLATFORM_GRANT">PLATFORM_GRANT</option>
            <option value="BILLING">BILLING</option>
            <option value="SUPPORT_CASE">SUPPORT_CASE</option>
          </select>
        </div>

        <div className="text-xs text-slate-500 self-end sm:self-auto">
          Total Logged Operations: <strong>{pagination.total}</strong>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        {loading && logs.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2">
            <div className="w-7 h-7 border-4 border-[#0D9488] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-[#667085]">Retrieving audit records...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center text-xs text-[#667085]">
            No audit records found matching the filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-5">Timestamp</th>
                  <th className="py-3 px-5">Action Type</th>
                  <th className="py-3 px-5">Resource</th>
                  <th className="py-3 px-5">Operator</th>
                  <th className="py-3 px-5">Substantive Reason</th>
                  <th className="py-3 px-5">Correlation ID</th>
                  <th className="py-3 px-5 text-right">Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-5 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-5 font-mono font-bold text-slate-900">
                      {log.actionType}
                    </td>
                    <td className="py-3 px-5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-800">
                        {log.targetResourceType}:{log.targetResourceId ? log.targetResourceId.slice(-6) : 'SYS'}
                      </span>
                    </td>
                    <td className="py-3 px-5">
                      <div className="font-semibold text-[#111827]">{log.adminName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{log.adminEmailMasked}</div>
                    </td>
                    <td className="py-3 px-5 max-w-xs truncate text-slate-600">
                      {log.reason || 'N/A'}
                    </td>
                    <td className="py-3 px-5 font-mono text-[10px] text-slate-400">
                      {log.correlationId}
                    </td>
                    <td className="py-3 px-5 text-right">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.outcome === 'SUCCESS'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {log.outcome}
                      </span>
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
            Showing {logs.length} of {pagination.total} audit events
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchLogs(pagination.page - 1)}
              disabled={pagination.page <= 1 || loading}
              className="p-1.5 border border-[#E5E7EB] rounded hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => fetchLogs(pagination.page + 1)}
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
