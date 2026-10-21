import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  ArrowUpDown,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Eye,
  FileText,
  History,
  Image as ImageIcon,
  LoaderCircle,
  MessageSquareText,
  PanelRightClose,
  PanelRightOpen,
  Phone,
  Plus,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Star,
  Trash2,
  Upload,
  Video,
  X,
  AlertCircle,
  CheckCircle2,
  Layers,
  HelpCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { getContact, listContacts } from '../services/contacts';
import {
  archiveTemplate,
  bulkPreview,
  createTemplate,
  deleteTemplate,
  deleteTemplateMedia,
  duplicateTemplate,
  getTemplate,
  getTemplateCampaigns,
  getTemplateCategories,
  getTemplateHistory,
  getTemplateLibrary,
  getTemplateVariables,
  getTemplateVersions,
  listTemplates,
  previewTemplate,
  previewTemplateVersion,
  restoreTemplate,
  restoreTemplateVersion,
  updateTemplate,
  uploadTemplateMedia,
  validateTemplate,
} from '../services/templates';

const EMPTY = {
  name: '',
  description: '',
  category: 'Marketing',
  businessCategory: 'Real Estate',
  intendedService: '',
  tags: [],
  isFavorite: false,
  language: 'en',
  headerType: 'NONE', // 'NONE' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT'
  header: '',
  headerMediaId: null,
  headerMediaUrl: '',
  headerMediaName: '',
  headerMediaSize: 0,
  headerMediaMime: '',
  body: '',
  footer: '',
  buttons: [],
  localStatus: 'Draft',
  metaTemplateName: '',
  metaTemplateId: '',
  metaLanguage: '',
  sampleValues: {},
  fallbackValues: {},
  revisionNotes: '',
};

const VARIABLE_GROUPS = [
  {
    id: 'contact',
    label: 'Contact Profile',
    vars: [
      { key: 'name', label: 'Full Name' },
      { key: 'first_name', label: 'First Name' },
      { key: 'city', label: 'City' },
      { key: 'location', label: 'Location' },
      { key: 'company_name', label: 'Company' },
      { key: 'phone', label: 'Phone' },
      { key: 'email', label: 'Email' },
    ],
  },
  {
    id: 'real_estate',
    label: 'Real Estate Preferences',
    vars: [
      { key: 'property_type', label: 'Property Type' },
      { key: 'project', label: 'Project Name' },
      { key: 'preferred_location', label: 'Preferred Location' },
      { key: 'budget', label: 'Budget Range' },
      { key: 'property_interest', label: 'Interest' },
    ],
  },
  {
    id: 'business',
    label: 'M2W Realty Business',
    vars: [
      { key: 'business_name', label: 'Business Name' },
      { key: 'business_phone', label: 'Business Phone' },
      { key: 'business_website', label: 'Website' },
    ],
  },
];

const LANGS = [
  ['en', 'English'],
  ['hi', 'Hindi (हिन्दी)'],
  ['hinglish', 'Hinglish'],
];

const errorMsg = (e) => e.response?.data?.message || e.message || 'Something went wrong.';

export default function TemplatesPage() {
  const [params] = useSearchParams();
  const [templates, setTemplates] = useState([]);
  const [library, setLibrary] = useState([]);
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState(EMPTY);
  const [savedDraft, setSavedDraft] = useState(EMPTY);
  const [contacts, setContacts] = useState([]);
  const [contactId, setContactId] = useState(params.get('contact') || '');
  const [preview, setPreview] = useState(null);
  const [validation, setValidation] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [versions, setVersions] = useState([]);
  const [campaignUsage, setCampaignUsage] = useState([]);
  const [tab, setTab] = useState('templates'); // 'templates' | 'library'
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [languageFilter, setLanguageFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('active'); // 'active' | 'archived' | 'all'
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [showPreviewDrawer, setShowPreviewDrawer] = useState(true);
  const [mobileSegment, setMobileSegment] = useState('editor'); // 'library' | 'editor' | 'preview'
  const [previewDevice, setPreviewDevice] = useState('phone'); // 'phone' | 'desktop'
  const [activeVarGroup, setActiveVarGroup] = useState('contact');

  // Media upload state
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);

  // Button Builder modal state
  const [showButtonModal, setShowButtonModal] = useState(false);
  const [newButtonType, setNewButtonType] = useState('QUICK_REPLY');
  const [newButtonText, setNewButtonText] = useState('');
  const [newButtonValue, setNewButtonValue] = useState('');

  const editor = useRef(null);
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(savedDraft), [draft, savedDraft]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const showArchived = statusFilter === 'archived';
      const [{ data: a }, { data: b }] = await Promise.all([
        listTemplates({archived:showArchived?'true':'false'}),
        getTemplateLibrary(),
      ]);
      setTemplates(a.records || []);
      setLibrary(b.records || []);
    } catch (e) {
      toast.error(errorMsg(e), {id:'template-load-error'});
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    refresh();
    listContacts({ limit: 100, archived: 'false' })
      .then(({ data }) => setContacts(data.records || []))
      .catch(() => {});
  }, [refresh]);

  useEffect(() => {
    if (!selected) {
      setCampaignUsage([]);
      return;
    }
    getTemplateCampaigns(selected)
      .then(({ data }) => setCampaignUsage(data.records || []))
      .catch(() => {
        getTemplate(selected)
          .then(({ data }) => setCampaignUsage(data.campaignUsage || []))
          .catch(() => setCampaignUsage([]));
      });
  }, [selected]);

  useEffect(() => {
    const id = params.get('contact');
    if (!id) return;
    setContactId(id);
    getContact(id)
      .then(({ data }) => setContacts((prev) => (prev.some((c) => String(c._id) === id) ? prev : [data.contact, ...prev])))
      .catch(() => {});
  }, [params]);

  // Auto-resolve preview when contact or draft changes and contact is selected
  useEffect(() => {
    if (!contactId || !selected || dirty) {
      return;
    }
    previewTemplate(selected, contactId)
      .then(({ data }) => {
        setPreview(data.preview);
        setValidation(data.validation);
      })
      .catch(() => {});
  }, [contactId, selected, dirty]);

  const chooseTemplate = (t) => {
    if (dirty && !window.confirm('Discard unsaved template changes?')) return;
    const next = {
      ...EMPTY,
      ...t,
      headerType: t.headerType || (t.header ? 'TEXT' : 'NONE'),
      buttons: t.buttons || [],
      sampleValues: t.sampleValues || {},
    };
    setSelected(t._id || null);
    setDraft(next);
    setSavedDraft(next);
    setPreview(null);
    setValidation(null);
    setTab('templates');
    setMobileSegment('editor');
  };

  const newTemplate = () => chooseTemplate(EMPTY);

  const save = async () => {
    if (!draft.name.trim()) {
      toast.error('Add a clear, provider-compatible template name.');
      return;
    }
    if (!draft.body.trim()) {
      toast.error('Message body text is required.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...draft,
        revisionNotes: draft.revisionNotes || (selected ? 'Updated template draft' : 'Created template draft'),
      };
      const { data } = selected
        ? await updateTemplate(selected, payload)
        : await createTemplate(payload);
      const t = data.template;
      setSelected(t._id);
      const next = {
        ...EMPTY,
        ...t,
        headerType: t.headerType || (t.header ? 'TEXT' : 'NONE'),
      };
      setDraft(next);
      setSavedDraft(next);
      toast.success('Template draft saved in MongoDB.');
      await refresh();
      // Auto-validate after save
      validateTemplate(t._id)
        .then(({ data: valData }) => {
          setValidation(valData.validation);
          setSubmission(valData.submission);
        })
        .catch(() => {});
    } catch (e) {
      toast.error(errorMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const toggleFavorite = async (t) => {
    try {
      const { data } = await updateTemplate(t._id, { isFavorite: !t.isFavorite });
      setTemplates((items) => items.map((item) => (item._id === t._id ? data.template : item)));
      if (selected === t._id) {
        setDraft((v) => ({ ...v, isFavorite: data.template.isFavorite }));
        setSavedDraft((v) => ({ ...v, isFavorite: data.template.isFavorite }));
      }
    } catch (e) {
      toast.error(errorMsg(e));
    }
  };

  const remove = async () => {
    if (!selected) return;
    if (!window.confirm('Delete this unused draft? (Templates referenced by campaigns cannot be deleted)')) return;
    try {
      await deleteTemplate(selected);
      toast.success('Template draft deleted.');
      setSelected(null);
      setDraft(EMPTY);
      setSavedDraft(EMPTY);
      await refresh();
    } catch (e) {
      toast.error(errorMsg(e));
    }
  };

  const duplicate = async (id) => {
    try {
      const { data } = await duplicateTemplate(id);
      toast.success('Template duplicated as a new draft.');
      await refresh();
      chooseTemplate(data.template);
    } catch (e) {
      toast.error(errorMsg(e));
    }
  };

  const handleArchiveToggle = async () => {
    if (!selected) return;
    const isCurrentlyArchived = draft.localStatus === 'Archived';
    try {
      const { data } = isCurrentlyArchived
        ? await restoreTemplate(selected)
        : await archiveTemplate(selected);
      toast.success(isCurrentlyArchived ? 'Template restored to active drafts.' : 'Template archived.');
      const next = { ...EMPTY, ...data.template };
      setDraft(next);
      setSavedDraft(next);
      await refresh();
    } catch (e) {
      toast.error(errorMsg(e));
    }
  };

  const runPreview = async () => {
    if (dirty) {
      toast.error('Save your latest changes before resolving contact preview.');
      return;
    }
    if (!selected) {
      toast.error('Save this template draft before previewing.');
      return;
    }
    if (!contactId) {
      toast.error('Select a CRM contact to resolve personalized variables.');
      return;
    }
    try {
      const { data } = await previewTemplate(selected, contactId);
      setPreview(data.preview);
      setValidation(data.validation);
      toast.success('Contact variables resolved.');
    } catch (e) {
      toast.error(errorMsg(e));
    }
  };

  const runValidation = async () => {
    if (dirty) {
      toast.error('Save latest changes before validating.');
      return;
    }
    if (!selected) {
      toast.error('Save this template draft before validating.');
      return;
    }
    try {
      const { data } = await validateTemplate(selected);
      setValidation(data.validation);
      setSubmission(data.submission);
      if (data.validation.valid) {
        toast.success('Local validation passed. Provider status: Not Submitted.');
      } else {
        toast.error(`Validation findings: ${data.validation.errors.length} issue(s) detected.`);
      }
    } catch (e) {
      toast.error(errorMsg(e));
    }
  };

  const loadVersions = async () => {
    if (!selected) return;
    try {
      const { data } = await getTemplateHistory(selected);
      setVersions(data.records || []);
      setShowVersions(true);
    } catch (e) {
      toast.error(errorMsg(e));
    }
  };

  const restoreVersionToDraft = async (versionId) => {
    try {
      const { data } = await restoreTemplateVersion(selected, versionId);
      const next = { ...EMPTY, ...data.template };
      setDraft(next);
      setSavedDraft(next);
      toast.success('Historical version restored into a new draft.');
      await refresh();
      setShowVersions(false);
    } catch (e) {
      toast.error(errorMsg(e));
    }
  };

  const insertVariable = (key) => {
    const el = editor.current;
    const token = `{{${key}}}`;
    if (!el) {
      setDraft((v) => ({ ...v, body: v.body + token }));
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = draft.body.slice(0, start) + token + draft.body.slice(end);
    setDraft((v) => ({ ...v, body: next }));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  // Media upload handler
  const handleMediaUpload = async (e) => {
    const file = e.target?.files?.[0];
    if (!file) return;

    setUploadingMedia(true);
    setUploadProgress(10);
    try {
      const { data } = await uploadTemplateMedia(file, (progressEvent) => {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        setUploadProgress(percent || 50);
      });
      const media = data.media;
      setDraft((v) => ({
        ...v,
        headerMediaId: media._id || media.id,
        headerMediaUrl: media.url,
        headerMediaName: media.originalFileName,
        headerMediaSize: media.sizeBytes,
        headerMediaMime: media.mimeType,
      }));
      toast.success(`Attached ${media.originalFileName} to header.`);
    } catch (err) {
      toast.error(errorMsg(err));
    } finally {
      setUploadingMedia(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeHeaderMedia = () => {
    setDraft((v) => ({
      ...v,
      headerMediaId: null,
      headerMediaUrl: '',
      headerMediaName: '',
      headerMediaSize: 0,
      headerMediaMime: '',
    }));
  };

  // Button builder handlers
  const handleAddButton = () => {
    const text = newButtonText.trim();
    if (!text) {
      toast.error('Button text label is required (1 to 25 chars).');
      return;
    }
    if (text.length > 25) {
      toast.error('Button label cannot exceed 25 characters.');
      return;
    }

    const currentButtons = draft.buttons || [];
    const quickReplies = currentButtons.filter((b) => b.type === 'QUICK_REPLY');
    const ctas = currentButtons.filter((b) => b.type === 'URL' || b.type === 'PHONE_NUMBER');

    if (newButtonType === 'QUICK_REPLY') {
      if (ctas.length > 0) {
        toast.error('Cannot mix Quick Reply and Call-To-Action buttons in the same template.');
        return;
      }
      if (quickReplies.length >= 3) {
        toast.error('Maximum of 3 Quick Reply buttons allowed by WhatsApp.');
        return;
      }
    } else {
      if (quickReplies.length > 0) {
        toast.error('Cannot mix Call-To-Action and Quick Reply buttons in the same template.');
        return;
      }
      if (ctas.some((b) => b.type === newButtonType)) {
        toast.error(`Only 1 ${newButtonType === 'URL' ? 'URL' : 'Phone'} CTA button allowed.`);
        return;
      }
      if (ctas.length >= 2) {
        toast.error('Maximum of 2 Call-To-Action buttons allowed.');
        return;
      }

      if (newButtonType === 'URL') {
        if (!/^https:\/\//i.test(newButtonValue.trim())) {
          toast.error('URL button value must begin with https://');
          return;
        }
      }
      if (newButtonType === 'PHONE_NUMBER') {
        if (!/^\+[1-9]\d{7,14}$/.test(newButtonValue.trim())) {
          toast.error('Phone CTA requires an international E.164 number (e.g. +919811122233).');
          return;
        }
      }
    }

    setDraft((v) => ({
      ...v,
      buttons: [...v.buttons, { type: newButtonType, text, value: newButtonValue.trim() }],
    }));
    setNewButtonText('');
    setNewButtonValue('');
    setShowButtonModal(false);
    toast.success('Action button added.');
  };

  const removeButton = (idx) => {
    setDraft((v) => ({
      ...v,
      buttons: v.buttons.filter((_, i) => i !== idx),
    }));
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const filtered = templates.filter((t) => {
    const matchSearch = !search || `${t.name} ${t.body}`.toLowerCase().includes(search.toLowerCase());
    const matchCat = !categoryFilter || t.category === categoryFilter;
    const matchLang = !languageFilter || t.language === languageFilter;
    const matchFav = !favoriteOnly || t.isFavorite;
    return matchSearch && matchCat && matchLang && matchFav;
  });

  const wordCount = draft.body.trim() ? draft.body.trim().split(/\s+/).length : 0;
  const detectedVars = [
    ...new Set(
      `${draft.header}\n${draft.body}\n${draft.footer}`.match(/{{\s*([a-zA-Z][\w.:-]*)\s*}}/g) || []
    ),
  ].map((x) => x.replace(/[{}\s]/g, ''));

  return (
    <div className="templates-page">
      {/* Page Header */}
      <PageHeader
        eyebrow="RELAY REAL ESTATE · MESSAGE TEMPLATE STUDIO"
        title="Templates"
        subtitle="Manage personalized WhatsApp templates, brochures, interactive buttons, and verified provider readiness."
        actions={
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button className="primary-btn small" onClick={newTemplate}>
              <Plus size={15} /> New Template
            </button>
          </div>
        }
      />

      {/* Primary Workspace Tabs */}
      <div className="inbox-filter-tabs" style={{ marginBottom: '18px', borderRadius: '10px' }}>
        <button className={tab === 'templates' ? 'active' : ''} onClick={() => setTab('templates')}>
          <MessageSquareText size={14} style={{ display: 'inline', marginRight: '6px' }} /> Template Studio
        </button>
        <button className={tab === 'library' ? 'active' : ''} onClick={() => setTab('library')}>
          <Sparkles size={14} style={{ display: 'inline', marginRight: '6px' }} /> Real Estate Preset Library
        </button>
      </div>

      {tab === 'templates' && (
        <>
          {/* Mobile Viewport Navigation Segmented Control */}
          <div className="template-mobile-segments" style={{ display: 'none', marginBottom: '14px', gap: '6px' }}>
            <button
              className={mobileSegment === 'library' ? 'primary-btn small' : 'outline-btn small'}
              onClick={() => setMobileSegment('library')}
              style={{ flex: 1 }}
            >
              Saved ({filtered.length})
            </button>
            <button
              className={mobileSegment === 'editor' ? 'primary-btn small' : 'outline-btn small'}
              onClick={() => setMobileSegment('editor')}
              style={{ flex: 1 }}
            >
              Editor
            </button>
            <button
              className={mobileSegment === 'preview' ? 'primary-btn small' : 'outline-btn small'}
              onClick={() => setMobileSegment('preview')}
              style={{ flex: 1 }}
            >
              Live Preview
            </button>
          </div>

          <div className={`template-workspace ${!showPreviewDrawer ? 'hide-preview' : ''}`}>
            {/* ========================================================
                LEFT PANEL: Template Library (~260px)
                ======================================================== */}
            <aside className="template-list-panel">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <strong style={{ fontSize: '13.5px', color: 'var(--color-text-primary)' }}>Saved Templates</strong>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    fontSize: '11.5px',
                    color: 'var(--color-primary)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  <option value="active">Active Drafts</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              {/* Search Bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--color-surface-muted)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '0 8px', height: '34px' }}>
                <Search size={14} color="var(--color-text-muted)" />
                <input
                  style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '12px' }}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search template name…"
                />
              </div>

              {/* Filters */}
              <div style={{ display: 'flex', gap: '6px' }}>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  style={{ flex: 1, height: '30px', borderRadius: '6px', border: '1px solid var(--color-border)', fontSize: '11px', padding: '0 4px' }}
                >
                  <option value="">All Categories</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Utility">Utility</option>
                  <option value="Authentication">Authentication</option>
                </select>
                <select
                  value={languageFilter}
                  onChange={(e) => setLanguageFilter(e.target.value)}
                  style={{ flex: 1, height: '30px', borderRadius: '6px', border: '1px solid var(--color-border)', fontSize: '11px', padding: '0 4px' }}
                >
                  <option value="">All Languages</option>
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                  <option value="hinglish">Hinglish</option>
                </select>
                <button
                  type="button"
                  title="Show favorites only"
                  onClick={() => setFavoriteOnly((v) => !v)}
                  style={{
                    height: '30px',
                    padding: '0 8px',
                    borderRadius: '6px',
                    border: '1px solid var(--color-border)',
                    background: favoriteOnly ? 'var(--color-warning-soft)' : 'transparent',
                    color: favoriteOnly ? 'var(--color-warning)' : 'var(--color-text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  ★
                </button>
              </div>

              {/* Template Items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto', flex: 1, minHeight: '300px' }}>
                {loading && <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', padding: '12px 0' }}>Loading templates…</div>}
                {!loading && !filtered.length && (
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', padding: '24px 8px', textAlign: 'center' }}>
                    No {statusFilter === 'archived' ? 'archived' : 'active'} templates found.
                  </div>
                )}
                {filtered.map((t) => {
                  const isSelected = selected === t._id;
                  const headerBadge = t.headerType && t.headerType !== 'NONE' ? t.headerType : null;
                  return (
                    <div
                      key={t._id}
                      onClick={() => chooseTemplate(t)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '5px',
                        padding: '10px 12px',
                        border: '1px solid',
                        borderColor: isSelected ? 'var(--color-primary)' : 'var(--color-border)',
                        backgroundColor: isSelected ? 'var(--color-primary-soft)' : 'var(--color-surface)',
                        borderRadius: '8px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <strong style={{ fontSize: '12.5px', color: 'var(--color-text-primary)' }}>{t.name}</strong>
                        <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                          v{t.currentVersionNumber || 1}
                        </span>
                      </div>
                      <p style={{ fontSize: '11.5px', color: 'var(--color-text-secondary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.body || 'Empty message body'}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: 'var(--color-text-muted)', flexWrap: 'wrap' }}>
                        <span style={{ background: 'var(--color-surface-muted)', padding: '1px 5px', borderRadius: '4px' }}>
                          {t.category}
                        </span>
                        <span style={{ textTransform: 'uppercase' }}>{t.language}</span>
                        {headerBadge && (
                          <span style={{ background: 'var(--color-info-soft)', color: 'var(--color-info)', padding: '1px 5px', borderRadius: '4px', fontWeight: 600 }}>
                            {headerBadge}
                          </span>
                        )}
                        <span
                          style={{ marginLeft: 'auto', cursor: 'pointer', fontSize: '12px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(t);
                          }}
                        >
                          {t.isFavorite ? '★' : '☆'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </aside>

            {/* ========================================================
                CENTER PANEL: Template Editor (Flexible Primary Workspace)
                ======================================================== */}
            <section className="template-editor-panel">
              {/* Editor Top Bar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="page-header-eyebrow" style={{ margin: 0 }}>
                      {selected ? `VERSION ${draft.currentVersionNumber || 1}` : 'NEW MESSAGE TEMPLATE'}
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '2px 7px',
                        borderRadius: '4px',
                        fontWeight: 600,
                        backgroundColor: draft.localStatus === 'Archived' ? 'var(--color-surface-muted)' : 'var(--color-primary-soft)',
                        color: draft.localStatus === 'Archived' ? 'var(--color-text-muted)' : 'var(--color-primary)',
                      }}
                    >
                      {draft.localStatus || 'Draft'}
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '2px 7px',
                        borderRadius: '4px',
                        backgroundColor: '#F1F5F9',
                        color: '#475569',
                      }}
                    >
                      Meta Status: Not Submitted (Mock Mode)
                    </span>
                  </div>
                  <h2 style={{ fontSize: '17px', color: 'var(--color-text-primary)', margin: '4px 0 0', fontWeight: 700 }}>
                    {draft.name || 'Untitled Template'}
                  </h2>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {selected && (
                    <button className="icon-btn" title="Version history & audit snapshots" onClick={loadVersions}>
                      <History size={15} />
                    </button>
                  )}
                  {selected && (
                    <button className="icon-btn" title="Duplicate template into a new draft" onClick={() => duplicate(selected)}>
                      <Copy size={15} />
                    </button>
                  )}
                  {selected && (
                    <button
                      className="icon-btn"
                      title={draft.localStatus === 'Archived' ? 'Restore template' : 'Archive template'}
                      onClick={handleArchiveToggle}
                    >
                      <Archive size={15} />
                    </button>
                  )}
                  {selected && draft.localStatus === 'Draft' && (
                    <button className="icon-btn text-danger" title="Delete draft" onClick={remove}>
                      <Trash2 size={15} />
                    </button>
                  )}
                  <button
                    className="outline-btn small"
                    onClick={() => setShowPreviewDrawer((v) => !v)}
                    title={showPreviewDrawer ? 'Hide Preview Column' : 'Show Preview Column'}
                  >
                    {showPreviewDrawer ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />} Live Preview
                  </button>
                  <button className="primary-btn small" onClick={save} disabled={saving}>
                    {saving ? <LoaderCircle className="spin" size={14} /> : <Save size={14} />} Save Draft
                  </button>
                </div>
              </div>

              {/* Campaign references banner */}
              {campaignUsage.length > 0 && (
                <div style={{ padding: '8px 12px', background: 'var(--color-surface-muted)', borderLeft: '3px solid var(--color-primary)', borderRadius: '4px 8px 8px 4px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                  <b>Pinned in Campaigns:</b> {campaignUsage.map((c) => c.name).join(', ')}
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                    Active campaigns maintain immutable snapshots of their assigned version.
                  </div>
                </div>
              )}

              {/* Form Core Fields */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr)', gap: '12px' }}>
                  <label className="field">
                    Template Identifier Name *
                    <input
                      maxLength="120"
                      value={draft.name}
                      onChange={(e) => setDraft((v) => ({ ...v, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') }))}
                      placeholder="e.g. property_launch_update"
                      style={{ fontFamily: 'monospace', fontSize: '12.5px' }}
                    />
                    <small style={{ fontSize: '10.5px', color: 'var(--color-text-muted)' }}>
                      Lowercase letters, numbers, and underscores
                    </small>
                  </label>

                  <label className="field">
                    Category *
                    <select
                      value={draft.category}
                      onChange={(e) => setDraft((v) => ({ ...v, category: e.target.value }))}
                    >
                      <option value="Marketing">Marketing (Promotions & Launches)</option>
                      <option value="Utility">Utility (Site Visits & Coordination)</option>
                      <option value="Authentication">Authentication (OTP & Verification)</option>
                    </select>
                  </label>

                  <label className="field">
                    Template Language *
                    <select
                      value={draft.language}
                      onChange={(e) => setDraft((v) => ({ ...v, language: e.target.value }))}
                    >
                      {LANGS.map(([code, name]) => (
                        <option key={code} value={code}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {/* Header Type Selector */}
                <div className="field">
                  <span style={{ fontWeight: 600, fontSize: '12px', color: 'var(--color-text-primary)', marginBottom: '4px', display: 'block' }}>
                    Header Component (Optional)
                  </span>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {[
                      { type: 'NONE', label: 'None' },
                      { type: 'TEXT', label: 'Text Title' },
                      { type: 'IMAGE', label: 'Image Header' },
                      { type: 'VIDEO', label: 'Video Header' },
                      { type: 'DOCUMENT', label: 'PDF Brochure' },
                    ].map((item) => (
                      <button
                        key={item.type}
                        type="button"
                        onClick={() => setDraft((v) => ({ ...v, headerType: item.type }))}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 500,
                          cursor: 'pointer',
                          border: '1px solid',
                          borderColor: draft.headerType === item.type ? 'var(--color-primary)' : 'var(--color-border)',
                          background: draft.headerType === item.type ? 'var(--color-primary-soft)' : 'var(--color-surface)',
                          color: draft.headerType === item.type ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                        }}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>

                  {/* Header Input Render Based on Type */}
                  {draft.headerType === 'TEXT' && (
                    <div style={{ marginTop: '8px' }}>
                      <input
                        maxLength="60"
                        value={draft.header}
                        onChange={(e) => setDraft((v) => ({ ...v, header: e.target.value }))}
                        placeholder="e.g. New Luxury Property Launch in Gurugram"
                        style={{ width: '100%' }}
                      />
                      <small style={{ fontSize: '10.5px', color: 'var(--color-text-muted)' }}>
                        {draft.header.length}/60 characters
                      </small>
                    </div>
                  )}

                  {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(draft.headerType) && (
                    <div style={{ marginTop: '8px' }}>
                      {draft.headerMediaUrl ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--color-surface-muted)', border: '1px solid var(--color-border)', borderRadius: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {draft.headerType === 'DOCUMENT' && <FileText size={20} color="var(--color-primary)" />}
                            {draft.headerType === 'IMAGE' && <ImageIcon size={20} color="var(--color-primary)" />}
                            {draft.headerType === 'VIDEO' && <Video size={20} color="var(--color-primary)" />}
                            <div>
                              <strong style={{ fontSize: '13px', display: 'block', color: 'var(--color-text-primary)' }}>
                                {draft.headerMediaName || 'Attached Media Asset'}
                              </strong>
                              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                                {formatFileSize(draft.headerMediaSize)} · {draft.headerType}
                              </span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              type="button"
                              className="outline-btn small"
                              onClick={() => fileInputRef.current?.click()}
                            >
                              Replace
                            </button>
                            <button
                              type="button"
                              className="icon-btn text-danger"
                              onClick={removeHeaderMedia}
                              title="Remove attachment"
                            >
                              <X size={15} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          onClick={() => fileInputRef.current?.click()}
                          style={{
                            border: '2px dashed var(--color-border)',
                            borderRadius: '8px',
                            padding: '18px',
                            textAlign: 'center',
                            cursor: 'pointer',
                            background: 'var(--color-surface-subtle)',
                            transition: 'border 0.2s ease',
                          }}
                        >
                          <Upload size={22} color="var(--color-primary)" style={{ margin: '0 auto 6px' }} />
                          <strong style={{ fontSize: '13px', display: 'block', color: 'var(--color-text-primary)' }}>
                            {uploadingMedia ? `Uploading (${uploadProgress}%)…` : `Select or drop ${draft.headerType.toLowerCase()} file`}
                          </strong>
                          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                            {draft.headerType === 'DOCUMENT' && 'PDF brochure up to 10 MB'}
                            {draft.headerType === 'IMAGE' && 'JPEG, PNG, or WEBP up to 5 MB'}
                            {draft.headerType === 'VIDEO' && 'MP4 or 3GPP up to 16 MB'}
                          </span>
                        </div>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        onChange={handleMediaUpload}
                        style={{ display: 'none' }}
                        accept={
                          draft.headerType === 'DOCUMENT'
                            ? '.pdf,application/pdf'
                            : draft.headerType === 'IMAGE'
                            ? 'image/jpeg,image/png,image/webp'
                            : 'video/mp4,video/3gpp'
                        }
                      />
                    </div>
                  )}
                </div>

                {/* Message Body Field with Variable Toolbar */}
                <div className="field">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, fontSize: '12px', color: 'var(--color-text-primary)' }}>
                      Message Body Text *
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                      {draft.body.length}/1024 chars · {wordCount} words · {detectedVars.length} placeholders
                    </span>
                  </div>
                  <textarea
                    ref={editor}
                    rows={7}
                    maxLength={1024}
                    value={draft.body}
                    onChange={(e) => setDraft((v) => ({ ...v, body: e.target.value }))}
                    placeholder="Hi {{name}}, we have information about {{property_type}} options in {{city}}. Would you like to review the project details?"
                    style={{ fontFamily: 'monospace', fontSize: '13px', lineHeight: 1.6 }}
                  />

                  {/* Variable Group Selector & Insertion Chips */}
                  <div style={{ marginTop: '8px', padding: '10px 12px', background: 'var(--color-surface-subtle)', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {VARIABLE_GROUPS.map((g) => (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => setActiveVarGroup(g.id)}
                            style={{
                              border: 'none',
                              background: activeVarGroup === g.id ? 'var(--color-surface)' : 'transparent',
                              color: activeVarGroup === g.id ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                              fontWeight: activeVarGroup === g.id ? 700 : 500,
                              fontSize: '11px',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              boxShadow: activeVarGroup === g.id ? 'var(--shadow-xs)' : 'none',
                            }}
                          >
                            {g.label}
                          </button>
                        ))}
                      </div>
                      <span style={{ fontSize: '10.5px', color: 'var(--color-text-muted)' }}>
                        Click token to insert at cursor
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {VARIABLE_GROUPS.find((g) => g.id === activeVarGroup)?.vars.map((v) => (
                        <button
                          key={v.key}
                          type="button"
                          onClick={() => insertVariable(v.key)}
                          style={{
                            border: '1px solid var(--color-border)',
                            background: 'var(--color-surface)',
                            borderRadius: '6px',
                            padding: '3px 9px',
                            fontSize: '11px',
                            cursor: 'pointer',
                            color: 'var(--color-primary)',
                            fontWeight: 600,
                            fontFamily: 'monospace',
                          }}
                        >
                          +{`{{${v.key}}}`} <span style={{ fontFamily: 'sans-serif', fontWeight: 400, color: 'var(--color-text-muted)', fontSize: '10px' }}>({v.label})</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Footer Field */}
                <label className="field">
                  Footer Notice (Optional)
                  <input
                    maxLength="60"
                    value={draft.footer}
                    onChange={(e) => setDraft((v) => ({ ...v, footer: e.target.value }))}
                    placeholder="e.g. Reply STOP to opt out · M2W Realty Advisory Desk"
                  />
                  <small style={{ fontSize: '10.5px', color: 'var(--color-text-muted)' }}>
                    Plain text only; variables are not allowed in footers.
                  </small>
                </label>

                {/* Interactive Buttons Builder */}
                <div className="field">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: '12px', color: 'var(--color-text-primary)' }}>
                        Interactive Buttons (Optional)
                      </span>
                      <small style={{ display: 'block', fontSize: '10.5px', color: 'var(--color-text-muted)' }}>
                        WhatsApp supports up to 3 Quick Replies OR up to 2 Call-to-Actions (1 URL + 1 Phone).
                      </small>
                    </div>
                    <button
                      type="button"
                      className="outline-btn small"
                      onClick={() => setShowButtonModal(true)}
                    >
                      <Plus size={13} /> Add Button
                    </button>
                  </div>

                  {draft.buttons?.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {draft.buttons.map((b, i) => (
                        <div
                          key={i}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: 'var(--color-surface-muted)',
                            border: '1px solid var(--color-border)',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            fontSize: '12px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: b.type === 'QUICK_REPLY' ? 'var(--color-primary-soft)' : 'var(--color-info-soft)',
                                color: b.type === 'QUICK_REPLY' ? 'var(--color-primary)' : 'var(--color-info)',
                              }}
                            >
                              {b.type === 'QUICK_REPLY' ? 'QUICK REPLY' : b.type === 'URL' ? 'URL CTA' : 'PHONE CTA'}
                            </span>
                            <strong style={{ color: 'var(--color-text-primary)' }}>{b.text}</strong>
                            {b.value && (
                              <span style={{ color: 'var(--color-text-muted)', fontSize: '11px', fontFamily: 'monospace' }}>
                                ({b.value})
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            className="icon-btn text-danger"
                            onClick={() => removeButton(i)}
                            title="Remove button"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: '11.5px', color: 'var(--color-text-muted)', fontStyle: 'italic', padding: '6px 0' }}>
                      No interactive buttons configured yet.
                    </div>
                  )}
                </div>

                {/* Revision Notes */}
                <label className="field">
                  Revision Notes (for Version History)
                  <input
                    maxLength="200"
                    value={draft.revisionNotes}
                    onChange={(e) => setDraft((v) => ({ ...v, revisionNotes: e.target.value }))}
                    placeholder="e.g. Updated launch dates and added brochure CTA"
                  />
                </label>

                {/* Action Footer */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '12px', borderTop: '1px solid var(--color-border-subtle)' }}>
                  <span style={{ fontSize: '12px', color: dirty ? 'var(--color-warning)' : 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    {dirty ? <AlertCircle size={13} /> : <CheckCircle2 size={13} color="var(--color-success)" />}
                    {dirty ? 'Unsaved draft changes' : 'All changes saved to MongoDB'}
                  </span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {selected && (
                      <button type="button" className="outline-btn small" onClick={runValidation}>
                        <Check size={13} /> Validate Template
                      </button>
                    )}
                    <button className="primary-btn small" onClick={save} disabled={saving}>
                      {saving ? <LoaderCircle className="spin" size={14} /> : <Save size={14} />} Save Draft
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* ========================================================
                RIGHT PANEL: Live WhatsApp Preview (~320px)
                ======================================================== */}
            {showPreviewDrawer && (
              <aside className="template-preview-column">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <strong style={{ fontSize: '13.5px', color: 'var(--color-text-primary)' }}>
                    WhatsApp Template Preview — Not Sent
                  </strong>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      type="button"
                      onClick={() => setPreviewDevice('phone')}
                      style={{
                        border: 'none',
                        background: previewDevice === 'phone' ? 'var(--color-surface-muted)' : 'transparent',
                        fontSize: '11px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        color: previewDevice === 'phone' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      }}
                    >
                      Phone
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewDevice('desktop')}
                      style={{
                        border: 'none',
                        background: previewDevice === 'desktop' ? 'var(--color-surface-muted)' : 'transparent',
                        fontSize: '11px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        color: previewDevice === 'desktop' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      }}
                    >
                      Desktop
                    </button>
                  </div>
                </div>

                {/* CRM Contact Variable Resolution Picker */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontSize: '11.5px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                    Preview with CRM Contact:
                  </label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <select
                      value={contactId}
                      onChange={(e) => setContactId(e.target.value)}
                      style={{ flex: 1, height: '32px', borderRadius: '6px', border: '1px solid var(--color-border)', fontSize: '11.5px', padding: '0 6px' }}
                    >
                      <option value="">Select CRM Contact…</option>
                      {contacts.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.fullName} ({c.city || 'No city'})
                        </option>
                      ))}
                    </select>
                    <button className="outline-btn small" onClick={runPreview} style={{ height: '32px' }} title="Resolve variables">
                      <RefreshCw size={12} />
                    </button>
                  </div>
                </div>

                {/* Realistic WhatsApp Chat Bubble Container */}
                <div className="whatsapp-preview">
                  <div className="wa-preview-top">
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#FFFFFF', color: '#075E54', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: '13px' }}>
                      M
                    </div>
                    <div>
                      <strong style={{ fontSize: '13px', display: 'block' }}>M2W Realty</strong>
                      <span style={{ fontSize: '10px', opacity: 0.85 }}>WhatsApp Business Advisory</span>
                    </div>
                  </div>

                  <div className="wa-chat-bg">
                    <div style={{ alignSelf: 'center', background: 'rgba(255, 255, 255, 0.95)', padding: '2px 8px', borderRadius: '6px', fontSize: '10px', color: '#54656F', fontWeight: 600 }}>
                      TEMPLATE PREVIEW · NOT SENT
                    </div>

                    <div className="wa-bubble">
                      {/* HEADER PREVIEW */}
                      {draft.headerType === 'TEXT' && (preview?.header || draft.header) && (
                        <b style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#111B21' }}>
                          {preview?.header || draft.header}
                        </b>
                      )}

                      {draft.headerType === 'IMAGE' && (
                        <div style={{ marginBottom: '8px', borderRadius: '6px', overflow: 'hidden', background: '#F0F2F5', maxHeight: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {draft.headerMediaUrl ? (
                            <img src={draft.headerMediaUrl} alt="Header Preview" style={{ width: '100%', height: 'auto', display: 'block' }} />
                          ) : (
                            <div style={{ padding: '24px', color: '#8696A0', fontSize: '11px', textAlign: 'center' }}>
                              <ImageIcon size={24} style={{ margin: '0 auto 4px' }} />
                              [Image Header Asset]
                            </div>
                          )}
                        </div>
                      )}

                      {draft.headerType === 'VIDEO' && (
                        <div style={{ marginBottom: '8px', borderRadius: '6px', overflow: 'hidden', background: '#000', maxHeight: '160px' }}>
                          {draft.headerMediaUrl ? (
                            <video src={draft.headerMediaUrl} controls style={{ width: '100%', maxHeight: '160px' }} />
                          ) : (
                            <div style={{ padding: '24px', color: '#FFF', fontSize: '11px', textAlign: 'center' }}>
                              <Video size={24} style={{ margin: '0 auto 4px' }} />
                              [Video Header Asset]
                            </div>
                          )}
                        </div>
                      )}

                      {draft.headerType === 'DOCUMENT' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: '#F0F2F5', borderRadius: '6px', marginBottom: '8px' }}>
                          <FileText size={24} color="#D32F2F" />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <strong style={{ fontSize: '12px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#111B21' }}>
                              {draft.headerMediaName || 'Property_Brochure.pdf'}
                            </strong>
                            <span style={{ fontSize: '10px', color: '#667781' }}>
                              {formatFileSize(draft.headerMediaSize) || 'PDF Document'}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* BODY PREVIEW */}
                      <div style={{ whiteSpace: 'pre-wrap', color: '#111B21', fontSize: '12.5px', lineHeight: 1.5 }}>
                        {preview?.body || draft.body || 'Your message text with personalized contact tokens will render here.'}
                      </div>

                      {/* FOOTER PREVIEW */}
                      {(preview?.footer || draft.footer) && (
                        <div style={{ marginTop: '6px', fontSize: '10.5px', color: '#667781', borderTop: '1px solid #E9EDEF', paddingTop: '4px' }}>
                          {preview?.footer || draft.footer}
                        </div>
                      )}
                    </div>

                    {/* BUTTONS PREVIEW */}
                    {draft.buttons?.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {draft.buttons.map((b, i) => (
                          <div
                            key={i}
                            style={{
                              background: '#FFFFFF',
                              borderRadius: '8px',
                              padding: '8px 12px',
                              textAlign: 'center',
                              fontSize: '12px',
                              fontWeight: 600,
                              color: '#00A884',
                              boxShadow: '0 1px 1px rgba(0,0,0,0.1)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                            }}
                          >
                            {b.type === 'URL' && <ExternalLink size={12} />}
                            {b.type === 'PHONE_NUMBER' && <Phone size={12} />}
                            {b.text}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Variable Resolution Warnings & Status */}
                {preview && (
                  <div
                    style={{
                      padding: '10px 12px',
                      background: preview.valid ? 'var(--color-success-soft)' : 'var(--color-warning-soft)',
                      borderRadius: '8px',
                      fontSize: '11.5px',
                    }}
                  >
                    {preview.valid ? (
                      <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>
                        ✓ All tokens resolved for {preview.contact?.name || 'Contact'}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>
                        ⚠ Missing values: {preview.missingVariables?.join(', ')}
                      </span>
                    )}
                  </div>
                )}

                {/* Validation Warnings */}
                {validation && !validation.valid && (
                  <div style={{ padding: '10px 12px', background: 'var(--color-danger-soft)', borderRadius: '8px', fontSize: '11.5px', color: 'var(--color-danger)' }}>
                    <b>Validation Findings:</b>
                    <ul style={{ margin: '4px 0 0', paddingLeft: '16px' }}>
                      {validation.errors.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', textAlign: 'center', padding: '4px 0' }}>
                  Meta Verification: <b>Not Submitted (Offline Mock)</b>
                </div>
              </aside>
            )}
          </div>
        </>
      )}

      {/* ========================================================
          PRESET LIBRARY TAB (Real Estate Templates)
          ======================================================== */}
      {tab === 'library' && (
        <section className="panel" style={{ padding: '24px' }}>
          <div style={{ marginBottom: '18px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Real Estate Template Library</h2>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>
              Pre-configured property templates for launch announcements, farmhouse enquiries, PDF brochures, and site visits.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
            {library.map((item) => (
              <div
                key={item.id}
                style={{
                  border: '1px solid var(--color-border)',
                  borderRadius: '10px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  background: '#FFFFFF',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="status-badge" style={{ backgroundColor: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}>
                    {item.category}
                  </span>
                  <small style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                    {item.headerType !== 'NONE' ? `Header: ${item.headerType}` : 'No Header'} · {item.language}
                  </small>
                </div>
                <strong style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>{item.name}</strong>
                <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0, fontStyle: 'italic' }}>
                  {item.description}
                </p>
                <div style={{ background: 'var(--color-surface-subtle)', padding: '10px', borderRadius: '6px', fontSize: '12px', color: '#111B21', whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>
                  {item.body}
                </div>
                <button
                  type="button"
                  className="outline-btn small"
                  style={{ alignSelf: 'flex-start', marginTop: 'auto' }}
                  onClick={() => {
                    chooseTemplate({
                      ...EMPTY,
                      ...item,
                      name: `${item.name}_draft`,
                      buttons: item.buttons || [],
                    });
                    toast.success('Preset loaded into Template Studio.');
                  }}
                >
                  <Plus size={13} /> Load Template Preset
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ========================================================
          BUTTON BUILDER MODAL
          ======================================================== */}
      {showButtonModal && (
        <div className="modal-scrim" onClick={() => setShowButtonModal(false)}>
          <div className="contact-modal" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="contact-modal-head">
              <h2>Configure Action Button</h2>
              <button className="icon-btn modal-close" onClick={() => setShowButtonModal(false)}>
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <label className="field">
                Button Action Type
                <select
                  value={newButtonType}
                  onChange={(e) => setNewButtonType(e.target.value)}
                >
                  <option value="QUICK_REPLY">Quick Reply (Customer taps to reply)</option>
                  <option value="URL">URL Call-to-Action (Website or Brochure link)</option>
                  <option value="PHONE_NUMBER">Phone Call-to-Action (Direct Advisory call)</option>
                </select>
              </label>

              <label className="field">
                Button Text Label *
                <input
                  maxLength="25"
                  value={newButtonText}
                  onChange={(e) => setNewButtonText(e.target.value)}
                  placeholder="e.g. Yes, share details"
                />
                <small style={{ fontSize: '10.5px', color: 'var(--color-text-muted)' }}>
                  {newButtonText.length}/25 characters
                </small>
              </label>

              {newButtonType === 'URL' && (
                <label className="field">
                  Destination HTTPS URL *
                  <input
                    value={newButtonValue}
                    onChange={(e) => setNewButtonValue(e.target.value)}
                    placeholder="https://m2wrealty.com/projects"
                  />
                  <small style={{ fontSize: '10.5px', color: 'var(--color-text-muted)' }}>
                    Must begin with https://
                  </small>
                </label>
              )}

              {newButtonType === 'PHONE_NUMBER' && (
                <label className="field">
                  Phone Number (International E.164) *
                  <input
                    value={newButtonValue}
                    onChange={(e) => setNewButtonValue(e.target.value)}
                    placeholder="+919811122233"
                  />
                  <small style={{ fontSize: '10.5px', color: 'var(--color-text-muted)' }}>
                    Format: +[CountryCode][Number]
                  </small>
                </label>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button type="button" className="outline-btn small" onClick={() => setShowButtonModal(false)}>
                  Cancel
                </button>
                <button type="button" className="primary-btn small" onClick={handleAddButton}>
                  Add to Template
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          VERSION HISTORY DRAWER / MODAL
          ======================================================== */}
      {showVersions && (
        <div className="modal-scrim" onClick={() => setShowVersions(false)}>
          <div className="contact-modal" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <div className="contact-modal-head">
              <h2>Template Version History</h2>
              <button className="icon-btn modal-close" onClick={() => setShowVersions(false)}>
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: '16px 20px', overflowY: 'auto', maxHeight: '450px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {versions.length === 0 && (
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', textAlign: 'center', padding: '16px' }}>
                  No historical versions saved yet.
                </div>
              )}
              {versions.map((v) => (
                <div
                  key={v._id}
                  style={{
                    padding: '12px',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    background: '#FFFFFF',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <strong style={{ fontSize: '13px' }}>Version {v.versionNumber}</strong>
                      {v.versionNumber === draft.currentVersionNumber && (
                        <span style={{ fontSize: '10px', background: 'var(--color-primary-soft)', color: 'var(--color-primary)', padding: '1px 5px', borderRadius: '4px', fontWeight: 600 }}>
                          Current Active
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                      {new Date(v.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '4px 0 6px' }}>
                    {v.revisionNotes || 'No revision notes provided'}
                  </p>
                  <div style={{ background: 'var(--color-surface-subtle)', padding: '6px 8px', borderRadius: '4px', fontSize: '11.5px', color: '#111B21', marginBottom: '8px', maxHeight: '60px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {v.snapshot?.body}
                  </div>
                  <button
                    type="button"
                    className="outline-btn small"
                    onClick={() => restoreVersionToDraft(v._id)}
                  >
                    Restore snapshot as new draft
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
