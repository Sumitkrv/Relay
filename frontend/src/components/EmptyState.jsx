import React from 'react';
import { Link } from 'react-router-dom';

export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionTo,
  onAction,
  secondaryActionLabel,
  secondaryActionTo,
  onSecondaryAction,
  compact = false,
}) {
  return (
    <div className={`empty-state-card ${compact ? 'compact' : ''}`}>
      {Icon && (
        <div className="empty-state-icon">
          <Icon size={compact ? 20 : 26} />
        </div>
      )}
      <h3 className="empty-state-title">{title}</h3>
      {description && <p className="empty-state-description">{description}</p>}
      {(actionLabel || secondaryActionLabel) && (
        <div className="empty-state-actions">
          {actionLabel && (
            actionTo ? (
              <Link to={actionTo} className="primary-btn small">
                {actionLabel}
              </Link>
            ) : (
              <button onClick={onAction} className="primary-btn small">
                {actionLabel}
              </button>
            )
          )}
          {secondaryActionLabel && (
            secondaryActionTo ? (
              <Link to={secondaryActionTo} className="outline-btn small">
                {secondaryActionLabel}
              </Link>
            ) : (
              <button onClick={onSecondaryAction} className="outline-btn small">
                {secondaryActionLabel}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
