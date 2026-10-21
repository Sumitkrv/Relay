import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, CheckCircle2, AlertCircle, ShieldAlert, ArrowRight } from 'lucide-react';

export default function TermsPage() {
  const lastUpdated = 'October 20, 2026';
  const effectiveDate = 'October 20, 2026';

  const sections = [
    { id: 'acceptance', title: '1. Acceptance of Terms' },
    { id: 'service-scope', title: '2. Platform Description & Service Scope' },
    { id: 'meta-compliance', title: '3. Meta WhatsApp Business Policies & Opt-In Rules' },
    { id: 'prohibited-activities', title: '4. Strictly Prohibited Activities' },
    { id: 'billing-arrangements', title: '5. Relay Subscriptions & Independent Meta Billing' },
    { id: 'mock-mode', title: '6. Mock Mode Simulation Environment' },
    { id: 'workspace-security', title: '7. Account Security & Workspace Administration' },
    { id: 'intellectual-property', title: '8. Intellectual Property & License Grant' },
    { id: 'limitation-liability', title: '9. Limitation of Liability & Warranties' },
    { id: 'termination', title: '10. Cancellation & Suspension of Service' },
    { id: 'governing-law', title: '11. Governing Law & Dispute Resolution' },
  ];

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Header */}
      <section className="bg-slate-900 text-white pt-16 pb-20 border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-900/60 border border-teal-500/30 text-teal-300 text-xs font-semibold uppercase tracking-wider mb-4">
            <FileText className="w-3.5 h-3.5" />
            <span>Service Agreement</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white mb-4">
            Terms of Service
          </h1>

          <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto">
            Please read these terms carefully before accessing or using the Relay WhatsApp automation software platform.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-400">
            <span>Last Updated: <strong className="text-slate-200">{lastUpdated}</strong></span>
            <span>•</span>
            <span>Effective Date: <strong className="text-slate-200">{effectiveDate}</strong></span>
            <span>•</span>
            <span className="bg-amber-900/40 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30">
              Draft / Pre-Launch Notice
            </span>
          </div>
        </div>
      </section>

      {/* Main Content Layout */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Sticky Table of Contents */}
          <aside className="hidden lg:block lg:col-span-4">
            <div className="sticky top-24 bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                Sections
              </h3>
              <nav className="space-y-1">
                {sections.map((s) => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    className="block text-xs text-slate-600 hover:text-teal-600 hover:bg-slate-50 rounded px-2 py-1.5 transition-colors"
                  >
                    {s.title}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Legal Prose */}
          <main className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 p-6 sm:p-10 shadow-sm prose prose-slate max-w-none text-sm leading-relaxed">
            {/* Operator Notice */}
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs mb-8 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Standard Pre-Launch Terms Notice</strong>
                These Terms of Service govern usage of the Relay platform during development, early access previews, and subsequent production phases. Formal commercial entity designations will be updated prior to commercial payment launch.
              </div>
            </div>

            <section id="acceptance" className="mb-10">
              <h2 className="text-lg font-bold text-slate-900 pb-2 border-b border-slate-100">
                1. Acceptance of Terms
              </h2>
              <p className="mt-3 text-slate-600">
                By creating an account, accessing the Relay dashboard, importing contact databases, or connecting a WhatsApp Business phone number, you agree to be bound by these Terms of Service and all incorporated operational policies.
              </p>
            </section>

            <section id="service-scope" className="mb-10">
              <h2 className="text-lg font-bold text-slate-900 pb-2 border-b border-slate-100">
                2. Platform Description & Service Scope
              </h2>
              <p className="mt-3 text-slate-600">
                Relay provides cloud-hosted multi-tenant software modules including: Contact Audience Management, Template Studio, Broadcast Campaigns, Keyword Auto-replies, Unified Conversational Inbox, and Reporting Analytics. Relay is a productivity and automation management tool, not an authorized telecommunication carrier.
              </p>
            </section>

            <section id="meta-compliance" className="mb-10">
              <h2 className="text-lg font-bold text-slate-900 pb-2 border-b border-slate-100">
                3. Meta WhatsApp Business Policies & Opt-In Rules
              </h2>
              <p className="mt-3 text-slate-600">
                All subscribers using live WhatsApp connectivity must strictly adhere to the official <strong>Meta WhatsApp Business Messaging Policy</strong> and <strong>Commerce Policy</strong>. Specifically:
              </p>
              <ul className="list-disc pl-5 mt-2 space-y-1 text-slate-600">
                <li>You must obtain clear, affirmative opt-in consent from individuals before sending promotional template broadcasts.</li>
                <li>You must honor immediate opt-out keywords (such as STOP, UNSUBSCRIBE) without delay or penalty.</li>
                <li>Relay reserves the right to immediately suspend any campaign that generates excessive user blocks or quality rating downgrades on Meta.</li>
              </ul>
            </section>

            <section id="prohibited-activities" className="mb-10">
              <h2 className="text-lg font-bold text-slate-900 pb-2 border-b border-slate-100">
                4. Strictly Prohibited Activities
              </h2>
              <div className="mt-3 bg-red-50 p-4 rounded-xl border border-red-200 text-xs text-red-900">
                <strong className="block font-bold mb-1">Zero Tolerance Violations:</strong>
                Subscribers may not use Relay for unsolicited spam, purchasing third-party scraped phone directories, transmission of malware, fraudulent investment promotions, unlawful gaming, or any activity that violates applicable consumer protection and telecom laws.
              </div>
            </section>

            <section id="billing-arrangements" className="mb-10">
              <h2 className="text-lg font-bold text-slate-900 pb-2 border-b border-slate-100">
                5. Relay Subscriptions & Independent Meta Billing
              </h2>
              <p className="mt-3 text-slate-600">
                Our pricing model distinguishes software platform licensing from telecommunication fees:
              </p>
              <ul className="list-disc pl-5 mt-2 space-y-1 text-slate-600">
                <li><strong>Relay Subscription Fee:</strong> Flat periodic fee for software access, multi-tenant workspace provisioning, and automation compute.</li>
                <li><strong>Meta WhatsApp Conversation Charges:</strong> Billed directly by Meta Platforms, Inc. to your connected payment card. Relay is not responsible for Meta tariff changes or failed payments on your Meta account.</li>
              </ul>
            </section>

            <section id="mock-mode" className="mb-10">
              <h2 className="text-lg font-bold text-slate-900 pb-2 border-b border-slate-100">
                6. Mock Mode Simulation Environment
              </h2>
              <p className="mt-3 text-slate-600">
                Relay provides a simulated offline Mock Mode to enable risk-free training and template validation. Messages simulated in Mock Mode are purely virtual and do not dispatch to cellular networks or generate Meta charges.
              </p>
            </section>

            <section id="workspace-security" className="mb-10">
              <h2 className="text-lg font-bold text-slate-900 pb-2 border-b border-slate-100">
                7. Account Security & Workspace Administration
              </h2>
              <p className="mt-3 text-slate-600">
                Each subscribing organization is responsible for maintaining secure passwords, restricting authorized team member access, and promptly revoking credentials of departing staff.
              </p>
            </section>

            <section id="intellectual-property" className="mb-10">
              <h2 className="text-lg font-bold text-slate-900 pb-2 border-b border-slate-100">
                8. Intellectual Property & License Grant
              </h2>
              <p className="mt-3 text-slate-600">
                Subscribers retain 100% ownership of all uploaded contact lists, brochure PDFs, and business text. Relay retains all rights, title, and interest in its proprietary software architecture, design tokens, and automation engines.
              </p>
            </section>

            <section id="limitation-liability" className="mb-10">
              <h2 className="text-lg font-bold text-slate-900 pb-2 border-b border-slate-100">
                9. Limitation of Liability & Warranties
              </h2>
              <p className="mt-3 text-slate-600">
                To the maximum extent permitted by applicable law, Relay is provided on an "as-is" and "as-available" basis without warranties of uninterrupted uptime or guaranteed message delivery rates, which depend on Meta's underlying infrastructure and telecommunication network conditions.
              </p>
            </section>

            <section id="termination" className="mb-10">
              <h2 className="text-lg font-bold text-slate-900 pb-2 border-b border-slate-100">
                10. Cancellation & Suspension of Service
              </h2>
              <p className="mt-3 text-slate-600">
                You may cancel your monthly subscription at any time through workspace settings. Relay reserves the right to suspend or terminate accounts that breach WhatsApp policies, fail authentication verification, or generate unresolved spam disputes.
              </p>
            </section>

            <section id="governing-law" className="mb-6">
              <h2 className="text-lg font-bold text-slate-900 pb-2 border-b border-slate-100">
                11. Governing Law & Dispute Resolution
              </h2>
              <p className="mt-3 text-slate-600">
                These terms shall be governed by the laws of India, subject to the exclusive jurisdiction of the competent courts of New Delhi, India.
              </p>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
