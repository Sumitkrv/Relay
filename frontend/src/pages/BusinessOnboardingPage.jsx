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
  Video,
  MoreVertical,
  ChevronDown,
  Eye,
  Zap,
  Sliders,
  Megaphone,
  Laptop,
  MessageSquare,
  Rocket,
} from 'lucide-react';

function WhatsAppIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.888 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
    </svg>
  );
}
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
  Megaphone,
  Laptop,
};

const STEP_DEFINITIONS = [
  { num: 1, label: 'Identity', subtitle: 'Business Profile', icon: Building2 },
  { num: 2, label: 'Industry', subtitle: 'CRM & Messaging', icon: Layers },
  { num: 3, label: 'Details', subtitle: 'Location & Hours', icon: MapPin },
  { num: 4, label: 'Branding', subtitle: 'Logo & Assets', icon: Sparkles },
  { num: 5, label: 'Review', subtitle: 'Confirm & Launch', icon: CheckCircle2 },
];

export default function BusinessOnboardingPage() {
  const { user, loading: authLoading, logout, refreshUser } = useAuth();
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
    if (authLoading) return;
    if (!user) {
      navigate('/login?from=/onboarding', { replace: true });
      return;
    }

    let isMounted = true;
    async function init() {
      try {
        const [status, catalog] = await Promise.all([
          getOnboardingStatus().catch((err) => {
            if (err.response?.status === 401) {
              return { hasWorkspace: false, draft: null };
            }
            throw err;
          }),
          getIndustrySummaries().catch(() => []),
        ]);
        if (!isMounted) return;
        setIndustries(catalog);

        if (status.hasWorkspace && status.workspace) {
          navigate('/app', { replace: true });
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
            navigate('/verify-email', { replace: true });
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
  }, [user, authLoading, navigate]);

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

  const SelectedIndustryIcon = useMemo(() => {
    return (selectedIndustry.icon && INDUSTRY_ICONS[selectedIndustry.icon]) || Building2;
  }, [selectedIndustry.icon]);

  const previewTimezoneDisplay = useMemo(() => {
    const tz = details.timezone;
    if (tz === 'Asia/Kolkata') return 'Kolkata (IST · UTC+5:30)';
    if (tz === 'Asia/Dubai') return 'Dubai (GST · UTC+4:00)';
    if (tz === 'Asia/Singapore') return 'Singapore (SGT · UTC+8:00)';
    if (tz === 'Europe/London') return 'London (GMT · UTC+0:00)';
    if (tz === 'America/New_York') return 'New York (EST · UTC-5:00)';
    if (tz === 'America/Los_Angeles') return 'Los Angeles (PST · UTC-8:00)';
    return tz || 'Asia/Kolkata';
  }, [details.timezone]);

  const previewLanguageDisplay = useMemo(() => {
    const lang = details.preferredLanguage;
    if (lang === 'hi') return 'Hindi (हिंदी)';
    if (lang === 'mr') return 'Marathi (मराठी)';
    if (lang === 'ta') return 'Tamil (தமிழ்)';
    if (lang === 'te') return 'Telugu (తెలుగు)';
    return 'English (Default)';
  }, [details.preferredLanguage]);

  const formattedLocationPreview = useMemo(() => {
    const parts = [details.city?.trim(), details.state?.trim(), details.country?.trim()].filter(Boolean);
    return parts.length ? parts.join(', ') : null;
  }, [details.city, details.state, details.country]);

  // Step 2 Hover Preview & Category Filter State
  const [hoveredIndustryKey, setHoveredIndustryKey] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('All');

  const previewIndustry = useMemo(() => {
    if (hoveredIndustryKey) {
      const hovered = industries.find((i) => i.key === hoveredIndustryKey);
      if (hovered) {
        return {
          ...hovered,
          isHovered: true,
          isSelected: hovered.key === industryKey,
        };
      }
    }
    if (selectedIndustry.key) {
      return {
        ...selectedIndustry,
        isHovered: false,
        isSelected: true,
      };
    }
    return null;
  }, [hoveredIndustryKey, industries, selectedIndustry, industryKey]);

  const availableCategories = useMemo(() => {
    const defaultOrder = [
      'All',
      'Agencies & Services',
      'Health & Wellness',
      'Retail & Hospitality',
      'Property & Repairs',
      'Education',
      'Other Businesses',
    ];
    const presentCategories = new Set(industries.map((ind) => ind.category).filter(Boolean));
    const ordered = defaultOrder.filter((cat) => cat === 'All' || presentCategories.has(cat));
    presentCategories.forEach((cat) => {
      if (!ordered.includes(cat)) ordered.push(cat);
    });
    return ordered;
  }, [industries]);

  const categoryCounts = useMemo(() => {
    const counts = { All: industries.length };
    industries.forEach((ind) => {
      const cat = ind.category || 'Other Businesses';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [industries]);

  const filteredIndustries = useMemo(() => {
    let list = industries;
    if (selectedCategory && selectedCategory !== 'All') {
      list = list.filter((ind) => ind.category === selectedCategory);
    }
    if (!industrySearch.trim()) return list;
    const q = industrySearch.toLowerCase().trim();
    return list.filter(
      (ind) =>
        ind.name?.toLowerCase().includes(q) ||
        ind.displayLabel?.toLowerCase().includes(q) ||
        ind.description?.toLowerCase().includes(q) ||
        ind.category?.toLowerCase().includes(q) ||
        ind.key?.toLowerCase().includes(q)
    );
  }, [industries, selectedCategory, industrySearch]);

  const businessInitials = useMemo(() => {
    const raw = identity.name.trim() || (user?.name ? `${user.name}'s Business` : 'My Business');
    if (!raw) return 'MB';
    const words = raw.split(/\s+/).filter(Boolean);
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  }, [identity.name, user?.name]);

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
    <div className="ob-page-canvas flex flex-col justify-between text-slate-900 min-h-screen">
      {/* Decorative Side Dot Matrices */}
      <div className="ob-dot-matrix-left hidden sm:block" />
      <div className="ob-dot-matrix-right hidden sm:block" />

      {/* Top Header Navbar */}
      <header className="ob-header sticky top-0 z-30 px-6 sm:px-10 h-16 flex items-center justify-between bg-white border-b border-slate-200">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-8 h-8 rounded-xl bg-[#2563EB] text-white flex items-center justify-center font-extrabold text-sm shadow-2xs group-hover:bg-[#1D4ED8] transition-colors">
            R
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-xl font-black tracking-tight text-slate-900">
              RELAY<span className="text-slate-900">.</span>
            </span>
            <span className="hidden sm:inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#EFF6FF] border border-[#BFDBFE] text-[#2563EB] uppercase tracking-wider">
              Business Onboarding
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full bg-[#10B981]" />
            <span className="text-slate-600 font-medium flex items-center gap-0.5">
              Verified Account <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </span>
            <strong className="text-slate-900 font-bold ml-1.5 max-w-[220px] truncate" title={user?.email}>
              {user?.email || 'Authenticated User'}
            </strong>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
            title="Sign out of current account"
          >
            <LogOut className="w-3.5 h-3.5 text-slate-600" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-[1220px] mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 flex-1">
        {/* Stepper Header (Desktop & Tablet) */}
        {currentStep < 6 && (
          <div className="mb-8">
            {/* Desktop Stepper */}
            <div className="hidden md:block max-w-3xl mx-auto mb-4">
              <div className="ob-stepper-track">
                <div className="ob-stepper-line">
                  <div
                    className="ob-stepper-progress"
                    style={{ width: currentStep === 1 ? '16%' : `${Math.min(100, ((currentStep - 1) / 4) * 100)}%` }}
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
                        className={`text-xs mt-2.5 font-bold tracking-tight transition-colors ${
                          isCurrent ? 'text-[#1E40AF]' : isCompleted ? 'text-slate-800' : 'text-[#475569]'
                        }`}
                      >
                        {step.label}
                      </span>
                      <span
                        className={`text-[11px] font-medium hidden lg:block transition-colors ${
                          isCurrent ? 'text-[#2563EB]' : isCompleted ? 'text-slate-500' : 'text-[#94A3B8]'
                        }`}
                      >
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

        {/* Onboarding Main Card Container */}
        <div className="relative">
          {/* Decorative Floating Pills next to Upper Right of Card */}
          <div className="hidden lg:block absolute -right-6 top-6 pointer-events-none z-10">
            <div className="w-7 h-1.5 rounded-full bg-[#2563EB] rotate-[-45deg] opacity-85 shadow-2xs mb-2" />
            <div className="w-4 h-1.5 rounded-full bg-[#93C5FD] rotate-[-45deg] opacity-85 ml-2.5" />
          </div>

          <div className="ob-card-shell p-6 sm:p-8 lg:p-10">
            {/* STEP 1: BUSINESS IDENTITY */}
            {currentStep === 1 && (
              <div className="ob-animate-fade">
                {/* Two-Column Responsive Layout: Left Form + Right Live Workspace Preview */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
                  {/* Left Column: Form Inputs (7 Cols) */}
                  <div className="lg:col-span-7 flex flex-col justify-between">
                    <div>
                      {/* Top Pill Badge */}
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] text-[#2563EB] text-[11px] font-bold uppercase tracking-wider mb-3">
                        <Sparkles className="w-3.5 h-3.5 text-[#2563EB]" />
                        <span>Step 1 of 5 · Workspace Identity</span>
                      </div>

                      {/* Main Heading */}
                      <h1 className="text-3xl font-extrabold text-[#0F172A] tracking-tight">
                        Business Identity
                      </h1>
                      <p className="text-sm text-slate-500 mt-1.5 mb-6 leading-relaxed">
                        Tell us about your organization. This establishes your official business workspace and customer-facing identity.
                      </p>

                      {/* Form Inputs */}
                      <div className="space-y-4">
                        {/* Business Name */}
                        <div>
                          <label className="block text-xs font-bold text-slate-800 mb-1.5">
                            Business Name <span className="text-rose-500">*</span>
                          </label>
                          <div className="relative">
                            <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                              type="text"
                              name="name"
                              value={identity.name}
                              onChange={(e) => setIdentity((p) => ({ ...p, name: e.target.value }))}
                              placeholder={user?.name ? `${user.name}'s Business` : 'e.g. Skyline Properties'}
                              className="ob-input"
                              required
                            />
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1.5">
                            Your official company, clinic, or studio name. This will be visible to your customers.
                          </p>
                        </div>

                        {/* Email & Phone Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-800 mb-1.5">
                              Business Email <span className="text-rose-500">*</span>
                            </label>
                            <div className="relative">
                              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                              <input
                                type="email"
                                name="email"
                                value={identity.email}
                                onChange={(e) => setIdentity((p) => ({ ...p, email: e.target.value }))}
                                placeholder={user?.email || 'e.g. contact@yourbusiness.com'}
                                className="ob-input"
                                required
                              />
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1.5">
                              We'll use this for important updates and notifications.
                            </p>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-800 mb-1.5">
                              Business Phone (WhatsApp inquiries)
                            </label>
                            <div className="relative">
                              <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                              <input
                                type="tel"
                                name="phone"
                                value={identity.phone}
                                onChange={(e) => setIdentity((p) => ({ ...p, phone: e.target.value }))}
                                placeholder="+91 98112 23344"
                                className="ob-input"
                              />
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1.5">
                              This number will receive customer messages.
                            </p>
                          </div>
                        </div>

                        {/* Website or Social Profile */}
                        <div>
                          <label className="block text-xs font-bold text-slate-800 mb-1.5">
                            Website or Social Profile (Optional)
                          </label>
                          <div className="relative">
                            <Globe className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                              type="url"
                              name="website"
                              value={identity.website}
                              onChange={(e) => setIdentity((p) => ({ ...p, website: e.target.value }))}
                              placeholder="https://yourbusiness.com or instagram.com/page"
                              className="ob-input"
                            />
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1.5">
                            Add your website or social media profile to help customers find you.
                          </p>
                        </div>

                        {/* Short Business Description */}
                        <div>
                          <label className="block text-xs font-bold text-slate-800 mb-1.5">
                            Short Business Description (Optional)
                          </label>
                          <div className="relative">
                            <FileText className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                            <textarea
                              rows={3}
                              maxLength={500}
                              name="description"
                              value={identity.description}
                              onChange={(e) => setIdentity((p) => ({ ...p, description: e.target.value }))}
                              placeholder="Briefly describe your services, target audience, or specialties..."
                              className="ob-textarea has-icon"
                            />
                          </div>
                          <div className="flex items-center justify-between mt-1.5 text-[11px] text-slate-400">
                            <span>This will be used in your workspace profile and automated messages.</span>
                            <span className="font-medium">{identity.description?.length || 0}/500</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Step 1 Continue Button Aligned Bottom Right */}
                    <div className="flex justify-end pt-6 mt-4">
                      <button
                        type="button"
                        onClick={handleNext}
                        disabled={isSaving}
                        className="ob-btn-primary h-11 px-7 rounded-xl text-sm font-semibold flex items-center gap-2 cursor-pointer shadow-sm hover:shadow"
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
                    </div>
                  </div>

                  {/* Right Column: Live Workspace Preview (5 Cols) */}
                  <div className="lg:col-span-5">
                    <div className="rounded-[20px] bg-[#F8FAFC] border border-[#E2E8F0] p-5 lg:p-6 space-y-4">
                      {/* Preview Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center text-[#2563EB]">
                            <Eye className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-sm font-bold text-slate-900">Live Workspace Preview</span>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span>Ready</span>
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 -mt-1 pl-8">
                        Here's how your business identity will appear to your customers.
                      </p>

                      {/* Business Identity Card (White) */}
                      <div className="rounded-xl bg-white border border-[#E2E8F0] p-4 shadow-2xs space-y-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-[#0B1220] text-white font-extrabold text-base flex items-center justify-center tracking-tight shadow-sm shrink-0 border border-slate-800">
                            {businessInitials}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-base font-bold text-slate-900 truncate">
                              {identity.name.trim() || (user?.name ? `${user.name}'s Business` : 'My Business')}
                            </h3>
                            <p className="text-xs text-slate-500 truncate mt-0.5">
                              {identity.email.trim() || user?.email || 'contact@yourbusiness.com'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 flex-wrap">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0] text-[#16A34A] text-xs font-semibold">
                            <WhatsAppIcon className="w-3.5 h-3.5" />
                            <span>WhatsApp Ready</span>
                          </span>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] text-[#2563EB] text-xs font-semibold">
                            <Building2 className="w-3.5 h-3.5" />
                            <span>Workspace Identity</span>
                          </span>
                        </div>
                      </div>

                      {/* WhatsApp Sender Header Section */}
                      <div className="space-y-2 pt-1">
                        <div className="flex items-start gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-[#10B981] text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                            <WhatsAppIcon className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-slate-800 leading-tight">WhatsApp Sender Header</h4>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              This is how your business will appear in WhatsApp conversations with customers.
                            </p>
                          </div>
                        </div>

                        {/* WhatsApp Phone Mockup Frame */}
                        <div className="rounded-xl overflow-hidden border border-slate-300/80 shadow-xs">
                          {/* Chat Top Bar */}
                          <div className="bg-[#075E54] px-3.5 py-2.5 flex items-center justify-between text-white">
                            <div className="flex items-center gap-2 min-w-0">
                              <ArrowLeft className="w-4 h-4 text-white/90 shrink-0" />
                              <div className="w-7 h-7 rounded-full bg-[#0B1220] border border-white/20 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                                {businessInitials}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-white truncate max-w-[130px] sm:max-w-[170px]">
                                  {identity.name.trim() || (user?.name ? `${user.name}'s Business` : 'My Business')}
                                </div>
                                <div className="text-[10px] text-emerald-200 leading-none mt-0.5">online</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 text-white/90">
                              <Video className="w-4 h-4" />
                              <Phone className="w-3.5 h-3.5" />
                              <MoreVertical className="w-4 h-4" />
                            </div>
                          </div>

                          {/* Chat Body */}
                          <div
                            className="p-3.5 bg-[#EFEAE2] relative"
                            style={{
                              backgroundImage: 'radial-gradient(#D1D5DB 0.8px, transparent 0.8px)',
                              backgroundSize: '12px 12px',
                            }}
                          >
                            <div className="bg-white rounded-xl rounded-tl-xs p-3 shadow-2xs max-w-[92%] border border-black/5">
                              <p className="text-xs font-semibold text-slate-900">Hello! 👋</p>
                              <p className="text-xs text-slate-700 mt-1 leading-relaxed">
                                Thanks for reaching out to {identity.name.trim() || (user?.name ? `${user.name}'s Business` : 'our team')}. How can we help you today?
                              </p>
                              <div className="flex justify-end items-center gap-1 mt-1.5 text-[10px] text-slate-400">
                                <span>11:22 AM</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Lower Info Banner: Live Simulation */}
                      <div className="rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] p-3 flex items-start gap-2.5">
                        <Info className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" />
                        <div>
                          <h5 className="text-xs font-bold text-blue-900">Live Simulation</h5>
                          <p className="text-[11px] text-blue-700 leading-relaxed mt-0.5">
                            This preview shows how your business identity will be displayed in outgoing broadcasts, customer auto-replies, and CRM records.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

          {/* STEP 2: INDUSTRY SELECTION */}
          {currentStep === 2 && (
            <div className="ob-animate-fade space-y-4 sm:space-y-4.5">
              {/* Top Header & Search Filter Bar */}
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 sm:gap-4 border-b border-slate-100 pb-3">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] text-[#2563EB] text-[10.5px] font-bold uppercase tracking-wider mb-1.5">
                    <Sparkles className="w-3 h-3 text-[#2563EB]" />
                    <span>Step 2 of 5 · Industry Setup</span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-extrabold text-[#0F172A] tracking-tight">
                    What kind of business do you run?
                  </h1>
                  <p className="text-xs sm:text-[13px] text-slate-500 mt-0.5 max-w-2xl leading-relaxed">
                    Choose your industry and Relay will prepare a workspace tailored to your services, clients and messaging workflows.
                  </p>
                </div>

                {/* Real-time Industry Search Filter */}
                <div className="w-full md:w-72 flex flex-col gap-1 shrink-0">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      aria-label="Search your industry"
                      value={industrySearch}
                      onChange={(e) => setIndustrySearch(e.target.value)}
                      placeholder="Search industry or service..."
                      className="ob-input h-9 text-xs pl-9 pr-8 rounded-xl border-slate-200 focus:border-blue-600 shadow-2xs w-full"
                    />
                    {industrySearch && (
                      <button
                        type="button"
                        aria-label="Clear search"
                        onClick={() => setIndustrySearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-md hover:bg-slate-100 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Dynamic Category Filter Bar */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full no-scrollbar">
                  {availableCategories.map((cat) => {
                    const isActive = selectedCategory === cat;
                    const count = categoryCounts[cat] || 0;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        className={`ob-category-chip ${isActive ? 'is-active' : 'not-active'}`}
                      >
                        <span>{cat}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                            isActive ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-500'
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {(selectedCategory !== 'All' || industrySearch.trim()) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory('All');
                      setIndustrySearch('');
                    }}
                    className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 hover:underline shrink-0"
                  >
                    Reset Filters
                  </button>
                )}
              </div>

              {/* Contained Industry Grid Gallery (Desktop contained, mobile natural) */}
              <div
                className="lg:max-h-[460px] lg:overflow-y-auto lg:pr-1.5 ob-custom-scroll"
                onMouseLeave={() => setHoveredIndustryKey(null)}
              >
                {/* Render the API catalog (industries.map) */}
                <div
                  role="radiogroup"
                  aria-label="Choose your industry"
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-3.5"
                >
                  {(industrySearch.trim() || selectedCategory !== 'All' ? filteredIndustries : industries).map((ind) => {
                    const isSelected = industryKey === ind.key;
                    const Icon = INDUSTRY_ICONS[ind.icon] || Briefcase;
                    const isNew = Boolean(ind.isNew || ind.key === 'marketing_agency' || ind.key === 'freelancing');

                    return (
                      <div
                        key={ind.key}
                        onClick={() => setIndustryKey(ind.key)}
                        onMouseEnter={() => setHoveredIndustryKey(ind.key)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setIndustryKey(ind.key);
                          }
                        }}
                        tabIndex={0}
                        role="radio"
                        aria-checked={isSelected}
                        aria-label={`${ind.name}${ind.displayLabel ? `, ${ind.displayLabel}` : ''}`}
                        className={`ob-industry-card group ${isSelected ? 'is-selected' : ''}`}
                      >
                        <div>
                          {/* Top Row: Icon + Subtle New Badge + Radio Indicator */}
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-1.5">
                              <div className={`ob-industry-icon shrink-0 ${isSelected ? 'is-selected' : 'not-selected'}`}>
                                <Icon className="w-4 h-4" />
                              </div>
                              {isNew && (
                                <span className="text-[9.5px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                  New
                                </span>
                              )}
                            </div>
                            <div
                              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                                isSelected
                                  ? 'border-blue-600 bg-blue-600 text-white shadow-xs'
                                  : 'border-slate-300 bg-white group-hover:border-blue-400'
                              }`}
                            >
                              {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                            </div>
                          </div>

                          {/* Industry Name */}
                          <h3
                            className={`text-[13.5px] sm:text-[14px] font-bold tracking-tight transition-colors leading-snug line-clamp-1 mb-1 ${
                              isSelected ? 'text-blue-950 font-extrabold' : 'text-slate-900 group-hover:text-blue-600'
                            }`}
                            title={ind.name}
                          >
                            {ind.name}
                          </h3>

                          {/* Short Description */}
                          <p className="text-[11px] text-slate-500 leading-snug group-hover:text-slate-600 transition-colors line-clamp-2">
                            {ind.description}
                          </p>
                        </div>

                        {/* Starter Content Metrics Footer */}
                        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10.5px] text-slate-500">
                          <span className="font-semibold text-slate-700">
                            {ind.templateCount || 15} Tpls · {ind.quickReplyCount || 8} Replies
                          </span>
                          <span className="text-[10px] font-medium text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                            {ind.automationCount ? `${ind.automationCount} Rules` : '5 Rules'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Empty State */}
                {filteredIndustries.length === 0 && (
                  <div className="text-center py-10 px-4 bg-slate-50 rounded-2xl border border-slate-200 my-2">
                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-400 flex items-center justify-center mx-auto mb-2.5 shadow-2xs">
                      <Search className="w-5 h-5 text-slate-400" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-800">No matching industries found</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      We couldn't find any industries matching your filters. Try resetting to view all 15 supported verticals.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategory('All');
                        setIndustrySearch('');
                      }}
                      className="mt-3 px-4 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors shadow-2xs"
                    >
                      Reset All Filters
                    </button>
                  </div>
                )}
              </div>

              {/* Dynamic Selected / Hover-Preview Industry Context Dock */}
              {previewIndustry ? (
                <div
                  className={`rounded-xl border p-3 sm:p-3.5 shadow-2xs transition-all duration-200 ${
                    previewIndustry.isHovered && !previewIndustry.isSelected
                      ? 'bg-gradient-to-r from-blue-50/70 via-sky-50/40 to-slate-50/60 border-blue-300'
                      : 'bg-gradient-to-r from-blue-50/90 via-sky-50/50 to-indigo-50/70 border-blue-200/90'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-lg text-white flex items-center justify-center shrink-0 shadow-xs transition-colors ${
                          previewIndustry.isSelected ? 'bg-blue-600' : 'bg-slate-800'
                        }`}
                      >
                        {(() => {
                          const Icon = INDUSTRY_ICONS[previewIndustry.icon] || Briefcase;
                          return <Icon className="w-4 h-4" />;
                        })()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.2 rounded-full transition-colors ${
                              previewIndustry.isSelected ? 'bg-blue-600 text-white' : 'bg-slate-800 text-white'
                            }`}
                          >
                            {previewIndustry.isSelected ? 'Selected' : 'Preview'}
                          </span>
                          <span className="text-xs font-extrabold text-blue-950 truncate">
                            {previewIndustry.name}
                          </span>
                          <span className="text-[11px] text-blue-700 font-medium">
                            · Pack v{previewIndustry.packVersion || '1.1.0'}
                          </span>
                          {previewIndustry.isHovered && !previewIndustry.isSelected && (
                            <span className="text-[10.5px] text-slate-500 font-medium">
                              (Click to choose)
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-600 truncate mt-0.5">
                          Tailoring CRM fields for{' '}
                          <strong className="text-slate-800">
                            {previewIndustry.terminology?.leadPlural || previewIndustry.terminology?.leadLabel || 'clients'}
                          </strong>
                          , verified starter templates & automated workflows.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-white/90 border border-blue-200 text-blue-900 text-[11px] font-semibold">
                        <FileText className="w-3 h-3 text-blue-600" />
                        <span>{previewIndustry.templateCount || 15} Templates</span>
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-white/90 border border-blue-200 text-blue-900 text-[11px] font-semibold">
                        <Zap className="w-3 h-3 text-blue-600" />
                        <span>{previewIndustry.quickReplyCount || 8} Replies</span>
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-white/90 border border-blue-200 text-blue-900 text-[11px] font-semibold">
                        <Sliders className="w-3 h-3 text-blue-600" />
                        <span>{previewIndustry.automationCount || 5} Rules</span>
                      </span>
                      {previewIndustry.isSelected ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                          <Check className="w-3 h-3 stroke-[3] text-emerald-600" />
                          <span>Ready</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setIndustryKey(previewIndustry.key)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-white hover:bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-300 shadow-2xs transition-colors cursor-pointer"
                        >
                          <span>Select This</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-2.5 text-center">
                  <p className="text-xs text-slate-500 flex items-center justify-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>Hover over or select an industry above to preview its tailored workspace configuration.</span>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: BUSINESS LOCATION & PREFERENCES (Two-Column Redesign) */}
          {currentStep === 3 && (
            <div className="ob-animate-fade">
              {/* Two-Column Responsive Layout: Left Form (7 cols) + Right Live Workspace Preview (5 cols) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
                {/* Left Column: Business Configuration (7 Cols) */}
                <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
                  <div>
                    {/* Top Pill Badge */}
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] text-[#2563EB] text-[11px] font-bold uppercase tracking-wider mb-2.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#2563EB]" />
                      <span>Step 3 of 5 · Workspace Preferences</span>
                    </div>

                    {/* Main Heading */}
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
                      Set up your business location
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1.5 leading-relaxed">
                      Choose where your business operates and how Relay should handle language, timing and regional preferences.
                    </p>

                    {/* Dynamic Contextual Line */}
                    {selectedIndustry.name && selectedIndustry.key && (
                      <div className="inline-flex items-center gap-2 mt-2.5 px-3 py-1 rounded-lg bg-blue-50/80 border border-blue-200/70 text-xs font-semibold text-blue-800">
                        <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                        <span>Setting up your {selectedIndustry.name} workspace</span>
                      </div>
                    )}

                    {/* Form Sections */}
                    <div className="mt-6 space-y-6">
                      {/* Section 1: Business Location */}
                      <div className="space-y-4">
                        <div className="flex items-start gap-2.5 pb-2.5 border-b border-slate-100">
                          <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0 mt-0.5">
                            <MapPin className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                              Business Location
                            </h2>
                            <p className="text-[11px] text-slate-500">
                              Help Relay understand where your business operates.
                            </p>
                          </div>
                        </div>

                        {/* City & State / Region side-by-side */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1.5">
                              City
                            </label>
                            <div className="relative">
                              <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                              <input
                                type="text"
                                name="city"
                                value={details.city}
                                onChange={(e) => setDetails((p) => ({ ...p, city: e.target.value }))}
                                placeholder="Enter your city"
                                className="ob-input"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1.5">
                              State / Region
                            </label>
                            <div className="relative">
                              <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                              <input
                                type="text"
                                name="state"
                                value={details.state}
                                onChange={(e) => setDetails((p) => ({ ...p, state: e.target.value }))}
                                placeholder="State or region"
                                className="ob-input"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Country & Physical Address */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1.5">
                              Country
                            </label>
                            <div className="relative">
                              <Globe className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                              <input
                                type="text"
                                name="country"
                                value={details.country}
                                onChange={(e) => setDetails((p) => ({ ...p, country: e.target.value }))}
                                placeholder="Country"
                                className="ob-input"
                              />
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="block text-xs font-bold text-slate-700">
                                Physical Address
                              </label>
                              <span className="text-[10px] font-semibold text-slate-400 uppercase">
                                Optional
                              </span>
                            </div>
                            <div className="relative">
                              <FileText className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                              <input
                                type="text"
                                name="address"
                                value={details.address}
                                onChange={(e) => setDetails((p) => ({ ...p, address: e.target.value }))}
                                placeholder="e.g. Unit 402, Signature Towers, BKC"
                                className="ob-input"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Section 2: Operating Preferences */}
                      <div className="space-y-4 pt-1">
                        <div className="flex items-start gap-2.5 pb-2.5 border-b border-slate-100">
                          <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0 mt-0.5">
                            <Clock className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                              Operating Preferences
                            </h2>
                            <p className="text-[11px] text-slate-500">
                              Set the timezone and language used for your business workflows.
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="block text-xs font-bold text-slate-700">
                                Operating Timezone
                              </label>
                              <span className="text-[10px] text-slate-400">Scheduling & Timers</span>
                            </div>
                            <div className="relative">
                              <Clock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                              <select
                                value={details.timezone}
                                onChange={(e) => setDetails((p) => ({ ...p, timezone: e.target.value }))}
                                className="ob-select has-icon"
                              >
                                <option value="Asia/Kolkata">Asia/Kolkata (IST · UTC+5:30)</option>
                                <option value="Asia/Dubai">Asia/Dubai (GST · UTC+4:00)</option>
                                <option value="Asia/Singapore">Asia/Singapore (SGT · UTC+8:00)</option>
                                <option value="Europe/London">Europe/London (GMT/BST · UTC+0:00)</option>
                                <option value="America/New_York">America/New_York (EST/EDT · UTC-5:00)</option>
                                <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT · UTC-8:00)</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="block text-xs font-bold text-slate-700">
                                Primary Language
                              </label>
                              <span className="text-[10px] text-slate-400">Customer Messaging</span>
                            </div>
                            <div className="relative">
                              <Languages className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                              <select
                                value={details.preferredLanguage}
                                onChange={(e) => setDetails((p) => ({ ...p, preferredLanguage: e.target.value }))}
                                className="ob-select has-icon"
                              >
                                <option value="en">English (Default)</option>
                                <option value="hi">Hindi (हिंदी)</option>
                                <option value="mr">Marathi (मराठी)</option>
                                <option value="ta">Tamil (தமிழ்)</option>
                                <option value="te">Telugu (తెలుగు)</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Live Workspace Preview (5 Cols) */}
                <div className="lg:col-span-5">
                  <div className="ob-step3-preview p-5 lg:p-6 space-y-4 shadow-sm">
                    {/* Preview Top Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center text-[#2563EB]">
                          <Eye className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-sm font-bold text-slate-900">Your Workspace Preview</span>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                        <span>Ready to provision</span>
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 -mt-1 pl-8">
                      See how Relay will tailor your setup.
                    </p>

                    {/* Section A: Selected Industry Identity Card */}
                    <div className="rounded-xl bg-white border border-[#E2E8F0] p-4 shadow-2xs space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-11 h-11 rounded-xl bg-[#0B1220] text-white flex items-center justify-center shrink-0 border border-slate-800 shadow-xs">
                          <SelectedIndustryIcon className="w-5 h-5 text-blue-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-bold text-slate-900 truncate">
                              {selectedIndustry.name || 'Selected Industry'}
                            </h3>
                            {selectedIndustry.category && (
                              <span className="px-2 py-0.2 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                {selectedIndustry.category}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-snug">
                            {selectedIndustry.subtitle || selectedIndustry.description || 'Tailored CRM presets and automation.'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-slate-100 flex-wrap text-[11px]">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#EFF6FF] border border-[#BFDBFE] text-[#2563EB] font-medium">
                          <Check className="w-3 h-3 stroke-[3]" />
                          <span>Pack v{selectedIndustry.packVersion || '1.1.0'}</span>
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F0FDF4] border border-[#BBF7D0] text-[#16A34A] font-medium">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Ready for setup</span>
                        </span>
                      </div>
                    </div>

                    {/* Section B: Your Business Location Summary */}
                    <div className="rounded-xl bg-white border border-[#E2E8F0] p-3.5 shadow-2xs space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 font-bold text-slate-800">
                          <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span>Operating Region</span>
                        </div>
                        <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                          Location
                        </span>
                      </div>

                      <div className="pl-5 text-xs">
                        {formattedLocationPreview ? (
                          <div className="font-semibold text-slate-800">
                            {formattedLocationPreview}
                          </div>
                        ) : (
                          <div className="text-slate-400 italic text-[11px]">
                            Location not provided yet · {details.country || 'India'}
                          </div>
                        )}
                        {details.address && (
                          <div className="text-[11px] text-slate-500 truncate mt-0.5 flex items-center gap-1">
                            <span className="text-slate-400">Address:</span>
                            <span>{details.address}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Section C: Operating Settings (Timezone & Language) */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="rounded-xl bg-white border border-[#E2E8F0] p-3 shadow-2xs">
                        <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500 mb-1">
                          <Clock className="w-3 h-3 text-blue-600" />
                          <span>Timezone</span>
                        </div>
                        <div className="text-xs font-extrabold text-slate-800 truncate" title={details.timezone}>
                          {previewTimezoneDisplay}
                        </div>
                      </div>

                      <div className="rounded-xl bg-white border border-[#E2E8F0] p-3 shadow-2xs">
                        <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500 mb-1">
                          <Languages className="w-3 h-3 text-blue-600" />
                          <span>Language</span>
                        </div>
                        <div className="text-xs font-extrabold text-slate-800">
                          {previewLanguageDisplay}
                        </div>
                      </div>
                    </div>

                    {/* Section D: Industry Starter Kit */}
                    <div className="rounded-xl bg-white border border-[#E2E8F0] p-4 shadow-2xs space-y-3">
                      <div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                            <Layers className="w-3.5 h-3.5 text-blue-600" />
                            <span>Your industry starter kit</span>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                            Available at setup
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Relay will provision the following workspace resources after setup.
                        </p>
                      </div>

                      {/* 2x2 Metric Grid */}
                      <div className="grid grid-cols-2 gap-2.5 pt-0.5">
                        <div className="p-2.5 rounded-xl bg-slate-50/70 border border-slate-200/80">
                          <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            <FileText className="w-3 h-3 text-blue-600" />
                            <span>Templates</span>
                          </div>
                          <div className="text-lg font-black text-slate-900 mt-1">
                            {selectedIndustry.templateCount ?? 15}
                          </div>
                          <div className="text-[10px] text-slate-500">Message Templates</div>
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-50/70 border border-slate-200/80">
                          <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            <Zap className="w-3 h-3 text-amber-600" />
                            <span>Quick Replies</span>
                          </div>
                          <div className="text-lg font-black text-slate-900 mt-1">
                            {selectedIndustry.quickReplyCount ?? 8}
                          </div>
                          <div className="text-[10px] text-slate-500">1-tap shortcuts</div>
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-50/70 border border-slate-200/80">
                          <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            <Sliders className="w-3 h-3 text-indigo-600" />
                            <span>Automation</span>
                          </div>
                          <div className="text-lg font-black text-slate-900 mt-1">
                            {selectedIndustry.automationCount ?? selectedIndustry.ruleCount ?? 5}
                          </div>
                          <div className="text-[10px] text-slate-500">Starter Rules</div>
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-50/70 border border-slate-200/80">
                          <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            <Megaphone className="w-3 h-3 text-purple-600" />
                            <span>Campaigns</span>
                          </div>
                          <div className="text-lg font-black text-slate-900 mt-1">
                            {selectedIndustry.campaignCount ?? 2}
                          </div>
                          <div className="text-[10px] text-slate-500">Draft Campaigns</div>
                        </div>
                      </div>
                    </div>

                    {/* Section 13: Workspace Readiness Footer */}
                    <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 flex items-start gap-2.5">
                      <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      <div className="text-[11px] leading-relaxed text-slate-600">
                        <span className="font-semibold text-slate-800">
                          Your Workspace will be configured when you finish onboarding.
                        </span>{' '}
                        Industry Templates, Quick Replies, disabled starter automation Rules and draft Campaigns are created during Workspace setup.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: BUSINESS LOGO & BRANDING STUDIO (Two-Column Redesign) */}
          {currentStep === 4 && (
            <div className="ob-animate-fade">
              {/* Two-Column Responsive Layout: Left Brand Uploader (7 cols) + Right Live Brand Preview (5 cols) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
                {/* Left Column: Brand Studio & Assets (7 Cols) */}
                <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
                  <div>
                    {/* Top Pill Badge */}
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] text-[#2563EB] text-[11px] font-bold uppercase tracking-wider mb-2.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#2563EB]" />
                      <span>Step 4 of 5 · Brand Identity</span>
                    </div>

                    {/* Main Heading */}
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
                      Make Relay yours.
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1.5 leading-relaxed">
                      Give your workspace a recognizable identity. Upload your logo or continue with a beautifully styled initials avatar.
                    </p>

                    {/* Reassuring Optional Status Pill */}
                    <div className="inline-flex items-center gap-2 mt-2.5 px-3 py-1 rounded-lg bg-slate-100/90 border border-slate-200/80 text-xs font-semibold text-slate-700">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>Logo optional · You can continue now and change assets anytime in Settings</span>
                    </div>

                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleLogoUpload}
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                    />

                    {/* Form Sections */}
                    <div className="mt-6 space-y-5">
                      {/* Logo Upload Card / Dropzone */}
                      {branding.logoUrl ? (
                        /* Uploaded Logo State */
                        <div className="p-5 rounded-2xl border-2 border-blue-500/80 bg-blue-50/30 flex flex-col sm:flex-row items-center justify-between gap-5 shadow-xs transition-all">
                          <div className="flex items-center gap-4 min-w-0">
                            <div className="w-16 h-16 rounded-xl bg-white border border-slate-200 p-1.5 flex items-center justify-center shadow-xs overflow-hidden shrink-0">
                              <img
                                src={branding.logoUrl}
                                alt="Business Logo"
                                className="max-w-full max-h-full object-contain"
                              />
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-sm font-bold text-slate-900 truncate">
                                {identity.name.trim() || 'Brand Logo'}
                              </h4>
                              <p className="text-xs text-slate-500 truncate mt-0.5">
                                {branding.logoFilename || 'logo.png'} • {(branding.logoSizeBytes / 1024).toFixed(1)} KB
                              </p>
                              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 mt-1.5 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Logo Attached & Verified</span>
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5 shrink-0 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/60">
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={logoUploading}
                              className="ob-btn-secondary text-xs h-9 px-3.5 rounded-xl font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs hover:shadow"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              <span>Replace</span>
                            </button>
                            <button
                              type="button"
                              onClick={handleRemoveLogo}
                              disabled={logoUploading}
                              className="px-3.5 h-9 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer border border-rose-200/80 shadow-2xs"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Remove</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Compact Premium Dropzone */
                        <div
                          onClick={() => fileInputRef.current?.click()}
                          onDrop={handleDrop}
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          className={`ob-dropzone ob-dropzone-compact ${isDraggingOver ? 'is-dragging' : ''}`}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              fileInputRef.current?.click();
                            }
                          }}
                          aria-label="Upload business logo"
                        >
                          <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 text-blue-600 flex items-center justify-center mx-auto mb-3 shadow-2xs">
                            {logoUploading ? (
                              <RotateCw className="w-6 h-6 animate-spin text-blue-600" />
                            ) : (
                              <Upload className="w-6 h-6 text-blue-600" />
                            )}
                          </div>

                          <h4 className="text-sm font-bold text-slate-900 mb-1">
                            {logoUploading ? 'Uploading Logo...' : 'Upload your business logo'}
                          </h4>
                          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-3.5 leading-relaxed">
                            Drag and drop an image, or click to browse from your device.
                          </p>

                          <div className="flex items-center justify-center gap-2 flex-wrap">
                            <button
                              type="button"
                              disabled={logoUploading}
                              className="ob-btn-primary py-2 px-5 text-xs font-semibold shadow-xs"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              <span>Choose File</span>
                            </button>
                            <span className="text-[11px] font-medium text-slate-400 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
                              PNG, JPG or WEBP · Up to 2 MB
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Initials Fallback Card */}
                      <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-11 h-11 rounded-xl bg-[#0B1220] text-blue-400 font-extrabold text-sm flex items-center justify-center shrink-0 border border-slate-800 shadow-xs">
                            {businessInitials}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h5 className="text-xs font-bold text-slate-800">Workspace Initials Avatar</h5>
                              <span className={`text-[10px] font-bold px-2 py-0.2 rounded-full border ${
                                !branding.logoUrl
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : 'bg-slate-100 text-slate-500 border-slate-200'
                              }`}>
                                {!branding.logoUrl ? 'Active Fallback' : 'Standby Fallback'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                              Generated from "{identity.name.trim() || 'My Business'}" if no logo is uploaded.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Security & Integrity Note */}
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 text-xs text-slate-600 flex items-start gap-2.5">
                        <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                        <div className="text-[11px] leading-relaxed">
                          <span className="font-semibold text-slate-800">Security Verification: </span>
                          Your logo is checked for supported file formats (PNG, JPG, WEBP), file size (under 2 MB), and server-side magic byte signatures before storage.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Live Brand Preview (5 Cols) */}
                <div className="lg:col-span-5">
                  <div className="ob-step3-preview p-5 lg:p-6 space-y-4 shadow-sm">
                    {/* Preview Top Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center text-[#2563EB]">
                          <Eye className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-sm font-bold text-slate-900">Live Brand Preview</span>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                        <span>Real-time Preview</span>
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 -mt-1 pl-8">
                      See how your business will appear inside Relay.
                    </p>

                    {/* Preview Component 1: Workspace Identity Card */}
                    <div className="rounded-xl bg-white border border-[#E2E8F0] p-4 shadow-2xs space-y-3">
                      <div className="flex items-start gap-3">
                        {branding.logoUrl ? (
                          <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 p-1 flex items-center justify-center shadow-xs overflow-hidden shrink-0">
                            <img
                              src={branding.logoUrl}
                              alt="Logo"
                              className="max-w-full max-h-full object-contain"
                            />
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-[#0B1220] text-blue-400 font-extrabold text-base flex items-center justify-center shrink-0 border border-slate-800 shadow-xs">
                            {businessInitials}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-bold text-slate-900 truncate">
                              {identity.name.trim() || 'My Business'}
                            </h3>
                            {selectedIndustry.name && (
                              <span className="px-2 py-0.2 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                {selectedIndustry.name}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">
                            {identity.email.trim() || user?.email || 'contact@yourbusiness.com'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-slate-100 flex-wrap text-[11px]">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#EFF6FF] border border-[#BFDBFE] text-[#2563EB] font-medium">
                          <Check className="w-3 h-3 stroke-[3]" />
                          <span>{branding.logoUrl ? 'Custom Brand Logo' : 'Initials Avatar'}</span>
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F0FDF4] border border-[#BBF7D0] text-[#16A34A] font-medium">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Workspace Identity</span>
                        </span>
                      </div>
                    </div>

                    {/* Preview Component 2: Relay Sidebar Branding Mockup */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs px-1">
                        <span className="font-bold text-slate-700 flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-blue-600" />
                          <span>Relay Sidebar Appearance</span>
                        </span>
                        <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                          Left Navigation
                        </span>
                      </div>

                      <div className="ob-mini-sidebar space-y-2.5">
                        {/* Mini Sidebar Top Header */}
                        <div className="flex items-center gap-2.5 pb-2 border-b border-slate-800">
                          {branding.logoUrl ? (
                            <div className="w-7 h-7 rounded-lg bg-white p-0.5 flex items-center justify-center overflow-hidden shrink-0 border border-slate-700">
                              <img
                                src={branding.logoUrl}
                                alt="Logo"
                                className="max-w-full max-h-full object-contain"
                              />
                            </div>
                          ) : (
                            <div className="w-7 h-7 rounded-lg bg-[#2563EB] text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                              {businessInitials}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold text-white truncate">
                              {identity.name.trim() || 'My Business'}
                            </div>
                            <div className="text-[10px] text-blue-400 font-medium truncate">
                              {selectedIndustry.name || 'Workspace'}
                            </div>
                          </div>
                        </div>

                        {/* Mini Nav Links */}
                        <div className="space-y-1 text-[11px]">
                          <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-blue-600/25 text-blue-300 font-semibold border border-blue-500/30">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                            <span>Dashboard Overview</span>
                          </div>
                          <div className="flex items-center gap-2 px-2 py-1 rounded-md text-slate-400">
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                            <span>Contacts CRM</span>
                          </div>
                          <div className="flex items-center gap-2 px-2 py-1 rounded-md text-slate-400">
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                            <span>Campaigns & Broadcasts</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Preview Component 3: Top Navigation Bar Branding Preview */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs px-1">
                        <span className="font-bold text-slate-700 flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5 text-blue-600" />
                          <span>Top Navigation Bar</span>
                        </span>
                        <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                          Header Shell
                        </span>
                      </div>

                      <div className="ob-mini-topbar flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-5 h-5 rounded-md bg-[#2563EB] text-white flex items-center justify-center font-black text-[9px] shadow-2xs">
                            R
                          </div>
                          <div className="h-3.5 w-px bg-slate-200" />
                          <div className="flex items-center gap-1.5 min-w-0">
                            {branding.logoUrl ? (
                              <img
                                src={branding.logoUrl}
                                alt="Logo"
                                className="w-4 h-4 object-contain rounded shrink-0"
                              />
                            ) : (
                              <div className="w-4 h-4 rounded bg-[#0B1220] text-blue-400 text-[8px] font-bold flex items-center justify-center shrink-0">
                                {businessInitials}
                              </div>
                            )}
                            <span className="text-[11px] font-bold text-slate-800 truncate max-w-[130px]">
                              {identity.name.trim() || 'My Business'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>Verified</span>
                        </div>
                      </div>
                    </div>

                    {/* Guidance Footer */}
                    <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 flex items-start gap-2.5">
                      <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      <div className="text-[11px] leading-relaxed text-slate-600">
                        <span className="font-semibold text-slate-800">
                          Your brand identity is adaptable anytime.
                        </span>{' '}
                        Logos appear across your team workspace dashboard, navigation bars, and customer exports.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: REVIEW INFORMATION & WORKSPACE LAUNCH CONSOLE */}
          {currentStep === 5 && (
            <div className="ob-animate-fade">
              {/* Top Section */}
              <div className="mb-6">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] text-[#2563EB] text-[11px] font-bold uppercase tracking-wider mb-2.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>Step 5 of 5 · Review & Confirm Setup</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
                  Your workspace is almost ready.
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-1.5 leading-relaxed">
                  Review your business details and confirm your setup. Relay will prepare your industry-specific workspace once you continue.
                </p>
              </div>

              {/* Two-Column Responsive Layout: Left Business Review (7 cols) + Right Launch Readiness (5 cols) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
                {/* Left Column: Business Review & Structured Profile (7 cols) */}
                <div className="lg:col-span-7 flex flex-col space-y-4">
                  {/* Business Identity Hero Card */}
                  <div className="ob-review-hero p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      {branding.logoUrl ? (
                        <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 p-1 flex items-center justify-center shadow-xs overflow-hidden shrink-0">
                          <img
                            src={branding.logoUrl}
                            alt="Business Logo"
                            className="max-w-full max-h-full object-contain"
                          />
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded-2xl bg-[#0B1220] text-blue-400 font-black text-xl flex items-center justify-center shrink-0 border border-slate-800 shadow-xs">
                          {businessInitials}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight truncate">
                            {identity.name.trim() || 'My Business'}
                          </h2>
                          {selectedIndustry.name && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              <SelectedIndustryIcon className="w-3 h-3 text-blue-600" />
                              <span>{selectedIndustry.name}</span>
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                          {identity.email.trim() || user?.email}
                        </p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                            {branding.logoUrl ? 'Custom Brand Logo' : 'Initials Avatar'}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Identity Verified
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="ob-btn-secondary text-xs font-semibold h-8 px-3 rounded-lg flex items-center gap-1.5 shrink-0 hover:bg-slate-100 cursor-pointer"
                      title="Edit Business Identity"
                    >
                      <span>Edit</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Structured Review Groups */}
                  <div className="space-y-3.5">
                    {/* Group 1: Business Profile & Contact Info */}
                    <div className="ob-review-group">
                      <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-blue-600" />
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Business Contact & Presence</h4>
                        </div>
                        <button
                          type="button"
                          onClick={() => setCurrentStep(1)}
                          className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-0.5 cursor-pointer"
                        >
                          <span>Edit</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="ob-review-label block">Business Phone</span>
                          <span className="ob-review-value flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            <span>{identity.phone.trim() || 'Not provided'}</span>
                          </span>
                        </div>
                        <div>
                          <span className="ob-review-label block">Website / Online Profile</span>
                          {identity.website.trim() ? (
                            <a
                              href={identity.website.trim()}
                              target="_blank"
                              rel="noreferrer"
                              className="ob-review-value text-blue-600 hover:underline flex items-center gap-1.5 truncate"
                            >
                              <Globe className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                              <span className="truncate">{identity.website.trim()}</span>
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                          ) : (
                            <span className="ob-review-value text-slate-400">Not provided</span>
                          )}
                        </div>
                        {identity.description.trim() && (
                          <div className="sm:col-span-2 pt-1">
                            <span className="ob-review-label block">Business Description</span>
                            <p className="text-xs text-slate-700 leading-relaxed italic line-clamp-2">
                              "{identity.description.trim()}"
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Group 2: Industry Configuration & CRM Settings */}
                    <div className="ob-review-group">
                      <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <SelectedIndustryIcon className="w-4 h-4 text-blue-600" />
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Industry & CRM Workflow</h4>
                        </div>
                        <button
                          type="button"
                          onClick={() => setCurrentStep(2)}
                          className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-0.5 cursor-pointer"
                        >
                          <span>Change</span>
                        </button>
                      </div>

                      <div className="space-y-2 text-xs">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div>
                            <span className="ob-review-label block">Selected Vertical</span>
                            <span className="ob-review-value text-sm text-blue-700 font-extrabold">
                              {selectedIndustry.name}
                            </span>
                          </div>
                          {selectedIndustry.category && (
                            <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                              {selectedIndustry.subtitle || selectedIndustry.category}
                            </span>
                          )}
                        </div>

                        {selectedIndustry.description && (
                          <p className="text-[11px] text-slate-600 leading-relaxed">
                            {selectedIndustry.description}
                          </p>
                        )}

                        {selectedIndustry.terminology && (
                          <div className="pt-2 border-t border-slate-100 flex items-center gap-2 text-[11px] text-slate-500 flex-wrap">
                            <span className="font-semibold text-slate-700">CRM Workflow:</span>
                            <span>Lead: <strong className="text-slate-900">{selectedIndustry.terminology.leadLabel || 'Client'}</strong></span>
                            <span>•</span>
                            <span>Offering: <strong className="text-slate-900">{selectedIndustry.terminology.offeringLabel || 'Service'}</strong></span>
                            <span>•</span>
                            <span>Action: <strong className="text-slate-900">{selectedIndustry.terminology.actionLabel || 'Booking'}</strong></span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Group 3: Regional & Localization Preferences */}
                    <div className="ob-review-group">
                      <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-blue-600" />
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Regional & Operating Settings</h4>
                        </div>
                        <button
                          type="button"
                          onClick={() => setCurrentStep(3)}
                          className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-0.5 cursor-pointer"
                        >
                          <span>Change</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div>
                          <span className="ob-review-label block">Operating Location</span>
                          <span className="ob-review-value flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            <span className="truncate">{formattedLocationPreview || 'India'}</span>
                          </span>
                        </div>
                        <div>
                          <span className="ob-review-label block">Timezone</span>
                          <span className="ob-review-value flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span className="truncate">{previewTimezoneDisplay}</span>
                          </span>
                        </div>
                        <div>
                          <span className="ob-review-label block">Language</span>
                          <span className="ob-review-value flex items-center gap-1.5">
                            <Languages className="w-3.5 h-3.5 text-slate-400" />
                            <span className="truncate">{previewLanguageDisplay}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Group 4: Branding Asset */}
                    <div className="ob-review-group">
                      <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <Layers className="w-4 h-4 text-blue-600" />
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Branding & Logo Asset</h4>
                        </div>
                        <button
                          type="button"
                          onClick={() => setCurrentStep(4)}
                          className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-0.5 cursor-pointer"
                        >
                          <span>Edit</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-3 text-xs">
                        {branding.logoUrl ? (
                          <>
                            <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 p-1 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                              <img src={branding.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                            </div>
                            <div className="min-w-0">
                              <span className="font-bold text-slate-900 block truncate">{branding.logoFilename || 'brand-logo.png'}</span>
                              <span className="text-[11px] text-slate-500">
                                {((branding.logoSizeBytes || 0) / 1024).toFixed(1)} KB • Custom Verified Logo Attached
                              </span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="w-10 h-10 rounded-xl bg-[#0B1220] text-blue-400 font-black text-sm flex items-center justify-center shrink-0 border border-slate-800 shadow-2xs">
                              {businessInitials}
                            </div>
                            <div className="min-w-0">
                              <span className="font-bold text-slate-900 block">Styled Initials Avatar ({businessInitials})</span>
                              <span className="text-[11px] text-slate-500">
                                No custom logo uploaded · Workspace will use initials avatar (adaptable anytime)
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Launch Readiness Panel (5 cols) */}
                <div className="lg:col-span-5">
                  <div className="ob-step3-preview p-5 lg:p-6 space-y-4 shadow-sm">
                    {/* Panel Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center text-[#2563EB]">
                          <Rocket className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-sm font-bold text-slate-900">Your Relay Workspace</span>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                        <span>Ready to Configure</span>
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 -mt-1 pl-8">
                      Here's what Relay will configure for your business.
                    </p>

                    {/* Industry Starter Package: 2x2 Mini-stat Grid */}
                    <div className="rounded-xl bg-white border border-[#E2E8F0] p-4 shadow-2xs space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-blue-600" />
                          <span>Industry Starter Package</span>
                        </span>
                        <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">
                          {selectedIndustry.name}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="ob-stat-tile">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-bold text-slate-600">Templates</span>
                            <FileText className="w-3.5 h-3.5 text-blue-600" />
                          </div>
                          <div className="text-lg font-black text-slate-900">
                            {selectedIndustry.templateCount || 15}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">Pre-approved copy</div>
                        </div>

                        <div className="ob-stat-tile">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-bold text-slate-600">Quick Replies</span>
                            <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                          </div>
                          <div className="text-lg font-black text-slate-900">
                            {selectedIndustry.quickReplyCount || 8}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">1-click agent answers</div>
                        </div>

                        <div className="ob-stat-tile">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-bold text-slate-600">Starter Rules</span>
                            <Sliders className="w-3.5 h-3.5 text-blue-600" />
                          </div>
                          <div className="text-lg font-black text-slate-900">
                            {selectedIndustry.automationCount || 6}
                          </div>
                          <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">Provisioned off</div>
                        </div>

                        <div className="ob-stat-tile">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-bold text-slate-600">Campaigns</span>
                            <Megaphone className="w-3.5 h-3.5 text-blue-600" />
                          </div>
                          <div className="text-lg font-black text-slate-900">
                            {selectedIndustry.campaignCount || 2}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">Ready-to-run drafts</div>
                        </div>
                      </div>
                    </div>

                    {/* What Happens Next: 3 Progression Steps */}
                    <div className="rounded-xl bg-white border border-[#E2E8F0] p-4 shadow-2xs space-y-2.5">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                        <span>What Happens When You Launch</span>
                      </span>

                      <div className="space-y-2 text-xs">
                        <div className="ob-workflow-step">
                          <div className="ob-workflow-num">1</div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 text-xs">Workspace Provisioned</div>
                            <div className="text-[11px] text-slate-500">Dedicated MongoDB tenant created with OWNER privileges.</div>
                          </div>
                        </div>

                        <div className="ob-workflow-step">
                          <div className="ob-workflow-num">2</div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 text-xs">Industry Resources Initialized</div>
                            <div className="text-[11px] text-slate-500">Starter templates, replies, and rules saved to your workspace.</div>
                          </div>
                        </div>

                        <div className="ob-workflow-step">
                          <div className="ob-workflow-num">3</div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 text-xs">Enter Your Dashboard</div>
                            <div className="text-[11px] text-slate-500">Add genuine contacts, configure CRM tags, and simulate campaigns.</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Plan & Billing Transparency Card */}
                    <div className="rounded-xl bg-blue-50/70 border border-blue-200 p-3.5 text-xs text-blue-950 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                          <CreditCard className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-900 text-xs">Relay Workspace Access</span>
                            <span className="px-2 py-0.2 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                              Mock Billing Active
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 mt-0.5">
                            No credit card required • Mock billing mode is enabled for safe development testing.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Security & Boundaries Compact Note */}
                    <div className="rounded-xl border border-slate-200/90 bg-slate-50 p-3 flex items-start gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      <div className="text-[11px] leading-relaxed text-slate-600">
                        <span className="font-bold text-slate-800">Tenant Isolation & Privacy: </span>
                        Your data is isolated by workspace ownership. Meta WhatsApp Cloud API remains in offline mock mode until live credentials are explicitly provided.
                      </div>
                    </div>

                    {/* Launch Button in Right Panel */}
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={handleProvisionWorkspace}
                        disabled={isProvisioning}
                        className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {isProvisioning ? (
                          <>
                            <RotateCw className="w-4 h-4 animate-spin" />
                            <span>Setting up workspace...</span>
                          </>
                        ) : (
                          <>
                            <span>Create Business Workspace</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                      <p className="text-[11px] text-center text-slate-400 mt-2">
                        Your workspace will be created using the confirmed details above.
                      </p>
                    </div>
                  </div>
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
                  <span className="text-slate-500">Plan & Billing:</span>
                  <span className="font-bold text-emerald-700">Relay Workspace (Mock Billing Mode)</span>
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

          {/* Stepper Navigation Footer (Steps 2 to 5) */}
          {currentStep > 1 && currentStep < 6 && (
            <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between">
              {currentStep > 1 ? (
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={isSaving || isProvisioning}
                  className="ob-btn-secondary h-11 px-6 rounded-xl text-sm font-semibold flex items-center gap-2 cursor-pointer shadow-2xs hover:shadow"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-400">
                  Step {currentStep} of 5
                </span>
                {currentStep < 5 && (
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={isSaving || (currentStep === 2 && !industryKey)}
                    title={currentStep === 2 && !industryKey ? 'Select an industry to continue' : 'Continue to next step'}
                    className={`ob-btn-primary h-11 px-7 rounded-xl text-sm font-semibold flex items-center gap-2 shadow-sm transition-all ${
                      currentStep === 2 && !industryKey ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow'
                    }`}
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
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>

      {/* Page Footer */}
      <footer className="text-center py-6 text-xs text-slate-400 border-t border-slate-200/80 bg-white/60">
        © {new Date().getFullYear()} Relay Automation Inc. All rights reserved. • Multi-Tenant WhatsApp Business Automation
      </footer>
    </div>
  );
}
