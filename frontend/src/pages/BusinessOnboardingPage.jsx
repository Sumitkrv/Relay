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
  Plane,
  ShoppingBag,
  Utensils,
  Wrench,
  Hotel,
  Store,
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
  CreditCard,
  CheckSquare,
  Search,
  X,
  FileText,
  ChevronRight,
  Info,
  BadgeCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { retryStarterProvisioning } from '../services/workspaces';
import { useWorkspace } from '../context/WorkspaceContext';
import { getIndustrySummaries } from '../services/industries';
import {
  getOnboardingStatus,
  getOnboardingDraft,
  updateOnboardingDraft,
  uploadOnboardingLogo,
  deleteOnboardingLogo,
  completeOnboarding,
} from '../services/onboarding';
import '../onboarding.css';

const INDUSTRY_ICONS = {
  Building2,
  Dumbbell,
  Stethoscope,
  GraduationCap,
  Sparkles,
  Scissors,
  Car,
  Plane,
  ShoppingBag,
  Utensils,
  Wrench,
  Hotel,
  Briefcase,
  Store,
};

const STEP_DEFINITIONS = [
  { num: 1, label: 'Identity', subtitle: 'Business Profile', icon: Building2 },
  { num: 2, label: 'Industry', subtitle: 'CRM & Messaging', icon: Layers },
  { num: 3, label: 'Details', subtitle: 'Location & Hours', icon: MapPin },
  { num: 4, label: 'Branding', subtitle: 'Logo & Assets', icon: Sparkles },
  { num: 5, label: 'Review', subtitle: 'Confirm & Launch', icon: CheckCircle2 },
];

export default function BusinessOnboardingPage() {
  const { user, logout, refreshUser } = useAuth();
  const { refreshWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const [industries, setIndustries] = useState([]);

  const [currentStep, setCurrentStep] = useState(1);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [provisioningSuccess, setProvisioningSuccess] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Step 2 Industry Search Filter
  const [industrySearch, setIndustrySearch] = useState('');

  // Drag and Drop active state
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Form State
  const [identity, setIdentity] = useState({
    name: '',
    email: '',
    phone: '',
    website: '',
    description: '',
  });

  // No preselected industry: the owner must choose explicitly (never default to Real Estate).
  const [industryKey, setIndustryKey] = useState('');

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
        const [status, catalog] = await Promise.all([getOnboardingStatus(), getIndustrySummaries()]);
        if (!isMounted) return;
        setIndustries(catalog);

        if (status.hasWorkspace && status.workspace) {
          navigate('/app');
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
          setIndustryKey(catalog.find((i) => i.key === d.industryKey || i.aliases?.includes(d.industryKey))?.key || '');
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
        ...(industryKey ? { industryKey } : {}),
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
    if (currentStep === 2 && !industries.some((i) => i.key === industryKey)) {
      setErrorMessage('Please select your business industry to continue.');
      return;
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

  const handleStepJump = async (stepNum) => {
    if (stepNum >= currentStep) return;
    setErrorMessage('');
    setCurrentStep(stepNum);
    persistDraft(stepNum).catch(() => {});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Logo Upload Handler
  const processLogoFile = async (file) => {
    if (!file) return;

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

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      e.target.value = '';
      await processLogoFile(file);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processLogoFile(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDraggingOver(false);
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

  const [isRetryingStarter, setIsRetryingStarter] = useState(false);
  const [starterRetryError, setStarterRetryError] = useState('');
  const handleRetryStarter = async () => {
    setIsRetryingStarter(true);
    setStarterRetryError('');
    try {
      const result = await retryStarterProvisioning();
      setProvisioningSuccess((prev) => ({
        ...prev,
        starterProvisioning: { ...(prev?.starterProvisioning || {}), ...result },
      }));
      if (result.status !== 'COMPLETED') {
        setStarterRetryError(result.message || 'Starter content is still incomplete. Please try again.');
      }
    } catch (err) {
      setStarterRetryError(err.response?.data?.message || 'Retry failed. Please try again.');
    } finally {
      setIsRetryingStarter(false);
    }
  };

  const selectedIndustry = useMemo(
    () => industries.find((i) => i.key === industryKey) || { key: '', name: 'No industry selected' },
    [industryKey, industries]
  );

  const filteredIndustries = useMemo(() => {
    if (!industrySearch.trim()) return industries;
    const q = industrySearch.toLowerCase().trim();
    return industries.filter(
      (ind) =>
        ind.name?.toLowerCase().includes(q) ||
        ind.displayLabel?.toLowerCase().includes(q) ||
        ind.description?.toLowerCase().includes(q) ||
        ind.key?.toLowerCase().includes(q)
    );
  }, [industries, industrySearch]);

  const businessInitials = useMemo(() => {
    const raw = identity.name.trim();
    if (!raw) return 'BZ';
    const words = raw.split(/\s+/).filter(Boolean);
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  }, [identity.name]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (loadingInitial) {
    return (
      <div className="ob-page-canvas flex flex-col items-center justify-center p-6 text-slate-900">
        <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-md flex items-center justify-center mb-4">
          <RotateCw className="w-6 h-6 text-blue-600 animate-spin" />
        </div>
        <h3 className="text-sm font-bold text-slate-900">Loading Business Workspace</h3>
        <p className="text-xs text-slate-500 mt-1">Preparing your verified setup session...</p>
      </div>
    );
  }

  return (
    <div className="ob-page-canvas flex flex-col justify-between text-slate-900">
      {/* Top Header Navbar */}
      <header className="ob-header sticky top-0 z-30 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-extrabold text-sm shadow-sm group-hover:bg-blue-700 transition-colors">
            R
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-black tracking-tight text-slate-900">
              RELAY<span className="text-blue-600">.</span>
            </span>
            <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 border border-blue-200 text-blue-800 uppercase tracking-wider">
              Business Onboarding
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-100" />
            <span className="hidden md:inline text-slate-500 font-medium">Verified Account:</span>
            <strong className="text-slate-800 font-semibold max-w-[150px] sm:max-w-[220px] truncate" title={user?.email}>
              {user?.email || 'Authenticated Owner'}
            </strong>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 text-xs font-semibold shadow-2xs transition-all"
            title="Sign out of current account"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-10 flex-1">
        {/* Stepper Header (Desktop & Tablet) */}
        {currentStep < 6 && (
          <div className="mb-8">
            {/* Desktop Stepper */}
            <div className="hidden md:block max-w-3xl mx-auto mb-4">
              <div className="ob-stepper-track">
                <div className="ob-stepper-line">
                  <div
                    className="ob-stepper-progress"
                    style={{ width: `${Math.min(100, ((currentStep - 1) / 4) * 100)}%` }}
                  />
                </div>

                {STEP_DEFINITIONS.map((step) => {
                  const isCompleted = currentStep > step.num;
                  const isCurrent = currentStep === step.num;
                  const Icon = step.icon;

                  return (
                    <div
                      key={step.num}
                      onClick={() => isCompleted && handleStepJump(step.num)}
                      className={`ob-step-node ${isCompleted ? 'is-clickable' : ''}`}
                      role={isCompleted ? 'button' : undefined}
                      tabIndex={isCompleted ? 0 : -1}
                      onKeyDown={(e) => {
                        if (isCompleted && (e.key === 'Enter' || e.key === ' ')) {
                          handleStepJump(step.num);
                        }
                      }}
                      title={isCompleted ? `Return to Step ${step.num}: ${step.label}` : undefined}
                    >
                      <div
                        className={`ob-step-circle ${
                          isCompleted ? 'completed' : isCurrent ? 'active' : 'upcoming'
                        }`}
                      >
                        {isCompleted ? <Check className="w-4 h-4 stroke-[3]" /> : <Icon className="w-4 h-4" />}
                      </div>
                      <span
                        className={`text-xs mt-2 font-bold tracking-tight transition-colors ${
                          isCurrent ? 'text-blue-600' : isCompleted ? 'text-slate-800' : 'text-slate-400'
                        }`}
                      >
                        {step.label}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium hidden lg:block">
                        {step.subtitle}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Mobile / Tablet Compact Stepper */}
            <div className="md:hidden max-w-md mx-auto">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">
                    {currentStep}
                  </span>
                  <span>{STEP_DEFINITIONS[currentStep - 1]?.label}</span>
                </span>
                <span className="text-slate-500 font-medium">Step {currentStep} of 5</span>
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-blue-600 h-full transition-all duration-300"
                  style={{ width: `${Math.min(100, (currentStep / 5) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center justify-between gap-3 shadow-sm animate-in fade-in">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span className="font-medium">{errorMessage}</span>
            </div>
            {!industries.length ? (
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-semibold text-xs hover:bg-rose-700 transition-colors"
              >
                Retry industry catalog
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setErrorMessage('')}
                className="text-rose-500 hover:text-rose-700 p-1"
                aria-label="Dismiss error"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Onboarding Main Card */}
        <div className="ob-card-shell p-6 sm:p-8 lg:p-10">
          {/* STEP 1: BUSINESS IDENTITY */}
          {currentStep === 1 && (
            <div className="ob-animate-fade space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-5">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-[11px] font-bold uppercase tracking-wider mb-2">
                    <Sparkles className="w-3 h-3 text-blue-600" />
                    <span>Step 1 of 5 · Workspace Identity</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                    Business Identity
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    Tell us about your organization. This establishes your official business workspace and customer-facing identity.
                  </p>
                </div>
              </div>

              {/* Two-Column Responsive Layout: Left Form + Right Live Workspace Preview */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-2">
                {/* Form Inputs (7 Cols) */}
                <div className="lg:col-span-7 space-y-4">
                  {/* Business Name */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Business Name <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        type="text"
                        name="name"
                        value={identity.name}
                        onChange={(e) => setIdentity((p) => ({ ...p, name: e.target.value }))}
                        placeholder="e.g. FitZone Athletics or Apex Realty"
                        className="ob-input"
                        required
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Your official company, clinic, or studio name.
                    </p>
                  </div>

                  {/* Email & Phone Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Business Email <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                        <input
                          type="email"
                          name="email"
                          value={identity.email}
                          onChange={(e) => setIdentity((p) => ({ ...p, email: e.target.value }))}
                          placeholder="e.g. contact@yourbusiness.com"
                          className="ob-input"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Business Phone (WhatsApp inquiries)
                      </label>
                      <div className="relative">
                        <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                        <input
                          type="tel"
                          name="phone"
                          value={identity.phone}
                          onChange={(e) => setIdentity((p) => ({ ...p, phone: e.target.value }))}
                          placeholder="+919811223344"
                          className="ob-input"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Website */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-slate-700">
                        Website or Social Profile (Optional)
                      </label>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Optional</span>
                    </div>
                    <div className="relative">
                      <Globe className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        type="url"
                        name="website"
                        value={identity.website}
                        onChange={(e) => setIdentity((p) => ({ ...p, website: e.target.value }))}
                        placeholder="https://yourbusiness.com or instagram.com/page"
                        className="ob-input"
                      />
                    </div>
                  </div>

                  {/* Short Description */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-slate-700">
                        Short Business Description (Optional)
                      </label>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Optional</span>
                    </div>
                    <textarea
                      rows={3}
                      name="description"
                      value={identity.description}
                      onChange={(e) => setIdentity((p) => ({ ...p, description: e.target.value }))}
                      placeholder="Briefly describe your services, target audience, or specialties..."
                      className="ob-textarea"
                    />
                  </div>
                </div>

                {/* Right Column: Live Workspace Identity Preview Card (5 Cols) */}
                <div className="lg:col-span-5">
                  <div className="ob-preview-card p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                        <span>Live Workspace Preview</span>
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Ready</span>
                      </span>
                    </div>

                    {/* Simulated Topbar Identity Badge */}
                    <div className="p-3.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-[#0B1220] text-blue-400 font-extrabold text-base flex items-center justify-center shrink-0 shadow-sm border border-slate-800">
                          {businessInitials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-extrabold text-slate-900 truncate">
                            {identity.name.trim() || 'Your Business Name'}
                          </h4>
                          <p className="text-xs text-slate-500 truncate">
                            {identity.email.trim() || 'contact@yourbusiness.com'}
                          </p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-2 text-[11px] text-slate-600">
                        {identity.phone ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{identity.phone}</span>
                          </span>
                        ) : null}
                        {identity.website ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-700 truncate max-w-[200px]">
                            <Globe className="w-3 h-3 text-blue-500 shrink-0" />
                            <span className="truncate">{identity.website.replace(/^https?:\/\//, '')}</span>
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {/* Customer-Facing Broadcast Header Mockup */}
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <span>WhatsApp Sender Header</span>
                        <span className="text-blue-600 font-semibold">Live Simulation</span>
                      </div>
                      <p className="text-slate-600 text-[11px] leading-relaxed">
                        This business identity will be displayed in your outbound broadcasts, customer auto-replies, and administrative CRM records.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: INDUSTRY SELECTION */}
          {currentStep === 2 && (
            <div className="ob-animate-fade space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-[11px] font-bold uppercase tracking-wider mb-2">
                    <Sparkles className="w-3 h-3 text-blue-600" />
                    <span>Step 2 of 5 · Domain Adaptation</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                    Select Your Industry
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    Relay tailors your messaging workflows, auto-reply rules, and CRM fields specifically for your vertical.
                  </p>
                </div>

                {/* Real-time Industry Search Filter */}
                <div className="w-full sm:w-64 relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={industrySearch}
                    onChange={(e) => setIndustrySearch(e.target.value)}
                    placeholder="Search industries..."
                    className="ob-input h-10 text-xs pl-9 pr-8"
                  />
                  {industrySearch && (
                    <button
                      type="button"
                      onClick={() => setIndustrySearch('')}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Industry Grid: Responsive 3 cols on desktop, 2 on tablet, 1 on mobile (industries.map) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-2">
                {(industrySearch.trim() ? filteredIndustries : industries).map((ind) => {
                  const isSelected = industryKey === ind.key;
                  const Icon = INDUSTRY_ICONS[ind.icon] || Briefcase;

                  return (
                    <div
                      key={ind.key}
                      onClick={() => setIndustryKey(ind.key)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setIndustryKey(ind.key);
                        }
                      }}
                      tabIndex={0}
                      role="radio"
                      aria-checked={isSelected}
                      className={`ob-industry-card ${isSelected ? 'is-selected' : ''}`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div className={`ob-industry-icon ${isSelected ? 'is-selected' : 'not-selected'}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                              isSelected
                                ? 'border-blue-600 bg-blue-600 text-white shadow-xs'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="text-sm font-extrabold text-slate-900">{ind.name}</h3>
                          {ind.displayLabel && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                              {ind.displayLabel}
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                          {ind.description}
                        </p>
                      </div>

                      {/* Dynamic Backend Pack Highlights */}
                      {(ind.templateCount || ind.quickReplyCount) && (
                        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center gap-2 text-[11px] text-slate-500">
                          <span className="font-semibold text-slate-700">
                            {ind.templateCount} Templates
                          </span>
                          <span>•</span>
                          <span className="font-semibold text-slate-700">
                            {ind.quickReplyCount} Quick Replies
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {filteredIndustries.length === 0 && (
                <div className="text-center py-12 bg-slate-50 rounded-2xl border border-slate-200">
                  <Briefcase className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-700">No industries match "{industrySearch}"</p>
                  <button
                    type="button"
                    onClick={() => setIndustrySearch('')}
                    className="mt-2 text-xs font-semibold text-blue-600 hover:underline"
                  >
                    Clear search filter
                  </button>
                </div>
              )}

              {/* Selection Summary Dock */}
              {industryKey && (
                <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                      {(() => {
                        const Icon = INDUSTRY_ICONS[selectedIndustry.icon] || Briefcase;
                        return <Icon className="w-5 h-5" />;
                      })()}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900">
                        Selected Vertical: {selectedIndustry.name}
                      </h4>
                      <p className="text-xs text-blue-700">
                        Relay will configure tailored CRM lead fields, starter messaging templates, and keyword auto-reply rules for your workspace.
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5 text-xs font-bold text-blue-800 bg-white/80 px-3 py-1.5 rounded-lg border border-blue-200">
                    <Check className="w-3.5 h-3.5 text-blue-600" />
                    <span>Vertical Configured</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: BUSINESS DETAILS */}
          {currentStep === 3 && (
            <div className="ob-animate-fade space-y-6">
              <div className="border-b border-slate-100 pb-5">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-[11px] font-bold uppercase tracking-wider mb-2">
                  <Sparkles className="w-3 h-3 text-blue-600" />
                  <span>Step 3 of 5 · Regional Preferences</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  Business Location & Preferences
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  Configure operating parameters, regional timezone, and industry-tailored configuration for{' '}
                  <strong className="text-slate-900">{selectedIndustry.name}</strong>.
                </p>
              </div>

              <div className="space-y-6 pt-2">
                {/* Visual Section 1: Business Location */}
                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                    <MapPin className="w-4 h-4 text-blue-600" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Business Location & Address
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">City</label>
                      <input
                        type="text"
                        name="city"
                        value={details.city}
                        onChange={(e) => setDetails((p) => ({ ...p, city: e.target.value }))}
                        placeholder="e.g. Mumbai, Bengaluru, Delhi"
                        className="ob-input ob-input-no-icon"
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
                        className="ob-input ob-input-no-icon"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Country</label>
                      <input
                        type="text"
                        name="country"
                        value={details.country}
                        onChange={(e) => setDetails((p) => ({ ...p, country: e.target.value }))}
                        className="ob-input ob-input-no-icon"
                      />
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
                        className="ob-input ob-input-no-icon"
                      />
                    </div>
                  </div>
                </div>

                {/* Visual Section 2: Operating Preferences */}
                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                    <Clock className="w-4 h-4 text-blue-600" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Operating Preferences
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Operating Timezone</label>
                      <select
                        value={details.timezone}
                        onChange={(e) => setDetails((p) => ({ ...p, timezone: e.target.value }))}
                        className="ob-select"
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
                        className="ob-select"
                      >
                        <option value="en">English (Default)</option>
                        <option value="hi">Hindi</option>
                        <option value="mr">Marathi</option>
                        <option value="ta">Tamil</option>
                        <option value="te">Telugu</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Visual Section 3: Industry-Specific Dynamic Preset Preview */}
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-blue-600" />
                      <span className="text-xs font-bold text-slate-800">
                        Industry Configuration Preview ({selectedIndustry.name})
                      </span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                      Automatic Provisioning
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Relay configures your CRM fields and message templates based on this industry setup.
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
                    <div className="p-3 rounded-xl bg-white border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                        Starter Templates
                      </span>
                      <span className="text-base font-extrabold text-slate-900">
                        {selectedIndustry.templateCount ?? 'Configured'}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-white border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                        Quick Replies
                      </span>
                      <span className="text-base font-extrabold text-slate-900">
                        {selectedIndustry.quickReplyCount ?? 'Configured'}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-white border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                        Starter Rules
                      </span>
                      <span className="text-base font-extrabold text-slate-900">
                        {selectedIndustry.ruleCount ?? 'Prepared'}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-white border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                        Campaign Drafts
                      </span>
                      <span className="text-base font-extrabold text-slate-900">
                        {selectedIndustry.campaignCount ?? 'Prepared'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: BRANDING & LOGO */}
          {currentStep === 4 && (
            <div className="ob-animate-fade space-y-6">
              <div className="border-b border-slate-100 pb-5">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-[11px] font-bold uppercase tracking-wider mb-2">
                  <Sparkles className="w-3 h-3 text-blue-600" />
                  <span>Step 4 of 5 · Brand Assets</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  Business Logo & Branding
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  Upload your brand logo for your workspace navigation bar and customer broadcast headers.
                </p>
              </div>

              <div className="pt-2 space-y-6">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleLogoUpload}
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                />

                {branding.logoUrl ? (
                  /* Logo Preview Card */
                  <div className="p-6 rounded-2xl border-2 border-blue-500 bg-blue-50/30 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-sm">
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
                        className="ob-btn-secondary text-xs"
                      >
                        Replace Logo
                      </button>
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        disabled={logoUploading}
                        className="px-3.5 py-2 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-semibold transition-all flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Premium Drag and Drop Dropzone */
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    className={`ob-dropzone ${isDraggingOver ? 'is-dragging' : ''}`}
                  >
                    <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 text-blue-600 flex items-center justify-center mx-auto mb-4 shadow-sm">
                      {logoUploading ? (
                        <RotateCw className="w-7 h-7 animate-spin text-blue-600" />
                      ) : (
                        <Upload className="w-7 h-7 text-blue-600" />
                      )}
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 mb-1">
                      {logoUploading ? 'Uploading Logo...' : 'Upload Business Logo'}
                    </h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4 leading-relaxed">
                      Drag and drop your file here, or click to browse. Supported formats: PNG, JPEG, WEBP (Max 2 MB).
                    </p>

                    <button
                      type="button"
                      disabled={logoUploading}
                      className="ob-btn-primary py-2 px-5 text-xs"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Choose File</span>
                    </button>
                  </div>
                )}

                {/* Initials Fallback Display */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#0B1220] text-blue-400 font-extrabold text-sm flex items-center justify-center shrink-0">
                      {businessInitials}
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-slate-800">Workspace Initials Avatar Fallback</h5>
                      <p className="text-[11px] text-slate-500">
                        Uploading a logo is optional. If skipped, Relay uses this sleek initials badge in your top navigation bar.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Security & Integrity Notice */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                    <span>Security & Integrity Notice:</span>
                  </div>
                  <p>• Logos undergo server-side magic byte inspection to prevent malicious file execution.</p>
                  <p>• If no logo is uploaded, Relay will use an attractive initials badge for your workspace.</p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: REVIEW INFORMATION */}
          {currentStep === 5 && (
            <div className="ob-animate-fade space-y-6">
              <div className="border-b border-slate-100 pb-5">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-[11px] font-bold uppercase tracking-wider mb-2">
                  <Sparkles className="w-3 h-3 text-blue-600" />
                  <span>Step 5 of 5 · Final Confirmation</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  Review & Confirm Setup
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  Please review your business details before provisioning your dedicated Relay workspace.
                </p>
              </div>

              <div className="space-y-4 pt-2">
                {/* Executive Summary Card */}
                <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-5 text-xs">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                    <div className="flex items-center gap-4">
                      {branding.logoUrl ? (
                        <img
                          src={branding.logoUrl}
                          alt="Logo"
                          className="w-12 h-12 rounded-xl object-contain bg-white border border-slate-200 p-1 shadow-2xs"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-[#0B1220] text-blue-400 font-extrabold text-base flex items-center justify-center shadow-sm">
                          {businessInitials}
                        </div>
                      )}
                      <div>
                        <h3 className="text-base font-extrabold text-slate-900">{identity.name || 'Your Business'}</h3>
                        <p className="text-slate-500">{identity.email}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="text-xs font-bold text-blue-600 hover:text-blue-700 underline flex items-center gap-1"
                    >
                      <span>Edit</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-3 rounded-xl bg-white border border-slate-200">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Industry</span>
                        <button
                          type="button"
                          onClick={() => setCurrentStep(2)}
                          className="text-[10px] font-bold text-blue-600 hover:underline"
                        >
                          Change
                        </button>
                      </div>
                      <span className="font-bold text-slate-900 text-sm">{selectedIndustry.name}</span>
                    </div>

                    <div className="p-3 rounded-xl bg-white border border-slate-200">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Business Phone</span>
                        <button
                          type="button"
                          onClick={() => setCurrentStep(1)}
                          className="text-[10px] font-bold text-blue-600 hover:underline"
                        >
                          Change
                        </button>
                      </div>
                      <span className="font-bold text-slate-900 text-sm">{identity.phone || 'Not provided'}</span>
                    </div>

                    <div className="p-3 rounded-xl bg-white border border-slate-200">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Location</span>
                        <button
                          type="button"
                          onClick={() => setCurrentStep(3)}
                          className="text-[10px] font-bold text-blue-600 hover:underline"
                        >
                          Change
                        </button>
                      </div>
                      <span className="font-bold text-slate-900 text-sm">
                        {[details.city, details.state, details.country].filter(Boolean).join(', ') || 'India'}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-white border border-slate-200">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Timezone</span>
                        <button
                          type="button"
                          onClick={() => setCurrentStep(3)}
                          className="text-[10px] font-bold text-blue-600 hover:underline"
                        >
                          Change
                        </button>
                      </div>
                      <span className="font-bold text-slate-900 text-sm">{details.timezone}</span>
                    </div>

                    {identity.website && (
                      <div className="sm:col-span-2 p-3 rounded-xl bg-white border border-slate-200">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Website</span>
                        <a
                          href={identity.website}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-blue-600 hover:underline flex items-center gap-1"
                        >
                          <span>{identity.website}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Plan & 14-Day Trial Included Card */}
                <div className="p-5 rounded-2xl bg-blue-50/70 border border-blue-200 text-xs text-blue-950 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-900 text-sm">Relay Solo Plan</span>
                        <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold">
                          14-Day Free Trial
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        ₹799/month after trial • Mock billing enabled (no credit card charged during demo testing)
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg">
                      Trial Ready
                    </span>
                  </div>
                </div>

                {/* Provisioning Disclaimers & Security */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                    <span>Dedicated Workspace Boundaries & Server Authorization</span>
                  </div>
                  <p className="leading-relaxed">
                    • An isolated business workspace will be created under your ownership in MongoDB with authoritative <strong>OWNER</strong> role.
                  </p>
                  <p className="leading-relaxed">
                    • <strong>Live WhatsApp Cloud API is not connected automatically.</strong> You can connect your official sender during Meta WhatsApp setup.
                  </p>
                  <p className="leading-relaxed">
                    • <strong>Creating a workspace does not start billing charges.</strong> Mock billing mode is active for safe local experimentation.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 6: PROVISIONING / COMPLETE */}
          {currentStep === 6 && (
            <div className="text-center py-8 space-y-6 ob-animate-fade">
              <div className="w-20 h-20 rounded-3xl bg-blue-50 border-2 border-blue-200 text-blue-600 flex items-center justify-center mx-auto shadow-md">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <span className="px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-[11px] font-bold uppercase tracking-wider">
                  Workspace Provisioned Successfully
                </span>
                <h1 className="text-3xl font-extrabold text-slate-900 mt-3">
                  Welcome to {provisioningSuccess?.workspace?.name || identity.name}!
                </h1>
                <p className="text-sm text-slate-600 max-w-md mx-auto mt-2 leading-relaxed">
                  Your dedicated Relay workspace is ready. You have been granted full <strong>OWNER</strong> privileges.
                </p>
              </div>

              {/* Workspace Details Card */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 max-w-md mx-auto text-left text-xs space-y-2.5">
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500">Workspace Slug:</span>
                  <span className="font-mono font-bold text-slate-800">{provisioningSuccess?.workspace?.slug}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500">Industry:</span>
                  <span className="font-bold text-slate-800 capitalize">{selectedIndustry.name}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500">Trial Period:</span>
                  <span className="font-bold text-emerald-700">14 Days Free (Relay Solo)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500">Owner Role:</span>
                  <span className="font-bold text-blue-600">OWNER (Full Administrative Access)</span>
                </div>
                <div className="flex justify-between py-1" id="onboarding-starter-status">
                  <span className="text-slate-500">Starter Content:</span>
                  {provisioningSuccess?.starterProvisioning?.status === 'COMPLETED' ? (
                    <span className="font-bold text-slate-800">
                      {provisioningSuccess.starterProvisioning.counts?.templates ?? 0} templates · {provisioningSuccess.starterProvisioning.counts?.quickReplies ?? 0} quick replies · {provisioningSuccess.starterProvisioning.counts?.rules ?? 0} rules (off) · {provisioningSuccess.starterProvisioning.counts?.campaigns ?? 0} drafts
                    </span>
                  ) : provisioningSuccess?.starterProvisioning ? (
                    <span className="flex flex-col items-end gap-1">
                      <span className="font-bold text-amber-700">Not finished</span>
                      <button
                        type="button"
                        id="onboarding-retry-starter"
                        onClick={handleRetryStarter}
                        disabled={isRetryingStarter}
                        className="text-[11px] font-bold text-blue-600 hover:text-blue-700 disabled:opacity-50"
                      >
                        {isRetryingStarter ? 'Retrying…' : 'Retry starter setup'}
                      </button>
                      {starterRetryError && <span className="text-[11px] text-rose-600">{starterRetryError}</span>}
                    </span>
                  ) : (
                    <span className="font-bold text-slate-500">Status unavailable</span>
                  )}
                </div>
              </div>

              {/* Next Steps Checklist */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200 max-w-md mx-auto text-left shadow-2xs">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-1.5">
                  <CheckSquare className="w-4 h-4 text-blue-600" />
                  <span>Next Steps Checklist</span>
                </h4>
                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center gap-2.5 text-slate-700">
                    <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[10px]">✓</span>
                    <span>Review Business Profile & Regional Timezone</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-slate-700">
                    <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[10px]">2</span>
                    <span>Explore Contacts CRM & Import Client Lists</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-slate-700">
                    <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[10px]">3</span>
                    <span>Explore Message Templates Tailored for {selectedIndustry.name}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-slate-700">
                    <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[10px]">4</span>
                    <span>Create a Mock Campaign & Simulate Broadcasts</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-slate-500">
                    <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-[10px]">5</span>
                    <span>Connect Official Meta WhatsApp Number Later</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/app')}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <span>Go to Workspace Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Stepper Navigation Footer */}
          {currentStep < 6 && (
            <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between">
              {currentStep > 1 ? (
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={isSaving || isProvisioning}
                  className="ob-btn-secondary"
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
                    className="ob-btn-primary"
                  >
                    {isSaving ? (
                      <>
                        <RotateCw className="w-4 h-4 animate-spin" />
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
                    className="ob-btn-primary py-3 px-8 text-sm"
                  >
                    {isProvisioning ? (
                      <>
                        <RotateCw className="w-4 h-4 animate-spin" />
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

      {/* Page Footer */}
      <footer className="text-center py-6 text-xs text-slate-400 border-t border-slate-200/80 bg-white/60">
        © {new Date().getFullYear()} Relay Automation Inc. All rights reserved. • Multi-Tenant WhatsApp Business Automation
      </footer>
    </div>
  );
}
