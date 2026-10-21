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
  Check,
} from 'lucide-react';
import { INDUSTRIES } from '../data/industryData';

export default function IndustriesShowcase() {
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
    <section className="py-20 bg-slate-50 border-b border-slate-200" id="industries">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-200/80 border border-slate-300 text-slate-800 text-xs font-semibold">
            <span>Tailored Industry Configurations</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Workspaces Built Around How Your Business Operates
          </h2>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
            Select your industry during setup. Relay automatically adapts custom contact fields, template presets, and keyword auto-replies to match your workflows.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {INDUSTRIES.map((ind) => {
            const Icon = getIcon(ind.slug);
            const isFlagship = ind.badge === 'Flagship Industry';

            return (
              <div
                key={ind.slug}
                className={`bg-white rounded-2xl p-6 sm:p-7 border transition-all flex flex-col justify-between ${
                  isFlagship
                    ? 'border-teal-400 ring-2 ring-teal-500/20 shadow-md'
                    : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-11 h-11 rounded-xl bg-slate-900 text-teal-400 flex items-center justify-center font-bold">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                        isFlagship
                          ? 'bg-teal-50 text-teal-800 border-teal-200 font-extrabold'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {ind.badge}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900">
                    {ind.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">
                    {ind.tagline}
                  </p>

                  {/* Key Highlights */}
                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5">
                    {ind.useCases.slice(0, 3).map((uc, uIdx) => (
                      <div key={uIdx} className="flex items-center gap-2 text-xs text-slate-700">
                        <Check className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                        <span className="truncate">{uc}</span>
                      </div>
                    ))}
                  </div>

                  {/* Sample Keywords */}
                  <div className="mt-4 flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Presets:</span>
                    {ind.keywords.slice(0, 3).map((kw, kIdx) => (
                      <span
                        key={kIdx}
                        className="bg-slate-100 text-slate-700 font-mono text-[10px] px-1.5 py-0.5 rounded border border-slate-200 font-medium"
                      >
                        {kw.trigger}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100">
                  <Link
                    to={`/industries/${ind.slug}`}
                    className="inline-flex items-center justify-between w-full text-xs font-semibold text-teal-700 hover:text-teal-800 group"
                  >
                    <span>Explore {ind.name} Workflows</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
