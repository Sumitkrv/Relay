import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  Dumbbell,
  Stethoscope,
  Briefcase,
  GraduationCap,
  Scissors,
  Car,
  ShieldAlert,
  Layers,
  FileText,
  MessageSquare,
  Zap,
  Megaphone,
  Code2,
  Users,
  Eye,
  CheckCircle2,
  ArrowLeft,
  Info,
} from 'lucide-react';
import { getIndustryDetails, getIndustrySummaries } from '../services/industries';
import { resolveCrmVariables } from '../utils/crmVariables';

const INDUSTRY_ICONS = {
  real_estate: Building2,
  gym: Dumbbell,
  clinic: Stethoscope,
  other: Briefcase,
  education: GraduationCap,
  salon: Scissors,
  automobile: Car,
};

export default function IndustryPreviewPage() {
  const [selectedKey, setSelectedKey] = useState('');
  const [industries, setIndustries] = useState([]);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    getIndustrySummaries().then(items => { if (active) { setIndustries(items); setSelectedKey(key => key || items[0]?.key || ''); } }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [retry]);
  const [activeTab, setActiveTab] = useState('templates');
  const [industryConfig, setIndustryConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [previewContactIdx, setPreviewContactIdx] = useState(0);

  // Load selected industry config
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!selectedKey) return;
      setLoading(true);
      setError('');
      setIndustryConfig(null);
      try {
      const data = await getIndustryDetails(selectedKey);
      if (!cancelled) {
        setIndustryConfig(data);
        setLoading(false);
        setPreviewContactIdx(0);
      }
      } catch (e) { if (!cancelled) { setError(e.message); setLoading(false); } }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [selectedKey, retry]);

  const activeContact = useMemo(() => {
    if (!industryConfig?.syntheticDemoContacts?.length) {
      return {};
    }
    return industryConfig.syntheticDemoContacts[previewContactIdx] || industryConfig.syntheticDemoContacts[0];
  }, [industryConfig, previewContactIdx]);

  return (
    <div style={{ minHeight: '100vh', background: '#F4F7FC', color: '#0F172A', fontFamily: 'Inter, sans-serif' }}>
      {/* Top Header */}
      <header
        style={{
          background: '#0B1220',
          color: '#FFFFFF',
          borderBottom: '1px solid #1E293B',
          padding: '16px 32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <Link
            to="/settings"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: '#94A3B8',
              textDecoration: 'none',
              fontSize: '13px',
              padding: '6px 12px',
              background: '#111C30',
              borderRadius: '6px',
              border: '1px solid #26354C',
            }}
          >
            <ArrowLeft size={14} /> Back to Settings
          </Link>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={18} color="#60A5FA" />
              <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '700', letterSpacing: '-0.01em' }}>
                Universal Industry Configuration Inspector
              </h1>
            </div>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#94A3B8' }}>
              Read-Only Registry &amp; Pack Definitions · Reusable Architecture
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: '#172554',
              border: '1px solid #1E40AF',
              color: '#93C5FD',
              padding: '5px 12px',
              borderRadius: '9999px',
              fontSize: '12px',
              fontWeight: '600',
            }}
          >
            <Eye size={13} />
            Read-Only Inspector
          </span>
        </div>
      </header>

      {/* Mandatory Non-Provisioned Warning Banner */}
      <div
        style={{
          background: '#FEF3C7',
          borderBottom: '1px solid #FDE68A',
          padding: '12px 32px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          color: '#92400E',
          fontSize: '13px',
        }}
      >
        <ShieldAlert size={18} style={{ flexShrink: 0, color: '#D97706' }} />
        <div>
          <strong style={{ fontWeight: '700' }}>Industry Pack Preview — Not Provisioned:</strong>{' '}
          This is a read-only architectural configuration preview. Presets shown below are defined in configuration files and are{' '}
          <strong>NOT</strong> written to MongoDB as saved contacts, active templates, or running campaigns.
        </div>
      </div>

      <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px 32px' }}>
        {error && <div role="alert">{error} <button onClick={() => setRetry(n => n + 1)}>Retry</button></div>}
        {/* Industry Selector Grid */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: '#64748B', marginBottom: '8px' }}>
            Select Industry Pack
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            {industries.map(({ key, name: label, icon }) => {
              const Icon = INDUSTRY_ICONS[key] || Briefcase;
              const isSelected = selectedKey === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedKey(key)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    borderRadius: '10px',
                    border: isSelected ? '2px solid #2563EB' : '1px solid #E2E8F0',
                    background: isSelected ? '#EFF6FF' : '#FFFFFF',
                    color: isSelected ? '#1E40AF' : '#1E293B',
                    fontWeight: isSelected ? '700' : '500',
                    fontSize: '13.5px',
                    cursor: 'pointer',
                    boxShadow: isSelected ? '0 1px 3px rgba(37,99,235,0.1)' : '0 1px 2px rgba(0,0,0,0.02)',
                    textAlign: 'left',
                    transition: 'all 120ms ease',
                  }}
                >
                  <Icon size={18} color={isSelected ? '#2563EB' : '#64748B'} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            borderBottom: '1px solid #E2E8F0',
            marginBottom: '24px',
            overflowX: 'auto',
            paddingBottom: '2px',
          }}
        >
          {[
            { id: 'templates', label: 'Starter Templates (10)', icon: FileText },
            { id: 'fields', label: 'Contact Schema Fields', icon: Users },
            { id: 'quick_replies', label: 'Quick Replies (5+)', icon: MessageSquare },
            { id: 'automations', label: 'Keyword Rules', icon: Zap },
            { id: 'campaign', label: 'Sample Campaign', icon: Megaphone },
            { id: 'variables', label: 'CRM Variables', icon: Code2 },
          ].map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 16px',
                  border: 'none',
                  background: 'transparent',
                  borderBottom: isActive ? '3px solid #2563EB' : '3px solid transparent',
                  color: isActive ? '#2563EB' : '#64748B',
                  fontWeight: isActive ? '700' : '500',
                  fontSize: '13.5px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                <Icon size={16} />
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        {/* Loading State */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748B' }}>
            Loading industry pack configuration...
          </div>
        )}

        {/* Content Pane */}
        {!loading && industryConfig && (
          <div>
            {/* 1. Templates Tab (10 Templates) */}
            {activeTab === 'templates' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '17px', fontWeight: '700' }}>
                      10 Pre-Engineered Starter Templates
                    </h2>
                    <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#64748B' }}>
                      Tailored for {industryConfig.name}. Variables resolve dynamically against sample preview contacts.
                    </p>
                  </div>

                  {/* Synthetic Demo Contact Switcher */}
                  {Boolean(industryConfig.syntheticDemoContacts?.length) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#FFFFFF', padding: '6px 12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748B' }}>Preview Contact:</span>
                      <select
                        value={previewContactIdx}
                        onChange={(e) => setPreviewContactIdx(Number(e.target.value))}
                        style={{ border: 'none', background: 'transparent', fontWeight: '600', fontSize: '13px', color: '#0F172A', outline: 'none', cursor: 'pointer' }}
                      >
                        {industryConfig.syntheticDemoContacts.map((c, i) => (
                          <option key={i} value={i}>
                            {c.fullName} ({c.interestedPropertyType || c.membershipType || c.serviceCategory || c.serviceInterest || 'Lead'})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '16px' }}>
                  {industryConfig.templateSuggestions.map((tpl, idx) => {
                    const resolvedBody = resolveCrmVariables(tpl.body, activeContact, { name: industryConfig.name }, industryConfig.supportedVariables);
                    return (
                      <div
                        key={tpl.presetKey || idx}
                        style={{
                          background: '#FFFFFF',
                          border: '1px solid #E2E8F0',
                          borderRadius: '12px',
                          padding: '18px',
                          boxShadow: '0 1px 3px rgba(11,18,32,0.03)',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: '#2563EB', background: '#EFF6FF', padding: '2px 8px', borderRadius: '4px' }}>
                              #{idx + 1} · {tpl.category || 'Standard'}
                            </span>
                            <span style={{ fontSize: '11px', color: '#64748B', fontFamily: 'monospace' }}>
                              {tpl.presetKey}
                            </span>
                          </div>
                          <h3 style={{ margin: '0 0 10px', fontSize: '15px', fontWeight: '700', color: '#0F172A' }}>
                            {tpl.title}
                          </h3>

                          {tpl.header && (
                            <div style={{ fontSize: '12px', fontWeight: '700', color: '#334155', background: '#F8FAFC', padding: '6px 10px', borderRadius: '6px', marginBottom: '10px', borderLeft: '3px solid #2563EB' }}>
                              Header: {resolveCrmVariables(tpl.header, activeContact, { name: industryConfig.name }, industryConfig.supportedVariables)}
                            </div>
                          )}

                          {/* WhatsApp Chat Bubble Mock */}
                          <div
                            style={{
                              background: '#DCF8C6',
                              color: '#075E54',
                              padding: '12px 14px',
                              borderRadius: '8px',
                              fontSize: '13px',
                              lineHeight: '1.45',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                              marginBottom: '12px',
                              whiteSpace: 'pre-wrap',
                            }}
                          >
                            <span style={{ color: '#111827' }}>{resolvedBody}</span>
                          </div>
                        </div>

                        <div style={{ fontSize: '11.5px', color: '#64748B', borderTop: '1px solid #F1F5F9', paddingTop: '10px' }}>
                          <strong>Variables used:</strong>{' '}
                          {(tpl.variables || []).map((v) => (
                            <code key={v} style={{ background: '#F1F5F9', padding: '2px 5px', borderRadius: '4px', marginRight: '4px', color: '#0F172A' }}>
                              {`{{${v}}}`}
                            </code>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 2. Contact Fields Schema Tab */}
            {activeTab === 'fields' && (
              <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px', boxShadow: '0 1px 3px rgba(11,18,32,0.03)' }}>
                <h2 style={{ margin: '0 0 6px', fontSize: '17px', fontWeight: '700' }}>
                  Contact Schema Definitions for {industryConfig.name}
                </h2>
                <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#64748B' }}>
                  Standard fields and industry-specific custom properties. When an account selects this industry, contacts directory tables and form modals adopt these definitions.
                </p>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0', color: '#475569', fontWeight: '700' }}>
                        <th style={{ padding: '10px 14px' }}>Field Key</th>
                        <th style={{ padding: '10px 14px' }}>Label</th>
                        <th style={{ padding: '10px 14px' }}>Data Type</th>
                        <th style={{ padding: '10px 14px' }}>Required</th>
                        <th style={{ padding: '10px 14px' }}>Options / Presets</th>
                        <th style={{ padding: '10px 14px' }}>Table Column</th>
                      </tr>
                    </thead>
                    <tbody>
                      {industryConfig.contactFields.map((field) => (
                        <tr key={field.key} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: '600', color: '#2563EB' }}>
                            {field.key}
                            {field.isCanonical && (
                              <span style={{ marginLeft: '6px', fontSize: '10px', background: '#DBEAFE', color: '#1E40AF', padding: '1px 5px', borderRadius: '3px' }}>
                                Canonical
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '10px 14px', fontWeight: '600' }}>{field.label}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ background: '#F1F5F9', padding: '3px 8px', borderRadius: '4px', fontSize: '12px' }}>
                              {field.type}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            {field.required ? (
                              <span style={{ color: '#DC2626', fontWeight: '700' }}>Yes</span>
                            ) : (
                              <span style={{ color: '#64748B' }}>No</span>
                            )}
                          </td>
                          <td style={{ padding: '10px 14px', maxWidth: '360px', color: '#475569' }}>
                            {field.options ? (
                              <span style={{ fontSize: '12px' }}>
                                {field.options.map((o) => (typeof o === 'object' ? o.label : o)).slice(0, 4).join(', ')}
                                {field.options.length > 4 ? ` (+${field.options.length - 4} more)` : ''}
                              </span>
                            ) : (
                              <span style={{ color: '#94A3B8' }}>{field.placeholder || 'Free text'}</span>
                            )}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            {field.showInTable ? (
                              <span style={{ color: '#16A34A', fontWeight: '600' }}>Visible</span>
                            ) : (
                              <span style={{ color: '#94A3B8' }}>Drawer only</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 3. Quick Reply Presets Tab */}
            {activeTab === 'quick_replies' && (
              <div>
                <h2 style={{ margin: '0 0 6px', fontSize: '17px', fontWeight: '700' }}>
                  Quick Reply Presets ({industryConfig.quickReplyPresets?.length || 0})
                </h2>
                <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#64748B' }}>
                  1-click insertion responses for customer conversation agents.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
                  {(industryConfig.quickReplyPresets || []).map((qr, idx) => (
                    <div
                      key={qr.key || idx}
                      style={{
                        background: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        borderRadius: '10px',
                        padding: '16px',
                        boxShadow: '0 1px 2px rgba(11,18,32,0.02)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#2563EB', background: '#EFF6FF', padding: '2px 8px', borderRadius: '4px' }}>
                          {qr.category || 'General'}
                        </span>
                        <code style={{ fontSize: '12px', fontWeight: '700', color: '#0F172A', background: '#F1F5F9', padding: '2px 6px', borderRadius: '4px' }}>
                          {qr.shortcut}
                        </code>
                      </div>
                      <h3 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: '700' }}>{qr.title}</h3>
                      <div style={{ fontSize: '13px', color: '#334155', background: '#F8FAFC', padding: '10px', borderRadius: '6px', border: '1px solid #E2E8F0', lineHeight: '1.4' }}>
                        {qr.text}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. Keyword Auto-Reply Rules Tab */}
            {activeTab === 'automations' && (
              <div>
                <h2 style={{ margin: '0 0 6px', fontSize: '17px', fontWeight: '700' }}>
                  Keyword Auto-Reply Rules ({industryConfig.automationPresets?.length || 0})
                </h2>
                <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#64748B' }}>
                  Starter marketing rules are disabled by default until reviewed. The compliance STOP rule remains active.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {(industryConfig.automationPresets || []).map((rule, idx) => (
                    <div
                      key={rule.presetId || idx}
                      style={{
                        background: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        borderRadius: '10px',
                        padding: '16px 20px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        boxShadow: '0 1px 2px rgba(11,18,32,0.02)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700' }}>{rule.displayName}</h3>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: '700',
                              padding: '2px 8px',
                              borderRadius: '9999px',
                              background: rule.enabled ? '#DCFCE7' : '#F1F5F9',
                              color: rule.enabled ? '#166534' : '#64748B',
                            }}
                          >
                            {rule.enabled ? 'Enabled by Default' : 'Disabled by Default (Pending Review)'}
                          </span>
                        </div>
                        <span style={{ fontSize: '12px', color: '#64748B' }}>
                          Match Type: <strong>{rule.matchType}</strong> · Priority: <strong>{rule.priority}</strong>
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', margin: '4px 0' }}>
                        {(rule.triggerKeywords || []).map((kw) => (
                          <span key={kw} style={{ background: '#1E293B', color: '#F8FAFC', padding: '2px 8px', borderRadius: '4px', fontSize: '11.5px', fontWeight: '700', letterSpacing: '0.04em' }}>
                            {kw}
                          </span>
                        ))}
                      </div>

                      <div style={{ fontSize: '13px', color: '#334155', background: '#F8FAFC', padding: '10px 14px', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                        <strong style={{ color: '#0F172A', display: 'block', marginBottom: '4px', fontSize: '12px' }}>
                          Action: {rule.intendedAction || 'RUN_MOCK_REPLY'}
                        </strong>
                        {rule.suggestedResponse}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 5. Sample Campaign Draft Tab */}
            {activeTab === 'campaign' && industryConfig.sampleCampaignDraft && (
              <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px', maxWidth: '720px', boxShadow: '0 1px 3px rgba(11,18,32,0.03)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h2 style={{ margin: 0, fontSize: '17px', fontWeight: '700' }}>
                    Sample Campaign Blueprint: {industryConfig.sampleCampaignDraft.campaignName}
                  </h2>
                  <span style={{ background: '#FEF3C7', color: '#92400E', padding: '3px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: '700' }}>
                    Blueprint Only · Not Scheduled
                  </span>
                </div>

                <p style={{ margin: '0 0 16px', fontSize: '13.5px', color: '#475569' }}>
                  {industryConfig.sampleCampaignDraft.description}
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Campaign Goal</div>
                    <div style={{ fontSize: '14px', fontWeight: '600', marginTop: '2px' }}>{industryConfig.sampleCampaignDraft.goal}</div>
                  </div>
                  <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Starter Template Ref</div>
                    <div style={{ fontSize: '14px', fontWeight: '600', marginTop: '2px', fontFamily: 'monospace' }}>
                      {industryConfig.sampleCampaignDraft.targetTemplateKey}
                    </div>
                  </div>
                </div>

                <div style={{ background: '#F8FAFC', padding: '14px', borderRadius: '8px', border: '1px solid #E2E8F0', marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Audience Targeting Criteria
                  </div>
                  <pre style={{ margin: 0, fontSize: '12px', fontFamily: 'monospace', color: '#1E293B', whiteSpace: 'pre-wrap' }}>
                    {JSON.stringify(industryConfig.sampleCampaignDraft.audienceCriteria, null, 2)}
                  </pre>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  {(industryConfig.sampleCampaignDraft.tags || []).map((t) => (
                    <span key={t} style={{ background: '#EFF6FF', color: '#1E40AF', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '600' }}>
                      #{t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 6. CRM Variables Tab */}
            {activeTab === 'variables' && (
              <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px', boxShadow: '0 1px 3px rgba(11,18,32,0.03)' }}>
                <h2 style={{ margin: '0 0 6px', fontSize: '17px', fontWeight: '700' }}>
                  Supported CRM Variables for {industryConfig.name}
                </h2>
                <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#64748B' }}>
                  Tokens recognized by the Relay template engine and dynamic preview resolver.
                </p>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0', color: '#475569', fontWeight: '700' }}>
                        <th style={{ padding: '10px 14px' }}>Token</th>
                        <th style={{ padding: '10px 14px' }}>Label</th>
                        <th style={{ padding: '10px 14px' }}>Category</th>
                        <th style={{ padding: '10px 14px' }}>Sample Resolved Value</th>
                        <th style={{ padding: '10px 14px' }}>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(industryConfig.supportedVariables || []).map((v) => (
                        <tr key={v.token} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: '700', color: '#2563EB' }}>
                            {`{{${v.token}}}`}
                          </td>
                          <td style={{ padding: '10px 14px', fontWeight: '600' }}>{v.label}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ background: '#F1F5F9', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>
                              {v.category}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', color: '#166534', fontWeight: '500' }}>
                            "{v.sampleValue}"
                          </td>
                          <td style={{ padding: '10px 14px', color: '#64748B' }}>{v.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
