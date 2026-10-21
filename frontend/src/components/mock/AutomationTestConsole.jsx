import React, { useState } from 'react';
import { dryRunAutomationTest } from '../../services/mockAutomation.js';

export default function AutomationTestConsole({ isOpen, onClose }) {
  const [testMessage, setTestMessage] = useState('BROCHURE');
  const [evaluating, setEvaluating] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const presets = ['BROCHURE', 'PRICE', 'TRIAL', 'SERVICES', 'HOURS', 'APPOINTMENT', 'STOP'];

  const handleTest = async (e) => {
    e?.preventDefault();
    if (!testMessage.trim()) return;

    try {
      setEvaluating(true);
      setError(null);
      const res = await dryRunAutomationTest({
        messageBody: testMessage.trim(),
      });
      setResult(res);
    } catch (err) {
      setError(err?.response?.data?.message || 'Automation test evaluation failed.');
    } finally {
      setEvaluating(false);
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
        maxWidth: '620px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        border: '1px solid #E5E7EB',
        padding: '24px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#111827' }}>
              Automation Rule Test Console
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#667085' }}>
              Test keyword triggers and response templating safely with zero side effects.
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

        <form onSubmit={handleTest}>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
              Suggested Keyword Test Cases
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {presets.map((p) => (
                <button
                  type="button"
                  key={p}
                  onClick={() => setTestMessage(p)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid #E5E7EB',
                    background: testMessage === p ? '#0D9488' : '#F9FAFB',
                    color: testMessage === p ? '#FFFFFF' : '#374151',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
              Simulated Customer Input
            </label>
            <input
              type="text"
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              placeholder="e.g. Please share brochure details"
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid #D1D5DB',
                fontSize: '14px',
                boxSizing: 'border-box',
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
              Close
            </button>
            <button
              type="submit"
              disabled={evaluating}
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
              {evaluating ? 'Evaluating...' : 'Run Test Evaluation'}
            </button>
          </div>
        </form>

        {result && (
          <div style={{ marginTop: '20px', padding: '16px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                Evaluation Results
              </span>
              <span style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '999px',
                background: result.matchFound ? '#DCFCE7' : result.suppressionOutcome ? '#FEE2E2' : '#F1F5F9',
                color: result.matchFound ? '#166534' : result.suppressionOutcome ? '#991B1B' : '#475569',
              }}>
                {result.matchFound ? 'MATCH FOUND' : result.suppressionOutcome ? 'COMPLIANCE OPT-OUT' : 'NO MATCH'}
              </span>
            </div>

            {result.matchFound && result.matchedRule && (
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '2px' }}>
                  Triggered Rule: <strong style={{ color: '#0F172A' }}>{result.matchedRule.name}</strong> (Priority: {result.matchedRule.priority})
                </div>
                <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '8px' }}>
                  Matched Keyword: <code style={{ background: '#E2E8F0', padding: '1px 5px', borderRadius: '4px', color: '#0F172A' }}>{result.triggeredKeyword}</code>
                </div>

                <div style={{ fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Rendered WhatsApp Response:
                </div>
                <div style={{
                  padding: '12px',
                  background: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  borderRadius: '6px',
                  fontSize: '13px',
                  color: '#1E293B',
                  whiteSpace: 'pre-wrap',
                }}>
                  {result.renderedReply}
                </div>
              </div>
            )}

            {result.suppressionOutcome === 'OPTED_OUT' && (
              <div style={{ padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px', color: '#991B1B', fontSize: '13px', marginBottom: '12px' }}>
                <strong>Opt-Out Protection:</strong> This message triggered a compliance STOP keyword. No marketing response will be sent, and the contact will be suppressed.
              </div>
            )}

            {result.trace && result.trace.length > 0 && (
              <div style={{ marginTop: '12px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px', textTransform: 'uppercase' }}>
                  Execution Evaluation Trace
                </div>
                <div style={{ background: '#0F172A', color: '#F8FAFC', padding: '10px 12px', borderRadius: '6px', fontSize: '11px', fontFamily: 'monospace' }}>
                  {result.trace.map((t, idx) => (
                    <div key={idx} style={{ marginBottom: '2px' }}>› {t}</div>
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
