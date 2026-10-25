import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Lock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Mail,
  User,
  ShieldCheck,
  Eye,
  EyeOff,
  Check,
  RotateCw,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function SignupPage() {
  const { register, resendVerification } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreeToTerms: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Verification Pending Screen state
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    if (errorMessage) setErrorMessage('');
  };

  // Password strength calculator
  const passwordStrength = useMemo(() => {
    const p = formData.password;
    if (!p) return { score: 0, label: '', color: '' };
    let score = 0;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;

    if (score <= 1) return { score: 1, label: 'Weak', color: 'bg-red-500' };
    if (score === 2) return { score: 2, label: 'Fair', color: 'bg-amber-500' };
    if (score === 3) return { score: 3, label: 'Good', color: 'bg-blue-500' };
    return { score: 4, label: 'Strong', color: 'bg-emerald-600' };
  }, [formData.password]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim() || formData.name.trim().length < 2) {
      setErrorMessage('Full name must be at least 2 characters.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim() || !emailRegex.test(formData.email.trim())) {
      setErrorMessage('Please provide a valid business email address.');
      return;
    }

    if (formData.password.length < 8) {
      setErrorMessage('Password must be at least 8 characters.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    if (!formData.agreeToTerms) {
      setErrorMessage('Please accept the Terms of Service and Privacy Policy to proceed.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const response = await register({
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        confirmPassword: formData.confirmPassword,
      });

      if (response.success) {
        setRegisteredEmail(formData.email.trim().toLowerCase());
        setResendCooldown(60);
        // Start countdown
        const interval = setInterval(() => {
          setResendCooldown((prev) => {
            if (prev <= 1) {
              clearInterval(interval);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        setErrorMessage(response.message || 'Registration failed. Please try again.');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Unable to complete registration. Please check your connection.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || resendBusy || !registeredEmail) return;
    setResendBusy(true);
    setResendSuccess(false);
    try {
      await resendVerification(registeredEmail);
      setResendSuccess(true);
      setResendCooldown(60);
      const interval = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Could not resend verification email.');
    } finally {
      setResendBusy(false);
    }
  };

  return (
    <div className="bg-[#F4F7FC] min-h-screen py-12 sm:py-20 flex items-center justify-center">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12">
          
          {/* Left Brand Panel — Midnight Navy */}
          <div className="lg:col-span-5 bg-[#0B1220] text-white p-8 sm:p-10 flex flex-col justify-between border-r border-slate-800">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-900/50 border border-blue-500/30 text-blue-300 text-xs font-semibold uppercase tracking-wider mb-6">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Early Access Registration</span>
              </div>

              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-extrabold text-lg shadow-md shadow-blue-500/25">
                  R
                </div>
                <span className="text-2xl font-black tracking-tight text-white">
                  RELAY<span className="text-blue-500">.</span>
                </span>
              </div>

              <h1 className="text-3xl font-extrabold tracking-tight mb-4" style={{ color: '#FFFFFF' }}>
                Start with Relay
              </h1>

              <p className="text-sm leading-relaxed mb-6" style={{ color: '#CBD5E1' }}>
                Join modern businesses automating customer engagement, campaigns, and enquiries across official WhatsApp channels.
              </p>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-1 rounded-lg bg-blue-900/80 text-blue-400 mt-0.5 shrink-0">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs leading-snug" style={{ color: '#E2E8F0' }}>
                    Dedicated multi-tenant workspace with isolated MongoDB boundaries
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-1 rounded-lg bg-blue-900/80 text-blue-400 mt-0.5 shrink-0">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs leading-snug" style={{ color: '#E2E8F0' }}>
                    Zero-risk Mock Mode sandbox to simulate broadcasts before going live
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-1 rounded-lg bg-blue-900/80 text-blue-400 mt-0.5 shrink-0">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs leading-snug" style={{ color: '#E2E8F0' }}>
                    Separated Meta billing: you pay zero markups on WhatsApp conversation fees
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-8 mt-8 border-t border-slate-800 text-xs text-slate-400 space-y-2">
              <div>
                Already have an account?{' '}
                <Link to="/login" className="text-blue-400 font-bold hover:underline">
                  Sign in
                </Link>
              </div>
              <p className="text-[11px] text-slate-500">
                Enterprise priority inquiry? Submit via{' '}
                <Link to="/contact" className="text-slate-400 hover:text-white underline">
                  /public/contact
                </Link>
                .
              </p>
            </div>
          </div>

          {/* Right Content Panel */}
          <div className="lg:col-span-7 p-8 sm:p-10">
            {registeredEmail ? (
              /* Verification Pending State */
              <div className="py-6 space-y-5 text-center">
                <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center mx-auto shadow-sm">
                  <Mail className="w-8 h-8" />
                </div>

                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Check Your Inbox</h2>
                  <p className="text-sm text-slate-600 mt-1.5 max-w-md mx-auto">
                    We've sent a verification link to <strong className="text-slate-900">{registeredEmail}</strong>.
                    Please click the link in the email to activate your account.
                  </p>
                </div>

                {resendSuccess && (
                  <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs max-w-sm mx-auto flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    <span>A new verification link has been dispatched.</span>
                  </div>
                )}

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-600 max-w-md mx-auto text-left space-y-1.5">
                  <p className="font-semibold text-slate-900">Next Steps:</p>
                  <p>1. Open your email and click <strong>"Verify Email Address"</strong>.</p>
                  <p>2. You will be redirected to log in and begin business setup.</p>
                  <p>3. Check your spam or promotions folder if you don't see it within 2 minutes.</p>
                </div>

                <div className="pt-2 flex flex-col items-center gap-3">
                  <button
                    type="button"
                    disabled={resendCooldown > 0 || resendBusy}
                    onClick={handleResend}
                    className="inline-flex items-center gap-2 text-xs font-bold text-blue-600 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${resendBusy ? 'animate-spin' : ''}`} />
                    <span>
                      {resendCooldown > 0 ? `Resend email in ${resendCooldown}s` : 'Resend verification email'}
                    </span>
                  </button>

                  <Link
                    to="/login"
                    className="text-xs font-semibold text-slate-500 hover:text-slate-900 underline"
                  >
                    Return to Login
                  </Link>
                </div>
              </div>
            ) : (
              /* Signup Form */
              <div>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-slate-900">Create Your Account</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Enter your details to create your Relay business account.
                  </p>
                </div>

                {errorMessage && (
                  <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-center gap-2.5">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Full Name */}
                  <div>
                    <label htmlFor="name" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id="name"
                        name="name"
                        type="text"
                        required
                        autoComplete="name"
                        placeholder="e.g. Rahul Sharma"
                        value={formData.name}
                        onChange={handleChange}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  {/* Business Email */}
                  <div>
                    <label htmlFor="email" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Business Email <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id="email"
                        name="email"
                        type="email"
                        required
                        autoComplete="email"
                        placeholder="rahul@company.com"
                        value={formData.email}
                        onChange={handleChange}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  {/* Password & Confirm Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="password" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Password <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          id="password"
                          name="password"
                          type={showPassword ? 'text' : 'password'}
                          required
                          autoComplete="new-password"
                          placeholder="Min. 8 characters"
                          value={formData.password}
                          onChange={handleChange}
                          className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="confirmPassword" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Confirm Password <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          id="confirmPassword"
                          name="confirmPassword"
                          type={showConfirmPassword ? 'text' : 'password'}
                          required
                          autoComplete="new-password"
                          placeholder="Re-enter password"
                          value={formData.confirmPassword}
                          onChange={handleChange}
                          className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                          aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                        >
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Password Strength Indicator */}
                  {formData.password && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>Password Strength:</span>
                        <span className="font-semibold text-slate-700">{passwordStrength.label}</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden flex gap-1">
                        {[1, 2, 3, 4].map((step) => (
                          <div
                            key={step}
                            className={`h-full flex-1 rounded-full transition-all duration-300 ${
                              step <= passwordStrength.score ? passwordStrength.color : 'bg-slate-200'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Terms & Privacy Agreement */}
                  <div className="pt-1">
                    <label className="flex items-start gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        name="agreeToTerms"
                        checked={formData.agreeToTerms}
                        onChange={handleChange}
                        className="mt-0.5 w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                      />
                      <span className="text-xs text-slate-600 leading-snug">
                        I agree to the{' '}
                        <Link to="/terms" target="_blank" className="text-blue-600 underline hover:text-blue-700">
                          Terms of Service
                        </Link>{' '}
                        and{' '}
                        <Link to="/privacy" target="_blank" className="text-blue-600 underline hover:text-blue-700">
                          Privacy Policy
                        </Link>.
                      </span>
                    </label>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Creating Account...</span>
                        </>
                      ) : (
                        <>
                          <span>Create Account</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-500 text-center pt-1">
                    An email verification link will be sent to activate your account.
                  </p>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
