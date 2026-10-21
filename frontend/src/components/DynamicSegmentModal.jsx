import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Eye, Sparkles, AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

const RULE_FIELDS = [
  { value: 'city', label: 'Target City' },
  { value: 'interestedPropertyType', label: 'Interested Property Type' },
  { value: 'interestedProject', label: 'Project / Community' },
  { value: 'preferredLocation', label: 'Preferred Location' },
  { value: 'budgetRange', label: 'Budget Range' },
  { value: 'tags', label: 'Contact Tag' },
  { value: 'leadSource', label: 'Lead Source' },
  { value: 'leadStatus', label: 'Lead Status' },
  { value: 'priority', label: 'Priority' },
  { value: 'whatsappConsentStatus', label: 'Consent Status' },
  { value: 'isSuppressed', label: 'Suppression (Do Not Contact)' },
  { value: 'isDemo', label: 'Demo Record Flag' }
];

const RULE_OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'notEquals', label: 'Does Not Equal' },
  { value: 'contains', label: 'Contains' },
  { value: 'inList', label: 'In List (comma separated)' },
  { value: 'isEmpty', label: 'Is Empty / Not Set' },
  { value: 'isNotEmpty', label: 'Is Set / Not Empty' }
];

export default function DynamicSegmentModal({ segment, onClose, onSaved }) {
  const [name, setName] = useState(segment?.name || '');
  const [description, setDescription] = useState(segment?.description || '');
  const [segmentType, setSegmentType] = useState(segment?.segmentType || 'dynamic');
  const [conjunction, setConjunction] = useState(segment?.filterDefinition?.conjunction || 'AND');
  const [conditions, setConditions] = useState(() => {
    if (segment?.filterDefinition?.conditions?.length) {
      return segment.filterDefinition.conditions.map(c => ({
        field: c.field || 'city',
        operator: c.operator || 'equals',
        value: c.value ?? ''
      }));
    }
    return [{ field: 'city', operator: 'equals', value: '' }];
  });

  const [previewCount, setPreviewCount] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const addCondition = () => {
    if (conditions.length >= 20) {
      toast.error('Maximum 20 conditions per segment');
      return;
    }
    setConditions(curr => [...curr, { field: 'interestedPropertyType', operator: 'equals', value: '' }]);
  };

  const removeCondition = (index) => {
    setConditions(curr => curr.filter((_, i) => i !== index));
  };

  const updateCondition = (index, key, val) => {
    setConditions(curr => {
      const next = [...curr];
      next[index] = { ...next[index], [key]: val };
      return next;
    });
  };

  const runPreview = async () => {
    setPreviewLoading(true);
    setError('');
    try {
      const filterDef = {
        conjunction,
        conditions: conditions.filter(c => ['isEmpty', 'isNotEmpty'].includes(c.operator) || String(c.value).trim())
      };
      const { data } = await api.post('/segments/preview', { filters: filterDef });
      setPreviewCount(data.total);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to preview matching contacts');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a segment name');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const cleanConditions = conditions.filter(c => ['isEmpty', 'isNotEmpty'].includes(c.operator) || String(c.value).trim());
      const body = {
        name: name.trim(),
        description: description.trim(),
        segmentType,
        filterDefinition: segmentType === 'dynamic' ? {
          conjunction,
          conditions: cleanConditions
        } : {}
      };

      if (segment?._id) {
        await api.patch(`/segments/${segment._id}`, body);
        toast.success(`Dynamic segment "${name}" updated`);
      } else {
        await api.post('/segments', body);
        toast.success(`Dynamic segment "${name}" created`);
      }

      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save audience segment');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="contact-modal" role="dialog" aria-modal="true" style={{ maxWidth: '680px' }}>
        <header className="contact-modal-head">
          <div>
            <span className="form-kicker">AUDIENCE SEGMENTATION ENGINE</span>
            <h2>{segment ? 'Edit Saved Segment' : 'Create Dynamic Segment'}</h2>
            <p>Define rules to automatically filter real estate contacts for marketing and broadcasts.</p>
          </div>
          <button className="icon-btn modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <form onSubmit={handleSave}>
          <div className="contact-form-scroll" style={{ maxHeight: 'calc(85vh - 140px)', overflowY: 'auto', padding: '16px 24px' }}>
            
            {/* Basic details */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <label className="field">
                Segment Name <b>*</b>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Gurugram Plot Enquiries, High Budget Apartments"
                  autoFocus
                />
              </label>
              <label className="field">
                Segment Type
                <select value={segmentType} onChange={(e) => setSegmentType(e.target.value)}>
                  <option value="dynamic">Dynamic (Rule-based)</option>
                  <option value="static">Static (Frozen List)</option>
                </select>
              </label>
            </div>

            <label className="field wide" style={{ marginBottom: '16px' }}>
              Description (Optional)
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What type of leads does this segment contain?"
              />
            </label>

            {/* Dynamic Rule Builder */}
            {segmentType === 'dynamic' ? (
              <div style={{ background: 'var(--color-surface-muted)', borderRadius: '8px', border: '1px solid var(--color-border)', padding: '16px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>Match Rules:</span>
                    <button
                      type="button"
                      onClick={() => setConjunction('AND')}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        border: '1px solid var(--color-border)',
                        background: conjunction === 'AND' ? 'var(--color-primary)' : 'var(--color-surface)',
                        color: conjunction === 'AND' ? '#fff' : 'var(--color-text-primary)',
                        cursor: 'pointer',
                        fontWeight: conjunction === 'AND' ? 600 : 400
                      }}
                    >
                      ALL Rules (AND)
                    </button>
                    <button
                      type="button"
                      onClick={() => setConjunction('OR')}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        border: '1px solid var(--color-border)',
                        background: conjunction === 'OR' ? 'var(--color-primary)' : 'var(--color-surface)',
                        color: conjunction === 'OR' ? '#fff' : 'var(--color-text-primary)',
                        cursor: 'pointer',
                        fontWeight: conjunction === 'OR' ? 600 : 400
                      }}
                    >
                      ANY Rule (OR)
                    </button>
                  </div>

                  <button
                    type="button"
                    className="outline-btn small"
                    onClick={runPreview}
                    disabled={previewLoading}
                    style={{ height: '30px', fontSize: '12px' }}
                  >
                    <Eye size={13} /> {previewLoading ? 'Counting...' : 'Preview Matching'}
                  </button>
                </div>

                {/* Condition rows */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {conditions.map((cond, idx) => {
                    const hideValue = ['isEmpty', 'isNotEmpty'].includes(cond.operator);
                    return (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <select
                          value={cond.field}
                          onChange={(e) => updateCondition(idx, 'field', e.target.value)}
                          style={{ flex: '1.2', height: '34px', borderRadius: '6px', border: '1px solid var(--color-border)', padding: '0 8px', fontSize: '12.5px', background: '#fff' }}
                        >
                          {RULE_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                        </select>

                        <select
                          value={cond.operator}
                          onChange={(e) => updateCondition(idx, 'operator', e.target.value)}
                          style={{ flex: '1', height: '34px', borderRadius: '6px', border: '1px solid var(--color-border)', padding: '0 8px', fontSize: '12.5px', background: '#fff' }}
                        >
                          {RULE_OPERATORS.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                        </select>

                        {!hideValue ? (
                          <input
                            value={cond.value}
                            onChange={(e) => updateCondition(idx, 'value', e.target.value)}
                            placeholder="Value..."
                            style={{ flex: '1.5', height: '34px', borderRadius: '6px', border: '1px solid var(--color-border)', padding: '0 10px', fontSize: '12.5px' }}
                          />
                        ) : (
                          <span style={{ flex: '1.5', fontSize: '12px', color: 'var(--color-text-muted)', fontStyle: 'italic', paddingLeft: '8px' }}>
                            (No value required)
                          </span>
                        )}

                        <button
                          type="button"
                          className="icon-btn text-danger"
                          onClick={() => removeCondition(idx)}
                          disabled={conditions.length <= 1}
                          title="Remove condition"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <button
                    type="button"
                    className="outline-btn small"
                    onClick={addCondition}
                    style={{ height: '30px', fontSize: '12px' }}
                  >
                    <Plus size={13} /> Add Condition
                  </button>

                  {previewCount !== null && (
                    <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircle2 size={14} />
                      {previewCount.toLocaleString()} contact(s) currently match these rules
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ padding: '16px', background: 'var(--color-surface-muted)', borderRadius: '8px', fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
                Static segments freeze a selected list of contact IDs at the time of creation. You can populate members from the All Contacts table using bulk actions.
              </div>
            )}

            {error && <div className="form-error" role="alert">{error}</div>}
          </div>

          <footer className="contact-modal-foot">
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
              Dynamic segments automatically update as contact records change.
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="outline-btn" onClick={onClose}>Cancel</button>
              <button className="primary-btn small" disabled={busy}>
                {busy ? 'Saving...' : segment ? 'Update Segment' : 'Create Segment'}
              </button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  );
}
