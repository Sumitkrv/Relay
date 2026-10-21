import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

const ROUTE_LABELS = {
  '': 'Overview',
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

export default function Breadcrumbs() {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter(Boolean);

  const crumbs = [
    { label: 'Relay', to: '/' }
  ];

  if (pathnames.length === 0) {
    crumbs.push({ label: 'Overview', to: '/', isLast: true });
  } else {
    let accumulatedPath = '';
    pathnames.forEach((segment, index) => {
      accumulatedPath += `/${segment}`;
      const isLast = index === pathnames.length - 1;
      let label = ROUTE_LABELS[segment];
      if (!label) {
        // If it looks like an ID (MongoDB ObjectID or similar hex/alphanumeric), show 'Details'
        if (segment.length >= 12) {
          label = 'Details';
        } else {
          label = segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');
        }
      }
      crumbs.push({
        label,
        to: isLast ? null : accumulatedPath,
        isLast
      });
    });
  }

  return (
    <nav aria-label="Breadcrumb" className="breadcrumb">
      {crumbs.map((crumb, idx) => (
        <React.Fragment key={idx}>
          {idx > 0 && <span className="breadcrumb-separator">/</span>}
          {crumb.isLast ? (
            <strong className="breadcrumb-active">{crumb.label}</strong>
          ) : crumb.to ? (
            <Link to={crumb.to} className="breadcrumb-link">{crumb.label}</Link>
          ) : (
            <span>{crumb.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}
