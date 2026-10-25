import { resolveContactVariables } from '../utils/crmVariables';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  ArrowUp,
  BarChart3,
  Bot,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Clock3,
  Copy,
  Edit2,
  ExternalLink,
  Filter,
  Flame,
  HelpCircle,
  Lock,
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
import { useWorkspace } from '../context/WorkspaceContext';
import * as api from '../services/inbox';
import '../inbox.css';

const STATUSES = ['Open', 'Needs Attention', 'Pending', 'Follow-up Required', 'Resolved', 'Closed', 'Archived'];

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

// Helper to extract actual variables used in a text template/reply
function extractUsedVariables(text) {
  if (!text) return [];
  const matches = text.match(/\{\{\s*([\w.]+)\s*\}\}/g);
  if (!matches) return [];
  const set = new Set(matches.map((m) => m.replace(/[{}]/g, '').trim()));
  return Array.from(set);
}

export function InboxPage() {
  const { user } = useAuth();
  const { currentWorkspace, industryConfig } = useWorkspace();
  const activeIndustry = industryConfig.industryKey;
  const qrCategories = industryConfig.ui.qrCategories;
  const qrPlaceholder = industryConfig.ui.quickReplyPlaceholder;
  const qrVariableHints = industryConfig.ui.variableHints;
  const LEADS = industryConfig.leadStatuses;

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
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState(() => searchParams.get('conversationId') || '');
  const [detail, setDetail] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [notes, setNotes] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [noteText, setNoteText] = useState('');
  const [templates, setTemplates] = useState([]);
  const [templateId, setTemplateId] = useState('');
  const [showContact, setShowContact] = useState(() => (typeof window !== 'undefined' ? window.innerWidth >= 1440 : true));
  useEffect(() => {
    const compact = window.matchMedia('(max-width: 1439px)');
    const collapse = () => { if (compact.matches) setShowContact(false); };
    compact.addEventListener('change', collapse);
    return () => compact.removeEventListener('change', collapse);
  }, []);
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
  const [quickReplyPresets, setQuickReplyPresets] = useState([]);
  const [rulePresets, setRulePresets] = useState([]);
  const [installingStarters, setInstallingStarters] = useState(false);
  const [quickReplyCategory, setQuickReplyCategory] = useState('all');
  const [quickReplySearch, setQuickReplySearch] = useState('');
  const [quickReplyModalOpen, setQuickReplyModalOpen] = useState(false);
  const [qrEditing, setQrEditing] = useState(null);
  const [qrName, setQrName] = useState('');
  const [qrCategory, setQrCategory] = useState('General');
  const [qrText, setQrText] = useState('');
  const [qrDescription, setQrDescription] = useState('');
  const [qrPickerOpen, setQrPickerOpen] = useState(false);
  const [expandedQr, setExpandedQr] = useState({});

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
  const [testQueryText, setTestQueryText] = useState('HELP');
  const [testMatchResult, setTestMatchResult] = useState(null);
  const [ruleHistory, setRuleHistory] = useState([]);

  const listRequest = useRef(0);
  const detailRequest = useRef(0);
  const didAutoSelect = useRef(false);
  const draftValue = useRef('');

  // Industry-specific contextual descriptions
  const industrySubtitle = industryConfig.ui.inboxSubtitle;

  // Load Conversations List
  const loadList = useCallback(async (isRefresh = false) => {
    const req = ++listRequest.current;
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
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
      setRecords(data.records || []);
      setTotal(data.total || 0);
      setStats(st.data.stats || null);
    } catch (e) {
      if (req === listRequest.current) toast.error(err(e));
    } finally {
      if (req === listRequest.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [page, q, status, filter, tagFilter]);

  // Open Conversation
  const openConversation = useCallback(async (id) => {
    if (!id) return;
    const req = ++detailRequest.current;
    didAutoSelect.current = true;
    setDetail(null);
    setMessages([]);
    setNotes([]);
    setTasks([]);
    setDraft('');
    draftValue.current = '';
    try {
      const [{ data: d }, { data: m }] = await Promise.all([
        api.inboxConversation(id),
        api.inboxMessages(id, { limit: 50 }),
      ]);
      if (req !== detailRequest.current) return;
      setDetail(d);
      setMessages(m.records || []);
      setNotes(d.notes || []);
      setTasks(d.tasks || []);
      setDraft(d.draft?.draftText || '');
      draftValue.current = d.draft?.draftText || '';
      if (d.conversation?.internalUnreadCount) await api.markReviewed(id);
      setRecords((prev) =>
        prev.map((c) => (c._id === id ? { ...c, internalUnreadCount: 0 } : c))
      );
    } catch (e) {
      if (req === detailRequest.current) {
        setSelected('');
        toast.error(err(e));
      }
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
      setQuickReplyPresets(data.presets || []);
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
      setRulePresets(rData.presets || []);
      setRuleHistory(hData.records || []);
    } catch (e) {
      toast.error('Failed to load auto-reply rules');
    }
  }, [currentWorkspace?._id]);


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
    return () => { detailRequest.current += 1; };
  }, [selected, openConversation]);

  // Auto-select first conversation if none selected on initial load
  useEffect(() => {
    if (!didAutoSelect.current && !selected && records.length > 0) {
      didAutoSelect.current = true;
      setSelected(records[0]._id);
    }
  }, [selected, records]);

  // Check if current selected contact is opted out or suppressed
  const isSuppressedRecipient = useMemo(() => {
    if (!detail?.contact) return false;
    const c = detail.contact;
    return c.whatsappConsentStatus === 'Opted Out' || c.isSuppressed === true;
  }, [detail]);

  // Template Insertion into Draft
  const selectedTemplate = templates.find((t) => t._id === templateId);
  const insertTemplate = async () => {
    if (!selectedTemplate) return;
    let full = selectedTemplate;
    try {
      const { data } = await getTemplate(selectedTemplate._id);
      full = data.template || data;
    } catch (e) {
      toast.error(err(e));
      return;
    }
    const text =
      full.selectedVersion?.snapshot?.body || full.currentVersion?.snapshot?.body || full.body || '';
    const c = detail?.contact || {};
    const rendered = resolveContactVariables(text, c, { ...currentWorkspace, senderName: user?.name });
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
    const rendered = resolveContactVariables(qr.messageText, c, { ...currentWorkspace, senderName: user?.name });
    setDraft((v) => {
      const next = v ? `${v}\n${rendered}` : rendered;
      draftValue.current = next;
      return next;
    });
    setQrPickerOpen(false);
    toast.success(`Inserted "${qr.name}" into composer.`);
  };

  // Start new conversation record
  const startConversation = async (contactIdToUse) => {
    const cid = contactIdToUse || newContact;
    if (!cid) return toast.error('Choose a contact first.');
    try {
      const { data } = await api.createConversation({ contactId: cid, source: 'manual' });
      setNewContact('');
      setSelected(data.conversation._id);
      await loadList();
      toast.success('Conversation record opened.');
    } catch (e) {
      toast.error(err(e));
    }
  };

  // Status Change
  const doStatus = async (next) => {
    if (!selected) return;
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

  // Send Mock Reply (MOCK simulation with strict suppression safeguards)
  const sendMock = async () => {
    if (!draft.trim()) return toast.error('Type a message to send mock reply.');
    if (isSuppressedRecipient) {
      return toast.error('Outbound sending blocked: Contact has opted out of WhatsApp messaging.');
    }
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

  // Test Match All Rules with Truthful Disabled-Rule Semantics
  const handleTestMatchAll = async () => {
    if (!testQueryText.trim()) return;
    try {
      const { data } = await api.testMatchAllRules(testQueryText.trim());
      // Check if matched rule is currently disabled in our active rules list
      if (data.matched && data.matchedRule) {
        const found = rules.find((r) => r._id === data.matchedRule._id || r.name === data.matchedRule.name);
        const isDisabled = found ? !found.enabled : data.matchedRule.enabled === false;
        setTestMatchResult({
          ...data,
          isRuleDisabled: isDisabled,
        });
      } else {
        setTestMatchResult(data);
      }
    } catch (e) {
      toast.error(err(e));
    }
  };

  // Summary counts for rules
  const activeRulesCount = useMemo(() => {
    return rules.filter((r) => r.enabled).length;
  }, [rules]);

  const disabledRulesCount = useMemo(() => {
    return rules.filter((r) => !r.enabled).length;
  }, [rules]);

  const totalExecutionsCount = useMemo(() => {
    return rules.reduce((acc, r) => acc + (r.executionCount || 0), 0);
  }, [rules]);

  return (
    <div className="inbox-page">
      {/* Page Header with Truthful Status */}
      <PageHeader
        eyebrow="YOUR WORKSPACE · INBOX"
        title="Inbox & Auto-reply"
        subtitle={industrySubtitle}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span
              className="status-badge"
              style={{
                backgroundColor: 'var(--ib-slate-100)',
                color: 'var(--ib-slate-600)',
                padding: '6px 14px',
                fontSize: '12px',
                borderRadius: '8px',
                border: '1px solid var(--ib-slate-200)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 500,
              }}
            >
              <Radio size={13} color="var(--ib-slate-500)" />
              WhatsApp Disconnected (Mock Mode)
            </span>
            <button
              className="outline-btn small"
              onClick={() => loadList(true)}
              title="Refresh inbox data"
              disabled={refreshing}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '34px', padding: '0 12px' }}
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        }
      />

      {/* Main Navigation Tabs: Conversations | Auto-reply Rules | Quick Replies */}
      <div className="inbox-main-tabs">
        <button
          className={`inbox-main-tab-btn ${activeTab === 'conversations' ? 'active' : ''}`}
          onClick={() => setActiveTab('conversations')}
        >
          <MessageCircle size={15} />
          <span>Conversations</span>
          <span className="inbox-main-tab-badge">{stats?.total || total || records.length}</span>
        </button>
        <button
          className={`inbox-main-tab-btn ${activeTab === 'rules' ? 'active' : ''}`}
          onClick={() => setActiveTab('rules')}
        >
          <Bot size={15} />
          <span>Auto-reply Rules</span>
          <span className="inbox-main-tab-badge">
            {stats?.activeRules || activeRulesCount || 1} Active
          </span>
        </button>
        <button
          className={`inbox-main-tab-btn ${activeTab === 'quickreplies' ? 'active' : ''}`}
          onClick={() => setActiveTab('quickreplies')}
        >
          <Zap size={15} />
          <span>Quick Replies</span>
          <span className="inbox-main-tab-badge">{quickReplies.length}</span>
        </button>
      </div>

      {/* TAB 1: CONVERSATIONS (REBUILT 3-PANEL ENTERPRISE WORKSPACE) */}
      {activeTab === 'conversations' && (
        <div className={`inbox-workspace ${!showContact ? 'hide-contact' : ''} ${selected ? 'has-selected' : ''}`}>
          {/* LEFT PANEL: Conversation Navigator */}
          <div className="inbox-list-panel">
            <div className="inbox-list-heading">
              <div>
                <h2>
                  <MessageSquare size={15} color="var(--ib-blue-600)" />
                  Conversations
                </h2>
                <small>{total || records.length} total client threads</small>
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <select
                  aria-label="Start conversation with contact"
                  value={newContact}
                  onChange={(e) => {
                    setNewContact(e.target.value);
                    if (e.target.value) {
                      startConversation(e.target.value);
                    }
                  }}
                  className="inbox-new-chat-select"
                  title="Pick a contact to open a CRM conversation record"
                >
                  <option value="">+ New Chat</option>
                  {contacts.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.fullName}
                    </option>
                  ))}
                </select>
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
              {q && (
                <button
                  className="icon-btn small"
                  onClick={() => setQ('')}
                  style={{ position: 'absolute', right: '18px' }}
                  title="Clear search"
                >
                  <X size={13} />
                </button>
              )}
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
                style={{ fontSize: '11.5px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                onClick={() => setMoreFiltersOpen((v) => !v)}
              >
                <Filter size={11} /> {moreFiltersOpen ? 'Hide Filters' : 'More Filters'}
              </button>
              {(status !== 'all' || tagFilter) && (
                <button
                  className="text-link"
                  style={{ fontSize: '11.5px', color: 'var(--ib-rose-600)' }}
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
                  background: 'var(--ib-slate-50)',
                  borderBottom: '1px solid var(--ib-slate-200)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  style={{
                    height: '30px',
                    borderRadius: '6px',
                    border: '1px solid var(--ib-slate-200)',
                    fontSize: '11.5px',
                    background: '#fff',
                    padding: '0 8px',
                    color: 'var(--ib-slate-700)',
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
                  placeholder="Filter by tag (e.g. plot, premium)…"
                  style={{
                    height: '30px',
                    borderRadius: '6px',
                    border: '1px solid var(--ib-slate-200)',
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
                <div style={{ padding: '32px 20px', textAlign: 'center', fontSize: '12.5px', color: 'var(--ib-slate-400)' }}>
                  <RefreshCw size={18} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                  Loading conversations…
                </div>
              ) : records.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                  <MessageCircle size={26} color="var(--ib-slate-400)" style={{ margin: '0 auto 10px' }} />
                  <strong style={{ fontSize: '14px', display: 'block', color: 'var(--ib-slate-800)' }}>
                    No conversations found
                  </strong>
                  <span style={{ fontSize: '12px', color: 'var(--ib-slate-500)', marginTop: '4px', display: 'block' }}>
                    Pick a contact from the dropdown above to start a conversation record.
                  </span>
                </div>
              ) : (
                records.map((row) => {
                  const c = row.contactId || {};
                  const m = row.lastMessageId || {};
                  const isSelected = selected === row._id;
                  const isOptedOut = c.whatsappConsentStatus === 'Opted Out' || c.isSuppressed;

                  return (
                    <button
                      key={row._id}
                      className={`inbox-conversation-row ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelected(row._id)}
                    >
                      <div className="inbox-avatar">{initials(c.fullName)}</div>
                      <div className="inbox-row-copy">
                        <div className="inbox-row-top">
                          <b>{c.fullName || 'Lead Contact'}</b>
                          <time>{when(row.lastActivityAt)}</time>
                        </div>
                        <div className="inbox-row-preview">
                          {m.messageBody || 'No messages logged yet'}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                          <span
                            className="status-badge"
                            style={{
                              fontSize: '10px',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              backgroundColor:
                                row.status === 'Needs Attention'
                                  ? 'var(--ib-amber-50)'
                                  : 'var(--ib-slate-100)',
                              color:
                                row.status === 'Needs Attention'
                                  ? 'var(--ib-amber-600)'
                                  : 'var(--ib-slate-600)',
                              border: `1px solid ${
                                row.status === 'Needs Attention'
                                  ? 'var(--ib-amber-border)'
                                  : 'var(--ib-slate-200)'
                              }`,
                            }}
                          >
                            {row.status}
                          </span>

                          {row.automationStatus === 'PAUSED' && (
                            <span
                              style={{
                                fontSize: '10px',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                background: 'var(--ib-amber-50)',
                                color: 'var(--ib-amber-600)',
                                border: '1px solid var(--ib-amber-border)',
                                fontWeight: 600,
                              }}
                            >
                              Takeover
                            </span>
                          )}

                          {isOptedOut && (
                            <span
                              style={{
                                fontSize: '10px',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                background: 'var(--ib-rose-50)',
                                color: 'var(--ib-rose-600)',
                                border: '1px solid var(--ib-rose-border)',
                                fontWeight: 600,
                              }}
                            >
                              Opted Out
                            </span>
                          )}

                          {row.source === 'test' && (
                            <span
                              style={{
                                fontSize: '10px',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                background: 'var(--ib-blue-50)',
                                color: 'var(--ib-blue-600)',
                                border: '1px solid var(--ib-blue-border)',
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
                                background: 'var(--ib-blue-600)',
                                color: '#fff',
                                fontSize: '10px',
                                fontWeight: 700,
                                padding: '1px 7px',
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
                {/* Row 1: Contact Identity (Left) & Core Status / Toggles (Right) */}
                <div className="inbox-header-row-1">
                  <div className="inbox-contact-identity">
                    <button
                      type="button"
                      className="icon-btn inbox-mobile-back-btn"
                      onClick={() => {
                        setSelected(null);
                        setDetail(null);
                      }}
                      aria-label="Back to conversations"
                      title="Back to conversations"
                    >
                      <ArrowLeft size={16} />
                    </button>
                    <div className="inbox-avatar inbox-header-avatar">
                      {initials(detail.contact.fullName)}
                    </div>
                    <div className="inbox-identity-info">
                      <div className="inbox-contact-name" title={detail.contact.fullName}>
                        {detail.contact.fullName}
                      </div>
                      <div className="inbox-contact-sub">
                        <span className="inbox-contact-phone">{detail.contact.phoneNumber}</span>
                        {(detail.contact.interestedService || detail.contact.location) && (
                          <span className="inbox-contact-dot">·</span>
                        )}
                        {detail.contact.interestedService && (
                          <span className="inbox-contact-interest" title={detail.contact.interestedService}>
                            {detail.contact.interestedService}
                          </span>
                        )}
                        {detail.contact.location && !detail.contact.interestedService && (
                          <span className="inbox-contact-location" title={detail.contact.location}>
                            {detail.contact.location}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="inbox-header-controls-primary">
                    {/* Status Dropdown */}
                    <div className="inbox-status-wrap">
                      <select
                        value={detail.conversation.status}
                        onChange={(e) => doStatus(e.target.value)}
                        className="inbox-status-select"
                        aria-label="Conversation status"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Owner Takeover Button */}
                    <button
                      className="outline-btn small inbox-automation-btn"
                      onClick={toggleTakeover}
                      title={
                        detail.conversation.automationStatus === 'PAUSED'
                          ? 'Click to Resume Auto-replies'
                          : 'Click to Take Over Manually & Pause Auto-replies'
                      }
                    >
                      {detail.conversation.automationStatus === 'PAUSED' ? (
                        <>
                          <ShieldAlert size={14} color="var(--ib-amber-600)" />
                          <span>Manual Control</span>
                        </>
                      ) : (
                        <>
                          <Bot size={14} color="var(--ib-blue-600)" />
                          <span>Auto-Reply Active</span>
                        </>
                      )}
                    </button>

                    {/* Toggle Right Contact Drawer */}
                    <button
                      className="icon-btn inbox-drawer-btn"
                      title={showContact ? 'Hide contact profile' : 'Show contact profile'}
                      aria-label={showContact ? 'Hide contact profile' : 'Show contact profile'}
                      onClick={() => setShowContact((v) => !v)}
                    >
                      {showContact ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
                    </button>
                  </div>
                </div>

                {/* Row 2: Contextual Actions Toolbar (Never Collides with Identity) */}
                <div className="inbox-header-row-2">
                  <div className="inbox-toolbar-left">
                    {/* Test Simulator Button */}
                    <button
                      className="outline-btn small inbox-simulate-btn"
                      title="Simulate Inbound Buyer WhatsApp Event (Test Keyword Engine)"
                      onClick={() => setSimulatorOpen(true)}
                    >
                      <Sparkles size={14} color="var(--ib-blue-600)" />
                      <span>Simulate Inbound</span>
                    </button>

                    {/* Log Call / Outside Interaction */}
                    <button
                      className="outline-btn small inbox-log-btn"
                      title="Log Outside Call or In-Person Interaction"
                      aria-label="Log Outside Call or In-Person Interaction"
                      onClick={() => setManualOpen((v) => !v)}
                    >
                      <Plus size={14} />
                      <span>Log Call</span>
                    </button>
                  </div>

                  <div className="inbox-toolbar-right">
                    {detail.contact.whatsappConsentStatus && (
                      <span
                        className="inbox-consent-pill"
                        title={`Recorded Consent: ${detail.contact.whatsappConsentStatus}`}
                      >
                        Consent: {detail.contact.whatsappConsentStatus}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Informational Mode & Takeover Banners */}
              {detail.conversation.automationStatus === 'PAUSED' && (
                <div className="inbox-takeover-banner">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <ShieldAlert size={15} />
                    <strong>Manual Control Active:</strong> Keyword auto-replies are paused for this conversation. You are in full manual control.
                  </span>
                  <button
                    className="text-link"
                    onClick={toggleTakeover}
                    style={{ fontSize: '12px', color: 'var(--ib-amber-600)', fontWeight: 600 }}
                  >
                    Resume Automation →
                  </button>
                </div>
              )}

              {/* Professional Spaced Mock Mode Information Banner */}
              <div className="inbox-provider-banner">
                <div className="inbox-banner-left">
                  <span className="inbox-mock-tag">
                    <Radio size={12} className="inbox-mock-pulse" /> Mock Mode
                  </span>
                  <span className="inbox-banner-text">
                    WhatsApp Cloud API Disconnected · Internal CRM simulation mode
                  </span>
                </div>
                <div className="inbox-banner-right">
                  <span className="inbox-banner-tag">Audit Logged</span>
                  <span className="inbox-banner-sep">·</span>
                  <span className="inbox-banner-tag">No External Dispatch</span>
                </div>
              </div>

              {/* Messages timeline */}
              <div className="inbox-message-scroll">
                {messages.length === 0 ? (
                  <div className="inbox-empty-timeline">
                    <div className="inbox-empty-icon-wrap">
                      <MessageSquare size={24} />
                    </div>
                    <strong className="inbox-empty-title">
                      No messages in this conversation yet.
                    </strong>
                    <p className="inbox-empty-desc">
                      Use <strong>Simulate Inbound</strong> to test an incoming enquiry or compose a simulated reply below.
                    </p>
                  </div>
                ) : (
                  messages.map((m, i) => (
                    <div key={m._id} style={{ display: 'flex', flexDirection: 'column' }}>
                      {(i === 0 || dateLabel(messages[i - 1].occurredAt) !== dateLabel(m.occurredAt)) && (
                        <div
                          style={{
                            alignSelf: 'center',
                            padding: '3px 12px',
                            background: '#FFFFFF',
                            border: '1px solid var(--ib-slate-200)',
                            borderRadius: '9999px',
                            fontSize: '11px',
                            fontWeight: 500,
                            color: 'var(--ib-slate-500)',
                            margin: '8px 0',
                            boxShadow: '0 1px 2px rgba(11,18,32,0.04)',
                          }}
                        >
                          {dateLabel(m.occurredAt)}
                        </div>
                      )}

                      {/* Internal Note vs Normal Message */}
                      {m.direction === 'internal' || m.messageSource === 'internal_note' ? (
                        <div className="inbox-note-bubble">
                          <StickyNote size={13} style={{ display: 'inline', marginRight: '5px' }} />
                          <strong>Internal Note:</strong> {m.messageBody}
                          <time style={{ display: 'block', fontSize: '10px', marginTop: '3px', opacity: 0.85 }}>
                            {when(m.occurredAt)}
                          </time>
                        </div>
                      ) : (
                        <div className={`inbox-message ${m.direction}`}>
                          {/* Campaign Traceability Chip */}
                          {(m.campaignName || m.campaignId) && (
                            <div className="inbox-campaign-chip">
                              <Zap size={11} /> Campaign: {m.campaignName || 'Broadcast (Mock)'}
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
                {/* Suppression Alert for Opted-out recipients */}
                {isSuppressedRecipient && (
                  <div className="inbox-suppression-alert">
                    <AlertTriangle size={18} color="var(--ib-rose-600)" style={{ flexShrink: 0, marginTop: '1px' }} />
                    <div>
                      <strong style={{ display: 'block', color: 'var(--ib-rose-700)', fontWeight: 600 }}>
                        Outbound Messaging Blocked
                      </strong>
                      <span>
                        Contact has opted out via WhatsApp STOP simulation ({detail.contact.suppressionReason || 'WhatsApp STOP simulation (demo)'}). Outbound simulated messages are strictly prohibited. CRM notes and unsent drafts remain available.
                      </span>
                    </div>
                  </div>
                )}

                <div className="inbox-compose-header">
                  <div className="inbox-compose-header-left">
                    <span className="inbox-compose-label">
                      Composer
                    </span>
                    <button
                      type="button"
                      className="outline-btn small"
                      onClick={() => setQrPickerOpen(true)}
                      style={{
                        fontSize: '11.5px',
                        height: '28px',
                        padding: '0 10px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        color: 'var(--ib-blue-600)',
                        borderColor: 'var(--ib-blue-border)',
                      }}
                    >
                      <Zap size={12} color="var(--ib-blue-600)" /> Quick Replies
                    </button>
                  </div>

                  <div className="inbox-compose-header-right">
                    <select
                      value={templateId}
                      onChange={(e) => setTemplateId(e.target.value)}
                      className="inbox-template-select"
                      aria-label="Insert template"
                    >
                      <option value="">Insert template…</option>
                      {templates.map((t) => (
                        <option key={t._id} value={t._id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                    {templateId && (
                      <button
                        type="button"
                        className="outline-btn small"
                        onClick={insertTemplate}
                        style={{ height: '28px', padding: '0 10px', color: 'var(--ib-blue-600)' }}
                      >
                        Insert
                      </button>
                    )}
                  </div>
                </div>

                <textarea
                  rows="3"
                  className="inbox-compose-textarea"
                  value={draft}
                  onChange={(e) => {
                    draftValue.current = e.target.value;
                    setDraft(e.target.value);
                  }}
                  maxLength={10000}
                  placeholder={
                    isSuppressedRecipient
                      ? "Contact is opted out. You may save an internal CRM draft, but outbound sending is blocked."
                      : "Type a response or pick a quick reply (simulated mock send)…"
                  }
                />

                <div className="inbox-compose-footer">
                  <span className="inbox-char-count">
                    {draft.length} characters · Draft & Mock Send Only
                  </span>
                  <div className="inbox-compose-actions">
                    <button type="button" className="outline-btn small" onClick={copy} disabled={!draft} style={{ height: '32px' }}>
                      <Copy size={13} /> Copy
                    </button>
                    <button type="button" className="outline-btn small" onClick={save} disabled={saving} style={{ height: '32px' }}>
                      Save Draft
                    </button>
                    <button
                      type="button"
                      className="primary-btn small"
                      onClick={sendMock}
                      disabled={!draft.trim() || isSuppressedRecipient}
                      title={
                        isSuppressedRecipient
                          ? 'Outbound sending blocked: Contact has opted out.'
                          : !draft.trim()
                          ? 'Type a message to send mock reply'
                          : 'Send simulated mock reply (WhatsApp API disconnected)'
                      }
                      style={{
                        height: '32px',
                        padding: '0 12px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
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
                  width: '56px',
                  height: '56px',
                  borderRadius: '14px',
                  background: 'var(--ib-blue-50)',
                  display: 'grid',
                  placeItems: 'center',
                  color: 'var(--ib-blue-600)',
                  marginBottom: '14px',
                  border: '1px solid var(--ib-blue-border)',
                }}
              >
                <MessageCircle size={28} />
              </div>
              <strong style={{ fontSize: '16px', color: 'var(--ib-slate-900)' }}>
                Select a conversation
              </strong>
              <p style={{ fontSize: '13px', color: 'var(--ib-slate-500)', maxWidth: '340px', margin: '6px 0 0', lineHeight: 1.45 }}>
                Choose a client from the left list to review customer messages, draft quick replies, or test mock automation.
              </p>
            </div>
          )}

          {/* RIGHT PANEL: Collapsible Contact Profile */}
          {detail && showContact && (
            <aside className="inbox-contact-panel">
              <div className="inbox-contact-heading">
                <h3>Contact & Enquiry</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Link
                    to={`/contacts?contact=${detail.contact._id}`}
                    className="text-link"
                    style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                  >
                    Full Profile <ExternalLink size={11} />
                  </Link>
                  <button
                    type="button"
                    className="icon-btn inbox-contact-close-btn"
                    onClick={() => setShowContact(false)}
                    aria-label="Close Contact Panel"
                    title="Close"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>

              {/* Profile Card */}
              <div className="inbox-contact-card">
                <div>
                  <small style={{ fontSize: '10.5px', color: 'var(--ib-slate-400)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Name</small>
                  <strong style={{ fontSize: '13.5px', color: 'var(--ib-slate-900)' }}>{detail.contact.fullName}</strong>
                </div>
                <div>
                  <small style={{ fontSize: '10.5px', color: 'var(--ib-slate-400)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>WhatsApp Number</small>
                  <span style={{ fontSize: '13px', color: 'var(--ib-slate-800)' }}>{detail.contact.phoneNumber}</span>
                </div>
                <div>
                  <small style={{ fontSize: '10.5px', color: 'var(--ib-slate-400)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>City / Location</small>
                  <span style={{ fontSize: '13px', color: 'var(--ib-slate-800)' }}>{detail.contact.location || '—'}</span>
                </div>
                <div>
                  <small style={{ fontSize: '10.5px', color: 'var(--ib-slate-400)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {industryConfig.terminology.interestFieldLabel}
                  </small>
                  <span style={{ fontSize: '13px', color: 'var(--ib-slate-800)' }}>
                    {detail.contact.productServiceInterest || detail.contact.industryData?.productServiceInterest || detail.contact.industryData?.serviceInterest || detail.contact.industryData?.serviceCategory || detail.contact.industryData?.foodInterest || detail.contact.industryData?.destination || detail.contact.interestedPropertyType || detail.contact.interestedService || detail.contact.industryData?.membershipInterest || detail.contact.industryData?.membershipPlan || detail.contact.industryData?.vehicleModel || detail.contact.businessCategory || 'Not recorded'}
                  </span>
                </div>
                {industryConfig.contactFields.filter(field => !['fullName', 'phoneNumber', 'email', 'city', 'leadSource', 'leadStatus', 'whatsappConsentStatus', 'notes'].includes(field.key)).map(field => {
                  const value = detail.contact.industryData?.[field.key] ?? detail.contact[field.key];
                  if (value === undefined || value === null || value === '') return null;
                  return <div key={field.key}>
                    <small style={{ fontSize: '10.5px', color: 'var(--ib-slate-400)', display: 'block' }}>{field.label}</small>
                    <span style={{ fontSize: '13px', color: 'var(--ib-slate-800)' }}>{Array.isArray(value) ? value.join(', ') : field.type === 'date' ? new Date(value).toLocaleDateString() : String(value)}</span>
                  </div>;
                })}
                <div>
                  <small style={{ fontSize: '10.5px', color: 'var(--ib-slate-400)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Consent Status</small>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px', flexWrap: 'wrap' }}>
                    <span
                      className="status-badge"
                      style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        backgroundColor:
                          detail.contact.whatsappConsentStatus === 'Opted In'
                            ? 'var(--ib-emerald-50)'
                            : detail.contact.whatsappConsentStatus === 'Opted Out'
                            ? 'var(--ib-rose-50)'
                            : 'var(--ib-amber-50)',
                        color:
                          detail.contact.whatsappConsentStatus === 'Opted In'
                            ? 'var(--ib-emerald-700)'
                            : detail.contact.whatsappConsentStatus === 'Opted Out'
                            ? 'var(--ib-rose-700)'
                            : 'var(--ib-amber-600)',
                        border: `1px solid ${
                          detail.contact.whatsappConsentStatus === 'Opted In'
                            ? 'var(--ib-emerald-border)'
                            : detail.contact.whatsappConsentStatus === 'Opted Out'
                            ? 'var(--ib-rose-border)'
                            : 'var(--ib-amber-border)'
                        }`,
                        fontWeight: 600,
                      }}
                    >
                      {detail.contact.whatsappConsentStatus || 'Unknown'}
                    </span>
                    {detail.contact.isSuppressed && (
                      <span style={{ fontSize: '11px', color: 'var(--ib-rose-600)', fontWeight: 600 }}>
                        (Suppressed: {detail.contact.suppressionReason || 'WhatsApp STOP simulation (demo)'})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Campaign History Traceability */}
              {detail.campaignHistory?.length > 0 && (
                <div>
                  <strong style={{ fontSize: '13px', display: 'block', marginBottom: '8px', color: 'var(--ib-slate-800)' }}>
                    Campaign History ({detail.campaignHistory.length})
                  </strong>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {detail.campaignHistory.map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '8px 12px',
                          background: '#fff',
                          border: '1px solid var(--ib-slate-200)',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                      >
                        <div style={{ fontWeight: 600, color: 'var(--ib-slate-900)' }}>{item.campaign.name}</div>
                        <div style={{ color: 'var(--ib-slate-500)', fontSize: '11px', marginTop: '2px' }}>
                          Status: <span style={{ fontWeight: 500 }}>{item.job?.status || 'Scheduled'}</span> · Mock Mode
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Follow-up tasks */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <strong style={{ fontSize: '13px', color: 'var(--ib-slate-800)' }}>Follow-ups ({tasks.length})</strong>
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
                      background: 'var(--ib-slate-50)',
                      borderRadius: '8px',
                      marginBottom: '10px',
                      border: '1px solid var(--ib-slate-200)',
                    }}
                  >
                    <input
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                      placeholder="e.g. Call back regarding pricing"
                      style={{ height: '30px', borderRadius: '6px', border: '1px solid var(--ib-slate-200)', fontSize: '12px', padding: '0 8px' }}
                    />
                    <input
                      type="datetime-local"
                      value={taskDue}
                      onChange={(e) => setTaskDue(e.target.value)}
                      style={{ height: '30px', borderRadius: '6px', border: '1px solid var(--ib-slate-200)', fontSize: '12px', padding: '0 8px' }}
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
                          border: '1px solid var(--ib-slate-200)',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                      >
                        <div>
                          <b style={{ color: 'var(--ib-slate-800)' }}>{t.title}</b>
                          <div style={{ color: 'var(--ib-slate-400)', fontSize: '10.5px' }}>{when(t.dueAt)}</div>
                        </div>
                        <span
                          className="status-badge"
                          style={{
                            fontSize: '10.5px',
                            backgroundColor: t.status === 'Completed' ? 'var(--ib-emerald-50)' : 'var(--ib-slate-100)',
                            color: t.status === 'Completed' ? 'var(--ib-emerald-700)' : 'var(--ib-slate-600)',
                          }}
                        >
                          {t.status}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span style={{ fontSize: '12px', color: 'var(--ib-slate-400)' }}>No follow-ups scheduled</span>
                )}
              </div>

              {/* Internal Notes Section */}
              <div>
                <strong style={{ fontSize: '13px', display: 'block', marginBottom: '8px', color: 'var(--ib-slate-800)' }}>
                  Internal Notes
                </strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <textarea
                    rows="2"
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Add a private note about client requirements…"
                    style={{
                      border: '1px solid var(--ib-slate-200)',
                      borderRadius: '6px',
                      padding: '8px',
                      fontSize: '12px',
                      color: 'var(--ib-slate-800)',
                      background: '#fff',
                    }}
                  />
                  <button
                    className="outline-btn small"
                    onClick={addNote}
                    disabled={!noteText.trim()}
                    style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    <StickyNote size={13} /> Save note
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
                  {notes.map((n) => (
                    <div
                      key={n._id}
                      style={{
                        padding: '8px 10px',
                        background: '#fff',
                        border: '1px solid var(--ib-slate-200)',
                        borderRadius: '6px',
                        fontSize: '12px',
                      }}
                    >
                      <p style={{ margin: 0, whiteSpace: 'pre-wrap', color: 'var(--ib-slate-700)' }}>{n.content}</p>
                      <time style={{ fontSize: '10px', color: 'var(--ib-slate-400)', display: 'block', marginTop: '4px' }}>
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
      {activeTab === 'rules' && rulePresets.length > 0 && (
        <details className="panel" style={{ padding: '16px', marginBottom: '14px' }}>
          <summary>Review industry starter rules ({rulePresets.length})</summary>
          <p>Definitions are unsaved. Existing saved content and enabled states are preserved.</p>
          {rulePresets.map(p => <p key={p.key || p.presetId}><strong>{p.title || p.displayName}</strong><br />{p.text || p.suggestedResponse}</p>)}
          <button className="outline-btn small" disabled={installingStarters} onClick={async () => {
            setInstallingStarters(true);
            try { await api.installStarterRules(); await loadRules(); toast.success('Starter rules saved disabled.'); }
            catch (e) { toast.error(err(e)); }
            finally { setInstallingStarters(false); }
          }}>Save missing starter rules</button>
        </details>
      )}
      {activeTab === 'rules' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Top Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--ib-slate-900)' }}>Keyword Automation Rules</h2>
              <p style={{ fontSize: '13px', color: 'var(--ib-slate-500)', margin: '2px 0 0' }}>
                Deterministic keyword auto-replies for client inquiries with STOP opt-out compliance.
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
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '34px', padding: '0 14px' }}
            >
              <Plus size={14} /> Create Keyword Rule
            </button>
          </div>

          {/* Rules Summary Strip */}
          <div className="inbox-rules-summary-strip">
            <div className="inbox-rules-summary-card">
              <span className="inbox-rules-summary-label">Total Rules</span>
              <span className="inbox-rules-summary-val">{rules.length}</span>
            </div>
            <div className="inbox-rules-summary-card">
              <span className="inbox-rules-summary-label">Active Rules</span>
              <span className="inbox-rules-summary-val" style={{ color: 'var(--ib-blue-600)' }}>
                {activeRulesCount}
              </span>
            </div>
            <div className="inbox-rules-summary-card">
              <span className="inbox-rules-summary-label">Disabled Rules</span>
              <span className="inbox-rules-summary-val" style={{ color: 'var(--ib-slate-400)' }}>
                {disabledRulesCount}
              </span>
            </div>
            <div className="inbox-rules-summary-card">
              <span className="inbox-rules-summary-label">Historical Executions</span>
              <span className="inbox-rules-summary-val">{totalExecutionsCount}</span>
            </div>
          </div>

          {/* Interactive Rule Match Tester */}
          <div className="inbox-simulator-box">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={16} color="var(--ib-blue-600)" />
                <strong style={{ fontSize: '14px', color: 'var(--ib-slate-900)' }}>Interactive Rule Match Tester</strong>
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: 'var(--ib-slate-400)', marginRight: '2px' }}>Test sample:</span>
                {rulePresets.slice(0, 3).map(p => (
                  <button key={p.presetId} className="inbox-tester-preset-btn" onClick={() => setTestQueryText(p.triggerKeywords[0])}>{p.triggerKeywords[0]}</button>
                ))}
                <button className="inbox-tester-preset-btn stop" onClick={() => setTestQueryText('STOP')}>
                  STOP (Opt-out)
                </button>
              </div>
            </div>

            <p style={{ fontSize: '12.5px', color: 'var(--ib-slate-500)', margin: 0 }}>
              Test how the rule engine will evaluate incoming customer messages against your rule set without sending live messages.
            </p>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                value={testQueryText}
                onChange={(e) => setTestQueryText(e.target.value)}
                placeholder="Enter a message or STOP…"
                style={{
                  flex: 1,
                  height: '38px',
                  borderRadius: '8px',
                  border: '1px solid var(--ib-slate-200)',
                  padding: '0 12px',
                  fontSize: '13px',
                  color: 'var(--ib-slate-900)',
                }}
              />
              <button
                className="primary-btn small"
                onClick={handleTestMatchAll}
                style={{ height: '38px', padding: '0 16px' }}
              >
                Test Match
              </button>
            </div>

            {testMatchResult && (
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: '10px',
                  backgroundColor: testMatchResult.isRuleDisabled
                    ? 'var(--ib-amber-50)'
                    : testMatchResult.matched
                    ? 'var(--ib-emerald-50)'
                    : 'var(--ib-rose-50)',
                  border: `1px solid ${
                    testMatchResult.isRuleDisabled
                      ? 'var(--ib-amber-border)'
                      : testMatchResult.matched
                      ? 'var(--ib-emerald-border)'
                      : 'var(--ib-rose-border)'
                  }`,
                  fontSize: '12.5px',
                  lineHeight: 1.5,
                }}
              >
                {testMatchResult.isRuleDisabled ? (
                  <div>
                    <strong style={{ color: 'var(--ib-amber-600)', display: 'block' }}>
                      ⚠️ Keyword matches rule "{testMatchResult.matchedRule?.name}", but this rule is currently DISABLED.
                    </strong>
                    <div style={{ marginTop: '4px', color: 'var(--ib-slate-700)' }}>
                      In live message processing, this rule will NOT execute. Inbound message would remain in the queue for manual operator review.
                    </div>
                  </div>
                ) : testMatchResult.matched ? (
                  <div>
                    <strong style={{ color: 'var(--ib-emerald-700)', display: 'block' }}>
                      ✓ Matched Active Rule: {testMatchResult.matchedRule?.name}
                    </strong>
                    <div style={{ marginTop: '4px', color: 'var(--ib-slate-700)' }}>
                      Trigger: <code className="inbox-keyword-chip">{testMatchResult.matchedRule?.matchedKeyword}</code> · Priority: {testMatchResult.matchedRule?.priority} · Action: <code>{testMatchResult.matchedRule?.actionType}</code>
                    </div>
                    {testMatchResult.matchedRule?.responseMessage && (
                      <div className="inbox-rule-response-preview" style={{ marginTop: '8px' }}>
                        "{testMatchResult.matchedRule?.responseMessage}"
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ color: 'var(--ib-rose-700)' }}>
                    ✕ No keyword rule matched this message. Inbound event would require manual operator review.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Rules Grid */}
          <div className="inbox-rule-grid">
            {rules.map((rule) => {
              const isProtectedStop = rule.isProtected || rule.actionType === 'RECORD_OPT_OUT';

              return (
                <div
                  key={rule._id}
                  className={`inbox-rule-card ${!rule.enabled ? 'disabled' : ''} ${
                    isProtectedStop ? 'protected-rule' : ''
                  }`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '15px', color: 'var(--ib-slate-900)' }}>
                        {rule.name}
                      </strong>
                      <span
                        className="status-badge"
                        style={{
                          fontSize: '10.5px',
                          backgroundColor: isProtectedStop ? 'var(--ib-amber-50)' : 'var(--ib-slate-100)',
                          color: isProtectedStop ? 'var(--ib-amber-600)' : 'var(--ib-slate-600)',
                          border: `1px solid ${isProtectedStop ? 'var(--ib-amber-border)' : 'var(--ib-slate-200)'}`,
                          fontWeight: 600,
                        }}
                      >
                        Priority {rule.priority}
                      </span>
                      {isProtectedStop && (
                        <span
                          style={{
                            fontSize: '10px',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: 'var(--ib-rose-50)',
                            color: 'var(--ib-rose-600)',
                            border: '1px solid var(--ib-rose-border)',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                          }}
                        >
                          <Lock size={10} /> Protected Compliance
                        </span>
                      )}
                    </div>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: isProtectedStop ? 'not-allowed' : 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={rule.enabled}
                        disabled={isProtectedStop}
                        onChange={async (e) => {
                          if (isProtectedStop) return;
                          if (e.target.checked) await api.activateAutoReplyRule(rule._id);
                          else await api.deactivateAutoReplyRule(rule._id);
                          loadRules();
                          toast.success(`${rule.name} ${e.target.checked ? 'activated' : 'deactivated'}`);
                        }}
                      />
                      <span style={{ fontWeight: 600, color: rule.enabled ? 'var(--ib-blue-600)' : 'var(--ib-slate-400)' }}>
                        {rule.enabled ? 'Active' : 'Disabled'}
                      </span>
                    </label>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11px', color: 'var(--ib-slate-400)' }}>Keywords:</span>
                    <span className="inbox-keyword-chip">
                      {rule.triggerKeyword}
                    </span>
                    {rule.synonyms?.map((s) => (
                      <span key={s} className="inbox-keyword-chip">
                        {s}
                      </span>
                    ))}
                  </div>

                  <div style={{ fontSize: '12px', color: 'var(--ib-slate-600)' }}>
                    Action: <strong>{rule.actionType}</strong> · Match: <strong>{rule.matchType}</strong>
                  </div>

                  {rule.responseMessage && (
                    <div className="inbox-rule-response-preview">
                      "{rule.responseMessage}"
                    </div>
                  )}

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: 'auto',
                      paddingTop: '10px',
                      borderTop: '1px solid var(--ib-slate-100)',
                      fontSize: '11.5px',
                      color: 'var(--ib-slate-500)',
                    }}
                  >
                    <span>Executed {rule.executionCount || 0} times</span>
                    <div style={{ display: 'flex', gap: '6px' }}>
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
                      {!isProtectedStop && (
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
              );
            })}
          </div>

          {/* Recent Execution History Table */}
          {ruleHistory.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '10px', color: 'var(--ib-slate-900)' }}>
                Recent Auto-reply Audit History
              </h3>
              <div style={{ border: '1px solid var(--ib-slate-200)', borderRadius: '10px', overflow: 'hidden', background: '#fff' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: 'var(--ib-slate-50)', borderBottom: '1px solid var(--ib-slate-200)' }}>
                      <th style={{ padding: '9px 14px', textAlign: 'left', color: 'var(--ib-slate-700)', fontWeight: 600 }}>Rule</th>
                      <th style={{ padding: '9px 14px', textAlign: 'left', color: 'var(--ib-slate-700)', fontWeight: 600 }}>Trigger Keyword</th>
                      <th style={{ padding: '9px 14px', textAlign: 'left', color: 'var(--ib-slate-700)', fontWeight: 600 }}>Action Taken</th>
                      <th style={{ padding: '9px 14px', textAlign: 'left', color: 'var(--ib-slate-700)', fontWeight: 600 }}>Mode</th>
                      <th style={{ padding: '9px 14px', textAlign: 'left', color: 'var(--ib-slate-700)', fontWeight: 600 }}>Status</th>
                      <th style={{ padding: '9px 14px', textAlign: 'left', color: 'var(--ib-slate-700)', fontWeight: 600 }}>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ruleHistory.slice(0, 10).map((h) => (
                      <tr key={h._id} style={{ borderBottom: '1px solid var(--ib-slate-100)' }}>
                        <td style={{ padding: '9px 14px', fontWeight: 600, color: 'var(--ib-slate-800)' }}>{h.ruleName || 'Auto Rule'}</td>
                        <td style={{ padding: '9px 14px' }}>
                          <code className="inbox-keyword-chip">{h.matchedKeyword || '—'}</code>
                        </td>
                        <td style={{ padding: '9px 14px', color: 'var(--ib-slate-700)' }}>{h.actionType}</td>
                        <td style={{ padding: '9px 14px', color: 'var(--ib-slate-600)' }}>{h.executionMode}</td>
                        <td style={{ padding: '9px 14px' }}>
                          <span
                            className="status-badge"
                            style={{
                              fontSize: '10.5px',
                              backgroundColor: h.status === 'SUCCESS' ? 'var(--ib-emerald-50)' : 'var(--ib-slate-100)',
                              color: h.status === 'SUCCESS' ? 'var(--ib-emerald-700)' : 'var(--ib-slate-600)',
                            }}
                          >
                            {h.status}
                          </span>
                        </td>
                        <td style={{ padding: '9px 14px', color: 'var(--ib-slate-400)' }}>{when(h.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'quickreplies' && quickReplyPresets.length > 0 && (
        <details className="panel" style={{ padding: '16px', marginBottom: '14px' }}>
          <summary>Review industry starter replies ({quickReplyPresets.length})</summary>
          <p>Definitions are unsaved. Existing saved content and enabled states are preserved.</p>
          {quickReplyPresets.map(p => <p key={p.key || p.presetId}><strong>{p.title || p.displayName}</strong><br />{p.text || p.suggestedResponse}</p>)}
          <button className="outline-btn small" disabled={installingStarters} onClick={async () => {
            setInstallingStarters(true);
            try { await api.installStarterQuickReplies(); await loadQuickReplies(); toast.success('Starter replies saved.'); }
            catch (e) { toast.error(err(e)); }
            finally { setInstallingStarters(false); }
          }}>Save missing starter replies</button>
        </details>
      )}
      {/* TAB 3: QUICK REPLIES */}
      {activeTab === 'quickreplies' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Top Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--ib-slate-900)' }}>Quick Reply Library</h2>
              <p style={{ fontSize: '13px', color: 'var(--ib-slate-500)', margin: '2px 0 0' }}>
                Save and reuse frequently sent responses with live variable token interpolation.
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
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '34px', padding: '0 14px' }}
            >
              <Plus size={14} /> New Quick Reply
            </button>
          </div>

          {/* Filters & Search Toolbar */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="inbox-search" style={{ width: '280px', padding: '0', border: 'none', background: 'transparent' }}>
              <Search size={14} />
              <input
                placeholder="Search quick replies…"
                value={quickReplySearch}
                onChange={(e) => setQuickReplySearch(e.target.value)}
              />
              {quickReplySearch && (
                <button
                  className="icon-btn small"
                  onClick={() => setQuickReplySearch('')}
                  style={{ position: 'absolute', right: '10px' }}
                  title="Clear search"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <div className="inbox-filter-tabs" style={{ borderRadius: '8px', border: '1px solid var(--ib-slate-200)', background: '#fff' }}>
              {qrCategories.map((cat) => (
                <button
                  key={cat}
                  className={quickReplyCategory === cat ? 'active' : ''}
                  onClick={() => setQuickReplyCategory(cat)}
                  style={{ padding: '5px 12px' }}
                >
                  {cat === 'all' ? 'All' : cat}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Replies Cards Grid */}
          <div className="inbox-quick-reply-grid">
            {quickReplies.map((qr) => {
              const usedVars = extractUsedVariables(qr.messageText);
              const isExpanded = !!expandedQr[qr._id];

              return (
                <div key={qr._id} className="inbox-quick-reply-card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <strong style={{ fontSize: '14.5px', color: 'var(--ib-slate-900)' }}>
                      {qr.name}
                    </strong>
                    <span
                      className="status-badge"
                      style={{
                        fontSize: '11px',
                        backgroundColor: 'var(--ib-blue-50)',
                        color: 'var(--ib-blue-600)',
                        border: '1px solid var(--ib-blue-border)',
                        fontWeight: 600,
                      }}
                    >
                      {qr.category}
                    </span>
                  </div>

                  {qr.description && (
                    <p style={{ fontSize: '12px', color: 'var(--ib-slate-500)', margin: 0 }}>
                      {qr.description}
                    </p>
                  )}

                  <div
                    className="inbox-qr-body-box"
                    style={{
                      maxHeight: isExpanded ? 'none' : '110px',
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                  >
                    {qr.messageText}
                  </div>

                  {qr.messageText?.length > 140 && (
                    <button
                      className="text-link"
                      onClick={() => setExpandedQr((prev) => ({ ...prev, [qr._id]: !prev[qr._id] }))}
                      style={{ fontSize: '11.5px', alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp size={12} /> Show less
                        </>
                      ) : (
                        <>
                          <ChevronDown size={12} /> Show full text
                        </>
                      )}
                    </button>
                  )}

                  {/* Variables Token Summary (Only display actual tokens used in body) */}
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {usedVars.length > 0 ? (
                      usedVars.map((v) => (
                        <span key={v} className="inbox-variable-chip">
                          {`{{${v}}}`}
                        </span>
                      ))
                    ) : (
                      <span style={{ fontSize: '11px', color: 'var(--ib-slate-400)', fontStyle: 'italic' }}>
                        Static reply (no variable tokens)
                      </span>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: 'auto',
                      paddingTop: '10px',
                      borderTop: '1px solid var(--ib-slate-100)',
                    }}
                  >
                    <button
                      className="outline-btn small electric"
                      onClick={() => {
                        insertQuickReply(qr);
                        setActiveTab('conversations');
                      }}
                      style={{ fontSize: '11.5px', height: '30px', padding: '0 12px' }}
                      title="Insert this quick reply into composer"
                    >
                      Insert in Chat
                    </button>
                    <div style={{ display: 'flex', gap: '4px' }}>
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
              );
            })}
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
                    gap: '5px',
                    padding: '10px 14px',
                    background: '#fff',
                    border: '1px solid var(--ib-slate-200)',
                    borderRadius: '8px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--ib-blue-600)')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--ib-slate-200)')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <b style={{ fontSize: '13px', color: 'var(--ib-slate-900)' }}>{qr.name}</b>
                    <span className="status-badge" style={{ fontSize: '10.5px' }}>{qr.category}</span>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--ib-slate-600)', lineHeight: 1.45 }}>
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
          <div className="contact-modal" style={{ maxWidth: '460px' }} onClick={(e) => e.stopPropagation()}>
            <div className="contact-modal-head">
              <h2>Simulate Inbound Buyer Message</h2>
              <button className="icon-btn modal-close" onClick={() => setSimulatorOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '12.5px', color: 'var(--ib-slate-600)', lineHeight: 1.45 }}>
                Simulate a real WhatsApp inbound customer event from <strong>{detail?.contact.fullName}</strong> to test rule execution, auto-replies, and opt-out processing in <code>MOCK</code> mode.
              </div>

              {/* Sample Preset Buttons */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  className="inbox-tester-preset-btn"
                  onClick={() => setTestInboundText('Can you send me the BROCHURE?')}
                >
                  BROCHURE
                </button>
                <button
                  className="inbox-tester-preset-btn"
                  onClick={() => setTestInboundText('What is the unit PRICE?')}
                >
                  PRICE
                </button>
                <button
                  className="inbox-tester-preset-btn"
                  onClick={() => setTestInboundText('I want to schedule a site VISIT this Saturday')}
                >
                  VISIT
                </button>
                <button
                  className="inbox-tester-preset-btn stop"
                  onClick={() => setTestInboundText('STOP')}
                >
                  STOP (Opt-out)
                </button>
              </div>

              <label className="field" style={{ margin: '4px 0 0' }}>
                Inbound Message Text
                <textarea
                  rows="3"
                  value={testInboundText}
                  onChange={(e) => setTestInboundText(e.target.value)}
                  placeholder="e.g. Can you share the latest price list?"
                  style={{
                    border: '1px solid var(--ib-slate-200)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    fontSize: '13px',
                    color: 'var(--ib-slate-900)',
                  }}
                />
              </label>

              <button className="primary-btn small" onClick={simulateInbound} style={{ marginTop: '8px', height: '36px' }}>
                Simulate Event & Run Engine
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK REPLY MODAL (CREATE / EDIT) */}
      {quickReplyModalOpen && (
        <div className="modal-scrim" onClick={() => setQuickReplyModalOpen(false)}>
          <div className="contact-modal" style={{ maxWidth: '460px' }} onClick={(e) => e.stopPropagation()}>
            <div className="contact-modal-head">
              <h2>{qrEditing ? 'Edit Quick Reply' : 'New Quick Reply'}</h2>
              <button className="icon-btn modal-close" onClick={() => setQuickReplyModalOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label className="field">
                Title / Name
                <input
                  value={qrName}
                  onChange={(e) => setQrName(e.target.value)}
                  placeholder={qrPlaceholder}
                  style={{ border: '1px solid var(--ib-slate-200)', borderRadius: '6px', padding: '7px 10px', fontSize: '13px' }}
                />
              </label>
              <label className="field">
                Category
                <select
                  value={qrCategory}
                  onChange={(e) => setQrCategory(e.target.value)}
                  style={{ border: '1px solid var(--ib-slate-200)', borderRadius: '6px', padding: '7px 10px', fontSize: '13px' }}
                >
                  {qrCategories.filter((c) => c !== 'all').map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                Message Content (Supports {qrVariableHints})
                <textarea
                  rows="4"
                  value={qrText}
                  onChange={(e) => setQrText(e.target.value)}
                  placeholder={`Hi {{customer_name}}, thank you for reaching out to {{business_name}}…`}
                  style={{ border: '1px solid var(--ib-slate-200)', borderRadius: '6px', padding: '8px 10px', fontSize: '13px' }}
                />
              </label>
              <label className="field">
                Internal Description (Optional)
                <input
                  value={qrDescription}
                  onChange={(e) => setQrDescription(e.target.value)}
                  placeholder="Usage notes for operator"
                  style={{ border: '1px solid var(--ib-slate-200)', borderRadius: '6px', padding: '7px 10px', fontSize: '13px' }}
                />
              </label>
              <button className="primary-btn small" onClick={saveQuickReply} style={{ marginTop: '8px', height: '36px' }}>
                Save Quick Reply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AUTO-REPLY RULE MODAL (CREATE / EDIT) */}
      {ruleModalOpen && (
        <div className="modal-scrim" onClick={() => setRuleModalOpen(false)}>
          <div className="contact-modal" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="contact-modal-head">
              <h2>{ruleEditing ? 'Edit Keyword Rule' : 'New Keyword Rule'}</h2>
              <button className="icon-btn modal-close" onClick={() => setRuleModalOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label className="field">
                Rule Name
                <input
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  placeholder="e.g. Pricing Inquiry"
                  style={{ border: '1px solid var(--ib-slate-200)', borderRadius: '6px', padding: '7px 10px', fontSize: '13px' }}
                />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <label className="field">
                  Trigger Keyword
                  <input
                    value={ruleKeyword}
                    onChange={(e) => setRuleKeyword(e.target.value)}
                    placeholder="e.g. PRICE"
                    style={{ border: '1px solid var(--ib-slate-200)', borderRadius: '6px', padding: '7px 10px', fontSize: '13px' }}
                  />
                </label>
                <label className="field">
                  Match Type
                  <select
                    value={ruleMatchType}
                    onChange={(e) => setRuleMatchType(e.target.value)}
                    style={{ border: '1px solid var(--ib-slate-200)', borderRadius: '6px', padding: '7px 10px', fontSize: '13px' }}
                  >
                    <option value="WHOLE_WORD">Whole Word</option>
                    <option value="EXACT_MATCH">Exact Match</option>
                    <option value="CONTAINS">Contains</option>
                  </select>
                </label>
              </div>
              <label className="field">
                Synonyms / Alternate Keywords (Comma separated)
                <input
                  value={ruleSynonyms}
                  onChange={(e) => setRuleSynonyms(e.target.value)}
                  placeholder="PRICING, COST, RATE, QUOTE"
                  style={{ border: '1px solid var(--ib-slate-200)', borderRadius: '6px', padding: '7px 10px', fontSize: '13px' }}
                />
              </label>
              <label className="field">
                Action Type
                <select
                  value={ruleActionType}
                  onChange={(e) => setRuleActionType(e.target.value)}
                  style={{ border: '1px solid var(--ib-slate-200)', borderRadius: '6px', padding: '7px 10px', fontSize: '13px' }}
                >
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
                  style={{ border: '1px solid var(--ib-slate-200)', borderRadius: '6px', padding: '8px 10px', fontSize: '13px' }}
                />
              </label>
              <label className="field">
                Priority (Lower = Higher Evaluation Precedence)
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={rulePriority}
                  onChange={(e) => setRulePriority(e.target.value)}
                  style={{ border: '1px solid var(--ib-slate-200)', borderRadius: '6px', padding: '7px 10px', fontSize: '13px' }}
                />
              </label>
              <button className="primary-btn small" onClick={saveRule} style={{ marginTop: '8px', height: '36px' }}>
                Save Keyword Rule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LOG OUTSIDE INTERACTION MODAL */}
      {manualOpen && detail && (
        <div className="modal-scrim" onClick={() => setManualOpen(false)}>
          <div className="contact-modal" style={{ maxWidth: '460px' }} onClick={(e) => e.stopPropagation()}>
            <div className="contact-modal-head">
              <h2>Log Outside Interaction</h2>
              <button className="icon-btn modal-close" onClick={() => setManualOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label className="field">
                Interaction Type
                <select
                  value={manualType}
                  onChange={(e) => setManualType(e.target.value)}
                  style={{ border: '1px solid var(--ib-slate-200)', borderRadius: '6px', padding: '7px 10px', fontSize: '13px' }}
                >
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
                <select
                  value={manualDirection}
                  onChange={(e) => setManualDirection(e.target.value)}
                  style={{ border: '1px solid var(--ib-slate-200)', borderRadius: '6px', padding: '7px 10px', fontSize: '13px' }}
                >
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
                  style={{ border: '1px solid var(--ib-slate-200)', borderRadius: '6px', padding: '8px 10px', fontSize: '13px' }}
                />
              </label>
              <button className="primary-btn small" onClick={logCommunication} style={{ marginTop: '8px', height: '36px' }}>
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
            <Clock3 size={15} color="var(--ib-amber-500)" />
          </div>
          <div className="stat-value">{records.filter((t) => t.status === 'Pending').length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-head">
            <span>In Progress</span>
            <Clock3 size={15} color="var(--ib-blue-500)" />
          </div>
          <div className="stat-value">{records.filter((t) => t.status === 'In Progress').length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-head">
            <span>Completed</span>
            <Check size={15} color="var(--ib-emerald-600)" />
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
            borderBottom: '1px solid var(--ib-slate-200)',
          }}
        >
          <Search size={14} color="var(--ib-slate-400)" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search follow-ups…"
            style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '13px' }}
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={{ height: '32px', borderRadius: '6px', border: '1px solid var(--ib-slate-200)', fontSize: '12px', padding: '0 8px' }}
          >
            <option value="Pending">Pending</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
            <option value="all">All Statuses</option>
          </select>
        </div>

        <div style={{ padding: '8px 16px' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--ib-slate-400)' }}>
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
                  borderBottom: '1px solid var(--ib-slate-100)',
                }}
              >
                <div>
                  <strong style={{ fontSize: '13.5px', color: 'var(--ib-slate-900)' }}>{t.title}</strong>
                  <div style={{ fontSize: '12px', color: 'var(--ib-slate-400)' }}>
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
