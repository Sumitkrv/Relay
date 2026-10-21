import React from 'react';
import { Link } from 'react-router-dom';
import {
  UserPlus,
  Building,
  Upload,
  Send,
  Smartphone,
  CreditCard,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Zap,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import CTASection from '../components/CTASection';

export default function HowItWorksPage() {
  const steps = [
    {
      step: '01',
      title: 'Create Your Business Workspace',
      badge: 'Account Setup',
      icon: UserPlus,
      description:
        'Sign up with your business email. Relay creates an isolated tenant environment with its own cryptographic token store, audit logs, and independent database boundaries.',
      details: [
        'Isolated workspace boundary preventing cross-tenant leakage',
        'Role-based access control with Workspace Owner and Agent permissions',
        'Secure multi-session authentication with encrypted credentials',
      ],
      note: 'During Early Access (Phase 3), workspaces are provisioned by invitation while self-serve registration is finalized in Phase 4.',
    },
    {
      step: '02',
      title: 'Choose Your Industry Configuration',
      badge: 'Smart Presets',
      icon: Building,
      description:
        'Select from 7 specialized business categories: Real Estate, Gym & Fitness, Clinic, Education, Salon & Beauty, Automobile, or Other Business.',
      details: [
        'Preset audience tags (e.g., "Site Visit Done", "Trial Member", "Course Batch")',
        'Keyword auto-reply blueprints tailored to customer purchase questions',
        'Pre-approved WhatsApp message templates with dynamic variable placeholders',
      ],
      note: 'Industry presets configure terminology and workflows; all core modules remain identical and fully customizable.',
    },
    {
      step: '03',
      title: 'Import Contacts & Explore in Mock Mode',
      badge: 'Zero Risk Sandbox',
      icon: Upload,
      description:
        'Upload your customer database via standard Excel (.xlsx) or CSV files up to 10,000 rows. Test every template and campaign safely without spending a rupee on Meta API charges.',
      details: [
        'Instant deduplication, phone normalization (+91 / E.164), and invalid number detection',
        'Custom variable mapping for {{name}}, {{project}}, {{expiry_date}}, and custom fields',
        'Full Mock Mode campaign execution with realistic delivery simulation logs',
      ],
      note: 'Mock Mode operates entirely in software — no messages are dispatched to real phones until you connect an authorized WhatsApp number.',
    },
    {
      step: '04',
      title: 'Connect Your WhatsApp Business Number',
      badge: 'Meta Direct Connection',
      icon: Smartphone,
      description:
        'Choose the official Meta connection model that fits your operational needs. Every workspace links directly to its own authorized WhatsApp Business Account (WABA).',
      details: [
        'Option A: WhatsApp Business App coexistence via official embedded onboarding',
        'Option B: Dedicated WhatsApp Cloud API phone number for high-volume delivery',
        'Direct Meta authorization ensuring your customer conversations remain your property',
      ],
      note: 'Live messaging requires a verified Meta Business Account, active display name approval, and explicit customer opt-in consent.',
    },
    {
      step: '05',
      title: 'Launch Campaigns & Manage Real-Time Conversations',
      badge: 'Unified Execution',
      icon: Send,
      description:
        'Send scheduled broadcasts, share PDF brochures, and respond to incoming inquiries from a shared team inbox with zero message chaos.',
      details: [
        'Audience filtering by industry tags, property budget, or trial status',
        'Instant keyword triggers that reply to common inquiries in under 2 seconds',
        'Live multi-agent inbox with conversation status tracking and follow-up flags',
      ],
      note: 'All broadcast marketing templates require pre-approval through Meta WhatsApp Cloud API in accordance with WhatsApp Business messaging policies.',
    },
    {
      step: '06',
      title: 'Review Delivery Analytics & Optimize ROI',
      badge: 'Data-Driven Growth',
      icon: BarChart3,
      description:
        'Monitor delivery rates, read confirmations, response velocity, and campaign return on investment from a centralized analytics suite.',
      details: [
        'Real-time metrics: Sent, Delivered, Read, Replied, and Opt-outs',
        'Comprehensive activity audit log for team compliance and oversight',
        'Exportable CSV reports for executive reporting and CRM synchronisation',
      ],
      note: 'Detailed delivery timestamps are collected directly from Meta delivery webhooks.',
    },
  ];

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Header Banner */}
      <section className="relative overflow-hidden bg-slate-900 text-white pt-20 pb-24 lg:pt-28 lg:pb-32">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#0D9488_1px,transparent_1px)] [background-size:20px_20px]" />
        <div className="absolute top-1/4 -right-20 w-96 h-96 bg-teal-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-900/60 border border-teal-500/30 text-teal-300 text-xs font-semibold uppercase tracking-wider mb-6">
            <Zap className="w-3.5 h-3.5" />
            <span>End-to-End Operational Blueprint</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white mb-6">
            How Relay Transforms <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-emerald-300">
              Your Business WhatsApp
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed">
            From safe sandbox exploration in Mock Mode to verified Meta WhatsApp Cloud API connectivity,
            discover the exact step-by-step path to automated customer communication.
          </p>

          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold px-6 py-3.5 rounded-xl shadow-lg shadow-teal-500/20 transition-all hover:scale-[1.02]"
            >
              <span>Get Early Access</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 bg-slate-800/80 hover:bg-slate-800 text-slate-200 border border-slate-700 font-semibold px-6 py-3.5 rounded-xl transition-colors"
            >
              <span>View Transparent Pricing</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Core Principle Callouts */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-10 relative z-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 flex items-start gap-4">
            <div className="p-2.5 rounded-lg bg-teal-50 text-teal-600 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Strict Multi-Tenant Isolation</h3>
              <p className="text-xs text-slate-600 mt-1">
                Your contacts, messages, and campaigns are cryptographically separated from all other businesses.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 flex items-start gap-4">
            <div className="p-2.5 rounded-lg bg-teal-50 text-teal-600 shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Zero-Risk Mock Mode</h3>
              <p className="text-xs text-slate-600 mt-1">
                Simulate broadcast campaigns, evaluate dynamic variables, and test auto-replies before going live.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 flex items-start gap-4">
            <div className="p-2.5 rounded-lg bg-teal-50 text-teal-600 shrink-0">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Separated Meta Billing</h3>
              <p className="text-xs text-slate-600 mt-1">
                You pay Relay a flat software fee; Meta per-conversation charges are billed directly to your own card.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Step-by-Step Detailed Process */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-24">
        <div className="text-center mb-16">
          <h2 className="text-xs font-bold uppercase tracking-wider text-teal-600 mb-2">Process Architecture</h2>
          <p className="text-3xl font-extrabold text-slate-900">Six Steps from Setup to Scale</p>
          <p className="text-slate-600 mt-2 text-sm max-w-xl mx-auto">
            A structured, enterprise-grade journey engineered for maximum reliability and regulatory compliance.
          </p>
        </div>

        <div className="space-y-8">
          {steps.map((item, idx) => {
            const IconComponent = item.icon;
            return (
              <div
                key={item.step}
                className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm hover:border-slate-300 transition-all"
              >
                <div className="flex flex-col sm:flex-row items-start gap-6">
                  {/* Step Number & Icon */}
                  <div className="flex sm:flex-col items-center gap-3 shrink-0">
                    <span className="text-3xl font-black text-slate-300 font-mono">{item.step}</span>
                    <div className="w-12 h-12 rounded-xl bg-slate-900 text-teal-400 flex items-center justify-center shadow-sm">
                      <IconComponent className="w-6 h-6" />
                    </div>
                  </div>

                  {/* Step Content */}
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-slate-900">{item.title}</h3>
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                        {item.badge}
                      </span>
                    </div>

                    <p className="text-sm text-slate-600 leading-relaxed mb-4">{item.description}</p>

                    {/* Bullet Highlights */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                      {item.details.map((detail, dIdx) => (
                        <div key={dIdx} className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                          <span className="text-xs text-slate-700 leading-snug">{detail}</span>
                        </div>
                      ))}
                    </div>

                    {/* Compliance/Operational Note */}
                    <div className="flex items-start gap-2 text-xs text-slate-500 bg-amber-50/60 border border-amber-200/60 rounded-lg p-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>{item.note}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Meta WhatsApp Connection Deep-Dive */}
      <section className="bg-slate-900 text-white py-20 border-y border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-teal-400">Meta Infrastructure</span>
            <h2 className="text-3xl font-extrabold text-white mt-2">
              Two Official Connection Models
            </h2>
            <p className="text-slate-400 text-sm mt-3 leading-relaxed">
              Relay exclusively integrates through official Meta WhatsApp Business channels. We do not use fragile web-scraping or unauthorized mass-messaging scripts.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Model A */}
            <div className="bg-slate-800/90 rounded-2xl p-8 border border-slate-700/80 flex flex-col justify-between">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-700 text-slate-300 text-xs font-semibold mb-4">
                  Option A
                </div>
                <h3 className="text-xl font-bold text-white mb-2">WhatsApp Business App Coexistence</h3>
                <p className="text-sm text-slate-300 leading-relaxed mb-6">
                  Keep your existing WhatsApp Business mobile app on your phone while linking Relay for automation, broadcast campaigns, and multi-agent inbox management.
                </p>

                <div className="space-y-3 mb-6">
                  <div className="flex items-start gap-2 text-xs text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                    <span>Uses official Meta coexistence onboarding</span>
                  </div>
                  <div className="flex items-start gap-2 text-xs text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                    <span>Retain existing chats on your physical smartphone</span>
                  </div>
                  <div className="flex items-start gap-2 text-xs text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                    <span>Ideal for boutique agencies, clinics, and local salons</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-700/60 text-xs text-slate-400">
                Requires an active WhatsApp Business App number meeting Meta eligibility criteria.
              </div>
            </div>

            {/* Model B */}
            <div className="bg-slate-800/90 rounded-2xl p-8 border border-slate-700/80 flex flex-col justify-between">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-900/60 text-teal-300 border border-teal-500/30 text-xs font-semibold mb-4">
                  Option B — High Volume
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Dedicated WhatsApp Cloud API</h3>
                <p className="text-sm text-slate-300 leading-relaxed mb-6">
                  Register a clean, dedicated commercial number directly on Meta Cloud API infrastructure. Ideal for large real estate developers, educational institutes, and gym franchises.
                </p>

                <div className="space-y-3 mb-6">
                  <div className="flex items-start gap-2 text-xs text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                    <span>Direct high-throughput message sending (Tier 1-4 limits)</span>
                  </div>
                  <div className="flex items-start gap-2 text-xs text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                    <span>Official Green Tick verification eligibility with Meta</span>
                  </div>
                  <div className="flex items-start gap-2 text-xs text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                    <span>Zero reliance on a physical phone or cellular connectivity</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-700/60 text-xs text-slate-400">
                Number must not be actively registered on personal WhatsApp before Cloud API provisioning.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <CTASection />
    </div>
  );
}
