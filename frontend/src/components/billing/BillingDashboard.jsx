import React, { useEffect, useState, useCallback } from 'react';
import {
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Shield,
  ArrowUpRight,
  RefreshCw,
  FileText,
  ExternalLink,
  Info,
  Calendar,
  Zap,
  Lock,
  ChevronRight,
  XCircle,
  HelpCircle,
  TrendingUp,
  Receipt
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import billingService from '../../services/billing';

export default function BillingDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [billingData, setBillingData] = useState(null);
  const [plans, setPlans] = useState([]);
  const [payments, setPayments] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelImmediately, setCancelImmediately] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showManualVerifyModal, setShowManualVerifyModal] = useState(false);
  const [manualVerifyData, setManualVerifyData] = useState({
    razorpay_payment_id: '',
    razorpay_subscription_id: '',
    razorpay_signature: ''
  });

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [overviewRes, plansRes, paymentsRes] = await Promise.allSettled([
        billingService.getBillingOverview(),
        billingService.getPlans(),
        billingService.getPaymentHistory()
      ]);

      if (overviewRes.status === 'fulfilled' && overviewRes.value.success) {
        setBillingData(overviewRes.value);
      }
      if (plansRes.status === 'fulfilled' && plansRes.value.success) {
        setPlans(plansRes.value.plans || []);
      }
      if (paymentsRes.status === 'fulfilled' && paymentsRes.value.success) {
        setPayments(paymentsRes.value.payments || []);
      }
    } catch (err) {
      console.error('Failed to load billing details', err);
      toast.error('Unable to retrieve billing subscription data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load Razorpay Checkout Script dynamically
  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  // Start 14-Day Free Trial
  const handleStartTrial = async () => {
    setActionLoading(true);
    try {
      const res = await billingService.startTrial();
      if (res.success) {
        toast.success(res.message || '14-Day Mock Mode Trial activated successfully!');
        loadData(true);
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      toast.error(`Trial start failed: ${msg}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Subscribe to Relay Solo (Razorpay Recurring Checkout)
  const handleSubscribe = async (planKey = 'relay_solo') => {
    setActionLoading(true);
    try {
      const res = await billingService.createSubscription(planKey);
      if (!res.success) {
        throw new Error(res.message || 'Failed to initialize subscription checkout');
      }

      const { subscription } = res;
      const scriptLoaded = await loadRazorpayScript();

      if (!scriptLoaded || !window.Razorpay) {
        toast.error('Could not load Razorpay secure checkout. Opening manual verification console.');
        setManualVerifyData({
          razorpay_payment_id: 'pay_test_' + Date.now().toString(36),
          razorpay_subscription_id: subscription.providerSubscriptionId,
          razorpay_signature: ''
        });
        setShowManualVerifyModal(true);
        setActionLoading(false);
        return;
      }

      const options = {
        key: subscription.keyId,
        subscription_id: subscription.providerSubscriptionId,
        name: 'Relay SaaS',
        description: 'Relay Solo Monthly Subscription (1 Workspace, 1 Sender)',
        image: '/logo.png',
        handler: async (response) => {
          try {
            toast.loading('Verifying secure recurring payment signature...', { id: 'verify-sub' });
            const verifyRes = await billingService.verifyCheckout({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_subscription_id: response.razorpay_subscription_id,
              razorpay_signature: response.razorpay_signature
            });
            if (verifyRes.success) {
              toast.success('Subscription activated! Relay Solo entitlements granted.', { id: 'verify-sub' });
              loadData(true);
            } else {
              toast.error(verifyRes.message || 'Verification could not be confirmed.', { id: 'verify-sub' });
            }
          } catch (verifyErr) {
            const vMsg = verifyErr.response?.data?.message || verifyErr.message;
            toast.error(`Verification error: ${vMsg}`, { id: 'verify-sub' });
          }
        },
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
        },
        notes: {
          workspaceId: subscription.workspaceId || '',
          planKey: planKey
        },
        theme: {
          color: '#0D9488'
        },
        modal: {
          ondismiss: () => {
            toast('Checkout window closed. You can complete authorization at any time.', { icon: 'ℹ️' });
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (resp) {
        toast.error(`Payment failed: ${resp.error.description}`);
      });
      rzp.open();
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      toast.error(`Subscription setup failed: ${msg}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Confirm Cancellation
  const handleConfirmCancel = async () => {
    setActionLoading(true);
    try {
      const res = await billingService.cancelSubscription(cancelImmediately, cancelReason);
      if (res.success) {
        toast.success(res.message || 'Subscription cancellation confirmed.');
        setShowCancelModal(false);
        loadData(true);
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      toast.error(`Cancellation failed: ${msg}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Manual Verification Handler (Fallback / QA test mode)
  const handleManualVerify = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await billingService.verifyCheckout(manualVerifyData);
      if (res.success) {
        toast.success('Manual verification confirmed by backend!');
        setShowManualVerifyModal(false);
        loadData(true);
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      toast.error(`Verification rejected: ${msg}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Reconcile status with Razorpay
  const handleReconcile = async () => {
    setRefreshing(true);
    try {
      const res = await billingService.triggerReconciliation();
      if (res.success) {
        toast.success(res.message || 'Provider status reconciled successfully.');
        loadData(true);
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      toast.error(`Reconciliation failed: ${msg}`);
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#667085' }}>
        <RefreshCw className="animate-spin" size={24} style={{ margin: '0 auto 12px', color: '#0D9488' }} />
        <p style={{ fontSize: '14px' }}>Loading subscription billing status and financial quotas...</p>
      </div>
    );
  }

  const sub = billingData?.subscription || {};
  const status = sub.internalStatus || 'NO_SUBSCRIPTION';
  const plan = billingData?.plan || {};
  const quotas = billingData?.usage?.quotas || {};
  const trial = billingData?.trial || {};
  const isOwner = billingData?.isOwner !== false;

  // Format currency
  const formatMoney = (minor, currency = 'INR') => {
    if (minor === undefined || minor === null) return '₹0';
    const major = (minor / 100).toLocaleString('en-IN');
    return `${currency === 'INR' ? '₹' : currency} ${major}`;
  };

  // Status badge helper
  const renderStatusBadge = (st) => {
    switch (st) {
      case 'ACTIVE':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#ECFDF5', color: '#065F46', padding: '4px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: 600, border: '1px solid #A7F3D0' }}>
            <CheckCircle2 size={13} /> Active Subscription
          </span>
        );
      case 'TRIALING':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#EFF6FF', color: '#1E40AF', padding: '4px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: 600, border: '1px solid #BFDBFE' }}>
            <Clock size={13} /> 14-Day Mock Trial ({trial.daysRemaining ?? 14} days left)
          </span>
        );
      case 'TRIAL_EXPIRED':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#FEF2F2', color: '#991B1B', padding: '4px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: 600, border: '1px solid #FECACA' }}>
            <XCircle size={13} /> Trial Expired
          </span>
        );
      case 'CANCEL_AT_PERIOD_END':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#FFFBEB', color: '#92400E', padding: '4px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: 600, border: '1px solid #FDE68A' }}>
            <AlertTriangle size={13} /> Cancels at Cycle End
          </span>
        );
      case 'PAST_DUE':
      case 'HALTED':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#FEF2F2', color: '#B91C1C', padding: '4px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: 600, border: '1px solid #FCA5A5' }}>
            <AlertTriangle size={13} /> Payment Requires Attention
          </span>
        );
      case 'LEGACY_ENTITLED':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#F5F3FF', color: '#5B21B6', padding: '4px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: 600, border: '1px solid #DDD6FE' }}>
            <Shield size={13} /> Reference Legacy Entitlement (M2W Realty)
          </span>
        );
      default:
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#F3F4F6', color: '#4B5563', padding: '4px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: 600, border: '1px solid #E5E7EB' }}>
            <Info size={13} /> No Active Plan
          </span>
        );
    }
  };

  return (
    <div className="billing-dashboard-container" style={{ maxWidth: '1080px', margin: '0 auto', fontFamily: 'inherit' }}>
      {/* Top Banner / Environment Guard */}
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: '12px',
        padding: '16px 20px',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: '#F0FDFA',
            color: '#0D9488',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <CreditCard size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#111827' }}>
                Relay SaaS Subscription &amp; Workspace Billing
              </h2>
              <span style={{
                background: '#FEF3C7',
                color: '#92400E',
                fontSize: '11px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '6px',
                border: '1px solid #FCD34D'
              }}>
                RAZORPAY TEST MODE
              </span>
            </div>
            <p style={{ fontSize: '12.5px', color: '#667085', margin: '3px 0 0' }}>
              Billing is strictly isolated to this workspace. Meta WhatsApp messaging fees remain customer-direct.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={handleReconcile}
            disabled={refreshing || actionLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12.5px',
              padding: '7px 14px',
              borderRadius: '8px',
              background: '#F3F4F6',
              color: '#374151',
              border: '1px solid #D1D5DB',
              cursor: refreshing ? 'not-allowed' : 'pointer',
              fontWeight: 500
            }}
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            <span>{refreshing ? 'Reconciling…' : 'Sync Gateway'}</span>
          </button>
        </div>
      </div>

      {/* Trial Status or Past Due Warnings */}
      {status === 'TRIALING' && (
        <div style={{
          background: 'linear-gradient(135deg, #F0FDF4 0%, #ECFDF5 100%)',
          border: '1px solid #A7F3D0',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <Clock size={20} style={{ color: '#059669', marginTop: '2px', flexShrink: 0 }} />
            <div>
              <strong style={{ fontSize: '14px', color: '#065F46' }}>
                14-Day Free Mock Sandbox Trial Active
              </strong>
              <p style={{ fontSize: '13px', color: '#047857', margin: '2px 0 0' }}>
                Your trial will expire on <strong>{trial.trialEndsAt ? new Date(trial.trialEndsAt).toLocaleDateString() : 'in 14 days'}</strong> ({trial.daysRemaining ?? 14} days remaining). Upgrade to Relay Solo to preserve full automation.
              </p>
            </div>
          </div>
          {isOwner && (
            <button
              onClick={() => handleSubscribe('relay_solo')}
              disabled={actionLoading}
              style={{
                background: '#0D9488',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Zap size={14} /> Upgrade to Relay Solo (₹799/mo)
            </button>
          )}
        </div>
      )}

      {status === 'TRIAL_EXPIRED' && (
        <div style={{
          background: '#FEF2F2',
          border: '1px solid #FECACA',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <AlertTriangle size={20} style={{ color: '#DC2626', marginTop: '2px', flexShrink: 0 }} />
            <div>
              <strong style={{ fontSize: '14px', color: '#991B1B' }}>
                Your 14-Day Mock Sandbox Trial Has Expired
              </strong>
              <p style={{ fontSize: '13px', color: '#B91C1C', margin: '2px 0 0' }}>
                All your contacts, templates, and campaign history are safely preserved. Subscribe to Relay Solo to resume automated campaigns and simulations.
              </p>
            </div>
          </div>
          {isOwner && (
            <button
              onClick={() => handleSubscribe('relay_solo')}
              disabled={actionLoading}
              style={{
                background: '#DC2626',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Zap size={14} /> Subscribe Now (₹799/mo)
            </button>
          )}
        </div>
      )}

      {status === 'PAST_DUE' && (
        <div style={{
          background: '#FFFBEB',
          border: '1px solid #FCD34D',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <AlertTriangle size={20} style={{ color: '#D97706', marginTop: '2px', flexShrink: 0 }} />
            <div>
              <strong style={{ fontSize: '14px', color: '#92400E' }}>
                Payment Renewal Requires Attention
              </strong>
              <p style={{ fontSize: '13px', color: '#B45309', margin: '2px 0 0' }}>
                Razorpay was unable to charge the recurring payment mandate for your Relay Solo plan. You are in a 3-day grace period.
              </p>
            </div>
          </div>
          {isOwner && (
            <button
              onClick={() => handleSubscribe('relay_solo')}
              disabled={actionLoading}
              style={{
                background: '#D97706',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Update Payment Authorization
            </button>
          )}
        </div>
      )}

      {/* Main Grid: Plan Details & Quotas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginBottom: '28px' }}>
        {/* Card 1: Subscription Status Card */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
              <div>
                <span style={{ fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#667085', fontWeight: 600 }}>
                  Current Workspace Plan
                </span>
                <h3 style={{ fontSize: '20px', fontWeight: 700, margin: '2px 0 0', color: '#111827' }}>
                  {plan.displayName || (status === 'LEGACY_ENTITLED' ? 'Relay Enterprise (Legacy Grant)' : 'No Active Plan')}
                </h3>
              </div>
              <div>{renderStatusBadge(status)}</div>
            </div>

            <p style={{ fontSize: '13px', color: '#4B5563', lineHeight: '1.5', margin: '0 0 16px' }}>
              {plan.description || 'Access to Relay multi-industry WhatsApp marketing, audience segmentation, and automation workflows.'}
            </p>

            <div style={{
              background: '#F9FAFB',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              padding: '14px',
              marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                <span style={{ fontSize: '12.5px', color: '#667085' }}>Monthly Price:</span>
                <span style={{ fontSize: '18px', fontWeight: 800, color: '#111827' }}>
                  {formatMoney(plan.amountMinor || 79900)}
                  <span style={{ fontSize: '12px', fontWeight: 400, color: '#667085' }}> / month</span>
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#667085', marginTop: '6px' }}>
                <span>Billing Period:</span>
                <strong style={{ color: '#111827' }}>
                  {sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString() : (status === 'TRIALING' ? '14-Day Trial' : 'N/A')}
                </strong>
              </div>
              {sub.cancelAtPeriodEnd && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#B45309', marginTop: '6px' }}>
                  <span>Access Ends On:</span>
                  <strong>{sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString() : 'End of Cycle'}</strong>
                </div>
              )}
            </div>

            <div style={{ fontSize: '12px', color: '#667085', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Shield size={14} style={{ color: '#0D9488' }} />
                <span>Single-operator limit (1 Workspace, 1 Dedicated Sender)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Zap size={14} style={{ color: '#0D9488' }} />
                <span>Mock Mode Sandbox included with realistic delivery simulation</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Info size={14} style={{ color: '#667085' }} />
                <span>Tax Treatment: {plan.taxTreatment || 'exclusive (GST configured separately)'}</span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #E5E7EB', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {status === 'NO_SUBSCRIPTION' && (
              <>
                {trial.eligible && (
                  <button
                    onClick={handleStartTrial}
                    disabled={actionLoading}
                    style={{
                      flex: 1,
                      background: '#F3F4F6',
                      color: '#111827',
                      border: '1px solid #D1D5DB',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Start 14-Day Trial
                  </button>
                )}
                <button
                  onClick={() => handleSubscribe('relay_solo')}
                  disabled={actionLoading}
                  style={{
                    flex: 1,
                    background: '#0D9488',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Subscribe ₹799/mo
                </button>
              </>
            )}

            {(status === 'ACTIVE' || status === 'PAST_DUE') && !sub.cancelAtPeriodEnd && isOwner && (
              <button
                onClick={() => setShowCancelModal(true)}
                disabled={actionLoading}
                style={{
                  background: 'transparent',
                  color: '#991B1B',
                  border: '1px solid #FECACA',
                  borderRadius: '8px',
                  padding: '8px 14px',
                  fontSize: '12.5px',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                Cancel Subscription…
              </button>
            )}

            {sub.cancelAtPeriodEnd && isOwner && (
              <button
                onClick={() => handleSubscribe('relay_solo')}
                disabled={actionLoading}
                style={{
                  background: '#0D9488',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 14px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Resume Renewal
              </button>
            )}
          </div>
        </div>

        {/* Card 2: Usage Quotas & Limits */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#111827' }}>
                Workspace Usage Quotas
              </h3>
              <span style={{ fontSize: '12px', color: '#667085' }}>Monthly Ledger</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Quota 1: Contacts */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '4px' }}>
                  <span style={{ color: '#4B5563' }}>Contacts Stored</span>
                  <strong>
                    {quotas.contacts?.used ?? 0} / {quotas.contacts?.limit ?? 10000}
                  </strong>
                </div>
                <div style={{ background: '#E5E7EB', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min(100, ((quotas.contacts?.used || 0) / (quotas.contacts?.limit || 10000)) * 100)}%`,
                    background: '#0D9488',
                    height: '100%'
                  }} />
                </div>
              </div>

              {/* Quota 2: Campaigns */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '4px' }}>
                  <span style={{ color: '#4B5563' }}>Campaign Executions</span>
                  <strong>
                    {quotas.campaigns?.used ?? 0} / {quotas.campaigns?.limit ?? 50}
                  </strong>
                </div>
                <div style={{ background: '#E5E7EB', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min(100, ((quotas.campaigns?.used || 0) / (quotas.campaigns?.limit || 50)) * 100)}%`,
                    background: '#0D9488',
                    height: '100%'
                  }} />
                </div>
              </div>

              {/* Quota 3: Simulated Messages */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '4px' }}>
                  <span style={{ color: '#4B5563' }}>Simulated Messages</span>
                  <strong>
                    {quotas.simulatedMessages?.used ?? 0} / {quotas.simulatedMessages?.limit ?? 25000}
                  </strong>
                </div>
                <div style={{ background: '#E5E7EB', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min(100, ((quotas.simulatedMessages?.used || 0) / (quotas.simulatedMessages?.limit || 25000)) * 100)}%`,
                    background: '#3B82F6',
                    height: '100%'
                  }} />
                </div>
              </div>

              {/* Quota 4: Templates */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '4px' }}>
                  <span style={{ color: '#4B5563' }}>Saved Templates</span>
                  <strong>
                    {quotas.templates?.used ?? 0} / {quotas.templates?.limit ?? 50}
                  </strong>
                </div>
                <div style={{ background: '#E5E7EB', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min(100, ((quotas.templates?.used || 0) / (quotas.templates?.limit || 50)) * 100)}%`,
                    background: '#10B981',
                    height: '100%'
                  }} />
                </div>
              </div>
            </div>
          </div>

          <div style={{
            marginTop: '18px',
            padding: '12px 14px',
            background: '#F9FAFB',
            borderRadius: '8px',
            border: '1px solid #E5E7EB',
            fontSize: '12px',
            color: '#667085'
          }}>
            <p style={{ margin: 0 }}>
              Quotas reset at each monthly billing cycle boundary. Exceeding contact limits does not delete historical records.
            </p>
          </div>
        </div>
      </div>

      {/* Payment & Invoice History Table */}
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        marginBottom: '28px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#111827' }}>
              Payment History &amp; Provider Invoices
            </h3>
            <p style={{ fontSize: '12.5px', color: '#667085', margin: '2px 0 0' }}>
              Genuine Razorpay recurring charges and verified payment references.
            </p>
          </div>
          <span style={{ fontSize: '12px', color: '#667085' }}>
            {payments.length} {payments.length === 1 ? 'transaction' : 'transactions'}
          </span>
        </div>

        {payments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px 20px', background: '#F9FAFB', borderRadius: '8px', border: '1px dashed #D1D5DB' }}>
            <Receipt size={32} style={{ color: '#9CA3AF', margin: '0 auto 8px' }} />
            <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#374151', margin: 0 }}>No Payment Transactions Yet</h4>
            <p style={{ fontSize: '12.5px', color: '#667085', margin: '4px 0 0' }}>
              When your monthly subscription is authorized or renewed via Razorpay, receipts will appear here automatically.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E5E7EB', textAlign: 'left', color: '#667085', fontSize: '12px' }}>
                  <th style={{ padding: '10px 12px' }}>Date</th>
                  <th style={{ padding: '10px 12px' }}>Payment ID</th>
                  <th style={{ padding: '10px 12px' }}>Amount</th>
                  <th style={{ padding: '10px 12px' }}>Status</th>
                  <th style={{ padding: '10px 12px' }}>Method</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Invoice / Receipt</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p._id || p.providerPaymentId} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '12px', color: '#111827' }}>
                      {p.paidAt ? new Date(p.paidAt).toLocaleDateString() : new Date(p.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '12px', fontFamily: 'monospace', fontSize: '12px', color: '#4B5563' }}>
                      {p.providerPaymentId}
                    </td>
                    <td style={{ padding: '12px', fontWeight: 600, color: '#111827' }}>
                      {formatMoney(p.amountMinor, p.currency)}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        display: 'inline-flex',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        background: p.paymentStatus === 'captured' ? '#ECFDF5' : '#FEF2F2',
                        color: p.paymentStatus === 'captured' ? '#065F46' : '#991B1B'
                      }}>
                        {p.paymentStatus}
                      </span>
                    </td>
                    <td style={{ padding: '12px', color: '#667085', fontSize: '12px' }}>
                      {p.method ? `${p.method.toUpperCase()} ${p.cardLast4 ? `(•• ${p.cardLast4})` : ''}` : 'Razorpay Recurring'}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      {p.providerInvoiceId ? (
                        <span style={{ fontSize: '12px', color: '#0D9488', fontFamily: 'monospace' }}>
                          {p.providerInvoiceId}
                        </span>
                      ) : (
                        <span style={{ fontSize: '11.5px', color: '#9CA3AF' }}>Provider Receipt</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Meta WhatsApp Direct Billing Safety Notice */}
      <div style={{
        background: '#F9FAFB',
        border: '1px solid #E5E7EB',
        borderRadius: '12px',
        padding: '20px',
        fontSize: '13px',
        color: '#4B5563',
        lineHeight: '1.6'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <Shield size={16} style={{ color: '#0D9488' }} />
          <strong style={{ color: '#111827' }}>Commercial Billing Safety &amp; Meta Message Clarity</strong>
        </div>
        <p style={{ margin: 0 }}>
          Your Relay Solo software subscription strictly covers CRM features, template libraries, automated campaign queues, and reports.
          Official Meta WhatsApp conversation charges are billed <strong>directly by Meta</strong> via your connected WhatsApp Business Account (WABA).
          Relay does not mark up message fees, absorb Meta charges, or hold customer balances.
        </p>
      </div>

      {/* Cancellation Confirmation Modal */}
      {showCancelModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '12px',
            maxWidth: '480px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: '#FEF2F2',
                color: '#DC2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <AlertTriangle size={18} />
              </div>
              <h3 style={{ fontSize: '17px', fontWeight: 700, margin: 0, color: '#111827' }}>
                Cancel Relay Solo Subscription?
              </h3>
            </div>

            <p style={{ fontSize: '13px', color: '#4B5563', lineHeight: '1.5', margin: '0 0 16px' }}>
              By cancelling, automatic monthly renewals will cease in Razorpay.
              Your workspace data, contacts, templates, and campaign records will remain securely preserved.
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#111827', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={cancelImmediately}
                  onChange={(e) => setCancelImmediately(e.target.checked)}
                />
                <span>Cancel immediately (instead of at the end of the current paid billing cycle)</span>
              </label>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '12px', color: '#667085', display: 'block', marginBottom: '4px' }}>
                Reason for cancellation (optional):
              </label>
              <input
                type="text"
                placeholder="e.g. Pausing marketing campaigns temporarily"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #D1D5DB',
                  fontSize: '13px'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                disabled={actionLoading}
                style={{
                  background: '#F3F4F6',
                  color: '#374151',
                  border: '1px solid #D1D5DB',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                Keep Subscription
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={actionLoading}
                style={{
                  background: '#DC2626',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {actionLoading ? 'Cancelling…' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Verification Modal (Test Mode / QA Fallback) */}
      {showManualVerifyModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '12px',
            maxWidth: '520px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#111827' }}>
                Test Mode Subscription Checkout Verification
              </h3>
              <button
                onClick={() => setShowManualVerifyModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#667085' }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '13px', color: '#4B5563', margin: '0 0 16px' }}>
              In Razorpay Test Mode or automated QA testing environments, verify checkout completion with authorization parameters.
            </p>

            <form onSubmit={handleManualVerify} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#4B5563', display: 'block', marginBottom: '4px' }}>
                  Razorpay Subscription ID:
                </label>
                <input
                  type="text"
                  required
                  value={manualVerifyData.razorpay_subscription_id}
                  onChange={(e) => setManualVerifyData({ ...manualVerifyData, razorpay_subscription_id: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '12.5px', fontFamily: 'monospace' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#4B5563', display: 'block', marginBottom: '4px' }}>
                  Razorpay Payment ID:
                </label>
                <input
                  type="text"
                  required
                  value={manualVerifyData.razorpay_payment_id}
                  onChange={(e) => setManualVerifyData({ ...manualVerifyData, razorpay_payment_id: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '12.5px', fontFamily: 'monospace' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#4B5563', display: 'block', marginBottom: '4px' }}>
                  Razorpay Signature:
                </label>
                <input
                  type="text"
                  placeholder="HMAC SHA256 (payment_id|subscription_id, secret)"
                  value={manualVerifyData.razorpay_signature}
                  onChange={(e) => setManualVerifyData({ ...manualVerifyData, razorpay_signature: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '12.5px', fontFamily: 'monospace' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowManualVerifyModal(false)}
                  style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #D1D5DB', background: '#F3F4F6', fontSize: '12.5px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', background: '#0D9488', color: '#FFF', fontSize: '12.5px', fontWeight: 600 }}
                >
                  {actionLoading ? 'Verifying…' : 'Submit Verification'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
