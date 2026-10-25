/**
 * Industry Configuration Service
 * Provides workspace industry resolution, dynamic contact field validation,
 * template variable validation, and industry-specific terminology formatting.
 */

import { getIndustryConfig, getStrictIndustryConfig } from '../config/industries/industryRegistry.js';
import Workspace from '../models/Workspace.js';
import { LEAD_STATUSES } from '../models/Contact.js';

/**
 * Resolves the effective industry configuration for a workspace.
 */
export async function getEffectiveWorkspaceIndustryConfig(workspaceId) {
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) {
    throw Object.assign(new Error('Workspace not found'), { status: 404 });
  }

  const industryKey = workspace.industryKey || 'other';
  const config = getIndustryConfig(industryKey);

  return {
    workspaceId: workspace._id,
    workspaceName: workspace.name,
    industryKey: config.key,
    industryName: config.name,
    description: config.description,
    displayLabel: config.displayLabel || config.name,
    version: config.version,
    terminology: config.terminology,
    contactFields: config.contactFields,
    contactDisplayPreferences: config.contactDisplayPreferences,
    contactFilters: config.contactFilters,
    templateSuggestions: config.templateSuggestions,
    automationPresets: config.automationPresets,
    quickReplyPresets: config.quickReplyPresets || [],
    sampleCampaignDrafts: config.sampleCampaignDrafts || [],
    supportedVariables: config.supportedVariables || [],
    templateCategories: config.templateCategories || [],
    leadStatuses: LEAD_STATUSES,
    ui: config.ui,
    compatibilityFallback: !getStrictIndustryConfig(industryKey),
    settings: workspace.settings || {},
  };
}

/**
 * Sanitizes and validates dynamic industryData submitted for a contact.
 * Ensures:
 * 1. Prototype pollution protection.
 * 2. MongoDB operator stripping ($).
 * 3. Enforces field bounds & allowed enum options.
 * 4. Bridges canonical real-estate fields for backward compatibility.
 */
export function validateAndSanitizeIndustryData(rawIndustryData, industryKey = 'other') {
  if (!rawIndustryData || typeof rawIndustryData !== 'object' || Array.isArray(rawIndustryData)) {
    return { sanitized: {}, canonicalUpdates: {} };
  }

  const config = getIndustryConfig(industryKey);
  const fieldDefs = new Map(config.contactFields.map((f) => [f.key, f]));

  const sanitized = {};
  const canonicalUpdates = {};

  for (const [key, rawValue] of Object.entries(rawIndustryData)) {
    // 1. Prototype pollution and operator injection protection
    if (
      key === '__proto__' ||
      key === 'constructor' ||
      key === 'prototype' ||
      key.startsWith('$') ||
      key.includes('.')
    ) {
      continue;
    }

    const fieldDef = fieldDefs.get(key);
    if (!fieldDef) {
      // Ignore unknown fields
      continue;
    }

    let value = rawValue;

    // Type validation & normalization
    if (fieldDef.type === 'select') {
      if (value !== undefined && value !== null && value !== '') {
        const strVal = String(value).trim();
        const allowedOption = fieldDef.options.find(
          (opt) => (typeof opt === 'object' ? opt.value : opt) === strVal
        );
        if (!allowedOption) {
          throw Object.assign(
            new Error(`Invalid option "${strVal}" for field "${fieldDef.label}".`),
            { status: 400, code: 'INVALID_FIELD_OPTION' }
          );
        }
        value = strVal;
      } else {
        value = '';
      }
    } else if (fieldDef.type === 'multiselect') {
      if (Array.isArray(value)) {
        const allowedValues = new Set(
          fieldDef.options.map((opt) => (typeof opt === 'object' ? opt.value : opt))
        );
        value = value
          .map((v) => String(v).trim())
          .filter((v) => allowedValues.has(v))
          .slice(0, 20);
      } else {
        value = [];
      }
    } else if (fieldDef.type === 'number') {
      if (value !== undefined && value !== null && value !== '') {
        const num = Number(value);
        if (!Number.isFinite(num)) {
          throw Object.assign(
            new Error(`Field "${fieldDef.label}" must be a valid number.`),
            { status: 400, code: 'INVALID_NUMBER' }
          );
        }
        value = num;
      } else {
        value = null;
      }
    } else if (fieldDef.type === 'date') {
      if (value) {
        const parsed = new Date(value);
        if (isNaN(parsed.getTime())) {
          throw Object.assign(
            new Error(`Field "${fieldDef.label}" must be a valid date.`),
            { status: 400, code: 'INVALID_DATE' }
          );
        }
        value = parsed;
      } else {
        value = null;
      }
    } else if (fieldDef.type === 'boolean') {
      value = Boolean(value);
    } else {
      // Text
      value = typeof value === 'string' ? value.trim().slice(0, 300) : '';
    }

    // Canonical bridge for real estate fields (so top-level Contact schema stays populated)
    if (fieldDef.isCanonical && industryKey === 'real_estate') {
      canonicalUpdates[key] = value;
    }

    sanitized[key] = value;
  }

  // Keep existing search/audience columns synchronized with registered industry fields.
  const bindings = config.ui.contactBindings;
  if (bindings.interest && Object.hasOwn(sanitized, bindings.interest)) {
    canonicalUpdates.interestedService = String(sanitized[bindings.interest] ?? '');
  }
  if (bindings.project && Object.hasOwn(sanitized, bindings.project)) {
    canonicalUpdates.businessCategory = String(sanitized[bindings.project] ?? '').slice(0, 80);
  }

  return { sanitized, canonicalUpdates };
}

export default {
  getEffectiveWorkspaceIndustryConfig,
  validateAndSanitizeIndustryData,
};
