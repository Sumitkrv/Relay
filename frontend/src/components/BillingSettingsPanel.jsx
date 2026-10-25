import React, { useState, useEffect, useRef } from 'react';
import {
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  Zap,
  FileText,
  DollarSign,
  ShieldCheck,
  Calendar,
  XCircle,
  Download,
} from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function BillingSettingsPanel() {
  const [loading, setLoading] = useState(true);
  const [subData, setSubData] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const fetchedRef = useRef(false);

  const fetchBilling = async (isManual = false) => {
    try {
      setLoading(true);
      const res = await api.get('/billing/subscription');
      if (res.data) {
        setSubData(res.data.subscription);
        setInvoices(res.data.invoices || []);
        if (isManual) {
          toast.success('Billing details refreshed.');
        }
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      toast.error('Failed to load billing: ' + msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      fetchBilling(false);
    }
  }, []);

  const handleSimulatePayment = async () => {
    try {
      setActionLoading(true);
      const res = await api.post('/billing/mock-checkout', { planId: 'solo_799' });
      toast.success('Simulated ₹799 payment successful! Subscription activated.');
      fetchBilling(false);
    } catch (err) {
      toast.error('Payment simulation failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  const handleAdvanceClock = async (days) => {
    try {
      setActionLoading(true);
      const res = await api.post('/billing/advance-clock', { days });
      toast.success(`Advanced test clock by ${days} days.`);
      fetchBilling(false);
    } catch (err) {
      toast.error('Clock advance failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelSub = async () => {
    if (!window.confirm('Simulate cancellation of this workspace subscription?')) return;
    try {
      setActionLoading(true);
      await api.post('/billing/cancel');
      toast.success('Subscription simulation cancelled.');
      fetchBilling(false);
    } catch (err) {
      toast.error('Cancellation failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  const handleResubscribe = async () => {
    try {
      setActionLoading(true);
      await api.post('/billing/resubscribe');
      toast.success('Subscription re-activated.');
      fetchBilling(false);
    } catch (err) {
      toast.error('Re-subscribe failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <section className="panel settings-panel" id="billing" style={{ maxWidth: '920px' }}>
      <div style={{ borderBottom: '1px solid var(--st-border, #E2E8F0)', paddingBottom: '16px', marginBottom: '22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#0F172A', letterSpacing: '-0.01em' }}>
              Subscription &amp; Billing (Offline Mock Adapter)
            </h2>
            <p style={{ fontSize: '13px', color: '#64748B', margin: '4px 0 0' }}>
              Manage your Relay software subscription, 14-day free trial, and simulated payment lifecycle.
            </p>
          </div>
          <button
            type="button"
            className="outline-btn small"
            onClick={() => fetchBilling(true)}
            disabled={loading}
            style={{ padding: '6px 12px', fontSize: '12.5px' }}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} style={{ marginRight: '5px' }} />
            Refresh
          </button>
        </div>
      </div>

      {/* Safety Notice */}
      <div
        style={{
          background: 'rgba(37, 99, 235, 0.06)',
          border: '1px solid rgba(37, 99, 235, 0.2)',
          borderRadius: '10px',
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          marginBottom: '22px',
        }}
      >
        <ShieldCheck size={22} color="#2563EB" style={{ flexShrink: 0 }} />
        <div style={{ fontSize: '12.5px', color: '#0F172A', lineHeight: 1.5 }}>
          <strong style={{ color: '#2563EB', fontWeight: 700 }}>Safe Mock Billing Sandbox:</strong> No live Razorpay account or real payment cards required. All subscription events, trial clocks, and simulated invoices are scoped to this workspace and persist in MongoDB.
        </div>
      </div>

      {/* Subscription Status Card */}
      <div
        style={{
          background: '#F8FAFC',
          border: '1px solid #E2E8F0',
          borderRadius: '12px',
          padding: '22px',
          marginBottom: '24px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '18px' }}>
          <div>
            <div style={{ fontSize: '12px', textTransform: 'uppercase', color: '#64748B', fontWeight: 700, letterSpacing: '0.04em' }}>
              Current Plan
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A', marginTop: '3px' }}>
              Relay Solo — ₹799/month
            </div>
            <div style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>
              Direct Meta WhatsApp connectivity • Unlimited Contacts • Zero message markup
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 700,
                padding: '4px 12px',
                borderRadius: '6px',
                background: subData?.status === 'ACTIVE' ? 'rgba(22, 163, 74, 0.12)' : 'rgba(217, 119, 6, 0.12)',
                color: subData?.status === 'ACTIVE' ? '#16A34A' : '#D97706',
                border: `1px solid ${subData?.status === 'ACTIVE' ? 'rgba(22, 163, 74, 0.25)' : 'rgba(217, 119, 6, 0.25)'}`,
              }}
            >
              {subData?.status || 'TRIALING'}
            </span>
            <span style={{ fontSize: '12px', color: '#64748B' }}>
              {subData?.trialEndsAt
                ? `14-Day Trial Ends: ${new Date(subData.trialEndsAt).toLocaleDateString()}`
                : `Next Bill: ${new Date(subData?.currentPeriodEnd || Date.now()).toLocaleDateString()}`}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', paddingTop: '16px', borderTop: '1px solid #E2E8F0', alignItems: 'center' }}>
          {subData?.status !== 'ACTIVE' ? (
            <button
              type="button"
              className="primary-btn"
              onClick={handleSimulatePayment}
              disabled={actionLoading}
              style={{ background: '#2563EB', color: '#FFFFFF', fontWeight: 700, fontSize: '13px', padding: '9px 18px' }}
            >
              <Zap size={15} style={{ marginRight: '6px' }} />
              {actionLoading ? 'Processing Checkout…' : 'Simulate ₹799 Mock Checkout'}
            </button>
          ) : (
            <button
              type="button"
              className="outline-btn"
              onClick={handleCancelSub}
              disabled={actionLoading}
              style={{ color: '#DC2626', borderColor: 'rgba(220, 38, 38, 0.3)', fontSize: '13px' }}
            >
              <XCircle size={15} style={{ marginRight: '6px' }} />
              Simulate Cancellation
            </button>
          )}

          {subData?.status === 'CANCELED' && (
            <button
              type="button"
              className="primary-btn"
              onClick={handleResubscribe}
              disabled={actionLoading}
              style={{ fontSize: '13px', background: '#2563EB' }}
            >
              Re-activate Subscription
            </button>
          )}

          {/* Test Clock Controls */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}>
              <Clock size={14} color="#2563EB" /> Test Clock:
            </span>
            <button
              type="button"
              className="outline-btn small"
              onClick={() => handleAdvanceClock(7)}
              disabled={actionLoading}
              style={{ fontSize: '11.5px', padding: '5px 10px' }}
              title="Advance test clock by 7 days to simulate mid-trial state"
            >
              +7 Days
            </button>
            <button
              type="button"
              className="outline-btn small"
              onClick={() => handleAdvanceClock(15)}
              disabled={actionLoading}
              style={{ fontSize: '11.5px', padding: '5px 10px', color: '#D97706', borderColor: 'rgba(217, 119, 6, 0.3)' }}
              title="Advance test clock past 14 days to simulate trial expiration"
            >
              +15 Days (Expire)
            </button>
          </div>
        </div>
      </div>

      {/* Invoice History Table */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(11, 18, 32, 0.03)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', fontSize: '14.5px', fontWeight: 700, color: '#0F172A', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Simulated Payment History &amp; Invoices</span>
          <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 500 }}>
            {invoices.length} {invoices.length === 1 ? 'record' : 'records'}
          </span>
        </div>

        {invoices.length === 0 ? (
          <div style={{ padding: '36px 20px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
            <FileText size={32} style={{ margin: '0 auto 10px', opacity: 0.35, color: '#2563EB' }} />
            <div>No simulated payments generated yet.</div>
            <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '4px' }}>
              Click "Simulate ₹799 Mock Checkout" above to record a synthetic invoice.
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', color: '#64748B', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ padding: '12px 18px', fontWeight: 600, fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Invoice ID</th>
                  <th style={{ padding: '12px 18px', fontWeight: 600, fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Date</th>
                  <th style={{ padding: '12px 18px', fontWeight: 600, fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Amount</th>
                  <th style={{ padding: '12px 18px', fontWeight: 600, fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Status</th>
                  <th style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 600, fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Receipt</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv._id} style={{ borderBottom: '1px solid #F1F5F9', transition: 'background-color 0.15s ease' }}>
                    <td style={{ padding: '13px 18px', fontFamily: 'monospace', fontWeight: 600, color: '#0F172A' }}>
                      {inv.invoiceNumber}
                    </td>
                    <td style={{ padding: '13px 18px', color: '#64748B' }}>
                      {new Date(inv.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '13px 18px', fontWeight: 700, color: '#0F172A' }}>
                      ₹{inv.amount}
                    </td>
                    <td style={{ padding: '13px 18px' }}>
                      <span style={{ fontSize: '11.5px', background: 'rgba(22, 163, 74, 0.12)', color: '#16A34A', padding: '3px 8px', borderRadius: '6px', fontWeight: 600, border: '1px solid rgba(22, 163, 74, 0.2)' }}>
                        {inv.status}
                      </span>
                    </td>
                    <td style={{ padding: '13px 18px', textAlign: 'right' }}>
                      <button
                        type="button"
                        className="outline-btn small"
                        onClick={() => setSelectedReceipt(inv)}
                        style={{ fontSize: '11.5px', padding: '4px 10px' }}
                      >
                        <Download size={12} style={{ marginRight: '5px' }} />
                        View Mock Receipt
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Receipt Modal */}
      {selectedReceipt && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(11, 18, 32, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div style={{ background: '#0F172A', border: '1px solid #334155', borderRadius: '14px', padding: '26px', maxWidth: '460px', width: '100%', color: '#F8FAFC', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid #334155', paddingBottom: '14px' }}>
              <div style={{ fontSize: '16.5px', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.01em' }}>Simulated Payment Receipt</div>
              <button
                type="button"
                onClick={() => setSelectedReceipt(null)}
                style={{ background: 'transparent', border: 'none', color: '#94A3B8', fontSize: '18px', cursor: 'pointer', padding: '4px' }}
                aria-label="Close Receipt Modal"
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: '#CBD5E1', marginBottom: '22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94A3B8' }}>Invoice Number:</span>
                <strong style={{ color: '#FFFFFF', fontFamily: 'monospace' }}>{selectedReceipt.invoiceNumber}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94A3B8' }}>Plan:</span>
                <strong style={{ color: '#FFFFFF' }}>Relay Solo (₹799/mo)</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94A3B8' }}>Amount Paid:</span>
                <strong style={{ color: '#60A5FA', fontSize: '15px' }}>₹{selectedReceipt.amount}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94A3B8' }}>Date:</span>
                <span style={{ color: '#E2E8F0' }}>{new Date(selectedReceipt.createdAt).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94A3B8' }}>Payment Provider:</span>
                <span style={{ color: '#93C5FD', fontFamily: 'monospace', fontSize: '11.5px' }}>MOCK_RAZORPAY_ADAPTER</span>
              </div>
              <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '8px', background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '6px', border: '1px solid #1E293B', lineHeight: 1.45 }}>
                Note: This is a synthetic test transaction generated for offline evaluation &amp; QA. Not a legal tax invoice.
              </div>
            </div>

            <button
              type="button"
              className="primary-btn"
              onClick={() => setSelectedReceipt(null)}
              style={{ width: '100%', background: '#2563EB', color: '#FFFFFF', fontWeight: 700, padding: '10px' }}
            >
              Close Receipt
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
