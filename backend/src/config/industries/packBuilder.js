/**
 * Small pure helpers that expand compact preset rows into the full field shape
 * used by every existing industry pack (templateSuggestions, quickReplyPresets,
 * automationPresets, sampleCampaignDrafts). No I/O, no database access.
 */

const FOOTER = 'Reply STOP to unsubscribe';
const VAR_RX = /\{\{\s*([a-z0-9_]+)\s*\}\}/g;

function varsIn(...texts) {
  const out = new Set();
  texts.filter(Boolean).forEach((t) => {
    for (const m of String(t).matchAll(VAR_RX)) out.add(m[1]);
  });
  return [...out];
}

export function buildTemplate(prefix, packVersion, index, row) {
  const [key, title, category, header, body, description, tags = []] = row;
  return {
    templateId: key,
    presetKey: key,
    key,
    title,
    displayName: title,
    internalIdentifier: `RELAY_${prefix}_${String(index + 1).padStart(2, '0')}`,
    category,
    language: 'en',
    headerType: header ? 'TEXT' : 'NONE',
    header: header || '',
    body,
    footer: FOOTER,
    variables: varsIn(header, body),
    submissionState: 'unsubmitted_draft',
    approvalStatus: 'NOT_SUBMITTED',
    description,
    tags,
    packVersion,
  };
}

export function buildQuickReply(row) {
  const [key, title, category, text, description] = row;
  return {
    id: key,
    key,
    presetId: key,
    title,
    category,
    text,
    body: text,
    responseBody: text,
    variables: varsIn(text),
    supportedVariables: varsIn(text),
    description,
  };
}

export function buildRule(priority, row) {
  const [key, name, keywords, response, templateReference, description] = row;
  return {
    id: key,
    key,
    presetId: key,
    displayName: name,
    name,
    ruleName: name,
    triggerKeywords: keywords,
    keywords,
    matchType: 'contains',
    matchMethod: 'contains',
    priority,
    enabled: false,
    suggestedResponse: response,
    responseBody: response,
    action: 'REPLY_WITH_TEMPLATE',
    templateReference,
    description,
  };
}

export function buildOptOutRule(prefix) {
  const response = 'You have been unsubscribed from further automated messages from {{business_name}}. Reply START to opt back in anytime.';
  return {
    id: `${prefix}_auto_stop`,
    key: `${prefix}_auto_stop`,
    presetId: `${prefix}_auto_stop`,
    displayName: 'STOP / Unsubscribe',
    name: 'STOP / Unsubscribe',
    ruleName: 'Opt-Out Compliance Handler',
    triggerKeywords: ['STOP', 'UNSUBSCRIBE', 'OPT OUT'],
    keywords: ['STOP', 'UNSUBSCRIBE', 'OPT OUT'],
    matchType: 'exact',
    matchMethod: 'exact',
    priority: 100,
    enabled: true,
    intendedAction: 'RECORD_OPT_OUT',
    suggestedResponse: response,
    responseBody: response,
    description: 'Protected opt-out compliance handler. Always remains active.',
  };
}

export function buildCampaignDraft(row) {
  const [key, name, description, targetAudience, templateReference] = row;
  return {
    id: key,
    campaignId: key,
    presetKey: key,
    campaignName: name,
    title: name,
    name,
    description,
    targetAudience,
    templateReference,
    templateId: templateReference,
    targetTemplateKey: templateReference,
    status: 'draft',
    executed: false,
    recipientList: [],
    executionHistory: null,
    scheduledAt: null,
    stats: { sent: 0, delivered: 0, read: 0, failed: 0 },
  };
}

export function finalizePack(pack) {
  pack.autoReplyRules = pack.automationPresets;
  pack.keywordRules = pack.automationPresets;
  pack.campaignDrafts = pack.sampleCampaignDrafts;
  pack.sampleCampaignDraft = pack.sampleCampaignDrafts[0];
  return pack;
}

export const COMMON_BUSINESS_VARIABLES = [
  { token: 'customer_name', label: 'Customer Full Name', sampleValue: 'Priya Sharma', category: 'Contact', description: 'Full name of the customer' },
  { token: 'first_name', label: 'First Name', sampleValue: 'Priya', category: 'Contact', description: 'First name for greeting' },
  { token: 'business_name', label: 'Business Name', sampleValue: 'Your Business', category: 'Business', description: 'Workspace business name' },
  { token: 'business_phone', label: 'Business Phone', sampleValue: '+919800000000', category: 'Business', description: 'Configured business phone' },
  { token: 'business_email', label: 'Business Email', sampleValue: 'hello@example.com', category: 'Business', description: 'Configured business email' },
  { token: 'business_address', label: 'Business Address', sampleValue: 'Configured business address', category: 'Business', description: 'Configured address (never invented)' },
  { token: 'business_hours', label: 'Business Hours', sampleValue: 'Configured working hours', category: 'Business', description: 'Configured working hours (never invented)' },
];

const leadStatusField = (options) => ({ key: 'leadStatus', label: 'Lead Status', type: 'select', required: true, filterable: true, showInTable: true, options, order: 8 });

export function baseContactFields(extraFields, leadStatuses) {
  const core = [
    { key: 'fullName', label: 'Customer Name', type: 'text', required: true, filterable: true, showInTable: true, order: 1 },
    { key: 'phoneNumber', label: 'WhatsApp Phone Number', type: 'text', required: true, filterable: true, showInTable: true, order: 2 },
    { key: 'email', label: 'Email Address', type: 'text', required: false, filterable: true, showInTable: false, order: 3 },
    { key: 'city', label: 'City', type: 'text', required: false, filterable: true, showInTable: true, order: 4 },
  ];
  const tail = [
    leadStatusField(leadStatuses),
    { key: 'leadSource', label: 'Lead Source', type: 'select', required: false, filterable: true, showInTable: false, options: ['WhatsApp', 'Website', 'Instagram / Facebook', 'Google', 'Referral', 'Walk-in', 'Other'], order: 9 },
    { key: 'followUpDate', label: 'Next Follow-up Date', type: 'date', required: false, filterable: true, showInTable: false, order: 12 },
    { key: 'notes', label: 'Notes', type: 'text', required: false, filterable: false, showInTable: false, order: 13 },
    { key: 'whatsappConsentStatus', label: 'Communication Consent Status', type: 'select', required: true, filterable: true, showInTable: true, options: ['Unknown', 'Opted In', 'Opted Out'], order: 14 },
  ];
  return [...core, ...extraFields, ...tail];
}
