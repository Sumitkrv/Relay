import { useState } from 'react';
import { X, Layers } from 'lucide-react';
import toast from 'react-hot-toast';
import { createContactGroup, updateContactGroup } from '../services/contactGroups';

const GROUP_COLORS = [
  '#0D9488', // Jade / Teal
  '#2563EB', // Blue
  '#7C3AED', // Purple
  '#DB2777', // Pink
  '#EA580C', // Orange
  '#16A34A', // Green
  '#475569'  // Slate
];

export default function ContactGroupModal({ group, onClose, onSaved }) {
  const [name, setName] = useState(group?.name || '');
  const [description, setDescription] = useState(group?.description || '');
  const [color, setColor] = useState(group?.color || '#0D9488');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a group name');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        color
      };

      if (group?._id) {
        await updateContactGroup(group._id, payload);
        toast.success(`Group "${name}" updated`);
      } else {
        await createContactGroup(payload);
        toast.success(`Group "${name}" created`);
      }

      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save contact group');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="contact-modal" role="dialog" aria-modal="true" style={{ maxWidth: '480px' }}>
        <header className="contact-modal-head">
          <div>
            <span className="form-kicker">STATIC REUSABLE LISTS</span>
            <h2>{group ? 'Edit Contact Group' : 'Create Contact Group'}</h2>
            <p>Group property prospects into dedicated static collections for broadcasts.</p>
          </div>
          <button className="icon-btn modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <form onSubmit={handleSubmit} style={{ padding: '16px 24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <label className="field">
              Group Name <b>*</b>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Gurugram Enquiries, Rajasthan Farmhouse Prospects"
                autoFocus
              />
            </label>

            <label className="field">
              Description
              <textarea
                rows="3"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Notes about this group's focus or enquiry batch..."
              />
            </label>

            <div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '8px', display: 'block' }}>
                Group Color Tag
              </span>
              <div style={{ display: 'flex', gap: '10px' }}>
                {GROUP_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: c,
                      border: color === c ? '3px solid var(--color-surface)' : 'none',
                      outline: color === c ? `2px solid ${c}` : 'none',
                      cursor: 'pointer'
                    }}
                    aria-label={`Color ${c}`}
                  />
                ))}
              </div>
            </div>

            {error && <div className="form-error" role="alert">{error}</div>}
          </div>

          <footer className="contact-modal-foot" style={{ marginTop: '20px', padding: '12px 0 0' }}>
            <span style={{ fontSize: '11.5px', color: 'var(--color-text-muted)' }}>
              Deleting a group never deletes member contacts.
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="outline-btn" onClick={onClose}>Cancel</button>
              <button className="primary-btn small" disabled={busy}>
                {busy ? 'Saving...' : group ? 'Update Group' : 'Create Group'}
              </button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  );
}
