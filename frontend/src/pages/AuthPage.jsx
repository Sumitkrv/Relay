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
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
  });
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
        if (result?.user?.isPlatformAdmin) {
          navigate('/admin');
        } else if (result?.user?.role === 'agency_owner' || (!result?.hasWorkspace && form.email.toLowerCase().includes('agency'))) {
          navigate('/agency');
        } else if (result && result.hasWorkspace) {
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
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-extrabold text-lg shadow-md shadow-blue-500/20">
            R
          </div>
          <span className="text-xl font-bold tracking-tight text-white">
            Relay<span className="text-blue-500">.</span>
          </span>
        </div>

        <div className="visual-copy">
          <div className="eyebrow">
            <Sparkles size={14} /> MULTI-INDUSTRY SAAS AUTOMATION
          </div>
          <h1>
            Your business.
            <br />
            Your conversations.
            <br />
            <em>One workspace.</em>
          </h1>
          <p>
            Organize contacts, automate follow-ups and manage customer engagement from one platform.
          </p>
          <div className="visual-proof">
            <div className="proof-check">
              <Check size={14} />
            </div>
            <span>Single-Operator Multi-Tenant Architecture</span>
          </div>
        </div>

        <div className="visual-footer">
          Isolated multi-tenant SaaS. <span>© {new Date().getFullYear()} Relay Automation Inc.</span>
        </div>
      </div>

      {/* Auth Form Panel */}
      <div className="auth-form-side">
        <div className="auth-form-wrap">
          <div className="auth-mobile-brand brand">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-extrabold text-base shadow">
              R
            </div>
            <span className="text-xl font-black tracking-tight text-slate-900">
              Relay<span className="text-blue-600">.</span>
            </span>
          </div>

          <div className="form-kicker">
            {isRegister ? 'WORKSPACE REGISTRATION' : 'SECURE AUTHENTICATION'}
          </div>
          <h2>{isRegister ? 'Create business account' : 'Welcome back'}</h2>
          <p className="form-subtitle">
            {isRegister
              ? 'Register your account to begin business onboarding.'
              : 'Sign in to continue to your Relay workspace.'}
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
                  className="font-bold text-blue-700 hover:text-blue-900 underline flex items-center gap-1 disabled:opacity-50"
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

          {!isRegister && import.meta.env.DEV && (
            <div
              style={{
                marginBottom: '1.25rem',
                padding: '0.75rem 1rem',
                borderRadius: '10px',
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
              }}
            >
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e40af' }}>
                  🏢 M2W Realty Demo Account
                </div>
                <div style={{ fontSize: '12px', color: '#3b82f6', marginTop: '2px' }}>
                  Password: <code style={{ background: '#dbeafe', padding: '1px 5px', borderRadius: '4px', fontWeight: 600 }}>password123</code>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setForm({ name: '', email: 'owner.m2w@relay-demo.test', password: 'password123' })}
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '5px 10px',
                  borderRadius: '6px',
                  border: '1px solid #93c5fd',
                  background: '#ffffff',
                  color: '#1d4ed8',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Auto-fill
              </button>
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
                    placeholder="e.g. Rahul Sharma"
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
                  placeholder="name@company.com"
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
                    style={{ fontSize: '12px', color: '#2563EB', textDecoration: 'none', fontWeight: 600 }}
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
                <ShieldCheck size={14} style={{ color: '#2563EB' }} />
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
            Single-Operator secure workspace. © {new Date().getFullYear()} Relay Automation Inc.
          </div>
        </div>
      </div>
    </div>
  );
}
