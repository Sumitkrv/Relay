/**
 * Industry Badge Component
 * Displays a sleek, branded badge with vertical icon and display name.
 */

import React from 'react';
import {
  Building2,
  Dumbbell,
  Stethoscope,
  GraduationCap,
  Scissors,
  Car,
  Briefcase,
} from 'lucide-react';

const INDUSTRY_STYLES = {
  real_estate: {
    label: 'Real Estate & Housing',
    icon: Building2,
    badgeBg: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    iconColor: 'text-indigo-600',
  },
  gym: {
    label: 'Gym & Fitness',
    icon: Dumbbell,
    badgeBg: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    iconColor: 'text-emerald-600',
  },
  clinic: {
    label: 'Clinic & Healthcare',
    icon: Stethoscope,
    badgeBg: 'bg-sky-50 border-sky-200 text-sky-800',
    iconColor: 'text-sky-600',
  },
  education: {
    label: 'Education & Coaching',
    icon: GraduationCap,
    badgeBg: 'bg-amber-50 border-amber-200 text-amber-800',
    iconColor: 'text-amber-600',
  },
  salon: {
    label: 'Salon & Beauty',
    icon: Scissors,
    badgeBg: 'bg-rose-50 border-rose-200 text-rose-800',
    iconColor: 'text-rose-600',
  },
  automobile: {
    label: 'Automobile & Dealerships',
    icon: Car,
    badgeBg: 'bg-slate-100 border-slate-300 text-slate-800',
    iconColor: 'text-slate-700',
  },
  other: {
    label: 'Professional Services',
    icon: Briefcase,
    badgeBg: 'bg-teal-50 border-teal-200 text-teal-800',
    iconColor: 'text-teal-600',
  },
};

export default function IndustryBadge({
  industryKey = 'other',
  customLabel,
  showIcon = true,
  size = 'md',
  className = '',
}) {
  const meta = INDUSTRY_STYLES[industryKey] || INDUSTRY_STYLES.other;
  const IconComponent = meta.icon;
  const labelText = customLabel || meta.label;

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[11px] gap-1',
    md: 'px-2.5 py-1 text-xs gap-1.5',
    lg: 'px-3 py-1.5 text-sm gap-2',
  }[size] || 'px-2.5 py-1 text-xs gap-1.5';

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  }[size] || 'w-3.5 h-3.5';

  return (
    <span
      className={`inline-flex items-center font-bold rounded-lg border shadow-xs transition-colors ${meta.badgeBg} ${sizeClasses} ${className}`}
    >
      {showIcon && <IconComponent className={`${iconSizes} ${meta.iconColor} shrink-0`} />}
      <span>{labelText}</span>
    </span>
  );
}
