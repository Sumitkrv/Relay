/**
 * Industry Template Suggestions Component
 * Interactive browser for vetted industry message templates with 1-click draft creation.
 */

import React, { useState } from 'react';
import { useIndustryConfig } from '../../context/IndustryContext';
import { MessageSquare, Check, Sparkles, AlertCircle, Copy } from 'lucide-react';

export default function IndustryTemplateSuggestions({ onDraftCreated }) {
  const { templateSuggestions, installTemplateDraft, loading, industryKey } = useIndustryConfig();
  const [installingKey, setInstallingKey] = useState(null);
  const [successKey, setSuccessKey] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const handleUseTemplate = async (template) => {
    setInstallingKey(template.presetKey);
    setErrorMessage(null);

    try {
      const result = await installTemplateDraft({
        presetKey: template.presetKey,
        title: template.title,
        body: template.body,
      });

      setSuccessKey(template.presetKey);
      if (onDraftCreated) {
        onDraftCreated(result);
      }
      setTimeout(() => setSuccessKey(null), 3000);
    } catch (err) {
      setErrorMessage(err?.response?.data?.message || err.message || 'Failed to save template draft.');
    } finally {
      setInstallingKey(null);
    }
  };

  if (!templateSuggestions || templateSuggestions.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500 text-xs">
        No template presets available for this vertical.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-teal-600" />
            <span>Recommended Message Templates</span>
          </h3>
          <p className="text-xs text-slate-500">
            Vetted starter drafts tailored to your industry. Selecting a preset creates an editable draft in your workspace.
          </p>
        </div>

        <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full shrink-0">
          {templateSuggestions.length} Presets Available
        </span>
      </div>

      {errorMessage && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Grid of Preset Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templateSuggestions.map((tpl) => {
          const isInstalling = installingKey === tpl.presetKey;
          const isSuccess = successKey === tpl.presetKey;

          return (
            <div
              key={tpl.presetKey}
              className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col justify-between hover:border-slate-300 hover:shadow-md transition-all space-y-4"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h4 className="text-sm font-bold text-slate-800 leading-snug">{tpl.title}</h4>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                      Draft Only
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {tpl.categoryIntent?.replace(/_/g, ' ') || 'Marketing'}
                    </span>
                  </div>
                </div>

                {/* Body Text with Highlighted Variables */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-700 leading-relaxed font-sans select-text">
                  {tpl.body.split(/(\{\{[a-z0-9_]+\}\})/g).map((part, i) => {
                    if (part.startsWith('{{') && part.endsWith('}}')) {
                      return (
                        <span
                          key={i}
                          className="inline-block px-1.5 py-0.5 rounded-md bg-teal-50 border border-teal-200 text-teal-800 font-mono text-[11px] font-bold mx-0.5"
                        >
                          {part}
                        </span>
                      );
                    }
                    return <span key={i}>{part}</span>;
                  })}
                </div>

                {/* Variable Pills */}
                {tpl.variables?.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                    <span className="text-[10px] text-slate-400 font-semibold">Variables:</span>
                    {tpl.variables.map((v) => (
                      <span
                        key={v}
                        className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600"
                      >
                        {v}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Bar */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <span className="text-[10px] text-slate-400 italic">
                  Status: Inactive Draft
                </span>

                <button
                  type="button"
                  onClick={() => handleUseTemplate(tpl)}
                  disabled={isInstalling || loading}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs ${
                    isSuccess
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-50'
                  }`}
                >
                  {isSuccess ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Draft Saved</span>
                    </>
                  ) : isInstalling ? (
                    <span>Saving...</span>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                      <span>Use This Template</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Compliance Notice */}
      <div className="p-3 rounded-xl bg-slate-100/70 border border-slate-200 text-[11px] text-slate-500 leading-normal">
        <strong>Compliance Notice:</strong> These presets are software drafts provided for your convenience. They are NOT live Meta-approved and NOT automatically submitted to or approved by Meta WhatsApp. No messages are sent until you explicitly build and schedule a campaign.
      </div>
    </div>
  );
}
