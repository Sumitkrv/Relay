import React from 'react';
import { Link } from 'react-router-dom';

export default function StatCard({
  label,
  value,
  icon: Icon,
  to,
  tint = 0,
  loading = false,
  badgeText = null,
  footerText = 'since workspace start',
  onClick,
  compact = false,
}) {
  const content = (
    <div className={`stat-card tint-card-${tint} ${compact ? 'is-compact' : ''}`}>
      <div className="stat-head">
        <span className="stat-label">{label}</span>
        {Icon && (
          <div className={`stat-icon tint-${tint}`}>
            <Icon size={compact ? 14 : 16} />
          </div>
        )}
      </div>
      {loading ? (
        <div className="skeleton stat-skeleton" aria-label={`Loading ${label}`} />
      ) : (
        <div className="stat-value">{value ?? '—'}</div>
      )}
      <div className="stat-foot">
        {badgeText && <span className="neutral-chip">{badgeText}</span>}
        <span>{footerText}</span>
      </div>
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="stat-card-link" onClick={onClick}>
        {content}
      </Link>
    );
  }

  return content;
}
