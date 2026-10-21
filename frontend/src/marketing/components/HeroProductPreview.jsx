import React, { useState } from 'react';
import {
  Send,
  MessageSquare,
  Users,
  BarChart3,
  FileText,
  CheckCircle2,
  Clock,
  Sparkles,
  Phone,
  ShieldCheck,
  ChevronRight,
  UserCheck,
  FileCode,
} from 'lucide-react';

export default function HeroProductPreview() {
  const [activeTab, setActiveTab] = useState('campaigns');

  return (
    <div className="w-full bg-white rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden ring-1 ring-black/5">
      {/* Top Application Window Bar */}
      <div className="bg-slate-900 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-rose-500/80" />
          <div className="w-3 h-3 rounded-full bg-amber-500/80" />
          <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
          <span className="ml-2 text-xs font-mono text-slate-400 font-medium hidden sm:inline">
            relay-workspace.internal / m2w-realty
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-teal-500/20 text-teal-300 border border-teal-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" /> Mock Sandbox Mode
          </span>
        </div>
      </div>

      {/* Workspace Secondary Tabs */}
      <div className="bg-slate-100/80 px-4 py-2 border-b border-slate-200 flex items-center gap-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('campaigns')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'campaigns'
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <Send className="w-3.5 h-3.5 text-teal-600" />
          <span>Campaign Broadcast</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('inbox')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'inbox'
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5 text-teal-600" />
          <span>Conversational Inbox</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('templates')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'templates'
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <FileText className="w-3.5 h-3.5 text-teal-600" />
          <span>Template Studio</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('analytics')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'analytics'
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5 text-teal-600" />
          <span>Reports & Analytics</span>
        </button>
      </div>

      {/* Interactive Screen Content */}
      <div className="p-4 sm:p-6 bg-slate-50 min-h-[380px]">
        {activeTab === 'campaigns' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-slate-900 text-sm">Luxury Golf Course Villas Preview</h4>
                  <span className="bg-emerald-50 text-emerald-700 font-semibold text-[10px] px-2 py-0.5 rounded-full border border-emerald-200">
                    Completed
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">Target: Verified NRI & Luxury Prospects (60 recipients)</p>
              </div>
              <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
                <div>
                  <span className="block text-slate-400 text-[10px] uppercase">Sent</span>
                  <span className="font-bold text-slate-900">60 / 60</span>
                </div>
                <div>
                  <span className="block text-slate-400 text-[10px] uppercase">Delivered</span>
                  <span className="font-bold text-teal-600">100%</span>
                </div>
                <div>
                  <span className="block text-slate-400 text-[10px] uppercase">Read Rate</span>
                  <span className="font-bold text-indigo-600">83.3%</span>
                </div>
              </div>
            </div>

            {/* Simulated WhatsApp Phone Frame */}
            <div className="max-w-md mx-auto bg-[#ECE5DD] p-3 rounded-2xl border-4 border-slate-800 shadow-lg">
              <div className="bg-[#075E54] text-white p-2.5 rounded-t-xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs">
                    M2W
                  </div>
                  <div>
                    <p className="text-xs font-bold leading-none">M2W Luxury Realty</p>
                    <p className="text-[10px] text-teal-200 mt-0.5">Official WhatsApp Business</p>
                  </div>
                </div>
                <ShieldCheck className="w-4 h-4 text-teal-300" />
              </div>

              <div className="bg-white p-3 rounded-b-xl shadow-sm my-2 text-xs text-slate-800 space-y-2 border border-slate-200">
                <div className="bg-slate-100 p-2 rounded-lg text-[11px] text-slate-700 flex items-center gap-2 border border-slate-200">
                  <FileText className="w-4 h-4 text-rose-500 shrink-0" />
                  <span className="font-medium truncate">Emerald_Bay_VIP_Brochure.pdf</span>
                </div>
                <p className="leading-relaxed">
                  Hi <span className="font-semibold text-teal-700">Vikram Malhotra</span>, thank you for enquiring about our 4BHK Golf Course residences. We have attached the architectural plans and payment schedule.
                </p>
                <div className="pt-2 border-t border-slate-100 flex flex-col gap-1.5">
                  <button className="w-full py-1.5 bg-slate-50 hover:bg-slate-100 text-teal-700 font-semibold rounded text-[11px] border border-slate-200 flex items-center justify-center gap-1">
                    <span>Download Brochure</span>
                  </button>
                  <button className="w-full py-1.5 bg-slate-50 hover:bg-slate-100 text-teal-700 font-semibold rounded text-[11px] border border-slate-200 flex items-center justify-center gap-1">
                    <span>Book Site Visit</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'inbox' && (
          <div className="space-y-3 animate-in fade-in duration-200">
            <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="font-bold text-slate-800">Chat with Sunita Deshmukh (+91 98101 23456)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500">Auto-Reply:</span>
                <span className="bg-teal-50 text-teal-700 font-bold px-2 py-0.5 rounded text-[10px] border border-teal-200">
                  RULE MATCHED: BROCHURE
                </span>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 max-w-lg mx-auto text-xs shadow-sm">
              <div className="flex justify-start">
                <div className="bg-slate-100 text-slate-800 p-3 rounded-2xl rounded-tl-sm max-w-[80%] border border-slate-200">
                  <p>Can you send me the price sheet and brochure for the 3BHK penthouse?</p>
                  <span className="text-[9px] text-slate-400 mt-1 block">10:42 AM</span>
                </div>
              </div>

              <div className="flex justify-end">
                <div className="bg-teal-50 text-teal-950 p-3 rounded-2xl rounded-tr-sm max-w-[80%] border border-teal-200 shadow-sm">
                  <span className="text-[9px] font-bold text-teal-700 uppercase tracking-wider block mb-1">
                    Relay Auto-Reply Bot
                  </span>
                  <p>Here is the complete pricing sheet for the 3BHK penthouse starting at ₹2.45 Cr. Let us know if you would like a private consultation with our advisor.</p>
                  <span className="text-[9px] text-teal-600 mt-1 block text-right">10:42 AM · Instant</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between text-xs max-w-lg mx-auto">
              <span className="text-slate-600 font-medium">Operator Takeover Control</span>
              <button className="bg-slate-900 text-white font-semibold px-3 py-1.5 rounded-lg text-xs hover:bg-slate-800 transition-colors">
                Take Over Chat
              </button>
            </div>
          </div>
        )}

        {activeTab === 'templates' && (
          <div className="space-y-4 animate-in fade-in duration-200 max-w-xl mx-auto">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-bold text-slate-900">Template Editor: luxury_site_visit_v2</span>
                <span className="bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded text-[10px] border border-emerald-200">
                  Meta Format Validated
                </span>
              </div>

              <div className="space-y-2">
                <label className="font-semibold text-slate-700 block">Personalized Body Text:</label>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 font-mono text-[11px] text-slate-800 leading-relaxed">
                  Hi {'{{1}}'}, your guided site visit for {'{{2}}'} is confirmed for {'{{3}}'}. Our senior property specialist will welcome you at the club lounge.
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1 text-[11px]">
                <div className="bg-teal-50/60 p-2 rounded border border-teal-100">
                  <span className="text-slate-500 block text-[9px] uppercase font-bold">Variable 1</span>
                  <span className="font-semibold text-teal-800 truncate block">Contact Full Name</span>
                </div>
                <div className="bg-teal-50/60 p-2 rounded border border-teal-100">
                  <span className="text-slate-500 block text-[9px] uppercase font-bold">Variable 2</span>
                  <span className="font-semibold text-teal-800 truncate block">Interested Project</span>
                </div>
                <div className="bg-teal-50/60 p-2 rounded border border-teal-100">
                  <span className="text-slate-500 block text-[9px] uppercase font-bold">Variable 3</span>
                  <span className="font-semibold text-teal-800 truncate block">Visit Time Slot</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-xs font-medium text-slate-500 block">Total Contacts</span>
                <span className="text-xl font-bold text-slate-900 mt-1 block">1,112</span>
                <span className="text-[10px] text-emerald-600 font-semibold mt-1 block">↑ 100% verified</span>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-xs font-medium text-slate-500 block">Delivery Rate</span>
                <span className="text-xl font-bold text-teal-600 mt-1 block">99.4%</span>
                <span className="text-[10px] text-slate-400 font-semibold mt-1 block">0 bounce errors</span>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-xs font-medium text-slate-500 block">Auto-Reply Matches</span>
                <span className="text-xl font-bold text-indigo-600 mt-1 block">165</span>
                <span className="text-[10px] text-indigo-500 font-semibold mt-1 block">Instant response</span>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-xs font-medium text-slate-500 block">Consent Opt-outs</span>
                <span className="text-xl font-bold text-slate-900 mt-1 block">0</span>
                <span className="text-[10px] text-emerald-600 font-semibold mt-1 block">100% compliant</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Audited against 34 tenant data collections with strict zero-leakage isolation.</span>
              </div>
              <span className="font-semibold text-teal-700 hidden sm:inline">Export CSV / Excel Available</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
