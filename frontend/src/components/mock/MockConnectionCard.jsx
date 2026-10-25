import React, { useState, useEffect } from 'react';
import {
  getMockStatus,
  toggleMockConnection,
  setupWorkspaceDemoData,
  resetWorkspaceDemoData,
  attemptLiveConnection,
} from '../../services/mockAutomation.js';

export default function MockConnectionCard({ onOpenInboundModal, onOpenTestConsole }) {
  const [statusData, setStatusData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const data = await getMockStatus();
      setStatusData(data);
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to load simulation connection status.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleToggle = async () => {
    if (!statusData) return;
    const nextStatus = statusData.status === 'MOCK_ACTIVE' ? 'MOCK_PAUSED' : 'MOCK_ACTIVE';
    try {
      setActionLoading(true);
      setMessage(null);
      setError(null);
      const updated = await toggleMockConnection(nextStatus);
      setStatusData((prev) => ({ ...prev, status: updated.status }));
      setMessage(`Mock simulator is now ${updated.status === 'MOCK_ACTIVE' ? 'Active' : 'Paused'}.`);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to update simulation state.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSetupDemo = async () => {
    try {
      setActionLoading(true);
      setMessage(null);
      setError(null);
      const res = await setupWorkspaceDemoData();
      setMessage(res.message || 'Sample demo data provisioned successfully!');
      await fetchStatus();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to setup demo data.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetDemo = async () => {
    if (!window.confirm('Reset synthetic demo records? Genuine business contacts and messages will NOT be touched.')) {
      return;
    }
    try {
      setActionLoading(true);
      setMessage(null);
      setError(null);
      const res = await resetWorkspaceDemoData();
      setMessage(res.message || 'Synthetic demo records cleaned up safely.');
      await fetchStatus();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to reset demo data.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLiveAttempt = async () => {
    try {
      await attemptLiveConnection();
    } catch (err) {
      setError(err?.response?.data?.message || 'Live connection blocked: Relay is running in safe Mock Mode.');
    }
  };

  if (loading && !statusData) {
    return (
      <div style={{ padding: '24px', background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E5E7EB', color: '#667085' }}>
        Loading WhatsApp simulation connection...
      </div>
    );
  }

  const isMockActive = statusData?.status === 'MOCK_ACTIVE';

  return (
    <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E5E7EB', padding: '24px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      {/* Top Banner Notice */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: '#F0FDFA', border: '1px solid #CCFBF1', borderRadius: '8px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#0D9488' }} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#0F766E' }}>
            MOCK MODE ACTIVE — No real WhatsApp messages are sent.
          </span>
        </div>
        <span style={{ fontSize: '12px', color: '#14B8A6', fontWeight: 500 }}>
          Simulation Sandbox
        </span>
      </div>

      {message && (
        <div style={{ padding: '10px 14px', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '6px', color: '#065F46', fontSize: '13px', marginBottom: '16px' }}>
          {message}
        </div>
      )}

      {error && (
        <div style={{ padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px', color: '#991B1B', fontSize: '13px', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {/* Main Connection Status Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#111827' }}>
              WhatsApp Provider Connection
            </h3>
            <span style={{
              display: 'inline-block',
              padding: '2px 10px',
              borderRadius: '999px',
              fontSize: '12px',
              fontWeight: 600,
              background: isMockActive ? '#D1FAE5' : '#FEF3C7',
              color: isMockActive ? '#065F46' : '#92400E',
            }}>
              {statusData?.status || 'MOCK_ACTIVE'}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '13px', color: '#667085' }}>
            Workspace: <strong style={{ color: '#111827' }}>{statusData?.workspaceName}</strong> ({statusData?.industry}) • Sender ID:{' '}
            <code style={{ background: '#F3F4F6', padding: '2px 6px', borderRadius: '4px', fontSize: '12px', color: '#374151' }}>
              {statusData?.senderIdentifier}
            </code>
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleToggle}
            disabled={actionLoading}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid #D1D5DB',
              background: '#FFFFFF',
              color: '#374151',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {isMockActive ? 'Pause Simulator' : 'Resume Simulator'}
          </button>
          <button
            onClick={handleLiveAttempt}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid #E5E7EB',
              background: '#F9FAFB',
              color: '#9CA3AF',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'not-allowed',
            }}
            title="Official Meta Cloud API connection is guarded in Prompt 8"
          >
            Connect Live WhatsApp (Disabled)
          </button>
        </div>
      </div>

      {/* Simulated Operational Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '22px' }}>
        <div style={{ padding: '14px', background: '#F9FAFB', borderRadius: '8px', border: '1px solid #E5E7EB' }}>
          <div style={{ fontSize: '12px', color: '#667085', marginBottom: '4px' }}>Simulated Messages</div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#111827' }}>{statusData?.metrics?.totalSimulatedMessages || 0}</div>
          <div style={{ fontSize: '11px', color: '#0D9488', marginTop: '2px' }}>Sent: {statusData?.metrics?.simulatedSent || 0} • Delivered: {statusData?.metrics?.simulatedDelivered || 0}</div>
        </div>

        <div style={{ padding: '14px', background: '#F9FAFB', borderRadius: '8px', border: '1px solid #E5E7EB' }}>
          <div style={{ fontSize: '12px', color: '#667085', marginBottom: '4px' }}>Simulated Inquiries</div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#111827' }}>{statusData?.metrics?.inboundSimulatedCount || 0}</div>
          <div style={{ fontSize: '11px', color: '#667085', marginTop: '2px' }}>Two-way customer replies</div>
        </div>

        <div style={{ padding: '14px', background: '#F9FAFB', borderRadius: '8px', border: '1px solid #E5E7EB' }}>
          <div style={{ fontSize: '12px', color: '#667085', marginBottom: '4px' }}>Auto-Replies Triggered</div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#111827' }}>{statusData?.metrics?.autoRepliesExecuted || 0}</div>
          <div style={{ fontSize: '11px', color: '#667085', marginTop: '2px' }}>Industry keyword matches</div>
        </div>

        <div style={{ padding: '14px', background: '#F9FAFB', borderRadius: '8px', border: '1px solid #E5E7EB' }}>
          <div style={{ fontSize: '12px', color: '#667085', marginBottom: '4px' }}>Simulated Contacts</div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#111827' }}>{statusData?.metrics?.demoContactsCount || 0}</div>
          <div style={{ fontSize: '11px', color: '#667085', marginTop: '2px' }}>Synthetic test recipients</div>
        </div>
      </div>

      {/* Action Buttons for Demo & Testing */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', paddingTop: '16px', borderTop: '1px solid #F3F4F6' }}>
        <button
          onClick={handleSetupDemo}
          disabled={actionLoading}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            background: '#0D9488',
            color: '#FFFFFF',
            border: 'none',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {actionLoading ? 'Setting up...' : 'Setup Sample Demo'}
        </button>

        {onOpenInboundModal && (
          <button
            onClick={onOpenInboundModal}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              background: '#FFFFFF',
              color: '#0D9488',
              border: '1px solid #0D9488',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Simulate Inbound Message
          </button>
        )}

        {onOpenTestConsole && (
          <button
            onClick={onOpenTestConsole}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              background: '#FFFFFF',
              color: '#374151',
              border: '1px solid #D1D5DB',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Automation Test Console
          </button>
        )}

        <button
          onClick={handleResetDemo}
          disabled={actionLoading}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            background: '#FFFFFF',
            color: '#DC2626',
            border: '1px solid #FCA5A5',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            marginLeft: 'auto',
          }}
        >
          Reset Demo Data
        </button>
      </div>
    </div>
  );
}
