import React from 'react';

const STATUS_MAP = {
  // Lead statuses
  new: { label: 'New', className: 'status-new' },
  contacted: { label: 'Contacted', className: 'status-contacted' },
  interested: { label: 'Interested', className: 'status-interested' },
  'follow-up required': { label: 'Follow-up Required', className: 'status-followup' },
  followup: { label: 'Follow-up', className: 'status-followup' },
  negotiation: { label: 'Negotiation', className: 'status-negotiation' },
  converted: { label: 'Converted', className: 'status-converted' },
  'not interested': { label: 'Not Interested', className: 'status-notinterested' },
  notinterested: { label: 'Not Interested', className: 'status-notinterested' },
  closed: { label: 'Closed', className: 'status-closed' },

  // Workflow / Campaign statuses
  draft: { label: 'Draft', className: 'status-draft' },
  validated: { label: 'Validated', className: 'status-validated' },
  published: { label: 'Published', className: 'status-published' },
  active: { label: 'Active', className: 'status-active' },
  paused: { label: 'Paused', className: 'status-paused' },
  archived: { label: 'Archived', className: 'status-archived' },
  completed: { label: 'Completed', className: 'status-completed' },
  failed: { label: 'Failed', className: 'status-failed' },

  // Consent statuses
  'opted in': { label: 'Opted In', className: 'status-optedin' },
  'opted out': { label: 'Opted Out', className: 'status-optedout' },
  'pending verification': { label: 'Pending Verification', className: 'status-pending' },
  unknown: { label: 'Unknown', className: 'status-neutral' },
};

export default function StatusBadge({
  value,
  variant,
  showDot = false,
  className = '',
}) {
  const norm = String(value || '').toLowerCase().trim();
  const config = STATUS_MAP[norm] || { label: value || '—', className: 'status-neutral' };
  const badgeClass = variant ? `status-${variant}` : config.className;

  return (
    <span className={`status-badge-modern ${badgeClass} ${className}`}>
      {showDot && <span className="status-dot-indicator" />}
      <span>{config.label}</span>
    </span>
  );
}
