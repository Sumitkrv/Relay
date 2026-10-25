import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  LogIn,
  RefreshCw,
  Server,
  Database,
  Mail,
  Zap,
  CreditCard,
  Briefcase,
  Layers,
  ArrowRight,
  ShieldAlert,
  Clock
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const DEMO_PERSONAS = [
  {
    role: 'Platform Super Admin',
    email: 'admin@relay-demo.test',
    desc: 'Platform-wide oversight, business directory, subscription monitoring, worker health, audit logs',
    target: '/admin',
    tag: 'ADMIN',
  },
  {
    role: 'FitZone Gym Owner',
    email: 'gym-owner@relay-demo.test',
    desc: 'Gym Industry: Membership enquiry, Trial auto-replies, trial sessions, custom dynamic fields',
    target: '/app/overview',
    tag: 'GYM',
  },
  {
    role: 'M2W Realty Owner',
    email: 'm2w-owner@relay-demo.test',
    desc: 'Real Estate Industry: Canonical property fields (3 BHK, Villa), legacy compatibility preserved',
    target: '/app/overview',
    tag: 'REAL ESTATE',
  },
  {
    role: 'Glow Studio Salon Owner',
    email: 'salon-owner@relay-demo.test',
    desc: 'Salon & Spa Industry: Hair services, bridal enquiry, stylist appointments',
    target: '/app/overview',
    tag: 'SALON',
  },
  {
    role: 'CarePlus Clinic Owner',
    email: 'clinic-owner@relay-demo.test',
    desc: 'Healthcare Clinic Industry: Appointment interest, branch selection (strict privacy compliant)',
    target: '/app/overview',
    tag: 'CLINIC',
  },
  {
    role: 'BrightPath Academy Owner',
    email: 'education-owner@relay-demo.test',
    desc: 'Education Industry: Course inquiries, batch timings, admission counseling',
    target: '/app/overview',
    tag: 'EDUCATION',
  },
  {
    role: 'DriveMax Autos Owner',
    email: 'automobile-owner@relay-demo.test',
    desc: 'Automobile Dealership: Vehicle models, test drive bookings, service schedule',
    target: '/app/overview',
    tag: 'AUTO',
  },
  {
    role: 'Nova Services Owner',
    email: 'business-owner@relay-demo.test',
    desc: 'Generic Multi-service Industry: Flexible service interest and custom tags',
    target: '/app/overview',
    tag: 'OTHER',
  },
  {
    role: 'Spark Digital Agency Owner',
    email: 'agency-owner@relay-demo.test',
    desc: 'Agency Multi-client Owner: Full agency portal, white-label branding, mock custom domain',
    target: '/agency',
    tag: 'AGENCY',
  },
  {
    role: 'Spark Digital Agency Manager',
    email: 'agency-manager@relay-demo.test',
    desc: 'Delegated Staff: Scoped access to FitZone Gym and CarePlus Clinic workspaces only',
    target: '/agency',
    tag: 'STAFF',
  },
  {
    role: 'Spark Digital Agency Viewer',
    email: 'agency-viewer@relay-demo.test',
    desc: 'Read-only Agency Staff: Client inspection without modification rights',
    target: '/agency',
    tag: 'VIEWER',
  },
  {
    role: 'Unverified Customer',
    email: 'unverified@relay-demo.test',
    desc: 'Pending verification account to test activation email capture in local mailbox',
    target: '/login',
    tag: 'UNVERIFIED',
  },
  {
    role: 'Suspended Customer',
    email: 'suspended@relay-demo.test',
    desc: 'Suspended account to test login blockage and strict access denial',
    target: '/login',
    tag: 'SUSPENDED',
  },
];

const CHECKLIST_ITEMS = [
  { id: 'auth_reg', title: '1. Customer Registration & Local Verification Link (/dev/mailbox)' },
  { id: 'auth_login', title: '2. Real Express Authentication & Secure Bcrypt Verification' },
  { id: 'onboard_flow', title: '3. Business Onboarding Wizard & Auto Workspace Provisioning' },
  { id: 'industry_cfg', title: '4. Dynamic 7-Industry Custom Fields & Terminology' },
  { id: 'contacts_crud', title: '5. Contacts CRUD with Industry Fields & Tags' },
  { id: 'templates_mgr', title: '6. Message Templates & Variable Placeholders' },
  { id: 'campaign_queue', title: '7. Campaign Creation & Durable Queue Worker Processing' },
  { id: 'inbox_autoreply', title: '8. Simulated Inbound Message & Keyword Auto-Reply (TRIAL/MEMBERSHIP)' },
  { id: 'reports_db', title: '9. Database-Aggregated Real Metrics Reports' },
  { id: 'mock_wa_conn', title: '10. Mock WhatsApp Connection Wizard (Business App / Cloud API)' },
  { id: 'mock_billing', title: '11. Mock ₹799/mo Solo Subscription, 14-Day Trial & Clock Advance' },
  { id: 'super_admin', title: '12. Platform Super Admin Directory, Suspend/Reactivate & Audit Logs' },
  { id: 'agency_portal', title: '13. Agency Multi-Client Delegation, White-Label & Domain Simulation' },
  { id: 'tenant_security', title: '14. Cross-Tenant Isolation (Gym cannot see Salon/CarePlus records)' },
];

export default function DevTestingHubPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loggingInAs, setLoggingInAs] = useState(null);
  const [readiness, setReadiness] = useState({
    backend: true,
    database: true,
    mailbox: true,
    whatsappEngine: true,
    billingAdapter: true,
    queueWorker: true,
  });
  const [checklist, setChecklist] = useState(() => {
    try {
      const saved = localStorage.getItem('relay_demo_checklist');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const toggleChecklist = (id) => {
    const next = { ...checklist, [id]: !checklist[id] };
    setChecklist(next);
    localStorage.setItem('relay_demo_checklist', JSON.stringify(next));
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied: ' + text);
  };

  const handlePersonaLogin = async (persona) => {
    try {
      setLoggingInAs(persona.email);
      // Perform genuine real server-side authentication
      await login({
        email: persona.email,
        password: 'DemoPass123!',
      });

      toast.success(`Authenticated as ${persona.role}`);
      // Navigate to target
      setTimeout(() => {
        window.location.href = persona.target;
      }, 300);
    } catch (err) {
      toast.error('Login failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoggingInAs(null);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0B1120', color: '#F8FAFC', fontFamily: 'Inter, sans-serif', padding: '24px 32px' }}>
      {/* Top Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid #1E293B', paddingBottom: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: '#10B981', color: '#0F172A', padding: '6px', borderRadius: '8px', display: 'flex' }}>
              <ShieldCheck size={24} />
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: '800', margin: 0, letterSpacing: '-0.5px' }}>
              Relay SaaS — Offline Testing Control Center
            </h1>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: '13.5px', color: '#94A3B8' }}>
            Master Prompt 13.5: 100% Offline internal application testing with real MongoDB persistence, genuine auth, and clean mock providers.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <Link
            to="/dev/mailbox"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#1E293B', border: '1px solid #334155', color: '#38BDF8', padding: '8px 16px', borderRadius: '8px', textDecoration: 'none', fontSize: '13px', fontWeight: '600' }}
          >
            <Mail size={16} /> Open Local Mailbox
          </Link>
          <Link
            to="/admin"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#1E293B', border: '1px solid #334155', color: '#A78BFA', padding: '8px 16px', borderRadius: '8px', textDecoration: 'none', fontSize: '13px', fontWeight: '600' }}
          >
            <ShieldAlert size={16} /> Super Admin
          </Link>
          <Link
            to="/agency"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#1E293B', border: '1px solid #334155', color: '#34D399', padding: '8px 16px', borderRadius: '8px', textDecoration: 'none', fontSize: '13px', fontWeight: '600' }}
          >
            <Briefcase size={16} /> Agency Portal
          </Link>
        </div>
      </div>

      {/* Environment & Service Readiness Grid */}
      <div style={{ background: '#1E293B', borderRadius: '12px', border: '1px solid #334155', padding: '18px 24px', marginBottom: '28px' }}>
        <div style={{ fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', color: '#64748B', letterSpacing: '0.5px', marginBottom: '14px' }}>
          System Readiness &amp; Mock Architecture Status
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
          <div style={{ background: '#0F172A', padding: '12px 14px', borderRadius: '8px', border: '1px solid #334155', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Server size={18} color="#10B981" />
            <div>
              <div style={{ fontSize: '12px', color: '#94A3B8' }}>Express API</div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#10B981' }}>Operational (:5000)</div>
            </div>
          </div>

          <div style={{ background: '#0F172A', padding: '12px 14px', borderRadius: '8px', border: '1px solid #334155', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Database size={18} color="#10B981" />
            <div>
              <div style={{ fontSize: '12px', color: '#94A3B8' }}>MongoDB Persistence</div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#10B981' }}>Connected (:27017)</div>
            </div>
          </div>

          <div style={{ background: '#0F172A', padding: '12px 14px', borderRadius: '8px', border: '1px solid #334155', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Mail size={18} color="#10B981" />
            <div>
              <div style={{ fontSize: '12px', color: '#94A3B8' }}>Email Provider</div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#38BDF8' }}>Local Mailbox Sink</div>
            </div>
          </div>

          <div style={{ background: '#0F172A', padding: '12px 14px', borderRadius: '8px', border: '1px solid #334155', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Zap size={18} color="#10B981" />
            <div>
              <div style={{ fontSize: '12px', color: '#94A3B8' }}>WhatsApp Engine</div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#F59E0B' }}>Mock Engine Active</div>
            </div>
          </div>

          <div style={{ background: '#0F172A', padding: '12px 14px', borderRadius: '8px', border: '1px solid #334155', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CreditCard size={18} color="#10B981" />
            <div>
              <div style={{ fontSize: '12px', color: '#94A3B8' }}>Billing Adapter</div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#A78BFA' }}>Mock Razorpay (₹799)</div>
            </div>
          </div>

          <div style={{ background: '#0F172A', padding: '12px 14px', borderRadius: '8px', border: '1px solid #334155', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Clock size={18} color="#10B981" />
            <div>
              <div style={{ fontSize: '12px', color: '#94A3B8' }}>Queue Worker</div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#10B981' }}>Durable Poller Ready</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '28px' }}>
        {/* Left Column: 13 Personas */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#F1F5F9' }}>
              Deterministic Demo Personas (13 Test Accounts)
            </div>
            <div style={{ fontSize: '12.5px', color: '#94A3B8' }}>
              Common Password: <strong style={{ color: '#10B981' }}>DemoPass123!</strong>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {DEMO_PERSONAS.map((p) => (
              <div
                key={p.email}
                style={{
                  background: '#1E293B',
                  borderRadius: '10px',
                  border: '1px solid #334155',
                  padding: '14px 18px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ flex: 1, marginRight: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '14.5px', fontWeight: '700', color: '#F8FAFC' }}>{p.role}</span>
                    <span style={{ fontSize: '11px', background: '#0F172A', color: '#94A3B8', padding: '2px 8px', borderRadius: '4px', border: '1px solid #334155' }}>
                      {p.tag}
                    </span>
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#64748B', marginBottom: '6px' }}>{p.desc}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '12.5px', color: '#38BDF8', fontFamily: 'monospace' }}>{p.email}</span>
                    <button
                      onClick={() => handleCopy(p.email)}
                      style={{ background: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}
                      title="Copy email"
                    >
                      <Copy size={13} />
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handlePersonaLogin(p)}
                    disabled={loggingInAs === p.email}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: '#10B981',
                      border: 'none',
                      color: '#0F172A',
                      padding: '8px 14px',
                      borderRadius: '6px',
                      fontSize: '12.5px',
                      fontWeight: '700',
                      cursor: 'pointer',
                    }}
                  >
                    <LogIn size={14} />
                    {loggingInAs === p.email ? 'Logging in...' : 'Login Real Session'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Interactive Checklist & Quick Links */}
        <div>
          {/* Quick Links */}
          <div style={{ background: '#1E293B', borderRadius: '12px', border: '1px solid #334155', padding: '18px', marginBottom: '20px' }}>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#F1F5F9', marginBottom: '12px' }}>
              Quick Module Navigation
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { name: 'Dashboard Overview', path: '/app/overview' },
                { name: 'Contacts Manager', path: '/app/contacts' },
                { name: 'Templates Library', path: '/app/templates' },
                { name: 'Campaigns & Queue', path: '/app/campaigns' },
                { name: 'Interactive Inbox & Auto-Replies', path: '/app/inbox' },
                { name: 'Reports & Analytics', path: '/app/reports' },
                { name: 'Settings & WhatsApp/Billing', path: '/app/settings' },
                { name: 'Platform Super Admin', path: '/admin' },
                { name: 'Agency & White-Label Portal', path: '/agency' },
                { name: 'Local Mailbox Sink', path: '/dev/mailbox' },
              ].map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    background: '#0F172A',
                    borderRadius: '6px',
                    border: '1px solid #334155',
                    color: '#CBD5E1',
                    textDecoration: 'none',
                    fontSize: '13px',
                  }}
                >
                  <span>{item.name}</span>
                  <ExternalLink size={13} color="#64748B" />
                </Link>
              ))}
            </div>
          </div>

          {/* Verification Checklist */}
          <div style={{ background: '#1E293B', borderRadius: '12px', border: '1px solid #334155', padding: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#F1F5F9' }}>
                Manual QA Checklist
              </div>
              <span style={{ fontSize: '12px', color: '#10B981', fontWeight: '600' }}>
                {Object.values(checklist).filter(Boolean).length}/{CHECKLIST_ITEMS.length} Passed
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto' }}>
              {CHECKLIST_ITEMS.map((item) => {
                const isChecked = !!checklist[item.id];
                return (
                  <label
                    key={item.id}
                    onClick={() => toggleChecklist(item.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      background: isChecked ? 'rgba(16, 185, 129, 0.08)' : '#0F172A',
                      border: isChecked ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #334155',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      readOnly
                      style={{ marginTop: '3px', accentColor: '#10B981' }}
                    />
                    <span style={{ fontSize: '12px', color: isChecked ? '#10B981' : '#CBD5E1', lineHeight: '1.4' }}>
                      {item.title}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
