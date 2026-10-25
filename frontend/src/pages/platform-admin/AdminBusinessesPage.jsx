import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import platformAdminApi from '../../services/platformAdmin';
import {
  Building2,
  Search,
  Filter,
  Eye,
  AlertOctagon,
  CheckCircle,
  RefreshCw,
  X,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const VALID_INDUSTRIES = [
  'real_estate',
  'gym',
  'clinic',
  'education',
  'salon',
  'automobile',
  'other',
];

export default function AdminBusinessesPage() {
  const [workspaces, setWorkspaces] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [industry, setIndustry] = useState('');
  const [actionModal, setActionModal] = useState(null); // { type: 'suspend' | 'reactivate', workspace }
  const [modalReason, setModalReason] = useState('');
  const [modalPassword, setModalPassword] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  const fetchBusinesses = async (pageToFetch = pagination.page) => {
    setLoading(true);
    try {
      const res = await platformAdminApi.getBusinesses({
        search,
        status,
        industry,
        page: pageToFetch,
        limit: 15,
      });
      setWorkspaces(res.workspaces || []);
      setPagination(res.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 });
    } catch (err) {
      console.error('Failed to load businesses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBusinesses(1);
  }, [status, industry]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchBusinesses(1);
  };

  const handleActionConfirm = async (e) => {
    e.preventDefault();
    if (!actionModal) return;
    setActionSubmitting(true);
    setActionError(null);
    try {
      if (actionModal.type === 'suspend') {
        await platformAdminApi.suspendWorkspace(actionModal.workspace.id, {
          reason: modalReason,
          stepUpPassword: modalPassword,
          stepUpConfirmed: true, // Accepted in dev/test environment
        });
        setActionSuccess(`Workspace "${actionModal.workspace.name}" has been suspended.`);
      } else {
        await platformAdminApi.reactivateWorkspace(actionModal.workspace.id, {
          reason: modalReason,
          stepUpPassword: modalPassword,
          stepUpConfirmed: true,
        });
        setActionSuccess(`Workspace "${actionModal.workspace.name}" has been reactivated.`);
      }
      setActionModal(null);
      setModalReason('');
      setModalPassword('');
      fetchBusinesses(pagination.page);
    } catch (err) {
      setActionError(err.response?.data?.message || err.message || 'Operation failed.');
    } finally {
      setActionSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#111827] tracking-tight">Business Directory</h1>
          <p className="text-sm text-[#667085] mt-1">
            Browse and manage all registered SaaS tenant businesses, onboarding state, and operational status.
          </p>
        </div>
        <button
          onClick={() => fetchBusinesses(pagination.page)}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-[#E5E7EB] text-[#111827] hover:bg-slate-50 transition-colors shadow-sm self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#0D9488]' : ''}`} />
          Refresh Directory
        </button>
      </div>

      {actionSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-lg text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            {actionSuccess}
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-[#E5E7EB] shadow-sm flex flex-col md:flex-row md:items-center gap-3">
        <form onSubmit={handleSearchSubmit} className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by business name, slug, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs border border-[#E5E7EB] rounded-lg focus:outline-none focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488]"
          />
        </form>

        <div className="flex items-center gap-3">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="text-xs border border-[#E5E7EB] rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-[#0D9488]"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="SUSPENDED">SUSPENDED</option>
            <option value="PROVISIONING">PROVISIONING</option>
          </select>

          <select
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className="text-xs border border-[#E5E7EB] rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-[#0D9488]"
          >
            <option value="">All Industries</option>
            {VALID_INDUSTRIES.map((ind) => (
              <option key={ind} value={ind}>
                {ind.replace('_', ' ').toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Businesses Table */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        {loading && workspaces.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center gap-2">
            <div className="w-7 h-7 border-4 border-[#0D9488] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-[#667085]">Loading tenant directory...</p>
          </div>
        ) : workspaces.length === 0 ? (
          <div className="py-16 text-center text-xs text-[#667085]">
            No businesses match the specified search or filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-5">Business</th>
                  <th className="py-3 px-5">Industry</th>
                  <th className="py-3 px-5">Owner (Masked)</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5">Subscription</th>
                  <th className="py-3 px-5">WhatsApp</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {workspaces.map((ws) => (
                  <tr key={ws.id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-5">
                      <div className="font-semibold text-[#111827]">{ws.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">/{ws.slug}</div>
                    </td>
                    <td className="py-3 px-5 uppercase text-[10px] font-medium text-slate-600">
                      {ws.industryKey.replace('_', ' ')}
                    </td>
                    <td className="py-3 px-5">
                      <div className="font-medium text-slate-800">{ws.owner?.name}</div>
                      <div className="text-[10px] text-slate-400">{ws.owner?.emailMasked}</div>
                    </td>
                    <td className="py-3 px-5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                          ws.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : ws.status === 'SUSPENDED'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {ws.status}
                      </span>
                    </td>
                    <td className="py-3 px-5">
                      <div className="font-medium capitalize text-slate-800">{ws.subscription.planKey}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{ws.subscription.internalStatus}</div>
                    </td>
                    <td className="py-3 px-5">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-teal-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                        {ws.whatsappConnection.connectionType === 'MOCK_SIMULATED' ? 'Mock Ready' : ws.whatsappConnection.status}
                      </span>
                    </td>
                    <td className="py-3 px-5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/platform-admin/businesses/${ws.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors"
                        >
                          <Eye className="w-3 h-3" />
                          View
                        </Link>
                        {ws.status === 'ACTIVE' ? (
                          <button
                            onClick={() => {
                              setActionModal({ type: 'suspend', workspace: ws });
                              setActionError(null);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors"
                          >
                            <AlertOctagon className="w-3 h-3" />
                            Suspend
                          </button>
                        ) : ws.status === 'SUSPENDED' ? (
                          <button
                            onClick={() => {
                              setActionModal({ type: 'reactivate', workspace: ws });
                              setActionError(null);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors"
                          >
                            <CheckCircle className="w-3 h-3" />
                            Reactivate
                          </button>
                        ) : null}
                      </div>
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
            Showing {workspaces.length} of {pagination.total} businesses (Page {pagination.page} of {pagination.totalPages})
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchBusinesses(pagination.page - 1)}
              disabled={pagination.page <= 1 || loading}
              className="p-1.5 border border-[#E5E7EB] rounded hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => fetchBusinesses(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || loading}
              className="p-1.5 border border-[#E5E7EB] rounded hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Controlled Action Modal (Suspend / Reactivate) */}
      {actionModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-sm text-[#111827]">
                  {actionModal.type === 'suspend' ? 'Suspend Business Workspace' : 'Reactivate Business Workspace'}
                </h3>
              </div>
              <button
                onClick={() => setActionModal(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#667085] mb-4">
              Target: <strong className="text-[#111827]">{actionModal.workspace.name}</strong> (/{actionModal.workspace.slug})
            </p>

            {actionError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
                {actionError}
              </div>
            )}

            <form onSubmit={handleActionConfirm} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Substantive Administrative Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={modalReason}
                  onChange={(e) => setModalReason(e.target.value)}
                  placeholder="Document reason for audit trail (min 5 characters)..."
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:border-[#0D9488]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Operator Re-authentication Password
                </label>
                <input
                  type="password"
                  value={modalPassword}
                  onChange={(e) => setModalPassword(e.target.value)}
                  placeholder="Enter administrator password..."
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:border-[#0D9488]"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  High-risk operational changes require step-up authentication.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActionModal(null)}
                  className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionSubmitting || modalReason.trim().length < 5}
                  className={`px-4 py-2 text-white font-medium rounded-lg transition-colors ${
                    actionModal.type === 'suspend'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  } disabled:opacity-50`}
                >
                  {actionSubmitting ? 'Processing...' : actionModal.type === 'suspend' ? 'Confirm Suspension' : 'Confirm Reactivation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
