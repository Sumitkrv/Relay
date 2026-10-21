import React, { useState } from 'react';
import { simulateInboundMessage } from '../../services/mockAutomation.js';

export default function InboundSimulatorModal({ isOpen, onClose, onComplete }) {
  const [customerName, setCustomerName] = useState('Rahul Test');
  const [phoneNumber, setPhoneNumber] = useState('+919876543210');
  const [messageBody, setMessageBody] = useState('BROCHURE');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const quickPresets = ['BROCHURE', 'PRICE', 'TRIAL', 'SERVICES', 'TIMINGS', 'STOP'];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!messageBody.trim()) {
      setError('Please provide message text.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setResult(null);

      const res = await simulateInboundMessage({
        contactPhone: phoneNumber,
        contactName: customerName,
        messageBody: messageBody.trim(),
      });

      setResult(res);
      if (onComplete) onComplete(res);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to simulate inbound message.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(17, 24, 39, 0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px',
    }}>
      <div style={{
        background: '#FFFFFF',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '560px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        border: '1px solid #E5E7EB',
        padding: '24px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#111827' }}>
              Simulate Inbound WhatsApp Message
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#667085' }}>
              Simulates a customer sending a message to this business workspace.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              color: '#9CA3AF',
            }}
          >
            ×
          </button>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px', color: '#991B1B', fontSize: '13px', marginBottom: '14px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                Sender Name
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #D1D5DB',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                Sender Phone (E.164)
              </label>
              <input
                type="text"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #D1D5DB',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
              Quick Keyword Presets
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {quickPresets.map((kw) => (
                <button
                  type="button"
                  key={kw}
                  onClick={() => setMessageBody(kw)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid #E5E7EB',
                    background: messageBody === kw ? '#0D9488' : '#F9FAFB',
                    color: messageBody === kw ? '#FFFFFF' : '#374151',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {kw}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
              Simulated Message Body
            </label>
            <textarea
              rows={3}
              value={messageBody}
              onChange={(e) => setMessageBody(e.target.value)}
              placeholder="e.g. Can I get a brochure for your project?"
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #D1D5DB',
                fontSize: '13px',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
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
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '8px 20px',
                borderRadius: '8px',
                border: 'none',
                background: '#0D9488',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {loading ? 'Simulating...' : 'Send Simulated Inbound'}
            </button>
          </div>
        </form>

        {result && (
          <div style={{ marginTop: '20px', padding: '16px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>
              Simulation Outcome:
            </div>

            {result.autoReply ? (
              <div style={{ padding: '10px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '6px', marginBottom: '10px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#166534', marginBottom: '4px' }}>
                  Auto-Reply Triggered ({result.autoReply.ruleName})
                </div>
                <div style={{ fontSize: '13px', color: '#14532D', whiteSpace: 'pre-wrap' }}>
                  {result.autoReply.responseBody}
                </div>
              </div>
            ) : result.suppressionOutcome === 'OPTED_OUT' ? (
              <div style={{ padding: '10px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px', marginBottom: '10px', color: '#991B1B', fontSize: '13px' }}>
                <strong>Opt-Out Suppression:</strong> Contact has been successfully opted out. All future promotional sends are blocked.
              </div>
            ) : (
              <div style={{ padding: '10px', background: '#F1F5F9', borderRadius: '6px', color: '#475569', fontSize: '13px', marginBottom: '10px' }}>
                No active auto-reply rule matched keyword "{messageBody}". Message logged to Inbox conversation.
              </div>
            )}

            {result.trace && result.trace.length > 0 && (
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px', textTransform: 'uppercase' }}>
                  Execution Trace
                </div>
                <div style={{ background: '#0F172A', color: '#F8FAFC', padding: '8px 12px', borderRadius: '6px', fontSize: '11px', fontFamily: 'monospace' }}>
                  {result.trace.map((step, idx) => (
                    <div key={idx}>› {step}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
