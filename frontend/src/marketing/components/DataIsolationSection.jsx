import React from 'react';
import { Shield, Lock, Database, EyeOff, CheckCircle2 } from 'lucide-react';

const SECURITY_POINTS = [
  {
    icon: Database,
    title: 'Isolated Database Scoping',
    description: 'Every database query across 34 business collections is authoritatively bound to your unique workspace ID. Cross-tenant queries are blocked at the engine layer.',
  },
  {
    icon: Lock,
    title: 'Cryptographic Session Protection',
    description: 'Stateless JWT sessions backed by server-side version rotation. Revoking membership instantly terminates access across all active browser windows.',
  },
  {
    icon: EyeOff,
    title: 'Zero Cross-Tenant Leakage',
    description: 'Contacts, conversation transcripts, customer phone numbers, and brochure media belonging to your workspace are completely invisible to other business accounts.',
  },
  {
    icon: Shield,
    title: 'Official Meta API Provenance',
    description: 'Relay dispatches messages exclusively through official Meta WhatsApp Cloud API endpoints and offline simulation harnesses. No scraping, no risky third-party proxies.',
  },
];

export default function DataIsolationSection() {
  return (
    <section className="py-20 bg-slate-900 text-slate-100 border-b border-slate-800" id="security">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs font-semibold">
            <span>Enterprise-Grade Multi-Tenant Architecture</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Your Customer Data Belongs Exclusively to Your Business
          </h2>
          <p className="text-base sm:text-lg text-slate-400 leading-relaxed">
            Relay is architected from the ground up for strict multi-tenant boundary enforcement. We never pool, share, or expose your proprietary leads to other tenants.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {SECURITY_POINTS.map((pt, idx) => {
            const Icon = pt.icon;
            return (
              <div
                key={idx}
                className="bg-slate-800/60 p-6 rounded-2xl border border-slate-700/80 hover:border-teal-500/40 transition-all flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center border border-teal-500/30">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-white">
                    {pt.title}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {pt.description}
                  </p>
                </div>

                <div className="mt-6 pt-3 border-t border-slate-700/50 flex items-center gap-1.5 text-[11px] text-teal-400 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Enforced at middleware boundary</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
