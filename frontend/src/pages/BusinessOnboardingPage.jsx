import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Building2,
  Dumbbell,
  Stethoscope,
  GraduationCap,
  Scissors,
  Car,
  Briefcase,
  Sparkles,
  Check,
  ArrowRight,
  ArrowLeft,
  Upload,
  Trash2,
  ShieldCheck,
  AlertCircle,
  RotateCw,
  CheckCircle2,
  Globe,
  Phone,
  Mail,
  MapPin,
  Clock,
  Languages,
  LogOut,
  Layers,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import {
  getOnboardingStatus,
  getOnboardingDraft,
  updateOnboardingDraft,
  uploadOnboardingLogo,
  deleteOnboardingLogo,
  completeOnboarding,
} from '../services/onboarding';

export const INDUSTRIES = [
  {
    key: 'real_estate',
    name: 'Real Estate',
    icon: Building2,
    tagline: 'Brokers, Developers & PropTech',
    description: 'Automate property enquiries, schedule site visits, and broadcast new project brochures.',
    accentColor: 'text-amber-500',
    metaDefaults: {
      operatingCity: 'Mumbai',
      propertyCategories: ['Residential', 'Commercial'],
      projectFocus: 'Luxury & High-Rise Apartments',
    },
  },
  {
    key: 'gym',
    name: 'Fitness & Gym',
    icon: Dumbbell,
    tagline: 'Gyms, Yoga & CrossFit Studios',
    description: 'Capture trial workout bookings, renew memberships, and send class schedule reminders.',
    accentColor: 'text-rose-500',
    metaDefaults: {
      gymType: 'Fitness & Strength Center',
      branchCount: '1-3 Locations',
      primaryPrograms: ['Strength Training', 'HIIT', 'Yoga'],
    },
  },
  {
    key: 'clinic',
    name: 'Healthcare & Clinic',
    icon: Stethoscope,
    tagline: 'Clinics, Dental & Diagnostic Centers',
    description: 'Streamline patient visit enquiries, share doctor availability, and send appointment alerts.',
    accentColor: 'text-blue-500',
    metaDefaults: {
      clinicType: 'Multi-Specialty Clinic',
      operatingHours: '9:00 AM - 8:00 PM',
      generalServices: ['Outpatient Consultations', 'Preventive Checkups'],
    },
  },
  {
    key: 'education',
    name: 'Education & Coaching',
    icon: GraduationCap,
    tagline: 'Institutes, Test Prep & Academies',
    description: 'Nurture admission leads, share syllabus brochures, and announce upcoming batch dates.',
    accentColor: 'text-indigo-500',
    metaDefaults: {
      institutionType: 'Professional Coaching Academy',
      learningMode: 'Hybrid (Online + Classroom)',
      courseCategories: ['Competitive Exams', 'Skill Development'],
    },
  },
  {
    key: 'salon',
    name: 'Salon & Wellness',
    icon: Scissors,
    tagline: 'Salons, Spas & Beauty Studios',
    description: 'Automate beauty appointments, share seasonal rate cards, and re-engage lapsed clients.',
    accentColor: 'text-pink-500',
    metaDefaults: {
      salonType: 'Unisex Premium Salon',
      primaryServices: ['Hair Styling', 'Skin Care', 'Bridal Packages'],
      operatingDays: 'Tuesday - Sunday',
    },
  },
  {
    key: 'automobile',
    name: 'Automobile & Dealerships',
    icon: Car,
    tagline: 'Dealers, Showrooms & Service Centers',
    description: 'Drive test drive bookings, service appointment reminders, and trade-in enquiries.',
    accentColor: 'text-teal-500',
    metaDefaults: {
      dealerType: 'Authorized 4-Wheeler Dealership',
      serviceOffered: ['New Vehicle Sales', 'Periodic Maintenance'],
      operatingTerritory: 'Regional Metro Area',
    },
  },
  {
    key: 'other',
    name: 'Professional Services',
    icon: Briefcase,
    tagline: 'Consulting, Agencies & B2B Services',
    description: 'General customer communication, quotation delivery, and inbound lead qualification.',
    accentColor: 'text-emerald-500',
    metaDefaults: {
      businessType: 'B2B Client Services',
      serviceCategory: 'Consulting & Implementation',
    },
  },
];

export default function BusinessOnboardingPage() {
  const { user, logout, refreshUser } = useAuth();
  const { refreshWorkspace } = useWorkspace();
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState(1);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [provisioningSuccess, setProvisioningSuccess] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Form State
  const [identity, setIdentity] = useState({
    name: '',
    email: '',
    phone: '',
    website: '',
    description: '',
  });

  const [industryKey, setIndustryKey] = useState('real_estate');

  const [details, setDetails] = useState({
    address: '',
    city: '',
    state: '',
    country: 'India',
    timezone: 'Asia/Kolkata',
    preferredLanguage: 'en',
    industryMetadata: {},
  });

  const [branding, setBranding] = useState({
    logoUrl: '',
    logoFilename: '',
    logoMimeType: '',
    logoSizeBytes: 0,
  });

  const [logoUploading, setLogoUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Load existing draft or check if user already has a workspace
  useEffect(() => {
    let isMounted = true;
    async function init() {
      try {
        const status = await getOnboardingStatus();
        if (!isMounted) return;

        if (status.hasWorkspace && status.workspace) {
          navigate('/app/getting-started');
          return;
        }

        if (status.draft) {
          const d = status.draft;
          setCurrentStep(d.step || 1);
          setIdentity({
            name: d.businessIdentity?.name || '',
            email: d.businessIdentity?.email || user?.email || '',
            phone: d.businessIdentity?.phone || '',
            website: d.businessIdentity?.website || '',
            description: d.businessIdentity?.description || '',
          });
          setIndustryKey(d.industryKey || 'real_estate');
          setDetails({
            address: d.businessDetails?.address || '',
            city: d.businessDetails?.city || '',
            state: d.businessDetails?.state || '',
            country: d.businessDetails?.country || 'India',
            timezone: d.businessDetails?.timezone || 'Asia/Kolkata',
            preferredLanguage: d.businessDetails?.preferredLanguage || 'en',
            industryMetadata: d.businessDetails?.industryMetadata || {},
          });
          setBranding(d.branding || {});
        } else {
          // Initialize fresh draft defaults
          setIdentity((prev) => ({
            ...prev,
            name: user?.name ? `${user.name}'s Business` : '',
            email: user?.email || '',
          }));
        }
      } catch (err) {
        if (isMounted) {
          const code = err.response?.data?.code;
          if (code === 'EMAIL_VERIFICATION_REQUIRED') {
            navigate('/verify-email');
          } else {
            setErrorMessage(err.response?.data?.message || 'Failed to initialize onboarding session.');
          }
        }
      } finally {
        if (isMounted) setLoadingInitial(false);
      }
    }

    init();
    return () => {
      isMounted = false;
    };
  }, [user, navigate]);

  // Persist draft to backend
  const persistDraft = async (stepToSave) => {
    setIsSaving(true);
    setErrorMessage('');
    try {
      await updateOnboardingDraft({
        step: stepToSave || currentStep,
        businessIdentity: identity,
        industryKey,
        businessDetails: details,
        branding,
      });
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Failed to save progress.');
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  // Step 1 Validation
  const validateStep1 = () => {
    if (!identity.name.trim() || identity.name.trim().length < 2) {
      setErrorMessage('Please enter a valid business name (minimum 2 characters).');
      return false;
    }
    if (!identity.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identity.email.trim())) {
      setErrorMessage('Please enter a valid business contact email address.');
      return false;
    }
    if (identity.phone.trim()) {
      const p = identity.phone.trim();
      const isE164 = /^\+[1-9]\d{7,14}$/.test(p);
      const isTenDigit = /^[6-9]\d{9}$/.test(p);
      if (!isE164 && !isTenDigit) {
        setErrorMessage('Business phone must be in international format (e.g. +919811223344) or a 10-digit mobile number.');
        return false;
      }
    }
    return true;
  };

  // Step Navigation Handlers
  const handleNext = async () => {
    setErrorMessage('');
    if (currentStep === 1) {
      if (!validateStep1()) return;
    }

    const nextStep = currentStep + 1;
    try {
      await persistDraft(nextStep);
      setCurrentStep(nextStep);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      // Error is set inside persistDraft
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setErrorMessage('');
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      persistDraft(prevStep).catch(() => {});
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Logo Upload Handler
  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input
    e.target.value = '';

    const validExts = ['image/png', 'image/jpeg', 'image/webp'];
    if (!validExts.includes(file.type)) {
      setErrorMessage('Unsupported image format. Allowed formats: PNG, JPEG, WEBP.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setErrorMessage('Logo file exceeds 2 MB size limit.');
      return;
    }

    setLogoUploading(true);
    setErrorMessage('');

    try {
      const result = await uploadOnboardingLogo(file);
      setBranding({
        logoUrl: result.logoUrl,
        logoFilename: result.filename,
        logoMimeType: result.mimeType,
        logoSizeBytes: result.sizeBytes,
      });
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Failed to upload logo.');
    } finally {
      setLogoUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    setLogoUploading(true);
    try {
      await deleteOnboardingLogo();
      setBranding({
        logoUrl: '',
        logoFilename: '',
        logoMimeType: '',
        logoSizeBytes: 0,
      });
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Failed to remove logo.');
    } finally {
      setLogoUploading(false);
    }
  };

  // Final Provisioning Handler
  const handleProvisionWorkspace = async () => {
    setIsProvisioning(true);
    setErrorMessage('');

    try {
      // 1. Ensure latest draft values are persisted
      await persistDraft(5);

      // 2. Execute atomic provisioning on backend
      const result = await completeOnboarding();

      setProvisioningSuccess(result);
      setCurrentStep(6);

      // 3. Refresh AuthContext and WorkspaceContext
      await refreshUser();
      await refreshWorkspace();
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Workspace provisioning failed. Please try again.');
    } finally {
      setIsProvisioning(false);
    }
  };

  const selectedIndustry = useMemo(
    () => INDUSTRIES.find((i) => i.key === industryKey) || INDUSTRIES[0],
    [industryKey]
  );

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (loadingInitial) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs font-semibold text-slate-600">Loading your business setup...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA] text-slate-900 flex flex-col justify-between">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-sm">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center text-teal-400 font-extrabold text-sm shadow">
            R
          </div>
          <span className="text-xl font-black tracking-tight text-slate-900">
            RELAY<span className="text-teal-600">.</span>
          </span>
          <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 border border-teal-200 text-teal-800 uppercase tracking-wider">
            Business Onboarding
          </span>
        </Link>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Verified Account:</span>
            <strong className="text-slate-800 font-semibold">{user?.email}</strong>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-xs font-semibold transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12 flex-1">
        {/* Step Indicator Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between max-w-2xl mx-auto mb-3">
            {[
              { num: 1, label: 'Identity' },
              { num: 2, label: 'Industry' },
              { num: 3, label: 'Details' },
              { num: 4, label: 'Branding' },
              { num: 5, label: 'Review' },
            ].map((step) => {
              const isPast = currentStep > step.num;
              const isCurrent = currentStep === step.num;
              return (
                <div key={step.num} className="flex flex-col items-center">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                      isPast
                        ? 'bg-teal-600 text-white'
                        : isCurrent
                        ? 'bg-slate-900 text-white ring-4 ring-teal-100'
                        : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {isPast ? <Check className="w-4 h-4" /> : step.num}
                  </div>
                  <span
                    className={`text-[11px] mt-1.5 font-semibold ${
                      isCurrent ? 'text-slate-900' : 'text-slate-500'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden max-w-2xl mx-auto">
            <div
              className="bg-teal-600 h-full transition-all duration-300"
              style={{ width: `${Math.min(100, ((currentStep - 1) / 4) * 100)}%` }}
            />
          </div>
        </div>

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-3 shadow-sm animate-in fade-in">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <span className="font-medium">{errorMessage}</span>
          </div>
        )}

        {/* Card Container */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden p-6 sm:p-10">
          {/* STEP 1: BUSINESS IDENTITY */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-[11px] font-bold uppercase tracking-wider mb-2">
                  <Sparkles className="w-3 h-3 text-teal-600" />
                  <span>Step 1 of 5</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  Business Identity
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 mt-1">
                  Tell us about your organization. This establishes your official business workspace and customer-facing identity.
                </p>
              </div>

              <div className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Business Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={identity.name}
                    onChange={(e) => setIdentity((p) => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. FitZone Athletics or Apex Realty"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none text-sm transition-all"
                    required
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Your official company, clinic, or studio name.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Business Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={identity.email}
                      onChange={(e) => setIdentity((p) => ({ ...p, email: e.target.value }))}
                      placeholder="e.g. contact@yourbusiness.com"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none text-sm transition-all"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Business Phone (WhatsApp inquiries)
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={identity.phone}
                      onChange={(e) => setIdentity((p) => ({ ...p, phone: e.target.value }))}
                      placeholder="+919811223344"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none text-sm transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Website or Social Profile (Optional)
                  </label>
                  <input
                    type="url"
                    name="website"
                    value={identity.website}
                    onChange={(e) => setIdentity((p) => ({ ...p, website: e.target.value }))}
                    placeholder="https://yourbusiness.com or instagram.com/page"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none text-sm transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Short Business Description (Optional)
                  </label>
                  <textarea
                    rows={3}
                    name="description"
                    value={identity.description}
                    onChange={(e) => setIdentity((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Briefly describe your services, target audience, or specialties..."
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none text-sm transition-all"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: INDUSTRY SELECTION */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-[11px] font-bold uppercase tracking-wider mb-2">
                  <Sparkles className="w-3 h-3 text-teal-600" />
                  <span>Step 2 of 5</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  Select Your Industry
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 mt-1">
                  Relay tailors your messaging workflows, auto-reply rules, and CRM fields specifically for your vertical.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2">
                {INDUSTRIES.map((ind) => {
                  const isSelected = industryKey === ind.key;
                  const Icon = ind.icon;
                  return (
                    <div
                      key={ind.key}
                      onClick={() => setIndustryKey(ind.key)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') setIndustryKey(ind.key);
                      }}
                      tabIndex={0}
                      role="button"
                      aria-pressed={isSelected}
                      className={`p-4 rounded-2xl border-2 transition-all cursor-pointer text-left flex flex-col justify-between ${
                        isSelected
                          ? 'border-teal-600 bg-teal-50/40 ring-4 ring-teal-100 shadow-md'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                              isSelected ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            <Icon className="w-5 h-5" />
                          </div>
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                              isSelected ? 'border-teal-600 bg-teal-600 text-white' : 'border-slate-300'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3" />}
                          </div>
                        </div>

                        <h3 className="text-sm font-bold text-slate-900">{ind.name}</h3>
                        <p className="text-[11px] font-semibold text-teal-700 mb-1">{ind.tagline}</p>
                        <p className="text-xs text-slate-500 leading-relaxed">{ind.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3: BUSINESS DETAILS */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-[11px] font-bold uppercase tracking-wider mb-2">
                  <Sparkles className="w-3 h-3 text-teal-600" />
                  <span>Step 3 of 5</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  Business Location & Preferences
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 mt-1">
                  Configure operating parameters, regional timezone, and industry-tailored configuration for{' '}
                  <strong className="text-slate-900">{selectedIndustry.name}</strong>.
                </p>
              </div>

              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">City</label>
                    <input
                      type="text"
                      name="city"
                      value={details.city}
                      onChange={(e) => setDetails((p) => ({ ...p, city: e.target.value }))}
                      placeholder="e.g. Mumbai, Bengaluru, Delhi"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none text-sm transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">State / Region</label>
                    <input
                      type="text"
                      name="state"
                      value={details.state}
                      onChange={(e) => setDetails((p) => ({ ...p, state: e.target.value }))}
                      placeholder="e.g. Maharashtra, Karnataka"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none text-sm transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Country</label>
                    <input
                      type="text"
                      name="country"
                      value={details.country}
                      onChange={(e) => setDetails((p) => ({ ...p, country: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none text-sm transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Operating Timezone</label>
                    <select
                      value={details.timezone}
                      onChange={(e) => setDetails((p) => ({ ...p, timezone: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none text-sm transition-all bg-white"
                    >
                      <option value="Asia/Kolkata">Asia/Kolkata (IST +5:30)</option>
                      <option value="Asia/Dubai">Asia/Dubai (GST +4:00)</option>
                      <option value="Asia/Singapore">Asia/Singapore (SGT +8:00)</option>
                      <option value="Europe/London">Europe/London (GMT/BST)</option>
                      <option value="America/New_York">America/New_York (EST/EDT)</option>
                      <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Primary Language</label>
                    <select
                      value={details.preferredLanguage}
                      onChange={(e) => setDetails((p) => ({ ...p, preferredLanguage: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none text-sm transition-all bg-white"
                    >
                      <option value="en">English (Default)</option>
                      <option value="hi">Hindi</option>
                      <option value="mr">Marathi</option>
                      <option value="ta">Tamil</option>
                      <option value="te">Telugu</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Physical / Registered Office Address (Optional)
                  </label>
                  <input
                    type="text"
                    name="address"
                    value={details.address}
                    onChange={(e) => setDetails((p) => ({ ...p, address: e.target.value }))}
                    placeholder="e.g. Unit 402, Signature Towers, BKC"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none text-sm transition-all"
                  />
                </div>

                {/* Industry-Specific Dynamic Preset Preview */}
                <div className="mt-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Layers className="w-4 h-4 text-teal-600" />
                    <span className="text-xs font-bold text-slate-800">
                      Industry Configuration Preview ({selectedIndustry.name})
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mb-3">
                    In SaaS Prompt 6, Relay will dynamically configure CRM fields and broadcast templates based on this configuration.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {Object.entries(selectedIndustry.metaDefaults).map(([key, val]) => (
                      <div key={key} className="p-2.5 rounded-xl bg-white border border-slate-200">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                          {key.replace(/([A-Z])/g, ' $1')}
                        </span>
                        <span className="font-semibold text-slate-800">
                          {Array.isArray(val) ? val.join(', ') : String(val)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: BRANDING & LOGO */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-[11px] font-bold uppercase tracking-wider mb-2">
                  <Sparkles className="w-3 h-3 text-teal-600" />
                  <span>Step 4 of 5</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  Business Logo & Branding
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 mt-1">
                  Upload your brand logo for your workspace navigation bar and customer broadcast headers.
                </p>
              </div>

              <div className="pt-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleLogoUpload}
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                />

                {branding.logoUrl ? (
                  /* Logo Preview Card */
                  <div className="p-6 rounded-2xl border-2 border-teal-500 bg-teal-50/30 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-sm">
                    <div className="flex items-center gap-5">
                      <div className="w-20 h-20 rounded-2xl bg-white border border-slate-200 p-2 flex items-center justify-center shadow-inner overflow-hidden">
                        <img
                          src={branding.logoUrl}
                          alt="Business Logo"
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">{identity.name || 'Brand Logo'}</h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {branding.logoFilename} • {(branding.logoSizeBytes / 1024).toFixed(1)} KB
                        </p>
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 mt-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Image Verified & Attached</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={logoUploading}
                        className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-sm transition-all"
                      >
                        Replace Logo
                      </button>
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        disabled={logoUploading}
                        className="px-3.5 py-2 rounded-xl bg-red-50 text-red-700 hover:bg-red-100 text-xs font-semibold transition-all flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Empty Upload Dropzone */
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 hover:border-teal-500 rounded-3xl p-10 text-center cursor-pointer transition-all bg-slate-50 hover:bg-teal-50/20 group"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 text-teal-600 flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-transform shadow-sm">
                      {logoUploading ? (
                        <RotateCw className="w-7 h-7 animate-spin" />
                      ) : (
                        <Upload className="w-7 h-7" />
                      )}
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 mb-1">
                      {logoUploading ? 'Uploading Logo...' : 'Upload Business Logo'}
                    </h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
                      Drag and drop your file here, or click to browse. Supported formats: PNG, JPEG, WEBP (Max 2 MB).
                    </p>

                    <button
                      type="button"
                      disabled={logoUploading}
                      className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold shadow hover:bg-slate-800 transition-all inline-flex items-center gap-2"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Choose File</span>
                    </button>
                  </div>
                )}

                <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-500 space-y-1">
                  <p className="font-semibold text-slate-700">Security & Integrity Notice:</p>
                  <p>• Logos undergo server-side magic byte inspection to prevent malicious file execution.</p>
                  <p>• If no logo is uploaded, Relay will use an attractive initials badge for your workspace.</p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: REVIEW INFORMATION */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-[11px] font-bold uppercase tracking-wider mb-2">
                  <Sparkles className="w-3 h-3 text-teal-600" />
                  <span>Step 5 of 5</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  Review & Confirm Setup
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 mt-1">
                  Please review your business details before provisioning your dedicated Relay workspace.
                </p>
              </div>

              <div className="space-y-4 pt-2">
                {/* Summary Card */}
                <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-4 text-xs">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                    <div className="flex items-center gap-4">
                      {branding.logoUrl ? (
                        <img
                          src={branding.logoUrl}
                          alt="Logo"
                          className="w-12 h-12 rounded-xl object-contain bg-white border border-slate-200 p-1"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-slate-900 text-teal-400 font-extrabold text-base flex items-center justify-center">
                          {identity.name?.slice(0, 2).toUpperCase() || 'BZ'}
                        </div>
                      )}
                      <div>
                        <h3 className="text-base font-extrabold text-slate-900">{identity.name}</h3>
                        <p className="text-slate-500">{identity.email}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="text-xs font-bold text-teal-600 hover:text-teal-700 underline"
                    >
                      Edit
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Industry</span>
                      <span className="font-semibold text-slate-900">{selectedIndustry.name}</span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Business Phone</span>
                      <span className="font-semibold text-slate-900">{identity.phone || 'Not provided'}</span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Location</span>
                      <span className="font-semibold text-slate-900">
                        {[details.city, details.state, details.country].filter(Boolean).join(', ') || 'India'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Timezone</span>
                      <span className="font-semibold text-slate-900">{details.timezone}</span>
                    </div>

                    {identity.website && (
                      <div className="sm:col-span-2">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Website</span>
                        <a
                          href={identity.website}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-teal-600 hover:underline flex items-center gap-1"
                        >
                          <span>{identity.website}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Provisioning Disclaimers */}
                <div className="p-4 rounded-2xl bg-teal-50 border border-teal-200 text-xs text-teal-900 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-teal-950">
                    <ShieldCheck className="w-4 h-4 text-teal-600" />
                    <span>Dedicated Workspace Boundaries</span>
                  </div>
                  <p className="leading-relaxed">
                    • An isolated business workspace will be created under your ownership in MongoDB.
                  </p>
                  <p className="leading-relaxed">
                    • <strong>Live WhatsApp Cloud API is not connected automatically.</strong> You can connect your sender during official WhatsApp setup.
                  </p>
                  <p className="leading-relaxed">
                    • <strong>Creating a workspace does not start billing charges.</strong> Relay subscription will be configured separately.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 6: PROVISIONING / COMPLETE */}
          {currentStep === 6 && (
            <div className="text-center py-8 space-y-6">
              <div className="w-20 h-20 rounded-3xl bg-teal-50 border-2 border-teal-200 text-teal-600 flex items-center justify-center mx-auto shadow-md">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <span className="px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-[11px] font-bold uppercase tracking-wider">
                  Workspace Provisioned Successfully
                </span>
                <h1 className="text-3xl font-extrabold text-slate-900 mt-3">
                  Welcome to {provisioningSuccess?.workspace?.name || identity.name}!
                </h1>
                <p className="text-sm text-slate-600 max-w-md mx-auto mt-2 leading-relaxed">
                  Your dedicated Relay workspace is ready. You have been granted full <strong>OWNER</strong> privileges.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 max-w-md mx-auto text-left text-xs space-y-2">
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500">Workspace Slug:</span>
                  <span className="font-mono font-bold text-slate-800">{provisioningSuccess?.workspace?.slug}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500">Industry:</span>
                  <span className="font-bold text-slate-800 capitalize">{selectedIndustry.name}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Owner Role:</span>
                  <span className="font-bold text-teal-600">OWNER (Full Administrative Access)</span>
                </div>
              </div>

              <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/app/getting-started')}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <span>Go to Workspace Setup</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Stepper Navigation Footer */}
          {currentStep < 6 && (
            <div className="mt-8 pt-6 border-t border-slate-200 flex items-center justify-between">
              {currentStep > 1 ? (
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={isSaving || isProvisioning}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-3">
                {currentStep < 5 ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={isSaving}
                    className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow transition-all flex items-center gap-2 disabled:opacity-60"
                  >
                    {isSaving ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <span>Continue</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleProvisionWorkspace}
                    disabled={isProvisioning}
                    className="px-8 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-60"
                  >
                    {isProvisioning ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Provisioning Workspace...</span>
                      </>
                    ) : (
                      <>
                        <span>Create Business Workspace</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-6 text-xs text-slate-400 border-t border-slate-200 bg-white">
        © {new Date().getFullYear()} Relay Automation Inc. All rights reserved. • Multi-Tenant WhatsApp Business Automation
      </footer>
    </div>
  );
}
