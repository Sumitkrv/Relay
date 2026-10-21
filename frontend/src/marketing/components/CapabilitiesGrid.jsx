import React from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  FileCode,
  Send,
  MessageSquare,
  Bot,
  BarChart3,
  ArrowRight,
  ShieldCheck,
  Check,
} from 'lucide-react';

const CAPABILITIES = [
  {
    icon: Users,
    title: 'Contacts & Segmentation',
    description: 'Import up to 10,000 spreadsheet rows in Excel or CSV with automatic E.164 phone normalization, custom property tags, and dynamic audience segments.',
    example: 'Filter: "Budget > 2 Cr" + "Preferred Location = Golf Course Road" in 1 click.',
    badge: 'Smart Imports',
  },
  {
    icon: FileCode,
    title: 'Dynamic Template Studio',
    description: 'Design official Meta-compliant templates with rich brochure PDF headers, personalized dynamic tokens, and interactive quick-reply buttons.',
    example: 'Auto-fill client names, project brochures, and discount vouchers dynamically.',
    badge: 'Media Support',
  },
  {
    icon: Send,
    title: 'Audience-Targeted Campaigns',
    description: 'Execute high-intent broadcast campaigns with live audience eligibility checks, scheduled timing, and realistic offline mock simulation.',
    example: 'Broadcast weekend VIP previews with zero risk of unpermitted spam.',
    badge: 'Scheduled Broadcasts',
  },
  {
    icon: MessageSquare,
    title: 'Unified Customer Inbox',
    description: 'Centralize every inbound WhatsApp enquiry in a clean 3-panel chat workspace. View contact history, internal staff notes, and campaign context.',
    example: 'Instant visibility into which campaign triggered the incoming customer enquiry.',
    badge: 'Multi-Operator',
  },
  {
    icon: Bot,
    title: 'Keyword Auto-Replies & Takeover',
    description: 'Set up instant 24/7 automated responses for recurring customer queries (e.g., BROCHURE, TIMINGS, PRICES) with 1-click human operator takeover.',
    example: 'Deliver automated project brochures in under 2 seconds while staff is offline.',
    badge: 'Instant Response',
  },
  {
    icon: BarChart3,
    title: 'Reports & Export Analytics',
    description: 'Track sent, delivered, read, and failed statuses across every campaign. Export comprehensive CSV and Excel reports for stakeholders with zero cross-tenant leakage.',
    example: 'Audit 100% of consent records, opt-outs, and message delivery metrics.',
    badge: 'Audit Ready',
  },
];

export default function CapabilitiesGrid() {
  return (
    <section className="py-20 bg-white border-y border-slate-200" id="capabilities">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold">
            <span>Built for Modern Business Operations</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Six Powerful Modules. One Unified Workspace.
          </h2>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
            Relay replaces disconnected spreadsheets, desktop chat tools, and unapproved sender extensions with a production-grade WhatsApp marketing engine.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {CAPABILITIES.map((cap, idx) => {
            const IconComponent = cap.icon;
            return (
              <div
                key={idx}
                className="bg-slate-50 rounded-2xl p-6 sm:p-8 border border-slate-200/90 hover:border-teal-300 hover:shadow-lg transition-all flex flex-col justify-between group"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                      <IconComponent className="w-6 h-6" />
                    </div>
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-white text-slate-700 border border-slate-200">
                      {cap.badge}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-teal-700 transition-colors">
                      {cap.title}
                    </h3>
                    <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                      {cap.description}
                    </p>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-200/70">
                  <p className="text-xs text-slate-500 font-medium">
                    <span className="font-semibold text-slate-700">Example:</span> {cap.example}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-12 text-center">
          <Link
            to="/features"
            className="inline-flex items-center gap-2 text-sm font-semibold text-teal-700 hover:text-teal-800 transition-colors"
          >
            <span>Explore Complete Feature Specifications</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
