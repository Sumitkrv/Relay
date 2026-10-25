/**
 * Industry Automation Suggestions Component
 * Interactive browser for recommended keyword auto-replies with 1-click inactive rule creation.
 */

import React, { useState } from 'react';
import { useIndustryConfig } from '../../context/IndustryContext';
import { Zap, Check, AlertCircle, ShieldAlert, Key } from 'lucide-react';

export default function IndustryAutomationSuggestions({ onRuleCreated }) {
  const { automationPresets, installAutomationDraft, loading } = useIndustryConfig();
  const [installingId, setInstallingId] = useState(null);
  const [successId, setSuccessId] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const handleAddAutomation = async (preset) => {
    setInstallingId(preset.presetId);
    setErrorMessage(null);

    try {
      const result = await installAutomationDraft({
        presetId: preset.presetId,
        responseMessage: preset.suggestedResponse,
      });

      setSuccessId(preset.presetId);
      if (onRuleCreated) {
        onRuleCreated(result);
      }
      setTimeout(() => setSuccessId(null), 3000);
    } catch (err) {
      setErrorMessage(err?.response?.data?.message || err.message || 'Failed to save automation rule.');
    } finally {
      setInstallingId(null);
    }
  };

  if (!automationPresets || automationPresets.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500 text-xs">
        No automation presets available for this vertical.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" />
            <span>Keyword Automation Presets</span>
          </h3>
          <p className="text-xs text-slate-500">
            Suggested auto-replies triggered by inbound WhatsApp messages. Newly added rules are Disabled By Default.
          </p>
        </div>

        <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full shrink-0">
          {automationPresets.length} Automations Available
        </span>
      </div>

      {errorMessage && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Grid of Automation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {automationPresets.map((ap) => {
          const isInstalling = installingId === ap.presetId;
          const isSuccess = successId === ap.presetId;

          return (
            <div
              key={ap.presetId}
              className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col justify-between hover:border-slate-300 hover:shadow-md transition-all space-y-4"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h4 className="text-sm font-bold text-slate-800 leading-snug">{ap.displayName}</h4>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                      Disabled By Default
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800">
                      Match: {ap.matchType}
                    </span>
                  </div>
                </div>

                {/* Trigger Keywords */}
                <div className="mb-3">
                  <span className="text-[11px] font-semibold text-slate-500 block mb-1.5 flex items-center gap-1">
                    <Key className="w-3 h-3 text-slate-400" />
                    Trigger Keywords:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {ap.triggerKeywords.map((kw) => (
                      <span
                        key={kw}
                        className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Suggested Response Text */}
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-slate-500 block">Suggested Response:</span>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-700 leading-relaxed font-sans select-text">
                    {ap.suggestedResponse}
                  </div>
                </div>
              </div>

              {/* Action Bar */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <span className="text-[10px] text-slate-400 italic">
                  Status: Disabled Draft
                </span>

                <button
                  type="button"
                  onClick={() => handleAddAutomation(ap)}
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
                      <span>Rule Added</span>
                    </>
                  ) : isInstalling ? (
                    <span>Saving...</span>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      <span>Add Automation</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Safety & Opt-Out Notice */}
      <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200 text-[11px] text-amber-900 leading-normal flex items-start gap-2.5">
        <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
        <div>
          <strong>Opt-Out & Compliance Invariant:</strong> Inbound <code>STOP</code>, <code>UNSUBSCRIBE</code>, <code>CANCEL</code>, and <code>QUIT</code> messages will ALWAYS trigger mandatory opt-out suppression and cannot be intercepted or overridden by automation presets.
        </div>
      </div>
    </div>
  );
}
