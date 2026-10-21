import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, Lock, FileText, CheckCircle2, AlertCircle, Mail, ArrowRight } from 'lucide-react';

export default function PrivacyPage() {
  const lastUpdated = 'October 20, 2026';
  const effectiveDate = 'October 20, 2026';

  const sections = [
    { id: 'introduction', title: '1. Introduction & Operator Scope' },
    { id: 'data-collected', title: '2. Information We Collect' },
    { id: 'multi-tenant', title: '3. Multi-Tenant Architecture & Data Isolation' },
    { id: 'whatsapp-meta', title: '4. WhatsApp & Meta Cloud API Processing' },
    { id: 'opt-out-consent', title: '5. Customer Consent & STOP Keyword Opt-Out' },
    { id: 'data-retention', title: '6. Data Retention & Workspace Purges' },
    { id: 'cookies-analytics', title: '7. Cookies & Session Storage' },
    { id: 'user-rights', title: '8. Business & Individual Rights' },
    { id: 'contact', title: '9. Privacy Inquiries & Data Protection Contact' },
  ];

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Header */}
      <section className="bg-slate-900 text-white pt-16 pb-20 border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-900/60 border border-teal-500/30 text-teal-300 text-xs font-semibold uppercase tracking-wider mb-4">
            <Shield className="w-3.5 h-3.5" />
            <span>Transparency & Compliance</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white mb-4">
            Privacy Policy
          </h1>

          <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto">
            This document sets out how Relay collects, stores, processes, and protects business information and customer conversation data.
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
                Contents
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
                <strong className="block font-bold">Pre-Launch Operator Disclosure</strong>
                This draft Privacy Policy reflects the operational and technical security design of Relay SaaS. Final legally binding operating entity details and statutory jurisdiction will be completed by the business operator prior to public commercial onboarding.
              </div>
            </div>

            <section id="introduction" className="mb-10">
              <h2 className="text-lg font-bold text-slate-900 pb-2 border-b border-slate-100">
                1. Introduction & Operator Scope
              </h2>
              <p className="mt-3 text-slate-600">
                Relay ("we", "our", or "us") provides a software-as-a-service platform that enables businesses to manage contact databases, configure WhatsApp message templates, launch permitted broadcasts, and conduct customer follow-up conversations.
              </p>
              <p className="mt-2 text-slate-600">
                For the purposes of applicable data protection laws, the subscribing business acts as the <strong>Data Controller</strong> with respect to the customer records imported and messages sent. Relay acts as a <strong>Data Processor</strong> providing multi-tenant software infrastructure to execute campaigns and store conversational histories on behalf of the subscriber.
              </p>
            </section>

            <section id="data-collected" className="mb-10">
              <h2 className="text-lg font-bold text-slate-900 pb-2 border-b border-slate-100">
                2. Information We Collect
              </h2>
              <p className="mt-3 text-slate-600">
                Depending on your interaction with Relay, we collect the following categories of data:
              </p>
              <ul className="list-disc pl-5 mt-2 space-y-1 text-slate-600">
                <li>
                  <strong>Subscriber Account Data:</strong> Business owner name, business email address, company legal name, hashed authentication passwords, and assigned workspace role.
                </li>
                <li>
                  <strong>Customer Contact Data:</strong> Phone numbers, customer names, dynamic variables (e.g. project name, renewal dates), tags, and segment groupings imported by the subscriber via CSV/Excel or API.
                </li>
                <li>
                  <strong>Message Content & Delivery Metadata:</strong> Template variables, outbound broadcasts, inbound customer responses, delivery receipts (Sent, Delivered, Read), and timestamps.
                </li>
                <li>
                  <strong>Public Inquiries:</strong> Inquiries submitted via our public marketing forms, including business email, inquiry category, and optional phone numbers.
                </li>
              </ul>
            </section>

            <section id="multi-tenant" className="mb-10">
              <h2 className="text-lg font-bold text-slate-900 pb-2 border-b border-slate-100">
                3. Multi-Tenant Architecture & Data Isolation
              </h2>
              <p className="mt-3 text-slate-600">
                Relay is engineered with strict logical data isolation contracts. Every database query, contact import, template retrieval, and campaign operation is scoped strictly by a unique <code className="bg-slate-100 px-1 py-0.5 rounded text-xs text-teal-700">workspaceId</code>.
              </p>
              <p className="mt-2 text-slate-600">
                Users authenticated in Workspace A have zero technical ability to access, query, search, or mutate records belonging to Workspace B. Cross-tenant leakage is strictly guarded at both the middleware routing layer and database schema query constraints.
              </p>
            </section>

            <section id="whatsapp-meta" className="mb-10">
              <h2 className="text-lg font-bold text-slate-900 pb-2 border-b border-slate-100">
                4. WhatsApp & Meta Cloud API Processing
              </h2>
              <p className="mt-3 text-slate-600">
                When live messaging is enabled, Relay transmits approved message payloads to Meta's official WhatsApp Business Platform API using encrypted HTTPS protocols.
              </p>
              <p className="mt-2 text-slate-600">
                Each subscriber connects their own authorized WhatsApp Business Account (WABA). Customer conversation data passes through Meta infrastructure in accordance with Meta's terms and privacy policies. Relay does not sell, rent, or monetize message content or customer contact lists.
              </p>
            </section>

            <section id="opt-out-consent" className="mb-10">
              <h2 className="text-lg font-bold text-slate-900 pb-2 border-b border-slate-100">
                5. Customer Consent & STOP Keyword Opt-Out
              </h2>
              <p className="mt-3 text-slate-600">
                Subscribers are required by law and Meta policies to obtain valid opt-in consent from individuals before initiating marketing template broadcasts.
              </p>
              <p className="mt-2 text-slate-600">
                Relay provides built-in suppression mechanics: when a recipient replies with universal opt-out keywords (such as <strong>STOP</strong>, <strong>UNSUBSCRIBE</strong>, or <strong>OPTOUT</strong>), our automation engine flags the contact as opted-out and halts automated campaign broadcasts to that number.
              </p>
            </section>

            <section id="data-retention" className="mb-10">
              <h2 className="text-lg font-bold text-slate-900 pb-2 border-b border-slate-100">
                6. Data Retention & Workspace Purges
              </h2>
              <p className="mt-3 text-slate-600">
                We retain subscriber data for the duration of the active subscription. If a workspace is terminated, data is retained for a standard 30-day grace period to facilitate data export, after which contact records and campaign histories can be permanently purged upon written request by the workspace owner.
              </p>
            </section>

            <section id="cookies-analytics" className="mb-10">
              <h2 className="text-lg font-bold text-slate-900 pb-2 border-b border-slate-100">
                7. Cookies & Session Storage
              </h2>
              <p className="mt-3 text-slate-600">
                Relay uses strictly necessary cookies and local storage tokens (<code className="bg-slate-100 px-1 py-0.5 rounded text-xs text-teal-700">relay_auth_token</code> and <code className="bg-slate-100 px-1 py-0.5 rounded text-xs text-teal-700">relay_active_workspace_id</code>) exclusively for authentication state and tenant session management. We do not use third-party behavioral advertising cookies.
              </p>
            </section>

            <section id="user-rights" className="mb-10">
              <h2 className="text-lg font-bold text-slate-900 pb-2 border-b border-slate-100">
                8. Business & Individual Rights
              </h2>
              <p className="mt-3 text-slate-600">
                Subscribers and data subjects maintain rights to request access, corrections, or deletion of their personal records. Individual recipients seeking to remove their records from a specific business's Relay campaign should text "STOP" to the business's WhatsApp number or contact the business directly.
              </p>
            </section>

            <section id="contact" className="mb-6">
              <h2 className="text-lg font-bold text-slate-900 pb-2 border-b border-slate-100">
                9. Privacy Inquiries & Data Protection Contact
              </h2>
              <p className="mt-3 text-slate-600">
                If you have questions regarding this Privacy Policy or wish to exercise data rights, please contact our Data Protection desk:
              </p>
              <div className="mt-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-slate-700">
                <p><strong>Relay Data Privacy Operations</strong></p>
                <p className="mt-1">Email: privacy@relayautomation.io</p>
                <p>Support Hours: Mon – Fri (9:30 AM – 6:30 PM IST)</p>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
