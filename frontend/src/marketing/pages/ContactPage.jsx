import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Mail,
  Building2,
  Clock,
  Send,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Phone,
  User,
} from 'lucide-react';
import api from '../../services/api';

export default function ContactPage() {
  const [searchParams] = useSearchParams();

  const [formData, setFormData] = useState({
    fullName: '',
    businessEmail: '',
    businessName: '',
    industry: 'real_estate',
    contactReason: 'general',
    phone: '',
    message: '',
    honeypot: '', // bot trap
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successInfo, setSuccessInfo] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Check URL query parameters to pre-select reasons or industries
  useEffect(() => {
    const reasonParam = searchParams.get('reason');
    if (reasonParam && ['general', 'early_access', 'pricing', 'agency_partnership', 'technical'].includes(reasonParam)) {
      setFormData((prev) => ({ ...prev, contactReason: reasonParam }));
    }

    const industryParam = searchParams.get('industry');
    if (industryParam) {
      const normalized = industryParam.replace('-', '_');
      if (['real_estate', 'gym', 'clinic', 'education', 'salon', 'automobile', 'other'].includes(normalized)) {
        setFormData((prev) => ({ ...prev, industry: normalized }));
      }
    }
  }, [searchParams]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errorMessage) setErrorMessage('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Bot detection check
    if (formData.honeypot) {
      // Silently fail for bots
      setSuccessInfo({ enquiryId: 'ENQ-' + Date.now().toString(36).toUpperCase() });
      return;
    }

    // Client-side validation
    if (!formData.fullName.trim() || formData.fullName.trim().length < 2) {
      setErrorMessage('Please enter your full name (at least 2 characters).');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.businessEmail.trim() || !emailRegex.test(formData.businessEmail.trim())) {
      setErrorMessage('Please provide a valid business email address.');
      return;
    }

    if (!formData.businessName.trim() || formData.businessName.trim().length < 2) {
      setErrorMessage('Please enter your business or agency name.');
      return;
    }

    if (!formData.message.trim() || formData.message.trim().length < 5) {
      setErrorMessage('Please enter a brief message describing your inquiry (at least 5 characters).');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const response = await api.post('/public/contact', {
        fullName: formData.fullName.trim(),
        businessEmail: formData.businessEmail.trim(),
        businessName: formData.businessName.trim(),
        industry: formData.industry,
        contactReason: formData.contactReason,
        phone: formData.phone.trim(),
        message: formData.message.trim(),
      });

      if (response.data?.success) {
        setSuccessInfo({
          enquiryId: response.data.enquiryId,
          message: response.data.message || 'Your inquiry has been logged successfully.',
        });
        setFormData({
          fullName: '',
          businessEmail: '',
          businessName: '',
          industry: 'real_estate',
          contactReason: 'general',
          phone: '',
          message: '',
          honeypot: '',
        });
      } else {
        setErrorMessage(response.data?.message || 'Failed to submit inquiry. Please try again.');
      }
    } catch (err) {
      console.error('Contact form submission error:', err);
      const serverMsg = err.response?.data?.message || 'Unable to submit your inquiry at this moment. Please check your connection or email us directly.';
      setErrorMessage(serverMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Header */}
      <section className="relative overflow-hidden bg-slate-900 text-white pt-20 pb-24 lg:pt-28 lg:pb-32">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#0D9488_1px,transparent_1px)] [background-size:20px_20px]" />
        <div className="absolute top-1/4 -right-16 w-80 h-80 bg-teal-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-900/60 border border-teal-500/30 text-teal-300 text-xs font-semibold uppercase tracking-wider mb-6">
            <Mail className="w-3.5 h-3.5" />
            <span>Connect with our Team</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white mb-6">
            Let's Talk WhatsApp Automation
          </h1>

          <p className="text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Whether you want early access, custom agency onboarding, or have technical questions about Meta Cloud API coexistence, we are here to assist.
          </p>
        </div>
      </section>

      {/* Main Content Grid */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 sm:-mt-16 relative z-20 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Direct Info & Value */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900 mb-4">Direct Communication</h2>
              <p className="text-sm text-slate-600 leading-relaxed mb-6">
                Relay is engineered for real businesses with actual customers. Our product architects respond personally to every inquiry.
              </p>

              <div className="space-y-4">
                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 rounded-xl bg-teal-50 text-teal-600 shrink-0">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Email Inquiry</span>
                    <p className="text-sm font-bold text-slate-900 mt-0.5">support@relayautomation.io</p>
                    <p className="text-xs text-slate-500">Average response time: &lt; 24 hours</p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 rounded-xl bg-teal-50 text-teal-600 shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Support Hours</span>
                    <p className="text-sm font-bold text-slate-900 mt-0.5">Monday – Saturday</p>
                    <p className="text-xs text-slate-500">9:30 AM – 7:30 PM IST</p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 rounded-xl bg-teal-50 text-teal-600 shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Data Privacy</span>
                    <p className="text-sm font-bold text-slate-900 mt-0.5">100% Confidential</p>
                    <p className="text-xs text-slate-500">Your details are never shared with advertisers or third parties.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Agency Callout Box */}
            <div className="bg-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-800">
              <div className="flex items-center gap-2 text-teal-400 text-xs font-bold uppercase tracking-wider mb-2">
                <Sparkles className="w-4 h-4" />
                <span>Agency Partnerships</span>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Digital Agencies & Resellers</h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-4">
                Managing WhatsApp communications for multiple local business clients? Select <strong>Agency Partnership</strong> in the inquiry reason to discuss volume pricing and custom branding.
              </p>
              <div className="flex items-center gap-2 text-xs text-teal-300 font-semibold">
                <span>Multi-tenant client workspaces</span>
                <span>•</span>
                <span>White-label roadmap</span>
              </div>
            </div>
          </div>

          {/* Right Column: Contact Form */}
          <div className="lg:col-span-7">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-10 shadow-lg">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-900">Send Us a Message</h2>
                <p className="text-slate-600 text-sm mt-1">
                  Fill out the form below and we will get back to you promptly.
                </p>
              </div>

              {/* Success Notification */}
              {successInfo && (
                <div className="mb-6 p-4 rounded-xl bg-teal-50 border border-teal-200 text-teal-900 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold">Inquiry Received Successfully!</p>
                    <p className="text-xs mt-1 text-teal-800">{successInfo.message}</p>
                    {successInfo.enquiryId && (
                      <p className="text-xs mt-2 font-mono bg-white/70 px-2 py-1 rounded inline-block text-teal-900">
                        Reference ID: {successInfo.enquiryId}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Error Notification */}
              {errorMessage && (
                <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold">Submission Error</p>
                    <p className="text-xs mt-0.5 text-red-700">{errorMessage}</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Honeypot anti-spam trap */}
                <input
                  type="text"
                  name="honeypot"
                  value={formData.honeypot}
                  onChange={handleChange}
                  className="hidden"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                />

                {/* Name & Email Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="fullName" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="fullName"
                      name="fullName"
                      type="text"
                      required
                      placeholder="e.g. Rahul Sharma"
                      value={formData.fullName}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                    />
                  </div>

                  <div>
                    <label htmlFor="businessEmail" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Business Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="businessEmail"
                      name="businessEmail"
                      type="email"
                      required
                      placeholder="rahul@company.com"
                      value={formData.businessEmail}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                {/* Business Name & Phone Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="businessName" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Business / Organization <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="businessName"
                      name="businessName"
                      type="text"
                      required
                      placeholder="e.g. Apex Realty / CrossGym"
                      value={formData.businessName}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                    />
                  </div>

                  <div>
                    <label htmlFor="phone" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Phone Number <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={formData.phone}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                {/* Industry & Reason Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="industry" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Your Industry <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="industry"
                      name="industry"
                      value={formData.industry}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                    >
                      <option value="real_estate">Real Estate & Property</option>
                      <option value="gym">Gym & Fitness Studios</option>
                      <option value="clinic">Clinic & Healthcare</option>
                      <option value="education">Education & Coaching</option>
                      <option value="salon">Salon & Beauty Parlour</option>
                      <option value="automobile">Automobile Dealership</option>
                      <option value="other">Other Business Category</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="contactReason" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Contact Reason <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="contactReason"
                      name="contactReason"
                      value={formData.contactReason}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                    >
                      <option value="general">General Inquiry</option>
                      <option value="early_access">Early Access Registration</option>
                      <option value="pricing">Pricing & Custom Quota</option>
                      <option value="agency_partnership">Agency & Reseller Partnership</option>
                      <option value="technical">Meta Cloud API & Architecture</option>
                    </select>
                  </div>
                </div>

                {/* Message */}
                <div>
                  <label htmlFor="message" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    How Can We Help? <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    required
                    rows={4}
                    placeholder="Tell us about your team size, expected broadcast volumes, or specific automation questions..."
                    value={formData.message}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                  />
                </div>

                {/* Submit Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 px-6 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Sending Inquiry...</span>
                      </>
                    ) : (
                      <>
                        <span>Submit Inquiry</span>
                        <Send className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>

                {/* Privacy disclaimer */}
                <p className="text-[11px] text-slate-500 text-center pt-2">
                  By submitting this form, you acknowledge that your contact details will only be used to respond to this business inquiry in accordance with our{' '}
                  <Link to="/privacy" className="text-teal-600 underline hover:text-teal-700">
                    Privacy Policy
                  </Link>.
                </p>
              </form>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
