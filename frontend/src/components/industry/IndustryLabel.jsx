/**
 * Industry-Aware Terminology Label
 * Renders vertical-specific business terminology resolved from active configuration.
 */

import React from 'react';
import { useIndustryConfig } from '../../context/IndustryContext';

export default function IndustryLabel({
  name = 'lead',
  fallback = '',
  className = '',
  prefix = '',
  suffix = '',
}) {
  const { terminology } = useIndustryConfig();

  const termMap = {
    lead: terminology?.leadLabel || fallback || 'Lead',
    leads: terminology?.leadPlural || fallback || 'Leads',
    offering: terminology?.offeringLabel || fallback || 'Offering',
    offerings: terminology?.offeringPlural || fallback || 'Offerings',
    interest: terminology?.interestFieldLabel || fallback || 'Interest',
    action: terminology?.actionLabel || fallback || 'Take Action',
  };

  const resolved = termMap[name] || fallback || name;

  return (
    <span className={className}>
      {prefix}
      {resolved}
      {suffix}
    </span>
  );
}
