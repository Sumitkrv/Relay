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
} from 'lucide-react';
import toast from 'react-hot-toast';
import settingsService from '../services/settings';
import { getSystemMessagingStatus, runMockDiagnostic } from '../services/messages';
import PageHeader from '../components/PageHeader';
import DeveloperTestingCenter from '../components/DeveloperTestingCenter';
import IndustryConfigHub from '../components/industry/IndustryConfigHub';
import MockConnectionCard from '../components/mock/MockConnectionCard';
import InboundSimulatorModal from '../components/mock/InboundSimulatorModal';
import AutomationTestConsole from '../components/mock/AutomationTestConsole';
import DemoJourneyProgress from '../components/mock/DemoJourneyProgress';
import WhatsAppConnectionManager from '../components/whatsapp/WhatsAppConnectionManager';
import BillingDashboard from '../components/billing/BillingDashboard';

const VALID_TABS = ['profile', 'business', 'billing', 'security', 'integrations', 'whatsapp', 'preferences', 'about', 'developer'];

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

  // Tab 4: WhatsApp Integration State
  const [integration, setIntegration] = useState(null);
  const [messagingQueueHealth, setMessagingQueueHealth] = useState(null);
  const [loadingQueueHealth, setLoadingQueueHealth] = useState(false);
  const [runningDiagnostic, setRunningDiagnostic] = useState(false);
  const [activeScenario, setActiveScenario] = useState('');
  const [diagnosticResult, setDiagnosticResult] = useState(null);

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
            businessCategory: bp.businessCategory || 'Real Estate',
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

  return (
    <div className="settings-page">
      <PageHeader
        eyebrow="RELAY · OWNER SETTINGS &amp; CONFIGURATION"
        title="Settings"
        subtitle="Manage single-owner authentication, real estate business identity, security, and WhatsApp readiness."
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
              <strong style={{ color: businessScore >= 100 ? 'var(--color-primary)' : '#f59e0b' }}>
                {businessScore >= 100 ? 'Complete (100%)' : `${businessScore}% Complete`}
              </strong>
            </span>
          </div>

          <div className="readiness-pill">
            <span className="readiness-dot mock" />
            <span>
              WhatsApp Provider:{' '}
              <strong style={{ color: '#3b82f6' }}>Mock Mode (Pending Provider Setup)</strong>
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
          <span
            className="status-badge"
            style={{
              backgroundColor: 'var(--color-primary-soft)',
              color: 'var(--color-primary)',
              fontSize: '11px',
              padding: '4px 10px',
            }}
          >
            Single Operator
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
            className={`settings-nav-item ${activeTab === 'billing' ? 'active selected' : ''}`}
            onClick={() => switchTab('billing')}
            aria-selected={activeTab === 'billing'}
          >
            <CreditCard size={16} /> Subscription &amp; Billing
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
            style={{ color: activeTab === 'developer' ? 'var(--color-primary-dark)' : 'inherit' }}
          >
            <Terminal size={16} /> Developer / Test Mode
          </button>
        </aside>

        {/* Tabbed Panels — Exclusively renders active panel */}
        <div className="settings-sections">
          {/* TAB 1: OWNER PROFILE PANEL */}
          {activeTab === 'profile' && (
            <section className="panel settings-panel" id="profile" aria-labelledby="tab-profile">
              <div
                style={{
                  borderBottom: '1px solid var(--color-border-subtle)',
                  paddingBottom: '14px',
                  marginBottom: '20px',
                }}
              >
                <h2 style={{ fontSize: '18px', fontWeight: 700 }} id="tab-profile">
                  Owner Profile
                </h2>
                <p
                  style={{
                    fontSize: '13px',
                    color: 'var(--color-text-secondary)',
                    margin: '4px 0 0',
                  }}
                >
                  Manage your authenticated operator identity and personal display settings.
                </p>
              </div>

              <form
                onSubmit={handleSaveProfile}
                className="profile-form"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  maxWidth: '560px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
                  <div
                    style={{
                      width: '54px',
                      height: '54px',
                      borderRadius: '12px',
                      background: '#FFFFFF',
                      border: '1px solid var(--color-border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      padding: '2px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    }}
                  >
                    <img
                      src="/logo.png"
                      alt="M2W Realty"
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  </div>
                  <div>
                    <strong style={{ fontSize: '15px', color: 'var(--color-text-primary)' }}>
                      {profileName || user?.name || 'Owner Operator'}
                    </strong>
                    <div style={{ fontSize: '12.5px', color: 'var(--color-text-muted)' }}>
                      M2W Realty · Single Operator Owner
                    </div>
                  </div>
                </div>

                <label className="field">
                  Full Display Name *
                  <input
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    minLength={2}
                    maxLength={80}
                    required
                    placeholder="e.g. Sumit Thakur"
                  />
                  <small style={{ fontSize: '11.5px', color: 'var(--color-text-muted)' }}>
                    Saved to MongoDB and updated across sidebar and topbar menus.
                  </small>
                </label>

                <label className="field">
                  Account Email
                  <input
                    value={user?.email || ''}
                    readOnly
                    disabled
                    style={{
                      background: 'var(--color-surface-muted)',
                      color: 'var(--color-text-muted)',
                      cursor: 'not-allowed',
                    }}
                  />
                  <small style={{ fontSize: '11.5px', color: 'var(--color-text-muted)' }}>
                    Primary login identity. Direct modification is restricted for security.
                  </small>
                </label>

                <div className="form-row-2">
                  <label className="field">
                    Authorized Role
                    <input
                      value={user?.role === 'owner' ? 'Owner / Single Operator' : user?.role || 'Owner'}
                      readOnly
                      disabled
                      style={{
                        background: 'var(--color-surface-muted)',
                        color: 'var(--color-text-muted)',
                        cursor: 'not-allowed',
                      }}
                    />
                  </label>

                  <label className="field">
                    Account Created
                    <input
                      value={
                        user?.createdAt
                          ? new Date(user.createdAt).toLocaleDateString()
                          : 'Active'
                      }
                      readOnly
                      disabled
                      style={{
                        background: 'var(--color-surface-muted)',
                        color: 'var(--color-text-muted)',
                        cursor: 'not-allowed',
                      }}
                    />
                  </label>
                </div>

                {user?.lastLoginAt && (
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    Last login recorded:{' '}
                    <strong>{new Date(user.lastLoginAt).toLocaleString()}</strong>
                  </div>
                )}

                <div style={{ paddingTop: '10px' }}>
                  <button className="primary-btn small" disabled={savingProfile}>
                    {savingProfile ? 'Saving changes…' : 'Save profile changes'}
                  </button>
                </div>
              </form>
            </section>
          )}

          {/* TAB 2: BUSINESS PROFILE PANEL */}
          {activeTab === 'business' && (
            <section className="panel settings-panel" id="business" aria-labelledby="tab-business">
              <div
                style={{
                  borderBottom: '1px solid var(--color-border-subtle)',
                  paddingBottom: '14px',
                  marginBottom: '20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: 700 }} id="tab-business">
                    Business Profile
                  </h2>
                  <p
                    style={{
                      fontSize: '13px',
                      color: 'var(--color-text-secondary)',
                      margin: '4px 0 0',
                    }}
                  >
                    Configure real estate firm details used for WhatsApp compliance and campaign opt-in records.
                  </p>
                </div>

                <div
                  className="status-badge"
                  style={{
                    backgroundColor:
                      businessScore >= 100
                        ? 'var(--color-success-soft)'
                        : 'var(--color-warning-soft)',
                    color:
                      businessScore >= 100
                        ? 'var(--color-success)'
                        : 'var(--color-warning)',
                    fontSize: '12px',
                    padding: '6px 12px',
                    fontWeight: 600,
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
                  gap: '16px',
                  maxWidth: '680px',
                }}
              >
                {/* Official Business Logo Badge */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '12px 16px',
                    background: 'var(--color-surface-muted)',
                    borderRadius: '10px',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <img
                    src={business.logoUrl || '/logo.png'}
                    alt="M2W Realty Logo"
                    style={{
                      width: '52px',
                      height: '52px',
                      borderRadius: '10px',
                      objectFit: 'contain',
                      background: '#FFFFFF',
                      padding: '3px',
                      border: '1px solid var(--color-border)',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    }}
                  />
                  <div>
                    <strong style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>
                      Official Business Logo: M2W Realty
                    </strong>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                      Active badge displayed across campaign previews, client WhatsApp interactions, and system shell.
                    </div>
                  </div>
                </div>
                <div className="form-row-2">
                  <label className="field">
                    Business / Trading Name *
                    <input
                      value={business.legalOrTradingName}
                      onChange={(e) =>
                        setBusiness({ ...business, legalOrTradingName: e.target.value })
                      }
                      placeholder="e.g. Apex Realty Ventures"
                      required
                    />
                    <small style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                      Legal entity name for customer consent audit trail.
                    </small>
                  </label>

                  <label className="field">
                    Business Display Name
                    <input
                      value={business.displayName}
                      onChange={(e) =>
                        setBusiness({ ...business, displayName: e.target.value })
                      }
                      placeholder="e.g. Apex Realty"
                    />
                    <small style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                      Used in campaign headers &amp; message signatures.
                    </small>
                  </label>
                </div>

                <div className="form-row-2">
                  <label className="field">
                    Business Category
                    <input
                      value={business.businessCategory}
                      onChange={(e) =>
                        setBusiness({ ...business, businessCategory: e.target.value })
                      }
                      placeholder="Real Estate"
                    />
                  </label>

                  <label className="field">
                    Official Website
                    <input
                      value={business.website}
                      onChange={(e) =>
                        setBusiness({ ...business, website: e.target.value })
                      }
                      placeholder="https://apexrealty.in"
                    />
                  </label>
                </div>

                <div className="form-row-2">
                  <label className="field">
                    Business Contact Email
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
                    Business Phone Number
                    <input
                      value={business.phone}
                      onChange={(e) =>
                        setBusiness({ ...business, phone: e.target.value })
                      }
                      placeholder="+91 98765 43210"
                    />
                  </label>
                </div>

                <label className="field">
                  Business Description
                  <textarea
                    rows={3}
                    value={business.description}
                    onChange={(e) =>
                      setBusiness({ ...business, description: e.target.value })
                    }
                    placeholder="Brief description of real estate services, properties handled, and advisory focus."
                  />
                </label>

                <div style={{ marginTop: '8px' }}>
                  <h3 style={{ fontSize: '14.5px', fontWeight: 600, marginBottom: '12px' }}>
                    Location Details
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <label className="field">
                      Street Address
                      <input
                        value={business.address}
                        onChange={(e) =>
                          setBusiness({ ...business, address: e.target.value })
                        }
                        placeholder="Suite 401, Commercial Arcade, MG Road"
                      />
                    </label>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                        gap: '12px',
                      }}
                    >
                      <label className="field">
                        City
                        <input
                          value={business.city}
                          onChange={(e) =>
                            setBusiness({ ...business, city: e.target.value })
                          }
                          placeholder="Bengaluru"
                        />
                      </label>

                      <label className="field">
                        State
                        <input
                          value={business.state}
                          onChange={(e) =>
                            setBusiness({ ...business, state: e.target.value })
                          }
                          placeholder="Karnataka"
                        />
                      </label>

                      <label className="field">
                        Postal Code
                        <input
                          value={business.postalCode}
                          onChange={(e) =>
                            setBusiness({ ...business, postalCode: e.target.value })
                          }
                          placeholder="560001"
                        />
                      </label>

                      <label className="field">
                        Country
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

                <div style={{ paddingTop: '12px' }}>
                  <button className="primary-btn small" disabled={savingBusiness}>
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
              <div
                style={{
                  borderBottom: '1px solid var(--color-border-subtle)',
                  paddingBottom: '14px',
                  marginBottom: '20px',
                }}
              >
                <h2 style={{ fontSize: '18px', fontWeight: 700 }} id="tab-security">
                  Security &amp; Password Management
                </h2>
                <p
                  style={{
                    fontSize: '13px',
                    color: 'var(--color-text-secondary)',
                    margin: '4px 0 0',
                  }}
                >
                  Manage master credentials, rotate active session tokens, and inspect real-time security events.
                </p>
              </div>

              {/* Password Change Form */}
              <form
                onSubmit={handleSavePassword}
                className="security-form"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  maxWidth: '560px',
                }}
              >
                <label className="field">
                  Current Password *
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
                    New Password *
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
                    Confirm New Password *
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
                        height: '4px',
                        background: 'var(--color-surface-subtle)',
                        borderRadius: '2px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          flex: 1,
                          backgroundColor:
                            passwordStrength >= 1
                              ? passwordStrength >= 3
                                ? 'var(--color-success)'
                                : '#f59e0b'
                              : 'transparent',
                        }}
                      />
                      <div
                        style={{
                          flex: 1,
                          backgroundColor:
                            passwordStrength >= 3
                              ? 'var(--color-success)'
                              : passwordStrength >= 2
                              ? '#f59e0b'
                              : 'transparent',
                        }}
                      />
                      <div
                        style={{
                          flex: 1,
                          backgroundColor:
                            passwordStrength >= 4
                              ? 'var(--color-success)'
                              : 'transparent',
                        }}
                      />
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                      {passwordStrength >= 4
                        ? 'Strong password'
                        : passwordStrength >= 2
                        ? 'Moderate'
                        : 'Weak (add numbers/symbols)'}
                    </span>
                  </div>
                )}

                <div style={{ paddingTop: '8px' }}>
                  <button className="primary-btn small" disabled={savingPassword}>
                    {savingPassword ? 'Updating password…' : 'Update password'}
                  </button>
                </div>
              </form>

              {/* Security Overview & Recent Audited Events */}
              <div
                style={{
                  marginTop: '36px',
                  borderTop: '1px solid var(--color-border)',
                  paddingTop: '20px',
                }}
              >
                <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '14px' }}>
                  Security Overview &amp; Session Audit
                </h3>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '12px',
                    marginBottom: '20px',
                  }}
                >
                  <div
                    style={{
                      padding: '12px 16px',
                      background: 'var(--color-surface-muted)',
                      borderRadius: '8px',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                      Session Status
                    </span>
                    <strong
                      style={{
                        display: 'block',
                        fontSize: '13px',
                        color: 'var(--color-primary)',
                        marginTop: '2px',
                      }}
                    >
                      Active (Current Device)
                    </strong>
                  </div>

                  <div
                    style={{
                      padding: '12px 16px',
                      background: 'var(--color-surface-muted)',
                      borderRadius: '8px',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                      Password Last Changed
                    </span>
                    <strong
                      style={{
                        display: 'block',
                        fontSize: '13px',
                        color: 'var(--color-text-primary)',
                        marginTop: '2px',
                      }}
                    >
                      {securityData?.passwordLastChanged
                        ? new Date(securityData.passwordLastChanged).toLocaleDateString()
                        : 'Initial Provisioning'}
                    </strong>
                  </div>

                  <div
                    style={{
                      padding: '12px 16px',
                      background: 'var(--color-surface-muted)',
                      borderRadius: '8px',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                      Active Sessions
                    </span>
                    <strong
                      style={{
                        display: 'block',
                        fontSize: '13px',
                        color: 'var(--color-text-primary)',
                        marginTop: '2px',
                      }}
                    >
                      1 (Single Operator Workspace)
                    </strong>
                  </div>
                </div>

                {/* Audit Events Table */}
                <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
                  Recent Security Events (MongoDB Audited)
                </h4>
                {securityData?.recentEvents && securityData.recentEvents.length > 0 ? (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="audit-events-table">
                      <thead>
                        <tr>
                          <th>Event Action</th>
                          <th>Timestamp</th>
                          <th>IP Address</th>
                        </tr>
                      </thead>
                      <tbody>
                        {securityData.recentEvents.map((evt) => (
                          <tr key={evt.id}>
                            <td>
                              <span className="audit-action-tag">{evt.action}</span>
                            </td>
                            <td>{new Date(evt.createdAt).toLocaleString()}</td>
                            <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                              {evt.ipAddress || '127.0.0.1'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p style={{ fontSize: '12.5px', color: 'var(--color-text-muted)' }}>
                    No security alerts or anomalous activity recorded.
                  </p>
                )}
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
                  WhatsApp Cloud API &amp; Connection Manager
                </h2>
                <p
                  style={{
                    fontSize: '13px',
                    color: 'var(--color-text-secondary)',
                    margin: '4px 0 0',
                  }}
                >
                  Manage per-business WhatsApp senders, official coexistence onboarding, and test automation safely.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '880px' }}>
                {/* Complete Per-Business WhatsApp Connection Manager (SaaS Prompt 9) */}
                <WhatsAppConnectionManager workspace={user} />

                {/* Multi-Tenant WhatsApp Mock Engine (SaaS Prompt 8) */}
                <MockConnectionCard
                  onOpenInboundModal={() => setShowInboundModal(true)}
                  onOpenTestConsole={() => setShowTestConsole(true)}
                />

                <DemoJourneyProgress
                  onOpenInboundModal={() => setShowInboundModal(true)}
                  onOpenTestConsole={() => setShowTestConsole(true)}
                />

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
                        Sending Engine Mode
                      </strong>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                        Local CRM simulation &amp; planning sandbox
                      </div>
                    </div>
                    <span
                      className="status-badge"
                      style={{
                        backgroundColor: 'var(--color-primary-soft)',
                        color: 'var(--color-primary)',
                        fontSize: '11.5px',
                        fontWeight: 600,
                      }}
                    >
                      Mock Mode (Active &amp; Safe)
                    </span>
                  </div>
                </div>

                {/* Queue Health Card */}
                <div
                  style={{
                    padding: '18px',
                    background: 'var(--color-surface-muted)',
                    borderRadius: '10px',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Activity size={18} style={{ color: 'var(--color-primary)' }} />
                      <strong style={{ fontSize: '15px', color: 'var(--color-text-primary)' }}>
                        Durable Message Queue &amp; Worker Health
                      </strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '11.5px',
                          fontWeight: 600,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background: messagingQueueHealth?.workerRunning ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: messagingQueueHealth?.workerRunning ? '#10B981' : '#EF4444',
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
                        style={{ padding: '4px 8px', fontSize: '11.5px' }}
                      >
                        <RefreshCw size={12} className={loadingQueueHealth ? 'animate-spin' : ''} style={{ marginRight: '4px' }} />
                        Refresh
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '14px' }}>
                    <div style={{ padding: '10px', background: 'var(--color-surface-subtle)', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Queued</div>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: '#D97706' }}>{messagingQueueHealth?.queueStats?.queued || 0}</div>
                    </div>
                    <div style={{ padding: '10px', background: 'var(--color-surface-subtle)', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Processing</div>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: '#3B82F6' }}>{messagingQueueHealth?.queueStats?.processing || 0}</div>
                    </div>
                    <div style={{ padding: '10px', background: 'var(--color-surface-subtle)', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Scheduled</div>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: '#8B5CF6' }}>{messagingQueueHealth?.queueStats?.scheduled || 0}</div>
                    </div>
                    <div style={{ padding: '10px', background: 'var(--color-surface-subtle)', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Retryable Failures</div>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: '#EF4444' }}>{messagingQueueHealth?.queueStats?.temporaryFailure || 0}</div>
                    </div>
                    <div style={{ padding: '10px', background: 'var(--color-surface-subtle)', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Simulated Sent</div>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: '#10B981' }}>{messagingQueueHealth?.queueStats?.simulatedSent || 0}</div>
                    </div>
                    <div style={{ padding: '10px', background: 'var(--color-surface-subtle)', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Total Tracked</div>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{messagingQueueHealth?.queueStats?.total || 0}</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', fontSize: '12px', color: 'var(--color-text-secondary)', background: 'var(--color-surface-subtle)', padding: '12px', borderRadius: '8px' }}>
                    <div><strong>Lease Locking:</strong> MongoDB Atomic (30s)</div>
                    <div><strong>Fail-Closed Mode:</strong> MOCK enforced (HTTP 403 on LIVE)</div>
                    <div><strong>Last Heartbeat:</strong> {messagingQueueHealth?.lastHeartbeat ? new Date(messagingQueueHealth.lastHeartbeat).toLocaleTimeString() : 'Active'}</div>
                    <div><strong>Active Workers:</strong> {messagingQueueHealth?.activeWorkers || (messagingQueueHealth?.workerRunning ? 1 : 0)} instance(s)</div>
                  </div>
                </div>

                {/* Developer Diagnostic Harness */}
                <div
                  style={{
                    padding: '18px',
                    background: 'var(--color-surface-muted)',
                    borderRadius: '10px',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <Terminal size={18} style={{ color: 'var(--color-primary)' }} />
                    <strong style={{ fontSize: '15px', color: 'var(--color-text-primary)' }}>
                      Developer Mock Messaging Diagnostic Harness
                    </strong>
                    <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'var(--color-primary-soft)', color: 'var(--color-primary)', fontWeight: 600 }}>
                      DEV / TEST SANDBOX
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '0 0 14px 0' }}>
                    Trigger deterministic isolated transport simulations to verify atomic queue lease locks, retry backoff, worker recovery, and idempotency without touching genuine customer contacts.
                  </p>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
                    <button
                      type="button"
                      className="primary-btn small"
                      onClick={() => handleRunDiagnostic('success')}
                      disabled={runningDiagnostic}
                      style={{ fontSize: '11.5px', padding: '6px 12px' }}
                    >
                      <Play size={12} style={{ marginRight: '4px' }} />
                      {runningDiagnostic && activeScenario === 'success' ? 'Running…' : 'Mock Success'}
                    </button>
                    <button
                      type="button"
                      className="outline-btn small"
                      onClick={() => handleRunDiagnostic('temporary_failure')}
                      disabled={runningDiagnostic}
                      style={{ fontSize: '11.5px', padding: '6px 12px' }}
                    >
                      <Play size={12} style={{ marginRight: '4px' }} />
                      {runningDiagnostic && activeScenario === 'temporary_failure' ? 'Running…' : 'Temporary Failure (Retry)'}
                    </button>
                    <button
                      type="button"
                      className="outline-btn small"
                      onClick={() => handleRunDiagnostic('permanent_failure')}
                      disabled={runningDiagnostic}
                      style={{ fontSize: '11.5px', padding: '6px 12px' }}
                    >
                      <Play size={12} style={{ marginRight: '4px' }} />
                      {runningDiagnostic && activeScenario === 'permanent_failure' ? 'Running…' : 'Permanent Failure'}
                    </button>
                    <button
                      type="button"
                      className="outline-btn small"
                      onClick={() => handleRunDiagnostic('timeout')}
                      disabled={runningDiagnostic}
                      style={{ fontSize: '11.5px', padding: '6px 12px' }}
                    >
                      <Play size={12} style={{ marginRight: '4px' }} />
                      {runningDiagnostic && activeScenario === 'timeout' ? 'Running…' : 'Simulate Timeout'}
                    </button>
                    <button
                      type="button"
                      className="outline-btn small"
                      onClick={() => handleRunDiagnostic('rate_limit')}
                      disabled={runningDiagnostic}
                      style={{ fontSize: '11.5px', padding: '6px 12px' }}
                    >
                      <Play size={12} style={{ marginRight: '4px' }} />
                      {runningDiagnostic && activeScenario === 'rate_limit' ? 'Running…' : 'Simulate Rate Limit'}
                    </button>
                    <button
                      type="button"
                      className="outline-btn small"
                      onClick={() => handleRunDiagnostic('worker_recovery')}
                      disabled={runningDiagnostic}
                      style={{ fontSize: '11.5px', padding: '6px 12px' }}
                    >
                      <Play size={12} style={{ marginRight: '4px' }} />
                      {runningDiagnostic && activeScenario === 'worker_recovery' ? 'Running…' : 'Worker Recovery Test'}
                    </button>
                    <button
                      type="button"
                      className="outline-btn small"
                      onClick={() => handleRunDiagnostic('idempotency_verify')}
                      disabled={runningDiagnostic}
                      style={{ fontSize: '11.5px', padding: '6px 12px' }}
                    >
                      <Play size={12} style={{ marginRight: '4px' }} />
                      {runningDiagnostic && activeScenario === 'idempotency_verify' ? 'Running…' : 'Verify Idempotency'}
                    </button>
                  </div>

                  {diagnosticResult && (
                    <div
                      style={{
                        padding: '12px',
                        background: 'var(--color-surface-subtle)',
                        borderRadius: '8px',
                        border: '1px solid var(--color-border)',
                        fontSize: '12px',
                        fontFamily: 'monospace',
                        maxHeight: '260px',
                        overflowY: 'auto',
                      }}
                    >
                      <div style={{ color: 'var(--color-primary)', fontWeight: 600, marginBottom: '6px' }}>
                        Diagnostic Output [{diagnosticResult.scenario || 'result'}]:
                      </div>
                      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'var(--color-text-secondary)', fontSize: '11.5px' }}>
                        {JSON.stringify(diagnosticResult, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>

                {/* Safeguard Notice */}
                <div
                  style={{
                    padding: '16px',
                    background: 'var(--color-surface-subtle)',
                    borderRadius: '10px',
                    fontSize: '12.5px',
                    color: 'var(--color-text-secondary)',
                    lineHeight: 1.55,
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <strong style={{ color: 'var(--color-text-primary)' }}>
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
              <div
                style={{
                  borderBottom: '1px solid var(--color-border-subtle)',
                  paddingBottom: '14px',
                  marginBottom: '20px',
                }}
              >
                <h2 style={{ fontSize: '18px', fontWeight: 700 }} id="tab-preferences">
                  Operational Preferences
                </h2>
                <p
                  style={{
                    fontSize: '13px',
                    color: 'var(--color-text-secondary)',
                    margin: '4px 0 0',
                  }}
                >
                  Configure campaign scheduling timezones, quiet hours, date formats, and internal notifications.
                </p>
              </div>

              <form
                onSubmit={handleSavePreferences}
                className="preferences-form"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  maxWidth: '580px',
                }}
              >
                <div className="form-row-2">
                  <label className="field">
                    Workspace Timezone *
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
                    Default Country Calling Code
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
                    Date Format
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
                    Time Display Format
                    <select
                      value={prefs.timeFormat || '12h'}
                      onChange={(e) => setPrefs({ ...prefs, timeFormat: e.target.value })}
                    >
                      <option value="12h">12-hour (e.g. 02:30 PM)</option>
                      <option value="24h">24-hour (e.g. 14:30)</option>
                    </select>
                  </label>
                </div>

                {/* Campaign Quiet Hours */}
                <div
                  style={{
                    padding: '16px',
                    background: 'var(--color-surface-muted)',
                    borderRadius: '10px',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      fontSize: '13.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      marginBottom: '10px',
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
                    />
                    <span>Enforce Campaign Quiet Hours</span>
                  </label>
                  <p
                    style={{
                      fontSize: '12px',
                      color: 'var(--color-text-secondary)',
                      margin: '0 0 12px 24px',
                    }}
                  >
                    Prevents automated campaign messages from sending during late evening / early morning hours.
                  </p>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                      gap: '12px',
                      marginLeft: '24px',
                    }}
                  >
                    <label className="field">
                      Quiet Hours Start
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
                      Quiet Hours End
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
                <div
                  style={{
                    padding: '16px',
                    background: 'var(--color-surface-muted)',
                    borderRadius: '10px',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <strong
                    style={{
                      fontSize: '13.5px',
                      display: 'block',
                      marginBottom: '12px',
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    Internal Campaign Alerts (In-App Bell)
                  </strong>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
                      />
                      <span>Alert when a campaign requires attention</span>
                    </label>
                  </div>
                </div>

                <div style={{ paddingTop: '8px' }}>
                  <button className="primary-btn small" disabled={savingPrefs}>
                    {savingPrefs ? 'Saving preferences…' : 'Save workspace preferences'}
                  </button>
                </div>
              </form>
            </section>
          )}

          {/* TAB 6: ABOUT RELAY PANEL */}
          {activeTab === 'about' && (
            <section className="panel settings-panel" id="about" aria-labelledby="tab-about">
              <div
                style={{
                  borderBottom: '1px solid var(--color-border-subtle)',
                  paddingBottom: '14px',
                  marginBottom: '20px',
                }}
              >
                <h2 style={{ fontSize: '18px', fontWeight: 700 }} id="tab-about">
                  About Relay
                </h2>
                <p
                  style={{
                    fontSize: '13px',
                    color: 'var(--color-text-secondary)',
                    margin: '4px 0 0',
                  }}
                >
                  System architecture, authorized single-operator role, and verified platform readiness.
                </p>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                  gap: '16px',
                  maxWidth: '700px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '16px',
                    background: 'var(--color-surface-muted)',
                    borderRadius: '10px',
                    border: '1px solid var(--color-border)',
                    gridColumn: '1 / -1',
                  }}
                >
                  <img
                    src="/logo.png"
                    alt="M2W Realty"
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '12px',
                      objectFit: 'contain',
                      background: '#FFFFFF',
                      padding: '3px',
                      border: '1px solid var(--color-border)',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                    }}
                  />
                  <div>
                    <strong style={{ fontSize: '16px', color: 'var(--color-text-primary)' }}>
                      M2W Realty
                    </strong>
                    <div style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                      Single-Operator Real Estate WhatsApp Automation Platform
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    padding: '16px',
                    background: 'var(--color-surface-muted)',
                    borderRadius: '10px',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <span style={{ fontSize: '11.5px', color: 'var(--color-text-muted)', display: 'block' }}>
                    Platform Name
                  </span>
                  <strong style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>
                    Relay — Real Estate WhatsApp Automation
                  </strong>
                </div>

                <div
                  style={{
                    padding: '16px',
                    background: 'var(--color-surface-muted)',
                    borderRadius: '10px',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <span style={{ fontSize: '11.5px', color: 'var(--color-text-muted)', display: 'block' }}>
                    Authorized Role
                  </span>
                  <strong style={{ fontSize: '14px', color: 'var(--color-primary)' }}>
                    Owner / Single Operator
                  </strong>
                </div>

                <div
                  style={{
                    padding: '16px',
                    background: 'var(--color-surface-muted)',
                    borderRadius: '10px',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <span style={{ fontSize: '11.5px', color: 'var(--color-text-muted)', display: 'block' }}>
                    Target Persona
                  </span>
                  <strong style={{ fontSize: '13.5px', color: 'var(--color-text-primary)' }}>
                    Single Business Owner (One WhatsApp Sender Number)
                  </strong>
                </div>

                <div
                  style={{
                    padding: '16px',
                    background: 'var(--color-surface-muted)',
                    borderRadius: '10px',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <span style={{ fontSize: '11.5px', color: 'var(--color-text-muted)', display: 'block' }}>
                    Execution Environment
                  </span>
                  <strong style={{ fontSize: '13.5px', color: 'var(--color-text-primary)' }}>
                    Mock Sandbox Mode (Safe for Prompts 1–9)
                  </strong>
                </div>

                <div
                  style={{
                    padding: '16px',
                    background: 'var(--color-surface-muted)',
                    borderRadius: '10px',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <span style={{ fontSize: '11.5px', color: 'var(--color-text-muted)', display: 'block' }}>
                    Application Release
                  </span>
                  <strong style={{ fontSize: '13.5px', color: 'var(--color-text-primary)' }}>
                    Relay v1.0 — Demo &amp; Production Ready
                  </strong>
                </div>

                <div
                  style={{
                    padding: '16px',
                    background: 'var(--color-surface-muted)',
                    borderRadius: '10px',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <span style={{ fontSize: '11.5px', color: 'var(--color-text-muted)', display: 'block' }}>
                    Database Persistence
                  </span>
                  <strong style={{ fontSize: '13.5px', color: 'var(--color-success)' }}>
                    MongoDB (freelance_automation_crm)
                  </strong>
                </div>
              </div>
            </section>
          )}

          {/* TAB 7: DEVELOPER / TEST MODE (RELAY MOCK TESTING CENTER) */}
          {activeTab === 'developer' && (
            <DeveloperTestingCenter />
          )}

          {/* TAB: SUBSCRIPTION & BILLING */}
          {activeTab === 'billing' && (
            <BillingDashboard />
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
