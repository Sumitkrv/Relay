import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  ArrowLeft,
  ArrowUp,
  BarChart3,
  Bot,
  Check,
  CheckCheck,
  ChevronDown,
  Clock3,
  Copy,
  Edit2,
  ExternalLink,
  Filter,
  Flame,
  HelpCircle,
  MessageCircle,
  MessageSquare,
  MoreHorizontal,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Send,
  Shield,
  ShieldAlert,
  Sparkles,
  StickyNote,
  Tag,
  Trash2,
  UserCheck,
  UserRound,
  Zap,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Link, useSearchParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { listTemplates, getTemplate } from '../services/templates';
import http from '../services/api';
import { useAuth } from '../context/AuthContext';
import * as api from '../services/inbox';

const STATUSES = ['Open', 'Needs Attention', 'Pending', 'Follow-up Required', 'Resolved', 'Closed', 'Archived'];
const LEADS = [
  'New',
  'Contacted',
  'Interested',
  'Follow-up Required',
  'Negotiation',
  'Converted',
  'Not Interested',
  'Closed',
];

const err = (e) => e?.response?.data?.message || 'Could not complete this action.';
const initials = (n) =>
  String(n || '?')
    .split(' ')
    .map((x) => x[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const when = (d) =>
  d
    ? new Date(d).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '—';

function dateLabel(d) {
  const x = new Date(d),
    today = new Date();
  if (x.toDateString() === today.toDateString()) return 'Today';
  const y = new Date();
  y.setDate(today.getDate() - 1);
  return x.toDateString() === y.toDateString()
    ? 'Yesterday'
    : x.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
}

export function InboxPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('conversations'); // 'conversations' | 'rules' | 'quickreplies'
  
  // Conversations State
  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [filter, setFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('');
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(() => searchParams.get('conversationId') || '');
  const [detail, setDetail] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [notes, setNotes] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [noteText, setNoteText] = useState('');
  const [templates, setTemplates] = useState([]);
  const [templateId, setTemplateId] = useState('');
  const [showContact, setShowContact] = useState(true);
  const [showFollowup, setShowFollowup] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskPriority, setTaskPriority] = useState('Medium');
  const [taskDue, setTaskDue] = useState('');
  const [saving, setSaving] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [newContact, setNewContact] = useState('');
  
  // Manual Log & Simulator Modals
  const [manualOpen, setManualOpen] = useState(false);
  const [manualText, setManualText] = useState('');
  const [manualType, setManualType] = useState('Phone Call');
  const [manualDirection, setManualDirection] = useState('outbound');
  
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [testInboundText, setTestInboundText] = useState('Can you send the BROCHURE?');

  // Quick Replies State
  const [quickReplies, setQuickReplies] = useState([]);
  const [quickReplyCategory, setQuickReplyCategory] = useState('all');
  const [quickReplySearch, setQuickReplySearch] = useState('');
  const [quickReplyModalOpen, setQuickReplyModalOpen] = useState(false);
  const [qrEditing, setQrEditing] = useState(null);
  const [qrName, setQrName] = useState('');
  const [qrCategory, setQrCategory] = useState('General');
  const [qrText, setQrText] = useState('');
  const [qrDescription, setQrDescription] = useState('');
  const [qrPickerOpen, setQrPickerOpen] = useState(false);

  // Auto-Reply Rules State
  const [rules, setRules] = useState([]);
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [ruleEditing, setRuleEditing] = useState(null);
  const [ruleName, setRuleName] = useState('');
  const [ruleKeyword, setRuleKeyword] = useState('');
  const [ruleSynonyms, setRuleSynonyms] = useState('');
  const [ruleMatchType, setRuleMatchType] = useState('WHOLE_WORD');
  const [ruleActionType, setRuleActionType] = useState('RUN_MOCK_REPLY');
  const [ruleResponse, setRuleResponse] = useState('');
  const [rulePriority, setRulePriority] = useState(10);
  
  // Rule Match Tester State
  const [testQueryText, setTestQueryText] = useState('Do you have unit PRICING?');
  const [testMatchResult, setTestMatchResult] = useState(null);
  const [ruleHistory, setRuleHistory] = useState([]);

  const listRequest = useRef(0);
  const detailRequest = useRef(0);
  const draftValue = useRef('');

  // Load Conversations List
  const loadList = useCallback(async () => {
    const req = ++listRequest.current;
    try {
      setLoading(true);
      const [{ data }, st] = await Promise.all([
        api.inboxList({
          page,
          limit: 25,
          q: q || undefined,
          status: status === 'all' ? undefined : status,
          filter: filter === 'all' ? undefined : filter,
          tag: tagFilter || undefined,
          sort: 'latest',
        }),
        api.inboxStats(),
      ]);
      if (req !== listRequest.current) return;
      setRecords(data.records);
      setTotal(data.total);
      setStats(st.data.stats);
      if (selected && !data.records.some((x) => x._id === selected) && page === 1) {
        // preserve selected if exists
      }
    } catch (e) {
      if (req === listRequest.current) toast.error(err(e));
    } finally {
      if (req === listRequest.current) setLoading(false);
    }
  }, [page, q, status, filter, tagFilter, selected]);

  // Open Conversation
  const openConversation = useCallback(async (id) => {
    const req = ++detailRequest.current;
    setSelected(id);
    try {
      const [{ data: d }, { data: m }] = await Promise.all([
        api.inboxConversation(id),
        api.inboxMessages(id, { limit: 50 }),
      ]);
      if (req !== detailRequest.current) return;
      setDetail(d);
      setMessages(m.records);
      setNotes(d.notes || []);
      setTasks(d.tasks || []);
      setDraft(d.draft?.draftText || '');
      draftValue.current = d.draft?.draftText || '';
      if (d.conversation.internalUnreadCount) await api.markReviewed(id);
      setRecords((prev) =>
        prev.map((c) => (c._id === id ? { ...c, internalUnreadCount: 0 } : c))
      );
    } catch (e) {
      if (req === detailRequest.current) toast.error(err(e));
    }
  }, []);

  // Load Quick Replies
  const loadQuickReplies = useCallback(async () => {
    try {
      const { data } = await api.listQuickReplies({
        category: quickReplyCategory === 'all' ? undefined : quickReplyCategory,
        q: quickReplySearch || undefined,
      });
      setQuickReplies(data.records || []);
    } catch (e) {
      toast.error('Failed to load quick replies');
    }
  }, [quickReplyCategory, quickReplySearch]);

  // Load Rules & Execution History
  const loadRules = useCallback(async () => {
    try {
      const [{ data: rData }, { data: hData }] = await Promise.all([
        api.listAutoReplyRules(),
        api.getRuleExecutionHistory(),
      ]);
      setRules(rData.records || []);
      setRuleHistory(hData.records || []);
    } catch (e) {
      toast.error('Failed to load auto-reply rules');
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    if (activeTab === 'quickreplies') loadQuickReplies();
    if (activeTab === 'rules') loadRules();
  }, [activeTab, loadQuickReplies, loadRules]);

  useEffect(() => {
    listTemplates({ archived: 'false' })
      .then(({ data }) => setTemplates(data.records || []))
      .catch(() => {});
    http
      .get('/contacts', { params: { page: 1, limit: 100 } })
      .then(({ data }) => setContacts(data.records || []))
      .catch(() => {});
    api.listQuickReplies().then(({ data }) => setQuickReplies(data.records || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (selected) {
      openConversation(selected);
    }
  }, [selected, openConversation]);

  // Template Insertion into Draft
  const selectedTemplate = templates.find((t) => t._id === templateId);
  const insertTemplate = async () => {
    if (!selectedTemplate) return;
    let full = selectedTemplate;
    try {
      const { data } = await getTemplate(selectedTemplate._id);
      full = data.template || data;
    } catch {}
    const text =
      full.selectedVersion?.snapshot?.body || full.currentVersion?.snapshot?.body || full.body || '';
    const c = detail?.contact || {};
    const vars = {
      name: c.fullName || 'Valued Client',
      first_name: (c.fullName || 'Client').trim().split(/\s+/)[0],
      project: c.interestedService || c.businessCategory || 'our property',
      city: c.location || 'Gurugram',
      sender_name: user?.name || 'Property Advisor',
    };
    const rendered = text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, k) => vars[k] || `{{${k}}}`);
    setDraft((v) => {
      const next = v ? `${v}\n${rendered}` : rendered;
      draftValue.current = next;
      return next;
    });
    setTemplateId('');
    toast.success('Template inserted into draft.');
  };

  // Quick Reply Insertion into Draft
  const insertQuickReply = (qr) => {
    const c = detail?.contact || {};
    const vars = {
      name: c.fullName || 'Valued Client',
      first_name: (c.fullName || 'Client').trim().split(/\s+/)[0],
      project: c.interestedService || c.businessCategory || 'Prestige Park',
      city: c.location || 'Gurugram',
      property_type: c.industry || 'Apartment',
      business_name: user?.businessName || 'M2W Luxury Realty',
    };
    const rendered = qr.messageText.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, k) => vars[k] || `{{${k}}}`);
    setDraft((v) => {
      const next = v ? `${v}\n${rendered}` : rendered;
      draftValue.current = next;
      return next;
    });
    setQrPickerOpen(false);
    toast.success(`Inserted "${qr.name}"`);
  };

  // Start new conversation record
  const startConversation = async () => {
    if (!newContact) return toast.error('Choose a contact first.');
    try {
      const { data } = await api.createConversation({ contactId: newContact, source: 'manual' });
      setNewContact('');
      setSelected(data.conversation._id);
      await loadList();
      openConversation(data.conversation._id);
      toast.success('Conversation record opened.');
    } catch (e) {
      toast.error(err(e));
    }
  };

  // Status Change
  const doStatus = async (next) => {
    try {
      await api.updateConversationStatus(selected, next);
      toast.success(`Marked as ${next.toLowerCase()}.`);
      await openConversation(selected);
      await loadList();
    } catch (e) {
      toast.error(err(e));
    }
  };

  // Owner Takeover Toggle
  const toggleTakeover = async () => {
    if (!detail?.conversation) return;
    const current = detail.conversation.automationStatus;
    const next = current === 'PAUSED' ? 'ACTIVE' : 'PAUSED';
    try {
      const { data } = await api.toggleConversationAutomation(selected, next);
      setDetail((prev) => ({
        ...prev,
        conversation: { ...prev.conversation, automationStatus: next },
      }));
      toast.success(data.notice);
      await loadList();
    } catch (e) {
      toast.error(err(e));
    }
  };

  // Save Draft
  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const text = draftValue.current;
      await api.saveDraft(selected, { draftText: text });
      toast.success('Draft saved in CRM.');
    } catch (e) {
      toast.error(err(e));
    } finally {
      setSaving(false);
    }
  };

  // Copy Draft
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(draft);
      toast.success('Draft copied to clipboard.');
    } catch {
      toast.error('Clipboard access is unavailable.');
    }
  };

  // Send Mock Reply (MOCK simulation)
  const sendMock = async () => {
    if (!draft.trim()) return toast.error('Type a message to send mock reply.');
    try {
      await api.sendMockReply(selected, draft.trim());
      setDraft('');
      draftValue.current = '';
      await openConversation(selected);
      await loadList();
      toast.success('Simulated WhatsApp reply sent in MOCK mode.');
    } catch (e) {
      toast.error(err(e));
    }
  };

  // Add Internal Note
  const addNote = async () => {
    if (!noteText.trim()) return;
    try {
      await api.addInboxNote(selected, { content: noteText });
      setNoteText('');
      await openConversation(selected);
      toast.success('Internal note added.');
    } catch (e) {
      toast.error(err(e));
    }
  };

  // Add Follow-up Task
  const addTask = async () => {
    if (!taskTitle.trim() || !taskDue) return toast.error('Add a title and due date.');
    try {
      await api.createFollowup({
        conversationId: selected,
        title: taskTitle,
        dueAt: new Date(taskDue).toISOString(),
        description: taskDescription,
        priority: taskPriority,
      });
      setTaskTitle('');
      setTaskDescription('');
      setTaskDue('');
      setShowFollowup(false);
      await openConversation(selected);
      await loadList();
      toast.success('Follow-up scheduled.');
    } catch (e) {
      toast.error(err(e));
    }
  };

  // Log Outside Communication
  const logCommunication = async () => {
    if (!manualText.trim()) return;
    try {
      await api.logManualMessage(selected, {
        body: manualText,
        direction: manualDirection,
        type: manualType,
        occurredAt: new Date().toISOString(),
      });
      setManualText('');
      setManualOpen(false);
      await openConversation(selected);
      await loadList();
      toast.success('Interaction logged in CRM history.');
    } catch (e) {
      toast.error(err(e));
    }
  };

  // Simulate Synthetic Inbound Event (Evaluates Rules!)
  const simulateInbound = async () => {
    if (!testInboundText.trim()) return toast.error('Enter inbound test message text.');
    try {
      const { data } = await api.createSyntheticTestEvent(selected, testInboundText.trim());
      setSimulatorOpen(false);
      await openConversation(selected);
      await loadList();
      if (data.ruleEvaluation?.matched) {
        toast.success(`Matched rule: ${data.ruleEvaluation.rule?.name} (${data.ruleEvaluation.action})`);
      } else if (data.ruleEvaluation?.paused) {
        toast('Inbound event logged. Auto-replies paused due to Manual Takeover.', { icon: '🛡️' });
      } else {
        toast.success('Inbound test message logged (no keyword matched).');
      }
    } catch (e) {
      toast.error(err(e));
    }
  };

  // Quick Reply CRUD
  const saveQuickReply = async () => {
    if (!qrName.trim() || !qrText.trim()) return toast.error('Name and text are required.');
    try {
      if (qrEditing) {
        await api.updateQuickReply(qrEditing._id, {
          name: qrName.trim(),
          category: qrCategory,
          messageText: qrText.trim(),
          description: qrDescription.trim(),
        });
        toast.success('Quick reply updated.');
      } else {
        await api.createQuickReply({
          name: qrName.trim(),
          category: qrCategory,
          messageText: qrText.trim(),
          description: qrDescription.trim(),
        });
        toast.success('Quick reply created.');
      }
      setQuickReplyModalOpen(false);
      setQrEditing(null);
      setQrName('');
      setQrText('');
      setQrDescription('');
      loadQuickReplies();
    } catch (e) {
      toast.error(err(e));
    }
  };

  // Auto-Reply Rule CRUD
  const saveRule = async () => {
    if (!ruleName.trim() || !ruleKeyword.trim()) return toast.error('Rule name and keyword are required.');
    const synonymsArr = ruleSynonyms.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
    try {
      if (ruleEditing) {
        await api.updateAutoReplyRule(ruleEditing._id, {
          name: ruleName.trim(),
          triggerKeyword: ruleKeyword.trim().toUpperCase(),
          synonyms: synonymsArr,
          matchType: ruleMatchType,
          actionType: ruleActionType,
          responseMessage: ruleResponse.trim(),
          priority: Number(rulePriority) || 10,
        });
        toast.success('Rule updated.');
      } else {
        await api.createAutoReplyRule({
          name: ruleName.trim(),
          triggerKeyword: ruleKeyword.trim().toUpperCase(),
          synonyms: synonymsArr,
          matchType: ruleMatchType,
          actionType: ruleActionType,
          responseMessage: ruleResponse.trim(),
          priority: Number(rulePriority) || 10,
        });
        toast.success('Rule created.');
      }
      setRuleModalOpen(false);
      setRuleEditing(null);
      setRuleName('');
      setRuleKeyword('');
      setRuleSynonyms('');
      setRuleResponse('');
      loadRules();
    } catch (e) {
      toast.error(err(e));
    }
  };

  // Test Match All Rules
  const handleTestMatchAll = async () => {
    if (!testQueryText.trim()) return;
    try {
      const { data } = await api.testMatchAllRules(testQueryText.trim());
      setTestMatchResult(data);
    } catch (e) {
      toast.error(err(e));
    }
  };

  return (
    <div className="inbox-page">
      {/* Page Header with Truthful Status */}
      <PageHeader
        eyebrow="YOUR WORKSPACE · INBOX"
        title="Inbox & Auto-reply"
        subtitle="Manage customer conversations, quick replies and message automation."
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span
              className="status-badge"
              style={{
                backgroundColor: 'var(--color-surface-subtle)',
                color: 'var(--color-text-secondary)',
                padding: '6px 12px',
                fontSize: '12px',
                border: '1px solid var(--color-border)',
              }}
            >
              <Radio size={13} color="var(--color-text-muted)" style={{ marginRight: '4px' }} />
              WhatsApp Disconnected (Mock Mode)
            </span>
            <button className="outline-btn small" onClick={() => loadList()} title="Refresh inbox">
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        }
      />

      {/* Main Navigation Tabs: Conversations | Auto-reply Rules | Quick Replies */}
      <div className="inbox-filter-tabs" style={{ marginBottom: '16px', borderRadius: '10px' }}>
        <button
          className={activeTab === 'conversations' ? 'active' : ''}
          onClick={() => setActiveTab('conversations')}
        >
          <MessageCircle size={14} style={{ display: 'inline', marginRight: '6px' }} />
          Conversations ({stats?.total || 0})
        </button>
        <button
          className={activeTab === 'rules' ? 'active' : ''}
          onClick={() => setActiveTab('rules')}
        >
          <Bot size={14} style={{ display: 'inline', marginRight: '6px' }} />
          Auto-reply Rules ({stats?.activeRules || rules.filter((r) => r.enabled).length || 4} Active)
        </button>
        <button
          className={activeTab === 'quickreplies' ? 'active' : ''}
          onClick={() => setActiveTab('quickreplies')}
        >
          <Zap size={14} style={{ display: 'inline', marginRight: '6px' }} />
          Quick Replies ({quickReplies.length || stats?.quickReplies || 5})
        </button>
      </div>

      {/* TAB 1: CONVERSATIONS (REBUILT 3-PANEL WORKSPACE) */}
      {activeTab === 'conversations' && (
        <div className={`inbox-workspace ${!showContact ? 'hide-contact' : ''}`}>
          {/* LEFT PANEL: Conversation List (310px) */}
          <div className="inbox-list-panel">
            <div className="inbox-list-heading">
              <div>
                <h2>Chats</h2>
                <small>{total} conversations</small>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <select
                  aria-label="Start conversation with contact"
                  value={newContact}
                  onChange={(e) => setNewContact(e.target.value)}
                  style={{
                    height: '30px',
                    borderRadius: '6px',
                    border: '1px solid var(--color-border)',
                    fontSize: '11.5px',
                    maxWidth: '130px',
                  }}
                >
                  <option value="">+ New Chat (Internal Simulator)…</option>
                  {contacts.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.fullName}
                    </option>
                  ))}
                </select>
                {newContact && (
                  <button className="primary-btn small" onClick={startConversation} style={{ height: '30px', padding: '0 8px' }}>
                    Open
                  </button>
                )}
              </div>
            </div>

            {/* Search Bar */}
            <div className="inbox-search">
              <Search size={14} />
              <input
                placeholder="Search conversations, names, phones…"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            {/* Quick Segment Tabs: All / Unread / Needs Attention */}
            <div className="inbox-filter-tabs">
              <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
                All
              </button>
              <button
                className={filter === 'unread' ? 'active' : ''}
                onClick={() => setFilter('unread')}
              >
                Unread {stats?.unread > 0 && `(${stats.unread})`}
              </button>
              <button
                className={filter === 'needs_attention' ? 'active' : ''}
                onClick={() => setFilter('needs_attention')}
              >
                Needs Attention {stats?.needsAttention > 0 && `(${stats.needsAttention})`}
              </button>
            </div>

            {/* More Filters Toggle */}
            <div className="inbox-more-filters-bar">
              <button
                className="text-link"
                style={{ fontSize: '11.5px' }}
                onClick={() => setMoreFiltersOpen((v) => !v)}
              >
                <Filter size={11} /> {moreFiltersOpen ? 'Hide Filters' : 'More Filters'}
              </button>
              {(status !== 'all' || tagFilter) && (
                <button
                  className="text-link"
                  style={{ fontSize: '11.5px', color: 'var(--color-danger)' }}
                  onClick={() => {
                    setStatus('all');
                    setTagFilter('');
                  }}
                >
                  Reset
                </button>
              )}
            </div>

            {/* Advanced Filters Drawer */}
            {moreFiltersOpen && (
              <div
                style={{
                  padding: '10px 14px',
                  background: 'var(--color-surface-muted)',
                  borderBottom: '1px solid var(--color-border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  style={{
                    height: '28px',
                    borderRadius: '6px',
                    border: '1px solid var(--color-border)',
                    fontSize: '11.5px',
                    background: '#fff',
                  }}
                >
                  <option value="all">All Statuses</option>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <input
                  value={tagFilter}
                  onChange={(e) => setTagFilter(e.target.value)}
                  placeholder="Filter by tag (e.g. villa, plot)…"
                  style={{
                    height: '28px',
                    borderRadius: '6px',
                    border: '1px solid var(--color-border)',
                    fontSize: '11.5px',
                    padding: '0 8px',
                    background: '#fff',
                  }}
                />
              </div>
            )}

            {/* Conversation Rows */}
            <div className="inbox-conversation-list">
              {loading ? (
                <div style={{ padding: '24px', textAlign: 'center', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                  Loading conversations…
                </div>
              ) : records.length === 0 ? (
                <div style={{ padding: '36px 20px', textAlign: 'center' }}>
                  <MessageCircle size={24} color="var(--color-text-muted)" style={{ margin: '0 auto 8px' }} />
                  <strong style={{ fontSize: '13.5px', display: 'block' }}>No conversations found</strong>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    Pick a contact from the dropdown above to start a conversation record.
                  </span>
                </div>
              ) : (
                records.map((row) => {
                  const c = row.contactId || {};
                  const m = row.lastMessageId || {};
                  return (
                    <button
                      key={row._id}
                      className={`inbox-conversation-row ${selected === row._id ? 'selected' : ''}`}
                      onClick={() => openConversation(row._id)}
                    >
                      <div className="inbox-avatar">{initials(c.fullName)}</div>
                      <div className="inbox-row-copy">
                        <div className="inbox-row-top">
                          <b>{c.fullName || 'Lead'}</b>
                          <time>{when(row.lastActivityAt)}</time>
                        </div>
                        <div className="inbox-row-preview">
                          {m.messageBody || 'No messages logged yet'}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px', flexWrap: 'wrap' }}>
                          <span
                            className="status-badge"
                            style={{
                              fontSize: '10px',
                              padding: '1px 6px',
                              backgroundColor:
                                row.status === 'Needs Attention'
                                  ? '#fef3c7'
                                  : 'var(--color-surface-subtle)',
                              color:
                                row.status === 'Needs Attention'
                                  ? '#92400e'
                                  : 'var(--color-text-secondary)',
                            }}
                          >
                            {row.status}
                          </span>
                          {row.automationStatus === 'PAUSED' && (
                            <span
                              style={{
                                fontSize: '10px',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                background: '#fef3c7',
                                color: '#b45309',
                                fontWeight: 600,
                              }}
                            >
                              Takeover
                            </span>
                          )}
                          {row.source === 'test' && (
                            <span
                              style={{
                                fontSize: '10px',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                background: '#e0e7ff',
                                color: '#4338ca',
                                fontWeight: 600,
                              }}
                            >
                              TEST
                            </span>
                          )}
                          {row.internalUnreadCount > 0 && (
                            <span
                              style={{
                                marginLeft: 'auto',
                                background: 'var(--color-primary)',
                                color: '#fff',
                                fontSize: '10px',
                                fontWeight: 700,
                                padding: '1px 6px',
                                borderRadius: '9999px',
                              }}
                            >
                              {row.internalUnreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* CENTER PANEL: Active Conversation & Timeline */}
          {detail ? (
            <div className="inbox-chat-panel">
              {/* Header */}
              <div className="inbox-chat-header">
                <div className="inbox-avatar" style={{ width: '34px', height: '34px', fontSize: '13px' }}>
                  {initials(detail.contact.fullName)}
                </div>
                <div className="inbox-chat-title">
                  <b>{detail.contact.fullName}</b>
                  <span>
                    {detail.contact.phoneNumber} {detail.contact.location ? `· ${detail.contact.location}` : ''}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {/* Status Dropdown */}
                  <select
                    value={detail.conversation.status}
                    onChange={(e) => doStatus(e.target.value)}
                    style={{
                      height: '32px',
                      borderRadius: '6px',
                      border: '1px solid var(--color-border)',
                      fontSize: '12px',
                    }}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>

                  {/* Owner Takeover Button */}
                  <button
                    className="outline-btn small"
                    onClick={toggleTakeover}
                    title={
                      detail.conversation.automationStatus === 'PAUSED'
                        ? 'Click to Resume Auto-replies'
                        : 'Click to Take Over Manually & Pause Auto-replies'
                    }
                    style={{
                      backgroundColor:
                        detail.conversation.automationStatus === 'PAUSED' ? '#fef3c7' : '#fff',
                      color:
                        detail.conversation.automationStatus === 'PAUSED' ? '#92400e' : 'inherit',
                      borderColor:
                        detail.conversation.automationStatus === 'PAUSED' ? '#fde68a' : 'var(--color-border)',
                    }}
                  >
                    {detail.conversation.automationStatus === 'PAUSED' ? (
                      <>
                        <ShieldAlert size={14} color="#b45309" /> Manual Control
                      </>
                    ) : (
                      <>
                        <Bot size={14} color="var(--color-primary)" /> Auto-Reply Active
                      </>
                    )}
                  </button>

                  {/* Test Simulator Button */}
                  <button
                    className="outline-btn small"
                    title="Simulate Inbound Buyer WhatsApp Event (Test Keyword Engine)"
                    onClick={() => setSimulatorOpen(true)}
                  >
                    <Sparkles size={14} color="var(--color-primary)" /> Simulate Inbound
                  </button>

                  {/* Log Call */}
                  <button
                    className="icon-btn"
                    title="Log Outside Call or In-Person Interaction"
                    aria-label="Log Outside Call or In-Person Interaction"
                    onClick={() => setManualOpen((v) => !v)}
                  >
                    <Plus size={15} />
                  </button>

                  {/* Toggle Right Contact Drawer */}
                  <button
                    className="icon-btn"
                    title={showContact ? 'Hide contact profile' : 'Show contact profile'}
                    aria-label={showContact ? 'Hide contact profile' : 'Show contact profile'}
                    onClick={() => setShowContact((v) => !v)}
                  >
                    {showContact ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
                  </button>
                </div>
              </div>

              {/* Informational Mode & Takeover Banners */}
              {detail.conversation.automationStatus === 'PAUSED' && (
                <div className="inbox-takeover-banner">
                  <span>
                    🛡️ <strong>Manual Control Active:</strong> Keyword auto-replies are paused for this conversation. You are in full manual control.
                  </span>
                  <button className="text-link" onClick={toggleTakeover} style={{ fontSize: '11.5px', color: '#92400e' }}>
                    Resume Automation →
                  </button>
                </div>
              )}

              <div
                style={{
                  padding: '6px 16px',
                  background: 'var(--color-surface-muted)',
                  borderBottom: '1px solid var(--color-border-subtle)',
                  fontSize: '11px',
                  color: 'var(--color-text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>
                  WhatsApp Cloud API Disconnected · Internal CRM simulation mode
                </span>
                <span>Audit Logged · Zero Meta Dispatch</span>
              </div>

              {/* Messages timeline */}
              <div className="inbox-message-scroll">
                {messages.length === 0 ? (
                  <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    <MessageCircle size={28} style={{ margin: '0 auto 8px' }} />
                    <strong style={{ display: 'block', fontSize: '14px', color: 'var(--color-text-primary)' }}>
                      No messages in this conversation record
                    </strong>
                    <span style={{ fontSize: '12.5px' }}>
                      Compose a draft below or click "Simulate Inbound" to test buyer keywords like BROCHURE, PRICE, or VISIT.
                    </span>
                  </div>
                ) : (
                  messages.map((m, i) => (
                    <div key={m._id} style={{ display: 'flex', flexDirection: 'column' }}>
                      {(i === 0 || dateLabel(messages[i - 1].occurredAt) !== dateLabel(m.occurredAt)) && (
                        <div
                          style={{
                            alignSelf: 'center',
                            padding: '3px 10px',
                            background: 'var(--color-surface)',
                            border: '1px solid var(--color-border)',
                            borderRadius: '9999px',
                            fontSize: '11px',
                            color: 'var(--color-text-muted)',
                            margin: '10px 0',
                          }}
                        >
                          {dateLabel(m.occurredAt)}
                        </div>
                      )}

                      {/* Internal Note vs Normal Message */}
                      {m.direction === 'internal' || m.messageSource === 'internal_note' ? (
                        <div className="inbox-note-bubble">
                          <StickyNote size={12} style={{ display: 'inline', marginRight: '4px' }} />
                          <strong>Internal Note:</strong> {m.messageBody}
                          <time style={{ display: 'block', fontSize: '10px', marginTop: '2px', opacity: 0.8 }}>
                            {when(m.occurredAt)}
                          </time>
                        </div>
                      ) : (
                        <div className={`inbox-message ${m.direction}`}>
                          {/* Campaign Traceability Chip */}
                          {(m.campaignName || m.campaignId) && (
                            <div className="inbox-campaign-chip">
                              <Zap size={10} /> Campaign: {m.campaignName || 'Broadcast (Mock)'}
                            </div>
                          )}

                          <div style={{ whiteSpace: 'pre-wrap' }}>{m.messageBody}</div>

                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '8px',
                              marginTop: '6px',
                              fontSize: '10px',
                              opacity: 0.85,
                            }}
                          >
                            <small>
                              {m.messageSource === 'synthetic_test'
                                ? 'Synthetic Test Event'
                                : m.messageSource === 'mock_simulation'
                                ? 'Mock WhatsApp Simulation'
                                : 'Manual CRM Entry'}
                            </small>
                            <time>{when(m.occurredAt)}</time>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Draft Composer & Tools */}
              <div className="inbox-compose">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                      Composer
                    </span>
                    <button
                      className="outline-btn small"
                      onClick={() => setQrPickerOpen(true)}
                      style={{ fontSize: '11px', height: '26px', padding: '0 8px' }}
                    >
                      <Zap size={12} color="var(--color-primary)" /> Quick Replies
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <select
                      value={templateId}
                      onChange={(e) => setTemplateId(e.target.value)}
                      style={{
                        height: '26px',
                        borderRadius: '6px',
                        border: '1px solid var(--color-border)',
                        fontSize: '11.5px',
                        maxWidth: '170px',
                      }}
                    >
                      <option value="">Insert template…</option>
                      {templates.map((t) => (
                        <option key={t._id} value={t._id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                    {templateId && (
                      <button className="outline-btn small" onClick={insertTemplate} style={{ height: '26px', padding: '0 8px' }}>
                        Insert
                      </button>
                    )}
                  </div>
                </div>

                <textarea
                  rows="3"
                  value={draft}
                  onChange={(e) => {
                    draftValue.current = e.target.value;
                    setDraft(e.target.value);
                  }}
                  maxLength={10000}
                  placeholder="Type a response or pick a quick reply (simulated mock send)…"
                />

                <div className="inbox-compose-footer">
                  <span style={{ fontSize: '11.5px', color: 'var(--color-text-muted)' }}>
                    {draft.length} characters · Draft & Mock Send Only
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button className="outline-btn small" onClick={copy} disabled={!draft}>
                      <Copy size={13} /> Copy
                    </button>
                    <button className="outline-btn small" onClick={save} disabled={saving}>
                      Save Draft
                    </button>
                    <button className="primary-btn small" onClick={sendMock} disabled={!draft.trim()} title="Send simulated mock reply (Meta WhatsApp API disconnected)">
                      <Send size={13} /> Send Mock Reply
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Empty selection state */
            <div
              className="inbox-chat-panel"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: 'var(--color-surface-muted)',
                  display: 'grid',
                  placeItems: 'center',
                  color: 'var(--color-text-muted)',
                  marginBottom: '12px',
                }}
              >
                <MessageCircle size={26} />
              </div>
              <strong style={{ fontSize: '16px', color: 'var(--color-text-primary)' }}>
                Select a conversation
              </strong>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', maxWidth: '320px', margin: '4px 0 0' }}>
                Choose a client from the left list to review property messages, draft quick replies, or simulate buyer events.
              </p>
            </div>
          )}

          {/* RIGHT PANEL: Collapsible Contact Profile */}
          {detail && showContact && (
            <aside className="inbox-contact-panel">
              <div className="inbox-contact-heading">
                <h3>Contact & Enquiry</h3>
                <Link to={`/contacts?contact=${detail.contact._id}`} className="text-link" style={{ fontSize: '12px' }}>
                  Full Profile →
                </Link>
              </div>

              {/* Profile Card */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  padding: '12px',
                  background: 'var(--color-surface-muted)',
                  borderRadius: '10px',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div>
                  <small style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block' }}>Name</small>
                  <strong style={{ fontSize: '13.5px' }}>{detail.contact.fullName}</strong>
                </div>
                <div>
                  <small style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block' }}>WhatsApp Number</small>
                  <span style={{ fontSize: '13px' }}>{detail.contact.phoneNumber}</span>
                </div>
                <div>
                  <small style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block' }}>City / Location</small>
                  <span style={{ fontSize: '13px' }}>{detail.contact.location || '—'}</span>
                </div>
                <div>
                  <small style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block' }}>Property Interest</small>
                  <span style={{ fontSize: '13px' }}>
                    {detail.contact.interestedService || detail.contact.businessCategory || 'General Inquiry'}
                  </span>
                </div>
                <div>
                  <small style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block' }}>Consent Status</small>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                    <span
                      className="status-badge"
                      style={{
                        fontSize: '10.5px',
                        backgroundColor:
                          detail.contact.whatsappConsentStatus === 'Opted In'
                            ? '#d1fae5'
                            : detail.contact.whatsappConsentStatus === 'Opted Out'
                            ? '#fee2e2'
                            : '#fef3c7',
                        color:
                          detail.contact.whatsappConsentStatus === 'Opted In'
                            ? '#065f46'
                            : detail.contact.whatsappConsentStatus === 'Opted Out'
                            ? '#991b1b'
                            : '#92400e',
                      }}
                    >
                      {detail.contact.whatsappConsentStatus || 'Unknown'}
                    </span>
                    {detail.contact.isSuppressed && (
                      <span style={{ fontSize: '10px', color: 'var(--color-danger)', fontWeight: 600 }}>
                        (Suppressed: {detail.contact.suppressionReason || 'DNC'})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Campaign History Traceability */}
              {detail.campaignHistory?.length > 0 && (
                <div>
                  <strong style={{ fontSize: '13px', display: 'block', marginBottom: '8px' }}>
                    Campaign History ({detail.campaignHistory.length})
                  </strong>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {detail.campaignHistory.map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '8px 10px',
                          background: '#fff',
                          border: '1px solid var(--color-border)',
                          borderRadius: '6px',
                          fontSize: '11.5px',
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>{item.campaign.name}</div>
                        <div style={{ color: 'var(--color-text-muted)', fontSize: '10.5px' }}>
                          Status: {item.job?.status || 'Scheduled'} · Mock Mode
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Follow-up tasks */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <strong style={{ fontSize: '13px' }}>Follow-ups ({tasks.length})</strong>
                  <button className="text-link" onClick={() => setShowFollowup((v) => !v)} style={{ fontSize: '11.5px' }}>
                    + New
                  </button>
                </div>
                {showFollowup && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      padding: '10px',
                      background: 'var(--color-surface-muted)',
                      borderRadius: '8px',
                      marginBottom: '10px',
                    }}
                  >
                    <input
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                      placeholder="e.g. Call back regarding pricing"
                      style={{ height: '30px', borderRadius: '6px', border: '1px solid var(--color-border)', fontSize: '12px', padding: '0 8px' }}
                    />
                    <input
                      type="datetime-local"
                      value={taskDue}
                      onChange={(e) => setTaskDue(e.target.value)}
                      style={{ height: '30px', borderRadius: '6px', border: '1px solid var(--color-border)', fontSize: '12px', padding: '0 8px' }}
                    />
                    <button className="primary-btn small" onClick={addTask} style={{ height: '30px' }}>
                      Schedule Task
                    </button>
                  </div>
                )}
                {tasks.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {tasks.map((t) => (
                      <div
                        key={t._id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 10px',
                          background: '#fff',
                          border: '1px solid var(--color-border)',
                          borderRadius: '6px',
                          fontSize: '12px',
                        }}
                      >
                        <div>
                          <b>{t.title}</b>
                          <div style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>{when(t.dueAt)}</div>
                        </div>
                        <span className="status-badge" style={{ fontSize: '10.5px' }}>
                          {t.status}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>No follow-ups scheduled</span>
                )}
              </div>

              {/* Internal Notes Section */}
              <div>
                <strong style={{ fontSize: '13px', display: 'block', marginBottom: '8px' }}>Internal Notes</strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <textarea
                    rows="2"
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Add a private note about buyer requirements…"
                    style={{ border: '1px solid var(--color-border)', borderRadius: '6px', padding: '8px', fontSize: '12px' }}
                  />
                  <button className="outline-btn small" onClick={addNote} disabled={!noteText.trim()} style={{ alignSelf: 'flex-start' }}>
                    <StickyNote size={13} /> Save note
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
                  {notes.map((n) => (
                    <div key={n._id} style={{ padding: '8px 10px', background: '#fff', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '12px' }}>
                      <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{n.content}</p>
                      <time style={{ fontSize: '10px', color: 'var(--color-text-muted)', display: 'block', marginTop: '4px' }}>
                        {when(n.createdAt)}
                      </time>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          )}
        </div>
      )}

      {/* TAB 2: AUTO-REPLY RULES */}
      {activeTab === 'rules' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Top Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Keyword Automation Rules</h2>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
                Deterministic keyword auto-replies for real estate buyer inquiries with STOP opt-out compliance.
              </p>
            </div>
            <button
              className="primary-btn small"
              onClick={() => {
                setRuleEditing(null);
                setRuleName('');
                setRuleKeyword('');
                setRuleSynonyms('');
                setRuleResponse('');
                setRulePriority(10);
                setRuleModalOpen(true);
              }}
            >
              <Plus size={14} /> Create Keyword Rule
            </button>
          </div>

          {/* Interactive Rule Match Tester */}
          <div className="inbox-simulator-box">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={16} color="var(--color-primary)" />
              <strong style={{ fontSize: '14px' }}>Interactive Rule Match Tester</strong>
            </div>
            <p style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)', margin: 0 }}>
              Test how the rule engine will evaluate incoming WhatsApp messages across your active rules.
            </p>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                value={testQueryText}
                onChange={(e) => setTestQueryText(e.target.value)}
                placeholder="Enter sample message text (e.g. 'Can you send the BROCHURE?' or 'STOP')…"
                style={{
                  flex: 1,
                  height: '36px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border)',
                  padding: '0 12px',
                  fontSize: '13px',
                }}
              />
              <button className="primary-btn small" onClick={handleTestMatchAll} style={{ height: '36px' }}>
                Test Match
              </button>
            </div>

            {testMatchResult && (
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: '8px',
                  backgroundColor: testMatchResult.matched ? '#f0fdf4' : '#fef2f2',
                  border: `1px solid ${testMatchResult.matched ? '#bbf7d0' : '#fecaca'}`,
                  fontSize: '12.5px',
                }}
              >
                {testMatchResult.matched ? (
                  <div>
                    <strong style={{ color: '#166534' }}>
                      ✓ Matched Rule: {testMatchResult.matchedRule?.name}
                    </strong>
                    <div style={{ marginTop: '4px', color: '#14532d' }}>
                      Trigger: <code>{testMatchResult.matchedRule?.matchedKeyword}</code> · Priority: {testMatchResult.matchedRule?.priority} · Action: <code>{testMatchResult.matchedRule?.actionType}</code>
                    </div>
                    {testMatchResult.matchedRule?.responseMessage && (
                      <div style={{ marginTop: '6px', fontStyle: 'italic', color: '#374151' }}>
                        "{testMatchResult.matchedRule?.responseMessage}"
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ color: '#991b1b' }}>
                    ✕ No keyword rule matched this message. Conversation will remain for manual review.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Rules Grid */}
          <div className="inbox-rule-grid">
            {rules.map((rule) => (
              <div key={rule._id} className={`inbox-rule-card ${!rule.enabled ? 'disabled' : ''}`}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ fontSize: '15px', color: 'var(--color-text-primary)' }}>
                      {rule.name}
                    </strong>
                    <span
                      className="status-badge"
                      style={{
                        fontSize: '10.5px',
                        backgroundColor: rule.priority === 1 ? '#fee2e2' : 'var(--color-surface-subtle)',
                        color: rule.priority === 1 ? '#991b1b' : 'var(--color-text-muted)',
                      }}
                    >
                      Priority {rule.priority}
                    </span>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={async (e) => {
                        if (e.target.checked) await api.activateAutoReplyRule(rule._id);
                        else await api.deactivateAutoReplyRule(rule._id);
                        loadRules();
                        toast.success(`${rule.name} ${e.target.checked ? 'activated' : 'deactivated'}`);
                      }}
                    />
                    {rule.enabled ? 'Active' : 'Disabled'}
                  </label>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Trigger Keyword:</span>
                  <code style={{ fontSize: '12px', padding: '2px 6px', background: 'var(--color-surface-muted)', borderRadius: '4px', fontWeight: 600 }}>
                    {rule.triggerKeyword}
                  </code>
                  {rule.synonyms?.map((s) => (
                    <code key={s} style={{ fontSize: '11px', padding: '2px 5px', background: 'var(--color-surface-subtle)', borderRadius: '4px' }}>
                      {s}
                    </code>
                  ))}
                </div>

                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                  Action: <strong>{rule.actionType}</strong> · Match: <strong>{rule.matchType}</strong>
                </div>

                {rule.responseMessage && (
                  <div
                    style={{
                      padding: '10px',
                      background: 'var(--color-surface-muted)',
                      borderRadius: '8px',
                      fontSize: '12px',
                      lineHeight: 1.45,
                      border: '1px solid var(--color-border-subtle)',
                    }}
                  >
                    "{rule.responseMessage}"
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: 'auto',
                    paddingTop: '8px',
                    borderTop: '1px solid var(--color-border-subtle)',
                    fontSize: '11px',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  <span>Executed {rule.executionCount || 0} times</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="icon-btn small"
                      onClick={() => {
                        setRuleEditing(rule);
                        setRuleName(rule.name);
                        setRuleKeyword(rule.triggerKeyword);
                        setRuleSynonyms(rule.synonyms?.join(', ') || '');
                        setRuleMatchType(rule.matchType);
                        setRuleActionType(rule.actionType);
                        setRuleResponse(rule.responseMessage || '');
                        setRulePriority(rule.priority);
                        setRuleModalOpen(true);
                      }}
                      title="Edit rule"
                    >
                      <Edit2 size={13} />
                    </button>
                    {rule.priority !== 1 && (
                      <button
                        className="icon-btn small"
                        onClick={async () => {
                          if (confirm(`Archive ${rule.name}?`)) {
                            await api.deleteAutoReplyRule(rule._id);
                            loadRules();
                            toast.success('Rule archived');
                          }
                        }}
                        title="Delete rule"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Recent Execution History Table */}
          {ruleHistory.length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '10px' }}>
                Recent Auto-reply Audit History
              </h3>
              <div style={{ border: '1px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden', background: '#fff' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-surface-muted)', borderBottom: '1px solid var(--color-border)' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Rule</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Trigger Keyword</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Action Taken</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Mode</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Status</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ruleHistory.slice(0, 10).map((h) => (
                      <tr key={h._id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>{h.ruleName || 'Auto Rule'}</td>
                        <td style={{ padding: '8px 12px' }}><code>{h.matchedKeyword || '—'}</code></td>
                        <td style={{ padding: '8px 12px' }}>{h.actionType}</td>
                        <td style={{ padding: '8px 12px' }}>{h.executionMode}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span className="status-badge" style={{ fontSize: '10px' }}>{h.status}</span>
                        </td>
                        <td style={{ padding: '8px 12px', color: 'var(--color-text-muted)' }}>{when(h.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: QUICK REPLIES */}
      {activeTab === 'quickreplies' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Top Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Quick Reply Library</h2>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
                Reusable text snippets for property inquiries with live CRM token interpolation.
              </p>
            </div>
            <button
              className="primary-btn small"
              onClick={() => {
                setQrEditing(null);
                setQrName('');
                setQrCategory('General');
                setQrText('');
                setQrDescription('');
                setQuickReplyModalOpen(true);
              }}
            >
              <Plus size={14} /> New Quick Reply
            </button>
          </div>

          {/* Filters & Search */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="inbox-search" style={{ width: '280px', padding: '0', border: 'none' }}>
              <Search size={14} />
              <input
                placeholder="Search quick replies…"
                value={quickReplySearch}
                onChange={(e) => setQuickReplySearch(e.target.value)}
              />
            </div>
            <div className="inbox-filter-tabs" style={{ borderRadius: '8px', border: '1px solid var(--color-border)' }}>
              {['all', 'Brochure', 'Pricing', 'Site Visit', 'Location', 'General'].map((cat) => (
                <button
                  key={cat}
                  className={quickReplyCategory === cat ? 'active' : ''}
                  onClick={() => setQuickReplyCategory(cat)}
                >
                  {cat === 'all' ? 'All' : cat}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Replies Cards Grid */}
          <div className="inbox-quick-reply-grid">
            {quickReplies.map((qr) => (
              <div key={qr._id} className="inbox-quick-reply-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <strong style={{ fontSize: '14.5px', color: 'var(--color-text-primary)' }}>
                    {qr.name}
                  </strong>
                  <span className="status-badge" style={{ fontSize: '10.5px' }}>
                    {qr.category}
                  </span>
                </div>

                {qr.description && (
                  <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: 0 }}>
                    {qr.description}
                  </p>
                )}

                <div
                  style={{
                    padding: '10px 12px',
                    background: 'var(--color-surface-muted)',
                    borderRadius: '8px',
                    fontSize: '12.5px',
                    lineHeight: 1.45,
                    border: '1px solid var(--color-border-subtle)',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {qr.messageText}
                </div>

                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {(qr.supportedVariables || ['name', 'project', 'city']).map((v) => (
                    <span
                      key={v}
                      style={{
                        fontSize: '10.5px',
                        padding: '1px 6px',
                        background: 'var(--color-surface-subtle)',
                        borderRadius: '4px',
                        color: 'var(--color-text-muted)',
                      }}
                    >
                      {`{{${v}}}`}
                    </span>
                  ))}
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: 'auto',
                    paddingTop: '8px',
                    borderTop: '1px solid var(--color-border-subtle)',
                  }}
                >
                  <button
                    className="outline-btn small"
                    onClick={() => {
                      if (selected) {
                        insertQuickReply(qr);
                        setActiveTab('conversations');
                      } else {
                        toast('Select a conversation first to insert.');
                        setActiveTab('conversations');
                      }
                    }}
                    style={{ fontSize: '11.5px' }}
                  >
                    Insert in Chat
                  </button>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      className="icon-btn small"
                      onClick={async () => {
                        await api.duplicateQuickReply(qr._id);
                        loadQuickReplies();
                        toast.success('Quick reply duplicated');
                      }}
                      title="Duplicate"
                    >
                      <Copy size={13} />
                    </button>
                    <button
                      className="icon-btn small"
                      onClick={() => {
                        setQrEditing(qr);
                        setQrName(qr.name);
                        setQrCategory(qr.category);
                        setQrText(qr.messageText);
                        setQrDescription(qr.description || '');
                        setQuickReplyModalOpen(true);
                      }}
                      title="Edit"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      className="icon-btn small"
                      onClick={async () => {
                        if (confirm(`Delete "${qr.name}"?`)) {
                          await api.deleteQuickReply(qr._id);
                          loadQuickReplies();
                          toast.success('Quick reply removed');
                        }
                      }}
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* QUICK REPLY PICKER POPOVER / MODAL */}
      {qrPickerOpen && (
        <div className="modal-scrim" onClick={() => setQrPickerOpen(false)}>
          <div className="contact-modal" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="contact-modal-head">
              <h2>Select Quick Reply</h2>
              <button className="icon-btn modal-close" onClick={() => setQrPickerOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '420px', overflowY: 'auto' }}>
              {quickReplies.map((qr) => (
                <button
                  key={qr._id}
                  onClick={() => insertQuickReply(qr)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    padding: '10px 12px',
                    background: '#fff',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <b style={{ fontSize: '13px' }}>{qr.name}</b>
                    <span className="status-badge" style={{ fontSize: '10px' }}>{qr.category}</span>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                    {qr.messageText}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SYNTHETIC INBOUND TEST SIMULATOR MODAL */}
      {simulatorOpen && (
        <div className="modal-scrim" onClick={() => setSimulatorOpen(false)}>
          <div className="contact-modal" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="contact-modal-head">
              <h2>Simulate Inbound Buyer Message</h2>
              <button className="icon-btn modal-close" onClick={() => setSimulatorOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: 1.45 }}>
                Simulate a real WhatsApp inbound customer event from <strong>{detail?.contact.fullName}</strong> to test rule execution, auto-replies, and opt-out processing in <code>MOCK</code> mode.
              </div>

              {/* Sample Preset Buttons */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  className="outline-btn small"
                  style={{ fontSize: '11px', padding: '3px 8px' }}
                  onClick={() => setTestInboundText('Can you send me the BROCHURE?')}
                >
                  BROCHURE
                </button>
                <button
                  className="outline-btn small"
                  style={{ fontSize: '11px', padding: '3px 8px' }}
                  onClick={() => setTestInboundText('What is the unit PRICE?')}
                >
                  PRICE
                </button>
                <button
                  className="outline-btn small"
                  style={{ fontSize: '11px', padding: '3px 8px' }}
                  onClick={() => setTestInboundText('I want to schedule a site VISIT this Saturday')}
                >
                  VISIT
                </button>
                <button
                  className="outline-btn small"
                  style={{ fontSize: '11px', padding: '3px 8px', color: 'var(--color-danger)' }}
                  onClick={() => setTestInboundText('STOP')}
                >
                  STOP (Opt-out)
                </button>
              </div>

              <label className="field">
                Inbound Message Text
                <textarea
                  rows="3"
                  value={testInboundText}
                  onChange={(e) => setTestInboundText(e.target.value)}
                  placeholder="e.g. Can you share the latest price list?"
                />
              </label>

              <button className="primary-btn small" onClick={simulateInbound} style={{ marginTop: '8px' }}>
                Simulate Event & Run Engine
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK REPLY MODAL (CREATE / EDIT) */}
      {quickReplyModalOpen && (
        <div className="modal-scrim" onClick={() => setQuickReplyModalOpen(false)}>
          <div className="contact-modal" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="contact-modal-head">
              <h2>{qrEditing ? 'Edit Quick Reply' : 'New Quick Reply'}</h2>
              <button className="icon-btn modal-close" onClick={() => setQuickReplyModalOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label className="field">
                Title / Name
                <input value={qrName} onChange={(e) => setQrName(e.target.value)} placeholder="e.g. Brochure & Master Plan" />
              </label>
              <label className="field">
                Category
                <select value={qrCategory} onChange={(e) => setQrCategory(e.target.value)}>
                  <option>Brochure</option>
                  <option>Pricing</option>
                  <option>Site Visit</option>
                  <option>Location</option>
                  <option>General</option>
                  <option>Follow-up</option>
                </select>
              </label>
              <label className="field">
                Message Content (Supports {'{{first_name}}'}, {'{{project}}'}, {'{{city}}'})
                <textarea
                  rows="4"
                  value={qrText}
                  onChange={(e) => setQrText(e.target.value)}
                  placeholder="Hi {{first_name}}, here are the details for {{project}}…"
                />
              </label>
              <label className="field">
                Internal Description (Optional)
                <input value={qrDescription} onChange={(e) => setQrDescription(e.target.value)} placeholder="Usage notes for operator" />
              </label>
              <button className="primary-btn small" onClick={saveQuickReply} style={{ marginTop: '8px' }}>
                Save Quick Reply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AUTO-REPLY RULE MODAL (CREATE / EDIT) */}
      {ruleModalOpen && (
        <div className="modal-scrim" onClick={() => setRuleModalOpen(false)}>
          <div className="contact-modal" style={{ maxWidth: '460px' }} onClick={(e) => e.stopPropagation()}>
            <div className="contact-modal-head">
              <h2>{ruleEditing ? 'Edit Keyword Rule' : 'New Keyword Rule'}</h2>
              <button className="icon-btn modal-close" onClick={() => setRuleModalOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label className="field">
                Rule Name
                <input value={ruleName} onChange={(e) => setRuleName(e.target.value)} placeholder="e.g. Pricing Inquiry" />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <label className="field">
                  Trigger Keyword
                  <input value={ruleKeyword} onChange={(e) => setRuleKeyword(e.target.value)} placeholder="e.g. PRICE" />
                </label>
                <label className="field">
                  Match Type
                  <select value={ruleMatchType} onChange={(e) => setRuleMatchType(e.target.value)}>
                    <option value="WHOLE_WORD">Whole Word</option>
                    <option value="EXACT_MATCH">Exact Match</option>
                    <option value="CONTAINS">Contains</option>
                  </select>
                </label>
              </div>
              <label className="field">
                Synonyms / Alternate Keywords (Comma separated)
                <input value={ruleSynonyms} onChange={(e) => setRuleSynonyms(e.target.value)} placeholder="PRICING, COST, RATE, QUOTE" />
              </label>
              <label className="field">
                Action Type
                <select value={ruleActionType} onChange={(e) => setRuleActionType(e.target.value)}>
                  <option value="RUN_MOCK_REPLY">Send Mock Reply</option>
                  <option value="MARK_NEEDS_ATTENTION">Mark Needs Attention</option>
                  <option value="CREATE_INTERNAL_NOTE">Create Internal Note</option>
                  <option value="RECORD_OPT_OUT">Record Opt-out (STOP)</option>
                  <option value="PAUSE_AUTOMATION">Pause Automation</option>
                </select>
              </label>
              <label className="field">
                Auto-Response Message
                <textarea
                  rows="3"
                  value={ruleResponse}
                  onChange={(e) => setRuleResponse(e.target.value)}
                  placeholder="Response message sent back to client…"
                />
              </label>
              <label className="field">
                Priority (Lower = Higher Evaluation Precedence)
                <input type="number" min="1" max="100" value={rulePriority} onChange={(e) => setRulePriority(e.target.value)} />
              </label>
              <button className="primary-btn small" onClick={saveRule} style={{ marginTop: '8px' }}>
                Save Keyword Rule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LOG OUTSIDE INTERACTION MODAL */}
      {manualOpen && detail && (
        <div className="modal-scrim" onClick={() => setManualOpen(false)}>
          <div className="contact-modal" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="contact-modal-head">
              <h2>Log Outside Interaction</h2>
              <button className="icon-btn modal-close" onClick={() => setManualOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label className="field">
                Interaction Type
                <select value={manualType} onChange={(e) => setManualType(e.target.value)}>
                  <option>Phone Call</option>
                  <option>In-Person Meeting</option>
                  <option>Site Visit</option>
                  <option>Email</option>
                  <option>WhatsApp Call</option>
                  <option>Other</option>
                </select>
              </label>
              <label className="field">
                Direction
                <select value={manualDirection} onChange={(e) => setManualDirection(e.target.value)}>
                  <option value="outbound">Outbound (We contacted client)</option>
                  <option value="inbound">Inbound (Client contacted us)</option>
                </select>
              </label>
              <label className="field">
                Notes / Summary
                <textarea
                  rows="3"
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  placeholder="Discussed unit 402, pricing and payment milestones…"
                />
              </label>
              <button className="primary-btn small" onClick={logCommunication} style={{ marginTop: '8px' }}>
                Save in CRM History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function FollowUpsPage() {
  const [records, setRecords] = useState([]);
  const [status, setStatus] = useState('Pending');
  const [search, setSearch] = useState('');

  const load = () =>
    api
      .listFollowups({ status: status === 'all' ? undefined : status, limit: 100 })
      .then(({ data }) => setRecords(data.records || []))
      .catch((e) => toast.error(err(e)));

  useEffect(() => {
    load();
  }, [status]);

  const filtered = records.filter(
    (t) => !search || (t.title && t.title.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="followups-page">
      <PageHeader
        eyebrow="YOUR WORKSPACE · TASKS"
        title="Follow-ups"
        subtitle="Manage scheduled touchpoints and task reminders for property clients."
      />
      <div className="stat-grid" style={{ marginBottom: '20px' }}>
        <div className="stat-card">
          <div className="stat-head">
            <span>Pending Follow-ups</span>
            <Clock3 size={15} color="var(--color-warning)" />
          </div>
          <div className="stat-value">{records.filter((t) => t.status === 'Pending').length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-head">
            <span>In Progress</span>
            <Clock3 size={15} color="var(--color-info)" />
          </div>
          <div className="stat-value">{records.filter((t) => t.status === 'In Progress').length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-head">
            <span>Completed</span>
            <Check size={15} color="var(--color-success)" />
          </div>
          <div className="stat-value">{records.filter((t) => t.status === 'Completed').length}</div>
        </div>
      </div>

      <section className="panel">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 16px',
            borderBottom: '1px solid var(--color-border-subtle)',
          }}
        >
          <Search size={14} color="var(--color-text-muted)" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search follow-ups…"
            style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '13px' }}
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={{ height: '32px', borderRadius: '6px', border: '1px solid var(--color-border)', fontSize: '12px' }}
          >
            <option value="Pending">Pending</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
            <option value="all">All Statuses</option>
          </select>
        </div>

        <div style={{ padding: '8px 16px' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              No follow-up tasks in this view.
            </div>
          ) : (
            filtered.map((t) => (
              <div
                key={t._id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 0',
                  borderBottom: '1px solid var(--color-border-subtle)',
                }}
              >
                <div>
                  <strong style={{ fontSize: '13.5px', color: 'var(--color-text-primary)' }}>{t.title}</strong>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    Due: {when(t.dueAt)} · Priority: {t.priority}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="status-badge">{t.status}</span>
                  {t.status !== 'Completed' && (
                    <button
                      className="primary-btn small"
                      onClick={async () => {
                        await api.completeFollowup(t._id);
                        toast.success('Task completed.');
                        load();
                      }}
                    >
                      <Check size={13} /> Complete
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

export default InboxPage;