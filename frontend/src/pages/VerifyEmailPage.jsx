import React, { useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  Mail,
  ArrowRight,
  RotateCw,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const emailParam = searchParams.get('email') || '';

  const { verifyEmail, resendVerification } = useAuth();
  const navigate = useNavigate();

  // Status: 'verifying' | 'success' | 'expired' | 'already_used' | 'invalid' | 'idle_resend'
  const [status, setStatus] = useState(token ? 'verifying' : 'idle_resend');
  const [errorMessage, setErrorMessage] = useState('');
  const [resendEmail, setResendEmail] = useState(emailParam);
  const [resendBusy, setResendBusy] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!token) {
      setStatus('idle_resend');
      return;
    }

    let isMounted = true;
    setStatus('verifying');

    verifyEmail(token)
      .then((data) => {
        if (isMounted) {
          setStatus('success');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        const code = err.response?.data?.code;
        const msg = err.response?.data?.message || 'Verification failed.';
        setErrorMessage(msg);

        if (code === 'TOKEN_EXPIRED') {
          setStatus('expired');
        } else if (code === 'TOKEN_ALREADY_USED') {
          setStatus('already_used');
        } else {
          setStatus('invalid');
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleResend = async (e) => {
    e.preventDefault();
    if (!resendEmail.trim() || cooldown > 0 || resendBusy) return;

    setResendBusy(true);
    setResendMessage('');
    setErrorMessage('');

    try {
      const res = await resendVerification(resendEmail.trim());
      setResendMessage(res.message || 'If an account exists, a new link has been sent.');
      setCooldown(60);
      const timer = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Failed to resend verification email.');
    } finally {
      setResendBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F7FC] flex items-center justify-center p-4 sm:p-6 py-16">
      <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 shadow-xl p-8 sm:p-10 text-center">
        {/* Brand */}
        <Link to="/" className="inline-flex items-center gap-2 text-xl font-bold tracking-tight text-slate-900 mb-8">
          <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-extrabold text-sm shadow">
            R
          </div>
          <span>RELAY<span className="text-blue-600">.</span></span>
        </Link>

        {/* 1. Verifying State */}
        {status === 'verifying' && (
          <div className="space-y-4 py-6">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <h2 className="text-xl font-bold text-slate-900">Verifying Your Email</h2>
            <p className="text-xs text-slate-500">Checking your security token with Relay server...</p>
          </div>
        )}

        {/* 2. Success State */}
        {status === 'success' && (
          <div className="space-y-5 py-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto border border-blue-200 shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Email Confirmed!</h2>
              <p className="text-xs text-slate-600 mt-1.5">
                Your email address has been verified. You can now sign in and set up your business workspace.
              </p>
            </div>
            <div className="pt-2">
              <Link
                to="/login"
                className="w-full py-3.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <span>Continue to Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}

        {/* 3. Expired State */}
        {status === 'expired' && (
          <div className="space-y-5 py-2">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
              <Clock className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Verification Link Expired</h2>
              <p className="text-xs text-slate-600 mt-1">
                Security verification links expire after 24 hours. Enter your email below to receive a fresh verification link.
              </p>
            </div>

            {resendMessage && (
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs">
                {resendMessage}
              </div>
            )}

            <form onSubmit={handleResend} className="space-y-3 pt-2">
              <input
                type="email"
                required
                placeholder="Enter your registered email"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={resendBusy || cooldown > 0}
                className="w-full py-3 rounded-xl bg-[#0B1220] hover:bg-[#111827] text-white font-bold text-xs shadow transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <RotateCw className={`w-3.5 h-3.5 ${resendBusy ? 'animate-spin' : ''}`} />
                <span>{cooldown > 0 ? `Wait ${cooldown}s` : 'Send Fresh Verification Email'}</span>
              </button>
            </form>

            <div className="pt-2">
              <Link to="/login" className="text-xs text-slate-500 hover:text-slate-900 underline">
                Return to Login
              </Link>
            </div>
          </div>
        )}

        {/* 4. Already Used State */}
        {status === 'already_used' && (
          <div className="space-y-5 py-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto border border-blue-200">
              <Sparkles className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Already Verified</h2>
              <p className="text-xs text-slate-600 mt-1.5">
                This verification link was already used. Your account is active and ready to use.
              </p>
            </div>
            <div className="pt-2">
              <Link
                to="/login"
                className="w-full py-3.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
              >
                <span>Sign In to Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}

        {/* 5. Invalid Token State */}
        {status === 'invalid' && (
          <div className="space-y-5 py-2">
            <div className="w-16 h-16 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto border border-red-200">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Invalid Link</h2>
              <p className="text-xs text-slate-600 mt-1">
                The verification token is broken or invalid. Please request a new verification email below.
              </p>
            </div>

            {resendMessage && (
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs">
                {resendMessage}
              </div>
            )}

            <form onSubmit={handleResend} className="space-y-3 pt-2">
              <input
                type="email"
                required
                placeholder="Enter your registered email"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={resendBusy || cooldown > 0}
                className="w-full py-3 rounded-xl bg-[#0B1220] hover:bg-[#111827] text-white font-bold text-xs shadow transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <RotateCw className={`w-3.5 h-3.5 ${resendBusy ? 'animate-spin' : ''}`} />
                <span>{cooldown > 0 ? `Wait ${cooldown}s` : 'Send Verification Email'}</span>
              </button>
            </form>

            <div className="pt-2">
              <Link to="/login" className="text-xs text-slate-500 hover:text-slate-900 underline">
                Return to Login
              </Link>
            </div>
          </div>
        )}

        {/* 6. Idle Resend / Verification Pending State */}
        {status === 'idle_resend' && (
          <div className="space-y-5 py-2">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto border border-blue-200">
              <Mail className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Verify Your Account</h2>
              <p className="text-xs text-slate-600 mt-1">
                Need a new confirmation link? Enter your email to resend your verification link.
              </p>
            </div>

            {resendMessage && (
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs">
                {resendMessage}
              </div>
            )}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleResend} className="space-y-3 pt-2">
              <input
                type="email"
                required
                placeholder="Enter your registered business email"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={resendBusy || cooldown > 0}
                className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <RotateCw className={`w-4 h-4 ${resendBusy ? 'animate-spin' : ''}`} />
                <span>{cooldown > 0 ? `Wait ${cooldown}s` : 'Resend Verification Email'}</span>
              </button>
            </form>

            <div className="pt-2">
              <Link to="/login" className="text-xs text-slate-500 hover:text-slate-900 underline">
                Return to Login
              </Link>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
