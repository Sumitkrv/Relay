import React, { useEffect, useState } from 'react';
import platformAdminApi from '../../services/platformAdmin';
import {
  TrendingUp,
  RefreshCw,
  Calendar,
  AlertCircle,
  CreditCard,
  DollarSign,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';

export default function AdminRevenuePage() {
  const [environment, setEnvironment] = useState('LIVE'); // 'LIVE' | 'TEST'
  const [dateRange, setDateRange] = useState('all');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchRevenue = async () => {
    setLoading(true);
    try {
      const res = await platformAdminApi.getRevenue({
        environment,
        dateRange,
      });
      setData(res);
    } catch (err) {
      console.error('Failed to load revenue metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRevenue();
  }, [environment, dateRange]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#111827] tracking-tight">Verified Revenue Analytics</h1>
          <p className="text-sm text-[#667085] mt-1">
            Authoritative financial reporting derived directly from verified captured provider transactions.
          </p>
        </div>
        <button
          onClick={fetchRevenue}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-[#E5E7EB] text-[#111827] hover:bg-slate-50 transition-colors shadow-sm self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#0D9488]' : ''}`} />
          Refresh Metrics
        </button>
      </div>

      {/* Environment Toggle Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-3 rounded-xl border border-[#E5E7EB] shadow-sm">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setEnvironment('LIVE')}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
              environment === 'LIVE'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            LIVE COLLECTIONS (REAL REVENUE)
          </button>
          <button
            onClick={() => setEnvironment('TEST')}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
              environment === 'TEST'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            TEST MODE (SANDBOX CHECKOUTS)
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="text-xs border border-[#E5E7EB] rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:border-[#0D9488]"
          >
            <option value="all">All-Time Collections</option>
            <option value="today">Today</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="this_month">This Calendar Month</option>
          </select>
        </div>
      </div>

      {/* Financial Strictness Disclaimer */}
      <div
        className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
          environment === 'LIVE'
            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
            : 'bg-amber-50/70 border-amber-200 text-amber-900'
        }`}
      >
        <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <div>
          <div className="font-bold">
            {environment === 'LIVE'
              ? 'ACCOUNTING STANDARD: VERIFIED CASH COLLECTIONS'
              : 'SANDBOX SIMULATION: EXCLUDED FROM PLATFORM FINANCIAL LEDGER'}
          </div>
          <div className="mt-0.5 text-[11px] opacity-90">{data?.disclaimer}</div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-[#E5E7EB] shadow-sm">
          <span className="text-xs font-semibold uppercase text-slate-400 block mb-1">Gross Collections</span>
          <div className="text-2xl font-bold text-[#111827]">{data?.grossFormatted || '₹0.00'}</div>
          <div className="text-[11px] text-slate-500 mt-2">
            {data?.paidPaymentCount || 0} captured payments
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-[#E5E7EB] shadow-sm">
          <span className="text-xs font-semibold uppercase text-slate-400 block mb-1">Refunds Deducted</span>
          <div className="text-2xl font-bold text-rose-600">{data?.refundsFormatted || '₹0.00'}</div>
          <div className="text-[11px] text-slate-500 mt-2">Processed reversals</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-[#E5E7EB] shadow-sm">
          <span className="text-xs font-semibold uppercase text-slate-400 block mb-1">Net Collected</span>
          <div className="text-2xl font-bold text-emerald-700">{data?.netFormatted || '₹0.00'}</div>
          <div className="text-[11px] text-slate-500 mt-2">Gross minus refunds</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-[#E5E7EB] shadow-sm">
          <span className="text-xs font-semibold uppercase text-slate-400 block mb-1">Paying Workspaces</span>
          <div className="text-2xl font-bold text-[#111827]">{data?.distinctPayingWorkspaces || 0}</div>
          <div className="text-[11px] text-slate-500 mt-2">Unique tenant businesses</div>
        </div>
      </div>

      {/* Monthly Collections Trend */}
      <div className="bg-white p-6 rounded-xl border border-[#E5E7EB] shadow-sm">
        <h2 className="text-sm font-bold text-[#111827] mb-4">Monthly Collections History ({environment})</h2>
        {data?.monthlyTrend && data.monthlyTrend.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {data.monthlyTrend.map((m) => (
              <div key={m.month} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[11px] font-mono text-slate-500 uppercase block">{m.month}</span>
                <span className="text-lg font-bold text-[#111827] block mt-1">{m.amountFormatted}</span>
                <span className="text-[10px] text-slate-400">{m.count} payments</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 py-6 text-center">
            No historical payment batches recorded for this environment.
          </p>
        )}
      </div>

      {/* Recent Payments Table */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        <div className="p-5 border-b border-[#E5E7EB] flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#111827]">Recent Payment Transactions ({environment})</h2>
          <span className="text-[11px] text-slate-400">Strictly sanitized (Card tokens redacted)</span>
        </div>

        {data?.recentPayments && data.recentPayments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-5">Timestamp</th>
                  <th className="py-3 px-5">Payment Reference</th>
                  <th className="py-3 px-5">Workspace</th>
                  <th className="py-3 px-5">Amount</th>
                  <th className="py-3 px-5">Method</th>
                  <th className="py-3 px-5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {data.recentPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-5 font-mono text-[11px] text-slate-500">
                      {new Date(p.paidAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-5 font-mono font-medium text-slate-800">
                      {p.providerPaymentId}
                    </td>
                    <td className="py-3 px-5 font-semibold text-[#111827]">
                      {p.workspaceName}
                    </td>
                    <td className="py-3 px-5 font-bold text-emerald-700">
                      {p.amountFormatted}
                    </td>
                    <td className="py-3 px-5 text-slate-600 capitalize">
                      {p.method} {p.cardLast4 ? `(••${p.cardLast4})` : ''}
                    </td>
                    <td className="py-3 px-5 text-right">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-slate-400">
            No payment transaction records found in {environment} environment.
          </div>
        )}
      </div>
    </div>
  );
}
