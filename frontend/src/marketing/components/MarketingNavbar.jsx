import React, { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  Menu,
  X,
  ChevronDown,
  Building2,
  Dumbbell,
  Stethoscope,
  GraduationCap,
  Sparkles,
  Car,
  Layers,
  ArrowRight,
  MessageSquare,
  Shield,
  Layers as LayersIcon,
  CheckCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { INDUSTRIES } from '../data/industryData';

export default function MarketingNavbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [industriesOpen, setIndustriesOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const { user } = useAuth();
  const location = useLocation();

  const industriesRef = useRef(null);
  const productRef = useRef(null);

  // Close menus on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setIndustriesOpen(false);
    setProductOpen(false);
  }, [location.pathname]);

  // Outside click & Escape key handler
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setIndustriesOpen(false);
        setProductOpen(false);
        setMobileMenuOpen(false);
      }
    }

    function handleClickOutside(e) {
      if (industriesRef.current && !industriesRef.current.contains(e.target)) {
        setIndustriesOpen(false);
      }
      if (productRef.current && !productRef.current.contains(e.target)) {
        setProductOpen(false);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const getIndustryIcon = (slug) => {
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

  const navLinkClass = ({ isActive }) =>
    `px-3 py-2 text-sm font-medium rounded-md transition-colors ${
      isActive
        ? 'text-teal-600 bg-teal-50 font-semibold'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
    }`;

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center text-teal-400 group-hover:bg-slate-800 transition-colors shadow-sm">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-bold tracking-tight text-slate-900">
                  RELAY<span className="text-teal-600">.</span>
                </span>
                <span className="text-[10px] tracking-wider uppercase font-semibold text-slate-500 -mt-1">
                  WhatsApp SaaS
                </span>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden lg:flex items-center space-x-1" aria-label="Main Navigation">
              {/* Product Dropdown */}
              <div className="relative" ref={productRef}>
                <button
                  type="button"
                  onClick={() => {
                    setProductOpen(!productOpen);
                    setIndustriesOpen(false);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    productOpen || location.pathname.startsWith('/features')
                      ? 'text-teal-600 bg-teal-50 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                  aria-expanded={productOpen}
                >
                  <span>Product</span>
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${productOpen ? 'rotate-180 text-teal-600' : 'text-slate-400'}`} />
                </button>

                {productOpen && (
                  <div className="absolute left-0 mt-2 w-80 rounded-xl bg-white shadow-xl ring-1 ring-black/5 border border-slate-100 p-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="px-3 py-2 border-b border-slate-100 mb-1">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Relay Modules</p>
                    </div>
                    <Link
                      to="/features#contacts"
                      className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors group"
                    >
                      <div className="p-2 rounded-md bg-teal-50 text-teal-600 group-hover:bg-teal-600 group-hover:text-white transition-colors">
                        <LayersIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Contacts & Segments</p>
                        <p className="text-xs text-slate-500">10k Excel imports & smart dynamic tags</p>
                      </div>
                    </Link>
                    <Link
                      to="/features#templates"
                      className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors group"
                    >
                      <div className="p-2 rounded-md bg-teal-50 text-teal-600 group-hover:bg-teal-600 group-hover:text-white transition-colors">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Template Studio</p>
                        <p className="text-xs text-slate-500">Brochure PDFs & interactive buttons</p>
                      </div>
                    </Link>
                    <Link
                      to="/features#campaigns"
                      className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors group"
                    >
                      <div className="p-2 rounded-md bg-teal-50 text-teal-600 group-hover:bg-teal-600 group-hover:text-white transition-colors">
                        <CheckCircle className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Targeted Broadcasts</p>
                        <p className="text-xs text-slate-500">Scheduled campaigns & audience preview</p>
                      </div>
                    </Link>
                    <Link
                      to="/features#inbox"
                      className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors group"
                    >
                      <div className="p-2 rounded-md bg-teal-50 text-teal-600 group-hover:bg-teal-600 group-hover:text-white transition-colors">
                        <MessageSquare className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Conversational Inbox</p>
                        <p className="text-xs text-slate-500">Keyword auto-reply & manual operator takeover</p>
                      </div>
                    </Link>
                    <div className="pt-2 border-t border-slate-100 mt-1">
                      <Link
                        to="/features"
                        className="flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-teal-600 hover:text-teal-700"
                      >
                        <span>View All Features</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* Industries Mega Dropdown */}
              <div className="relative" ref={industriesRef}>
                <button
                  type="button"
                  onClick={() => {
                    setIndustriesOpen(!industriesOpen);
                    setProductOpen(false);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    industriesOpen || location.pathname.startsWith('/industries')
                      ? 'text-teal-600 bg-teal-50 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                  aria-expanded={industriesOpen}
                >
                  <span>Industries</span>
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${industriesOpen ? 'rotate-180 text-teal-600' : 'text-slate-400'}`} />
                </button>

                {industriesOpen && (
                  <div className="absolute left-0 mt-2 w-[520px] rounded-xl bg-white shadow-xl ring-1 ring-black/5 border border-slate-100 p-4 z-50 animate-in fade-in slide-in-from-top-1 duration-150 grid grid-cols-2 gap-2">
                    <div className="col-span-2 px-2 pb-2 border-b border-slate-100 flex items-center justify-between">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tailored Workspaces</p>
                      <Link to="/industries" className="text-xs font-semibold text-teal-600 hover:text-teal-700">
                        View All (7)
                      </Link>
                    </div>
                    {INDUSTRIES.map((ind) => {
                      const IconComponent = getIndustryIcon(ind.slug);
                      return (
                        <Link
                          key={ind.slug}
                          to={`/industries/${ind.slug}`}
                          className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors group"
                        >
                          <div className="p-2 rounded-md bg-slate-100 text-slate-700 group-hover:bg-teal-50 group-hover:text-teal-600 transition-colors shrink-0">
                            <IconComponent className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-semibold text-slate-900 group-hover:text-teal-700 transition-colors">
                                {ind.name}
                              </span>
                              {ind.badge === 'Flagship Industry' && (
                                <span className="bg-teal-100 text-teal-800 text-[10px] font-bold px-1.5 py-0.2 rounded">M2W</span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 line-clamp-1">{ind.tagline}</p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>

              <NavLink to="/how-it-works" className={navLinkClass}>
                How It Works
              </NavLink>
              <NavLink to="/pricing" className={navLinkClass}>
                Pricing
              </NavLink>
              <NavLink to="/faq" className={navLinkClass}>
                FAQ
              </NavLink>
              <NavLink to="/contact" className={navLinkClass}>
                Contact
              </NavLink>
            </nav>
          </div>

          {/* Desktop Right CTA Section */}
          <div className="hidden lg:flex items-center gap-3">
            {user ? (
              <Link
                to="/app"
                className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm px-4 py-2 rounded-lg shadow-sm transition-all hover:shadow"
              >
                <span>Go to Dashboard</span>
                <ArrowRight className="w-4 h-4 text-teal-400" />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm font-medium text-slate-700 hover:text-slate-900 px-3 py-2 rounded-md hover:bg-slate-100 transition-colors"
                >
                  Log In
                </Link>
                <Link
                  to="/signup"
                  className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm px-4 py-2 rounded-lg shadow-sm hover:shadow transition-all"
                >
                  <span>Get Early Access</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </>
            )}
          </div>

          {/* Mobile Hamburger Button */}
          <div className="flex lg:hidden items-center">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Panel */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 pt-2 pb-6 space-y-3 shadow-2xl animate-in slide-in-from-top-2 duration-150">
          <div className="space-y-1">
            <Link
              to="/features"
              className="block px-3 py-2 rounded-md text-base font-medium text-slate-800 hover:bg-slate-50"
            >
              Features & Platform
            </Link>
            <Link
              to="/industries"
              className="block px-3 py-2 rounded-md text-base font-medium text-slate-800 hover:bg-slate-50"
            >
              Supported Industries (7)
            </Link>
            <div className="pl-4 py-1 space-y-1 border-l-2 border-slate-100 my-1">
              {INDUSTRIES.map((ind) => (
                <Link
                  key={ind.slug}
                  to={`/industries/${ind.slug}`}
                  className="block px-2 py-1 text-sm text-slate-600 hover:text-teal-700"
                >
                  {ind.name}
                </Link>
              ))}
            </div>
            <Link
              to="/how-it-works"
              className="block px-3 py-2 rounded-md text-base font-medium text-slate-800 hover:bg-slate-50"
            >
              How It Works
            </Link>
            <Link
              to="/pricing"
              className="block px-3 py-2 rounded-md text-base font-medium text-slate-800 hover:bg-slate-50"
            >
              Pricing
            </Link>
            <Link
              to="/faq"
              className="block px-3 py-2 rounded-md text-base font-medium text-slate-800 hover:bg-slate-50"
            >
              FAQ
            </Link>
            <Link
              to="/contact"
              className="block px-3 py-2 rounded-md text-base font-medium text-slate-800 hover:bg-slate-50"
            >
              Contact & Early Access
            </Link>
          </div>

          <div className="pt-4 border-t border-slate-100 flex flex-col gap-2">
            {user ? (
              <Link
                to="/app"
                className="w-full text-center py-2.5 px-4 rounded-lg bg-slate-900 text-white font-medium text-sm shadow-sm"
              >
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="w-full text-center py-2.5 px-4 rounded-lg border border-slate-300 text-slate-800 font-medium text-sm hover:bg-slate-50"
                >
                  Log In
                </Link>
                <Link
                  to="/signup"
                  className="w-full text-center py-2.5 px-4 rounded-lg bg-teal-600 text-white font-semibold text-sm hover:bg-teal-700"
                >
                  Get Early Access
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
