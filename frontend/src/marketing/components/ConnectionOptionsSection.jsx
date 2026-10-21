import React from 'react';
import { Smartphone, Cloud, Check, ArrowRight, ShieldCheck, CreditCard } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ConnectionOptionsSection() {
  return (
    <section className="py-20 bg-slate-50 border-b border-slate-200" id="connection-options">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-200/80 border border-slate-300 text-slate-800 text-xs font-semibold">
            <span>Flexible WhatsApp Architecture</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Two Official Ways to Connect Your WhatsApp Number
          </h2>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
            Choose the connection method that fits your existing setup. Relay is engineered to support both existing phone numbers and brand-new virtual lines.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Option A: Coexistence */}
          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
                <Smartphone className="w-6 h-6" />
              </div>
              <span className="text-[11px] font-bold tracking-wider uppercase text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                Option A: Keep Existing Number
              </span>
              <h3 className="text-xl font-bold text-slate-900">
                WhatsApp Business App Coexistence
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Connect your existing WhatsApp Business mobile number without losing your chat history or mobile app access. Perfect for single operators and consultants who already have client contacts on their phones.
              </p>

              <div className="pt-4 border-t border-slate-100 space-y-2 text-xs text-slate-700">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-teal-600 shrink-0" />
                  <span>Keep responding from your WhatsApp Business mobile app</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-teal-600 shrink-0" />
                  <span>Send official approved marketing templates via Relay Web</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-teal-600 shrink-0" />
                  <span>Subject to Meta official coexistence eligibility criteria</span>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-slate-100">
              <span className="text-xs font-semibold text-slate-500">Ideal for: Consultants, Real Estate Agents, Boutique Studios</span>
            </div>
          </div>

          {/* Option B: Dedicated Cloud API Number */}
          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-slate-900 text-teal-400 flex items-center justify-center font-bold">
                <Cloud className="w-6 h-6" />
              </div>
              <span className="text-[11px] font-bold tracking-wider uppercase text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                Option B: High-Volume Virtual Line
              </span>
              <h3 className="text-xl font-bold text-slate-900">
                Dedicated WhatsApp Cloud API Number
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Register a dedicated landline or virtual mobile number directly on Meta's WhatsApp Cloud API. Built for high-volume broadcasts, multi-agent teams, and growing brands.
              </p>

              <div className="pt-4 border-t border-slate-100 space-y-2 text-xs text-slate-700">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-teal-600 shrink-0" />
                  <span>Dedicated brand identity separated from personal devices</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-teal-600 shrink-0" />
                  <span>Scalable throughput for large marketing broadcasts</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-teal-600 shrink-0" />
                  <span>Official Meta verified green tick badge eligible</span>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-slate-100">
              <span className="text-xs font-semibold text-slate-500">Ideal for: Coaching Academies, Clinics, Dealerships, Growing Chains</span>
            </div>
          </div>
        </div>

        {/* Transparent Customer-Direct Billing Callout */}
        <div className="mt-12 bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 max-w-4xl mx-auto shadow-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center shrink-0">
              <CreditCard className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-bold text-slate-900">
                Zero Per-Message Markup — Direct Meta Billing
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Relay does not mark up WhatsApp message rates. Your WhatsApp messaging fees are settled directly with Meta via your credit card registered in Meta Business Manager. You only pay Relay our affordable flat software fee.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
