import React, { useState, useEffect } from 'react';
import { X, Clock, CheckCircle2, AlertTriangle, ShieldAlert, RotateCcw, Ban, Send, FileText } from 'lucide-react';
import { getMessageEvents } from '../services/messages';

export default function MessageEventsModal({ isOpen = true, onClose, message }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !message?._id) return;
    setLoading(true);
    setError(null);

    getMessageEvents(message._id)
      .then(({ data }) => setEvents(data.records || []))
      .catch((err) => setError(err.response?.data?.message || err.message))
      .finally(() => setLoading(false));

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, message?._id, onClose]);

  if (!isOpen || !message) return null;

  const eventIcon = (type) => {
    switch (type) {
      case 'MESSAGE_CREATED':
      case 'MESSAGE_QUEUED':
        return <FileText size={14} style={{ color: 'var(--color-primary)' }} />;
      case 'PROCESSING_STARTED':
        return <Clock size={14} style={{ color: '#0284c7' }} />;
      case 'MOCK_SEND_SUCCEEDED':
      case 'MESSAGE_COMPLETED':
        return <CheckCircle2 size={14} style={{ color: '#059669' }} />;
      case 'MOCK_SEND_FAILED':
        return <AlertTriangle size={14} style={{ color: '#dc2626' }} />;
      case 'RETRY_SCHEDULED':
        return <RotateCcw size={14} style={{ color: '#d97706' }} />;
      case 'MESSAGE_BLOCKED':
        return <ShieldAlert size={14} style={{ color: '#475569' }} />;
      case 'MESSAGE_CANCELLED':
        return <Ban size={14} style={{ color: '#64748b' }} />;
      default:
        return <Clock size={14} style={{ color: 'var(--color-text-muted)' }} />;
    }
  };

  return (
    <div className="modal-scrim" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="message-events-title">
      <div className="modal-card" style={{ maxWidth: '620px', width: '92%' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
          <div>
            <span className="page-header-eyebrow">LIFECYCLE AUDIT TRAIL</span>
            <h3 id="message-events-title" style={{ margin: '4px 0 0', fontSize: '16px', fontWeight: 600 }}>
              Message Execution Audit Trail · {message.messageId}
            </h3>
          </div>
          <button className="icon-btn modal-close" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: '20px', maxHeight: '70vh', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--color-text-muted)', fontSize: '13px' }}>
              Loading lifecycle audit events…
            </div>
          ) : error ? (
            <div style={{ padding: '12px 14px', borderRadius: '8px', background: '#fef2f2', color: '#991b1b', fontSize: '12.5px' }}>
              Failed to load audit events: {error}
            </div>
          ) : events.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--color-text-muted)', fontSize: '13px' }}>
              No audit events recorded for this message yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative' }}>
              {events.map((ev, idx) => (
                <div
                  key={ev._id || idx}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '12px 14px',
                    background: 'var(--color-surface-muted)',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border)',
                    fontSize: '12.5px'
                  }}
                >
                  <div style={{ marginTop: '2px' }}>{eventIcon(ev.eventType)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        {ev.eventType.replaceAll('_', ' ')}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                        {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                    <div style={{ color: 'var(--color-text-muted)', fontSize: '11.5px', marginBottom: '4px' }}>
                      Transition: <code>{ev.previousStatus || 'INIT'}</code> → <b>{ev.newStatus}</b>
                      {ev.source && ` · via ${ev.source}`}
                      {ev.attemptNumber && ` · attempt #${ev.attemptNumber}`}
                    </div>
                    {ev.safeMetadata && Object.keys(ev.safeMetadata).length > 0 && (
                      <pre style={{
                        margin: '6px 0 0',
                        padding: '6px 8px',
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '4px',
                        fontSize: '11px',
                        color: 'var(--color-text-primary)',
                        overflowX: 'auto',
                        whiteSpace: 'pre-wrap'
                      }}>
                        {JSON.stringify(ev.safeMetadata, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
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
