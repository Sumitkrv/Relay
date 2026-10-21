import React from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import {
  Building2,
  Dumbbell,
  Stethoscope,
  GraduationCap,
  Sparkles,
  Car,
  Layers,
  ArrowRight,
  CheckCircle2,
  MessageSquare,
  FileText,
  Clock,
  ShieldCheck,
  Send,
} from 'lucide-react';
import { INDUSTRIES } from '../data/industryData';
import CTASection from '../components/CTASection';

export default function IndustryDetailPage() {
  const { slug } = useParams();
  const industry = INDUSTRIES.find((i) => i.slug === slug);

  // If unknown industry slug, return 404 state
  if (!industry) {
    return (
      <div className="py-24 text-center px-4 max-w-xl mx-auto space-y-4">
        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
          <Layers className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Industry Configuration Not Found</h1>
        <p className="text-sm text-slate-600">
          The requested industry workspace "{slug}" does not exist or has not been configured yet.
        </p>
        <div className="pt-4">
          <Link
            to="/industries"
            className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm px-5 py-2.5 rounded-lg shadow-sm"
          >
            <span>View All Supported Industries</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  const getIcon = (indSlug) => {
    switch (indSlug) {
      case 'real-estate': return Building2;
      case 'gym': return Dumbbell;
      case 'clinic': return Stethoscope;
      case 'education': return GraduationCap;
      case 'salon': return Sparkles;
      case 'automobile': return Car;
      default: return Layers;
    }
  };

  const IconComponent = getIcon(industry.slug);

  return (
    <div className="flex flex-col">
      {/* Industry Hero */}
      <section className="py-16 sm:py-20 bg-gradient-to-b from-white via-slate-50 to-slate-100 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold">
              <IconComponent className="w-4 h-4 text-teal-700" />
              <span>{industry.badge}</span>
            </div>

            <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
              {industry.headline}
            </h1>

            <p className="text-lg text-slate-600 leading-relaxed">
              {industry.description}
            </p>

            {/* Hero Key Stats */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-200/80">
              {industry.heroStats.map((stat, sIdx) => (
                <div key={sIdx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                  <span className="text-xl sm:text-2xl font-black text-slate-900 block font-mono">
                    {stat.value}
                  </span>
                  <span className="text-xs text-slate-500 font-medium block mt-0.5">
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                to={`/signup?industry=${industry.slug}`}
                className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm px-6 py-3 rounded-xl shadow-md transition-all"
              >
                <span>Get Early Access for {industry.shortName}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/how-it-works"
                className="inline-flex items-center gap-2 bg-white hover:bg-slate-100 text-slate-800 font-semibold text-sm px-6 py-3 rounded-xl border border-slate-300 transition-all shadow-xs"
              >
                <span>See Architecture</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Groups */}
      <section className="py-20 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Specialized {industry.name} Features
            </h2>
            <p className="text-slate-600 text-sm sm:text-base">
              Everything your team needs to capture, qualify, and convert enquiries without manual repetitive messaging.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {industry.features.map((feat, idx) => (
              <div
                key={idx}
                className="bg-slate-50 p-6 sm:p-8 rounded-2xl border border-slate-200 hover:border-teal-300 hover:shadow-md transition-all space-y-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold">
                    <CheckCircle2 className="w-5 h-5 text-teal-700" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">{feat.title}</h3>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed pl-13">
                  {feat.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive Keyword Automation Showcase */}
      <section className="py-20 bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left: Keywords explanation */}
            <div className="lg:col-span-6 space-y-6">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-200 text-slate-800 text-xs font-semibold">
                <span>Instant Auto-Reply Presets</span>
              </div>
              <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                24/7 Automated Responses for Recurring Enquiries
              </h2>
              <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
                When prospects message keyword triggers on WhatsApp, Relay sends verified instant responses with brochures, pricing guides, or schedules.
              </p>

              <div className="space-y-3">
                {industry.keywords.map((kw, kIdx) => (
                  <div key={kIdx} className="bg-white p-3.5 rounded-xl border border-slate-200 text-xs shadow-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                        TRIGGER: {kw.trigger}
                      </span>
                      <span className="text-[10px] text-slate-400 font-semibold">Auto-Reply Bot</span>
                    </div>
                    <p className="text-slate-700 leading-relaxed">{kw.response}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Sample WhatsApp Template Preview */}
            <div className="lg:col-span-6">
              <div className="max-w-md mx-auto bg-[#ECE5DD] p-4 rounded-3xl border-4 border-slate-800 shadow-xl">
                <div className="bg-[#075E54] text-white p-3 rounded-t-2xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs">
                      {industry.shortName.slice(0, 3).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-bold leading-none">{industry.sampleTemplate.header}</p>
                      <p className="text-[10px] text-teal-200 mt-0.5">Verified WhatsApp Business</p>
                    </div>
                  </div>
                  <ShieldCheck className="w-4 h-4 text-teal-300" />
                </div>

                <div className="bg-white p-4 rounded-b-2xl shadow-sm my-3 text-xs text-slate-800 space-y-3 border border-slate-200">
                  <p className="leading-relaxed">{industry.sampleTemplate.body}</p>
                  <div className="pt-2 border-t border-slate-100 space-y-1.5">
                    {industry.sampleTemplate.buttons.map((btn, bIdx) => (
                      <button
                        key={bIdx}
                        className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-teal-700 font-bold rounded-lg text-xs border border-slate-200 flex items-center justify-center gap-1 transition-colors"
                      >
                        <span>{btn}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Other Industries Navigation */}
      <section className="py-16 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold text-slate-900">Explore Other Supported Industries</h3>
            <Link to="/industries" className="text-xs font-semibold text-teal-700 hover:text-teal-800 flex items-center gap-1">
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {INDUSTRIES.filter((i) => i.slug !== industry.slug).map((other) => {
              const OtherIcon = getIcon(other.slug);
              return (
                <Link
                  key={other.slug}
                  to={`/industries/${other.slug}`}
                  className="bg-slate-50 p-4 rounded-xl border border-slate-200 hover:border-teal-400 hover:shadow-xs transition-all text-center group"
                >
                  <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 mx-auto flex items-center justify-center text-slate-700 group-hover:text-teal-600 transition-colors mb-2">
                    <OtherIcon className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-800 group-hover:text-teal-700 block truncate">
                    {other.name}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <CTASection />
    </div>
  );
}
