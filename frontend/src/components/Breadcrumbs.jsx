import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { buildBreadcrumbs } from '../layout/shellRoutes';

/**
 * Route-aware Topbar breadcrumb: "Workspace / Campaigns / Campaign Details".
 * Label metadata (ROUTE_LABELS) and nesting rules live in layout/shellRoutes.js.
 */
export default function Breadcrumbs() {
  const { pathname } = useLocation();
  const crumbs = buildBreadcrumbs(pathname);

  return (
    <nav aria-label="Breadcrumb" className="rs-crumbs">
      <ol>
        {crumbs.map((crumb, idx) => (
          <li
            key={`${crumb.label}-${idx}`}
            className={`rs-crumb${crumb.current ? ' is-current' : ''}`}
          >
            {idx > 0 && <ChevronRight size={14} className="rs-crumb-sep" aria-hidden="true" />}
            {crumb.current ? (
              <span aria-current="page" title={crumb.label}>{crumb.label}</span>
            ) : (
              <Link to={crumb.to}>{crumb.label}</Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
