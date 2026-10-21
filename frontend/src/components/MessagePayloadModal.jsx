import React, { useEffect } from 'react';
import { X, CheckCircle2, AlertTriangle, ShieldAlert, Clock, Smartphone, MessageSquare } from 'lucide-react';

export default function MessagePayloadModal({ isOpen = true, onClose, message }) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !message) return null;

  const snapshot = message.renderedContentSnapshot || {};
  const isFailed = ['TEMPORARY_FAILURE', 'PERMANENT_FAILURE'].includes(message.status);
  const isBlocked = message.status === 'BLOCKED';
  const isSent = ['SIMULATED_SENT', 'SIMULATED_DELIVERED', 'SIMULATED_READ'].includes(message.status);

  return (
    <div className="modal-scrim" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="message-payload-title">
      <div className="modal-card" style={{ maxWidth: '580px', width: '92%' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
          <div>
            <span className="page-header-eyebrow">DURABLE MESSAGE SNAPSHOT</span>
            <h3 id="message-payload-title" style={{ margin: '4px 0 0', fontSize: '16px', fontWeight: 600 }}>
              {message.recipientName || message.contactId?.fullName || 'Prospect Recipient'} · {message.recipientPhone || message.contactId?.phoneNumber}
            </h3>
          </div>
          <button className="icon-btn modal-close" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '75vh', overflowY: 'auto' }}>
          {/* Header Status Badges */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className={`status-badge ${message.status.toLowerCase().replace('_', '-')}`} style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {message.status.replace('_', ' ')}
              </span>
              <span style={{ fontSize: '11.5px', padding: '3px 8px', borderRadius: '4px', background: 'var(--color-primary-soft)', color: 'var(--color-primary)', fontWeight: 600 }}>
                MOCK SIMULATION
              </span>
            </div>
            <span style={{ fontSize: '11.5px', color: 'var(--color-text-muted)' }}>
              Attempt #{message.attemptCount || 1}
            </span>
          </div>

          {/* Failure Alert Banner if Blocked or Failed */}
          {(isFailed || isBlocked) && (
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              padding: '12px 14px',
              borderRadius: '8px',
              background: isBlocked ? 'var(--color-surface-muted)' : '#fef2f2',
              border: isBlocked ? '1px solid var(--color-border)' : '1px solid #fecaca',
              color: isBlocked ? 'var(--color-text-primary)' : '#991b1b',
              fontSize: '12.5px'
            }}>
              {isBlocked ? <ShieldAlert size={16} style={{ flexShrink: 0, marginTop: '2px' }} /> : <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px', color: '#dc2626' }} />}
              <div>
                <b>{message.failureCode || (isBlocked ? 'ELIGIBILITY_BLOCKED' : 'SEND_FAILED')}:</b> {message.failureReason || 'Failed to dispatch during processing.'}
              </div>
            </div>
          )}

          {/* WhatsApp Rendered Message Bubble */}
          <div style={{
            background: 'var(--color-surface-muted)',
            borderRadius: '12px',
            padding: '16px',
            border: '1px solid var(--color-border)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', fontSize: '11px', color: 'var(--color-text-muted)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Smartphone size={13} /> WhatsApp Message Snapshot
              </span>
              <span>TEMPLATE PREVIEW · NOT SENT</span>
            </div>

            <div style={{
              background: '#ffffff',
              borderRadius: '10px 10px 10px 2px',
              padding: '14px 16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              border: '1px solid #e2e8f0',
              color: 'var(--color-text-primary)',
              fontSize: '13.5px',
              lineHeight: 1.55
            }}>
              {snapshot.header && (
                <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '8px', color: 'var(--color-text-primary)' }}>
                  {snapshot.header}
                </div>
              )}

              {snapshot.headerType && snapshot.headerType !== 'NONE' && snapshot.headerType !== 'TEXT' && (
                <div style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  background: 'var(--color-surface-muted)',
                  fontSize: '12px',
                  color: 'var(--color-text-muted)',
                  marginBottom: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  📎 [{snapshot.headerType}] {snapshot.mediaName || 'Attached Media Header'}
                </div>
              )}

              <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {snapshot.body || message.renderedContentSnapshot?.body || 'No message body snapshot.'}
              </div>

              {snapshot.footer && (
                <div style={{ marginTop: '8px', fontSize: '11.5px', color: 'var(--color-text-muted)', borderTop: '1px dashed #e2e8f0', paddingTop: '6px' }}>
                  {snapshot.footer}
                </div>
              )}
            </div>

            {/* Interactive Buttons */}
            {snapshot.buttons?.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                {snapshot.buttons.map((btn, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      textAlign: 'center',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      color: 'var(--color-primary)'
                    }}
                  >
                    {btn.text || btn.label}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Metadata Breakdown */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', fontSize: '12px' }}>
            <div>
              <span style={{ color: 'var(--color-text-muted)' }}>Message ID:</span>
              <div style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--color-text-primary)' }}>{message.messageId}</div>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-muted)' }}>Provider Message ID:</span>
              <div style={{ fontFamily: 'monospace', color: message.providerMessageId ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
                {message.providerMessageId || '—'}
              </div>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-muted)' }}>Queued At:</span>
              <div>{message.queuedAt ? new Date(message.queuedAt).toLocaleString() : '—'}</div>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-muted)' }}>Simulated Sent At:</span>
              <div>{message.simulatedSentAt ? new Date(message.simulatedSentAt).toLocaleString() : '—'}</div>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Idempotency Key:</span>
              <div style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--color-text-primary)', wordBreak: 'break-all' }}>
                {message.idempotencyKey || '—'}
              </div>
            </div>
          </div>
        </div>

        <div className="modal-foot" style={{ padding: '14px 20px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="outline-btn small" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
