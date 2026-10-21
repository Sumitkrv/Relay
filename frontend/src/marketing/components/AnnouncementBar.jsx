import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';

export default function AnnouncementBar() {
  return (
    <div className="bg-slate-900 text-slate-100 text-xs py-2 px-4 border-b border-slate-800">
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 text-center flex-wrap">
        <span className="inline-flex items-center gap-1 bg-teal-500/20 text-teal-300 font-semibold px-2 py-0.5 rounded-full border border-teal-500/30">
          <Sparkles className="w-3 h-3 text-teal-300" /> Early Access
        </span>
        <span className="text-slate-300">
          Experience Relay multi-industry WhatsApp automation with offline mock simulation.
        </span>
        <Link
          to="/signup"
          className="inline-flex items-center gap-1 font-medium text-teal-400 hover:text-teal-300 transition-colors ml-1 underline underline-offset-2"
        >
          Explore Early Access <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}
