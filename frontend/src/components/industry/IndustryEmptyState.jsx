/**
 * Industry Empty State Component
 * Renders tailored, truthful empty state screens reflecting the business vertical.
 */

import React from 'react';
import { useIndustryConfig } from '../../context/IndustryContext';
import { Sparkles, Users, MessageSquare, Plus } from 'lucide-react';

const EMPTY_MESSAGES = {
  real_estate: {
    contacts: {
      title: 'Start organizing property enquiries',
      description: 'Capture site visit requests, buyer budgets, and unit preferences in one structured CRM.',
      actionLabel: 'Add Property Lead',
    },
    templates: {
      title: 'Vetted Real Estate Templates',
      description: 'Explore pre-written WhatsApp templates for floor plans, brochures, and site visits.',
      actionLabel: 'Browse Real Estate Presets',
    },
    inbox: {
      title: 'Awaiting Buyer Inquiries',
      description: 'Inbound property questions will appear here when connected to the Relay messaging engine.',
    },
  },
  gym: {
    contacts: {
      title: 'Add your first membership enquiry',
      description: 'Track trial bookings, fitness program interests, and workout time preferences.',
      actionLabel: 'Add Fitness Lead',
    },
    templates: {
      title: 'Fitness & Membership Templates',
      description: 'Explore pre-written templates for free trial passes, class timings, and membership renewals.',
      actionLabel: 'Browse Gym Presets',
    },
    inbox: {
      title: 'Awaiting Member Inquiries',
      description: 'Member workout questions and trial requests will appear here when messaging is active.',
    },
  },
  clinic: {
    contacts: {
      title: 'Organize consultation requests',
      description: 'Keep track of OPD appointment enquiries, department interests, and preferred time windows.',
      actionLabel: 'Add Consultation Enquiry',
    },
    templates: {
      title: 'Clinic Information Templates',
      description: 'Explore compliant templates for clinic operating hours, directions, and consultation desks.',
      actionLabel: 'Browse Clinic Presets',
    },
    inbox: {
      title: 'Awaiting Consultation Inquiries',
      description: 'Patient consultation enquiries will appear here when messaging is connected.',
    },
  },
  education: {
    contacts: {
      title: 'Track academic admission enquiries',
      description: 'Organize course interests, batch timing preferences, and academic counselling bookings.',
      actionLabel: 'Add Student Enquiry',
    },
    templates: {
      title: 'Academic & Course Templates',
      description: 'Explore templates for syllabus dispatch, admissions criteria, and upcoming batch cohorts.',
      actionLabel: 'Browse Education Presets',
    },
    inbox: {
      title: 'Awaiting Student Inquiries',
      description: 'Student and parent inquiries will appear here when messaging is active.',
    },
  },
  salon: {
    contacts: {
      title: 'Manage client styling enquiries',
      description: 'Track service requests, bridal packages, and preferred salon appointment slots.',
      actionLabel: 'Add Client Enquiry',
    },
    templates: {
      title: 'Salon & Wellness Templates',
      description: 'Explore templates for service rate cards, care packages, and booking acknowledgments.',
      actionLabel: 'Browse Salon Presets',
    },
    inbox: {
      title: 'Awaiting Styling Inquiries',
      description: 'Client appointment requests will appear here when messaging is active.',
    },
  },
  automobile: {
    contacts: {
      title: 'Manage vehicle buyer enquiries',
      description: 'Track test drive requests, model preferences, and showroom purchase horizons.',
      actionLabel: 'Add Vehicle Lead',
    },
    templates: {
      title: 'Dealership & Model Templates',
      description: 'Explore templates for model brochures, specs sheets, and test drive bookings.',
      actionLabel: 'Browse Auto Presets',
    },
    inbox: {
      title: 'Awaiting Vehicle Inquiries',
      description: 'Buyer model enquiries will appear here when messaging is connected.',
    },
  },
  other: {
    contacts: {
      title: 'Start organizing customer enquiries',
      description: 'Track customer requests, service requirements, and follow-up schedules in one place.',
      actionLabel: 'Add Customer Enquiry',
    },
    templates: {
      title: 'Professional Service Templates',
      description: 'Explore pre-written templates for business hours, service overviews, and quotations.',
      actionLabel: 'Browse Presets',
    },
    inbox: {
      title: 'Awaiting Customer Messages',
      description: 'Customer messages will appear here when your messaging connection is active.',
    },
  },
};

export default function IndustryEmptyState({
  category = 'contacts',
  onAction,
  customTitle,
  customDescription,
  customActionLabel,
}) {
  const { industryKey } = useIndustryConfig();

  const industryDefaults = EMPTY_MESSAGES[industryKey]?.[category] || EMPTY_MESSAGES.other[category] || {
    title: 'No records found',
    description: 'Get started by creating your first entry.',
    actionLabel: 'Add Entry',
  };

  const title = customTitle || industryDefaults.title;
  const description = customDescription || industryDefaults.description;
  const actionLabel = customActionLabel || industryDefaults.actionLabel;

  return (
    <div className="text-center py-12 px-4 max-w-md mx-auto">
      <div className="w-14 h-14 rounded-2xl bg-teal-50 border border-teal-200 text-teal-600 flex items-center justify-center mx-auto mb-4 shadow-sm">
        {category === 'contacts' ? (
          <Users className="w-6 h-6" />
        ) : category === 'templates' ? (
          <MessageSquare className="w-6 h-6" />
        ) : (
          <Sparkles className="w-6 h-6" />
        )}
      </div>

      <h3 className="text-base font-bold text-slate-900 mb-1.5">{title}</h3>
      <p className="text-xs text-slate-500 mb-6 leading-relaxed">{description}</p>

      {onAction && actionLabel && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>{actionLabel}</span>
        </button>
      )}
    </div>
  );
}
