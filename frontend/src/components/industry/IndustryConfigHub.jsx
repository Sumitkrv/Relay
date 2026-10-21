/**
 * Industry Configuration Hub
 * Master component integrating Dynamic Fields preview, Template Library,
 * Keyword Automations, and Terminology Settings into a cohesive, tabbed surface.
 */

import React, { useState } from 'react';
import { useIndustryConfig } from '../../context/IndustryContext';
import IndustryBadge from './IndustryBadge';
import DynamicContactFields from './DynamicContactFields';
import IndustryTemplateSuggestions from './IndustryTemplateSuggestions';
import IndustryAutomationSuggestions from './IndustryAutomationSuggestions';
import {
  Sparkles,
  SlidersHorizontal,
  MessageSquare,
  Zap,
  BookOpen,
  CheckCircle2,
  Table,
} from 'lucide-react';

export default function IndustryConfigHub({ initialTab = 'fields', className = '' }) {
  const {
    industryKey,
    config,
    terminology,
    contactFields,
    displayPreferences,
    templateSuggestions,
    automationPresets,
    loading,
  } = useIndustryConfig();

  const [activeTab, setActiveTab] = useState(initialTab);
  const [previewValues, setPreviewValues] = useState({});
  const [previewErrors, setPreviewErrors] = useState({});

  const handlePreviewFieldChange = (key, val) => {
    setPreviewValues((prev) => ({ ...prev, [key]: val }));
    // Clear error on edit
    if (previewErrors[key]) {
      setPreviewErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const tabs = [
    { id: 'fields', label: 'Dynamic Contact Fields', icon: SlidersHorizontal, count: contactFields.length },
    { id: 'templates', label: 'Template Suggestions', icon: MessageSquare, count: templateSuggestions.length },
    { id: 'automations', label: 'Keyword Presets', icon: Zap, count: automationPresets.length },
    { id: 'terminology', label: 'Business Terminology', icon: BookOpen },
  ];

  return (
    <div className={`bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden ${className}`}>
      {/* Header Banner */}
      <div className="p-6 sm:p-8 border-b border-slate-200 bg-slate-900 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <IndustryBadge industryKey={industryKey} size="lg" />
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-teal-400 border border-slate-700">
                Config v{config?.registryVersion || 1}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              {config?.name || 'Industry Configuration Engine'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
              {config?.description || 'Configuration-driven fields, templates, and presets for your operational vertical.'}
            </p>
          </div>

          <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 border-t sm:border-t-0 border-slate-800 pt-3 sm:pt-0">
            <span className="text-[11px] text-slate-400">Workspace Status</span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Config Active</span>
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 mt-6 overflow-x-auto no-scrollbar pt-2 border-t border-slate-800/80">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-teal-500 text-slate-950 shadow-md font-extrabold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isActive ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Panels */}
      <div className="p-6 sm:p-8">
        {/* Panel 1: Dynamic Contact Fields */}
        {activeTab === 'fields' && (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Contact Form Fields for {config?.name}
                </h3>
                <p className="text-xs text-slate-500">
                  Every vertical receives customized, validated contact fields while sharing the same underlying CRM models.
                </p>
              </div>

              <span className="text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1 rounded-xl">
                Table Columns: {displayPreferences?.defaultColumns?.length || 0}
              </span>
            </div>

            {/* Interactive Dynamic Form Preview */}
            <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-5 sm:p-7 space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-teal-600" />
                  <span>Interactive Form Preview</span>
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewValues({})}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                >
                  Reset Preview Inputs
                </button>
              </div>

              <DynamicContactFields
                fields={contactFields}
                values={previewValues}
                onChange={handlePreviewFieldChange}
                errors={previewErrors}
              />
            </div>

            {/* Table Column Preview */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <Table className="w-4 h-4 text-slate-500" />
                <span>Default Visible Table Columns</span>
              </h4>
              <div className="flex flex-wrap gap-2">
                {(displayPreferences?.defaultColumns || []).map((col) => (
                  <span
                    key={col}
                    className="inline-flex items-center px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 shadow-xs"
                  >
                    {col}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Panel 2: Template Suggestions */}
        {activeTab === 'templates' && (
          <IndustryTemplateSuggestions />
        )}

        {/* Panel 3: Keyword Automation Presets */}
        {activeTab === 'automations' && (
          <IndustryAutomationSuggestions />
        )}

        {/* Panel 4: Business Terminology */}
        {activeTab === 'terminology' && (
          <div className="space-y-6">
            <div className="pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Industry-Specific Dashboard Terminology
              </h3>
              <p className="text-xs text-slate-500">
                Shared CRM views adapt their semantic labels to speak your business language.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Lead Entity Label</span>
                <p className="text-sm font-bold text-slate-900">{terminology?.leadLabel || 'Lead'}</p>
                <span className="text-xs text-slate-500">Plural: {terminology?.leadPlural || 'Leads'}</span>
              </div>

              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Offering Label</span>
                <p className="text-sm font-bold text-slate-900">{terminology?.offeringLabel || 'Offering'}</p>
                <span className="text-xs text-slate-500">Plural: {terminology?.offeringPlural || 'Offerings'}</span>
              </div>

              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Interest Field Name</span>
                <p className="text-sm font-bold text-slate-900">{terminology?.interestFieldLabel || 'Interest'}</p>
                <span className="text-xs text-slate-500">Field: {config?.contactDisplayPreferences?.badgeField || 'N/A'}</span>
              </div>

              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Primary CTA Action</span>
                <p className="text-sm font-bold text-slate-900">{terminology?.actionLabel || 'Take Action'}</p>
                <span className="text-xs text-slate-500">Primary qualification event</span>
              </div>

              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Default Locale</span>
                <p className="text-sm font-bold text-slate-900">{config?.defaultLocale || 'en-IN'}</p>
                <span className="text-xs text-slate-500">Timezone & Currency: INR</span>
              </div>

              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Configuration Version</span>
                <p className="text-sm font-bold text-teal-700 font-mono">v{config?.registryVersion || 1}</p>
                <span className="text-xs text-slate-500">Immutable schema contract</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
