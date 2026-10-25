import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Activity,
  Bell,
  CheckCheck,
  ChartNoAxesCombined,
  FlaskConical,
  Files,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  MessagesSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
  ShieldAlert,
  Briefcase,
  User,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { resolveMediaUrl } from '../utils/media';
import { markAllNotificationsRead, markNotificationRead, notifications } from '../services/inbox';
import api from '../services/api';
import Breadcrumbs from '../components/Breadcrumbs';
import ErrorBoundary from '../components/ErrorBoundary';
import {
  businessInitials,
  formatIndustry,
  isRouteActive,
  personInitials,
} from './shellRoutes';
import './appShell.css';

/*
 * Primary navigation for the Real Estate WhatsApp automation platform (M2W Realty,
 * FitZone Gym, CarePlus Clinic share this same shell). Seven modules, two groups.
 * Active state is resolved by isRouteActive() so nested routes keep their module lit.
 */
const NAV_GROUPS = [
  {
    heading: 'Workspace',
    items: [
      { label: 'Overview', to: '/app', icon: LayoutDashboard },
      { label: 'Contacts', to: '/contacts', icon: Users },
      { label: 'Templates', to: '/templates', icon: Files },
      { label: 'Campaigns', to: '/campaigns', icon: Megaphone },
      { label: 'Inbox & Auto-reply', to: '/inbox', icon: MessagesSquare },
    ],
  },
  {
    heading: 'Insights & Management',
    items: [
      { label: 'Reports', to: '/reports', icon: ChartNoAxesCombined },
      { label: 'Settings', to: '/settings', icon: Settings2 },
    ],
  },
];

const DESKTOP_QUERY = '(min-width: 769px)';
const COLLAPSE_KEY = 'relay_sidebar_collapsed_v10';
const NAV_ICON_SIZE = 18;
const NAV_ICON_STROKE = 1.75;

function useIsDesktop() {
  const get = () =>
    typeof window === 'undefined' || !window.matchMedia ? true : window.matchMedia(DESKTOP_QUERY).matches;
  const [isDesktop, setIsDesktop] = useState(get);
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia(DESKTOP_QUERY);
    const onChange = (e) => setIsDesktop(e.matches);
    setIsDesktop(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return isDesktop;
}

/** Relay product mark: electric-blue tile with a drawn "R" (no external asset). */
function RelayMark({ size = 34 }) {
  return (
    <svg
      className="rs-brand-mark"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label="Relay"
      focusable="false"
    >
      <rect width="32" height="32" rx="9" fill="#2563EB" />
      <path
        d="M11 23V9h6.5a4.5 4.5 0 0 1 0 9H11M17 18l5 5"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const { currentWorkspace, membership, loading: workspaceLoading, error: workspaceError, refreshWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const location = useLocation();
  const isDesktop = useIsDesktop();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const [tip, setTip] = useState(null);

  // Default to expanded on desktop; persist the user's toggle preference.
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [noticeRows, setNoticeRows] = useState([]);
  const [unread, setUnread] = useState(0);

  // Live system readiness. 'unknown' until the first /health response arrives.
  const [systemStatus, setSystemStatus] = useState({
    backend: 'unknown',
    database: 'unknown',
    whatsappProvider: 'disconnected',
    mockMode: true,
  });

  const noticeRef = useRef(null);
  const statusRef = useRef(null);
  const avatarRef = useRef(null);
  const sidebarRef = useRef(null);
  const closeBtnRef = useRef(null);
  const menuBtnRef = useRef(null);

  // The collapsed rail only exists on desktop; the mobile drawer is always full width.
  const rail = collapsed && isDesktop;
  const drawerOpen = mobileOpen && !isDesktop;

  // ---- Workspace identity (business) -------------------------------------------------
  const isM2W = currentWorkspace
    ? currentWorkspace.slug === 'm2w-realty'
    : (user?.businessName?.includes('M2W') ?? false);
  const workspaceName =
    currentWorkspace?.name || (isM2W ? 'M2W Realty' : user?.businessName || 'Relay Workspace');
  // Fallback label; real values come from the workspace industry (e.g. Real Estate, Gym, Clinic).
  const industryLabel = currentWorkspace?.industryKey
    ? formatIndustry(currentWorkspace.industryKey)
    : isM2W
    ? 'Single Operator'
    : 'Workspace';
  const rawLogo = currentWorkspace?.logoUrl
    ? resolveMediaUrl(currentWorkspace.logoUrl)
    : isM2W
    ? '/logo.png'
    : null;
  const workspaceInitials = businessInitials(workspaceName);

  // ---- Account identity (person) ----------------------------------------------------
  const userName = user?.name || 'Relay User';
  const userEmail = user?.email || '';
  const userInitials = personInitials(user?.name);
  // Only the role granted by the backend membership is shown; never a presentation default.
  const roleLabel = membership?.role ? String(membership.role).replace(/_/g, ' ') : '';

  useEffect(() => {
    setLogoFailed(false);
  }, [currentWorkspace?._id, currentWorkspace?.logoUrl]);

  const toggleCollapse = () => {
    setTip(null);
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_KEY, String(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  };

  // ---- Tooltips (portal-free, fixed position so the scrolling nav never clips them) ----
  const tipProps = (text, always = false) =>
    rail || always
      ? {
          onMouseEnter: (e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setTip({ text, top: r.top + r.height / 2, left: r.right + 10 });
          },
          onMouseLeave: () => setTip(null),
          onFocus: (e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setTip({ text, top: r.top + r.height / 2, left: r.right + 10 });
          },
          onBlur: () => setTip(null),
        }
      : {};

  // Close popovers on outside click and on Escape.
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (noticeRef.current && !noticeRef.current.contains(e.target)) setNoticeOpen(false);
      if (statusRef.current && !statusRef.current.contains(e.target)) setStatusOpen(false);
      if (avatarRef.current && !avatarRef.current.contains(e.target)) setAvatarMenuOpen(false);
    };
    const handleEscape = (e) => {
      if (e.key !== 'Escape') return;
      setNoticeOpen(false);
      setStatusOpen(false);
      setAvatarMenuOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  // Close the drawer / popovers on navigation.
  useEffect(() => {
    setMobileOpen(false);
    setNoticeOpen(false);
    setStatusOpen(false);
    setAvatarMenuOpen(false);
    setTip(null);
  }, [location.pathname]);

  // Leaving the mobile breakpoint must never leave a stale open drawer.
  useEffect(() => {
    if (isDesktop) setMobileOpen(false);
  }, [isDesktop]);

  // Mobile drawer: scroll lock, focus management, Escape and Tab trapping.
  useEffect(() => {
    if (!drawerOpen) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = setTimeout(() => closeBtnRef.current?.focus(), 0);

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setMobileOpen(false);
        return;
      }
      if (e.key !== 'Tab' || !sidebarRef.current) return;
      const focusables = sidebarRef.current.querySelectorAll('a[href], button:not([disabled])');
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
      menuBtnRef.current?.focus?.();
    };
  }, [drawerOpen]);

  const loadNotifications = useCallback(async () => {
    try {
      const { data } = await notifications({ limit: 20 });
      setNoticeRows(data.records || []);
      setUnread(data.unreadCount || 0);
    } catch {
      /* graceful fail: keep the last known list */
    }
  }, []);

  // Query genuine backend readiness. A failed request is reported as unavailable, never "online".
  const checkHealth = useCallback(async () => {
    try {
      const { data } = await api.get('/health');
      setSystemStatus({
        backend: data.backend || 'connected',
        database: data.database || (data.status === 'ok' ? 'connected' : 'disconnected'),
        whatsappProvider: data.whatsappProvider || 'disconnected',
        mockMode: data.mockMode !== undefined ? data.mockMode : true,
      });
    } catch {
      setSystemStatus((prev) => ({
        ...prev,
        backend: 'disconnected',
        database: 'unknown',
        whatsappProvider: 'disconnected',
      }));
    }
  }, []);

  useEffect(() => {
    checkHealth();
    loadNotifications();
    const timer = setInterval(() => {
      checkHealth();
      loadNotifications();
    }, 30000);
    return () => clearInterval(timer);
  }, [checkHealth, loadNotifications]);

  const signOut = async () => {
    await logout();
    navigate('/login');
  };

  const goNotification = async (n) => {
    try {
      await markNotificationRead(n._id);
    } catch {
      /* ignore */
    }
    setNoticeOpen(false);
    loadNotifications();
    navigate(
      n.conversationId
        ? '/inbox'
        : n.notificationType?.includes('followup')
        ? '/follow-ups'
        : '/inbox'
    );
  };

  const markAll = async () => {
    try {
      await markAllNotificationsRead();
      loadNotifications();
    } catch {
      /* ignore */
    }
  };

  // ---- Derived system status -----------------------------------------------------------
  const apiUp = systemStatus.backend === 'connected';
  const dbUp = systemStatus.database === 'connected';
  const statusTone = apiUp && dbUp ? 'ok' : apiUp ? 'warn' : systemStatus.backend === 'unknown' ? 'idle' : 'bad';
  const statusText =
    statusTone === 'ok'
      ? 'System operational'
      : statusTone === 'warn'
      ? 'System degraded'
      : statusTone === 'idle'
      ? 'Checking status'
      : 'System unavailable';

  const logoNode = (cls) =>
    rawLogo && !logoFailed ? (
      <img src={rawLogo} alt="" className={cls} onError={() => setLogoFailed(true)} />
    ) : (
      <span className={`${cls} rs-ws-initials`} aria-hidden="true">
        {workspaceInitials}
      </span>
    );

  const collapseLabel = rail ? 'Expand sidebar' : 'Collapse sidebar';

  return (
    <div className={`rs-shell${rail ? ' is-rail' : ''}`}>
      {/* ================= Sidebar / mobile drawer ================= */}
      <aside
        id="rs-sidebar"
        ref={sidebarRef}
        className={`rs-sidebar${rail ? ' is-rail' : ''}${drawerOpen ? ' is-open' : ''}`}
        aria-label="Main navigation"
        {...(drawerOpen ? { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Navigation menu' } : {})}
      >
        {/* 1. Relay product brand (never the business) */}
        <div className="rs-sb-head">
          <Link
            to="/app"
            className="rs-brand"
            aria-label="Relay, go to Overview"
            {...tipProps('Relay')}
          >
            <RelayMark />
            {!rail && (
              <span className="rs-brand-word">
                relay<span className="rs-brand-dot">.</span>
              </span>
            )}
          </Link>

          {isDesktop ? (
            <button
              type="button"
              className="rs-icon-btn rs-icon-btn--dark"
              onClick={toggleCollapse}
              aria-label={collapseLabel}
              aria-expanded={!rail}
              aria-controls="rs-sidebar"
              {...tipProps(collapseLabel, true)}
            >
              {rail ? <PanelLeftOpen size={18} strokeWidth={1.75} /> : <PanelLeftClose size={18} strokeWidth={1.75} />}
            </button>
          ) : (
            <button
              type="button"
              ref={closeBtnRef}
              className="rs-icon-btn rs-icon-btn--dark"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation menu"
            >
              <X size={18} strokeWidth={1.75} />
            </button>
          )}
        </div>

        {/* 2. Workspace (business) identity */}
        {rail ? (
          <div
            className="rs-workspace is-rail"
            role="group"
            aria-label={`Workspace: ${workspaceName}, ${industryLabel}`}
            tabIndex={0}
            {...tipProps(`${workspaceName} · ${industryLabel}`)}
          >
            {logoNode('rs-ws-logo')}
          </div>
        ) : (
          <div
            className="rs-workspace"
            role="group"
            aria-label={`Workspace: ${workspaceName}, ${industryLabel}`}
          >
            {logoNode('rs-ws-logo')}
            <div className="rs-ws-text">
              <strong title={workspaceName}>{workspaceName}</strong>
              <span title={industryLabel}>{industryLabel}</span>
            </div>
          </div>
        )}

        {/* 3. Primary navigation: only this region scrolls */}
        <nav className="rs-nav" aria-label="Modules">
          {NAV_GROUPS.map((group, gi) => (
            <div className="rs-nav-group" key={group.heading}>
              {rail ? (
                gi > 0 && <div className="rs-nav-divider" role="separator" />
              ) : (
                <div className="rs-nav-heading" id={`rs-nav-h-${gi}`}>{group.heading}</div>
              )}
              <ul className="rs-nav-list" aria-labelledby={rail ? undefined : `rs-nav-h-${gi}`}>
                {group.items.map(({ label, to, icon: Icon }) => {
                  const active = isRouteActive(to, location.pathname);
                  return (
                    <li key={to}>
                      <Link
                        to={to}
                        className={`rs-nav-item${active ? ' is-active' : ''}`}
                        aria-current={active ? 'page' : undefined}
                        aria-label={rail ? label : undefined}
                        onClick={() => setMobileOpen(false)}
                        {...tipProps(label)}
                      >
                        <Icon size={NAV_ICON_SIZE} strokeWidth={NAV_ICON_STROKE} className="rs-nav-icon" aria-hidden="true" />
                        {!rail && <span className="rs-nav-label">{label}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* 4. Account (person) footer */}
        <div className="rs-sb-foot">
          <div className={`rs-account${rail ? ' is-rail' : ''}`}>
            <span
              className="rs-avatar rs-avatar--sm"
              aria-hidden={rail ? undefined : 'true'}
              role={rail ? 'img' : undefined}
              aria-label={rail ? `${userName}${userEmail ? `, ${userEmail}` : ''}` : undefined}
              tabIndex={rail ? 0 : undefined}
              {...tipProps(userEmail ? `${userName} · ${userEmail}` : userName)}
            >
              {userInitials}
            </span>
            {!rail && (
              <div className="rs-account-copy">
                <strong title={userName}>{userName}</strong>
                <span title={userEmail}>{userEmail}</span>
              </div>
            )}
            <button
              type="button"
              className="rs-icon-btn rs-icon-btn--dark"
              onClick={signOut}
              aria-label="Sign out"
              {...tipProps('Sign out', true)}
            >
              <LogOut size={17} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </aside>

      {drawerOpen && (
        <button
          type="button"
          className="rs-scrim"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation menu"
          tabIndex={-1}
        />
      )}

      {tip && (
        <div className="rs-tooltip" role="tooltip" style={{ top: tip.top, left: tip.left }}>
          {tip.text}
        </div>
      )}

      {/* ================= Main column ================= */}
      <div className="rs-main">
        <header className="rs-topbar">
          <div className="rs-topbar-inner">
            <div className="rs-top-left">
              <button
                type="button"
                ref={menuBtnRef}
                className="rs-icon-btn rs-icon-btn--light rs-menu-btn"
                onClick={() => setMobileOpen(true)}
                aria-label="Open navigation menu"
                aria-expanded={drawerOpen}
                aria-controls="rs-sidebar"
              >
                <Menu size={19} strokeWidth={1.75} />
              </button>
              <Breadcrumbs />
            </div>

            <div className="rs-top-actions">
              {/* System status */}
              <div className="rs-pop-wrap" ref={statusRef}>
                <button
                  type="button"
                  className={`rs-chip rs-chip--${statusTone}`}
                  onClick={() => {
                    setStatusOpen((v) => !v);
                    setNoticeOpen(false);
                    setAvatarMenuOpen(false);
                  }}
                  aria-haspopup="dialog"
                  aria-expanded={statusOpen}
                  aria-label={`${statusText}. View system readiness details`}
                >
                  <i className={`rs-dot rs-dot--${statusTone}`} aria-hidden="true" />
                  <span className="rs-chip-text">{statusText}</span>
                </button>

                {statusOpen && (
                  <div className="rs-popover" role="dialog" aria-label="System readiness details">
                    <div className="rs-pop-head">
                      <strong>System readiness</strong>
                    </div>
                    <div className="rs-pop-body">
                      <div className="rs-status-row">
                        <span className="rs-status-name">
                          <i className={`rs-dot rs-dot--${apiUp ? 'ok' : statusTone === 'idle' ? 'idle' : 'bad'}`} />
                          Internal Backend API
                        </span>
                        <span className={`rs-status-val ${apiUp ? 'is-good' : statusTone === 'idle' ? 'is-muted' : 'is-bad'}`}>
                          {apiUp ? 'Online' : statusTone === 'idle' ? 'Checking' : 'Unavailable'}
                        </span>
                      </div>
                      <div className="rs-status-row">
                        <span className="rs-status-name">
                          <i className={`rs-dot rs-dot--${dbUp ? 'ok' : systemStatus.database === 'disconnected' ? 'bad' : 'idle'}`} />
                          MongoDB Database
                        </span>
                        <span className={`rs-status-val ${dbUp ? 'is-good' : systemStatus.database === 'disconnected' ? 'is-bad' : 'is-muted'}`}>
                          {dbUp ? 'Connected' : systemStatus.database === 'disconnected' ? 'Disconnected' : 'Unknown'}
                        </span>
                      </div>
                      <div className="rs-status-row">
                        <span className="rs-status-name">
                          <i className="rs-dot rs-dot--idle" />
                          WhatsApp Cloud API
                        </span>
                        <span className="rs-status-val is-muted">Not connected</span>
                      </div>
                      <div className="rs-status-row">
                        <span className="rs-status-name">
                          <i className="rs-dot rs-dot--info" />
                          Sending Mode
                        </span>
                        <span className="rs-status-val is-info">
                          {systemStatus.mockMode ? 'Mock Mode' : 'Disabled'}
                        </span>
                      </div>
                      <p className="rs-status-note">
                        Local CRM operations, template previews, and mock campaigns are fully functional. Official WhatsApp Cloud API credentials and live external sending will be activated upon official Meta provider verification.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {systemStatus.mockMode && (
                <span className="rs-mode" title="Mock Mode: messages are simulated, nothing is sent through WhatsApp">
                  <FlaskConical size={13} strokeWidth={2} aria-hidden="true" />
                  Mock Mode
                </span>
              )}

              <span className="rs-top-sep" aria-hidden="true" />

              {/* Notifications */}
              <div className="rs-pop-wrap" ref={noticeRef}>
                <button
                  type="button"
                  className="rs-icon-btn rs-icon-btn--light"
                  aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
                  aria-haspopup="dialog"
                  aria-expanded={noticeOpen}
                  onClick={() => {
                    setNoticeOpen((v) => !v);
                    setStatusOpen(false);
                    setAvatarMenuOpen(false);
                    loadNotifications();
                  }}
                  title="Notifications"
                >
                  <Bell size={18} strokeWidth={1.75} />
                  {unread > 0 && (
                    <span className="rs-badge-count" aria-hidden="true">{unread > 9 ? '9+' : unread}</span>
                  )}
                </button>

                {noticeOpen && (
                  <section className="rs-popover" aria-label="Notifications panel" role="dialog">
                    <div className="rs-pop-head">
                      <strong>Notifications</strong>
                      <button type="button" className="rs-link-btn" onClick={markAll} disabled={!unread}>
                        <CheckCheck size={13} /> Mark all read
                      </button>
                    </div>
                    {noticeRows.length ? (
                      <div className="rs-notif-list">
                        {noticeRows.map((n) => (
                          <button
                            type="button"
                            className={`rs-notif-row${n.isRead ? '' : ' is-unread'}`}
                            key={n._id}
                            onClick={() => goNotification(n)}
                          >
                            <b>{n.title}</b>
                            <span>{n.description}</span>
                            <small>{new Date(n.createdAt).toLocaleString()}</small>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="rs-notif-empty">You're all caught up.</div>
                    )}
                  </section>
                )}
              </div>

              {/* Account menu (person, not business) */}
              <div className="rs-pop-wrap" ref={avatarRef}>
                <button
                  type="button"
                  className="rs-avatar rs-avatar--btn"
                  onClick={() => {
                    setAvatarMenuOpen((v) => !v);
                    setNoticeOpen(false);
                    setStatusOpen(false);
                  }}
                  aria-haspopup="menu"
                  aria-expanded={avatarMenuOpen}
                  aria-label={`Account menu for ${userName}`}
                  title={userName}
                >
                  {userInitials}
                </button>

                {avatarMenuOpen && (
                  <div className="rs-popover rs-popover--menu" role="menu" aria-label="Account">
                    <div className="rs-menu-head">
                      <span className="rs-avatar rs-avatar--md" aria-hidden="true">{userInitials}</span>
                      <div className="rs-menu-id">
                        <strong title={userName}>{userName}</strong>
                        <span title={userEmail}>{userEmail}</span>
                        {roleLabel && <em className="rs-role">{roleLabel}</em>}
                      </div>
                    </div>
                    <div className="rs-menu-list">
                      <button
                        type="button"
                        role="menuitem"
                        className="rs-menu-item"
                        onClick={() => {
                          setAvatarMenuOpen(false);
                          navigate('/settings');
                        }}
                      >
                        <User size={15} strokeWidth={1.75} /> Profile &amp; Settings
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="rs-menu-item"
                        onClick={() => {
                          setAvatarMenuOpen(false);
                          navigate('/activity');
                        }}
                      >
                        <Activity size={15} strokeWidth={1.75} /> Activity Logs
                      </button>
                      {user?.isPlatformAdmin && (
                        <button
                          type="button"
                          role="menuitem"
                          className="rs-menu-item"
                          onClick={() => {
                            setAvatarMenuOpen(false);
                            navigate('/admin');
                          }}
                        >
                          <ShieldAlert size={15} strokeWidth={1.75} /> Platform Admin Console
                        </button>
                      )}
                      {Boolean(user?.isAgencyOperator) && (
                        <button
                          type="button"
                          role="menuitem"
                          className="rs-menu-item"
                          onClick={() => {
                            setAvatarMenuOpen(false);
                            navigate('/agency');
                          }}
                        >
                          <Briefcase size={15} strokeWidth={1.75} /> Agency Portal
                        </button>
                      )}
                      <div className="rs-menu-sep" role="separator" />
                      <button type="button" role="menuitem" className="rs-menu-item is-danger" onClick={signOut}>
                        <LogOut size={15} strokeWidth={1.75} /> Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Delegated Agency Access Banner */}
        {membership?.isDelegated && (
          <div style={{ background: '#172554', color: '#DBEAFE', padding: '10px 24px', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1E40AF' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Briefcase size={16} color="#60A5FA" />
              <span>Operating on <strong>{workspaceName}</strong> under delegated Agency access.</span>
            </div>
            <Link to="/agency" style={{ color: '#93C5FD', fontWeight: '600', textDecoration: 'none', fontSize: '12.5px', background: 'rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: '4px' }}>
              Return to Agency Portal &rarr;
            </Link>
          </div>
        )}

        {/* Page content with isolated Error Boundary */}
        <div className="page-content">
          <ErrorBoundary key={location.pathname} resetKey={location.pathname}>
            {workspaceLoading ? <p role="status">Loading workspace…</p> : workspaceError ? (
              <div role="alert"><p>{workspaceError}</p><button type="button" onClick={refreshWorkspace}>Retry workspace</button></div>
            ) : <Outlet key={currentWorkspace?._id || 'no-workspace'} />}
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
