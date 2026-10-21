import React from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  FileSpreadsheet,
  FileCode,
  Sparkles,
  Send,
  MessageSquare,
  Bot,
  ShieldCheck,
  BarChart3,
  Settings,
  ArrowRight,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import CTASection from '../components/CTASection';

const DETAILED_FEATURES = [
  {
    id: 'contacts',
    icon: Users,
    title: 'Contact Management & Intelligent Segments',
    headline: 'Organize your customer directory with zero spreadsheet chaos.',
    description: 'Keep your customer database up-to-date with phone number normalization, custom property tags, and dynamic audience segmentation that updates in real time.',
    bullets: [
      'Automatic E.164 phone number formatting and validation for all countries',
      'Dynamic segments based on budget, property type, location, and tags',
      'Full conversation and campaign engagement timeline per contact',
      'Quick search, multi-field filtering, and custom client classifications',
    ],
  },
  {
    id: 'import',
    icon: FileSpreadsheet,
    title: 'Excel & CSV Smart Import Wizard',
    headline: 'Bulk-load 10,000 contacts in minutes with duplicate detection.',
    description: 'Our 5-step spreadsheet import engine maps columns automatically, flags invalid numbers before upload, and merges duplicate contacts safely.',
    bullets: [
      'Supports standard .xlsx, .xls, and .csv files up to 10MB',
      'Interactive column mapping for names, phones, tags, and custom fields',
      'Automatic duplicate resolution policies (skip or update)',
      'Detailed import error logs with downloadable correction reports',
    ],
  },
  {
    id: 'templates',
    icon: FileCode,
    title: 'Dynamic Template Studio with Brochure Support',
    headline: 'Build engaging, interactive WhatsApp templates that get opened.',
    description: 'Design rich marketing templates compliant with official Meta categories (Marketing, Utility, Authentication) with support for brochure PDFs, images, and interactive buttons.',
    bullets: [
      'Rich media headers supporting project brochures, PDFs, and high-res images',
      'Personalized tokens like {{clientName}}, {{projectName}}, and {{budget}}',
      'Interactive quick-reply buttons and call-to-action website links',
      'Truthful local validation matching official Meta character limits and rules',
    ],
  },
  {
    id: 'campaigns',
    icon: Send,
    title: 'Audience-Targeted Campaign Management',
    headline: 'Launch broadcasts with live eligibility preview and scheduled timing.',
    description: 'Target specific customer groups without risking spam bans. Preview personalized messages for real contacts before sending, and schedule broadcasts for optimal time windows.',
    bullets: [
      'Live audience calculation preventing unconsented or suppressed sends',
      'Personalized message carousel preview showing actual contact data',
      'Scheduled launch with timezone-aware delivery windows',
      'Offline Mock Mode simulation for safe rehearsal without Meta billing',
    ],
  },
  {
    id: 'inbox',
    icon: MessageSquare,
    title: 'Unified Multi-Operator Conversational Inbox',
    headline: 'Never lose track of an incoming WhatsApp enquiry again.',
    description: 'Manage all two-way conversations from a single web workspace. View full customer history, link chats to marketing campaigns, and collaborate with internal notes.',
    bullets: [
      'Clean 3-panel chat layout: conversation list, message timeline, and contact drawer',
      'Campaign attribution badge showing which broadcast prompted the enquiry',
      'Internal staff notes and private team comments',
      'Instant manual operator takeover pausing auto-reply bots in 1 click',
    ],
  },
  {
    id: 'automation',
    icon: Bot,
    title: 'Keyword Auto-Replies & Instant Follow-ups',
    headline: 'Provide instant 24/7 answers even when your team is offline.',
    description: 'Configure automated keyword triggers for common queries like BROCHURE, PRICING, TIMINGS, or VISIT. Deliver PDFs and answers in under 2 seconds.',
    bullets: [
      'Exact and fuzzy keyword matching algorithms',
      'Automated delivery of property brochures, price lists, and location pins',
      'Instant STOP keyword detection with automatic suppression',
      'Execution logs tracking every automated response with timestamps',
    ],
  },
  {
    id: 'reports',
    icon: BarChart3,
    title: 'Audit-Ready Analytics & Export Engine',
    headline: 'Comprehensive visibility into campaign performance and consent health.',
    description: 'Track sent, delivered, read, and failed statuses across every campaign. Export clean CSV and Excel files for reporting with guaranteed cross-tenant privacy.',
    bullets: [
      '12-status operational metrics breakdown with zero inflated numbers',
      'Opt-in and opt-out consent audit reporting with legal timestamps',
      'High-performance CSV and XLSX programmatic file exports',
      'Isolated workspace queries preventing any data leakage across businesses',
    ],
  },
];

export default function FeaturesPage() {
  return (
    <div className="flex flex-col">
      {/* Header Banner */}
      <section className="py-16 sm:py-20 bg-gradient-to-b from-white to-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold">
            <span>Complete Platform Architecture</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">
            Features Built for High-Converting WhatsApp Operations
          </h1>
          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Explore the core technology modules powering Relay. Built to eliminate manual messaging chaos while keeping your WhatsApp number 100% compliant.
          </p>
        </div>
      </section>

      {/* Feature Deep Dives */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-24">
          {DETAILED_FEATURES.map((feat, idx) => {
            const Icon = feat.icon;
            const isReversed = idx % 2 === 1;

            return (
              <div
                key={feat.id}
                id={feat.id}
                className={`grid grid-cols-1 lg:grid-cols-12 gap-12 items-center ${
                  isReversed ? 'lg:flex-row-reverse' : ''
                }`}
              >
                <div className={`lg:col-span-6 space-y-6 ${isReversed ? 'lg:order-2' : ''}`}>
                  <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center font-bold">
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                      {feat.title}
                    </h2>
                    <p className="text-base font-semibold text-teal-700 mt-1">
                      {feat.headline}
                    </p>
                  </div>
                  <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                    {feat.description}
                  </p>

                  <ul className="space-y-3 pt-2">
                    {feat.bullets.map((b, bIdx) => (
                      <li key={bIdx} className="flex items-start gap-2.5 text-sm text-slate-700">
                        <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className={`lg:col-span-6 ${isReversed ? 'lg:order-1' : ''}`}>
                  <div className="bg-slate-50 rounded-2xl border border-slate-200/90 p-6 sm:p-8 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                      <span className="text-xs font-mono font-bold text-slate-500 uppercase">Module: {feat.id}</span>
                      <span className="bg-emerald-50 text-emerald-700 font-bold text-[10px] px-2 py-0.5 rounded border border-emerald-200">
                        Production Ready
                      </span>
                    </div>
                    <div className="p-4 bg-white rounded-xl border border-slate-200 text-xs text-slate-700 space-y-2">
                      <div className="flex items-center gap-2 text-teal-700 font-semibold">
                        <ShieldCheck className="w-4 h-4" />
                        <span>Tenant Scoped & Audited</span>
                      </div>
                      <p className="text-slate-500 leading-relaxed">
                        Query operations are restricted by strict workspaceId scoping. Unauthorized cross-tenant access attempts return HTTP 403.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Final Conversion Section */}
      <CTASection />
    </div>
  );
}
