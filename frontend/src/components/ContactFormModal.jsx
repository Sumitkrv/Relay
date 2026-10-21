import { useEffect, useState } from 'react';
import { X, UserRound, Home, Building2, Tag, ShieldCheck, Clock, DollarSign, Layers } from 'lucide-react';
import { listContactGroups } from '../services/contactGroups';

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

const PROPERTY_TYPES = [
  'Residential Plots',
  'Apartments',
  'Farmhouses',
  'Villas',
  'Commercial Property',
  'Residential Houses',
  'Land',
  '2 BHK Apartment',
  '3 BHK Apartment',
  '4 BHK Luxury Flat',
  'Penthouse',
  'Studio Apartment',
  'Retail Shop',
  'Commercial Office',
  'Other'
];

const LEAD_SOURCES = [
  'Website Enquiry',
  '99acres',
  'Magicbricks',
  'Housing.com',
  'Facebook / Instagram Ad',
  'Referral',
  'Walk-in Client',
  'Direct WhatsApp',
  'Cold Outreach',
  'Other'
];

const LEAD_STATUSES = [
  'New',
  'Contacted',
  'Interested',
  'Follow-up Required',
  'Negotiation',
  'Converted',
  'Not Interested',
  'Closed'
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
  interestedPropertyType: 'Apartments',
  customPropertyType: '',
  interestedProject: '',
  preferredLocation: '',
  budgetRange: '',
  estimatedDealValue: '',
  currency: 'INR',
  leadSource: 'Website Enquiry',
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
      const propType = contact.interestedPropertyType || contact.interestedService || '';
      const isCustomType = Boolean(propType) && !PROPERTY_TYPES.includes(propType);

      setForm({
        ...initial,
        ...contact,
        city: contact.city || contact.location || '',
        state: contact.state || '',
        country: contact.country || 'India',
        interestedPropertyType: isCustomType ? 'Other' : (propType || 'Apartments'),
        customPropertyType: isCustomType ? propType : '',
        interestedProject: contact.interestedProject || contact.businessCategory || '',
        preferredLocation: contact.preferredLocation || '',
        budgetRange: contact.budgetRange || '',
        estimatedDealValue: contact.estimatedDealValue ?? '',
        tags: (contact.tags || []).join(', '),
        groups: Array.isArray(contact.groups) ? contact.groups.map(g => (g._id || g).toString()) : [],
        consentStatus: contact.whatsappConsentStatus || 'Unknown',
        preferredContactTime: contact.preferredContactTime || ''
      });
    }
  }, [contact]);

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
      const finalPropType = form.interestedPropertyType === 'Other' && form.customPropertyType.trim()
        ? form.customPropertyType.trim()
        : form.interestedPropertyType;

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
        interestedPropertyType: finalPropType,
        interestedService: finalPropType,
        interestedProject: form.interestedProject.trim(),
        businessCategory: form.interestedProject.trim() || 'Real Estate',
        preferredLocation: form.preferredLocation.trim(),
        budgetRange: form.budgetRange.trim(),
        estimatedDealValue: form.estimatedDealValue === '' ? null : Number(form.estimatedDealValue),
        currency: form.currency,
        leadSource: form.leadSource,
        leadStatus: form.leadStatus,
        priority: form.priority,
        preferredContactTime: form.preferredContactTime?.trim() || undefined,
        notes: form.notes,
        tags: form.tags.split(',').map(tag => tag.trim()).filter(Boolean),
        groups: form.groups
      };

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
            <span className="form-kicker">REAL ESTATE CONTACT</span>
            <h2 id="contact-form-title">{editing ? 'Edit Property Enquiry' : 'Add Property Enquiry'}</h2>
            <p>{editing ? 'Update client requirements, property preferences, and internal notes.' : 'Record a new real estate buyer or prospect. Consent defaults strictly to Unknown.'}</p>
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

            {/* SECTION 2: REAL ESTATE REQUIREMENTS */}
            <section className="form-section">
              <h3><Building2 size={15} /> 2. Property Interest & Requirements</h3>
              <div className="form-grid">
                <label className="field">
                  Interested Property Type <b>*</b>
                  <select
                    value={form.interestedPropertyType}
                    onChange={e => update('interestedPropertyType', e.target.value)}
                  >
                    {PROPERTY_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                  </select>
                </label>
                {form.interestedPropertyType === 'Other' && (
                  <label className="field">
                    Custom Property Type
                    <input
                      value={form.customPropertyType}
                      onChange={e => update('customPropertyType', e.target.value)}
                      placeholder="e.g. Penthouse with Private Pool"
                    />
                  </label>
                )}
                <label className="field">
                  Interested Project / Community
                  <input
                    value={form.interestedProject}
                    onChange={e => update('interestedProject', e.target.value)}
                    placeholder="e.g. Godrej Aristocrat, DLF Privana"
                  />
                </label>
                <label className="field">
                  Target City <b>*</b>
                  <input
                    required
                    value={form.city}
                    onChange={e => update('city', e.target.value)}
                    placeholder="e.g. Gurugram, Delhi, Noida"
                  />
                </label>
                <label className="field">
                  State / Region
                  <input
                    value={form.state}
                    onChange={e => update('state', e.target.value)}
                    placeholder="e.g. Haryana, Delhi NCR"
                  />
                </label>
                <label className="field wide">
                  Preferred Location / Micro-Market
                  <input
                    value={form.preferredLocation}
                    onChange={e => update('preferredLocation', e.target.value)}
                    placeholder="e.g. Golf Course Extension Road, Sector 76"
                  />
                </label>
                <label className="field">
                  Budget Range
                  <input
                    value={form.budgetRange}
                    onChange={e => update('budgetRange', e.target.value)}
                    placeholder="e.g. ₹2.5 Cr - ₹4 Cr"
                  />
                </label>
                <label className="field">
                  Estimated Deal Value (Numeric)
                  <input
                    type="number"
                    min="0"
                    step="10000"
                    value={form.estimatedDealValue ?? ''}
                    onChange={e => update('estimatedDealValue', e.target.value)}
                    placeholder="e.g. 35000000"
                  />
                </label>
                <label className="field">
                  Currency
                  <select value={form.currency || 'INR'} onChange={e => update('currency', e.target.value)}>
                    {['INR', 'USD', 'AED', 'EUR', 'GBP'].map(curr => <option key={curr} value={curr}>{curr}</option>)}
                  </select>
                </label>
              </div>
            </section>

            {/* SECTION 3: ORGANIZATION & ENQUIRY STATUS */}
            <section className="form-section">
              <h3><Layers size={15} /> 3. Organization & Lead Status</h3>
              <div className="form-grid">
                <label className="field">
                  Enquiry Source
                  <select value={form.leadSource} onChange={e => update('leadSource', e.target.value)}>
                    {LEAD_SOURCES.map(src => <option key={src} value={src}>{src}</option>)}
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
                {busy ? 'Saving…' : editing ? 'Save Changes' : 'Add Property Contact'}
              </button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  );
}
