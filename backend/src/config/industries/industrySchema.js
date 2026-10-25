/**
 * Schema and contract validator for Relay Industry Configuration definitions.
 * Enforces strict structure, field types, option lists, template variables,
 * and serializability at registry initialization time.
 */

export const SUPPORTED_FIELD_TYPES = [
  'text',
  'number',
  'select',
  'multiselect',
  'date',
  'boolean',
  'phone',
  'url',
];

export const SUPPORTED_MATCH_TYPES = [
  'exact',
  'contains',
  'whole_word',
  'EXACT_MATCH',
  'CONTAINS',
  'WHOLE_WORD',
];

export const ALLOWED_TEMPLATE_VARIABLE_PATTERN = /^[a-z0-9_]{2,40}$/;

/**
 * Validates a single contact field definition.
 * Throws an Error with precise developer feedback if invalid.
 */
export function validateContactFieldDefinition(field, index = 0, industryKey = '') {
  if (!field || typeof field !== 'object') {
    throw new Error(`[Industry:${industryKey}] Field at index ${index} must be an object.`);
  }

  const { key, label, type, options, required, filterable, showInTable } = field;

  if (!key || typeof key !== 'string' || !/^[a-zA-Z0-9_]{2,50}$/.test(key)) {
    throw new Error(
      `[Industry:${industryKey}] Field at index ${index} has invalid key "${key}". Must be alphanumeric 2-50 chars.`
    );
  }

  // Prevent dangerous key names
  if (['__proto__', 'constructor', 'prototype', '_id', 'ownerId', 'workspaceId'].includes(key)) {
    throw new Error(`[Industry:${industryKey}] Forbidden field key name: "${key}".`);
  }

  if (!label || typeof label !== 'string' || label.trim().length === 0) {
    throw new Error(`[Industry:${industryKey}] Field "${key}" must have a non-empty label.`);
  }

  if (!SUPPORTED_FIELD_TYPES.includes(type)) {
    throw new Error(
      `[Industry:${industryKey}] Field "${key}" has invalid type "${type}". Allowed: ${SUPPORTED_FIELD_TYPES.join(', ')}`
    );
  }

  if (['select', 'multiselect'].includes(type)) {
    if (!Array.isArray(options) || options.length === 0) {
      throw new Error(`[Industry:${industryKey}] Field "${key}" of type "${type}" must define a non-empty options array.`);
    }

    const seenValues = new Set();
    options.forEach((opt, optIndex) => {
      const value = typeof opt === 'object' ? opt.value : opt;
      const optLabel = typeof opt === 'object' ? opt.label : opt;

      if (value === undefined || value === null || String(value).trim() === '') {
        throw new Error(`[Industry:${industryKey}] Field "${key}" option at index ${optIndex} has empty value.`);
      }

      const strVal = String(value);
      if (seenValues.has(strVal)) {
        throw new Error(`[Industry:${industryKey}] Duplicate option value "${strVal}" in field "${key}".`);
      }
      seenValues.add(strVal);

      if (!optLabel || String(optLabel).trim() === '') {
        throw new Error(`[Industry:${industryKey}] Field "${key}" option at index ${optIndex} has empty label.`);
      }
    });
  }

  return true;
}

/**
 * Validates a template suggestion definition.
 */
export function validateTemplateSuggestion(template, index = 0, industryKey = '') {
  if (!template || typeof template !== 'object') {
    throw new Error(`[Industry:${industryKey}] Template at index ${index} must be an object.`);
  }

  const presetKey = template.presetKey || template.key;
  const { title, body, variables } = template;

  if (!presetKey || typeof presetKey !== 'string') {
    throw new Error(`[Industry:${industryKey}] Template at index ${index} must have a presetKey.`);
  }

  if (!title || typeof title !== 'string') {
    throw new Error(`[Industry:${industryKey}] Template "${presetKey}" must have a title.`);
  }

  if (!body || typeof body !== 'string' || body.trim().length === 0) {
    throw new Error(`[Industry:${industryKey}] Template "${presetKey}" must have non-empty body text.`);
  }

  if (variables && !Array.isArray(variables)) {
    throw new Error(`[Industry:${industryKey}] Template "${presetKey}" variables must be an array.`);
  }

  if (Array.isArray(variables)) {
    for (const v of variables) {
      if (!ALLOWED_TEMPLATE_VARIABLE_PATTERN.test(v)) {
        throw new Error(`[Industry:${industryKey}] Template "${presetKey}" has invalid variable name "${v}".`);
      }
    }
  }

  return true;
}

/**
 * Validates an automation preset definition.
 */
export function validateAutomationPreset(preset, index = 0, industryKey = '') {
  if (!preset || typeof preset !== 'object') {
    throw new Error(`[Industry:${industryKey}] Automation preset at index ${index} must be an object.`);
  }

  const presetId = preset.presetId || preset.id;
  const displayName = preset.displayName || preset.ruleName;
  const { triggerKeywords, matchType, suggestedResponse } = preset;

  if (!presetId || typeof presetId !== 'string') {
    throw new Error(`[Industry:${industryKey}] Automation preset at index ${index} must have presetId.`);
  }

  if (!displayName || typeof displayName !== 'string') {
    throw new Error(`[Industry:${industryKey}] Automation preset "${presetId}" must have displayName or ruleName.`);
  }

  if (!Array.isArray(triggerKeywords) || triggerKeywords.length === 0) {
    throw new Error(`[Industry:${industryKey}] Automation preset "${presetId}" must have triggerKeywords array.`);
  }

  if (!SUPPORTED_MATCH_TYPES.includes(matchType)) {
    throw new Error(
      `[Industry:${industryKey}] Automation preset "${presetId}" matchType "${matchType}" invalid. Allowed: ${SUPPORTED_MATCH_TYPES.join(', ')}`
    );
  }

  if (!suggestedResponse || typeof suggestedResponse !== 'string' || suggestedResponse.trim().length === 0) {
    throw new Error(`[Industry:${industryKey}] Automation preset "${presetId}" must have suggestedResponse text.`);
  }

  return true;
}

/**
 * Validates a quick reply preset.
 */
export function validateQuickReplyPreset(qr, index = 0, industryKey = '') {
  if (!qr || typeof qr !== 'object') {
    throw new Error(`[Industry:${industryKey}] Quick reply at index ${index} must be an object.`);
  }
  const key = qr.key || qr.presetKey || qr.id;
  const title = qr.title || qr.label;
  const text = qr.text || qr.body;
  if (!key || typeof key !== 'string') {
    throw new Error(`[Industry:${industryKey}] Quick reply at index ${index} must have a key.`);
  }
  if (!title || typeof title !== 'string') {
    throw new Error(`[Industry:${industryKey}] Quick reply "${key}" must have a title.`);
  }
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    throw new Error(`[Industry:${industryKey}] Quick reply "${key}" must have text.`);
  }
  return true;
}

/**
 * Validates a sample campaign draft.
 */
export function validateSampleCampaign(campaign, industryKey = '') {
  if (!campaign || typeof campaign !== 'object') {
    throw new Error(`[Industry:${industryKey}] Sample campaign must be an object.`);
  }
  const name = campaign.campaignName || campaign.name;
  if (!name || typeof name !== 'string') {
    throw new Error(`[Industry:${industryKey}] Sample campaign must have a name.`);
  }
  return true;
}

/**
 * Validates a supported variable definition.
 */
export function validateSupportedVariable(v, index = 0, industryKey = '') {
  if (!v || typeof v !== 'object') {
    throw new Error(`[Industry:${industryKey}] Supported variable at index ${index} must be an object.`);
  }
  if (!v.token || typeof v.token !== 'string') {
    throw new Error(`[Industry:${industryKey}] Supported variable at index ${index} must have a token.`);
  }
  return true;
}

/**
 * Comprehensive validator for an entire Industry Configuration definition.
 */
export function validateIndustryDefinition(def) {
  if (!def || typeof def !== 'object') {
    throw new Error('Industry definition must be a non-null object.');
  }

  const {
    key,
    name,
    description,
    icon,
    version,
    terminology,
    contactFields,
    contactDisplayPreferences,
    contactFilters,
    templateSuggestions,
    starterTemplatePack,
    automationPresets,
    keywordAutoReplyPack,
    quickReplyPresets,
    quickReplyPack,
    sampleCampaignDraft,
    supportedVariables,
  } = def;

  if (!key || typeof key !== 'string' || !/^[a-z0-9_]{3,30}$/.test(key)) {
    throw new Error(`Invalid industry key: "${key}". Must be lowercase alphanumeric 3-30 chars.`);
  }

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw new Error(`[Industry:${key}] Industry must have a display name.`);
  }

  if (!description || typeof description !== 'string') {
    throw new Error(`[Industry:${key}] Industry must have a description.`);
  }

  if (!icon || typeof icon !== 'string') {
    throw new Error(`[Industry:${key}] Industry must have an icon identifier.`);
  }

  if (!version || typeof version !== 'number' || version < 1 || !Number.isInteger(version)) {
    throw new Error(`[Industry:${key}] Version must be an integer >= 1.`);
  }

  if (!terminology || typeof terminology !== 'object') {
    throw new Error(`[Industry:${key}] Terminology must be an object.`);
  }

  const requiredTerms = ['leadLabel', 'leadPlural', 'offeringLabel', 'offeringPlural', 'interestFieldLabel', 'actionLabel'];
  for (const term of requiredTerms) {
    if (!terminology[term] || typeof terminology[term] !== 'string') {
      throw new Error(`[Industry:${key}] Terminology missing required key: "${term}".`);
    }
  }

  // Validate contact fields
  if (!Array.isArray(contactFields)) {
    throw new Error(`[Industry:${key}] contactFields must be an array.`);
  }

  const seenKeys = new Set();
  contactFields.forEach((field, index) => {
    validateContactFieldDefinition(field, index, key);
    if (seenKeys.has(field.key)) {
      throw new Error(`[Industry:${key}] Duplicate field key detected: "${field.key}".`);
    }
    seenKeys.add(field.key);
  });

  // Validate templates (supports either templateSuggestions or starterTemplatePack)
  const templates = templateSuggestions || starterTemplatePack;
  if (!Array.isArray(templates)) {
    throw new Error(`[Industry:${key}] templateSuggestions must be an array.`);
  }
  const seenTemplateKeys = new Set();
  templates.forEach((tpl, index) => {
    validateTemplateSuggestion(tpl, index, key);
    const tplKey = tpl.presetKey || tpl.key || tpl.templateId;
    if (seenTemplateKeys.has(tplKey)) {
      throw new Error(`[Industry:${key}] Duplicate template key detected: "${tplKey}".`);
    }
    seenTemplateKeys.add(tplKey);
  });

  // Validate automation presets (supports either automationPresets or keywordAutoReplyPack)
  const automations = automationPresets || keywordAutoReplyPack;
  if (!Array.isArray(automations)) {
    throw new Error(`[Industry:${key}] automationPresets must be an array.`);
  }
  const seenAutomationIds = new Set();
  automations.forEach((ap, index) => {
    validateAutomationPreset(ap, index, key);
    const apId = ap.presetId || ap.id;
    if (seenAutomationIds.has(apId)) {
      throw new Error(`[Industry:${key}] Duplicate automation preset ID: "${apId}".`);
    }
    seenAutomationIds.add(apId);
  });

  // Validate quick reply presets if present
  const quickReplies = quickReplyPresets || quickReplyPack;
  if (quickReplies) {
    if (!Array.isArray(quickReplies)) {
      throw new Error(`[Industry:${key}] quickReplyPresets must be an array.`);
    }
    const seenQrKeys = new Set();
    quickReplies.forEach((qr, idx) => {
      validateQuickReplyPreset(qr, idx, key);
      const qrKey = qr.key || qr.presetKey || qr.id;
      if (seenQrKeys.has(qrKey)) {
        throw new Error(`[Industry:${key}] Duplicate quick reply key detected: "${qrKey}".`);
      }
      seenQrKeys.add(qrKey);
    });
  }

  // Validate sample campaigns if present
  const campaignDrafts = def.sampleCampaignDrafts || (sampleCampaignDraft ? [sampleCampaignDraft] : null);
  if (campaignDrafts) {
    if (!Array.isArray(campaignDrafts)) {
      throw new Error(`[Industry:${key}] sampleCampaignDrafts must be an array.`);
    }
    campaignDrafts.forEach((camp) => {
      validateSampleCampaign(camp, key);
      if (camp.targetTemplateKey && !seenTemplateKeys.has(camp.targetTemplateKey)) {
        // Warning or validation ensuring template exists in pack
        console.warn(`[Industry:${key}] Sample campaign "${camp.campaignName || camp.name}" references template "${camp.targetTemplateKey}"`);
      }
    });
  }

  // Validate supported variables if present
  if (supportedVariables) {
    if (!Array.isArray(supportedVariables)) {
      throw new Error(`[Industry:${key}] supportedVariables must be an array.`);
    }
    supportedVariables.forEach((v, idx) => validateSupportedVariable(v, idx, key));
  }

  // Ensure serializability
  try {
    JSON.stringify(def);
  } catch (err) {
    throw new Error(`[Industry:${key}] Definition is not JSON-serializable: ${err.message}`);
  }

  return true;
}
