import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Archive,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronsUpDown,
  CircleAlert,
  Clock3,
  ContactRound,
  Download,
  Eye,
  FileSpreadsheet,
  Filter,
  Layers,
  MessageSquareText,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Tag,
  Trash2,
  UserRound,
  X,
  ShieldAlert,
  HelpCircle,
  Copy,
  ExternalLink,
  Ban,
  CheckCircle2,
  Building2,
  Home,
  History
} from 'lucide-react';
import toast from 'react-hot-toast';
import ContactFormModal from '../components/ContactFormModal';
import TagManagerModal from '../components/TagManagerModal';
import DynamicSegmentModal from '../components/DynamicSegmentModal';
import ContactGroupModal from '../components/ContactGroupModal';
import ImportWizardModal from '../components/ImportWizardModal';
import MessagePayloadModal from '../components/MessagePayloadModal';
import MessageEventsModal from '../components/MessageEventsModal';
import PageHeader from '../components/PageHeader';
import {
  archiveContact,
  bulkContacts,
  createContact,
  deleteContact,
  downloadContacts,
  getContact,
  getContactStats,
  listContacts,
  restoreContact,
  updateConsent,
  updateContact
} from '../services/contacts';
import { listContactGroups, deleteContactGroup } from '../services/contactGroups';
import { listImports, downloadImportErrors, retryImport, downloadTemplate } from '../services/imports';
import { listMessages } from '../services/messages';
import api from '../services/api';

const STATUSES = [
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
const CONSENTS = ['Unknown', 'Opted In', 'Opted Out'];

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

const blankFilters = {
  leadStatus: '',
  priority: '',
  city: '',
  interestedPropertyType: '',
  interestedProject: '',
  source: '',
  whatsappConsentStatus: '',
  tag: '',
  group: '',
  archived: 'false',
  isSuppressed: '',
  isDemo: '',
  createdFrom: '',
  createdTo: ''
};

const statusClass = (value) =>
  ({
    New: 'new',
    Contacted: 'contacted',
    Interested: 'interested',
    'Follow-up Required': 'followup',
    Negotiation: 'negotiation',
    Converted: 'converted',
    'Not Interested': 'notinterested',
    Closed: 'closed'
  }[value] || 'new');

const priorityClass = (value) => String(value || 'medium').toLowerCase();
const consentClass = (value) => String(value || 'Unknown').toLowerCase().replace(/\s+/g, '');
const initials = (name) =>
  (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

const localDate = () => {
  const d = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
};

const formatDate = (date) =>
  date
    ? new Date(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

const formatDateTime = (date) =>
  date
    ? new Date(date).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';

const errorMessage = (err) => err.response?.data?.message || 'Something went wrong. Please try again.';

/* ==========================================================================
   CONSENT & SUPPRESSION PANEL
   ========================================================================== */
function ConsentPanel({ contact, onUpdated }) {
  const [status, setStatus] = useState(contact.whatsappConsentStatus || 'Unknown');
  const [source, setSource] = useState('');
  const [purpose, setPurpose] = useState('');
  const [captured, setCaptured] = useState('');
  const [evidence, setEvidence] = useState('');
  const [affirmed, setAffirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Suppression / Do Not Contact controls
  const [suppressing, setSuppressing] = useState(false);
  const [suppressReason, setSuppressReason] = useState(contact.suppressionReason || 'Customer requested Do Not Contact');

  const saveConsent = async (event) => {
    event.preventDefault();
    setError('');
    if (status === 'Opted In' && (!source.trim() || !purpose.trim() || !captured || !evidence.trim() || !affirmed)) {
      setError('For an opt-in, record source, purpose, date, evidence reference, and confirm affirmative consent.');
      return;
    }
    setBusy(true);
    try {
      const { data } = await updateConsent(contact._id, {
        status,
        consentSource: source,
        consentPurpose: purpose,
        consentCapturedAt: captured ? new Date(captured).toISOString() : undefined,
        evidenceReference: evidence
      });
      toast.success('Consent record saved');
      setSource('');
      setPurpose('');
      setCaptured('');
      setEvidence('');
      setAffirmed(false);
      await onUpdated(data.contact);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const toggleSuppression = async () => {
    setSuppressing(true);
    try {
      const isCurrentlySuppressed = contact.isSuppressed;
      const { data } = await updateContact(contact._id, {
        isSuppressed: !isCurrentlySuppressed,
        suppressionReason: !isCurrentlySuppressed ? suppressReason : ''
      });
      toast.success(!isCurrentlySuppressed ? 'Contact marked as Do Not Contact (Suppressed)' : 'Contact suppression removed');
      await onUpdated(data.contact);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSuppressing(false);
    }
  };

  return (
    <section className="detail-section">
      <div className="detail-section-head">
        <div>
          <h3>
            <ShieldCheck size={15} /> WhatsApp Messaging Compliance
          </h3>
          <p>Auditable consent records and Do Not Contact suppression.</p>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {contact.isSuppressed && (
            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'var(--color-danger-soft)', color: 'var(--color-danger)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Ban size={12} /> Do Not Contact
            </span>
          )}
          <span className={`consent-badge consent-${consentClass(contact.whatsappConsentStatus)}`}>
            {contact.whatsappConsentStatus || 'Unknown'}
          </span>
        </div>
      </div>

      {/* Suppression Box */}
      <div style={{ padding: '12px', background: contact.isSuppressed ? 'var(--color-danger-soft)' : 'var(--color-surface-muted)', borderRadius: '8px', border: '1px solid var(--color-border-subtle)', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <strong style={{ fontSize: '12.5px', color: contact.isSuppressed ? 'var(--color-danger)' : 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <ShieldAlert size={14} /> Suppression Controls
          </strong>
          <button
            type="button"
            className={contact.isSuppressed ? 'primary-btn small' : 'outline-btn small'}
            onClick={toggleSuppression}
            disabled={suppressing}
            style={{ fontSize: '11.5px', height: '28px' }}
          >
            {contact.isSuppressed ? 'Remove Suppression' : 'Mark Do Not Contact'}
          </button>
        </div>
        <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
          {contact.isSuppressed
            ? `Suppressed on ${formatDateTime(contact.suppressedAt)}: ${contact.suppressionReason || 'Customer requested Do Not Contact'}. Excluded from all campaign broadcasts.`
            : 'Suppressed contacts are automatically excluded from all marketing broadcasts, regardless of tag or group membership.'}
        </p>
      </div>

      {/* Record Consent Form */}
      <form className="consent-update-form" onSubmit={saveConsent}>
        <label className="field">
          Record Consent Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {CONSENTS.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>

        {status === 'Opted In' && (
          <>
            <div className="consent-explainer">
              Only mark opted in when you have genuine affirmative consent for real estate communication.
            </div>
            <label className="field">
              Consent Source <b>*</b>
              <input required value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. Website enquiry form" />
            </label>
            <label className="field">
              Consent Purpose <b>*</b>
              <input required value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. Property brochures and site visit updates" />
            </label>
            <label className="field">
              Date & Time Captured <b>*</b>
              <input required type="datetime-local" max={localDate()} value={captured} onChange={(e) => setCaptured(e.target.value)} />
            </label>
            <label className="field">
              Evidence Reference <b>*</b>
              <input required value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="Form ID, CRM lead ID, or signed site visit slip" />
            </label>
            <label className="consent-check" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
              <input type="checkbox" checked={affirmed} onChange={(e) => setAffirmed(e.target.checked)} />
              I confirm the buyer affirmatively opted in.
            </label>
          </>
        )}

        {error && <div className="form-error">{error}</div>}
        <button className="outline-btn small" disabled={busy}>
          {busy ? 'Saving…' : 'Save Consent Record'}
        </button>
      </form>

      {/* Consent History Timeline */}
      {contact.consentHistory?.length > 0 && (
        <div className="consent-history">
          <h4>Consent History Audit Trail</h4>
          {contact.consentHistory.map((record) => (
            <div className="consent-record" key={record._id}>
              <div>
                <span className={`consent-badge consent-${consentClass(record.status)}`}>{record.status}</span>
                <small>{record.consentPurpose || 'General real estate updates'}</small>
              </div>
              <time>{formatDateTime(record.recordedAt)}</time>
              <p>
                {record.consentSource}
                {record.evidenceReference ? ` · Evidence: ${record.evidenceReference}` : ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ==========================================================================
   CONTACT PROFILE DRAWER
   ========================================================================== */
function ContactProfile({ contact, activities, groups, onClose, onEdit, onRefresh }) {
  const navigate = useNavigate();
  const [note, setNote] = useState(contact.notes || '');
  const [saving, setSaving] = useState(false);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [selectedMessageForPayload, setSelectedMessageForPayload] = useState(null);
  const [selectedMessageForEvents, setSelectedMessageForEvents] = useState(null);

  useEffect(() => setNote(contact.notes || ''), [contact]);

  useEffect(() => {
    if (!contact?._id) return;
    let active = true;
    setLoadingMessages(true);
    listMessages({ contactId: contact._id, limit: 10, sortBy: 'createdAt', sortOrder: -1 })
      .then((res) => {
        if (active) {
          setMessages(res.data?.records || []);
        }
      })
      .catch(() => {
        if (active) setMessages([]);
      })
      .finally(() => {
        if (active) setLoadingMessages(false);
      });
    return () => {
      active = false;
    };
  }, [contact?._id]);

  const saveNote = async () => {
    setSaving(true);
    try {
      await updateContact(contact._id, { notes: note });
      toast.success('Notes updated');
      await onRefresh(contact._id);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const contactGroups = Array.isArray(contact.groups)
    ? contact.groups.map((g) => (typeof g === 'object' ? g : groups.find((grp) => grp._id === g))).filter(Boolean)
    : [];

  return (
    <div
      className="drawer-scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside className="contact-drawer" role="dialog" aria-modal="true" aria-label={`${contact.fullName} profile`}>
        <header className="drawer-head">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span className="page-header-eyebrow">PROPERTY ENQUIRY PROFILE</span>
            <button className="icon-btn modal-close" onClick={onClose} aria-label="Close profile">
              <X size={18} />
            </button>
          </div>
          <div className="profile-hero">
            <div className="contact-avatar large">{initials(contact.fullName)}</div>
            <div>
              <h2>{contact.fullName}</h2>
              <p>{contact.interestedPropertyType || contact.interestedService || 'Property Prospect'}</p>
              <div className="profile-badges">
                <span className={`status-badge ${statusClass(contact.leadStatus)}`}>{contact.leadStatus}</span>
                <span className={`priority-badge ${priorityClass(contact.priority)}`}>
                  <i />
                  {contact.priority} priority
                </span>
                {contact.isDemo && (
                  <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: 'var(--color-surface-muted)', color: 'var(--color-text-muted)' }}>
                    Demo Fixture
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="drawer-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button className="outline-btn small" onClick={() => onEdit(contact)}>
              <Pencil size={13} /> Edit Details
            </button>
            <button className="outline-btn small" onClick={() => navigate('/inbox')} title="Open Inbox conversation">
              <MessageSquareText size={13} /> Open Inbox
            </button>
            <button className="outline-btn small" onClick={() => navigate('/campaigns')} title="View Campaigns">
              <Layers size={13} /> Campaigns
            </button>
            <button
              className="icon-btn"
              title={contact.isArchived ? 'Restore' : 'Archive'}
              onClick={async () => {
                if (!contact.isArchived && !window.confirm(`Archive ${contact.fullName}?`)) return;
                try {
                  contact.isArchived ? await restoreContact(contact._id) : await archiveContact(contact._id);
                  toast.success(contact.isArchived ? 'Contact restored' : 'Contact archived');
                  await onRefresh(contact._id);
                } catch (err) {
                  toast.error(errorMessage(err));
                }
              }}
            >
              <Archive size={15} />
            </button>
          </div>
        </header>

        <div className="drawer-content">
          {/* SECTION 1: REAL ESTATE DETAILS */}
          <section className="detail-section">
            <h3>
              <Building2 size={15} /> Property Requirements
            </h3>
            <div className="detail-grid">
              <div>
                <small>WhatsApp Phone</small>
                <b>{contact.phoneNumber}</b>
              </div>
              <div>
                <small>Alternate Phone</small>
                <b>{contact.alternatePhone || '—'}</b>
              </div>
              <div>
                <small>City / Location</small>
                <b>{contact.city || contact.location || '—'}</b>
              </div>
              <div>
                <small>State / Region</small>
                <b>{contact.state || '—'}</b>
              </div>
              <div>
                <small>Property Type</small>
                <b>{contact.interestedPropertyType || contact.interestedService || '—'}</b>
              </div>
              <div>
                <small>Project / Community</small>
                <b>{contact.interestedProject || contact.businessCategory || '—'}</b>
              </div>
              <div>
                <small>Preferred Area</small>
                <b>{contact.preferredLocation || '—'}</b>
              </div>
              <div>
                <small>Budget Range</small>
                <b>{contact.budgetRange || (contact.estimatedDealValue ? `₹${Number(contact.estimatedDealValue).toLocaleString()}` : '—')}</b>
              </div>
              <div>
                <small>Lead Source</small>
                <b>{contact.leadSource || 'Direct'}</b>
              </div>
              <div>
                <small>Preferred Contact Time</small>
                <b>{contact.preferredContactTime || 'Anytime'}</b>
              </div>
            </div>

            {/* Tags */}
            {contact.tags?.length > 0 && (
              <div className="detail-tags">
                {contact.tags.map((tag) => (
                  <span key={tag}>
                    <Tag size={11} />
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Groups */}
            {contactGroups.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                {contactGroups.map((g) => (
                  <span
                    key={g._id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      background: 'var(--color-primary-soft)',
                      color: 'var(--color-primary)',
                      fontSize: '11.5px',
                      fontWeight: 600
                    }}
                  >
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: g.color || 'var(--color-primary)' }} />
                    {g.name}
                  </span>
                ))}
              </div>
            )}

            <div className="record-dates">
              <span>Created {formatDate(contact.createdAt)}</span>
              <span>Updated {formatDate(contact.updatedAt)}</span>
              <span>Last contacted {formatDate(contact.lastContactedAt)}</span>
            </div>
          </section>

          {/* SECTION 2: COMPLIANCE & SUPPRESSION */}
          <ConsentPanel contact={contact} onUpdated={async () => onRefresh(contact._id)} />

          {/* SECTION 3: INTERNAL PRIVATE NOTES */}
          <section className="detail-section">
            <div className="detail-section-head">
              <h3>
                <Pencil size={15} /> Private CRM Notes
              </h3>
              <button className="text-link" onClick={saveNote} disabled={saving}>
                {saving ? 'Saving…' : 'Save Notes'}
              </button>
            </div>
            <textarea
              className="profile-notes"
              rows="4"
              maxLength={10000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add client requirements, preferred floors, or site visit feedback…"
            />
          </section>

          {/* SECTION 4: ACTIVITY LOG */}
          {activities.length > 0 && (
            <section className="detail-section">
              <h3>
                <Clock3 size={15} /> CRM Activity Log
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {activities.slice(0, 8).map((act) => (
                  <div key={act._id} style={{ fontSize: '12px', padding: '6px 8px', background: 'var(--color-surface-muted)', borderRadius: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-muted)', fontSize: '10.5px' }}>
                      <span>{act.activityType?.replaceAll('_', ' ')}</span>
                      <span>{formatDateTime(act.createdAt)}</span>
                    </div>
                    <span style={{ color: 'var(--color-text-primary)' }}>{act.description}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* SECTION 5: WHATSAPP MESSAGE HISTORY */}
          <section className="detail-section">
            <div className="detail-section-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                <MessageSquareText size={15} /> WhatsApp Message History
              </h3>
              <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-primary)', fontWeight: 600, border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                MOCK SIMULATION
              </span>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: '0 0 10px 0' }}>
              Internal dispatch audit records. Simulated in sandbox — no external WhatsApp messages delivered.
            </p>

            {loadingMessages ? (
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', padding: '14px', textAlign: 'center' }}>
                Loading dispatch history…
              </div>
            ) : messages.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', padding: '14px', textAlign: 'center', background: 'var(--color-surface-muted)', borderRadius: '6px' }}>
                No message records found for this contact.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {messages.map((msg) => {
                  const statusColors = {
                    SIMULATED_SENT: { bg: 'rgba(16, 185, 129, 0.15)', text: '#10B981', label: 'Simulated Sent' },
                    SIMULATED_DELIVERED: { bg: 'rgba(16, 185, 129, 0.2)', text: '#059669', label: 'Simulated Delivered' },
                    SIMULATED_READ: { bg: 'rgba(14, 165, 233, 0.18)', text: '#0EA5E9', label: 'Simulated Read' },
                    QUEUED: { bg: 'rgba(245, 158, 11, 0.15)', text: '#D97706', label: 'Queued' },
                    PROCESSING: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3B82F6', label: 'Processing' },
                    SCHEDULED: { bg: 'rgba(139, 92, 246, 0.15)', text: '#8B5CF6', label: 'Scheduled' },
                    TEMPORARY_FAILURE: { bg: 'rgba(239, 68, 68, 0.15)', text: '#EF4444', label: 'Temporary Failure' },
                    PERMANENT_FAILURE: { bg: 'rgba(239, 68, 68, 0.2)', text: '#DC2626', label: 'Permanent Failure' },
                    BLOCKED: { bg: 'rgba(107, 114, 128, 0.2)', text: '#6B7280', label: 'Consent Blocked' },
                    CANCELLED: { bg: 'rgba(107, 114, 128, 0.15)', text: '#6B7280', label: 'Cancelled' }
                  };
                  const sc = statusColors[msg.status] || { bg: 'var(--color-surface-muted)', text: 'var(--color-text-muted)', label: msg.status };
                  const templateName = msg.templateSnapshot?.name || msg.templateId?.name || 'Custom Message';
                  const campaignName = msg.campaignId?.name || (msg.campaignId ? 'Campaign' : 'Direct Message');

                  return (
                    <div
                      key={msg._id}
                      style={{
                        padding: '10px',
                        background: 'var(--color-surface-muted)',
                        borderRadius: '8px',
                        border: '1px solid var(--color-border-subtle)',
                        fontSize: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <strong style={{ color: 'var(--color-text-primary)' }}>{templateName}</strong>
                        <span style={{ padding: '2px 6px', borderRadius: '4px', background: sc.bg, color: sc.text, fontSize: '10.5px', fontWeight: 600 }}>
                          {sc.label}
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', color: 'var(--color-text-muted)', fontSize: '11px', marginBottom: '6px' }}>
                        <div>Campaign: <span style={{ color: 'var(--color-text-primary)' }}>{campaignName}</span></div>
                        <div>Version: <span style={{ color: 'var(--color-text-primary)' }}>v{msg.templateVersion || 1}</span></div>
                        <div>Time: <span style={{ color: 'var(--color-text-primary)' }}>{formatDateTime(msg.simulatedSentAt || msg.queuedAt || msg.createdAt)}</span></div>
                        <div>Mode: <span style={{ color: 'var(--color-text-primary)' }}>{msg.providerMode || 'MOCK'}</span></div>
                      </div>
                      {msg.failureReason && (
                        <div style={{ padding: '4px 8px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.1)', color: '#DC2626', fontSize: '11px', marginBottom: '6px' }}>
                          Reason: {msg.failureReason}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '6px' }}>
                        <button
                          type="button"
                          className="outline-btn small"
                          style={{ fontSize: '11px', padding: '2px 8px' }}
                          onClick={() => setSelectedMessageForPayload(msg)}
                        >
                          <Eye size={12} style={{ marginRight: '4px' }} /> View Snapshot
                        </button>
                        <button
                          type="button"
                          className="outline-btn small"
                          style={{ fontSize: '11px', padding: '2px 8px' }}
                          onClick={() => setSelectedMessageForEvents(msg)}
                        >
                          <Clock3 size={12} style={{ marginRight: '4px' }} /> Events
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </aside>

      {selectedMessageForPayload && (
        <MessagePayloadModal
          message={selectedMessageForPayload}
          onClose={() => setSelectedMessageForPayload(null)}
        />
      )}
      {selectedMessageForEvents && (
        <MessageEventsModal
          message={selectedMessageForEvents}
          onClose={() => setSelectedMessageForEvents(null)}
        />
      )}
    </div>
  );
}

/* ==========================================================================
   MAIN CONTACTS PAGE
   ========================================================================== */
export default function ContactsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active Workspace Tab: 'contacts' | 'groups' | 'audiences' | 'imports'
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'contacts');

  // Contact list state
  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState(blankFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState('createdAt');
  const [direction, setDirection] = useState('desc');
  const [selected, setSelected] = useState([]);

  // Modals & Drawers
  const [editor, setEditor] = useState(undefined);
  const [detail, setDetail] = useState(null);
  const [activities, setActivities] = useState([]);
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupEditing, setGroupEditing] = useState(null);
  const [segmentModalOpen, setSegmentModalOpen] = useState(false);
  const [segmentEditing, setSegmentEditing] = useState(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  // Full page import integration for direct routing
  const goToImportPage = () => navigate('/import');
  const [exportOpen, setExportOpen] = useState(false);
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState('status');
  const [bulkValue, setBulkValue] = useState('New');

  // Sub-modules state
  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [segments, setSegments] = useState([]);
  const [segmentsLoading, setSegmentsLoading] = useState(false);
  const [importHistory, setImportHistory] = useState([]);
  const [importHistoryLoading, setImportHistoryLoading] = useState(false);

  // Sync tab with URL
  const switchTab = (tab) => {
    setActiveTab(tab);
    setSearchParams(tab === 'contacts' ? {} : { tab });
  };

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const filterParams = useMemo(
    () => Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== '')),
    [filters]
  );

  const loadStats = useCallback(async () => {
    try {
      const { data } = await getContactStats();
      setStats(data.stats);
    } catch {
      setStats(null);
    }
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await listContacts({
        ...filterParams,
        search,
        page,
        limit: pageSize,
        sort,
        direction
      });
      setRecords(data.records);
      setTotal(data.total);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [filterParams, search, page, pageSize, sort, direction]);

  const loadGroups = useCallback(async () => {
    setGroupsLoading(true);
    try {
      const { data } = await listContactGroups({ limit: 100 });
      setGroups(data.records || []);
    } catch {
      setGroups([]);
    } finally {
      setGroupsLoading(false);
    }
  }, []);

  const loadSegments = useCallback(async () => {
    setSegmentsLoading(true);
    try {
      const { data } = await api.get('/segments', { params: { limit: 100 } });
      setSegments(data.records || []);
    } catch {
      setSegments([]);
    } finally {
      setSegmentsLoading(false);
    }
  }, []);

  const loadImportHistory = useCallback(async () => {
    setImportHistoryLoading(true);
    try {
      const { data } = await listImports({ limit: 50 });
      setImportHistory(data.jobs || []);
    } catch {
      setImportHistory([]);
    } finally {
      setImportHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    loadStats();
    loadGroups();
    loadSegments();
    loadImportHistory();
  }, [loadStats, loadGroups, loadSegments, loadImportHistory]);

  const refreshDetail = useCallback(
    async (id) => {
      try {
        const { data } = await getContact(id);
        setDetail(data.contact);
        setActivities(data.activities || []);
        await Promise.all([loadList(), loadStats()]);
      } catch (err) {
        setDetail(null);
        toast.error(errorMessage(err));
      }
    },
    [loadList, loadStats]
  );

  const openProfile = async (id) => {
    try {
      const { data } = await getContact(id);
      setDetail(data.contact);
      setActivities(data.activities || []);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const onSaveContact = async (payload) => {
    if (editor?._id) {
      await updateContact(editor._id, payload);
      toast.success('Contact updated');
      if (detail?._id === editor._id) await refreshDetail(editor._id);
    } else {
      await createContact(payload);
      toast.success('Property contact added');
    }
    await Promise.all([loadList(), loadStats(), loadGroups()]);
  };

  const setFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  const resetFilters = () => {
    setFilters(blankFilters);
    setSearchInput('');
    setSearch('');
    setPage(1);
  };

  const selectedOnPage = records.length > 0 && records.every((record) => selected.includes(record._id));
  const toggleAll = () =>
    setSelected((current) =>
      selectedOnPage
        ? current.filter((id) => !records.some((record) => record._id === id))
        : [...new Set([...current, ...records.map((row) => row._id)])]
    );
  const toggleOne = (id) =>
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));

  const requestSort = (field) => {
    if (sort === field) setDirection((value) => (value === 'asc' ? 'desc' : 'asc'));
    else {
      setSort(field);
      setDirection('asc');
    }
    setPage(1);
  };

  const doExport = async (format, ids, filtersOverride) => {
    try {
      await downloadContacts({
        format,
        ids,
        filters: filtersOverride || { ...filterParams, search, sort, direction }
      });
      toast.success(`Exported contacts as ${format.toUpperCase()}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setExportOpen(false);
    }
  };

  const performBulk = async () => {
    if (!selected.length) return toast.error('Select at least one contact.');
    if (
      ['archive', 'delete', 'suppress'].includes(bulkAction) &&
      !window.confirm(
        bulkAction === 'delete'
          ? `Move ${selected.length} contact(s) to deleted records?`
          : bulkAction === 'suppress'
          ? `Mark ${selected.length} contact(s) as Do Not Contact (Suppressed)?`
          : `Archive ${selected.length} contact(s)?`
      )
    )
      return;

    let value = bulkValue;
    if (bulkAction === 'addTags' || bulkAction === 'removeTags') {
      value = bulkValue.split(',').map((tag) => tag.trim()).filter(Boolean);
    }

    try {
      const { data } = await bulkContacts({ ids: selected, action: bulkAction, value });
      toast.success(`${data.updatedCount} contact(s) updated`);
      setSelected([]);
      setBulkOpen(false);
      await Promise.all([loadList(), loadStats(), loadGroups()]);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const quickAction = async (action, contact) => {
    if (action === 'delete' && !window.confirm(`Move ${contact.fullName} to deleted records?`)) return;
    if (action === 'archive' && !window.confirm(`Archive ${contact.fullName}?`)) return;
    try {
      if (action === 'delete') await deleteContact(contact._id);
      else if (action === 'archive') await archiveContact(contact._id);
      else await restoreContact(contact._id);
      toast.success(
        action === 'delete' ? 'Contact deleted' : action === 'archive' ? 'Contact archived' : 'Contact restored'
      );
      setSelected((current) => current.filter((id) => id !== contact._id));
      await Promise.all([loadList(), loadStats()]);
      if (detail?._id === contact._id) setDetail(null);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const handleDeleteGroup = async (groupId, groupName) => {
    if (!window.confirm(`Delete group "${groupName}"? Member contacts will NOT be deleted.`)) return;
    try {
      await deleteContactGroup(groupId);
      toast.success(`Group "${groupName}" deleted`);
      await Promise.all([loadGroups(), loadList()]);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const handleDeleteSegment = async (segmentId, segmentName) => {
    if (!window.confirm(`Delete audience segment "${segmentName}"?`)) return;
    try {
      await api.delete(`/segments/${segmentId}`);
      toast.success(`Segment "${segmentName}" deleted`);
      await loadSegments();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const handleDuplicateSegment = async (segmentId) => {
    try {
      await api.post(`/segments/${segmentId}/duplicate`);
      toast.success('Segment duplicated');
      await loadSegments();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const activeFilterCount = Object.entries(filters).filter(([key, value]) => value !== blankFilters[key]).length;

  // 4 compact statistics from backend truth
  const totalContactsCount = stats?.totalContacts ?? 0;
  const optedInCount = stats?.eligibleWhatsAppContacts ?? 0;
  const optedOutCount = stats?.optedOutContacts ?? 0;
  const unknownConsentCount = stats?.unknownConsentContacts ?? 0;

  return (
    <div className="contacts-page">
      {/* SECTION A: PAGE HEADER & PRIMARY ACTIONS */}
      <PageHeader
        eyebrow="YOUR WORKSPACE · CONTACTS & AUDIENCE"
        title="Contacts & Audiences"
        subtitle="Manage customer enquiries, organize property groups, and build verified campaign audiences."
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button className="primary-btn small" onClick={() => setEditor(null)}>
              <Plus size={15} /> Add Contact
            </button>

            <button className="outline-btn small" onClick={() => setImportModalOpen(true)} title="Import Excel / CSV spreadsheet">
              <FileSpreadsheet size={14} /> Import Excel / CSV
            </button>

            <div style={{ position: 'relative' }}>
              <button className="outline-btn small" onClick={() => { setExportOpen((v) => !v); setMoreActionsOpen(false); }}>
                <Download size={14} /> Export <ChevronDown size={12} />
              </button>
              {exportOpen && (
                <div className="export-menu">
                  <button onClick={() => doExport('csv')}>Export Filtered CSV</button>
                  <button onClick={() => doExport('xlsx')}>Export Filtered Excel</button>
                  <button onClick={() => doExport('csv', undefined, { archived: 'all' })}>
                    Export All Contacts CSV
                  </button>
                  <button onClick={() => doExport('xlsx', undefined, { archived: 'all' })}>
                    Export All Contacts Excel
                  </button>
                  {selected.length > 0 && (
                    <>
                      <button onClick={() => doExport('csv', selected)}>
                        Export Selected CSV ({selected.length})
                      </button>
                      <button onClick={() => doExport('xlsx', selected)}>
                        Export Selected Excel ({selected.length})
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            <div style={{ position: 'relative' }}>
              <button className="outline-btn small" onClick={() => { setMoreActionsOpen((v) => !v); setExportOpen(false); }}>
                More Actions <ChevronDown size={12} />
              </button>
              {moreActionsOpen && (
                <div className="export-menu" style={{ minWidth: '190px' }}>
                  <button onClick={() => { setMoreActionsOpen(false); downloadTemplate(); }}>
                    <ArrowDownToLine size={13} style={{ marginRight: '6px' }} /> Sample Excel Template
                  </button>
                  <button onClick={() => { setMoreActionsOpen(false); setTagModalOpen(true); }}>
                    <Tag size={13} style={{ marginRight: '6px' }} /> Manage Tags
                  </button>
                  <button onClick={() => { setMoreActionsOpen(false); setGroupEditing(null); setGroupModalOpen(true); }}>
                    <Layers size={13} style={{ marginRight: '6px' }} /> Manage Groups
                  </button>
                  <button onClick={() => { setMoreActionsOpen(false); setSegmentEditing(null); setSegmentModalOpen(true); }}>
                    <Filter size={13} style={{ marginRight: '6px' }} /> Saved Segments
                  </button>
                </div>
              )}
            </div>

            <button
              className="icon-btn"
              onClick={() => {
                loadList();
                loadStats();
                loadGroups();
                loadSegments();
              }}
              title="Refresh"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        }
      />

      {/* SECTION B: COMPACT CONTACT STATISTICS */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-head">
            <span>Total Contacts</span>
            <ContactRound size={16} className="text-muted" />
          </div>
          <div className="stat-value">{loading ? '—' : totalContactsCount.toLocaleString()}</div>
          <div className="stat-foot">Real estate client database</div>
        </div>

        <div className="stat-card">
          <div className="stat-head">
            <span>Verified Opted-In</span>
            <ShieldCheck size={16} color="var(--color-success)" />
          </div>
          <div className="stat-value" style={{ color: 'var(--color-success)' }}>
            {loading ? '—' : optedInCount.toLocaleString()}
          </div>
          <div className="stat-foot">Affirmative evidence on file</div>
        </div>

        <div className="stat-card">
          <div className="stat-head">
            <span>Opted Out</span>
            <ShieldAlert size={16} color="var(--color-danger)" />
          </div>
          <div className="stat-value" style={{ color: 'var(--color-danger)' }}>
            {loading ? '—' : optedOutCount.toLocaleString()}
          </div>
          <div className="stat-foot">Excluded from broadcasts</div>
        </div>

        <div className="stat-card">
          <div className="stat-head">
            <span>Consent Unknown</span>
            <Clock3 size={16} color="var(--color-warning)" />
          </div>
          <div className="stat-value" style={{ color: 'var(--color-warning)' }}>
            {loading ? '—' : unknownConsentCount.toLocaleString()}
          </div>
          <div className="stat-foot">Requires affirmative consent</div>
        </div>
      </div>

      {/* WORKSPACE NAVIGATION TABS: All Contacts | Groups | Saved Audiences | Import History */}
      <div className="contacts-workspace-tabs">
        <button
          type="button"
          className={`contacts-tab-btn ${activeTab === 'contacts' ? 'active' : ''}`}
          onClick={() => switchTab('contacts')}
        >
          <ContactRound size={15} />
          All Contacts
          <span className="contacts-tab-count">{totalContactsCount}</span>
        </button>

        <button
          type="button"
          className={`contacts-tab-btn ${activeTab === 'groups' ? 'active' : ''}`}
          onClick={() => switchTab('groups')}
        >
          <Layers size={15} />
          Contact Groups
          <span className="contacts-tab-count">{groups.length}</span>
        </button>

        <button
          type="button"
          className={`contacts-tab-btn ${activeTab === 'audiences' ? 'active' : ''}`}
          onClick={() => switchTab('audiences')}
        >
          <Filter size={15} />
          Saved Audiences (Segments)
          <span className="contacts-tab-count">{segments.length}</span>
        </button>

        <button
          type="button"
          className={`contacts-tab-btn ${activeTab === 'imports' ? 'active' : ''}`}
          onClick={() => switchTab('imports')}
        >
          <History size={15} />
          Import History
          <span className="contacts-tab-count">{importHistory.length}</span>
        </button>
      </div>

      {/* TAB 1: ALL CONTACTS WORKSPACE */}
      {activeTab === 'contacts' && (
        <section className="panel" style={{ marginBottom: '24px' }}>
          {/* SECTION C: SEARCH AND MAIN FILTERS */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 16px',
              flexWrap: 'wrap',
              borderBottom: '1px solid var(--color-border-subtle)'
            }}
          >
            {/* Search Input */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flex: '1',
                minWidth: '220px',
                background: 'var(--color-surface-muted)',
                border: '1px solid var(--color-border)',
                borderRadius: '8px',
                padding: '0 10px',
                height: '36px'
              }}
            >
              <Search size={15} color="var(--color-text-muted)" />
              <input
                style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '13px' }}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search name, phone, city, project, tags…"
                aria-label="Search contacts"
              />
              {searchInput && (
                <button
                  onClick={() => setSearchInput('')}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-muted)' }}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Quick Filters */}
            <select
              value={filters.whatsappConsentStatus}
              onChange={(e) => setFilter('whatsappConsentStatus', e.target.value)}
              style={{ height: '36px', borderRadius: '8px', border: '1px solid var(--color-border)', padding: '0 10px', fontSize: '12.5px', background: '#fff', outline: 'none' }}
            >
              <option value="">All Consent</option>
              {CONSENTS.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>

            <select
              value={filters.interestedPropertyType}
              onChange={(e) => setFilter('interestedPropertyType', e.target.value)}
              style={{ height: '36px', borderRadius: '8px', border: '1px solid var(--color-border)', padding: '0 10px', fontSize: '12.5px', background: '#fff', outline: 'none' }}
            >
              <option value="">All Property Types</option>
              {PROPERTY_TYPES.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>

            <select
              value={filters.leadStatus}
              onChange={(e) => setFilter('leadStatus', e.target.value)}
              style={{ height: '36px', borderRadius: '8px', border: '1px solid var(--color-border)', padding: '0 10px', fontSize: '12.5px', background: '#fff', outline: 'none' }}
            >
              <option value="">All Lead Statuses</option>
              {STATUSES.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>

            {groups.length > 0 && (
              <select
                value={filters.group}
                onChange={(e) => setFilter('group', e.target.value)}
                style={{ height: '36px', borderRadius: '8px', border: '1px solid var(--color-border)', padding: '0 10px', fontSize: '12.5px', background: '#fff', outline: 'none' }}
              >
                <option value="">All Groups</option>
                {groups.map((g) => (
                  <option key={g._id} value={g._id}>{g.name}</option>
                ))}
              </select>
            )}

            <button
              className={`outline-btn small ${moreFiltersOpen ? 'active' : ''}`}
              onClick={() => setMoreFiltersOpen((v) => !v)}
              style={{ height: '36px' }}
            >
              <Filter size={13} /> More Filters {activeFilterCount > 0 && `(${activeFilterCount})`}{' '}
              <ChevronDown size={12} />
            </button>

            {activeFilterCount > 0 && (
              <button className="text-link" onClick={resetFilters} style={{ fontSize: '12px' }}>
                Reset Filters
              </button>
            )}

            {selected.length > 0 && (
              <button
                className="primary-btn small"
                onClick={() => setBulkOpen((v) => !v)}
                style={{ marginLeft: 'auto', height: '36px' }}
              >
                <MoreHorizontal size={14} /> Bulk Actions ({selected.length})
              </button>
            )}
          </div>

          {/* More Filters Drawer / Popover */}
          {moreFiltersOpen && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                gap: '12px',
                padding: '14px 16px',
                background: 'var(--color-surface-muted)',
                borderBottom: '1px solid var(--color-border)'
              }}
            >
              <label className="field">
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>City / Location</span>
                <input
                  value={filters.city}
                  onChange={(e) => setFilter('city', e.target.value)}
                  placeholder="e.g. Gurugram, Delhi"
                />
              </label>

              <label className="field">
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Project / Community</span>
                <input
                  value={filters.interestedProject}
                  onChange={(e) => setFilter('interestedProject', e.target.value)}
                  placeholder="e.g. DLF Privana"
                />
              </label>

              <label className="field">
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Priority</span>
                <select value={filters.priority} onChange={(e) => setFilter('priority', e.target.value)}>
                  <option value="">All Priorities</option>
                  {PRIORITIES.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Tag</span>
                <input
                  value={filters.tag}
                  onChange={(e) => setFilter('tag', e.target.value)}
                  placeholder="e.g. Plot Enquiry, NRI"
                />
              </label>

              <label className="field">
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Lead Source</span>
                <input
                  value={filters.source}
                  onChange={(e) => setFilter('source', e.target.value)}
                  placeholder="e.g. Website, 99acres"
                />
              </label>

              <label className="field">
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Suppression Status</span>
                <select value={filters.isSuppressed} onChange={(e) => setFilter('isSuppressed', e.target.value)}>
                  <option value="">All Records</option>
                  <option value="false">Active Only (Non-Suppressed)</option>
                  <option value="true">Do Not Contact (Suppressed)</option>
                </select>
              </label>

              <label className="field">
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Archive Status</span>
                <select value={filters.archived} onChange={(e) => setFilter('archived', e.target.value)}>
                  <option value="false">Active Only</option>
                  <option value="true">Archived Only</option>
                  <option value="all">All Records</option>
                </select>
              </label>

              <label className="field">
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Data Classification</span>
                <select value={filters.isDemo} onChange={(e) => setFilter('isDemo', e.target.value)}>
                  <option value="">All Contacts</option>
                  <option value="false">Genuine Customers Only</option>
                  <option value="true">Demo Fixtures Only</option>
                </select>
              </label>
            </div>
          )}

          {/* SECTION E: BULK ACTION TOOLBAR */}
          {bulkOpen && selected.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 16px',
                background: 'var(--color-primary-soft)',
                borderBottom: '1px solid var(--color-primary-border)',
                flexWrap: 'wrap'
              }}
            >
              <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--color-primary)' }}>
                {selected.length} contact(s) selected
              </span>

              <select
                value={bulkAction}
                onChange={(e) => {
                  setBulkAction(e.target.value);
                  setBulkValue(
                    e.target.value === 'status'
                      ? 'New'
                      : e.target.value === 'priority'
                      ? 'Medium'
                      : e.target.value === 'addToGroup' && groups.length
                      ? groups[0]._id
                      : ''
                  );
                }}
                style={{ height: '32px', borderRadius: '6px', border: '1px solid var(--color-border)', padding: '0 8px', fontSize: '12px' }}
              >
                <option value="status">Change Lead Status</option>
                <option value="priority">Change Priority</option>
                <option value="addTags">Add Tags</option>
                <option value="removeTags">Remove Tags</option>
                {groups.length > 0 && <option value="addToGroup">Add to Group</option>}
                {groups.length > 0 && <option value="removeFromGroup">Remove from Group</option>}
                <option value="suppress">Mark Do Not Contact (Suppress)</option>
                <option value="unsuppress">Remove Suppression</option>
                <option value="archive">Archive Contacts</option>
                <option value="restore">Restore Contacts</option>
                <option value="delete">Move to Deleted</option>
              </select>

              {bulkAction === 'status' && (
                <select
                  value={bulkValue}
                  onChange={(e) => setBulkValue(e.target.value)}
                  style={{ height: '32px', borderRadius: '6px', border: '1px solid var(--color-border)', padding: '0 8px', fontSize: '12px' }}
                >
                  {STATUSES.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              )}

              {bulkAction === 'priority' && (
                <select
                  value={bulkValue}
                  onChange={(e) => setBulkValue(e.target.value)}
                  style={{ height: '32px', borderRadius: '6px', border: '1px solid var(--color-border)', padding: '0 8px', fontSize: '12px' }}
                >
                  {PRIORITIES.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              )}

              {['addTags', 'removeTags'].includes(bulkAction) && (
                <input
                  value={bulkValue}
                  onChange={(e) => setBulkValue(e.target.value)}
                  placeholder="tag one, tag two"
                  style={{ height: '32px', borderRadius: '6px', border: '1px solid var(--color-border)', padding: '0 8px', fontSize: '12px' }}
                />
              )}

              {['addToGroup', 'removeFromGroup'].includes(bulkAction) && (
                <select
                  value={bulkValue}
                  onChange={(e) => setBulkValue(e.target.value)}
                  style={{ height: '32px', borderRadius: '6px', border: '1px solid var(--color-border)', padding: '0 8px', fontSize: '12px' }}
                >
                  {groups.map((g) => (
                    <option key={g._id} value={g._id}>{g.name}</option>
                  ))}
                </select>
              )}

              <button className="primary-btn small" onClick={performBulk} style={{ height: '32px' }}>
                Apply
              </button>

              <button className="outline-btn small" onClick={() => setSelected([])} style={{ height: '32px' }}>
                Cancel Selection
              </button>
            </div>
          )}

          {/* SECTION D: CONTACT TABLE */}
          <div className="table-wrap" style={{ border: 'none', borderRadius: '0' }}>
            <table className="contacts-table">
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selectedOnPage}
                      onChange={toggleAll}
                      aria-label="Select all contacts on this page"
                    />
                  </th>
                  <th>
                    <button
                      onClick={() => requestSort('fullName')}
                      style={{ border: 'none', background: 'transparent', font: 'inherit', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                    >
                      Contact <ChevronsUpDown size={12} />
                    </button>
                  </th>
                  <th>Phone / WhatsApp</th>
                  <th>City / Location</th>
                  <th>Property Interest</th>
                  <th>Project / Community</th>
                  <th>Lead Status</th>
                  <th>Priority</th>
                  <th>WhatsApp Consent</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 6 }, (_, index) => (
                    <tr key={`skeleton-${index}`} className="skeleton-row">
                      {Array.from({ length: 10 }, (_, i) => (
                        <td key={i}>
                          <div style={{ height: '14px', background: 'var(--color-surface-subtle)', borderRadius: '4px' }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : error ? (
                  <tr>
                    <td colSpan="10">
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '36px', textAlign: 'center' }}>
                        <CircleAlert size={24} color="var(--color-danger)" style={{ marginBottom: '8px' }} />
                        <strong style={{ fontSize: '14px' }}>Could not load contacts</strong>
                        <p style={{ fontSize: '12.5px', color: 'var(--color-text-muted)', margin: '4px 0 12px' }}>{error}</p>
                        <button className="outline-btn small" onClick={loadList}>
                          Try Again
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan="10">
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 16px', textAlign: 'center' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--color-surface-muted)', display: 'grid', placeItems: 'center', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
                          <ContactRound size={24} />
                        </div>
                        <strong style={{ fontSize: '15px', color: 'var(--color-text-primary)' }}>
                          {search || activeFilterCount ? 'No matching contacts found' : 'No contacts yet'}
                        </strong>
                        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', maxWidth: '340px', margin: '4px 0 16px' }}>
                          {search || activeFilterCount
                            ? 'Try adjusting your search terms or clearing active filters.'
                            : 'Import your Excel property enquiry sheet or add your first customer manually.'}
                        </p>
                        {search || activeFilterCount ? (
                          <button className="outline-btn small" onClick={resetFilters}>
                            Reset All Filters
                          </button>
                        ) : (
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="outline-btn small" onClick={() => setImportModalOpen(true)}>
                              <FileSpreadsheet size={14} /> Import Excel / CSV
                            </button>
                            <button className="primary-btn small" onClick={() => setEditor(null)}>
                              <Plus size={14} /> Add Contact
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  records.map((contact) => (
                    <tr
                      key={contact._id}
                      className={`${selected.includes(contact._id) ? 'is-selected' : ''} ${contact.isArchived ? 'is-archived' : ''}`}
                    >
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={selected.includes(contact._id)}
                          onChange={() => toggleOne(contact._id)}
                          aria-label={`Select ${contact.fullName}`}
                        />
                      </td>
                      <td>
                        <button
                          onClick={() => openProfile(contact._id)}
                          style={{ border: 'none', background: 'transparent', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: 0 }}
                        >
                          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--color-primary-soft)', color: 'var(--color-primary)', display: 'grid', placeItems: 'center', fontSize: '12px', fontWeight: 700 }}>
                            {initials(contact.fullName)}
                          </div>
                          <div>
                            <strong style={{ fontSize: '13.5px', color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {contact.fullName}
                              {(contact.isDemo || contact.customFields?.isDemo || contact.tags?.includes('demo')) && (
                                <span className="neutral-chip" style={{ fontSize: '9.5px', padding: '1px 5px', background: '#F1F5F9', color: '#64748B', fontWeight: 600 }}>
                                  DEMO
                                </span>
                              )}
                            </strong>
                            <span style={{ fontSize: '11.5px', color: 'var(--color-text-muted)' }}>
                              {contact.email || 'No email'}
                            </span>
                          </div>
                        </button>
                      </td>
                      <td>
                        <span style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}>{contact.phoneNumber}</span>
                        {contact.alternatePhone && (
                          <small style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                            Alt: {contact.alternatePhone}
                          </small>
                        )}
                      </td>
                      <td>
                        <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                          {contact.city || contact.location || '—'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                          {contact.interestedPropertyType || contact.interestedService || '—'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                          {contact.interestedProject || contact.businessCategory || '—'}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${statusClass(contact.leadStatus)}`}>{contact.leadStatus}</span>
                      </td>
                      <td>
                        <span className={`priority-badge ${priorityClass(contact.priority)}`}>
                          <i /> {contact.priority}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <span className={`consent-badge consent-${consentClass(contact.whatsappConsentStatus)}`}>
                            {contact.whatsappConsentStatus}
                          </span>
                          {contact.isSuppressed && (
                            <span style={{ fontSize: '10px', color: 'var(--color-danger)', fontWeight: 600 }}>
                              Suppressed
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <button className="icon-btn" title="View Details" onClick={() => openProfile(contact._id)}>
                            <Eye size={14} />
                          </button>
                          <button
                            className="icon-btn"
                            title="Preview Message in Templates"
                            onClick={() => navigate(`/templates?contact=${encodeURIComponent(contact._id)}`)}
                          >
                            <MessageSquareText size={14} />
                          </button>
                          <button className="icon-btn" title="Edit Contact" onClick={() => setEditor(contact)}>
                            <Pencil size={14} />
                          </button>
                          <button
                            className="icon-btn"
                            title={contact.isArchived ? 'Restore' : 'Archive'}
                            onClick={() => quickAction(contact.isArchived ? 'restore' : 'archive', contact)}
                          >
                            <Archive size={14} />
                          </button>
                          <button className="icon-btn text-danger" title="Delete" onClick={() => quickAction('delete', contact)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* TABLE FOOTER / PAGINATION */}
          <footer className="contacts-footer">
            <span>
              Showing <b>{total === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)}</b> of{' '}
              <b>{total}</b> contacts
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                Rows per page
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  style={{ height: '28px', borderRadius: '6px', border: '1px solid var(--color-border)', fontSize: '12px' }}
                >
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
              </label>
              <button
                className="outline-btn small"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => p - 1)}
                style={{ width: '30px', padding: 0 }}
              >
                <ArrowLeft size={13} />
              </button>
              <span style={{ fontSize: '12px', minWidth: '36px', textAlign: 'center' }}>
                {page} / {Math.max(1, Math.ceil(total / pageSize))}
              </span>
              <button
                className="outline-btn small"
                disabled={page >= Math.ceil(total / pageSize) || loading}
                onClick={() => setPage((p) => p + 1)}
                style={{ width: '30px', padding: 0 }}
              >
                <ArrowRight size={13} />
              </button>
            </div>
          </footer>
        </section>
      )}

      {/* TAB 2: CONTACT GROUPS */}
      {activeTab === 'groups' && (
        <section className="panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Static Contact Groups</h2>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>
                Organize prospects into fixed audience lists. Deleting a group never deletes contacts.
              </p>
            </div>
            <button
              className="primary-btn small"
              onClick={() => {
                setGroupEditing(null);
                setGroupModalOpen(true);
              }}
            >
              <Plus size={14} /> Create New Group
            </button>
          </div>

          {groupsLoading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              Loading groups...
            </div>
          ) : groups.length === 0 ? (
            <div style={{ padding: '48px 16px', textAlign: 'center' }}>
              <Layers size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
              <strong style={{ fontSize: '15px', display: 'block', marginBottom: '4px' }}>No contact groups yet</strong>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 16px' }}>
                Create reusable groups like "Gurugram Enquiries" or "Farmhouse Buyers" to organize broadcasts.
              </p>
              <button
                className="primary-btn small"
                onClick={() => {
                  setGroupEditing(null);
                  setGroupModalOpen(true);
                }}
              >
                <Plus size={14} /> Create Your First Group
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {groups.map((group) => (
                <div
                  key={group._id}
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '10px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: 'var(--shadow-xs)'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '14px', color: 'var(--color-text-primary)' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: group.color || 'var(--color-primary)' }} />
                        {group.name}
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: 600, padding: '2px 8px', borderRadius: '12px', background: 'var(--color-surface-muted)', color: 'var(--color-text-secondary)' }}>
                        {group.contactCount || 0} contacts
                      </span>
                    </div>
                    {group.description && (
                      <p style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)', margin: '0 0 12px', lineHeight: 1.4 }}>
                        {group.description}
                      </p>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '12px', borderTop: '1px solid var(--color-border-subtle)', marginTop: '8px' }}>
                    <button
                      className="text-action"
                      style={{ fontSize: '12px' }}
                      onClick={() => {
                        setFilter('group', group._id);
                        switchTab('contacts');
                      }}
                    >
                      View Members ({group.contactCount || 0})
                    </button>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        className="icon-btn"
                        title="Edit Group"
                        onClick={() => {
                          setGroupEditing(group);
                          setGroupModalOpen(true);
                        }}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        className="icon-btn text-danger"
                        title="Delete Group"
                        onClick={() => handleDeleteGroup(group._id, group.name)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* TAB 3: SAVED AUDIENCES (DYNAMIC & STATIC SEGMENTS) */}
      {activeTab === 'audiences' && (
        <section className="panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Saved Audiences & Dynamic Segments</h2>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>
                Reusable condition filters for campaigns. Counts recalculate automatically against live MongoDB contacts.
              </p>
            </div>
            <button
              className="primary-btn small"
              onClick={() => {
                setSegmentEditing(null);
                setSegmentModalOpen(true);
              }}
            >
              <Plus size={14} /> New Dynamic Segment
            </button>
          </div>

          {segmentsLoading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              Loading segments...
            </div>
          ) : segments.length === 0 ? (
            <div style={{ padding: '48px 16px', textAlign: 'center' }}>
              <Filter size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
              <strong style={{ fontSize: '15px', display: 'block', marginBottom: '4px' }}>No saved segments yet</strong>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 16px' }}>
                Build dynamic rule-based audiences such as "Gurugram Plot Enquiries with Budget &gt; ₹2 Cr" for automated campaigns.
              </p>
              <button
                className="primary-btn small"
                onClick={() => {
                  setSegmentEditing(null);
                  setSegmentModalOpen(true);
                }}
              >
                <Plus size={14} /> Create Segment
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
              {segments.map((seg) => (
                <div
                  key={seg._id}
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '10px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: 'var(--shadow-xs)'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <strong style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>{seg.name}</strong>
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '2px 7px',
                          borderRadius: '4px',
                          background: seg.segmentType === 'dynamic' ? 'var(--color-primary-soft)' : 'var(--color-surface-muted)',
                          color: seg.segmentType === 'dynamic' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                          fontWeight: 600
                        }}
                      >
                        {seg.segmentType}
                      </span>
                    </div>

                    {seg.description && (
                      <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '0 0 10px', lineHeight: 1.4 }}>
                        {seg.description}
                      </p>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
                      <CheckCircle2 size={13} color="var(--color-primary)" />
                      <span><b>{seg.totalMatchingContacts ?? seg.memberCount ?? 0}</b> matching contacts</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '10px', borderTop: '1px solid var(--color-border-subtle)' }}>
                    <button
                      className="text-action"
                      style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      onClick={() => navigate('/campaigns/new')}
                    >
                      Use in Campaign <ExternalLink size={11} />
                    </button>

                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        className="icon-btn"
                        title="Duplicate Segment"
                        onClick={() => handleDuplicateSegment(seg._id)}
                      >
                        <Copy size={13} />
                      </button>
                      <button
                        className="icon-btn"
                        title="Edit Segment Rules"
                        onClick={() => {
                          setSegmentEditing(seg);
                          setSegmentModalOpen(true);
                        }}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        className="icon-btn text-danger"
                        title="Delete Segment"
                        onClick={() => handleDeleteSegment(seg._id, seg.name)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* TAB 4: IMPORT HISTORY */}
      {activeTab === 'imports' && (
        <section className="panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Spreadsheet Import History</h2>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>
                Audit log of all uploaded spreadsheets, processed rows, and downloadable error reports.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="outline-btn small" onClick={loadImportHistory}>
                <RefreshCw size={13} /> Refresh
              </button>
              <button className="primary-btn small" onClick={() => setImportModalOpen(true)}>
                <FileSpreadsheet size={14} /> Import Another File
              </button>
            </div>
          </div>

          {importHistoryLoading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              Loading import history...
            </div>
          ) : importHistory.length === 0 ? (
            <div style={{ padding: '48px 16px', textAlign: 'center' }}>
              <FileSpreadsheet size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
              <strong style={{ fontSize: '15px', display: 'block', marginBottom: '4px' }}>No previous imports</strong>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 16px' }}>
                Upload your first contact sheet to populate your database with phone normalization and duplicate checks.
              </p>
              <button className="primary-btn small" onClick={() => setImportModalOpen(true)}>
                <FileSpreadsheet size={14} /> Start Contact Import
              </button>
            </div>
          ) : (
            <div className="table-wrap" style={{ border: '1px solid var(--color-border)', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                <thead>
                  <tr style={{ background: 'var(--color-surface-muted)', borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Batch Name</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Filename</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Uploaded</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>Total Rows</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>Created</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>Updated</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>Skipped</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>Failed</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>Status</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {importHistory.map((job) => (
                    <tr key={job._id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 600 }}>{job.batchName}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--color-text-secondary)' }}>{job.originalFilename}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--color-text-muted)' }}>{formatDate(job.createdAt)}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>{job.totalRows}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', color: 'var(--color-primary)', fontWeight: 600 }}>{job.createdCount}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', color: 'var(--color-info)' }}>{job.updatedCount}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', color: 'var(--color-warning)' }}>{job.skippedCount}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', color: job.failedCount > 0 ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>{job.failedCount}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '2px 7px',
                            borderRadius: '4px',
                            background: job.status === 'Completed' ? 'var(--color-success-soft)' : job.status === 'Completed With Errors' ? 'var(--color-warning-soft)' : 'var(--color-surface-muted)',
                            color: job.status === 'Completed' ? 'var(--color-success)' : job.status === 'Completed With Errors' ? 'var(--color-warning)' : 'var(--color-text-secondary)'
                          }}
                        >
                          {job.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          {(job.failedCount > 0 || job.invalidCount > 0 || job.skippedCount > 0) && (
                            <button
                              className="icon-btn"
                              title="Download Error Report CSV"
                              onClick={() => downloadImportErrors(job._id, job.batchName)}
                            >
                              <Download size={13} />
                            </button>
                          )}
                          {job.status === 'Completed With Errors' && job.failedCount > 0 && (
                            <button
                              className="outline-btn small"
                              style={{ fontSize: '11px', height: '26px' }}
                              onClick={async () => {
                                try {
                                  await retryImport(job._id);
                                  toast.success('Retry started');
                                  await loadImportHistory();
                                } catch (err) {
                                  toast.error(errorMessage(err));
                                }
                              }}
                            >
                              Retry Failed
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* MODALS */}
      {editor !== undefined && (
        <ContactFormModal
          contact={editor || undefined}
          onClose={() => setEditor(undefined)}
          onSave={onSaveContact}
        />
      )}

      {tagModalOpen && (
        <TagManagerModal
          onClose={() => setTagModalOpen(false)}
          onTagsChanged={() => {
            loadList();
            loadStats();
          }}
        />
      )}

      {groupModalOpen && (
        <ContactGroupModal
          group={groupEditing}
          onClose={() => {
            setGroupModalOpen(false);
            setGroupEditing(null);
          }}
          onSaved={() => {
            loadGroups();
            loadList();
          }}
        />
      )}

      {segmentModalOpen && (
        <DynamicSegmentModal
          segment={segmentEditing}
          onClose={() => {
            setSegmentModalOpen(false);
            setSegmentEditing(null);
          }}
          onSaved={() => {
            loadSegments();
          }}
        />
      )}

      {importModalOpen && (
        <ImportWizardModal
          onClose={() => setImportModalOpen(false)}
          onImportCompleted={async () => {
            await Promise.all([loadList(), loadStats(), loadImportHistory()]);
          }}
        />
      )}

      {/* SECTION F: CONTACT DETAIL DRAWER */}
      {detail && (
        <ContactProfile
          key={detail._id}
          contact={detail}
          activities={activities}
          groups={groups}
          onClose={() => setDetail(null)}
          onEdit={(contact) => {
            setDetail(null);
            setEditor(contact);
          }}
          onRefresh={refreshDetail}
        />
      )}
    </div>
  );
}
