/**
 * Pure route helpers shared by the application shell (Sidebar + Topbar).
 *
 * Kept free of React/JSX imports so the matching and breadcrumb rules can be
 * unit-tested directly with `node --test`.
 */

/** Human readable labels for URL segments (used by the Topbar breadcrumb). */
export const ROUTE_LABELS = {
  '': 'Overview',
  'overview': 'Overview',
  'contacts': 'Contacts',
  'templates': 'Templates',
  'campaigns': 'Campaigns',
  'inbox': 'Inbox & Auto-reply',
  'reports': 'Reports',
  'settings': 'Settings',
  'import': 'Import Contacts',
  'analytics': 'Reports & Performance',
  'activity': 'Activity Logs',
  'pipeline': 'Sales Pipeline',
  'deals': 'Deals',
  'clients': 'Clients',
  'proposals': 'Proposals',
  'workflows': 'Automation Workflows',
  'chatbots': 'Chatbot Studio',
  'follow-ups': 'Follow-ups',
  'hot-leads': 'Hot Leads',
  'lead-scoring': 'Lead Scoring',
  'new': 'Create New',
  'edit': 'Edit',
};

/** Singular noun used for detail/new/edit sub-pages of a module. */
const MODULE_SINGULAR = {
  contacts: 'Contact',
  templates: 'Template',
  campaigns: 'Campaign',
  workflows: 'Workflow',
  proposals: 'Proposal',
  deals: 'Deal',
  clients: 'Client',
};

/**
 * Secondary routes that live outside the seven primary modules but belong to
 * one of them. They keep the parent navigation item highlighted and are shown
 * beneath the parent in the breadcrumb.
 */
export const ROUTE_PARENT = {
  '/import': '/contacts',
  '/activity': '/settings',
};

/**
 * Normalise a pathname so the `/app/...` alias routes and the canonical routes
 * resolve to the same logical location.
 *   /app            -> /
 *   /app/contacts   -> /contacts
 *   /contacts/      -> /contacts
 */
export function normalizePath(pathname = '/') {
  let p = String(pathname || '/').split('?')[0].split('#')[0];
  p = p.replace(/\/+$/, '') || '/';
  if (p === '/app') return '/';
  if (p.startsWith('/app/')) p = p.slice(4);
  if (p === '/overview') return '/';
  return p || '/';
}

/** Resolve the primary module path ("/contacts", "/campaigns", "/") a URL belongs to. */
export function resolveModulePath(pathname) {
  const normalized = normalizePath(pathname);
  if (normalized === '/') return '/';
  const first = `/${normalized.split('/').filter(Boolean)[0]}`;
  return ROUTE_PARENT[first] || first;
}

/**
 * True when `itemTo` is the active primary navigation entry for `pathname`.
 * Nested routes (e.g. /campaigns/:id/edit) keep their module highlighted.
 */
export function isRouteActive(itemTo, pathname) {
  return resolveModulePath(pathname) === normalizePath(itemTo);
}

const looksLikeId = (segment) =>
  /^[0-9a-f]{8,}$/i.test(segment) ||
  /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(segment) ||
  /^\d+$/.test(segment);

const titleCase = (segment) =>
  segment
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

function labelForSubSegment(moduleKey, segment) {
  const singular = MODULE_SINGULAR[moduleKey];
  if (segment === 'new') return singular ? `New ${singular}` : ROUTE_LABELS.new;
  if (segment === 'edit') return ROUTE_LABELS.edit;
  if (looksLikeId(segment)) return singular ? `${singular} Details` : 'Details';
  return ROUTE_LABELS[segment] || titleCase(segment);
}

/**
 * Build the Topbar breadcrumb for a pathname.
 * Returns [{ label, to?, current }]; `to` is omitted for the current page.
 */
export function buildBreadcrumbs(pathname, rootLabel = 'Workspace', rootTo = '/app') {
  const crumbs = [{ label: rootLabel, to: rootTo, current: false }];
  const normalized = normalizePath(pathname);
  const segments = normalized.split('/').filter(Boolean);

  if (segments.length === 0) {
    crumbs.push({ label: ROUTE_LABELS[''], current: true });
    return crumbs;
  }

  const [first, ...rest] = segments;
  const parentPath = ROUTE_PARENT[`/${first}`];
  const parentKey = parentPath ? parentPath.slice(1) : null;

  if (parentKey) {
    crumbs.push({ label: ROUTE_LABELS[parentKey] || titleCase(parentKey), to: parentPath, current: false });
  }

  let acc = `/${first}`;
  crumbs.push({
    label: ROUTE_LABELS[first] || titleCase(first),
    to: acc,
    current: false,
  });

  rest.forEach((segment) => {
    acc += `/${segment}`;
    crumbs.push({
      label: labelForSubSegment(first, segment),
      to: acc,
      current: false,
    });
  });

  const last = crumbs[crumbs.length - 1];
  last.current = true;
  delete last.to;
  return crumbs;
}

/** Initials for a person: first + last word ("M2W Realty Owner" -> "MO"). */
export function personInitials(name, fallback = 'U') {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return fallback;
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/** Initials for a business: first two words ("CarePlus Clinic" -> "CC"). */
export function businessInitials(name, fallback = 'RW') {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return fallback;
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** "real_estate" -> "Real Estate" */
export function formatIndustry(industryKey) {
  if (!industryKey) return '';
  return String(industryKey)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
