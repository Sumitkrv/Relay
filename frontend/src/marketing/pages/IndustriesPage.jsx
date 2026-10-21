import React from 'react';
import { Link } from 'react-router-dom';
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
  ShieldCheck,
} from 'lucide-react';
import { INDUSTRIES } from '../data/industryData';
import CTASection from '../components/CTASection';

export default function IndustriesPage() {
  const getIcon = (slug) => {
    switch (slug) {
      case 'real-estate': return Building2;
      case 'gym': return Dumbbell;
      case 'clinic': return Stethoscope;
      case 'education': return GraduationCap;
      case 'salon': return Sparkles;
      case 'automobile': return Car;
      default: return Layers;
    }
  };

  return (
    <div className="flex flex-col">
      {/* Header Banner */}
      <section className="py-16 sm:py-20 bg-gradient-to-b from-white to-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold">
            <span>Tailored Workspace Presets</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">
            Built for Your Industry's Customer Journey
          </h1>
          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Relay dynamically configures contact fields, message templates, tags, and keyword auto-replies to match the way your business speaks to customers.
          </p>
        </div>
      </section>

      {/* Industries Grid */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {INDUSTRIES.map((ind) => {
              const Icon = getIcon(ind.slug);
              const isFlagship = ind.badge === 'Flagship Industry';

              return (
                <div
                  key={ind.slug}
                  className={`bg-slate-50/80 rounded-2xl p-7 border transition-all flex flex-col justify-between ${
                    isFlagship
                      ? 'border-teal-400 ring-2 ring-teal-500/20 shadow-md bg-white'
                      : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
                  }`}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="w-12 h-12 rounded-xl bg-slate-900 text-teal-400 flex items-center justify-center font-bold shadow-xs">
                        <Icon className="w-6 h-6" />
                      </div>
                      <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-white text-slate-700 border border-slate-200">
                        {ind.badge}
                      </span>
                    </div>

                    <div>
                      <h2 className="text-xl font-bold text-slate-900">
                        {ind.name}
                      </h2>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                        {ind.tagline}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-200/70 space-y-2">
                      <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Top Use Cases:</p>
                      {ind.useCases.slice(0, 3).map((uc, uIdx) => (
                        <div key={uIdx} className="flex items-center gap-2 text-xs text-slate-600">
                          <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                          <span className="truncate">{uc}</span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Interactive Keyword Presets:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {ind.keywords.slice(0, 4).map((k, kIdx) => (
                          <span
                            key={kIdx}
                            className="bg-white text-slate-700 font-mono text-[10px] px-2 py-0.5 rounded border border-slate-200 font-semibold"
                          >
                            {k.trigger}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 pt-4 border-t border-slate-200/80">
                    <Link
                      to={`/industries/${ind.slug}`}
                      className="inline-flex items-center justify-between w-full text-xs font-semibold text-teal-700 hover:text-teal-800 group"
                    >
                      <span>View Full {ind.name} Blueprint</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Industry Preset Architecture Explanation */}
          <div className="mt-16 bg-slate-900 text-white rounded-2xl p-8 max-w-4xl mx-auto shadow-lg space-y-4">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-7 h-7 text-teal-400 shrink-0" />
              <h3 className="text-lg font-bold">One Unified Core Engine, Specialized Configurations</h3>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              Relay does not fragment into seven separate, unmaintainable software codebases. Instead, our unified multi-tenant core dynamically serves industry-specific schema definitions, validation rules, template tags, and auto-reply defaults based on your workspace’s verified category.
            </p>
          </div>
        </div>
      </section>

      <CTASection />
    </div>
  );
}
