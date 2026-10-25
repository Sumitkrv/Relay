import React, { useState, useEffect } from 'react';
import { Mail, RefreshCw, Trash2, ExternalLink, CheckCircle, Clock, ShieldAlert, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function DevMailboxPage() {
  const [emails, setEmails] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('ALL');

  const fetchEmails = async () => {
    try {
      setLoading(true);
      const res = await api.get('/dev/mailbox');
      const list = res.data?.emails || [];
      setEmails(list);
      if (list.length > 0 && !selectedEmail) {
        setSelectedEmail(list[0]);
      } else if (list.length === 0) {
        setSelectedEmail(null);
      }
    } catch (err) {
      toast.error('Failed to fetch development mailbox: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmails();
  }, []);

  const handleClear = async () => {
    if (!window.confirm('Clear all intercepted emails from the local demo mailbox?')) return;
    try {
      await api.delete('/dev/mailbox');
      setEmails([]);
      setSelectedEmail(null);
      toast.success('Local mailbox cleared');
    } catch (err) {
      toast.error('Failed to clear mailbox: ' + err.message);
    }
  };

  const filteredEmails = emails.filter((item) => {
    if (filterType === 'ALL') return true;
    return item.emailType === filterType;
  });

  return (
    <div style={{ minHeight: '100vh', background: '#0F172A', color: '#F8FAFC', fontFamily: 'Inter, sans-serif', padding: '24px 32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid #334155', paddingBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link to="/app" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94A3B8', textDecoration: 'none', fontSize: '14px', background: '#1E293B', padding: '6px 12px', borderRadius: '6px', border: '1px solid #334155' }}>
            <ArrowLeft size={16} /> Back to Dashboard
          </Link>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ background: '#10B981', color: '#0F172A', padding: '6px', borderRadius: '8px', display: 'flex' }}>
                <Mail size={20} />
              </div>
              <h1 style={{ fontSize: '22px', fontWeight: '700', margin: 0 }}>Development Local Test Mailbox</h1>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94A3B8' }}>
              Intercepted transactional emails generated in Demo Mode. Real email providers are NOT contacted.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={fetchEmails}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#1E293B', border: '1px solid #334155', color: '#F8FAFC', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button
            onClick={handleClear}
            disabled={emails.length === 0}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#F87171', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}
          >
            <Trash2 size={15} /> Clear All
          </button>
        </div>
      </div>

      {/* Safety Notice Banner */}
      <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '8px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <CheckCircle size={20} color="#10B981" />
        <div style={{ fontSize: '13px', color: '#CBD5E1' }}>
          <strong style={{ color: '#10B981' }}>Safe Offline Email Sink Active:</strong> All verification tokens, password resets, agency invitations, and billing notices are held locally. Click action links below to test authentication flows directly.
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {['ALL', 'VERIFY_EMAIL', 'RESET_PASSWORD', 'AGENCY_INVITE', 'CLIENT_INVITE', 'BILLING'].map((f) => (
          <button
            key={f}
            onClick={() => setFilterType(f)}
            style={{
              padding: '6px 12px',
              fontSize: '12.5px',
              borderRadius: '6px',
              cursor: 'pointer',
              border: filterType === f ? '1px solid #10B981' : '1px solid #334155',
              background: filterType === f ? 'rgba(16, 185, 129, 0.15)' : '#1E293B',
              color: filterType === f ? '#10B981' : '#94A3B8',
              fontWeight: filterType === f ? '600' : '400',
            }}
          >
            {f === 'ALL' ? 'All Intercepted (' + emails.length + ')' : f.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Main Mailbox Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '20px', minHeight: '560px' }}>
        {/* Email List Sidebar */}
        <div style={{ background: '#1E293B', borderRadius: '10px', border: '1px solid #334155', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #334155', fontSize: '13px', fontWeight: '600', color: '#94A3B8' }}>
            Messages ({filteredEmails.length})
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filteredEmails.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748B', fontSize: '13.5px' }}>
                <Clock size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                No intercepted emails yet.<br />Trigger a signup, reset, or invite to see messages here.
              </div>
            ) : (
              filteredEmails.map((item) => {
                const isSelected = selectedEmail?.id === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedEmail(item)}
                    style={{
                      padding: '14px 16px',
                      borderBottom: '1px solid #334155',
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                      borderLeft: isSelected ? '4px solid #10B981' : '4px solid transparent',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: isSelected ? '#10B981' : '#F1F5F9' }}>
                        {item.recipient}
                      </span>
                      <span style={{ fontSize: '11px', color: '#64748B' }}>
                        {new Date(item.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', color: '#CBD5E1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '6px' }}>
                      {item.subject}
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <span style={{ fontSize: '11px', background: '#0F172A', color: '#94A3B8', padding: '2px 6px', borderRadius: '4px' }}>
                        {item.emailType}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Email Viewer Panel */}
        <div style={{ background: '#1E293B', borderRadius: '10px', border: '1px solid #334155', display: 'flex', flexDirection: 'column' }}>
          {selectedEmail ? (
            <>
              {/* Message Header Details */}
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #334155' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0, color: '#F8FAFC' }}>
                    {selectedEmail.subject}
                  </h2>
                  <span style={{ fontSize: '12px', background: 'rgba(16, 185, 129, 0.15)', color: '#10B981', padding: '4px 8px', borderRadius: '6px', fontWeight: '600' }}>
                    {selectedEmail.emailType}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', fontSize: '13px', color: '#94A3B8' }}>
                  <div><strong>To:</strong> {selectedEmail.recipient}</div>
                  <div><strong>From:</strong> {selectedEmail.from || 'auth@relay-demo.test'}</div>
                  <div><strong>Received:</strong> {new Date(selectedEmail.sentAt).toLocaleString()}</div>
                </div>

                {/* Direct Action Link Banner */}
                {selectedEmail.metadata?.actionUrl && (
                  <div style={{ marginTop: '16px', padding: '12px 16px', background: 'rgba(59, 130, 246, 0.12)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '12px', color: '#60A5FA', fontWeight: '600' }}>Action Link Detected:</div>
                      <div style={{ fontSize: '12px', color: '#94A3B8', wordBreak: 'break-all', marginTop: '2px' }}>
                        {selectedEmail.metadata.actionUrl}
                      </div>
                    </div>
                    <a
                      href={selectedEmail.metadata.actionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: '#3B82F6',
                        color: '#FFFFFF',
                        textDecoration: 'none',
                        padding: '8px 14px',
                        borderRadius: '6px',
                        fontSize: '12.5px',
                        fontWeight: '600',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <ExternalLink size={14} /> Open Link
                    </a>
                  </div>
                )}
              </div>

              {/* Message Body */}
              <div style={{ padding: '24px', flex: 1, overflowY: 'auto', background: '#0F172A', margin: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
                {selectedEmail.html ? (
                  <div
                    style={{ color: '#F1F5F9', lineHeight: 1.6, fontSize: '14px' }}
                    dangerouslySetInnerHTML={{ __html: selectedEmail.html }}
                  />
                ) : (
                  <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', color: '#CBD5E1', fontSize: '13px' }}>
                    {selectedEmail.text || 'No text content available.'}
                  </pre>
                )}
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748B' }}>
              <Mail size={48} style={{ marginBottom: '16px', opacity: 0.4 }} />
              <div style={{ fontSize: '15px' }}>Select an email from the list to view contents</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
