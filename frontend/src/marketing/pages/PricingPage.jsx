import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check,
  X,
  Sparkles,
  HelpCircle,
  CreditCard,
  Building,
  ArrowRight,
  ShieldCheck,
  Zap,
  Info,
  ChevronDown,
} from 'lucide-react';
import { PRICING_TIERS, BILLING_EXPLANATION } from '../data/pricingData';
import { FAQS } from '../data/faqData';
import CTASection from '../components/CTASection';

export default function PricingPage() {
  const [openFaqIndex, setOpenFaqIndex] = useState(null);

  // Filter FAQs relevant to billing & pricing
  const pricingFaqs = FAQS.filter(
    (faq) =>
      faq.category === 'Pricing & Plans' ||
      faq.question.toLowerCase().includes('charge') ||
      faq.question.toLowerCase().includes('meta') ||
      faq.question.toLowerCase().includes('cancel')
  );

  const toggleFaq = (index) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Pricing Header */}
      <section className="relative overflow-hidden bg-slate-900 text-white pt-20 pb-28 lg:pt-28 lg:pb-36">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#0D9488_1px,transparent_1px)] [background-size:20px_20px]" />
        <div className="absolute top-1/3 -left-20 w-80 h-80 bg-teal-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-900/60 border border-teal-500/30 text-teal-300 text-xs font-semibold uppercase tracking-wider mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Honest & Predictable Pricing</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white mb-6">
            Simple, Transparent Plans <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-emerald-300">
              For Growing Businesses
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
            One flat software subscription. Zero message markups. Connect your official WhatsApp Business number and keep complete ownership of your billing.
          </p>

          {/* Pricing Approval Notice */}
          <div className="mt-8 inline-flex items-center gap-2 bg-slate-800/80 border border-slate-700 text-slate-300 text-xs px-4 py-2 rounded-full">
            <Info className="w-4 h-4 text-teal-400 shrink-0" />
            <span>Proposed introductory pricing for early-access cohorts. Official launch billing subject to final commercial confirmation.</span>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16 sm:-mt-20 relative z-20 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          {PRICING_TIERS.map((tier) => (
            <div
              key={tier.id}
              className={`rounded-2xl flex flex-col justify-between transition-all duration-200 ${
                tier.highlighted
                  ? 'bg-white border-2 border-teal-600 shadow-2xl relative lg:-translate-y-2'
                  : 'bg-white border border-slate-200 shadow-lg'
              } p-8`}
            >
              {tier.highlighted && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-teal-600 text-white text-xs font-bold uppercase tracking-wider py-1 px-4 rounded-full shadow-md">
                  {tier.badge}
                </div>
              )}

              <div>
                {!tier.highlighted && (
                  <span className="inline-block text-xs font-semibold px-2.5 py-1 rounded bg-slate-100 text-slate-700 mb-4">
                    {tier.badge}
                  </span>
                )}

                <h3 className="text-2xl font-bold text-slate-900 mt-2">{tier.name}</h3>
                <p className="text-sm text-slate-600 mt-2 min-h-[40px]">{tier.description}</p>

                {/* Price Display */}
                <div className="mt-6 pb-6 border-b border-slate-100">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl sm:text-5xl font-extrabold text-slate-900">{tier.price}</span>
                    {tier.regularPrice && (
                      <span className="text-lg text-slate-400 line-through">{tier.regularPrice}</span>
                    )}
                  </div>
                  <span className="text-xs text-slate-500 block mt-1">{tier.period}</span>
                </div>

                {/* Feature List */}
                <div className="mt-6 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Included Capabilities</p>
                  {tier.features.map((feature, fIdx) => (
                    <div key={fIdx} className="flex items-start gap-3">
                      <div className="p-0.5 rounded bg-teal-50 text-teal-600 mt-0.5 shrink-0">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs sm:text-sm text-slate-700 leading-snug">{feature}</span>
                    </div>
                  ))}

                  {tier.limitations && tier.limitations.length > 0 && (
                    <div className="pt-3 border-t border-slate-100 space-y-2">
                      {tier.limitations.map((limitation, lIdx) => (
                        <div key={lIdx} className="flex items-start gap-3 text-slate-500">
                          <div className="p-0.5 rounded bg-slate-100 text-slate-400 mt-0.5 shrink-0">
                            <Info className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-xs text-slate-500 leading-snug">{limitation}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-8 pt-6 border-t border-slate-100">
                <Link
                  to={tier.ctaLink}
                  className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                    tier.highlighted
                      ? 'bg-teal-600 hover:bg-teal-700 text-white shadow-md hover:shadow-lg'
                      : 'bg-slate-900 hover:bg-slate-800 text-white'
                  }`}
                >
                  <span>{tier.ctaText}</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Meta Direct Billing vs Relay Subscription Explainer */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-10 shadow-sm">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-bold uppercase tracking-wider text-teal-600">Cost Transparency</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
              How WhatsApp Billing Works
            </h2>
            <p className="text-slate-600 text-sm mt-2">
              Unlike legacy bulk WhatsApp tools that hide opaque markups inside message packs, Relay provides 100% financial clarity.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Relay Software Fee */}
            <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold">
                  1
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{BILLING_EXPLANATION.relaySubscription.title}</h3>
                  <span className="text-xs text-teal-600 font-semibold">Flat Software License</span>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-4">
                {BILLING_EXPLANATION.relaySubscription.description}
              </p>
              <div className="bg-white rounded-lg p-3 border border-slate-200 text-xs text-slate-700 font-medium flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-teal-600 shrink-0" />
                <span>{BILLING_EXPLANATION.relaySubscription.recipient}</span>
              </div>
            </div>

            {/* Meta Official Messaging Fee */}
            <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold">
                  2
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{BILLING_EXPLANATION.metaCharges.title}</h3>
                  <span className="text-xs text-slate-500 font-semibold">Official Conversation Fee</span>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-4">
                {BILLING_EXPLANATION.metaCharges.description}
              </p>
              <div className="bg-white rounded-lg p-3 border border-slate-200 text-xs text-slate-700 font-medium flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-slate-900 shrink-0" />
                <span>{BILLING_EXPLANATION.metaCharges.recipient}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 bg-teal-50 border border-teal-200 rounded-xl p-4 text-xs text-teal-900 flex items-start gap-3">
            <Info className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Zero Message Surcharges:</span> Relay never marks up Meta conversation fees or imposes arbitrary "wallet credits" with hidden expiry dates. You pay Meta directly at their published regional tariff rates.
            </div>
          </div>
        </div>
      </section>

      {/* Pricing FAQs */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <span className="text-xs font-bold uppercase tracking-wider text-teal-600">Got Questions?</span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
            Pricing & Subscription FAQ
          </h2>
          <p className="text-slate-600 text-sm mt-2">
            Clear, honest answers to common billing and infrastructure questions.
          </p>
        </div>

        <div className="space-y-4">
          {pricingFaqs.map((faq, idx) => (
            <div
              key={idx}
              className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-colors"
            >
              <button
                type="button"
                onClick={() => toggleFaq(idx)}
                className="w-full py-4 px-6 text-left flex items-center justify-between gap-4 focus:outline-none"
                aria-expanded={openFaqIndex === idx}
              >
                <span className="font-bold text-slate-900 text-sm sm:text-base">{faq.question}</span>
                <ChevronDown
                  className={`w-5 h-5 text-slate-400 shrink-0 transition-transform duration-200 ${
                    openFaqIndex === idx ? 'rotate-180 text-teal-600' : ''
                  }`}
                />
              </button>

              {openFaqIndex === idx && (
                <div className="px-6 pb-5 pt-1 text-slate-600 text-sm leading-relaxed border-t border-slate-100 bg-slate-50/50">
                  {faq.answer}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link
            to="/faq"
            className="text-sm font-semibold text-teal-600 hover:text-teal-700 inline-flex items-center gap-1.5"
          >
            <span>View all platform and technical FAQs</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* CTA Section */}
      <CTASection />
    </div>
  );
}
