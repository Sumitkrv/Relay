import React, { useEffect, useState } from 'react';
import platformAdminApi from '../../services/platformAdmin';
import {
  Headphones,
  Plus,
  RefreshCw,
  Search,
  MessageSquare,
  Clock,
  CheckCircle,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const CATEGORIES = [
  'ONBOARDING',
  'BILLING',
  'WHATSAPP_CONNECTION',
  'MESSAGING_QUEUE',
  'ACCOUNT_ACCESS',
  'TECHNICAL_ERROR',
  'GENERAL_SUPPORT',
];

export default function AdminSupportPage() {
  const [cases, setCases] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [createModal, setCreateModal] = useState(false);
  const [workspaces, setWorkspaces] = useState([]);

  // Form State
  const [targetWorkspaceId, setTargetWorkspaceId] = useState('');
  const [category, setCategory] = useState('GENERAL_SUPPORT');
  const [priority, setPriority] = useState('MEDIUM');
  const [summary, setSummary] = useState('');
  const [initialNote, setInitialNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const fetchCases = async (page = pagination.page) => {
    setLoading(true);
    try {
      const res = await platformAdminApi.getSupportCases({ page, limit: 15 });
      setCases(res.cases || []);
      setPagination(res.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 });
    } catch (err) {
      console.error('Failed to load support cases:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadWorkspacesForSelect = async () => {
    try {
      const res = await platformAdminApi.getBusinesses({ limit: 50 });
      setWorkspaces(res.workspaces || []);
      if (res.workspaces?.[0]) {
        setTargetWorkspaceId(res.workspaces[0].id);
      }
    } catch (err) {
      console.error('Failed to load workspaces for selector:', err);
    }
  };

  useEffect(() => {
    fetchCases(1);
    loadWorkspacesForSelect();
  }, []);

  const handleCreateCase = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await platformAdminApi.createSupportCase({
        workspaceId: targetWorkspaceId,
        issueCategory: category,
        priority,
        summary,
        initialNote,
      });
      setCreateModal(false);
      setSummary('');
      setInitialNote('');
      fetchCases(1);
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || 'Failed to create support case.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#111827] tracking-tight">Support Operations</h1>
          <p className="text-sm text-[#667085] mt-1">
            Scoped tenant support cases, triage notes, and operational assistance without customer impersonation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCreateModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#0D9488] text-white hover:bg-[#0F766E] transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            New Support Case
          </button>
          <button
            onClick={() => fetchCases(pagination.page)}
            className="p-1.5 rounded-lg border border-[#E5E7EB] bg-white hover:bg-slate-50 text-slate-700"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#0D9488]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Support Cases Table */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        {loading && cases.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2">
            <div className="w-7 h-7 border-4 border-[#0D9488] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-[#667085]">Retrieving support cases...</p>
          </div>
        ) : cases.length === 0 ? (
          <div className="py-16 text-center text-xs text-[#667085]">
            No support cases currently open. All customer workspaces are operational.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-5">Case #</th>
                  <th className="py-3 px-5">Workspace</th>
                  <th className="py-3 px-5">Category</th>
                  <th className="py-3 px-5">Summary</th>
                  <th className="py-3 px-5">Priority</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5 text-right">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {cases.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-5 font-mono font-bold text-slate-900">
                      {c.caseNumber}
                    </td>
                    <td className="py-3 px-5 font-semibold text-[#111827]">
                      {c.workspace.name}
                    </td>
                    <td className="py-3 px-5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                        {c.issueCategory.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-5 max-w-sm truncate text-slate-800">
                      {c.summary}
                    </td>
                    <td className="py-3 px-5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          c.priority === 'CRITICAL'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : c.priority === 'HIGH'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {c.priority}
                      </span>
                    </td>
                    <td className="py-3 px-5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3 px-5 text-right font-mono text-[11px] text-slate-500">
                      {new Date(c.createdAt).toLocaleDateString()}
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
            Showing {cases.length} of {pagination.total} cases
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchCases(pagination.page - 1)}
              disabled={pagination.page <= 1 || loading}
              className="p-1.5 border border-[#E5E7EB] rounded hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => fetchCases(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || loading}
              className="p-1.5 border border-[#E5E7EB] rounded hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* New Support Case Modal */}
      {createModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-sm text-[#111827]">Open Operational Support Case</h3>
              <button onClick={() => setCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-2.5 bg-red-50 border border-red-200 text-red-700 rounded text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateCase} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target Workspace</label>
                <select
                  required
                  value={targetWorkspaceId}
                  onChange={(e) => setTargetWorkspaceId(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#0D9488]"
                >
                  {workspaces.map((ws) => (
                    <option key={ws.id} value={ws.id}>
                      {ws.name} ({ws.industryKey})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Issue Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#0D9488]"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#0D9488]"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Case Summary</label>
                <input
                  type="text"
                  required
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="e.g. Workspace requested webhook diagnostic verification"
                  className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#0D9488]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Initial Internal Note</label>
                <textarea
                  rows={3}
                  value={initialNote}
                  onChange={(e) => setInitialNote(e.target.value)}
                  placeholder="Operational details for platform administrators..."
                  className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#0D9488]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreateModal(false)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || summary.trim().length < 5}
                  className="px-4 py-2 bg-[#0D9488] hover:bg-[#0F766E] text-white font-medium rounded-lg disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Case'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
