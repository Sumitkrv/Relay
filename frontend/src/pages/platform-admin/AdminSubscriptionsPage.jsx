import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import platformAdminApi from '../../services/platformAdmin';
import {
  CreditCard,
  RefreshCw,
  Search,
  CheckCircle,
  AlertTriangle,
  Clock,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export default function AdminSubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [summaryCounts, setSummaryCounts] = useState({ active: 0, trialing: 0, pastDue: 0, cancelled: 0, total: 0 });
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [environment, setEnvironment] = useState('');
  const [reconciling, setReconciling] = useState(false);
  const [reconcileMessage, setReconcileMessage] = useState(null);

  const fetchSubscriptions = async (page = pagination.page) => {
    setLoading(true);
    try {
      const res = await platformAdminApi.getSubscriptions({
        page,
        limit: 15,
        status,
        billingEnvironment: environment,
      });
      setSubscriptions(res.subscriptions || []);
      setSummaryCounts(res.summaryCounts || { active: 0, trialing: 0, pastDue: 0, cancelled: 0, total: 0 });
      setPagination(res.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 });
    } catch (err) {
      console.error('Failed to load subscriptions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptions(1);
  }, [status, environment]);

  const handleReconcile = async () => {
    setReconciling(true);
    setReconcileMessage(null);
    try {
      const res = await platformAdminApi.reconcileBilling({
        reason: 'Automated platform reconciliation check triggered via Admin UI',
      });
      setReconcileMessage(res.message);
      fetchSubscriptions(pagination.page);
    } catch (err) {
      setReconcileMessage(err.response?.data?.message || err.message || 'Reconciliation failed.');
    } finally {
      setReconciling(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#111827] tracking-tight">Subscription Monitoring</h1>
          <p className="text-sm text-[#667085] mt-1">
            Real-time status of recurring Razorpay plans, free trials, renewals, and payment exception tracking.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReconcile}
            disabled={reconciling}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#0D9488] text-white hover:bg-[#0F766E] transition-colors shadow-sm disabled:opacity-50"
          >
            <ShieldCheck className={`w-3.5 h-3.5 ${reconciling ? 'animate-spin' : ''}`} />
            {reconciling ? 'Reconciling...' : 'Reconcile Subscriptions'}
          </button>
          <button
            onClick={() => fetchSubscriptions(pagination.page)}
            className="p-1.5 rounded-lg border border-[#E5E7EB] bg-white hover:bg-slate-50 text-slate-700"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#0D9488]' : ''}`} />
          </button>
        </div>
      </div>

      {reconcileMessage && (
        <div className="bg-teal-50 border border-teal-200 text-teal-900 p-3 rounded-lg text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-[#0D9488] flex-shrink-0" />
          {reconcileMessage}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-[#E5E7EB] shadow-sm">
          <span className="text-xs font-semibold uppercase text-slate-400 block mb-1">Active Paid</span>
          <span className="text-2xl font-bold text-emerald-700">{summaryCounts.active}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-[#E5E7EB] shadow-sm">
          <span className="text-xs font-semibold uppercase text-slate-400 block mb-1">Trialing</span>
          <span className="text-2xl font-bold text-teal-700">{summaryCounts.trialing}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-[#E5E7EB] shadow-sm">
          <span className="text-xs font-semibold uppercase text-slate-400 block mb-1">Needing Attention</span>
          <span className="text-2xl font-bold text-rose-600">{summaryCounts.pastDue}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-[#E5E7EB] shadow-sm">
          <span className="text-xs font-semibold uppercase text-slate-400 block mb-1">Cancelled</span>
          <span className="text-2xl font-bold text-slate-500">{summaryCounts.cancelled}</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-[#E5E7EB] shadow-sm flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="text-xs border border-[#E5E7EB] rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:border-[#0D9488]"
          >
            <option value="">All Subscription Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="TRIALING">TRIALING</option>
            <option value="PAST_DUE">PAST_DUE</option>
            <option value="PAYMENT_PENDING">PAYMENT_PENDING</option>
            <option value="HALTED">HALTED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>

          <select
            value={environment}
            onChange={(e) => setEnvironment(e.target.value)}
            className="text-xs border border-[#E5E7EB] rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:border-[#0D9488]"
          >
            <option value="">All Environments (Test & Live)</option>
            <option value="LIVE">LIVE (Real)</option>
            <option value="TEST">TEST (Sandbox)</option>
          </select>
        </div>

        <div className="text-xs text-slate-500">
          Showing {subscriptions.length} records
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        {loading && subscriptions.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2">
            <div className="w-7 h-7 border-4 border-[#0D9488] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-[#667085]">Loading subscription statuses...</p>
          </div>
        ) : subscriptions.length === 0 ? (
          <div className="py-16 text-center text-xs text-[#667085]">
            No subscriptions found matching the filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-5">Workspace</th>
                  <th className="py-3 px-5">Plan</th>
                  <th className="py-3 px-5">Environment</th>
                  <th className="py-3 px-5">Internal Status</th>
                  <th className="py-3 px-5">Trial Period</th>
                  <th className="py-3 px-5">Current Period End</th>
                  <th className="py-3 px-5">Last Paid</th>
                  <th className="py-3 px-5 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {subscriptions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-5">
                      <div className="font-semibold text-[#111827]">{sub.workspace.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">/{sub.workspace.slug}</div>
                    </td>
                    <td className="py-3 px-5">
                      <span className="font-medium capitalize text-slate-800">{sub.planKey}</span>
                      <div className="text-[10px] text-slate-400">₹{(sub.amountMinor / 100).toFixed(2)}/mo</div>
                    </td>
                    <td className="py-3 px-5">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          sub.billingEnvironment === 'LIVE'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {sub.billingEnvironment}
                      </span>
                    </td>
                    <td className="py-3 px-5">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                          sub.internalStatus === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : sub.internalStatus === 'TRIALING'
                            ? 'bg-teal-50 text-teal-700 border border-teal-200'
                            : ['PAST_DUE', 'PAYMENT_PENDING', 'HALTED'].includes(sub.internalStatus)
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {sub.internalStatus}
                      </span>
                    </td>
                    <td className="py-3 px-5 text-slate-600">
                      {sub.trialEndsAt ? new Date(sub.trialEndsAt).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="py-3 px-5 text-slate-600">
                      {sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="py-3 px-5 text-slate-600">
                      {sub.lastPaidAt ? new Date(sub.lastPaidAt).toLocaleDateString() : 'None'}
                    </td>
                    <td className="py-3 px-5 text-right">
                      <Link
                        to={`/platform-admin/businesses/${sub.workspace.id}`}
                        className="text-[#0D9488] hover:underline font-medium"
                      >
                        View Profile
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
            Showing {subscriptions.length} of {pagination.total} subscriptions
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchSubscriptions(pagination.page - 1)}
              disabled={pagination.page <= 1 || loading}
              className="p-1.5 border border-[#E5E7EB] rounded hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => fetchSubscriptions(pagination.page + 1)}
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
