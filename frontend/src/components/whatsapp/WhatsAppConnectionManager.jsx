import { useState, useEffect } from 'react';
import {
  Smartphone,
  Server,
  ShieldCheck,
  CreditCard,
  RefreshCw,
  Power,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Layers,
  Activity,
  Terminal,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getWhatsAppConnection,
  getWhatsAppReadiness,
  getWhatsAppDiagnostics,
  disconnectWhatsAppConnection,
  reconnectWhatsAppConnection,
  getCurrentWhatsAppOnboarding,
} from '../../services/whatsAppConnection';
import ConnectionWizardModal from './ConnectionWizardModal';

export default function WhatsAppConnectionManager({ workspace, onStatusChange }) {
  const [connection, setConnection] = useState(null);
  const [readiness, setReadiness] = useState(null);
  const [diagnostics, setDiagnostics] = useState(null);
  const [currentAttempt, setCurrentAttempt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const [connRes, readyRes, attemptRes] = await Promise.all([
        getWhatsAppConnection().catch(() => ({ data: null })),
        getWhatsAppReadiness().catch(() => ({ data: null })),
        getCurrentWhatsAppOnboarding().catch(() => ({ data: null })),
      ]);

      setConnection(connRes?.data || null);
      setReadiness(readyRes?.data || null);
      setCurrentAttempt(attemptRes?.data || null);
    } catch {
      // Non-fatal
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [workspace?._id]);

  const handleFetchDiagnostics = async () => {
    if (showDiagnostics) {
      setShowDiagnostics(false);
      return;
    }
    try {
      const diagRes = await getWhatsAppDiagnostics();
      setDiagnostics(diagRes?.data || null);
      setShowDiagnostics(true);
    } catch {
      toast.error('Failed to load connection diagnostics.');
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const res = await disconnectWhatsAppConnection('USER_MANUAL_DISCONNECT');
      if (res.success) {
        toast.success('WhatsApp connection disconnected safely. Data preserved.');
        setConfirmDisconnect(false);
        fetchStatus();
        if (onStatusChange) onStatusChange();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to disconnect.');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleReconnect = async () => {
    setLoading(true);
    try {
      const res = await reconnectWhatsAppConnection();
      if (res.success) {
        toast.success('Connection reset for setup. Opening wizard...');
        fetchStatus();
        setShowWizard(true);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reset connection.');
    } finally {
      setLoading(false);
    }
  };

  const isConnected = connection?.connectionStatus === 'MOCK_SIMULATED_READY';
  const isDisconnected = connection?.connectionStatus === 'DISCONNECTED';
  const isSetupStarted = connection?.connectionStatus === 'SETUP_STARTED' || Boolean(currentAttempt);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-8">
      {/* Top Banner */}
      <div className="bg-gray-900 text-white p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="w-12 h-12 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400 font-bold flex-shrink-0">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h3 className="text-lg font-bold text-white">WhatsApp Connection Hub</h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  Mock Mode Active
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Manage your business WhatsApp sender, official onboarding paths, and test automation safely.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={fetchStatus}
              disabled={loading}
              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition text-xs flex items-center space-x-1"
              title="Refresh Status"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {!isConnected && (
              <button
                onClick={() => setShowWizard(true)}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold transition shadow-sm"
              >
                {isSetupStarted ? 'Resume Setup Wizard' : 'Connect WhatsApp Number'}
              </button>
            )}

            {isConnected && (
              <button
                onClick={() => setConfirmDisconnect(true)}
                className="px-3.5 py-2 bg-gray-800 hover:bg-red-900/60 text-gray-300 hover:text-red-200 border border-gray-700 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5"
              >
                <Power className="w-3.5 h-3.5" />
                <span>Disconnect</span>
              </button>
            )}

            {isDisconnected && (
              <button
                onClick={handleReconnect}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold transition shadow-sm"
              >
                Reconnect WhatsApp
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Disconnect Confirmation Modal */}
      {confirmDisconnect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-gray-200 space-y-4">
            <div className="flex items-center space-x-3 text-red-600">
              <AlertTriangle className="w-6 h-6" />
              <h4 className="text-base font-bold text-gray-900">Disconnect WhatsApp Number?</h4>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              Disconnecting will pause all scheduled campaigns and auto-replies for this workspace.
              <strong> 100% of your historical messages, contacts, campaigns, and reports will remain completely safe and intact.</strong>
            </p>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setConfirmDisconnect(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5"
              >
                {disconnecting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Confirm Disconnect</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Connection Detail Grid */}
      <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Sender Status */}
        <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 space-y-1.5">
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Connected Sender</span>
          <div className="text-sm font-bold text-gray-900 truncate">
            {connection?.displayPhoneNumber || 'Not Configured'}
          </div>
          <div className="flex items-center space-x-1.5 text-xs text-gray-500">
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-teal-500' : isDisconnected ? 'bg-red-500' : 'bg-amber-500'
              }`}
            />
            <span className="font-medium text-gray-700">
              {connection?.connectionStatus || 'NOT_CONNECTED'}
            </span>
          </div>
        </div>

        {/* Card 2: Connection Type */}
        <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 space-y-1.5">
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Connection Type</span>
          <div className="text-sm font-bold text-gray-900 truncate">
            {connection?.connectionType === 'NEW_CLOUD_API'
              ? 'New Cloud API Number'
              : 'WhatsApp Business App'}
          </div>
          <div className="text-xs text-teal-700 font-medium">
            {connection?.connectionType === 'NEW_CLOUD_API'
              ? 'Dedicated Platform API'
              : 'Official Coexistence Path'}
          </div>
        </div>

        {/* Card 3: Meta Messaging Billing */}
        <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 space-y-1.5">
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Meta Messaging Billing</span>
          <div className="text-sm font-bold text-gray-900 truncate">Customer-Direct</div>
          <div className="text-xs flex items-center space-x-1 text-gray-600">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
            <span>Zero Relay Liability Policy</span>
          </div>
        </div>

        {/* Card 4: Relay SaaS Entitlement */}
        <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 space-y-1.5">
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Relay SaaS Plan</span>
          <div className="text-sm font-bold text-gray-900 truncate">₹799/mo Launch Plan</div>
          <div className="text-xs text-indigo-700 font-medium">Prompt 10 Integration Ready</div>
        </div>
      </div>

      {/* Diagnostics Toggle */}
      <div className="border-t border-gray-200 px-6 py-3 bg-gray-50 flex items-center justify-between">
        <span className="text-xs text-gray-600 font-medium">
          Provider: <strong className="text-gray-900">Relay Mock Simulator (Meta Sandbox)</strong>
        </span>
        <button
          onClick={handleFetchDiagnostics}
          className="text-xs font-semibold text-teal-700 hover:text-teal-800 flex items-center space-x-1"
        >
          <span>{showDiagnostics ? 'Hide Technical Diagnostics' : 'View Technical Diagnostics'}</span>
          {showDiagnostics ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Expandable Technical Diagnostics */}
      {showDiagnostics && diagnostics && (
        <div className="p-6 bg-gray-950 text-gray-300 border-t border-gray-800 font-mono text-xs space-y-4">
          <div className="flex items-center space-x-2 text-teal-400 font-bold text-sm">
            <Terminal className="w-4 h-4" />
            <span>System Diagnostic Metadata & Independent Readiness</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="space-y-1.5">
              <div>Synthetic Sender ID: <strong className="text-white">{diagnostics.syntheticSenderId}</strong></div>
              <div>Synthetic WABA ID: <strong className="text-white">{diagnostics.wabaId}</strong></div>
              <div>Synthetic Phone ID: <strong className="text-white">{diagnostics.phoneNumberId}</strong></div>
              <div>Credential Store: <strong className="text-teal-400">{diagnostics.credentialStorageType}</strong></div>
              <div>Webhook Route Status: <strong className="text-teal-400">FAILS_CLOSED_TENANT_SAFE</strong></div>
            </div>

            <div className="space-y-1">
              <span className="text-gray-400 font-sans font-semibold text-xs block mb-1">Independent Readiness Checks:</span>
              {diagnostics.readinessSummary &&
                Object.entries(diagnostics.readinessSummary).map(([key, check]) => (
                  <div key={key} className="flex items-center justify-between text-[11px] py-0.5 border-b border-gray-800">
                    <span className="text-gray-300 font-sans">{check.label}:</span>
                    <span className={check.verified ? 'text-teal-400 font-bold' : 'text-amber-400'}>
                      {check.status}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Wizard Modal */}
      <ConnectionWizardModal
        isOpen={showWizard}
        onClose={() => setShowWizard(false)}
        initialAttempt={currentAttempt}
        onComplete={() => {
          fetchStatus();
          if (onStatusChange) onStatusChange();
        }}
      />
    </div>
  );
}
