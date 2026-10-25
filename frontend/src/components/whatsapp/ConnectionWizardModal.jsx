import { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  Server,
  ShieldCheck,
  CreditCard,
  Layers,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  Lock,
  RefreshCw,
  Info,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  startWhatsAppOnboarding,
  selectWhatsAppMethod,
  advanceMockWhatsAppStep,
  cancelWhatsAppOnboarding,
} from '../../services/whatsAppConnection';

const CALLING_CODES = [
  { code: '+91', country: 'India (+91)' },
  { code: '+1', country: 'United States / Canada (+1)' },
  { code: '+44', country: 'United Kingdom (+44)' },
  { code: '+971', country: 'United Arab Emirates (+971)' },
  { code: '+65', country: 'Singapore (+65)' },
  { code: '+61', country: 'Australia (+61)' },
  { code: '+49', country: 'Germany (+49)' },
];

export default function ConnectionWizardModal({ isOpen, onClose, onComplete, initialAttempt = null }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [attemptId, setAttemptId] = useState(initialAttempt?._id || null);
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [connectionMethod, setConnectionMethod] = useState('EXISTING_APP_COEXISTENCE');
  const [simulatedScenario, setSimulatedScenario] = useState('SCENARIO_A_APP_ELIGIBLE');
  const [otpCode, setOtpCode] = useState('123456');
  const [billingVerified, setBillingVerified] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (initialAttempt) {
      setAttemptId(initialAttempt._id);
      setCurrentStep(initialAttempt.currentStep || 1);
      setConnectionMethod(initialAttempt.connectionMethod || 'EXISTING_APP_COEXISTENCE');
      setPhoneNumber(initialAttempt.requestedPhone || '');
    } else {
      setCurrentStep(1);
      setAttemptId(null);
      setErrorMsg('');
    }
  }, [initialAttempt, isOpen]);

  if (!isOpen) return null;

  // Step 1: Start onboarding with phone
  const handleStartStep1 = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!phoneNumber.trim()) {
      setErrorMsg('Please enter a WhatsApp phone number.');
      return;
    }

    setLoading(true);
    try {
      const res = await startWhatsAppOnboarding({
        requestedPhone: phoneNumber.trim(),
        countryCode,
        connectionMethod,
      });
      if (res.success) {
        setAttemptId(res.data._id);
        setCurrentStep(2);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to start onboarding.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Select Connection Type
  const handleSelectMethod = async (method) => {
    setConnectionMethod(method);
    if (!attemptId) return;

    setLoading(true);
    setErrorMsg('');
    try {
      const res = await selectWhatsAppMethod({ attemptId, connectionMethod: method });
      if (res.success) {
        setCurrentStep(3);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to select connection method.');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Meta Official Authorization Simulation
  const handleSimulateMetaAuth = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await advanceMockWhatsAppStep({
        attemptId,
        step: 3,
        scenario: simulatedScenario,
      });
      if (res.success) {
        toast.success('Simulated Meta authorization granted.');
        setCurrentStep(4);
      } else {
        setErrorMsg(res.reason || 'Authorization simulation stopped.');
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to simulate authorization.');
    } finally {
      setLoading(false);
    }
  };

  // Step 4: Verification Code
  const handleVerifyNumber = async () => {
    setLoading(true);
    setErrorMsg('');
    const scenario = otpCode === '123456' ? simulatedScenario : 'SCENARIO_E_VERIFICATION_FAILED';
    try {
      const res = await advanceMockWhatsAppStep({
        attemptId,
        step: 4,
        scenario,
        payload: { otpCode },
      });
      if (res.success) {
        toast.success('Phone number verified & Cloud API registered.');
        setCurrentStep(5);
      } else {
        setErrorMsg('Simulated verification failed: Invalid OTP code. (Use 123456 for success)');
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Verification failed.');
    } finally {
      setLoading(false);
    }
  };

  // Step 5: Customer Meta Messaging Billing Review
  const handleConfirmBilling = async () => {
    setLoading(true);
    setErrorMsg('');
    const scenario = billingVerified ? 'SCENARIO_A_APP_ELIGIBLE' : 'SCENARIO_F_BILLING_UNVERIFIED';
    try {
      const res = await advanceMockWhatsAppStep({
        attemptId,
        step: 5,
        scenario,
      });
      if (res.success) {
        toast.success('Billing responsibility confirmed.');
        setCurrentStep(6);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Billing review failed.');
    } finally {
      setLoading(false);
    }
  };

  // Step 6: Relay Software Subscription Review
  const handleReviewSubscription = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await advanceMockWhatsAppStep({
        attemptId,
        step: 6,
        scenario: simulatedScenario,
      });
      if (res.success) {
        setCurrentStep(7);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Subscription review failed.');
    } finally {
      setLoading(false);
    }
  };

  // Step 7: Final Mock Activation
  const handleCompleteSetup = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await advanceMockWhatsAppStep({
        attemptId,
        step: 7,
        scenario: simulatedScenario,
      });
      if (res.success) {
        toast.success('WhatsApp connection setup complete (Mock Simulator)!');
        if (onComplete) onComplete(res.connection);
        onClose();
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to complete connection setup.');
    } finally {
      setLoading(false);
    }
  };

  // Safe Cancel
  const handleCancel = async () => {
    if (attemptId) {
      try {
        await cancelWhatsAppOnboarding(attemptId);
      } catch {
        // Silent cancel
      }
    }
    onClose();
  };

  const steps = [
    { num: 1, title: 'Number' },
    { num: 2, title: 'Method' },
    { num: 3, title: 'Meta Auth' },
    { num: 4, title: 'Verify' },
    { num: 5, title: 'Meta Billing' },
    { num: 6, title: 'Relay Plan' },
    { num: 7, title: 'Readiness' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="bg-gray-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400 font-bold">
              WA
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">WhatsApp Connection Manager</h2>
              <p className="text-xs text-gray-400">Official Onboarding & Simulation Sandbox</p>
            </div>
          </div>
          <button
            onClick={handleCancel}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Bar */}
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-3">
          <div className="flex items-center justify-between">
            {steps.map((s, idx) => {
              const isPast = currentStep > s.num;
              const isCurrent = currentStep === s.num;
              return (
                <div key={s.num} className="flex items-center space-x-1.5">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                      isPast
                        ? 'bg-teal-600 text-white'
                        : isCurrent
                        ? 'bg-gray-900 text-teal-400 ring-2 ring-teal-500'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {isPast ? <CheckCircle2 className="w-3.5 h-3.5" /> : s.num}
                  </div>
                  <span
                    className={`text-xs font-medium hidden sm:inline ${
                      isCurrent ? 'text-gray-900 font-bold' : 'text-gray-500'
                    }`}
                  >
                    {s.title}
                  </span>
                  {idx < steps.length - 1 && <span className="text-gray-300 text-xs mx-1">›</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2 text-red-700 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Step Body */}
        <div className="p-6">
          {/* STEP 1: Enter Number */}
          {currentStep === 1 && (
            <form onSubmit={handleStartStep1} className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">Step 1 — Enter WhatsApp Number</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Enter the phone number you plan to use for your business WhatsApp messages.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Country</label>
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="w-full text-xs border border-gray-300 rounded-lg p-2.5 bg-white text-gray-900 focus:ring-2 focus:ring-teal-500"
                  >
                    {CALLING_CODES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.country}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    placeholder="9811223344"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full text-xs border border-gray-300 rounded-lg p-2.5 text-gray-900 focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>
              </div>

              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs text-gray-600 flex items-center space-x-2">
                <Info className="w-4 h-4 text-teal-600 flex-shrink-0" />
                <span>
                  Preview Normalized E.164: <strong className="text-gray-900">{countryCode} {phoneNumber.replace(/^0+/, '')}</strong>
                </span>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition disabled:opacity-50"
                >
                  <span>Continue</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: Choose Method */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">Step 2 — Choose Connection Type</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Relay supports both official Meta onboarding paths. Select the option that matches your setup.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {/* Option A */}
                <div
                  onClick={() => handleSelectMethod('EXISTING_APP_COEXISTENCE')}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition ${
                    connectionMethod === 'EXISTING_APP_COEXISTENCE'
                      ? 'border-teal-600 bg-teal-50/40 ring-1 ring-teal-500'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="w-10 h-10 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center mb-3">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-bold text-gray-900">Option A: WhatsApp Business App</h4>
                  <span className="inline-block px-2 py-0.5 mt-1 bg-teal-100 text-teal-800 text-[10px] font-semibold rounded">
                    Official Coexistence Path
                  </span>
                  <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                    Keep your existing WhatsApp Business App active on your phone while Relay automates campaigns and auto-replies simultaneously.
                  </p>
                </div>

                {/* Option B */}
                <div
                  onClick={() => handleSelectMethod('NEW_CLOUD_API')}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition ${
                    connectionMethod === 'NEW_CLOUD_API'
                      ? 'border-teal-600 bg-teal-50/40 ring-1 ring-teal-500'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center mb-3">
                    <Server className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-bold text-gray-900">Option B: Dedicated Cloud API Number</h4>
                  <span className="inline-block px-2 py-0.5 mt-1 bg-indigo-100 text-indigo-800 text-[10px] font-semibold rounded">
                    New / Clean Number
                  </span>
                  <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                    Connect a dedicated clean number directly to the official Meta Cloud API for high-volume enterprise broadcasting.
                  </p>
                </div>
              </div>

              <div className="flex justify-between items-center pt-4">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
                >
                  Back
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Meta Official Authorization */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">Step 3 — Meta Official Authorization (Simulated)</h3>
                <p className="text-xs text-gray-500 mt-1">
                  In live production, this opens Meta Embedded Signup dialog. In Phase 9, this executes a safe mock simulation.
                </p>
              </div>

              <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 space-y-1">
                <p className="font-semibold flex items-center space-x-1.5">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  <span>Sandbox Security Guard Active</span>
                </p>
                <p className="text-blue-700 leading-relaxed">
                  No real Facebook or Meta credentials are ever requested or stored. Relay never asks you to paste session cookies or passwords.
                </p>
              </div>

              <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200 space-y-2">
                <label className="block text-xs font-bold text-gray-800">Choose Simulation Scenario:</label>
                <select
                  value={simulatedScenario}
                  onChange={(e) => setSimulatedScenario(e.target.value)}
                  className="w-full text-xs border border-gray-300 rounded-lg p-2 bg-white text-gray-900 focus:ring-2 focus:ring-teal-500"
                >
                  <option value="SCENARIO_A_APP_ELIGIBLE">Scenario A — Business App Eligible & Authorized (Success)</option>
                  <option value="SCENARIO_B_APP_INELIGIBLE">Scenario B — Coexistence Ineligible (Simulated Warning)</option>
                  <option value="SCENARIO_D_AUTH_CANCELLED">Scenario D — User Exits / Authorization Cancelled</option>
                </select>
              </div>

              <div className="flex justify-between items-center pt-4">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleSimulateMetaAuth}
                  disabled={loading}
                  className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Simulate Meta Authorization</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Number Verification & Registration */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">Step 4 — Number Verification & Registration</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Simulate receiving and verifying the 6-digit confirmation code for your number.
                </p>
              </div>

              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
                <label className="block text-xs font-medium text-gray-700">
                  Simulated 6-Digit Verification Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  className="w-48 text-center tracking-widest text-lg font-mono border border-gray-300 rounded-lg p-2 bg-white text-gray-900 focus:ring-2 focus:ring-teal-500"
                />
                <p className="text-[11px] text-gray-500">
                  Tip: Enter <strong>123456</strong> for simulated verification success. Any other code simulates a verification error.
                </p>
              </div>

              <div className="flex justify-between items-center pt-4">
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleVerifyNumber}
                  disabled={loading}
                  className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition"
                >
                  <span>Verify & Register Number</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: Customer Meta Messaging Billing */}
          {currentStep === 5 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">Step 5 — WhatsApp Messaging Billing (Meta)</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Customer-direct Meta messaging fee policy and safety safeguards.
                </p>
              </div>

              <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3 text-xs">
                <div className="flex items-start space-x-2">
                  <CreditCard className="w-4 h-4 text-teal-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-gray-900">Customer-Direct Meta Messaging Billing:</strong>
                    <p className="text-gray-600 mt-0.5 leading-relaxed">
                      WhatsApp messaging fees are charged directly by Meta under your business&apos;s own Meta Business payment method.
                    </p>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-3">
                  <strong className="text-gray-900">Relay Financial Safety Policy:</strong>
                  <ul className="list-disc list-inside text-gray-600 mt-1 space-y-1">
                    <li>Relay NEVER attaches its partner line of credit to customer accounts.</li>
                    <li>Relay NEVER adds its credit card to customer WhatsApp Business Accounts.</li>
                    <li>If customer-direct billing cannot be confirmed, LIVE messaging remains strictly blocked.</li>
                  </ul>
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="billingCheck"
                  checked={billingVerified}
                  onChange={(e) => setBillingVerified(e.target.checked)}
                  className="h-4 w-4 text-teal-600 rounded border-gray-300 focus:ring-teal-500"
                />
                <label htmlFor="billingCheck" className="text-xs text-gray-800">
                  Simulate verified customer-direct payment method on Meta Business Manager
                </label>
              </div>

              <div className="flex justify-between items-center pt-4">
                <button
                  type="button"
                  onClick={() => setCurrentStep(4)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBilling}
                  disabled={loading}
                  className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition"
                >
                  <span>Confirm Billing Responsibility</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 6: Relay Software Subscription */}
          {currentStep === 6 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">Step 6 — Relay Software Subscription</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Relay provides the software platform. Subscription billing activates in SaaS Prompt 10.
                </p>
              </div>

              <div className="p-4 bg-teal-50 border border-teal-200 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-teal-900 text-sm">₹799 / month Launch Plan</span>
                  <span className="px-2 py-0.5 bg-teal-200 text-teal-800 rounded font-semibold text-[10px]">
                    Upcoming Phase 10
                  </span>
                </div>
                <p className="text-teal-800 leading-relaxed">
                  During Phase 9, Mock Mode allows full safe testing and configuration without requiring immediate payment. Live Razorpay subscription checkout is implemented in Prompt 10.
                </p>
              </div>

              <div className="flex justify-between items-center pt-4">
                <button
                  type="button"
                  onClick={() => setCurrentStep(5)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleReviewSubscription}
                  disabled={loading}
                  className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition"
                >
                  <span>Continue to Readiness</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 7: Connection Readiness */}
          {currentStep === 7 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">Step 7 — Connection Readiness & Activation</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Review independent connection criteria before completing the simulation setup.
                </p>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {[
                  { label: 'Meta Provider Authorization', ok: true, sim: true },
                  { label: 'Sender Identity (Phone Number ID)', ok: true, sim: true },
                  { label: 'Cloud API Registration & Verification', ok: true, sim: true },
                  { label: 'Webhook Routing & Event Processing', ok: true, sim: true },
                  { label: 'Customer-Direct Meta Billing', ok: billingVerified, sim: true },
                  { label: 'Relay Subscription (Prompt 10)', ok: false, note: 'Safe Sandbox Mode' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs">
                    <span className="font-medium text-gray-800">{item.label}</span>
                    <div className="flex items-center space-x-1.5">
                      {item.ok ? (
                        <span className="inline-flex items-center text-teal-700 font-semibold text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-teal-600" />
                          Simulated Ready
                        </span>
                      ) : (
                        <span className="text-amber-700 font-medium text-[11px]">
                          {item.note || 'Pending'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                <strong>Mock Mode Guarantee:</strong> Completing setup establishes a <code>MOCK_SIMULATED_READY</code> connection for safe internal testing. No live Meta sending is enabled.
              </div>

              <div className="flex justify-between items-center pt-4">
                <button
                  type="button"
                  onClick={() => setCurrentStep(6)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleCompleteSetup}
                  disabled={loading}
                  className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 transition shadow-sm"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Complete Mock Connection Setup</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
