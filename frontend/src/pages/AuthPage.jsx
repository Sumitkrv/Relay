import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Sparkles,
  UserRound,
  ShieldCheck,
  AlertCircle,
  RotateCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export default function AuthPage({ mode = 'login' }) {
  const isRegister = mode === 'register';
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [resendBusy, setResendBusy] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  const { login, register, resendVerification } = useAuth();
  const navigate = useNavigate();

  const change = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (unverifiedEmail) setUnverifiedEmail('');
  };

  const submit = async (e) => {
    e.preventDefault();
    if (isRegister && form.name.trim().length < 2) {
      return toast.error('Please enter your full name (minimum 2 characters).');
    }
    if (!/^\S+@\S+\.\S+$/.test(form.email)) {
      return toast.error('Enter a valid email address.');
    }
    if (form.password.length < 8) {
      return toast.error('Password must be at least 8 characters.');
    }

    setBusy(true);
    setUnverifiedEmail('');
    try {
      if (isRegister) {
        await register({ ...form, name: form.name.trim(), confirmPassword: form.password });
        toast.success('Registration successful! Please check your email to verify.');
        navigate(`/verify-email?email=${encodeURIComponent(form.email.trim())}`);
      } else {
        const result = await login({ email: form.email, password: form.password });
        toast.success('Welcome back to Relay.');
        if (result && result.hasWorkspace) {
          navigate('/app');
        } else {
          navigate('/onboarding');
        }
      }
    } catch (err) {
      const code = err.response?.data?.code;
      const msg = err.response?.data?.message || 'Could not sign you in. Please check your credentials.';

      if (code === 'EMAIL_NOT_VERIFIED') {
        setUnverifiedEmail(form.email.trim());
      }
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleResendUnverified = async () => {
    if (!unverifiedEmail || resendBusy) return;
    setResendBusy(true);
    try {
      await resendVerification(unverifiedEmail);
      setResendSent(true);
      toast.success('Verification email sent! Please check your inbox.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resend verification email.');
    } finally {
      setResendBusy(false);
    }
  };

  return (
    <div className="auth-shell">
      {/* Visual Brand Panel */}
      <div className="auth-visual">
        <div className="brand auth-brand">
          <img src="/logo.png" alt="M2W Realty" className="brand-logo-img-lg" />
          <span>
            M2W Realty<span className="brand-dot">.</span>
          </span>
        </div>

        <div className="visual-copy">
          <div className="eyebrow">
            <Sparkles size={14} /> REAL ESTATE WHATSAPP AUTOMATION
          </div>
          <h1>
            Property leads,
            <br />
            automated on
            <br />
            <em>WhatsApp.</em>
          </h1>
          <p>
            Engage property buyers instantly, schedule site visits, and nurture client relationships
            seamlessly from one unified single-operator workspace.
          </p>
          <div className="visual-proof">
            <div className="proof-check">
              <Check size={14} />
            </div>
            <span>Single-Operator Real Estate Platform</span>
          </div>
        </div>

        <div className="visual-footer">
          Reliable real estate outreach. <span>© M2W Realty WhatsApp Automation</span>
        </div>
      </div>

      {/* Auth Form Panel */}
      <div className="auth-form-side">
        <div className="auth-form-wrap">
          <div className="auth-mobile-brand brand">
            <img src="/logo.png" alt="M2W Realty" className="brand-logo-img" />
            <span>
              M2W Realty<span className="brand-dot">.</span>
            </span>
          </div>

          <div className="form-kicker">
            {isRegister ? 'SINGLE OPERATOR PROVISIONING' : 'OWNER AUTHENTICATION'}
          </div>
          <h2>{isRegister ? 'Create owner account' : 'Welcome back'}</h2>
          <p className="form-subtitle">
            {isRegister
              ? 'Provision your single-operator real estate workspace.'
              : 'Sign in to access your properties, inbox, and campaigns.'}
          </p>

          {/* Email Unverified Warning Banner */}
          {unverifiedEmail && (
            <div className="p-3.5 mb-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex flex-col gap-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Email Verification Required:</strong> Your account is pending confirmation. Check your inbox for the link sent to <strong>{unverifiedEmail}</strong>.
                </div>
              </div>
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  disabled={resendBusy || resendSent}
                  onClick={handleResendUnverified}
                  className="font-bold text-teal-700 hover:text-teal-900 underline flex items-center gap-1 disabled:opacity-50"
                >
                  <RotateCw className={`w-3 h-3 ${resendBusy ? 'animate-spin' : ''}`} />
                  <span>{resendSent ? 'Verification Email Dispatched' : 'Resend Verification Email'}</span>
                </button>
                <span>•</span>
                <Link
                  to={`/verify-email?email=${encodeURIComponent(unverifiedEmail)}`}
                  className="text-slate-600 hover:text-slate-900 underline"
                >
                  Verify Page
                </Link>
              </div>
            </div>
          )}

          <form onSubmit={submit} className="auth-form">
            {isRegister && (
              <label>
                Full Name
                <div className="input-wrap">
                  <UserRound size={17} />
                  <input
                    name="name"
                    value={form.name}
                    onChange={change}
                    placeholder="e.g. Sumit Thakur"
                    autoComplete="name"
                    required
                    minLength={2}
                  />
                </div>
              </label>
            )}

            <label>
              Email Address
              <div className="input-wrap">
                <Mail size={17} />
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={change}
                  placeholder="admin@relaycrm.io"
                  autoComplete="email"
                  required
                />
              </div>
            </label>

            <label>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <span>Password</span>
                {!isRegister && (
                  <Link
                    to="/forgot-password"
                    style={{ fontSize: '11px', color: 'var(--color-primary, #0D9488)', textDecoration: 'none', fontWeight: 600 }}
                  >
                    Forgot password?
                  </Link>
                )}
              </div>
              <div className="input-wrap">
                <LockKeyhole size={17} />
                <input
                  type={show ? 'text' : 'password'}
                  name="password"
                  value={form.password}
                  onChange={change}
                  placeholder="Minimum 8 characters"
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  className="reveal-btn"
                  onClick={() => setShow(!show)}
                  aria-label={show ? 'Hide password' : 'Show password'}
                >
                  {show ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>

            {!isRegister && (
              <div className="form-hint" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldCheck size={14} style={{ color: 'var(--color-primary)' }} />
                <span>Protected by single-owner session authentication and rate limiting.</span>
              </div>
            )}

            <button type="submit" className="primary-btn auth-submit" disabled={busy}>
              {busy ? 'Authenticating…' : isRegister ? 'Create workspace' : 'Sign in'}
              <ArrowRight size={17} />
            </button>
          </form>

          <div className="auth-switch">
            {isRegister ? (
              <>
                Already have an account? <Link to="/login">Sign in to workspace</Link>
              </>
            ) : (
              <>
                Need a Relay account? <Link to="/signup">Create account</Link>
              </>
            )}
          </div>

          <div className="auth-legal">
            Single-operator workspace. © Relay Real Estate WhatsApp Automation.
          </div>
        </div>
      </div>
    </div>
  );
}
