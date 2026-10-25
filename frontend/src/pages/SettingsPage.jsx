import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  LockKeyhole,
  UserRound,
  Info,
  Radio,
  ShieldCheck,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Building2,
  Eye,
  EyeOff,
  History,
  Check,
  RefreshCw,
  Activity,
  Cpu,
  Server,
  Terminal,
  Play,
  CheckCircle,
  CreditCard,
  Upload,
  Trash2,
  Image as ImageIcon,
  MapPin,
  Mail,
  Phone,
  Globe,
  Clock,
  Bell,
  Shield,
  Layers,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useWorkspace } from '../context/WorkspaceContext';
import { resolveMediaUrl } from '../utils/media';
import settingsService from '../services/settings';
import { getSystemMessagingStatus, runMockDiagnostic } from '../services/messages';
import PageHeader from '../components/PageHeader';
import DeveloperTestingCenter from '../components/DeveloperTestingCenter';
import IndustryConfigHub from '../components/industry/IndustryConfigHub';
import BillingSettingsPanel from '../components/BillingSettingsPanel';
import InboundSimulatorModal from '../components/mock/InboundSimulatorModal';
import AutomationTestConsole from '../components/mock/AutomationTestConsole';
import '../settings.css';

const VALID_TABS = ['profile', 'business', 'security', 'integrations', 'whatsapp', 'preferences', 'billing', 'about', 'developer'];

const IANA_TIMEZONES = [
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Singapore',
  'Europe/London',
  'America/New_York',
  'America/Los_Angeles',
  'UTC',
];

const CALLING_CODES = [
  { code: '+91', country: 'India (+91)' },
  { code: '+971', country: 'United Arab Emirates (+971)' },
  { code: '+1', country: 'United States / Canada (+1)' },
  { code: '+44', country: 'United Kingdom (+44)' },
  { code: '+65', country: 'Singapore (+65)' },
  { code: '+61', country: 'Australia (+61)' },
];

export default function SettingsPage() {
  const { user, updateUser, refreshUser } = useAuth();
  const { currentWorkspace, refreshWorkspace: refreshWorkspaces } = useWorkspace();

  const isM2W = currentWorkspace
    ? currentWorkspace.slug === 'm2w-realty'
    : (user?.businessName?.includes('M2W') ?? false);
  const workspaceName =
    currentWorkspace?.name ||
    (isM2W ? 'M2W Realty' : user?.businessName || 'Relay Workspace');
  const roleLabel = currentWorkspace?.membership?.role || 'OWNER';

  const getInitials = (name) => {
    if (!name) return 'RW';
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };
  const initials = getInitials(workspaceName);

  const getUserInitials = (name) => {
    if (!name) return 'OP';
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Logo upload state
  const [logoUploading, setLogoUploading] = useState(false);

  const resolveTab = () => {
    const path = window.location.pathname.toLowerCase();
    if (path.endsWith('/billing')) return 'billing';
    if (path.endsWith('/whatsapp')) return 'whatsapp';
    const hash = window.location.hash.replace('#', '').toLowerCase();
    return VALID_TABS.includes(hash) ? hash : 'profile';
  };

  // Active tab synchronized with URL hash
  const [activeTab, setActiveTab] = useState(resolveTab);

  // Loading states
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingBusiness, setSavingBusiness] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);

  // System Readiness Overview
  const [systemStatus, setSystemStatus] = useState(null);

  // Simulation Modals (SaaS Prompt 8)
  const [showInboundModal, setShowInboundModal] = useState(false);
  const [showTestConsole, setShowTestConsole] = useState(false);

  // Tab 1: Profile State
  const [profileName, setProfileName] = useState(user?.name || '');

  // Tab 2: Business Profile State
  const [business, setBusiness] = useState({
    legalOrTradingName: '',
    displayName: '',
    businessCategory: 'Real Estate',
    email: '',
    phone: '',
    website: '',
    description: '',
    address: '',
    city: '',
    state: '',
    country: 'India',
    postalCode: '',
    supportEmail: '',
    logoUrl: '',
  });
  const [businessScore, setBusinessScore] = useState(0);

  // Tab 3: Security & Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [securityData, setSecurityData] = useState(null);

  // Logo Upload / Remove Handlers
  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      toast.error('Only PNG, JPEG, or WEBP images are supported.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo file size must not exceed 2MB.');
      return;
    }

    const formData = new FormData();
    formData.append('logo', file);
    setLogoUploading(true);
    try {
      const res = await settingsService.uploadLogo(formData);
      const newLogoUrl = res.data?.logoUrl || res.data?.data?.logoUrl;
      setBusiness((prev) => ({ ...prev, logoUrl: newLogoUrl }));
      toast.success('Logo uploaded and updated successfully.');
      if (refreshWorkspaces) refreshWorkspaces();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload logo.');
    } finally {
      setLogoUploading(false);
    }
  };

  const handleLogoDelete = async () => {
    if (!window.confirm('Are you sure you want to remove the business logo?')) return;
    setLogoUploading(true);
    try {
      await settingsService.deleteLogo();
      setBusiness((prev) => ({ ...prev, logoUrl: '' }));
      toast.success('Logo removed.');
      if (refreshWorkspaces) refreshWorkspaces();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove logo.');
    } finally {
      setLogoUploading(false);
    }
  };

  // Tab 4: WhatsApp Integration State
  const [integration, setIntegration] = useState(null);
  const [messagingQueueHealth, setMessagingQueueHealth] = useState(null);
  const [loadingQueueHealth, setLoadingQueueHealth] = useState(false);
  const [runningDiagnostic, setRunningDiagnostic] = useState(false);
  const [activeScenario, setActiveScenario] = useState('');
  const [diagnosticResult, setDiagnosticResult] = useState(null);
  const [waConnecting, setWaConnecting] = useState(false);
  const handleRefreshIntegration = async () => {
    setWaConnecting(true);
    try {
      const { data } = await settingsService.getIntegrationStatus();
      setIntegration(data.integration);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to check the integration.');
    } finally { setWaConnecting(false); }
  };

  // Tab 5: Operational Preferences State
  const [prefs, setPrefs] = useState({
    timezone: 'Asia/Kolkata',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '12h',
    defaultCountryCallingCode: '+91',
    preferredLanguage: 'English',
    quietHours: { enabled: true, start: '21:00', end: '09:00' },
    workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    notificationPreferences: {
      campaignScheduled: true,
      campaignSimulationCompleted: true,
      campaignRequiresAttention: true,
      incomingReply: false,
      providerDisconnected: true,
    },
    campaignSummaryFrequency: 'daily',
  });

  // Calculate password strength
  const passwordStrength = useMemo(() => {
    if (!newPassword) return 0;
    let score = 0;
    if (newPassword.length >= 8) score += 1;
    if (newPassword.length >= 12) score += 1;
    if (/[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword)) score += 1;
    if (/[0-9]/.test(newPassword)) score += 1;
    if (/[^A-Za-z0-9]/.test(newPassword)) score += 1;
    return score;
  }, [newPassword]);

  // Sync hash deep-linking with browser history
  useEffect(() => {
    const handleHash = () => {
      const path = window.location.pathname.toLowerCase();
      if (path.endsWith('/billing')) {
        setActiveTab('billing');
        return;
      }
      if (path.endsWith('/whatsapp')) {
        setActiveTab('whatsapp');
        return;
      }
      const hash = window.location.hash.replace('#', '').toLowerCase();
      if (VALID_TABS.includes(hash)) {
        setActiveTab(hash);
      } else if (!hash) {
        setActiveTab('profile');
      }
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const switchTab = (tabKey) => {
    setActiveTab(tabKey);
    window.location.hash = tabKey;
  };

  // Initial load of all settings data
  useEffect(() => {
    let mounted = true;

    async function loadAllSettings() {
      try {
        setLoading(true);
        const [profRes, busRes, secRes, intRes, prefRes, sysRes] = await Promise.allSettled([
          settingsService.getProfile(),
          settingsService.getBusinessProfile(),
          settingsService.getSecurityOverview(),
          settingsService.getIntegrationStatus(),
          settingsService.getPreferences(),
          settingsService.getSystemStatus(),
        ]);

        if (!mounted) return;

        if (profRes.status === 'fulfilled') {
          setProfileName(profRes.value.data.profile.name || user?.name || '');
        }

        if (busRes.status === 'fulfilled') {
          const bp = busRes.value.data.businessProfile;
          setBusiness({
            legalOrTradingName: bp.legalOrTradingName || '',
            displayName: bp.displayName || bp.legalOrTradingName || '',
            businessCategory: bp.businessCategory || currentWorkspace?.industryKey || 'General Business',
            email: bp.email || '',
            phone: bp.phone || '',
            website: bp.website || '',
            description: bp.description || '',
            address: bp.address || '',
            city: bp.city || '',
            state: bp.state || '',
            country: bp.country || 'India',
            postalCode: bp.postalCode || '',
            supportEmail: bp.supportEmail || '',
            logoUrl: bp.logoUrl || '',
          });
          setBusinessScore(busRes.value.data.completenessScore || 0);
        }

        if (secRes.status === 'fulfilled') {
          setSecurityData(secRes.value.data.security);
        }

        if (intRes.status === 'fulfilled') {
          setIntegration(intRes.value.data.integration);
        }

        if (prefRes.status === 'fulfilled') {
          setPrefs((prev) => ({
            ...prev,
            ...prefRes.value.data.preferences,
          }));
        }

        if (sysRes.status === 'fulfilled') {
          setSystemStatus(sysRes.value.data.system);
        }
      } catch (err) {
        toast.error('Could not load settings data.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadAllSettings();

    return () => {
      mounted = false;
    };
  }, [user]);

  const fetchMessagingHealth = async () => {
    setLoadingQueueHealth(true);
    try {
      const res = await getSystemMessagingStatus();
      setMessagingQueueHealth(res.data);
    } catch (err) {
      console.error('Failed to load messaging queue status', err);
    } finally {
      setLoadingQueueHealth(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'integrations') {
      fetchMessagingHealth();
    }
  }, [activeTab]);

  const handleRunDiagnostic = async (scenario) => {
    setRunningDiagnostic(true);
    setActiveScenario(scenario);
    setDiagnosticResult(null);
    try {
      const res = await runMockDiagnostic(scenario);
      setDiagnosticResult(res.data);
      toast.success(`Diagnostic "${scenario}" finished successfully.`);
      fetchMessagingHealth();
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      toast.error(`Diagnostic failed: ${msg}`);
      setDiagnosticResult({ error: msg });
    } finally {
      setRunningDiagnostic(false);
      setActiveScenario('');
    }
  };

  // Handle Save Profile
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (profileName.trim().length < 2) {
      return toast.error('Full Name must be at least 2 characters.');
    }
    setSavingProfile(true);
    try {
      const { data } = await settingsService.updateProfile({
        name: profileName.trim(),
      });
      updateUser({ name: data.profile.name });
      toast.success('Owner profile updated successfully.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  // Handle Save Business Profile
  const handleSaveBusiness = async (e) => {
    e.preventDefault();
    if (!business.legalOrTradingName.trim()) {
      return toast.error('Business Legal or Trading Name is required.');
    }
    setSavingBusiness(true);
    try {
      const { data } = await settingsService.updateBusinessProfile(business);
      setBusinessScore(data.completenessScore);
      updateUser({ businessName: data.businessProfile.legalOrTradingName });
      toast.success('Business profile saved to MongoDB.');

      // Refresh system readiness
      const sysRes = await settingsService.getSystemStatus().catch(() => null);
      if (sysRes?.data?.system) setSystemStatus(sysRes.data.system);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save business details.');
    } finally {
      setSavingBusiness(false);
    }
  };

  // Handle Save Password
  const handleSavePassword = async (e) => {
    e.preventDefault();
    if (!currentPassword) {
      return toast.error('Please enter your current password.');
    }
    if (newPassword.length < 8) {
      return toast.error('New password must be at least 8 characters.');
    }
    if (newPassword !== confirmPassword) {
      return toast.error('New passwords do not match.');
    }
    if (currentPassword === newPassword) {
      return toast.error('New password must be different from current password.');
    }

    setSavingPassword(true);
    try {
      await settingsService.changePassword({
        currentPassword,
        newPassword,
      });
      toast.success('Password updated securely. Session rotated.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      // Refresh security overview
      const sec = await settingsService.getSecurityOverview().catch(() => null);
      if (sec?.data?.security) setSecurityData(sec.data.security);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update password.');
    } finally {
      setSavingPassword(false);
    }
  };

  // Handle Save Preferences
  const handleSavePreferences = async (e) => {
    e.preventDefault();
    setSavingPrefs(true);
    try {
      const { data } = await settingsService.updatePreferences(prefs);
      setPrefs(data.preferences);
      toast.success('Operational preferences saved successfully.');

      const sysRes = await settingsService.getSystemStatus().catch(() => null);
      if (sysRes?.data?.system) setSystemStatus(sysRes.data.system);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save preferences.');
    } finally {
      setSavingPrefs(false);
    }
  };

  // Audit event formatter
  const formatAuditEvent = (action) => {
    switch (action) {
      case 'login_success':
        return { label: 'Successful Login', type: 'success' };
      case 'login_failure':
        return { label: 'Failed Login', type: 'failure' };
      case 'password_change':
        return { label: 'Password Changed', type: 'neutral' };
      case 'session_rotated':
        return { label: 'Session Rotated', type: 'neutral' };
      default:
        return { label: (action || 'Security Event').replace(/_/g, ' '), type: 'neutral' };
    }
  };

  return (
    <div className="settings-page">
      <PageHeader
        eyebrow="RELAY · WORKSPACE CONFIGURATION"
        title="Settings"
        subtitle="Manage your account, business identity, security, integrations and workspace preferences."
      />

      {/* Lightweight Setup Readiness Widget */}
      <div className="settings-readiness-banner">
        <div className="readiness-metrics">
          <div className="readiness-pill">
            <span
              className={`readiness-dot ${businessScore >= 100 ? 'complete' : 'pending'}`}
            />
            <span>
              Business Profile:{' '}
              <strong style={{ color: businessScore >= 100 ? '#16A34A' : '#D97706' }}>
                {businessScore >= 100 ? 'Complete (100%)' : `${businessScore}% Complete`}
              </strong>
            </span>
          </div>

          <div className="readiness-pill">
            <span className="readiness-dot mock" />
            <span>
              WhatsApp Provider:{' '}
              <strong style={{ color: '#2563EB' }}>Mock Mode (Pending Provider Setup)</strong>
            </span>
          </div>

          <div className="readiness-pill">
            <span className="readiness-dot complete" />
            <span>
              Timezone: <strong>{prefs.timezone || 'Asia/Kolkata'}</strong>
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="readiness-role-badge">
            <ShieldCheck size={13} />
            {user?.role === 'owner' ? 'Owner / Single Operator' : user?.role || 'Owner'}
          </span>
        </div>
      </div>

      <div className="settings-layout">
        {/* Navigation Sidebar */}
        <aside className="settings-nav">
          <button
            type="button"
            className={`settings-nav-item ${activeTab === 'profile' ? 'active selected' : ''}`}
            onClick={() => switchTab('profile')}
            aria-selected={activeTab === 'profile'}
          >
            <UserRound size={16} /> Profile
          </button>
          <button
            type="button"
            className={`settings-nav-item ${activeTab === 'business' ? 'active selected' : ''}`}
            onClick={() => switchTab('business')}
            aria-selected={activeTab === 'business'}
          >
            <Building2 size={16} /> Business Profile
          </button>
          <button
            type="button"
            className={`settings-nav-item ${activeTab === 'security' ? 'active selected' : ''}`}
            onClick={() => switchTab('security')}
            aria-selected={activeTab === 'security'}
          >
            <ShieldCheck size={16} /> Security &amp; Password
          </button>
          <button
            type="button"
            className={`settings-nav-item ${activeTab === 'integrations' ? 'active selected' : ''}`}
            onClick={() => switchTab('integrations')}
            aria-selected={activeTab === 'integrations'}
          >
            <Radio size={16} /> WhatsApp Integration
          </button>
          <button
            type="button"
            className={`settings-nav-item ${activeTab === 'preferences' ? 'active selected' : ''}`}
            onClick={() => switchTab('preferences')}
            aria-selected={activeTab === 'preferences'}
          >
            <Sliders size={16} /> Preferences
          </button>
          <button
            type="button"
            className={`settings-nav-item ${activeTab === 'billing' ? 'active selected' : ''}`}
            onClick={() => switchTab('billing')}
            aria-selected={activeTab === 'billing'}
          >
            <CreditCard size={16} /> Billing &amp; Subscriptions
          </button>
          <button
            type="button"
            className={`settings-nav-item ${activeTab === 'about' ? 'active selected' : ''}`}
            onClick={() => switchTab('about')}
            aria-selected={activeTab === 'about'}
          >
            <Info size={16} /> About Relay
          </button>
          <button
            type="button"
            className={`settings-nav-item ${activeTab === 'developer' ? 'active selected' : ''}`}
            onClick={() => switchTab('developer')}
            aria-selected={activeTab === 'developer'}
          >
            <Terminal size={16} /> Developer / Test Mode
          </button>
        </aside>

        {/* Tabbed Panels — Exclusively renders active panel */}
        <div className="settings-sections">
          {/* TAB 1: OWNER PROFILE PANEL */}
          {activeTab === 'profile' && (
            <section className="panel settings-panel" id="profile" aria-labelledby="tab-profile">
              <div className="settings-panel-header">
                <div>
                  <h2 id="tab-profile">Owner Profile</h2>
                  <p>Manage your authenticated operator identity and personal display settings.</p>
                </div>
              </div>

              <form
                onSubmit={handleSaveProfile}
                className="profile-form"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '18px',
                  maxWidth: '580px',
                }}
              >
                {/* Personal Identity Avatar Card */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '16px 20px',
                    background: '#F8FAFC',
                    borderRadius: '12px',
                    border: '1px solid #E2E8F0',
                  }}
                >
                  <div className="user-identity-avatar">
                    {getUserInitials(profileName || user?.name)}
                  </div>
                  <div>
                    <strong style={{ fontSize: '15px', color: '#0F172A', display: 'block' }}>
                      {profileName || user?.name || 'Owner Operator'}
                    </strong>
                    <div style={{ fontSize: '12.5px', color: '#64748B', marginTop: '2px' }}>
                      {user?.email} · {roleLabel}
                    </div>
                  </div>
                </div>

                <label className="field">
                  <span>Full Display Name *</span>
                  <input
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    minLength={2}
                    maxLength={80}
                    required
                    placeholder="e.g. Sumit Thakur"
                  />
                  <small>
                    Saved to MongoDB and updated across sidebar and topbar menus.
                  </small>
                </label>

                <label className="field">
                  <span>Account Email</span>
                  <input
                    value={user?.email || ''}
                    readOnly
                    disabled
                  />
                  <small>
                    Primary login identity. Direct modification is restricted for security.
                  </small>
                </label>

                <div className="form-row-2">
                  <label className="field">
                    <span>Authorized Role</span>
                    <input
                      value={user?.role === 'owner' ? 'Owner / Single Operator' : user?.role || 'Owner'}
                      readOnly
                      disabled
                    />
                  </label>

                  <label className="field">
                    <span>Account Created</span>
                    <input
                      value={
                        user?.createdAt
                          ? new Date(user.createdAt).toLocaleDateString()
                          : 'Active'
                      }
                      readOnly
                      disabled
                    />
                  </label>
                </div>

                {user?.lastLoginAt && (
                  <div style={{ fontSize: '12px', color: '#64748B' }}>
                    Last login recorded:{' '}
                    <strong style={{ color: '#0F172A' }}>{new Date(user.lastLoginAt).toLocaleString()}</strong>
                  </div>
                )}

                <div style={{ paddingTop: '10px' }}>
                  <button type="submit" className="primary-btn" disabled={savingProfile}>
                    {savingProfile ? 'Saving changes…' : 'Save profile changes'}
                  </button>
                </div>
              </form>
            </section>
          )}

          {/* TAB 2: BUSINESS PROFILE PANEL */}
          {activeTab === 'business' && (
            <section className="panel settings-panel" id="business" aria-labelledby="tab-business">
              <div className="settings-panel-header">
                <div>
                  <h2 id="tab-business">Business Profile</h2>
                  <p>
                    Configure business identity, contact channels, and address used for WhatsApp compliance and campaign opt-in records.
                  </p>
                </div>

                <div
                  style={{
                    backgroundColor:
                      businessScore >= 100
                        ? 'rgba(22, 163, 74, 0.12)'
                        : 'rgba(217, 119, 6, 0.12)',
                    color:
                      businessScore >= 100
                        ? '#16A34A'
                        : '#D97706',
                    border: `1px solid ${businessScore >= 100 ? 'rgba(22, 163, 74, 0.25)' : 'rgba(217, 119, 6, 0.25)'}`,
                    fontSize: '12px',
                    padding: '6px 12px',
                    fontWeight: 700,
                    borderRadius: '8px',
                  }}
                >
                  {businessScore >= 100
                    ? '100% Profile Complete'
                    : `${businessScore}% Complete`}
                </div>
              </div>

              <form
                onSubmit={handleSaveBusiness}
                className="business-form"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px',
                  maxWidth: '780px',
                }}
              >
                {/* GROUP 1: Business Identity */}
                <div className="settings-group-card">
                  <div className="settings-group-card-header">
                    <div>
                      <div className="settings-group-card-title">
                        <Building2 size={16} color="#2563EB" /> 1. Business Identity
                      </div>
                      <div className="settings-group-card-desc">
                        Official brand assets, trading name, and industry classification.
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Official Business Logo Badge & Upload Manager */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                        padding: '14px 16px',
                        background: '#F8FAFC',
                        borderRadius: '10px',
                        border: '1px solid #E2E8F0',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div className="business-logo-preview">
                        {business.logoUrl ? (
                          <img
                            src={resolveMediaUrl(business.logoUrl)}
                            alt={business.legalOrTradingName || workspaceName}
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                          />
                        ) : isM2W ? (
                          <img
                            src="/logo.png"
                            alt="M2W Realty Logo"
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                          />
                        ) : (
                          <div
                            style={{
                              width: '100%',
                              height: '100%',
                              borderRadius: '8px',
                              background: 'linear-gradient(135deg, #1E3A8A, #2563EB)',
                              color: '#FFFFFF',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 800,
                              fontSize: '18px',
                            }}
                          >
                            {initials}
                          </div>
                        )}
                      </div>

                      <div style={{ flex: 1, minWidth: '200px' }}>
                        <strong style={{ fontSize: '14px', color: '#0F172A', display: 'block' }}>
                          Business Logo: {business.legalOrTradingName || workspaceName}
                        </strong>
                        <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                          Displayed across campaign headers, sidebar branding, and opt-in records.
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label
                          className="outline-btn small"
                          style={{
                            cursor: logoUploading ? 'not-allowed' : 'pointer',
                            opacity: logoUploading ? 0.7 : 1,
                            marginBottom: 0,
                          }}
                        >
                          <Upload size={13} />
                          <span>{logoUploading ? 'Uploading...' : business.logoUrl ? 'Replace Logo' : 'Upload Logo'}</span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={handleLogoUpload}
                            disabled={logoUploading}
                            style={{ display: 'none' }}
                          />
                        </label>
                        {business.logoUrl && (
                          <button
                            type="button"
                            className="outline-btn small"
                            onClick={handleLogoDelete}
                            disabled={logoUploading}
                            style={{ color: '#DC2626', borderColor: 'rgba(220, 38, 38, 0.3)' }}
                            title="Remove custom logo"
                          >
                            <Trash2 size={13} />
                            <span>Remove</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="form-row-2">
                      <label className="field">
                        <span>Business / Trading Name *</span>
                        <input
                          value={business.legalOrTradingName}
                          onChange={(e) =>
                            setBusiness({ ...business, legalOrTradingName: e.target.value })
                          }
                          placeholder="e.g. Apex Realty Ventures"
                          required
                        />
                        <small>Legal entity name for customer consent audit trail.</small>
                      </label>

                      <label className="field">
                        <span>Business Display Name</span>
                        <input
                          value={business.displayName}
                          onChange={(e) =>
                            setBusiness({ ...business, displayName: e.target.value })
                          }
                          placeholder="e.g. Apex Realty"
                        />
                        <small>Used in message templates &amp; customer sign-offs.</small>
                      </label>
                    </div>

                    <div className="form-row-2">
                      <label className="field">
                        <span>Business Category / Industry</span>
                        <input
                          value={business.businessCategory}
                          onChange={(e) =>
                            setBusiness({ ...business, businessCategory: e.target.value })
                          }
                          placeholder="Real Estate"
                        />
                      </label>

                      <label className="field">
                        <span>Official Website</span>
                        <input
                          value={business.website}
                          onChange={(e) =>
                            setBusiness({ ...business, website: e.target.value })
                          }
                          placeholder="https://apexrealty.in"
                        />
                      </label>
                    </div>
                  </div>
                </div>

                {/* GROUP 2: Contact Information */}
                <div className="settings-group-card">
                  <div className="settings-group-card-header">
                    <div>
                      <div className="settings-group-card-title">
                        <Mail size={16} color="#2563EB" /> 2. Contact Information
                      </div>
                      <div className="settings-group-card-desc">
                        Official business email and customer contact channels.
                      </div>
                    </div>
                  </div>

                  <div className="form-row-2">
                    <label className="field">
                      <span>Business Contact Email</span>
                      <input
                        type="email"
                        value={business.email}
                        onChange={(e) =>
                          setBusiness({ ...business, email: e.target.value })
                        }
                        placeholder="contact@apexrealty.in"
                      />
                    </label>

                    <label className="field">
                      <span>Business Phone Number</span>
                      <input
                        value={business.phone}
                        onChange={(e) =>
                          setBusiness({ ...business, phone: e.target.value })
                        }
                        placeholder="+91 98765 43210"
                      />
                    </label>
                  </div>
                </div>

                {/* GROUP 3: About Business */}
                <div className="settings-group-card">
                  <div className="settings-group-card-header">
                    <div>
                      <div className="settings-group-card-title">
                        <Info size={16} color="#2563EB" /> 3. About Business
                      </div>
                      <div className="settings-group-card-desc">
                        Brief narrative description included in compliance disclosures.
                      </div>
                    </div>
                  </div>

                  <label className="field">
                    <span>Business Description</span>
                    <textarea
                      rows={3}
                      value={business.description}
                      onChange={(e) =>
                        setBusiness({ ...business, description: e.target.value })
                      }
                      placeholder="Brief overview of services provided, advisory focus, or enterprise operations."
                    />
                  </label>
                </div>

                {/* GROUP 4: Location Details */}
                <div className="settings-group-card">
                  <div className="settings-group-card-header">
                    <div>
                      <div className="settings-group-card-title">
                        <MapPin size={16} color="#2563EB" /> 4. Location Details
                      </div>
                      <div className="settings-group-card-desc">
                        Physical premises address for regulatory business transparency.
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <label className="field">
                      <span>Street Address</span>
                      <input
                        value={business.address}
                        onChange={(e) =>
                          setBusiness({ ...business, address: e.target.value })
                        }
                        placeholder="Suite 401, Commercial Arcade, MG Road"
                      />
                    </label>

                    <div className="form-row-4">
                      <label className="field">
                        <span>City</span>
                        <input
                          value={business.city}
                          onChange={(e) =>
                            setBusiness({ ...business, city: e.target.value })
                          }
                          placeholder="Bengaluru"
                        />
                      </label>

                      <label className="field">
                        <span>State</span>
                        <input
                          value={business.state}
                          onChange={(e) =>
                            setBusiness({ ...business, state: e.target.value })
                          }
                          placeholder="Karnataka"
                        />
                      </label>

                      <label className="field">
                        <span>Postal Code</span>
                        <input
                          value={business.postalCode}
                          onChange={(e) =>
                            setBusiness({ ...business, postalCode: e.target.value })
                          }
                          placeholder="560001"
                        />
                      </label>

                      <label className="field">
                        <span>Country</span>
                        <input
                          value={business.country}
                          onChange={(e) =>
                            setBusiness({ ...business, country: e.target.value })
                          }
                          placeholder="India"
                        />
                      </label>
                    </div>
                  </div>
                </div>

                <div style={{ paddingTop: '6px' }}>
                  <button type="submit" className="primary-btn" disabled={savingBusiness}>
                    {savingBusiness ? 'Saving business profile…' : 'Save business profile'}
                  </button>
                </div>
              </form>

              <div style={{ marginTop: '28px', borderTop: '1px solid var(--color-border-subtle)', paddingTop: '24px' }}>
                <IndustryConfigHub />
              </div>
            </section>
          )}

          {/* TAB 3: SECURITY & PASSWORD PANEL */}
          {activeTab === 'security' && (
            <section className="panel settings-panel" id="security" aria-labelledby="tab-security">
              <div className="settings-panel-header">
                <div>
                  <h2 id="tab-security">Security &amp; Password Management</h2>
                  <p>
                    Manage credentials, inspect active device sessions, and review immutable security audit events.
                  </p>
                </div>
              </div>

              {/* Password Change Form */}
              <form
                onSubmit={handleSavePassword}
                className="security-form"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '18px',
                  maxWidth: '580px',
                }}
              >
                <div className="settings-group-card" style={{ padding: '20px' }}>
                  <div className="settings-group-card-header">
                    <div>
                      <div className="settings-group-card-title">
                        <LockKeyhole size={16} color="#2563EB" /> Password &amp; Authentication
                      </div>
                      <div className="settings-group-card-desc">
                        Rotate your master password. Active JWT sessions will be invalidated.
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <label className="field">
                      <span>Current Password *</span>
                      <div className="password-input-box">
                        <input
                          type={showCurrent ? 'text' : 'password'}
                          autoComplete="current-password"
                          required
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="Enter current master password"
                        />
                        <button
                          type="button"
                          className="password-toggle-btn"
                          onClick={() => setShowCurrent(!showCurrent)}
                          aria-label={showCurrent ? 'Hide current password' : 'Show current password'}
                        >
                          {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </label>

                    <div className="form-row-2">
                      <label className="field">
                        <span>New Password *</span>
                        <div className="password-input-box">
                          <input
                            type={showNew ? 'text' : 'password'}
                            autoComplete="new-password"
                            required
                            minLength={8}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Min 8 characters"
                          />
                          <button
                            type="button"
                            className="password-toggle-btn"
                            onClick={() => setShowNew(!showNew)}
                            aria-label={showNew ? 'Hide new password' : 'Show new password'}
                          >
                            {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </label>

                      <label className="field">
                        <span>Confirm New Password *</span>
                        <div className="password-input-box">
                          <input
                            type={showConfirm ? 'text' : 'password'}
                            autoComplete="new-password"
                            required
                            minLength={8}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Repeat new password"
                          />
                          <button
                            type="button"
                            className="password-toggle-btn"
                            onClick={() => setShowConfirm(!showConfirm)}
                            aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                          >
                            {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </label>
                    </div>

                    {/* Password Strength Indicator */}
                    {newPassword && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div
                          style={{
                            display: 'flex',
                            gap: '4px',
                            flex: 1,
                            height: '5px',
                            background: '#E2E8F0',
                            borderRadius: '3px',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              flex: 1,
                              backgroundColor:
                                passwordStrength >= 1
                                  ? passwordStrength >= 3
                                    ? '#16A34A'
                                    : '#D97706'
                                  : 'transparent',
                            }}
                          />
                          <div
                            style={{
                              flex: 1,
                              backgroundColor:
                                passwordStrength >= 3
                                  ? '#16A34A'
                                  : passwordStrength >= 2
                                  ? '#D97706'
                                  : 'transparent',
                            }}
                          />
                          <div
                            style={{
                              flex: 1,
                              backgroundColor:
                                passwordStrength >= 4
                                  ? '#16A34A'
                                  : 'transparent',
                            }}
                          />
                        </div>
                        <span style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 500 }}>
                          {passwordStrength >= 4
                            ? 'Strong password'
                            : passwordStrength >= 2
                            ? 'Moderate'
                            : 'Weak (add numbers/symbols)'}
                        </span>
                      </div>
                    )}

                    <div style={{ paddingTop: '6px' }}>
                      <button type="submit" className="primary-btn" disabled={savingPassword}>
                        {savingPassword ? 'Updating password…' : 'Update password'}
                      </button>
                    </div>
                  </div>
                </div>
              </form>

              {/* Security Overview & Recent Audited Events */}
              <div style={{ marginTop: '28px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '14px', color: '#0F172A' }}>
                  Security Overview &amp; Session Audit
                </h3>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '14px',
                    marginBottom: '24px',
                  }}
                >
                  <div className="settings-stat-card">
                    <span className="label">Session Status</span>
                    <strong className="value" style={{ color: '#2563EB' }}>
                      Active (Current Device)
                    </strong>
                  </div>

                  <div className="settings-stat-card">
                    <span className="label">Password Last Changed</span>
                    <strong className="value">
                      {securityData?.passwordLastChanged
                        ? new Date(securityData.passwordLastChanged).toLocaleDateString()
                        : 'Initial Provisioning'}
                    </strong>
                  </div>

                  <div className="settings-stat-card">
                    <span className="label">Active Sessions</span>
                    <strong className="value">
                      1 (Single Operator Workspace)
                    </strong>
                  </div>
                </div>

                {/* Audit Events Table */}
                <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', overflow: 'hidden' }}>
                  <div style={{ padding: '14px 18px', borderBottom: '1px solid #E2E8F0', fontSize: '13.5px', fontWeight: 700, color: '#0F172A' }}>
                    Recent Security Events (MongoDB Audited)
                  </div>
                  {securityData?.recentEvents && securityData.recentEvents.length > 0 ? (
                    <div style={{ overflowX: 'auto' }}>
                      <table className="audit-events-table" style={{ margin: 0 }}>
                        <thead>
                          <tr>
                            <th>Event Action</th>
                            <th>Timestamp</th>
                            <th>IP Address</th>
                          </tr>
                        </thead>
                        <tbody>
                          {securityData.recentEvents.map((evt) => {
                            const formatted = formatAuditEvent(evt.action);
                            return (
                              <tr key={evt.id}>
                                <td>
                                  <span className={`audit-action-tag ${formatted.type}`}>
                                    {formatted.label}
                                  </span>
                                </td>
                                <td>{new Date(evt.createdAt).toLocaleString()}</td>
                                <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                                  {evt.ipAddress || '127.0.0.1'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: '#64748B' }}>
                      No anomalous security activity recorded.
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* TAB 4: WHATSAPP INTEGRATION PANEL */}
          {(activeTab === 'integrations' || activeTab === 'whatsapp') && (
            <section className="panel settings-panel" id="integrations" aria-labelledby="tab-integrations">
              <div
                style={{
                  borderBottom: '1px solid var(--color-border-subtle)',
                  paddingBottom: '14px',
                  marginBottom: '20px',
                }}
              >
                <h2 style={{ fontSize: '18px', fontWeight: 700 }} id="tab-integrations">
                  WhatsApp Cloud API Integration
                </h2>
                <p
                  style={{
                    fontSize: '13px',
                    color: 'var(--color-text-secondary)',
                    margin: '4px 0 0',
                  }}
                >
                  Inspect Meta WhatsApp Business connection state, sending engine mode, and webhook readiness.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '880px' }}>
                {/* Official API and Mode Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '16px',
                      background: 'var(--color-surface-muted)',
                      borderRadius: '10px',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: '14.5px', color: 'var(--color-text-primary)' }}>
                        Official WhatsApp Cloud API
                      </strong>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                        Provider: Meta BSP
                      </div>
                    </div>
                    <span
                      className="status-badge"
                      style={{
                        backgroundColor: 'var(--color-surface-subtle)',
                        color: 'var(--color-text-muted)',
                        fontSize: '11.5px',
                      }}
                    >
                      Disconnected (Pending Provider Setup)
                    </span>
                  </div>
                </div>

                {/* Sending Engine Mode */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 20px',
                    background: '#F8FAFC',
                    borderRadius: '10px',
                    border: '1px solid #E2E8F0',
                  }}
                >
                  <div>
                    <strong style={{ fontSize: '14.5px', color: '#0F172A' }}>
                      Sending Engine Mode
                    </strong>
                    <div style={{ fontSize: '12.5px', color: '#64748B', marginTop: '2px' }}>
                      Local CRM simulation &amp; planning sandbox. No external WhatsApp messages are sent.
                    </div>
                  </div>
                  <span
                    style={{
                      backgroundColor: 'rgba(37, 99, 235, 0.1)',
                      color: '#2563EB',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: '1px solid rgba(37, 99, 235, 0.2)',
                    }}
                  >
                    Mock Mode (Active &amp; Safe)
                  </span>
                </div>

                {/* Queue Health Card */}
                <div className="settings-group-card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Activity size={18} color="#2563EB" />
                      <strong style={{ fontSize: '15px', color: '#0F172A' }}>
                        Durable Message Queue &amp; Worker Health
                      </strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '11.5px',
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: '6px',
                          background: messagingQueueHealth?.workerRunning ? 'rgba(22, 163, 74, 0.12)' : 'rgba(220, 38, 38, 0.12)',
                          color: messagingQueueHealth?.workerRunning ? '#16A34A' : '#DC2626',
                          border: `1px solid ${messagingQueueHealth?.workerRunning ? 'rgba(22, 163, 74, 0.25)' : 'rgba(220, 38, 38, 0.25)'}`,
                        }}
                      >
                        {messagingQueueHealth?.workerRunning ? 'Worker Active (Polling)' : 'Worker Stopped'}
                      </span>
                      <button
                        type="button"
                        className="outline-btn small"
                        onClick={fetchMessagingHealth}
                        disabled={loadingQueueHealth}
                        title="Refresh Queue Health"
                        style={{ padding: '4px 10px', fontSize: '12px' }}
                      >
                        <RefreshCw size={12} className={loadingQueueHealth ? 'animate-spin' : ''} style={{ marginRight: '4px' }} />
                        Refresh
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ padding: '12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 500 }}>Queued</div>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: '#D97706', marginTop: '2px' }}>{messagingQueueHealth?.queueStats?.queued || 0}</div>
                    </div>
                    <div style={{ padding: '12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 500 }}>Processing</div>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: '#2563EB', marginTop: '2px' }}>{messagingQueueHealth?.queueStats?.processing || 0}</div>
                    </div>
                    <div style={{ padding: '12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 500 }}>Scheduled</div>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: '#7C3AED', marginTop: '2px' }}>{messagingQueueHealth?.queueStats?.scheduled || 0}</div>
                    </div>
                    <div style={{ padding: '12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 500 }}>Retryable Failures</div>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: '#DC2626', marginTop: '2px' }}>{messagingQueueHealth?.queueStats?.temporaryFailure || 0}</div>
                    </div>
                    <div style={{ padding: '12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 500 }}>Simulated Sent</div>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: '#16A34A', marginTop: '2px' }}>{messagingQueueHealth?.queueStats?.simulatedSent || 0}</div>
                    </div>
                    <div style={{ padding: '12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 500 }}>Total Tracked</div>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>{messagingQueueHealth?.queueStats?.total || 0}</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', fontSize: '12px', color: '#475569', background: '#F8FAFC', padding: '14px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                    <div><strong>Lease Locking:</strong> MongoDB Atomic (30s)</div>
                    <div><strong>Fail-Closed Mode:</strong> MOCK enforced (HTTP 403 on LIVE)</div>
                    <div><strong>Last Heartbeat:</strong> {messagingQueueHealth?.lastHeartbeat ? new Date(messagingQueueHealth.lastHeartbeat).toLocaleTimeString() : 'Active'}</div>
                    <div><strong>Active Workers:</strong> {messagingQueueHealth?.activeWorkers || (messagingQueueHealth?.workerRunning ? 1 : 0)} instance(s)</div>
                  </div>
                </div>

                {/* Developer Diagnostic Harness */}
                <div className="settings-group-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <Terminal size={18} color="#2563EB" />
                    <strong style={{ fontSize: '15px', color: '#0F172A' }}>
                      Developer Mock Messaging Diagnostic Harness
                    </strong>
                    <span style={{ fontSize: '10.5px', padding: '2px 8px', borderRadius: '12px', background: 'rgba(37, 99, 235, 0.1)', color: '#2563EB', fontWeight: 700 }}>
                      DEV / TEST SANDBOX
                    </span>
                  </div>
                  <p style={{ fontSize: '12.5px', color: '#64748B', margin: '0 0 16px 0' }}>
                    Trigger deterministic isolated transport simulations to verify atomic queue lease locks, retry backoff, worker recovery, and idempotency without touching genuine customer contacts.
                  </p>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
                    <button
                      type="button"
                      className="primary-btn small"
                      onClick={() => handleRunDiagnostic('success')}
                      disabled={runningDiagnostic}
                      style={{ fontSize: '12px', padding: '6px 12px' }}
                    >
                      <Play size={12} />
                      {runningDiagnostic && activeScenario === 'success' ? 'Running…' : 'Mock Success'}
                    </button>
                    <button
                      type="button"
                      className="outline-btn small"
                      onClick={() => handleRunDiagnostic('temporary_failure')}
                      disabled={runningDiagnostic}
                      style={{ fontSize: '12px', padding: '6px 12px' }}
                    >
                      <Play size={12} />
                      {runningDiagnostic && activeScenario === 'temporary_failure' ? 'Running…' : 'Temporary Failure (Retry)'}
                    </button>
                    <button
                      type="button"
                      className="outline-btn small"
                      onClick={() => handleRunDiagnostic('permanent_failure')}
                      disabled={runningDiagnostic}
                      style={{ fontSize: '12px', padding: '6px 12px' }}
                    >
                      <Play size={12} />
                      {runningDiagnostic && activeScenario === 'permanent_failure' ? 'Running…' : 'Permanent Failure'}
                    </button>
                    <button
                      type="button"
                      className="outline-btn small"
                      onClick={() => handleRunDiagnostic('timeout')}
                      disabled={runningDiagnostic}
                      style={{ fontSize: '12px', padding: '6px 12px' }}
                    >
                      <Play size={12} />
                      {runningDiagnostic && activeScenario === 'timeout' ? 'Running…' : 'Simulate Timeout'}
                    </button>
                    <button
                      type="button"
                      className="outline-btn small"
                      onClick={() => handleRunDiagnostic('rate_limit')}
                      disabled={runningDiagnostic}
                      style={{ fontSize: '12px', padding: '6px 12px' }}
                    >
                      <Play size={12} />
                      {runningDiagnostic && activeScenario === 'rate_limit' ? 'Running…' : 'Simulate Rate Limit'}
                    </button>
                    <button
                      type="button"
                      className="outline-btn small"
                      onClick={() => handleRunDiagnostic('worker_recovery')}
                      disabled={runningDiagnostic}
                      style={{ fontSize: '12px', padding: '6px 12px' }}
                    >
                      <Play size={12} />
                      {runningDiagnostic && activeScenario === 'worker_recovery' ? 'Running…' : 'Worker Recovery Test'}
                    </button>
                    <button
                      type="button"
                      className="outline-btn small"
                      onClick={() => handleRunDiagnostic('idempotency_verify')}
                      disabled={runningDiagnostic}
                      style={{ fontSize: '12px', padding: '6px 12px' }}
                    >
                      <Play size={12} />
                      {runningDiagnostic && activeScenario === 'idempotency_verify' ? 'Running…' : 'Verify Idempotency'}
                    </button>
                  </div>

                  {diagnosticResult && (
                    <div
                      style={{
                        padding: '12px 14px',
                        background: '#0F172A',
                        borderRadius: '8px',
                        border: '1px solid #1E293B',
                        fontSize: '12px',
                        fontFamily: 'monospace',
                        maxHeight: '260px',
                        overflowY: 'auto',
                      }}
                    >
                      <div style={{ color: '#60A5FA', fontWeight: 600, marginBottom: '6px' }}>
                        Diagnostic Output [{diagnosticResult.scenario || 'result'}]:
                      </div>
                      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#CBD5E1', fontSize: '11.5px' }}>
                        {JSON.stringify(diagnosticResult, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>

                {/* Safeguard Notice */}
                <div
                  style={{
                    padding: '16px 20px',
                    background: '#F8FAFC',
                    borderRadius: '10px',
                    fontSize: '12.5px',
                    color: '#64748B',
                    lineHeight: 1.55,
                    border: '1px solid #E2E8F0',
                  }}
                >
                  <strong style={{ color: '#0F172A', fontSize: '13px' }}>
                    Integration Notice &amp; Safeguards:
                  </strong>
                  <ul style={{ margin: '8px 0 0', paddingLeft: '20px' }}>
                    <li>
                      <strong>Official WhatsApp connection will be configured during official Meta provider setup.</strong>
                    </li>
                    <li>
                      Live messaging is strictly disabled to prevent unexpected Meta usage costs, compliance hazards, or unauthorized external API transmissions.
                    </li>
                    <li>
                      All audience segments, template personalization, and campaign simulations execute locally in MongoDB.
                    </li>
                  </ul>
                </div>
              </div>
            </section>
          )}

          {/* TAB 5: OPERATIONAL PREFERENCES PANEL */}
          {activeTab === 'preferences' && (
            <section className="panel settings-panel" id="preferences" aria-labelledby="tab-preferences">
              <div className="settings-panel-header">
                <div>
                  <h2 id="tab-preferences">Operational Preferences</h2>
                  <p>
                    Configure campaign scheduling timezones, quiet hours, date formats, and internal notifications.
                  </p>
                </div>
              </div>

              <form
                onSubmit={handleSavePreferences}
                className="preferences-form"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px',
                  maxWidth: '680px',
                }}
              >
                {/* Regional Settings */}
                <div className="settings-group-card">
                  <div className="settings-group-card-header">
                    <div>
                      <div className="settings-group-card-title">
                        <Globe size={16} color="#2563EB" /> Regional Settings
                      </div>
                      <div className="settings-group-card-desc">
                        Workspace time calculation, default calling code, and display formatting.
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="form-row-2">
                      <label className="field">
                        <span>Workspace Timezone *</span>
                        <select
                          value={prefs.timezone}
                          onChange={(e) => setPrefs({ ...prefs, timezone: e.target.value })}
                        >
                          {IANA_TIMEZONES.map((tz) => (
                            <option key={tz} value={tz}>
                              {tz}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="field">
                        <span>Default Country Calling Code</span>
                        <select
                          value={prefs.defaultCountryCallingCode}
                          onChange={(e) =>
                            setPrefs({ ...prefs, defaultCountryCallingCode: e.target.value })
                          }
                        >
                          {CALLING_CODES.map((c) => (
                            <option key={c.code} value={c.code}>
                              {c.country}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="form-row-2">
                      <label className="field">
                        <span>Date Format</span>
                        <select
                          value={prefs.dateFormat}
                          onChange={(e) => setPrefs({ ...prefs, dateFormat: e.target.value })}
                        >
                          <option value="DD/MM/YYYY">DD/MM/YYYY (Indian Standard)</option>
                          <option value="MM/DD/YYYY">MM/DD/YYYY (US Standard)</option>
                          <option value="YYYY-MM-DD">YYYY-MM-DD (ISO 8601)</option>
                        </select>
                      </label>

                      <label className="field">
                        <span>Time Display Format</span>
                        <select
                          value={prefs.timeFormat || '12h'}
                          onChange={(e) => setPrefs({ ...prefs, timeFormat: e.target.value })}
                        >
                          <option value="12h">12-hour (e.g. 02:30 PM)</option>
                          <option value="24h">24-hour (e.g. 14:30)</option>
                        </select>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Campaign Quiet Hours */}
                <div className="settings-group-card">
                  <div className="settings-group-card-header">
                    <div>
                      <div className="settings-group-card-title">
                        <Clock size={16} color="#2563EB" /> Campaign Quiet Hours
                      </div>
                      <div className="settings-group-card-desc">
                        Enforce automated send suppression during nighttime hours (supports overnight windows crossing midnight).
                      </div>
                    </div>
                  </div>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      fontSize: '13.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      marginBottom: '12px',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={prefs.quietHours?.enabled !== false}
                      onChange={(e) =>
                        setPrefs({
                          ...prefs,
                          quietHours: {
                            ...prefs.quietHours,
                            enabled: e.target.checked,
                          },
                        })
                      }
                      style={{ accentColor: '#2563EB' }}
                    />
                    <span>Enforce Campaign Quiet Hours</span>
                  </label>

                  <div className="form-row-2">
                    <label className="field">
                      <span>Quiet Hours Start</span>
                      <input
                        type="time"
                        value={prefs.quietHours?.start || '21:00'}
                        disabled={prefs.quietHours?.enabled === false}
                        onChange={(e) =>
                          setPrefs({
                            ...prefs,
                            quietHours: {
                              ...prefs.quietHours,
                              start: e.target.value,
                            },
                          })
                        }
                      />
                    </label>

                    <label className="field">
                      <span>Quiet Hours End</span>
                      <input
                        type="time"
                        value={prefs.quietHours?.end || '09:00'}
                        disabled={prefs.quietHours?.enabled === false}
                        onChange={(e) =>
                          setPrefs({
                            ...prefs,
                            quietHours: {
                              ...prefs.quietHours,
                              end: e.target.value,
                            },
                          })
                        }
                      />
                    </label>
                  </div>
                </div>

                {/* Internal Campaign Notifications */}
                <div className="settings-group-card">
                  <div className="settings-group-card-header">
                    <div>
                      <div className="settings-group-card-title">
                        <Bell size={16} color="#2563EB" /> Internal Campaign Alerts (In-App Bell)
                      </div>
                      <div className="settings-group-card-desc">
                        Control real-time notifications for campaign execution milestones.
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        fontSize: '13px',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={prefs.notificationPreferences?.campaignScheduled !== false}
                        onChange={(e) =>
                          setPrefs({
                            ...prefs,
                            notificationPreferences: {
                              ...prefs.notificationPreferences,
                              campaignScheduled: e.target.checked,
                            },
                          })
                        }
                        style={{ accentColor: '#2563EB' }}
                      />
                      <span>Notify when a campaign is scheduled</span>
                    </label>

                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        fontSize: '13px',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={
                          prefs.notificationPreferences?.campaignSimulationCompleted !== false
                        }
                        onChange={(e) =>
                          setPrefs({
                            ...prefs,
                            notificationPreferences: {
                              ...prefs.notificationPreferences,
                              campaignSimulationCompleted: e.target.checked,
                            },
                          })
                        }
                        style={{ accentColor: '#2563EB' }}
                      />
                      <span>Notify on campaign simulation completion</span>
                    </label>

                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        fontSize: '13px',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={
                          prefs.notificationPreferences?.campaignRequiresAttention !== false
                        }
                        onChange={(e) =>
                          setPrefs({
                            ...prefs,
                            notificationPreferences: {
                              ...prefs.notificationPreferences,
                              campaignRequiresAttention: e.target.checked,
                            },
                          })
                        }
                        style={{ accentColor: '#2563EB' }}
                      />
                      <span>Alert when a campaign requires attention</span>
                    </label>
                  </div>
                </div>

                <div style={{ paddingTop: '6px' }}>
                  <button type="submit" className="primary-btn" disabled={savingPrefs}>
                    {savingPrefs ? 'Saving preferences…' : 'Save workspace preferences'}
                  </button>
                </div>
              </form>
            </section>
          )}

          {/* TAB 6: ABOUT RELAY PANEL */}
          {activeTab === 'about' && (
            <section className="panel settings-panel" id="about" aria-labelledby="tab-about">
              <div className="settings-panel-header">
                <div>
                  <h2 id="tab-about">About Relay</h2>
                  <p>
                    System architecture, authorized single-operator role, and verified platform readiness.
                  </p>
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                  gap: '16px',
                  maxWidth: '780px',
                }}
              >
                {/* Active Workspace Card */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '18px 22px',
                    background: '#F8FAFC',
                    borderRadius: '12px',
                    border: '1px solid #E2E8F0',
                    gridColumn: '1 / -1',
                  }}
                >
                  <div className="business-logo-preview" style={{ width: '56px', height: '56px' }}>
                    {business.logoUrl ? (
                      <img
                        src={resolveMediaUrl(business.logoUrl)}
                        alt={business.legalOrTradingName || workspaceName}
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                    ) : isM2W ? (
                      <img
                        src="/logo.png"
                        alt="M2W Realty"
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          borderRadius: '8px',
                          background: 'linear-gradient(135deg, #1E3A8A, #2563EB)',
                          color: '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '18px',
                        }}
                      >
                        {initials}
                      </div>
                    )}
                  </div>
                  <div>
                    <strong style={{ fontSize: '16px', color: '#0F172A' }}>
                      {business.legalOrTradingName || workspaceName}
                    </strong>
                    <div style={{ fontSize: '12.5px', color: '#64748B', marginTop: '2px' }}>
                      {business.businessCategory || currentWorkspace?.industryKey || 'Business'} · Multi-Tenant WhatsApp Automation
                    </div>
                  </div>
                </div>

                <div className="settings-stat-card">
                  <span className="label">Platform Name</span>
                  <strong className="value">
                    Relay — {business.businessCategory || (isM2W ? 'Real Estate' : 'Business')} WhatsApp Automation
                  </strong>
                </div>

                <div className="settings-stat-card">
                  <span className="label">Authorized Role</span>
                  <strong className="value" style={{ color: '#2563EB' }}>
                    Owner / Single Operator
                  </strong>
                </div>

                <div className="settings-stat-card">
                  <span className="label">Target Persona</span>
                  <strong className="value">
                    Single Business Owner (One WhatsApp Sender Number)
                  </strong>
                </div>

                <div className="settings-stat-card">
                  <span className="label">Execution Environment</span>
                  <strong className="value">
                    Mock Sandbox Mode (Safe Offline Simulation)
                  </strong>
                </div>

                <div className="settings-stat-card">
                  <span className="label">Application Release</span>
                  <strong className="value">
                    Relay v1.0 — Demo &amp; Evaluation Release
                  </strong>
                </div>

                <div className="settings-stat-card">
                  <span className="label">Database Persistence</span>
                  <strong className="value" style={{ color: '#16A34A' }}>
                    MongoDB (relay_demo)
                  </strong>
                </div>
              </div>
            </section>
          )}

          {/* TAB: BILLING & SUBSCRIPTIONS */}
          {activeTab === 'billing' && (
            <BillingSettingsPanel />
          )}

          {/* TAB 7: DEVELOPER / TEST MODE (RELAY MOCK TESTING CENTER) */}
          {activeTab === 'developer' && (
            <DeveloperTestingCenter />
          )}

        </div>
      </div>

      {/* Simulation Modals (SaaS Prompt 8) */}
      <InboundSimulatorModal
        isOpen={showInboundModal}
        onClose={() => setShowInboundModal(false)}
        onComplete={() => fetchMessagingHealth && fetchMessagingHealth()}
      />
      <AutomationTestConsole
        isOpen={showTestConsole}
        onClose={() => setShowTestConsole(false)}
      />
    </div>
  );
}
