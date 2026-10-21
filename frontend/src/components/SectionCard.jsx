import React from 'react';

export default function SectionCard({
  title,
  subtitle,
  action,
  children,
  className = '',
  contentClassName = '',
  noPadding = false,
}) {
  return (
    <section className={`section-card ${className}`}>
      {(title || subtitle || action) && (
        <div className="section-card-head">
          <div className="section-card-title-group">
            {title && <h2 className="section-card-title">{title}</h2>}
            {subtitle && <p className="section-card-subtitle">{subtitle}</p>}
          </div>
          {action && <div className="section-card-action">{action}</div>}
        </div>
      )}
      <div className={`section-card-body ${noPadding ? 'no-padding' : ''} ${contentClassName}`}>
        {children}
      </div>
    </section>
  );
}
