import { useEffect, useState } from 'react';
import { X, UserRound, Home, Building2, Tag, ShieldCheck, Clock, DollarSign, Layers, Dumbbell, Stethoscope, Sparkles, Car, Plane, Utensils, Briefcase } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { listContactGroups } from '../services/contactGroups';
import { COMMON_CONTACT_FIELDS, fieldOptions, readContactField, industryFieldPayload } from '../utils/contactFields';

const regions = [
  ['IN', 'India (+91)'],
  ['US', 'United States (+1)'],
  ['GB', 'United Kingdom (+44)'],
  ['CA', 'Canada (+1)'],
  ['AU', 'Australia (+61)'],
  ['AE', 'UAE (+971)'],
  ['SG', 'Singapore (+65)'],
  ['DE', 'Germany (+49)'],
  ['FR', 'France (+33)'],
  ['BR', 'Brazil (+55)'],
  ['JP', 'Japan (+81)']
];

const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];

const initial = {
  fullName: '',
  phoneNumber: '',
  alternatePhone: '',
  countryCode: 'IN',
  email: '',
  city: '',
  state: '',
  country: 'India',
  location: '',
  estimatedDealValue: '',
  currency: 'INR',
  leadSource: '',
  leadStatus: 'New',
  priority: 'Medium',
  preferredContactTime: '',
  notes: '',
  tags: '',
  groups: [],
  consentStatus: 'Unknown',
  consentSource: '',
  consentPurpose: '',
  consentedBusinessName: '',
  consentCapturedAt: '',
  evidenceReference: '',
  affirmed: false
};

const localDate = () => {
  const d = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
};

export default function ContactFormModal({ contact, onClose, onSave }) {
  const { currentWorkspace, industryConfig } = useWorkspace();
  const fields = industryConfig.contactFields.filter(f => !COMMON_CONTACT_FIELDS.has(f.key));
  const LEAD_STATUSES = industryConfig.leadStatuses;
  const LEAD_SOURCES = fieldOptions(industryConfig.contactFields.find(f => f.key === 'leadSource'));
  const [industryValues, setIndustryValues] = useState(() => Object.fromEntries(fields.map(f => [f.key, readContactField(contact, f)])));
  const [form, setForm] = useState(initial);
  const [availableGroups, setAvailableGroups] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const editing = Boolean(contact);

  useEffect(() => {
    listContactGroups({ limit: 100 })
      .then(({ data }) => setAvailableGroups(data.records || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (contact) {
      setForm({
        ...initial,
        ...contact,
        city: contact.city || contact.location || '',
        state: contact.state || '',
        country: contact.country || 'India',
        estimatedDealValue: contact.estimatedDealValue ?? '',
        tags: (contact.tags || []).join(', '),
        groups: Array.isArray(contact.groups) ? contact.groups.map(g => (g._id || g).toString()) : [],
        consentStatus: contact.whatsappConsentStatus || 'Unknown',
        preferredContactTime: contact.preferredContactTime || ''
      });
    }
    setIndustryValues(Object.fromEntries(fields.map(f => [f.key, readContactField(contact, f)])));
  }, [contact, industryConfig]);

  const update = (key, value) => setForm(current => ({ ...current, [key]: value }));

  const toggleGroup = (groupId) => {
    setForm(current => {
      const exists = current.groups.includes(groupId);
      const next = exists ? current.groups.filter(id => id !== groupId) : [...current.groups, groupId];
      return { ...current, groups: next };
    });
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');

    if (!editing && form.consentStatus === 'Opted In') {
      if (!form.consentSource?.trim() || !form.consentPurpose?.trim() || !form.evidenceReference?.trim() || !form.consentCapturedAt) {
        setError('Consent Source, Purpose, Evidence Reference, and Date Captured are required for Verified Opt-In.');
        return;
      }
      if (!form.affirmed) {
        setError('Confirm that you have a genuine affirmative opt-in record before marking this contact opted in.');
        return;
      }
    }

    setBusy(true);
    try {
      const payload = {
        fullName: form.fullName.trim(),
        phoneNumber: form.phoneNumber.trim(),
        alternatePhone: form.alternatePhone?.trim() || undefined,
        countryCode: form.countryCode,
        email: form.email?.trim() || undefined,
        city: form.city.trim(),
        state: form.state.trim(),
        country: form.country.trim(),
        location: form.city.trim() + (form.state.trim() ? `, ${form.state.trim()}` : ''),
        estimatedDealValue: form.estimatedDealValue === '' ? null : Number(form.estimatedDealValue),
        currency: form.currency,
        leadSource: form.leadSource,
        leadStatus: form.leadStatus,
        priority: form.priority,
        preferredContactTime: form.preferredContactTime?.trim() || undefined,
        notes: form.notes,
        tags: form.tags.split(',').map(tag => tag.trim()).filter(Boolean),
        groups: form.groups,
      };

      Object.assign(payload, industryFieldPayload(fields, industryValues, contact));

      if (!editing) {
        payload.consent = {
          status: form.consentStatus,
          consentSource: form.consentSource,
          consentPurpose: form.consentPurpose,
          consentedBusinessName: form.consentedBusinessName,
          consentCapturedAt: form.consentCapturedAt ? new Date(form.consentCapturedAt).toISOString() : '',
          evidenceReference: form.evidenceReference
        };
      }

      await onSave(payload);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'We could not save this contact. Check the details and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-scrim" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="contact-modal" role="dialog" aria-modal="true" aria-labelledby="contact-form-title" style={{ maxWidth: '680px' }}>
        <header className="contact-modal-head">
          <div>
            <span className="form-kicker">{industryConfig.industryName}</span>
            <h2 id="contact-form-title">{editing ? 'Edit Contact' : 'Add Contact'}</h2>
            <p>Manage contact details and {industryConfig.terminology.leadPlural.toLowerCase()}.</p>
          </div>
          <button className="icon-btn modal-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>

        <form onSubmit={submit} className="contact-form">
          <div className="contact-form-scroll" style={{ maxHeight: 'calc(85vh - 140px)', overflowY: 'auto', padding: '16px 24px' }}>
            
            {/* SECTION 1: BASIC INFORMATION */}
            <section className="form-section">
              <h3><UserRound size={15} /> 1. Contact & Identity</h3>
              <div className="form-grid">
                <label className="field wide">
                  Full Name <b>*</b>
                  <input
                    required
                    minLength={2}
                    maxLength={120}
                    value={form.fullName}
                    onChange={e => update('fullName', e.target.value)}
                    placeholder="e.g. Vikram Malhotra"
                    autoFocus
                  />
                </label>
                <label className="field">
                  Country / Code
                  <select value={form.countryCode || 'IN'} onChange={e => update('countryCode', e.target.value)}>
                    {regions.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                  </select>
                </label>
                <label className="field">
                  WhatsApp Number <b>*</b>
                  <input
                    required
                    value={form.phoneNumber || ''}
                    onChange={e => update('phoneNumber', e.target.value)}
                    placeholder="9876543210 or +919876543210"
                    type="tel"
                    autoComplete="tel"
                  />
                </label>
                <label className="field">
                  Alternate Phone (Optional)
                  <input
                    value={form.alternatePhone || ''}
                    onChange={e => update('alternatePhone', e.target.value)}
                    placeholder="Secondary contact number"
                    type="tel"
                  />
                </label>
                <label className="field">
                  Email Address
                  <input
                    type="email"
                    value={form.email || ''}
                    onChange={e => update('email', e.target.value)}
                    placeholder="vikram@example.com"
                  />
                </label>
              </div>
            </section>

            <section className="form-section">
              <h3><Building2 size={15} /> 2. {industryConfig.ui.contacts.requirementsTitle}</h3>
              <div className="form-grid">
                {fields.map(field => {
                  const value = industryValues[field.key] ?? '';
                  const options = fieldOptions(field);
                  const updateField = value => setIndustryValues(current => ({ ...current, [field.key]: value }));
                  return <label className="field" key={field.key}>
                    {field.label}{field.required && !editing && <b> *</b>}
                    {field.type === 'select' ? <select value={value} required={field.required && !editing} onChange={e => updateField(e.target.value)}>
                      <option value="">Select {field.label}</option>
                      {value !== '' && !options.some(o => o.value === value) && <option value={value}>{value} (saved)</option>}
                      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select> : field.type === 'multiselect' ? <select multiple value={Array.isArray(value) ? value : []} onChange={e => updateField(Array.from(e.target.selectedOptions, o => o.value))}>
                      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select> : field.type === 'boolean' ? <select value={String(value)} onChange={e => updateField(e.target.value === '' ? '' : e.target.value === 'true')}><option value="">Not specified</option><option value="true">Yes</option><option value="false">No</option></select> :
                      <input type={['date', 'number'].includes(field.type) ? field.type : 'text'} required={field.required && !editing} value={value} placeholder={field.placeholder || ''} onChange={e => updateField(e.target.value)} />}
                  </label>;
                })}
                <label className="field">City / Location<input value={form.city} onChange={e => update('city', e.target.value)} /></label>
                <label className="field">State / Region<input value={form.state} onChange={e => update('state', e.target.value)} /></label>
                <label className="field">Estimated Deal Value (Numeric)<input type="number" min="0" value={form.estimatedDealValue} onChange={e => update('estimatedDealValue', e.target.value)} /></label>
                <label className="field">Currency<input value={form.currency} maxLength={3} onChange={e => update('currency', e.target.value.toUpperCase())} /></label>
              </div>
            </section>

            {/* SECTION 3: ORGANIZATION & ENQUIRY STATUS */}
            <section className="form-section">
              <h3><Layers size={15} /> 3. Organization &amp; Lead Status</h3>
              <div className="form-grid">
                <label className="field">
                  Enquiry Source
                  <select value={form.leadSource} onChange={e => update('leadSource', e.target.value)}>
                    <option value="">Select source</option>
                    {form.leadSource && !LEAD_SOURCES.some(o => o.value === form.leadSource) && <option value={form.leadSource}>{form.leadSource} (saved)</option>}
                    {LEAD_SOURCES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </label>
                <label className="field">
                  Lead Status
                  <select value={form.leadStatus} onChange={e => update('leadStatus', e.target.value)}>
                    {LEAD_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
                  </select>
                </label>
                <label className="field">
                  Priority
                  <select value={form.priority} onChange={e => update('priority', e.target.value)}>
                    {PRIORITIES.map(priority => <option key={priority} value={priority}>{priority}</option>)}
                  </select>
                </label>
                <label className="field">
                  Preferred Contact Time
                  <input
                    value={form.preferredContactTime}
                    onChange={e => update('preferredContactTime', e.target.value)}
                    placeholder="e.g. Weekday evenings after 6 PM"
                  />
                </label>
                <label className="field wide">
                  Tags <span className="field-hint">Comma separated</span>
                  <input
                    value={form.tags}
                    onChange={e => update('tags', e.target.value)}
                    placeholder="Gurugram Buyer, High Budget, Plot Enquiry, NRI"
                  />
                </label>
                {availableGroups.length > 0 && (
                  <div className="field wide">
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px', display: 'block' }}>
                      Assign to Contact Groups
                    </span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {availableGroups.map(group => {
                        const isSelected = form.groups.includes(group._id);
                        return (
                          <button
                            key={group._id}
                            type="button"
                            onClick={() => toggleGroup(group._id)}
                            style={{
                              padding: '5px 10px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              border: isSelected ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                              background: isSelected ? 'var(--color-primary-soft)' : 'var(--color-surface)',
                              color: isSelected ? 'var(--color-primary)' : 'var(--color-text-primary)',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px'
                            }}
                          >
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: group.color || 'var(--color-primary)' }} />
                            {group.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <label className="field wide">
                  Private CRM Notes
                  <textarea
                    rows="3"
                    maxLength={10000}
                    value={form.notes}
                    onChange={e => update('notes', e.target.value)}
                    placeholder="Specific requirements: corner plot preferred, 12th floor or above, interested in 3-year payment plan…"
                  />
                </label>
              </div>
            </section>

            {/* SECTION 4: WHATSAPP CONSENT ZERO-POLICY */}
            {!editing && (
              <section className="form-section consent-form-section" style={{ background: 'var(--color-surface-muted)', padding: '14px', borderRadius: '8px', border: '1px solid var(--color-border-subtle)' }}>
                <h3><ShieldCheck size={15} /> 4. WhatsApp Consent Status</h3>
                <p className="consent-explainer" style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '4px 0 10px' }}>
                  A phone number alone is <b>not</b> permission to send WhatsApp marketing. Default status is strictly <b>Unknown</b>. Opted In requires affirmative evidence.
                </p>
                <div className="form-grid">
                  <label className="field wide">
                    Consent Status
                    <select value={form.consentStatus} onChange={e => update('consentStatus', e.target.value)}>
                      <option value="Unknown">Unknown (Default — No marketing until consented)</option>
                      <option value="Opted In">Opted In (Affirmative verifiable consent exists)</option>
                      <option value="Opted Out">Opted Out (Customer requested Do Not Contact)</option>
                    </select>
                  </label>

                  {form.consentStatus === 'Opted In' && (
                    <>
                      <label className="field">
                        Consent Source <b>*</b>
                        <input
                          required
                          value={form.consentSource}
                          onChange={e => update('consentSource', e.target.value)}
                          placeholder="e.g. Website site-visit booking form"
                        />
                      </label>
                      <label className="field">
                        Consent Purpose <b>*</b>
                        <input
                          required
                          value={form.consentPurpose}
                          onChange={e => update('consentPurpose', e.target.value)}
                          placeholder="e.g. Property brochures and site visit updates"
                        />
                      </label>
                      <label className="field wide">
                        Business Name in Consent Notice
                        <input
                          value={form.consentedBusinessName}
                          onChange={e => update('consentedBusinessName', e.target.value)}
                          placeholder="e.g. M2W Realty"
                        />
                      </label>
                      <label className="field wide">
                        Date and Time Captured <b>*</b>
                        <input
                          required
                          type="datetime-local"
                          max={localDate()}
                          value={form.consentCapturedAt}
                          onChange={e => update('consentCapturedAt', e.target.value)}
                        />
                      </label>
                      <label className="field wide">
                        Supporting Evidence Reference <b>*</b>
                        <input
                          required
                          value={form.evidenceReference}
                          onChange={e => update('evidenceReference', e.target.value)}
                          placeholder="e.g. Enquiry Form Submission ID #84920 or signed site visit slip"
                        />
                      </label>
                      <label className="consent-check wide" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 600 }}>
                        <input
                          type="checkbox"
                          checked={form.affirmed}
                          onChange={e => update('affirmed', e.target.checked)}
                        />
                        I confirm this buyer gave explicit affirmative consent for real estate communication.
                      </label>
                    </>
                  )}
                </div>
              </section>
            )}

            {error && <div className="form-error" role="alert" style={{ marginTop: '12px' }}>{error}</div>}
          </div>

          <footer className="contact-modal-foot">
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
              {editing ? 'Updates persist to MongoDB.' : 'All fields with * are required.'}
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="outline-btn" onClick={onClose}>Cancel</button>
              <button className="primary-btn small" disabled={busy}>
                {busy ? 'Saving…' : editing ? 'Save Changes' : 'Add Contact'}
              </button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  );
}
