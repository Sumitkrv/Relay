/**
 * Relay CRM Design System Tokens
 * Midnight Slate × Jade Branding (Single-Operator Real Estate WhatsApp Automation)
 */

export const tokens = {
  colors: {
    bg: '#F5F7FA',
    surface: '#FFFFFF',
    surfaceMuted: '#F8FAFC',
    surfaceSubtle: '#F1F5F9',
    sidebar: {
      bg: '#111827',
      hover: '#1F2937',
      active: '#263A3E',
      text: '#E5E7EB',
      textMuted: '#9CA3AF',
      border: '#1F2937',
    },
    primary: {
      default: '#0D9488',
      hover: '#0F766E',
      active: '#115E59',
      soft: '#E6F6F3',
      border: '#99F6E4',
    },
    text: {
      primary: '#111827',
      secondary: '#4B5563',
      muted: '#6B7280',
      subtle: '#9CA3AF',
    },
    border: {
      default: '#E5E7EB',
      strong: '#D0D5DD',
      subtle: '#F3F4F6',
    },
    status: {
      success: { text: '#16A34A', bg: '#DCFCE7', border: '#86EFAC' },
      warning: { text: '#D97706', bg: '#FEF3C7', border: '#FDE68A' },
      danger: { text: '#DC2626', bg: '#FEE2E2', border: '#FCA5A5' },
      info: { text: '#2563EB', bg: '#DBEAFE', border: '#93C5FD' },
      neutral: { text: '#4B5563', bg: '#F3F4F6', border: '#E5E7EB' },
    },
    focus: 'rgba(13, 148, 136, 0.28)',
  },
  layout: {
    sidebarExpandedWidth: 252,
    sidebarCollapsedWidth: 72,
    headerHeight: 68,
    contentMaxWidth: 1440,
  },
  radius: {
    xs: '4px',
    sm: '6px',
    md: '9px',
    lg: '12px',
    xl: '14px',
    full: '9999px',
  },
  shadows: {
    xs: '0 1px 2px rgba(17, 24, 39, 0.05)',
    sm: '0 1px 3px rgba(17, 24, 39, 0.08), 0 1px 2px rgba(17, 24, 39, 0.04)',
    md: '0 4px 6px -1px rgba(17, 24, 39, 0.08), 0 2px 4px -2px rgba(17, 24, 39, 0.05)',
    lg: '0 10px 15px -3px rgba(17, 24, 39, 0.08), 0 4px 6px -4px rgba(17, 24, 39, 0.03)',
    popover: '0 12px 30px rgba(17, 24, 39, 0.15)',
  },
  transitions: {
    fast: '120ms cubic-bezier(0.4, 0, 0.2, 1)',
    normal: '180ms cubic-bezier(0.4, 0, 0.2, 1)',
    smooth: '250ms cubic-bezier(0.4, 0, 0.2, 1)',
  },
};

export default tokens;
