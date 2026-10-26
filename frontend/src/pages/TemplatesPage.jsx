import { resolveContactVariables } from '../utils/crmVariables';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Archive,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
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
  Trash2,
  Upload,
  Video,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { useWorkspace } from '../context/WorkspaceContext';
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
import '../templates.css';

const EMPTY = {
  name: '',
  description: '',
  category: 'Marketing',
  businessCategory: '',
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

const LANGS = [
  ['en', 'English'],
  ['hi', 'Hindi (हिन्दी)'],
  ['hinglish', 'Hinglish'],
];

const errorMsg = (e) => e.response?.data?.message || e.message || 'Something went wrong.';

// Safe client-side synchronized preview resolver for real-time typing

export default function TemplatesPage() {
  const [params] = useSearchParams();
  const { currentWorkspace, industryConfig } = useWorkspace();
  const safeConfig = industryConfig || {};
  const safeUi = safeConfig.ui || {};
  const activeIndustry = safeConfig.industryKey || currentWorkspace?.industryKey || 'real_estate';
  const presetLibraryLabel = safeUi.libraryLabel || 'Industry Preset Library';
  const industryName = safeConfig.industryName || 'Industry';
  const industryDescription = safeConfig.description || '';
  const templatePlaceholder = safeUi.templatePlaceholder || 'Type your message template here...';
  const industryLabel = safeConfig.displayLabel || 'Industry';
  const [variableGroups, setVariableGroups] = useState([]);
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
  const [showPreviewDrawer, setShowPreviewDrawer] = useState(() => window.innerWidth >= 1440);
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

  const [saveError, setSaveError] = useState(null);
  const [lastSavedAt, setLastSavedAt] = useState(null);

  const editor = useRef(null);
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(savedDraft), [draft, savedDraft]);

  // Authoritative draft save state machine: NEW_CLEAN | NEW_DIRTY | EXISTING_CLEAN | EXISTING_DIRTY | SAVING | SAVE_ERROR
  const saveState = useMemo(() => {
    if (saving) return 'SAVING';
    if (saveError) return 'SAVE_ERROR';
    if (!selected) {
      const hasEnteredFields = Boolean(
        draft.name.trim() ||
        draft.body.trim() ||
        draft.header.trim() ||
        draft.footer.trim() ||
        (draft.buttons && draft.buttons.length > 0)
      );
      return (dirty || hasEnteredFields) ? 'NEW_DIRTY' : 'NEW_CLEAN';
    }
    return dirty ? 'EXISTING_DIRTY' : 'EXISTING_CLEAN';
  }, [saving, saveError, selected, dirty, draft]);

  // Selected CRM Contact record for live personalization
  const selectedContact = useMemo(() => {
    return contacts.find((c) => String(c._id) === String(contactId)) || null;
  }, [contacts, contactId]);

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
      const [{ data: a }, { data: b }, { data: variables }] = await Promise.all([
        listTemplates({archived:showArchived?'true':'false'}),
        getTemplateLibrary(),
        getTemplateVariables(),
      ]);
      setTemplates(a.records || []);
      setLibrary(b.records || []);
      setVariableGroups(variables.categories.map(g => ({ id: g.id, label: g.name, vars: g.variables })));
    } catch (e) {
      toast.error(errorMsg(e), {id:'template-load-error'});
    } finally {
      setLoading(false);
    }
  }, [statusFilter, currentWorkspace?._id]);

  useEffect(() => {
    refresh();
    listContacts({ limit: 100, archived: 'false' })
      .then(({ data }) => setContacts(data.records || []))
      .catch(() => {});
  }, [refresh, currentWorkspace?._id]);

  // Reset selected template and draft on workspace change
  useEffect(() => {
    setSelected(null);
    setDraft(EMPTY);
    setSavedDraft(EMPTY);
  }, [currentWorkspace?._id]);

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
    const isNew = !t._id;
    const next = {
      ...EMPTY,
      ...t,
      headerType: t.headerType || (t.header ? 'TEXT' : 'NONE'),
      buttons: t.buttons || [],
      sampleValues: t.sampleValues || {},
    };
    setSelected(t._id || null);
    setDraft(next);
    setSavedDraft(isNew ? EMPTY : next);
    setSaveError(null);
    setLastSavedAt(t.updatedAt ? new Date(t.updatedAt) : null);
    setPreview(null);
    setValidation(null);
    setTab('templates');
    setMobileSegment('editor');
  };

  const newTemplate = () => chooseTemplate(EMPTY);

  const save = async () => {
    if (saving) return;
    if (!draft.name.trim()) {
      toast.error('Add a clear, provider-compatible template name.');
      return;
    }
    if (!draft.body.trim()) {
      toast.error('Message body text is required.');
      return;
    }
    setSaving(true);
    setSaveError(null);
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
      setSaveError(null);
      setLastSavedAt(new Date());
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
      const msg = errorMsg(e);
      setSaveError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // Keyboard shortcut: Cmd+S / Ctrl+S to save draft
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [save]);

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

  // Live body preview computed value:
  // If preview from server exists and draft is not dirty, use it;
  // Otherwise resolve in real-time client side with selected contact.
  const livePreviewBody = useMemo(() => {
    if (!dirty && preview?.body) return preview.body;
    if (draft.body?.trim()) return resolveContactVariables(draft.body, selectedContact, currentWorkspace);
    return '';
  }, [dirty, preview?.body, draft.body, selectedContact, currentWorkspace]);

  const livePreviewHeader = useMemo(() => {
    if (!dirty && preview?.header) return preview.header;
    if (draft.header?.trim()) return resolveContactVariables(draft.header, selectedContact, currentWorkspace);
    return '';
  }, [dirty, preview?.header, draft.header, selectedContact, currentWorkspace]);

  const livePreviewFooter = useMemo(() => {
    return draft.footer || preview?.footer || '';
  }, [draft.footer, preview?.footer]);

  const businessDisplayName = currentWorkspace?.name || 'Workspace';
  const businessInitial = businessDisplayName.charAt(0).toUpperCase() || 'R';

  return (
    <div className="templates-page">
      {/* Page Header */}
      <PageHeader
        eyebrow="RELAY MESSAGE TEMPLATES · TEMPLATE STUDIO"
        title="Templates"
        subtitle="Create, personalize and manage your business messaging templates."
        actions={
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button className="primary-btn small" onClick={newTemplate}>
              <Plus size={15} /> New Template
            </button>
          </div>
        }
      />

      {/* Top Level Studio / Preset Library Tabs */}
      <div className="tp-top-tabs">
        <button
          className={`tp-top-tab ${tab === 'templates' ? 'active' : ''}`}
          onClick={() => setTab('templates')}
        >
          <MessageSquareText size={14} /> Template Studio
        </button>
        <button
          className={`tp-top-tab ${tab === 'library' ? 'active' : ''}`}
          onClick={() => setTab('library')}
        >
          <Sparkles size={14} /> {presetLibraryLabel}
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
              onClick={() => { setMobileSegment('preview'); setShowPreviewDrawer(true); }}
              style={{ flex: 1 }}
            >
              Live Preview
            </button>
          </div>

          <div className={`template-workspace ${!showPreviewDrawer ? 'hide-preview' : ''}`}>
            {/* ========================================================
                LEFT PANEL: Template Library (~280px)
                ======================================================== */}
            <aside className={`template-list-panel ${mobileSegment !== 'library' ? 'mobile-hidden' : ''}`}>
              <div className="tp-library-head">
                <div className="tp-library-title">
                  <span>Saved Templates</span>
                  <span className="tp-library-badge">{filtered.length}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <select
                    className="tp-status-select"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="active">Active Drafts</option>
                    <option value="archived">Archived</option>
                  </select>
                  <button
                    type="button"
                    className="icon-btn small"
                    onClick={newTemplate}
                    title="Create new template draft"
                    style={{ width: '28px', height: '28px', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              <div className="tp-search-bar">
                <Search size={14} color="var(--tp-slate-400)" />
                <input
                  className="tp-search-input"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search template name or body…"
                />
              </div>

              {/* Filter Controls */}
              <div className="tp-filter-row">
                <select
                  className="tp-filter-select"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="">All Categories</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Utility">Utility</option>
                  <option value="Authentication">Authentication</option>
                </select>
                <select
                  className="tp-filter-select"
                  value={languageFilter}
                  onChange={(e) => setLanguageFilter(e.target.value)}
                >
                  <option value="">All Languages</option>
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                  <option value="hinglish">Hinglish</option>
                </select>
                <button
                  type="button"
                  title="Show favorites only"
                  className={`tp-fav-filter-btn ${favoriteOnly ? 'active' : ''}`}
                  onClick={() => setFavoriteOnly((v) => !v)}
                >
                  ★
                </button>
              </div>

              {/* Template Items List */}
              <div className="tp-list-items">
                {loading && (
                  <div style={{ fontSize: '12px', color: 'var(--tp-slate-400)', padding: '16px 0', textAlign: 'center' }}>
                    Loading templates…
                  </div>
                )}
                {!loading && !filtered.length && (
                  <div style={{ fontSize: '12px', color: 'var(--tp-slate-400)', padding: '28px 8px', textAlign: 'center' }}>
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
                      className={`tp-template-item ${isSelected ? 'selected' : ''}`}
                    >
                      <div className="tp-template-item-head">
                        <strong className="tp-template-name" title={t.name}>{t.name}</strong>
                        <span className="tp-version-badge">
                          v{t.currentVersionNumber || 1}
                        </span>
                      </div>
                      <p className="tp-template-snippet">
                        {t.body || 'Empty message body'}
                      </p>
                      <div className="tp-template-meta">
                        <span className="tp-meta-pill">{t.category}</span>
                        <span className="tp-meta-pill" style={{ textTransform: 'uppercase' }}>{t.language}</span>
                        {headerBadge && (
                          <span className="tp-meta-pill blue">
                            {headerBadge}
                          </span>
                        )}
                        <span
                          className={`tp-fav-star ${t.isFavorite ? 'active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(t);
                          }}
                          title={t.isFavorite ? 'Remove from favorites' : 'Mark as favorite'}
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
            <section className={`template-editor-panel ${mobileSegment !== 'editor' ? 'mobile-hidden' : ''}`}>
              {/* Editor Top Bar with Contextual Header */}
              <div className="tp-editor-header">
                <div className="tp-editor-header-identity">
                  <h2 className="tp-editor-title">
                    {selected ? (draft.name || 'Untitled Template') : (draft.name || 'Create Message Template')}
                  </h2>
                  <div className="tp-editor-badge-row">
                    <span
                      className={`tp-badge-status ${
                        draft.localStatus === 'Archived'
                          ? 'archived'
                          : saveState === 'NEW_CLEAN'
                          ? 'neutral'
                          : saveState === 'NEW_DIRTY' || saveState === 'EXISTING_DIRTY'
                          ? 'dirty'
                          : saveState === 'SAVING'
                          ? 'saving'
                          : saveState === 'SAVE_ERROR'
                          ? 'error'
                          : 'clean'
                      }`}
                    >
                      {saveState === 'NEW_CLEAN' && 'New Draft · Not Saved'}
                      {(saveState === 'NEW_DIRTY' || saveState === 'EXISTING_DIRTY') && 'Unsaved Changes'}
                      {saveState === 'EXISTING_CLEAN' && `${draft.localStatus || 'Draft'} · v${draft.currentVersionNumber || 1}`}
                      {saveState === 'SAVING' && 'Saving…'}
                      {saveState === 'SAVE_ERROR' && "Couldn't save changes"}
                    </span>
                    <span className="tp-badge-meta">
                      Meta Status: Not Submitted (Mock Mode)
                    </span>
                  </div>
                </div>

                <div className="tp-editor-actions">
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
                      title={draft.localStatus === 'Archived' ? 'Restore template to active' : 'Archive template'}
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
                    onClick={() => { setShowPreviewDrawer(v => !v); if (window.innerWidth <= 768) setMobileSegment('preview'); }}
                    title={showPreviewDrawer ? 'Collapse WhatsApp preview column' : 'Expand WhatsApp preview column'}
                  >
                    {showPreviewDrawer ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}{' '}
                    {showPreviewDrawer ? 'Hide Preview' : 'Show Preview'}
                  </button>
                </div>
              </div>

              {/* Dedicated Scrollable Form Body Container */}
              <div className="tp-editor-body-scroll">
                {/* Campaign references banner */}
                {campaignUsage.length > 0 && (
                  <div className="tp-pinned-banner">
                    <b>Pinned in Campaigns:</b> {campaignUsage.map((c) => c.name).join(', ')}
                    <div style={{ fontSize: '11px', color: 'var(--tp-slate-500)', marginTop: '2px' }}>
                      Active campaigns maintain immutable snapshots of their assigned version.
                    </div>
                  </div>
                )}

                {/* Form Core Sections */}
                <div className="tp-editor-form">
                  {/* SECTION 1: Identity & Classification */}
                  <div className="tp-section-card">
                    <div className="tp-section-head">
                      <span className="tp-section-title">1. Identity & Classification</span>
                      <span className="tp-section-subtitle">Provider identifier, category, and language</span>
                    </div>
                    <div className="tp-identity-grid">
                      <label className="field tp-field-full">
                        Template Identifier Name *
                        <input
                          maxLength="120"
                          value={draft.name}
                          onChange={(e) => setDraft((v) => ({ ...v, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') }))}
                          placeholder={templatePlaceholder}
                          style={{ fontFamily: 'monospace', fontSize: '13px' }}
                        />
                        <small style={{ fontSize: '10.5px', color: 'var(--tp-slate-500)' }}>
                          Unique identifier using lowercase letters, numbers, and underscores only.
                        </small>
                      </label>

                      <div className="tp-identity-row">
                        <label className="field" style={{ flex: 1 }}>
                          Category *
                          <select
                            value={draft.category}
                            onChange={(e) => setDraft((v) => ({ ...v, category: e.target.value }))}
                          >
                            <option value="Marketing">Marketing</option>
                            <option value="Utility">Utility</option>
                            <option value="Authentication">Authentication (OTP & Verification)</option>
                          </select>
                          <small style={{ fontSize: '10.5px', color: 'var(--tp-slate-500)' }}>
                            Meta template message category
                          </small>
                        </label>

                        <label className="field" style={{ flex: 1 }}>
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
                          <small style={{ fontSize: '10.5px', color: 'var(--tp-slate-500)' }}>
                            Recipient display locale
                          </small>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 2: Header Component */}
                  <div className="tp-section-card">
                    <div className="tp-section-head">
                      <span className="tp-section-title">2. Header Component (Optional)</span>
                      <span className="tp-section-subtitle">Text headline, image, video or PDF brochure</span>
                    </div>

                    <div className="tp-header-types">
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
                          className={`tp-header-opt-btn ${draft.headerType === item.type ? 'active' : ''}`}
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
                        <small style={{ fontSize: '10.5px', color: 'var(--tp-slate-500)' }}>
                          {draft.header.length}/60 characters
                        </small>
                      </div>
                    )}

                    {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(draft.headerType) && (
                      <div style={{ marginTop: '8px' }}>
                        {draft.headerMediaUrl ? (
                          <div className="tp-media-card">
                            <div className="tp-media-info">
                              {draft.headerType === 'DOCUMENT' && <FileText size={22} color="var(--tp-blue-600)" />}
                              {draft.headerType === 'IMAGE' && <ImageIcon size={22} color="var(--tp-blue-600)" />}
                              {draft.headerType === 'VIDEO' && <Video size={22} color="var(--tp-blue-600)" />}
                              <div>
                                <strong className="tp-media-title">
                                  {draft.headerMediaName || 'Attached Media Asset'}
                                </strong>
                                <span className="tp-media-sub">
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
                            className="tp-media-dropzone"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <Upload size={24} color="var(--tp-blue-600)" style={{ margin: '0 auto 6px' }} />
                            <strong style={{ fontSize: '13px', display: 'block', color: 'var(--tp-slate-900)' }}>
                              {uploadingMedia ? `Uploading (${uploadProgress}%)…` : `Select or drop ${draft.headerType.toLowerCase()} file`}
                            </strong>
                            <span style={{ fontSize: '11px', color: 'var(--tp-slate-500)' }}>
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

                  {/* SECTION 3: Message Body Composition */}
                  <div className="tp-section-card">
                    <div className="tp-section-head">
                      <span className="tp-section-title">3. Message Body Text *</span>
                      <span className="tp-section-subtitle">
                        {draft.body.length}/4096 chars · {wordCount} words · {detectedVars.length} placeholders
                      </span>
                    </div>

                    <textarea
                      ref={editor}
                      rows={7}
                      maxLength={4096}
                      value={draft.body}
                      onChange={(e) => {
                        setDraft((v) => ({ ...v, body: e.target.value }));
                        if (saveError) setSaveError(null);
                      }}
                      placeholder="Write a message and insert supported contact or workspace variables below."
                      className="tp-body-textarea"
                    />

                    {/* Variable Group Selector & Insertion Chips */}
                    <div className="tp-var-toolbar">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div className="tp-var-group-tabs">
                          {variableGroups.filter(
                            (g) => g.id === 'contact' || g.id === 'business' || g.id === activeIndustry
                          ).map((g) => (
                            <button
                              key={g.id}
                              type="button"
                              onClick={() => setActiveVarGroup(g.id)}
                              className={`tp-var-group-btn ${activeVarGroup === g.id ? 'active' : ''}`}
                            >
                              {g.label}
                            </button>
                          ))}
                        </div>
                        <span style={{ fontSize: '10.5px', color: 'var(--tp-slate-500)' }}>
                          Click token to insert at cursor
                        </span>
                      </div>

                      <div className="tp-var-chips">
                        {variableGroups.find((g) => g.id === activeVarGroup)?.vars?.map((v) => (
                          <button
                            key={v.key}
                            type="button"
                            onClick={() => insertVariable(v.key)}
                            className="tp-var-chip"
                            title={`Insert {{${v.key}}} at cursor position`}
                          >
                            +{`{{${v.key}}}`} <span className="tp-var-chip-label">({v.label})</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* SECTION 4: Footer Component */}
                  <div className="tp-section-card">
                    <div className="tp-section-head">
                      <span className="tp-section-title">4. Footer Notice (Optional)</span>
                      <span className="tp-section-subtitle">Plain text only; variables are not allowed in footers.</span>
                    </div>
                    <input
                      maxLength="60"
                      value={draft.footer}
                      onChange={(e) => setDraft((v) => ({ ...v, footer: e.target.value }))}
                      placeholder="e.g. Reply STOP to opt out · M2W Realty Advisory Desk"
                    />
                    <small style={{ fontSize: '10.5px', color: 'var(--tp-slate-500)' }}>
                      {draft.footer.length}/60 characters
                    </small>
                  </div>

                  {/* SECTION 5: Interactive Buttons */}
                  <div className="tp-section-card">
                    <div className="tp-section-head">
                      <div>
                        <span className="tp-section-title">5. Interactive Buttons (Optional)</span>
                        <span className="tp-section-subtitle">
                          WhatsApp supports up to 3 Quick Replies OR up to 2 Call-to-Actions (1 URL + 1 Phone).
                        </span>
                      </div>
                      <button
                        type="button"
                        className="primary-btn small"
                        onClick={() => setShowButtonModal(true)}
                      >
                        <Plus size={13} /> Add Button
                      </button>
                    </div>

                    {draft.buttons?.length > 0 ? (
                      <div className="tp-button-list">
                        {draft.buttons.map((b, i) => (
                          <div key={i} className="tp-button-row">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span className="tp-button-badge">
                                {b.type === 'QUICK_REPLY' ? 'QUICK REPLY' : b.type === 'URL' ? 'URL CTA' : 'PHONE CTA'}
                              </span>
                              <strong style={{ color: 'var(--tp-slate-900)' }}>{b.text}</strong>
                              {b.value && (
                                <span style={{ color: 'var(--tp-slate-500)', fontSize: '11px', fontFamily: 'monospace' }}>
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
                      <div style={{ fontSize: '12px', color: 'var(--tp-slate-400)', fontStyle: 'italic', padding: '6px 0' }}>
                        No interactive buttons configured yet. (Optional)
                      </div>
                    )}
                  </div>

                  {/* SECTION 6: Versioning & Revision Notes */}
                  <div className="tp-section-card">
                    <div className="tp-section-head">
                      <span className="tp-section-title">6. Revision Notes</span>
                      <span className="tp-section-subtitle">Recorded in immutable version history snapshot</span>
                    </div>
                    <input
                      maxLength="200"
                      value={draft.revisionNotes}
                      onChange={(e) => setDraft((v) => ({ ...v, revisionNotes: e.target.value }))}
                      placeholder="e.g. Updated launch dates and added brochure CTA"
                    />
                    <small style={{ fontSize: '10.5px', color: 'var(--tp-slate-500)' }}>
                      Optional note explaining what was updated in this revision
                    </small>
                  </div>
                </div>
              </div>

              {/* Contained Sticky Action Footer (Never overlaps form fields) */}
              <div className="tp-editor-sticky-footer">
                <span
                  className={`tp-save-status ${
                    saveState === 'SAVING'
                      ? 'saving'
                      : saveState === 'SAVE_ERROR'
                      ? 'error'
                      : saveState === 'NEW_CLEAN'
                      ? 'neutral'
                      : saveState === 'NEW_DIRTY' || saveState === 'EXISTING_DIRTY'
                      ? 'dirty'
                      : 'clean'
                  }`}
                >
                  {saveState === 'SAVING' && (
                    <>
                      <LoaderCircle className="spin" size={14} /> Saving draft to MongoDB…
                    </>
                  )}
                  {saveState === 'SAVE_ERROR' && (
                    <>
                      <AlertCircle size={14} /> Couldn't save changes ({saveError})
                    </>
                  )}
                  {saveState === 'NEW_CLEAN' && (
                    <>
                      <FileText size={14} color="var(--tp-slate-400)" /> New Draft · Not Saved
                    </>
                  )}
                  {(saveState === 'NEW_DIRTY' || saveState === 'EXISTING_DIRTY') && (
                    <>
                      <AlertCircle size={14} /> Unsaved draft changes
                    </>
                  )}
                  {saveState === 'EXISTING_CLEAN' && (
                    <>
                      <CheckCircle2 size={14} color="var(--tp-emerald-600)" /> All changes saved to MongoDB
                      {lastSavedAt && (
                        <span style={{ fontSize: '11px', color: 'var(--tp-slate-400)', marginLeft: '4px' }}>
                          ({lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                        </span>
                      )}
                    </>
                  )}
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
            </section>

            {/* ========================================================
                RIGHT PANEL: Live WhatsApp Preview (~340px)
                ======================================================== */}
            {showPreviewDrawer && (
              <aside className={`template-preview-column ${mobileSegment !== 'preview' ? 'mobile-hidden' : ''}`}>
                <div className="tp-preview-header">
                  <strong className="tp-preview-title">
                    WhatsApp Template Preview — Not Sent
                  </strong>
                  <button
                    type="button"
                    className="icon-btn small"
                    aria-label="Close preview"
                    onClick={() => { setShowPreviewDrawer(false); setMobileSegment('editor'); }}
                  >
                    <X size={14} />
                  </button>
                  <div className="tp-device-toggle">
                    <button
                      type="button"
                      className={`tp-device-btn ${previewDevice === 'phone' ? 'active' : ''}`}
                      onClick={() => setPreviewDevice('phone')}
                    >
                      Phone
                    </button>
                    <button
                      type="button"
                      className={`tp-device-btn ${previewDevice === 'desktop' ? 'active' : ''}`}
                      onClick={() => setPreviewDevice('desktop')}
                    >
                      Desktop
                    </button>
                  </div>
                </div>

                {/* CRM Contact Variable Resolution Picker */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontSize: '11.5px', color: 'var(--tp-slate-600)', fontWeight: 600 }}>
                    Preview with CRM Contact:
                  </label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <select
                      value={contactId}
                      onChange={(e) => setContactId(e.target.value)}
                      className="tp-filter-select"
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
                <div className={`whatsapp-preview ${previewDevice === 'desktop' ? 'desktop-mode' : ''}`}>
                  <div className="wa-preview-top">
                    <div className="wa-avatar">
                      {businessInitial}
                    </div>
                    <div>
                      <strong style={{ fontSize: '13px', display: 'block', color: '#FFFFFF' }}>{businessDisplayName}</strong>
                      <span style={{ fontSize: '10px', opacity: 0.85, color: '#E2E8F0' }}>{industryName} · Template Preview</span>
                    </div>
                  </div>

                  <div className="wa-chat-bg">
                    <div className="wa-preview-pill">
                      TEMPLATE PREVIEW · NOT SENT
                    </div>

                    {!draft.body.trim() && !draft.header.trim() ? (
                      <div className="wa-empty-preview-state">
                        <MessageSquareText size={28} color="#94A3B8" style={{ margin: '0 auto 8px', display: 'block' }} />
                        <strong style={{ fontSize: '13px', color: '#475569', display: 'block', fontWeight: 600 }}>
                          Your message preview will appear here
                        </strong>
                        <span style={{ fontSize: '11.5px', color: '#64748B', display: 'block', marginTop: '4px', lineHeight: 1.4 }}>
                          Start typing in the editor or select a template from the library to see the live WhatsApp preview.
                        </span>
                      </div>
                    ) : (
                      <div className="wa-bubble">
                        {/* HEADER PREVIEW */}
                        {draft.headerType === 'TEXT' && livePreviewHeader && (
                          <b className="wa-bubble-header">
                            {livePreviewHeader}
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
                        <div className="wa-bubble-body">
                          {livePreviewBody}
                        </div>

                        {/* FOOTER PREVIEW */}
                        {livePreviewFooter && (
                          <div className="wa-bubble-footer">
                            {livePreviewFooter}
                          </div>
                        )}
                      </div>
                    )}

                    {/* BUTTONS PREVIEW */}
                    {draft.buttons?.length > 0 && (
                      <div className="wa-buttons-stack">
                        {draft.buttons.map((b, i) => (
                          <div key={i} className="wa-btn-pill">
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
                      background: preview.valid ? 'var(--tp-emerald-50)' : 'var(--tp-amber-50)',
                      borderRadius: '8px',
                      fontSize: '11.5px',
                      border: '1px solid',
                      borderColor: preview.valid ? '#BBF7D0' : '#FDE68A',
                    }}
                  >
                    {preview.valid ? (
                      <span style={{ color: 'var(--tp-emerald-600)', fontWeight: 600 }}>
                        ✓ All tokens resolved for {preview.contact?.name || 'Contact'}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--tp-amber-500)', fontWeight: 600 }}>
                        ⚠ Missing values: {preview.missingVariables?.join(', ')}
                      </span>
                    )}
                  </div>
                )}

                {/* Validation Warnings */}
                {validation && !validation.valid && (
                  <div style={{ padding: '10px 12px', background: 'var(--tp-red-50)', border: '1px solid #FECACA', borderRadius: '8px', fontSize: '11.5px', color: 'var(--tp-red-600)' }}>
                    <b>Validation Findings:</b>
                    <ul style={{ margin: '4px 0 0', paddingLeft: '16px' }}>
                      {(validation.errors || []).map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div style={{ fontSize: '11px', color: 'var(--tp-slate-500)', textAlign: 'center', padding: '4px 0' }}>
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
            <h2 style={{ fontSize: '18px', fontWeight: 700 }}>{industryName} Template Library</h2>
            <p style={{ fontSize: '13px', color: 'var(--tp-slate-500)', margin: '4px 0 0' }}>
              {industryDescription}
            </p>
          </div>

          {!loading && library.length === 0 && <p role="status">No presets are available for this workspace’s industry. Saved templates remain available in the studio.</p>}
          <div className="tp-preset-grid">
            {library.map((item) => (
              <div key={item.id} className="tp-preset-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="status-badge" style={{ backgroundColor: 'var(--tp-blue-50)', color: 'var(--tp-blue-600)', border: '1px solid var(--tp-blue-border)' }}>
                    {item.category}
                  </span>
                  <small style={{ fontSize: '11px', color: 'var(--tp-slate-400)' }}>
                    {item.headerType !== 'NONE' ? `Header: ${item.headerType}` : 'No Header'} · {item.language}
                  </small>
                </div>
                <strong style={{ fontSize: '14px', color: 'var(--tp-slate-900)' }}>{item.title || item.name}</strong>
                <p style={{ fontSize: '12px', color: 'var(--tp-slate-500)', margin: 0, fontStyle: 'italic' }}>
                  {item.description}
                </p>
                <div className="tp-preset-body">
                  {item.body}
                </div>
                <button
                  type="button"
                  className="primary-btn small"
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
                <small style={{ fontSize: '10.5px', color: 'var(--tp-slate-500)' }}>
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
                  <small style={{ fontSize: '10.5px', color: 'var(--tp-slate-500)' }}>
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
                  <small style={{ fontSize: '10.5px', color: 'var(--tp-slate-500)' }}>
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
                <div style={{ fontSize: '12px', color: 'var(--tp-slate-500)', textAlign: 'center', padding: '16px' }}>
                  No historical versions saved yet.
                </div>
              )}
              {versions.map((v) => (
                <div
                  key={v._id}
                  style={{
                    padding: '12px',
                    border: '1px solid var(--tp-slate-200)',
                    borderRadius: '8px',
                    background: '#FFFFFF',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <strong style={{ fontSize: '13px' }}>Version {v.versionNumber}</strong>
                      {v.versionNumber === draft.currentVersionNumber && (
                        <span style={{ fontSize: '10px', background: 'var(--tp-blue-50)', color: 'var(--tp-blue-600)', padding: '1px 6px', borderRadius: '4px', fontWeight: 600, border: '1px solid var(--tp-blue-border)' }}>
                          Current Active
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--tp-slate-500)' }}>
                      {new Date(v.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--tp-slate-600)', margin: '4px 0 6px' }}>
                    {v.revisionNotes || 'No revision notes provided'}
                  </p>
                  <div style={{ background: 'var(--tp-slate-50)', border: '1px solid var(--tp-slate-200)', padding: '6px 8px', borderRadius: '4px', fontSize: '11.5px', color: '#111B21', marginBottom: '8px', maxHeight: '60px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
