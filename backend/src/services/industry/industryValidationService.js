/**
 * Industry Field and Preset Validation Service
 * Enforces strict type-safety, boundaries, prototype pollution prevention,
 * NoSQL injection resistance, and opt-out keyword protection.
 */

import { industryRegistry } from '../../config/industries/industryRegistry.js';

// Global protected keywords reserved for messaging opt-out and platform control
export const RESERVED_SYSTEM_KEYWORDS = new Set([
  'STOP',
  'UNSUBSCRIBE',
  'CANCEL',
  'QUIT',
  'END',
  'OPTOUT',
  'START',
  'HELP',
  'INFO',
]);

// Universal template variables permitted across all verticals
export const COMMON_TEMPLATE_VARIABLES = new Set([
  'customer_name',
  'business_name',
  'city',
  'phone',
  'email',
]);

// Maximum limits for resource protection
export const MAX_CUSTOM_FIELDS_PER_CONTACT = 30;
export const MAX_STRING_FIELD_LENGTH = 500;
export const MAX_ARRAY_ITEMS = 20;
export const MAX_ARRAY_ITEM_LENGTH = 100;

/**
 * Validates a dictionary of dynamic contact fields against an industry definition.
 * 
 * Invariants:
 * 1. Rejects prototype pollution (`__proto__`, `constructor`, `prototype`).
 * 2. Rejects MongoDB operator keys (`$gt`, `$ne`, etc.).
 * 3. Rejects dotted paths (`field.subfield`).
 * 4. Rejects keys not registered in the industry's field definitions.
 * 5. Type-checks and validates values (select options, number bounds, dates, string lengths).
 * 6. Returns sanitized, safe object.
 */
export function validateContactIndustryData(rawFields, industryKey) {
  if (!rawFields || typeof rawFields !== 'object' || Array.isArray(rawFields)) {
    return { isValid: true, sanitized: {}, errors: [] };
  }

  const registeredFields = industryRegistry.getIndustryContactFields(industryKey);
  const fieldDefMap = new Map(registeredFields.map((f) => [f.key, f]));

  const sanitized = {};
  const errors = [];

  const keys = Object.keys(rawFields);

  if (keys.length > MAX_CUSTOM_FIELDS_PER_CONTACT) {
    errors.push(`Exceeded maximum allowed custom fields (${MAX_CUSTOM_FIELDS_PER_CONTACT}).`);
    return { isValid: false, sanitized: {}, errors };
  }

  for (const [key, rawValue] of Object.entries(rawFields)) {
    // 1. Prototype pollution & NoSQL injection guards
    if (
      key === '__proto__' ||
      key === 'constructor' ||
      key === 'prototype' ||
      key.startsWith('$') ||
      key.includes('.')
    ) {
      errors.push(`Dangerous or illegal field key detected: "${key}".`);
      continue;
    }

    // 2. Must be defined in the active industry
    const def = fieldDefMap.get(key);
    if (!def) {
      errors.push(`Field "${key}" is not a recognized field for industry "${industryKey}".`);
      continue;
    }

    // Null or undefined values are valid empty states (unless required)
    if (rawValue === null || rawValue === undefined || rawValue === '') {
      if (def.required) {
        errors.push(`Field "${def.label}" (${key}) is required.`);
      } else {
        sanitized[key] = null;
      }
      continue;
    }

    // 3. Type-specific validation
    switch (def.type) {
      case 'text': {
        if (typeof rawValue !== 'string') {
          errors.push(`Field "${def.label}" must be a text string.`);
          break;
        }
        const trimmed = rawValue.trim();
        if (trimmed.length > MAX_STRING_FIELD_LENGTH) {
          errors.push(`Field "${def.label}" exceeds maximum length of ${MAX_STRING_FIELD_LENGTH} characters.`);
          break;
        }
        if (def.validation?.minLength && trimmed.length < def.validation.minLength) {
          errors.push(`Field "${def.label}" must be at least ${def.validation.minLength} characters.`);
          break;
        }
        if (def.validation?.maxLength && trimmed.length > def.validation.maxLength) {
          errors.push(`Field "${def.label}" cannot exceed ${def.validation.maxLength} characters.`);
          break;
        }
        sanitized[key] = trimmed;
        break;
      }

      case 'number': {
        const num = Number(rawValue);
        if (isNaN(num)) {
          errors.push(`Field "${def.label}" must be a valid number.`);
          break;
        }
        if (def.validation?.min !== undefined && num < def.validation.min) {
          errors.push(`Field "${def.label}" cannot be less than ${def.validation.min}.`);
          break;
        }
        if (def.validation?.max !== undefined && num > def.validation.max) {
          errors.push(`Field "${def.label}" cannot be greater than ${def.validation.max}.`);
          break;
        }
        sanitized[key] = num;
        break;
      }

      case 'select': {
        const strVal = String(rawValue).trim();
        const validValues = new Set(def.options.map((o) => (typeof o === 'object' ? String(o.value) : String(o))));
        if (!validValues.has(strVal)) {
          errors.push(`Invalid option "${strVal}" for field "${def.label}". Allowed: ${Array.from(validValues).join(', ')}`);
          break;
        }
        sanitized[key] = strVal;
        break;
      }

      case 'multiselect': {
        if (!Array.isArray(rawValue)) {
          errors.push(`Field "${def.label}" must be an array of selected options.`);
          break;
        }
        if (rawValue.length > MAX_ARRAY_ITEMS) {
          errors.push(`Field "${def.label}" cannot contain more than ${MAX_ARRAY_ITEMS} items.`);
          break;
        }
        const validValues = new Set(def.options.map((o) => (typeof o === 'object' ? String(o.value) : String(o))));
        const cleanedList = [];
        let hasInvalidOption = false;

        for (const item of rawValue) {
          const strItem = String(item).trim().slice(0, MAX_ARRAY_ITEM_LENGTH);
          if (!validValues.has(strItem)) {
            errors.push(`Invalid option "${strItem}" in multiselect field "${def.label}".`);
            hasInvalidOption = true;
            break;
          }
          if (!cleanedList.includes(strItem)) {
            cleanedList.push(strItem);
          }
        }
        if (!hasInvalidOption) {
          sanitized[key] = cleanedList;
        }
        break;
      }

      case 'date': {
        const d = new Date(rawValue);
        if (isNaN(d.getTime())) {
          errors.push(`Field "${def.label}" must be a valid ISO date.`);
          break;
        }
        sanitized[key] = d.toISOString();
        break;
      }

      case 'boolean': {
        if (typeof rawValue === 'boolean') {
          sanitized[key] = rawValue;
        } else if (rawValue === 'true' || rawValue === '1') {
          sanitized[key] = true;
        } else if (rawValue === 'false' || rawValue === '0') {
          sanitized[key] = false;
        } else {
          errors.push(`Field "${def.label}" must be a boolean.`);
        }
        break;
      }

      case 'phone': {
        const phoneStr = String(rawValue).trim();
        if (!/^\+?[1-9]\d{7,14}$/.test(phoneStr)) {
          errors.push(`Field "${def.label}" must be a valid phone number format.`);
          break;
        }
        sanitized[key] = phoneStr;
        break;
      }

      case 'url': {
        const urlStr = String(rawValue).trim();
        if (!/^https?:\/\/[^\s$.?#].[^\s]*$/i.test(urlStr) || urlStr.length > 300) {
          errors.push(`Field "${def.label}" must be a valid HTTP or HTTPS URL.`);
          break;
        }
        sanitized[key] = urlStr;
        break;
      }

      default:
        errors.push(`Unsupported field type "${def.type}" for field "${key}".`);
    }
  }

  return {
    isValid: errors.length === 0,
    sanitized: errors.length === 0 ? sanitized : {},
    errors,
  };
}

/**
 * Validates template variables against common allowlist and industry-specific variables.
 */
export function validateTemplateVariables(variables, industryKey) {
  if (!Array.isArray(variables)) {
    return { isValid: false, errors: ['Variables must be an array.'] };
  }

  const def = industryRegistry.getIndustryDefinition(industryKey);
  // Collect all variables defined across the industry's template suggestions
  const industryAllowedVars = new Set(COMMON_TEMPLATE_VARIABLES);
  for (const tpl of def.templateSuggestions || []) {
    for (const v of tpl.variables || []) {
      industryAllowedVars.add(v);
    }
  }

  const errors = [];
  for (const v of variables) {
    if (typeof v !== 'string' || !/^[a-z0-9_]{2,40}$/.test(v)) {
      errors.push(`Invalid variable syntax: "{{${v}}}". Must be lowercase alphanumeric/underscores (2-40 chars).`);
      continue;
    }
    if (!industryAllowedVars.has(v)) {
      errors.push(`Variable "{{${v}}}" is not supported for industry "${industryKey}".`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates keyword triggers and ensures no collision with STOP/compliance keywords.
 */
export function validateTriggerKeywords(triggerKeywords) {
  if (!Array.isArray(triggerKeywords) || triggerKeywords.length === 0) {
    return { isValid: false, errors: ['At least one trigger keyword is required.'] };
  }

  const normalized = [];
  const errors = [];
  const seen = new Set();

  for (const rawKw of triggerKeywords) {
    if (typeof rawKw !== 'string' || rawKw.trim().length === 0) {
      errors.push('Trigger keyword cannot be empty.');
      continue;
    }

    const cleanKw = rawKw.toUpperCase().trim();

    if (cleanKw.length < 2 || cleanKw.length > 50) {
      errors.push(`Keyword "${cleanKw}" must be between 2 and 50 characters.`);
      continue;
    }

    // Critical Opt-Out protection: System compliance keywords cannot be hijacked
    if (RESERVED_SYSTEM_KEYWORDS.has(cleanKw)) {
      errors.push(
        `Keyword "${cleanKw}" is reserved for compliance suppression (STOP/UNSUBSCRIBE) and cannot be used in automation rules.`
      );
      continue;
    }

    if (!/^[A-Z0-9\s_-]+$/.test(cleanKw)) {
      errors.push(`Keyword "${cleanKw}" contains invalid characters. Use letters, numbers, spaces, or hyphens.`);
      continue;
    }

    if (seen.has(cleanKw)) {
      // Deduplicate silently
      continue;
    }

    seen.add(cleanKw);
    normalized.push(cleanKw);
  }

  return {
    isValid: errors.length === 0,
    keywords: errors.length === 0 ? normalized : [],
    errors,
  };
}
