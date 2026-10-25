import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import platformAdminApi from '../../services/platformAdmin';
import {
  ArrowLeft,
  Building2,
  User,
  CreditCard,
  MessageSquare,
  Activity,
  ShieldAlert,
  CheckCircle,
  AlertOctagon,
  Clock,
  Radio,
  X,
} from 'lucide-react';

export default function AdminBusinessDetailPage() {
  const { workspaceId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionModal, setActionModal] = useState(null); // 'suspend' | 'reactivate'
  const [modalReason, setModalReason] = useState('');
  const [modalPassword, setModalPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);

  const fetchDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await platformAdminApi.getBusinessDetail(workspaceId);
      setData(res);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load business profile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [workspaceId]);

  const handleAction = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (actionModal === 'suspend') {
        const res = await platformAdminApi.suspendWorkspace(workspaceId, {
          reason: modalReason,
          stepUpPassword: modalPassword,
          stepUpConfirmed: true,
        });
        setActionMessage(res.message);
      } else {
        const res = await platformAdminApi.reactivateWorkspace(workspaceId, {
          reason: modalReason,
          stepUpPassword: modalPassword,
          stepUpConfirmed: true,
        });
        setActionMessage(res.message);
      }
      setActionModal(null);
      setModalReason('');
      setModalPassword('');
      fetchDetail();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Action failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-4 border-[#0D9488] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-[#667085]">Retrieving workspace profile...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-red-700">
        <h3 className="font-bold text-base mb-1">Failed to load Business Profile</h3>
        <p className="text-xs">{error || 'Workspace could not be found.'}</p>
        <Link
          to="/platform-admin/businesses"
          className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white rounded text-xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Business Directory
        </Link>
      </div>
    );
  }

  const { workspace, owner, subscription, whatsappConnection, queueStats, recentAuditLogs } = data;

  return (
    <div className="space-y-6">
      {/* Back button and Header */}
      <div>
        <Link
          to="/platform-admin/businesses"
          className="inline-flex items-center gap-1.5 text-xs text-[#667085] hover:text-[#111827] mb-3 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Directory
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-teal-50 text-[#0D9488] border border-teal-200 flex items-center justify-center font-bold text-lg">
              {workspace.name[0]}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold text-[#111827]">{workspace.name}</h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                  {workspace.industryKey.replace('_', ' ')}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    workspace.status === 'ACTIVE'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : workspace.status === 'SUSPENDED'
                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}
                >
                  {workspace.status}
                </span>
              </div>
              <div className="text-xs text-[#667085] mt-0.5 font-mono">
                slug: /{workspace.slug} • id: {workspace.id}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {workspace.status === 'ACTIVE' ? (
              <button
                onClick={() => setActionModal('suspend')}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors"
              >
                <AlertOctagon className="w-3.5 h-3.5" />
                Suspend Workspace
              </button>
            ) : workspace.status === 'SUSPENDED' ? (
              <button
                onClick={() => setActionModal('reactivate')}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                Reactivate Workspace
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {actionMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-lg text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            {actionMessage}
          </div>
          <button onClick={() => setActionMessage(null)}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Grid of Profile Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Core Workspace Information */}
        <div className="bg-white p-5 rounded-xl border border-[#E5E7EB] shadow-sm space-y-4">
          <div className="flex items-center gap-2 font-bold text-sm text-[#111827] border-b border-slate-100 pb-3">
            <Building2 className="w-4 h-4 text-[#0D9488]" />
            Workspace Profile
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-400 block mb-0.5">Business Email</span>
              <span className="font-medium text-[#111827]">{workspace.businessEmail || 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">Onboarding State</span>
              <span className="font-medium text-[#111827]">{workspace.onboardingStatus}</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">Created Date</span>
              <span className="font-medium text-[#111827]">{new Date(workspace.createdAt).toLocaleDateString()}</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">Timezone / Currency</span>
              <span className="font-medium text-[#111827]">{workspace.timezone} ({workspace.currency})</span>
            </div>
            {workspace.suspendedAt && (
              <div className="col-span-2 p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800">
                <span className="font-bold block text-[11px]">Suspension Notice:</span>
                <span className="text-[11px] block mt-0.5">Suspended on {new Date(workspace.suspendedAt).toLocaleString()}</span>
                <span className="text-[11px] block mt-0.5 font-mono">Reason: {workspace.suspendedReason}</span>
              </div>
            )}
          </div>
        </div>

        {/* Owner Account Summary (Privacy Redacted) */}
        <div className="bg-white p-5 rounded-xl border border-[#E5E7EB] shadow-sm space-y-4">
          <div className="flex items-center gap-2 font-bold text-sm text-[#111827] border-b border-slate-100 pb-3">
            <User className="w-4 h-4 text-[#0D9488]" />
            Owner Account Summary
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-400 block mb-0.5">Owner Name</span>
              <span className="font-medium text-[#111827]">{owner?.name}</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">Email (Masked for Privacy)</span>
              <span className="font-medium text-[#111827] font-mono">{owner?.emailMasked}</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">Account Status</span>
              <span className="font-medium text-emerald-700">{owner?.accountStatus}</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">Email Verified</span>
              <span className="font-medium text-[#111827]">{owner?.isEmailVerified ? 'Yes' : 'No'}</span>
            </div>
          </div>
        </div>

        {/* Subscription & Billing */}
        <div className="bg-white p-5 rounded-xl border border-[#E5E7EB] shadow-sm space-y-4">
          <div className="flex items-center gap-2 font-bold text-sm text-[#111827] border-b border-slate-100 pb-3">
            <CreditCard className="w-4 h-4 text-[#0D9488]" />
            Subscription & Entitlements
          </div>
          {subscription ? (
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">Plan Key</span>
                <span className="font-semibold text-[#111827] capitalize">{subscription.planKey}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Internal Status</span>
                <span className="font-mono text-teal-700 font-bold">{subscription.internalStatus}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Environment</span>
                <span className="font-mono text-slate-700">{subscription.billingEnvironment}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Billing Provider</span>
                <span className="font-medium text-slate-700">{subscription.provider}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Trial Ends At</span>
                <span className="text-slate-700">
                  {subscription.trialEndsAt ? new Date(subscription.trialEndsAt).toLocaleDateString() : 'None'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Current Period End</span>
                <span className="text-slate-700">
                  {subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : 'None'}
                </span>
              </div>
            </div>
          ) : (
            <div className="py-4 text-center text-xs text-slate-400">No active subscription record.</div>
          )}
        </div>

        {/* WhatsApp Connection */}
        <div className="bg-white p-5 rounded-xl border border-[#E5E7EB] shadow-sm space-y-4">
          <div className="flex items-center gap-2 font-bold text-sm text-[#111827] border-b border-slate-100 pb-3">
            <MessageSquare className="w-4 h-4 text-[#0D9488]" />
            WhatsApp Connection Health
          </div>
          {whatsappConnection ? (
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">Connection Type</span>
                <span className="font-medium text-[#111827]">{whatsappConnection.connectionType}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Connection Mode</span>
                <span className="font-mono text-teal-700 font-bold">{whatsappConnection.connectionMode}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Connection Status</span>
                <span className="font-mono text-slate-800">{whatsappConnection.status}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Customer-Direct Meta Billing</span>
                <span className="font-medium text-slate-700">{whatsappConnection.billingStatus}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Webhook Readiness</span>
                <span className="font-medium text-slate-700">{whatsappConnection.webhookStatus}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Sender Verification</span>
                <span className="font-medium text-slate-700">{whatsappConnection.phoneVerificationStatus}</span>
              </div>
            </div>
          ) : (
            <div className="py-4 text-center text-xs text-slate-400">No WhatsApp connection configured.</div>
          )}
        </div>
      </div>

      {/* Queue & Message Activity */}
      <div className="bg-white p-5 rounded-xl border border-[#E5E7EB] shadow-sm space-y-4">
        <div className="flex items-center gap-2 font-bold text-sm text-[#111827] border-b border-slate-100 pb-3">
          <Activity className="w-4 h-4 text-[#0D9488]" />
          Automation Queue Telemetry (Workspace-Specific)
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider block">Queued</span>
            <span className="text-xl font-bold text-[#111827]">{queueStats?.queued || 0}</span>
          </div>
          <div className="p-3 bg-teal-50 rounded-lg border border-teal-200">
            <span className="text-teal-700 text-[10px] uppercase font-bold tracking-wider block">Processing</span>
            <span className="text-xl font-bold text-teal-900">{queueStats?.processing || 0}</span>
          </div>
          <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
            <span className="text-emerald-700 text-[10px] uppercase font-bold tracking-wider block">Simulated Sent</span>
            <span className="text-xl font-bold text-emerald-900">{queueStats?.sent || 0}</span>
          </div>
          <div className="p-3 bg-rose-50 rounded-lg border border-rose-200">
            <span className="text-rose-700 text-[10px] uppercase font-bold tracking-wider block">Failed / Blocked</span>
            <span className="text-xl font-bold text-rose-900">{queueStats?.failed || 0}</span>
          </div>
        </div>
      </div>

      {/* Audit Log for this Workspace */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        <div className="p-5 border-b border-[#E5E7EB] font-bold text-sm text-[#111827]">
          Recent Operational Audit Events for this Workspace
        </div>
        {recentAuditLogs && recentAuditLogs.length > 0 ? (
          <div className="divide-y divide-slate-100 text-xs">
            {recentAuditLogs.map((log) => (
              <div key={log.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50">
                <div>
                  <div className="font-semibold text-slate-800">{log.actionType}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    By {log.adminName} • Reason: {log.reason || 'N/A'}
                  </div>
                </div>
                <div className="text-right">
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {log.outcome}
                  </span>
                  <div className="text-[10px] text-slate-400 mt-1 font-mono">
                    {new Date(log.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-slate-400">
            No administrative audit events recorded for this workspace.
          </div>
        )}
      </div>

      {/* Action Modal */}
      {actionModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-sm text-[#111827]">
                {actionModal === 'suspend' ? 'Suspend Business Workspace' : 'Reactivate Business Workspace'}
              </h3>
              <button onClick={() => setActionModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAction} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Substantive Administrative Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={modalReason}
                  onChange={(e) => setModalReason(e.target.value)}
                  placeholder="Document reason for audit log..."
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:border-[#0D9488]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Operator Password</label>
                <input
                  type="password"
                  value={modalPassword}
                  onChange={(e) => setModalPassword(e.target.value)}
                  placeholder="Re-enter operator password..."
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:border-[#0D9488]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActionModal(null)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || modalReason.trim().length < 5}
                  className={`px-4 py-2 text-white font-medium rounded-lg ${
                    actionModal === 'suspend' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
                  } disabled:opacity-50`}
                >
                  {submitting ? 'Processing...' : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
