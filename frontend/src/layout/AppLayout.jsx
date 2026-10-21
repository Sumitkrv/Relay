import React, { useEffect, useState, useRef } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Activity,
  Wallet,
  BarChart3,
  Bell,
  Boxes,
  ContactRound,
  FileSpreadsheet,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  Settings,
  Workflow,
  Bot,
  X,
  Clock3,
  CheckCheck,
  PanelLeftClose,
  PanelLeftOpen,
  User,
  Flame,
  FileBarChart2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { markAllNotificationsRead, markNotificationRead, notifications } from '../services/inbox';
import api from '../services/api';
import Breadcrumbs from '../components/Breadcrumbs';
import ErrorBoundary from '../components/ErrorBoundary';

// Exact 7 primary navigation screens for the single-operator Real Estate WhatsApp automation platform
const nav = [
  { label: 'Overview', to: '/app', icon: LayoutDashboard },
  { label: 'Contacts', to: '/contacts', icon: ContactRound },
  { label: 'Templates', to: '/templates', icon: MessageSquareText },
  { label: 'Campaigns', to: '/campaigns', icon: Boxes },
  { label: 'Inbox & Auto-reply', to: '/inbox', icon: Inbox },
  { label: 'Reports', to: '/reports', icon: FileBarChart2 },
  { label: 'Settings', to: '/settings', icon: Settings },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  // Default to expanded (false) on desktop; persist user toggle preference cleanly
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('relay_sidebar_collapsed_v10') === 'true';
    } catch {
      return false;
    }
  });
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [noticeRows, setNoticeRows] = useState([]);
  const [unread, setUnread] = useState(0);

  // Live system readiness status
  const [systemStatus, setSystemStatus] = useState({
    backend: 'unknown',
    database: 'unknown',
    whatsappProvider: 'disconnected',
    mockMode: true,
  });

  const navigate = useNavigate();
  const location = useLocation();
  const noticeRef = useRef(null);
  const statusRef = useRef(null);
  const avatarRef = useRef(null);

  // Sync collapsed state to localStorage
  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('relay_sidebar_collapsed_v10', String(next));
      } catch {}
      return next;
    });
  };

  // Close menus on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (noticeRef.current && !noticeRef.current.contains(e.target)) {
        setNoticeOpen(false);
      }
      if (statusRef.current && !statusRef.current.contains(e.target)) {
        setStatusOpen(false);
      }
      if (avatarRef.current && !avatarRef.current.contains(e.target)) {
        setAvatarMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const loadNotifications = async () => {
    try {
      const { data } = await notifications({ limit: 20 });
      setNoticeRows(data.records || []);
      setUnread(data.unreadCount || 0);
    } catch {
      // Graceful fail
    }
  };

  // Query genuine backend readiness
  const checkHealth = async () => {
    try {
      const { data } = await api.get('/health');
      setSystemStatus({
        backend: data.backend || 'connected',
        database: data.database || (data.status === 'ok' ? 'connected' : 'disconnected'),
        whatsappProvider: data.whatsappProvider || 'disconnected',
        mockMode: data.mockMode !== undefined ? data.mockMode : true,
      });
    } catch {
      setSystemStatus({
        backend: 'disconnected',
        database: 'unknown',
        whatsappProvider: 'disconnected',
        mockMode: false,
      });
    }
  };

  useEffect(() => {
    checkHealth();
    loadNotifications();
    const timer = setInterval(() => {
      checkHealth();
      loadNotifications();
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const signOut = async () => {
    await logout();
    navigate('/login');
  };

  const goNotification = async (n) => {
    try {
      await markNotificationRead(n._id);
    } catch {}
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
    } catch {}
  };

  return (
    <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Sidebar */}
      <aside
        className={`sidebar ${mobileOpen ? 'sidebar-open' : ''} ${collapsed ? 'is-collapsed' : ''}`}
        aria-label="Main Navigation"
      >
        {/* Brand header */}
        <div className="brand">
          <img
            src="/logo.png"
            alt="M2W Realty"
            className="brand-logo-img"
            title="M2W Realty — Real Estate WhatsApp Automation"
          />
          {!collapsed && (
            <div className="brand-text-wrap">
              <span className="brand-text">
                M2W Realty<span className="brand-dot">.</span>
              </span>
              <span className="brand-badge">WhatsApp Automation</span>
            </div>
          )}
          {mobileOpen && (
            <button
              className="mobile-close icon-btn"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Workspace Switcher / Badge: Single Operator */}
        {!collapsed ? (
          <div className="workspace-switch" title={`Signed in as ${user?.email || ''}`}>
            <img
              src="/logo.png"
              alt="M2W Realty"
              className="workspace-logo-img"
            />
            <div className="workspace-text">
              <strong>{user?.businessName || 'M2W Realty'}</strong>
              <span>Single Operator</span>
            </div>
            <span className="workspace-pill">Owner</span>
          </div>
        ) : (
          <div className="workspace-icon-collapsed" title={user?.businessName || 'M2W Realty'}>
            <img
              src="/logo.png"
              alt="M2W Realty"
              style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'contain', background: '#FFFFFF' }}
            />
          </div>
        )}

        {!collapsed && <div className="nav-label">AUTOMATION PLATFORM</div>}

        {/* Scrollable Navigation Items - Exact 7 Screens */}
        <nav className="sidebar-nav-scroll" tabIndex={0} aria-label="Modules">
          {nav.map(({ label, to, icon: Icon }) => (
            <NavLink
              end={to === '/'}
              key={to}
              to={to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              title={collapsed ? label : undefined}
            >
              <Icon size={17} className="nav-icon" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="sidebar-bottom">
          {/* Desktop collapse toggle */}
          <button
            type="button"
            className="nav-item collapse-toggle-btn desktop-only"
            onClick={toggleCollapse}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
            {!collapsed && <span>Collapse sidebar</span>}
          </button>

          <button
            type="button"
            className="nav-item nav-button"
            onClick={signOut}
            title={collapsed ? 'Sign out' : undefined}
          >
            <LogOut size={17} className="nav-icon" />
            {!collapsed && <span>Sign out</span>}
          </button>

          {/* User Profile Footer (When Expanded) */}
          {!collapsed && (
            <div className="profile-row">
              <div className="avatar" style={{ overflow: 'hidden', padding: 0, background: '#FFFFFF' }}>
                <img
                  src="/logo.png"
                  alt="M2W Realty"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              </div>
              <div className="profile-copy">
                <strong>{user?.name || 'Owner'}</strong>
                <span>{user?.email}</span>
              </div>
              <button
                className="icon-btn"
                aria-label="Account Settings"
                onClick={() => navigate('/settings')}
                title="Account Settings"
              >
                <Settings size={15} />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Drawer Scrim */}
      {mobileOpen && (
        <button
          className="scrim"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        />
      )}

      {/* Main Content Area */}
      <main className="main-area">
        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-btn mobile-menu"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
            {/* Dynamic route-aware breadcrumbs */}
            <Breadcrumbs />
          </div>

          <div className="top-actions">
            {/* System Status Pill */}
            <div className="status-pill-wrap" ref={statusRef}>
              <button
                type="button"
                className="status-pill"
                onClick={() => setStatusOpen((prev) => !prev)}
                title="Click for system readiness details"
                aria-label="System status overview"
              >
                <i
                  className={
                    systemStatus.backend === 'connected' && systemStatus.database === 'connected'
                      ? 'status-dot-green'
                      : systemStatus.backend === 'connected'
                      ? 'status-dot-amber'
                      : 'status-dot-red'
                  }
                />
                <span className="status-pill-text">
                  {systemStatus.backend === 'connected' && systemStatus.database === 'connected'
                    ? 'API & Database Online'
                    : systemStatus.backend === 'connected'
                    ? 'Database Degraded'
                    : 'Backend Offline'}
                </span>
                <span className="status-pill-tag">Mock Mode</span>
              </button>

              {statusOpen && (
                <div className="status-popover" role="dialog" aria-label="System readiness details">
                  <header>
                    <strong>System Readiness & Integration Status</strong>
                  </header>
                  <div className="status-item">
                    <div className="status-row-title">
                      <span
                        className={
                          systemStatus.backend === 'connected'
                            ? 'status-dot-green'
                            : 'status-dot-red'
                        }
                      />
                      Internal Backend API
                    </div>
                    <span
                      className={`status-val ${
                        systemStatus.backend === 'connected' ? 'good' : 'bad'
                      }`}
                    >
                      {systemStatus.backend === 'connected' ? 'Online (Port 5000)' : 'Disconnected'}
                    </span>
                  </div>
                  <div className="status-item">
                    <div className="status-row-title">
                      <span
                        className={
                          systemStatus.database === 'connected'
                            ? 'status-dot-green'
                            : systemStatus.database === 'disconnected'
                            ? 'status-dot-red'
                            : 'status-dot-muted'
                        }
                      />
                      MongoDB Database
                    </div>
                    <span
                      className={`status-val ${
                        systemStatus.database === 'connected' ? 'good' : 'muted'
                      }`}
                    >
                      {systemStatus.database === 'connected'
                        ? 'Connected'
                        : systemStatus.database === 'disconnected'
                        ? 'Disconnected'
                        : 'Unknown'}
                    </span>
                  </div>
                  <div className="status-item highlight-off">
                    <div className="status-row-title">
                      <span className="status-dot-muted" />
                      WhatsApp Cloud API
                    </div>
                    <span className="status-val muted">Disconnected (Pending Provider Setup)</span>
                  </div>
                  <div className="status-item">
                    <div className="status-row-title">
                      <span className="status-dot-green" />
                      Sending Mode
                    </div>
                    <span className="status-val good">
                      {systemStatus.mockMode ? 'Mock Mode Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <small className="status-disclaimer">
                    Local CRM operations, template previews, and mock campaigns are fully functional. Official WhatsApp Cloud API credentials and live external sending will be activated upon official Meta provider verification.
                  </small>
                </div>
              )}
            </div>

            {/* Notification Bell */}
            <div className="notification-wrap" ref={noticeRef}>
              <button
                className="icon-btn notification"
                aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
                onClick={() => {
                  setNoticeOpen((v) => !v);
                  loadNotifications();
                }}
                title="Notifications"
              >
                <Bell size={18} />
                {unread > 0 && <i className="unread-dot" />}
              </button>

              {noticeOpen && (
                <section className="notification-popover" aria-label="Notifications panel">
                  <header>
                    <b>Notifications</b>
                    <button onClick={markAll} disabled={!unread}>
                      <CheckCheck size={13} /> Mark all read
                    </button>
                  </header>
                  {noticeRows.length ? (
                    <div className="notification-list">
                      {noticeRows.map((n) => (
                        <button
                          className={`notification-row ${n.isRead ? '' : 'unread'}`}
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
                    <div className="notification-empty">You're all caught up.</div>
                  )}
                </section>
              )}
            </div>

            {/* User Avatar Menu */}
            <div className="avatar-menu-wrap" ref={avatarRef}>
              <button
                type="button"
                className="top-avatar"
                onClick={() => setAvatarMenuOpen((v) => !v)}
                title={user?.name || 'Account menu'}
                aria-label="User account menu"
                style={{ overflow: 'hidden', padding: 0, background: '#FFFFFF' }}
              >
                <img
                  src="/logo.png"
                  alt="M2W Realty"
                  className="top-avatar-img"
                />
              </button>

              {avatarMenuOpen && (
                <div className="avatar-popover">
                  <div className="avatar-popover-header">
                    <strong>{user?.name || 'Relay User'}</strong>
                    <span>{user?.email || ''}</span>
                  </div>
                  <div className="avatar-popover-links">
                    <button
                      onClick={() => {
                        setAvatarMenuOpen(false);
                        navigate('/settings');
                      }}
                    >
                      <User size={14} /> Profile & Settings
                    </button>
                    <button
                      onClick={() => {
                        setAvatarMenuOpen(false);
                        navigate('/activity');
                      }}
                    >
                      <Activity size={14} /> Activity Logs
                    </button>
                    <div className="popover-divider" />
                    <button onClick={signOut} className="text-danger">
                      <LogOut size={14} /> Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content with isolated Error Boundary */}
        <div className="page-content">
          <ErrorBoundary key={location.pathname} resetKey={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
}
