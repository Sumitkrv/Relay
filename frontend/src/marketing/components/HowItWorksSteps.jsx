import React from 'react';
import {
  UserPlus,
  Building,
  Sliders,
  PhoneCall,
  Send,
  LineChart,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

const STEPS = [
  {
    step: '01',
    icon: UserPlus,
    title: 'Create Your Account',
    description: 'Sign up in under 60 seconds. Set up your business profile, location, and verified email address.',
  },
  {
    step: '02',
    icon: Building,
    title: 'Choose Your Industry',
    description: 'Select from Real Estate, Gym, Clinic, Education, Salon, Automobile, or Universal Business.',
  },
  {
    step: '03',
    icon: Sliders,
    title: 'Automated Workspace Provisioning',
    description: 'Relay generates custom contact fields, starter templates, tags, and keyword auto-reply rules for your industry.',
  },
  {
    step: '04',
    icon: PhoneCall,
    title: 'Connect WhatsApp Business',
    description: 'Connect via official Meta Cloud API or existing WhatsApp Business App coexistence with zero unofficial scrapers.',
  },
  {
    step: '05',
    icon: Send,
    title: 'Launch Campaigns & Auto-Replies',
    description: 'Import contacts, test templates in offline Mock Mode, and launch targeted broadcasts to opted-in audiences.',
  },
  {
    step: '06',
    icon: LineChart,
    title: 'Analyze & Scale Operations',
    description: 'Monitor real-time delivery rates, customer replies, operator takeover stats, and export audit-ready reports.',
  },
];

export default function HowItWorksSteps() {
  return (
    <section className="py-20 bg-white border-b border-slate-200" id="how-it-works">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold">
            <span>Seamless 6-Step Journey</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            How Relay Transforms Your Customer Conversations
          </h2>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
            From setup to scaling, every step is built around transparency, data safety, and compliance with official Meta WhatsApp policies.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {STEPS.map((s, idx) => {
            const Icon = s.icon;
            return (
              <div
                key={idx}
                className="bg-slate-50/70 p-6 sm:p-7 rounded-2xl border border-slate-200/80 relative hover:border-teal-300 hover:shadow-md transition-all group"
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-2xl font-black text-slate-300 group-hover:text-teal-600 transition-colors font-mono">
                    {s.step}
                  </span>
                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-teal-600 shadow-xs group-hover:bg-teal-600 group-hover:text-white transition-colors">
                    <Icon className="w-5 h-5" />
                  </div>
                </div>

                <h3 className="text-base font-bold text-slate-900 mb-2">
                  {s.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {s.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Policy & Compliance Note */}
        <div className="mt-12 bg-slate-900 text-slate-200 p-6 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 max-w-4xl mx-auto shadow-md">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-teal-400 shrink-0" />
            <div className="text-xs">
              <span className="font-bold text-white block text-sm">Official WhatsApp Platform Compliance</span>
              <span className="text-slate-400">Requires customer opt-in consent and approved Meta message templates for marketing broadcasts.</span>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 text-xs font-semibold whitespace-nowrap">
            <CheckCircle2 className="w-3.5 h-3.5" /> 100% Policy Compliant
          </span>
        </div>
      </div>
    </section>
  );
}
