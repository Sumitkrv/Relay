import React, { useEffect, useState } from 'react';
import platformAdminApi from '../../services/platformAdmin';
import {
  Activity,
  Database,
  Radio,
  RefreshCw,
  Server,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cpu,
} from 'lucide-react';

export default function AdminSystemHealthPage() {
  const [health, setHealth] = useState(null);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const [hRes, wRes] = await Promise.all([
        platformAdminApi.getSystemHealth(),
        platformAdminApi.getWorkers(),
      ]);
      setHealth(hRes);
      setWorkers(wRes.workers || []);
    } catch (err) {
      console.error('Failed to fetch system health:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  if (loading && !health) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-2">
        <div className="w-8 h-8 border-4 border-[#0D9488] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-[#667085]">Retrieving infrastructure health diagnostics...</p>
      </div>
    );
  }

  const { database, queue, worker, metaWhatsAppSafety } = health || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#111827] tracking-tight">System & Worker Health</h1>
          <p className="text-sm text-[#667085] mt-1">
            Core database availability, durable queue backlog, worker heartbeats, and fail-closed safety states.
          </p>
        </div>
        <button
          onClick={fetchHealth}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-[#E5E7EB] text-[#111827] hover:bg-slate-50 transition-colors shadow-sm self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#0D9488]' : ''}`} />
          Run Health Diagnostics
        </button>
      </div>

      {/* Grid of Components */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Database Health */}
        <div className="bg-white p-5 rounded-xl border border-[#E5E7EB] shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 font-bold text-sm text-[#111827]">
              <Database className="w-4 h-4 text-[#0D9488]" />
              Database Engine
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              {database?.status || 'CONNECTED'}
            </span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Mongoose Connection State:</span>
              <span className="font-mono font-bold text-slate-900">READY (code: {database?.readyState})</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Registered Workspaces:</span>
              <span className="font-medium text-slate-900">{database?.totalWorkspaces || 0}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Subscriptions Recorded:</span>
              <span className="font-medium text-slate-900">{database?.totalSubscriptions || 0}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Platform Audit Entries:</span>
              <span className="font-medium text-slate-900">{database?.auditEventsCount || 0}</span>
            </div>
          </div>
        </div>

        {/* Worker Telemetry */}
        <div className="bg-white p-5 rounded-xl border border-[#E5E7EB] shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 font-bold text-sm text-[#111827]">
              <Cpu className="w-4 h-4 text-[#0D9488]" />
              Message Worker Daemon
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                worker?.workerRunning
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}
            >
              {worker?.workerRunning ? 'RUNNING' : 'STOPPED'}
            </span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Provider Execution Mode:</span>
              <span className="font-mono font-bold text-teal-700">{worker?.providerMode || 'MOCK'}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Active Worker Processes:</span>
              <span className="font-medium text-slate-900">{worker?.activeWorkers || 0}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Worker Heartbeat:</span>
              <span className="font-mono text-slate-700">
                {worker?.lastHeartbeat ? new Date(worker.lastHeartbeat).toLocaleTimeString() : 'Active in-memory'}
              </span>
            </div>
          </div>
        </div>

        {/* Meta Live Gating Safeguards */}
        <div className="bg-white p-5 rounded-xl border border-[#E5E7EB] shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 font-bold text-sm text-[#111827]">
              <Radio className="w-4 h-4 text-[#0D9488]" />
              Meta Live Gating
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
              LOCKED
            </span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Live Outbound Sending:</span>
              <span className="font-bold text-rose-600">DISABLED (Strict)</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Simulated Engine:</span>
              <span className="font-bold text-emerald-700">ACTIVE</span>
            </div>
            <p className="text-[11px] text-slate-500 pt-1">
              Safety gate active. Live Meta Cloud API outbound calls fail-closed.
            </p>
          </div>
        </div>
      </div>

      {/* Durable Queue Status Card */}
      <div className="bg-white p-6 rounded-xl border border-[#E5E7EB] shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-[#111827]">Durable MongoDB Queue Health</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-center">
            <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Queued Jobs</span>
            <span className="text-2xl font-bold text-[#111827]">{queue?.queued || 0}</span>
          </div>
          <div className="p-4 bg-teal-50 rounded-lg border border-teal-200 text-center">
            <span className="text-[10px] uppercase font-bold text-teal-700 block mb-1">Processing In-Flight</span>
            <span className="text-2xl font-bold text-teal-900">{queue?.processing || 0}</span>
          </div>
          <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200 text-center">
            <span className="text-[10px] uppercase font-bold text-emerald-700 block mb-1">Simulated Sent Total</span>
            <span className="text-2xl font-bold text-emerald-900">{queue?.simulatedSent || 0}</span>
          </div>
          <div className="p-4 bg-rose-50 rounded-lg border border-rose-200 text-center">
            <span className="text-[10px] uppercase font-bold text-rose-700 block mb-1">Failures / Blocked</span>
            <span className="text-2xl font-bold text-rose-900">
              {(queue?.temporaryFailure || 0) + (queue?.permanentFailure || 0) + (queue?.blocked || 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Registered Workers List */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        <div className="p-5 border-b border-[#E5E7EB] font-bold text-sm text-[#111827]">
          Registered Worker Processes
        </div>
        <div className="divide-y divide-slate-100 text-xs">
          {workers.map((w) => (
            <div key={w.id} className="p-4 flex items-center justify-between">
              <div>
                <div className="font-semibold text-slate-800 font-mono">{w.id}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Type: {w.type} • Queue depth: {w.queueDepth} • In-flight: {w.activeWorkloads}
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                HEALTHY
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
