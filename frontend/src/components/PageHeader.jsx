import React from 'react';

/**
 * Reusable PageHeader component for Relay Real Estate Automation
 * 
 * @param {Object} props
 * @param {string} [props.eyebrow] - Uppercase context kicker (e.g. 'YOUR WORKSPACE · CONTACTS')
 * @param {string} props.title - Primary heading
 * @param {string} [props.subtitle] - Concise descriptive subtitle
 * @param {React.ReactNode} [props.actions] - Action buttons aligned to the right
 * @param {string} [props.className] - Optional extra class
 */
export default function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  className = '',
}) {
  return (
    <div className={`page-header ${className}`}>
      <div className="page-header-text">
        {eyebrow && <div className="page-header-eyebrow">{eyebrow}</div>}
        <h1 className="page-header-title">{title}</h1>
        {subtitle && <p className="page-header-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </div>
  );
}
