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
];

export const SUPPORTED_MATCH_TYPES = ['exact', 'contains'];

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

  const { presetKey, title, body, variables } = template;

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

  const { presetId, displayName, triggerKeywords, matchType, suggestedResponse } = preset;

  if (!presetId || typeof presetId !== 'string') {
    throw new Error(`[Industry:${industryKey}] Automation preset at index ${index} must have presetId.`);
  }

  if (!displayName || typeof displayName !== 'string') {
    throw new Error(`[Industry:${industryKey}] Automation preset "${presetId}" must have displayName.`);
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
    automationPresets,
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

  // Validate templates
  if (!Array.isArray(templateSuggestions)) {
    throw new Error(`[Industry:${key}] templateSuggestions must be an array.`);
  }
  templateSuggestions.forEach((tpl, index) => validateTemplateSuggestion(tpl, index, key));

  // Validate automation presets
  if (!Array.isArray(automationPresets)) {
    throw new Error(`[Industry:${key}] automationPresets must be an array.`);
  }
  automationPresets.forEach((ap, index) => validateAutomationPreset(ap, index, key));

  // Ensure serializability
  try {
    JSON.stringify(def);
  } catch (err) {
    throw new Error(`[Industry:${key}] Definition is not JSON-serializable: ${err.message}`);
  }

  return true;
}
