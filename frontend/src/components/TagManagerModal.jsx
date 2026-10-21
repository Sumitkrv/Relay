import { useState, useEffect } from 'react';
import { X, Tag, Plus, Edit2, Trash2, Check, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { listTags, createTag, renameTag, deleteTag } from '../services/contacts';

export default function TagManagerModal({ onClose, onTagsChanged }) {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTagInput, setNewTagInput] = useState('');
  const [editingTag, setEditingTag] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [busy, setBusy] = useState(false);

  const fetchTags = async () => {
    setLoading(true);
    try {
      const { data } = await listTags();
      setTags(data.tags || []);
    } catch {
      toast.error('Failed to load tags');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTags();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    const clean = newTagInput.trim();
    if (!clean) return;
    setBusy(true);
    try {
      await createTag({ name: clean });
      toast.success(`Tag "${clean}" created`);
      setNewTagInput('');
      await fetchTags();
      if (onTagsChanged) onTagsChanged();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create tag');
    } finally {
      setBusy(false);
    }
  };

  const handleStartRename = (tag) => {
    setEditingTag(tag.name);
    setEditValue(tag.name);
  };

  const handleSaveRename = async () => {
    const clean = editValue.trim();
    if (!clean || clean === editingTag) {
      setEditingTag(null);
      return;
    }
    setBusy(true);
    try {
      const { data } = await renameTag({ oldName: editingTag, newName: clean });
      toast.success(`Renamed to "${clean}" across ${data.modifiedCount} contact(s)`);
      setEditingTag(null);
      await fetchTags();
      if (onTagsChanged) onTagsChanged();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to rename tag');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (tagName, count) => {
    if (!window.confirm(`Delete tag "${tagName}"? It will be safely removed from ${count} contact(s) without deleting the contacts.`)) {
      return;
    }
    setBusy(true);
    try {
      const { data } = await deleteTag({ name: tagName });
      toast.success(`Tag "${tagName}" deleted from ${data.modifiedCount} contact(s)`);
      await fetchTags();
      if (onTagsChanged) onTagsChanged();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete tag');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="contact-modal" role="dialog" aria-modal="true" style={{ maxWidth: '520px' }}>
        <header className="contact-modal-head">
          <div>
            <span className="form-kicker">TAXONOMY WORKSPACE</span>
            <h2>Manage Tags</h2>
            <p>Create, rename, or safely remove tags across your property contact database.</p>
          </div>
          <button className="icon-btn modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <div style={{ padding: '16px 24px' }}>
          {/* Create tag row */}
          <form onSubmit={handleCreate} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Tag size={15} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--color-text-muted)' }} />
              <input
                style={{ paddingLeft: '32px', height: '36px', width: '100%', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '13px' }}
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                placeholder="e.g. Gurugram Buyer, Plot Enquiry, NRI..."
                disabled={busy}
              />
            </div>
            <button className="primary-btn small" disabled={busy || !newTagInput.trim()} style={{ height: '36px' }}>
              <Plus size={14} /> Add Tag
            </button>
          </form>

          {/* Tags list */}
          <div style={{ maxHeight: '360px', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: '8px', background: 'var(--color-surface)' }}>
            {loading ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                <Loader2 size={20} className="spin" style={{ margin: '0 auto 8px' }} />
                Loading tags...
              </div>
            ) : tags.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                <Tag size={24} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                <p style={{ margin: 0, fontSize: '13px' }}>No tags created yet. Add one above!</p>
              </div>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {tags.map((tag) => (
                  <li
                    key={tag.name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderBottom: '1px solid var(--color-border-subtle)',
                      fontSize: '13px'
                    }}
                  >
                    {editingTag === tag.name ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, marginRight: '8px' }}>
                        <input
                          autoFocus
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename();
                            if (e.key === 'Escape') setEditingTag(null);
                          }}
                          style={{ height: '30px', padding: '0 8px', borderRadius: '6px', border: '1px solid var(--color-primary)', fontSize: '12.5px', flex: 1 }}
                        />
                        <button className="icon-btn" onClick={handleSaveRename} title="Save" disabled={busy}>
                          <Check size={14} color="var(--color-success)" />
                        </button>
                        <button className="icon-btn" onClick={() => setEditingTag(null)} title="Cancel">
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              background: 'var(--color-surface-muted)',
                              border: '1px solid var(--color-border)',
                              fontSize: '12.5px',
                              fontWeight: 500,
                              color: 'var(--color-text-primary)'
                            }}
                          >
                            <Tag size={11} color="var(--color-primary)" />
                            {tag.name}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                            {tag.count} {tag.count === 1 ? 'contact' : 'contacts'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <button
                            className="icon-btn"
                            title="Rename Tag"
                            onClick={() => handleStartRename(tag)}
                            disabled={busy}
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            className="icon-btn text-danger"
                            title="Delete Tag"
                            onClick={() => handleDelete(tag.name, tag.count)}
                            disabled={busy}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p style={{ fontSize: '11.5px', color: 'var(--color-text-muted)', marginTop: '8px' }}>
            Note: Deleting a tag detaches it from all contacts. Contacts themselves are never deleted.
          </p>
        </div>

        <footer className="contact-modal-foot">
          <span />
          <button type="button" className="outline-btn small" onClick={onClose}>
            Done
          </button>
        </footer>
      </section>
    </div>
  );
}
