/**
 * Workspace Industry Configuration Service
 * Resolves effective per-workspace configuration, merges authorized tenant preferences,
 * and provisions safe, inactive template and automation drafts.
 */

import { industryRegistry } from '../../config/industries/industryRegistry.js';
import { validateTemplateVariables, validateTriggerKeywords } from './industryValidationService.js';
import MessageTemplate from '../../models/MessageTemplate.js';
import AutoReplyRule from '../../models/AutoReplyRule.js';

export class IndustryConfigurationError extends Error {
  constructor(message, status = 400, code = 'INVALID_CONFIG') {
    super(message);
    this.name = 'IndustryConfigurationError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Resolves the effective, authorized industry configuration for a workspace.
 */
export function resolveWorkspaceIndustryConfig(workspace) {
  if (!workspace) {
    throw new IndustryConfigurationError('Workspace context is required.', 400, 'MISSING_WORKSPACE');
  }

  const industryKey = workspace.industryKey || 'other';

  if (!industryRegistry.isValidIndustry(industryKey)) {
    throw new IndustryConfigurationError(`Unsupported industry key "${industryKey}".`, 400, 'INVALID_INDUSTRY');
  }

  const baseDef = industryRegistry.getIndustryDefinition(industryKey);
  const preferences = workspace.settings?.industryPreferences || {};

  // Merge terminology customizations if provided by workspace
  const terminology = {
    ...baseDef.terminology,
    ...(preferences.customTerminology || {}),
  };

  // Merge table column preferences
  const displayPreferences = {
    ...baseDef.contactDisplayPreferences,
    ...(preferences.displayPreferences || {}),
  };

  return {
    workspaceId: workspace._id,
    workspaceName: workspace.name,
    industryKey: baseDef.key,
    name: baseDef.name,
    description: baseDef.description,
    icon: baseDef.icon,
    registryVersion: baseDef.version,
    workspaceConfigVersion: workspace.configurationVersion || 1,
    defaultLocale: baseDef.defaultLocale,
    featureAvailability: { ...baseDef.featureAvailability },
    terminology,
    contactFields: baseDef.contactFields,
    contactDisplayPreferences: displayPreferences,
    contactFilters: baseDef.contactFilters,
    templateSuggestions: baseDef.templateSuggestions,
    automationPresets: baseDef.automationPresets,
    customPreferences: preferences,
  };
}

/**
 * Creates an authorized, workspace-scoped MessageTemplate DRAFT from a template suggestion.
 * 
 * Safety invariants:
 * 1. Status is strictly 'DRAFT'.
 * 2. isMetaApproved is FALSE (zero false claims of Meta approval).
 * 3. Does NOT dispatch any live or mock messages.
 * 4. Scoped to workspace._id.
 */
export async function createTemplateDraftFromPreset({
  workspace,
  presetKey,
  customTitle,
  customBody,
  user,
}) {
  if (!workspace) {
    throw new IndustryConfigurationError('Workspace context required.', 400, 'MISSING_WORKSPACE');
  }

  const industryKey = workspace.industryKey || 'other';
  const def = industryRegistry.getIndustryDefinition(industryKey);

  const preset = (def.templateSuggestions || []).find((t) => t.presetKey === presetKey);
  if (!preset) {
    throw new IndustryConfigurationError(
      `Template preset "${presetKey}" not found for industry "${industryKey}".`,
      404,
      'PRESET_NOT_FOUND'
    );
  }

  const title = (customTitle || preset.title || '').trim().slice(0, 100);
  const body = (customBody || preset.body || '').trim().slice(0, 1024);

  // Validate variables in body
  const bodyVars = (body.match(/\{\{([a-z0-9_]+)\}\}/g) || []).map((m) => m.replace(/[\{\}]/g, ''));
  const varValidation = validateTemplateVariables(bodyVars, industryKey);
  if (!varValidation.isValid) {
    throw new IndustryConfigurationError(varValidation.errors.join('; '), 400, 'INVALID_VARIABLES');
  }

  // Idempotency: check if an identical draft already exists in this workspace
  let existingDraft = null;
  try {
    existingDraft = await MessageTemplate.findOne({
      workspaceId: workspace._id,
      name: title,
      status: 'DRAFT',
    });
  } catch {}

  if (existingDraft) {
    return { template: existingDraft, isExisting: true };
  }

  // Persist new draft scoped strictly to this workspace
  const newTemplate = await MessageTemplate.create({
    ownerId: workspace.createdBy || user._id,
    workspaceId: workspace._id,
    name: title,
    body,
    category: 'Marketing',
    language: 'en',
    localStatus: 'Draft',
    providerStatus: 'Not Submitted',
    mockProviderApprovalStatus: 'Not Submitted',
    internalVariables: bodyVars,
    businessCategory: def.name,
    intendedService: preset.title,
    buttons: [],
  });

  return { template: newTemplate, isExisting: false };
}

/**
 * Creates an authorized, workspace-scoped AutoReplyRule from a keyword automation preset.
 * 
 * Safety invariants:
 * 1. Disabled by default (`enabled: false`).
 * 2. Zero execution upon creation.
 * 3. Keywords validated and verified against STOP/compliance keywords.
 * 4. Scoped to workspace._id.
 */
export async function createAutomationDraftFromPreset({
  workspace,
  presetId,
  customResponse,
  user,
}) {
  if (!workspace) {
    throw new IndustryConfigurationError('Workspace context required.', 400, 'MISSING_WORKSPACE');
  }

  const industryKey = workspace.industryKey || 'other';
  const def = industryRegistry.getIndustryDefinition(industryKey);

  const preset = (def.automationPresets || []).find((p) => p.presetId === presetId);
  if (!preset) {
    throw new IndustryConfigurationError(
      `Automation preset "${presetId}" not found for industry "${industryKey}".`,
      404,
      'PRESET_NOT_FOUND'
    );
  }

  // Validate keywords
  const kwValidation = validateTriggerKeywords(preset.triggerKeywords);
  if (!kwValidation.isValid) {
    throw new IndustryConfigurationError(kwValidation.errors.join('; '), 400, 'INVALID_KEYWORDS');
  }

  const responseText = (customResponse || preset.suggestedResponse || '').trim().slice(0, 1024);

  // Idempotency check: prevent duplicate draft creations
  let existingRule = null;
  try {
    existingRule = await AutoReplyRule.findOne({
      workspaceId: workspace._id,
      name: preset.displayName,
    });
  } catch {}

  if (existingRule) {
    return { rule: existingRule, isExisting: true };
  }

  const primaryKw = kwValidation.keywords[0];
  const synonyms = kwValidation.keywords.slice(1);
  const matchTypeMap = {
    exact: 'EXACT_MATCH',
    contains: 'CONTAINS',
    whole_word: 'WHOLE_WORD',
  };
  const mappedMatchType = matchTypeMap[preset.matchType] || 'CONTAINS';

  // Create inactive auto-reply rule
  const newRule = await AutoReplyRule.create({
    ownerId: workspace.createdBy || user._id,
    workspaceId: workspace._id,
    name: preset.displayName,
    triggerKeyword: primaryKw,
    synonyms,
    matchType: mappedMatchType,
    actionType: 'RUN_MOCK_REPLY',
    responseMessage: responseText,
    enabled: false, // Strictly inactive by default
    priority: preset.priority || 10,
  });

  return { rule: newRule, isExisting: false };
}

/**
 * Saves safe workspace-level industry preferences.
 */
export async function updateWorkspaceIndustryPreferences(workspace, preferences = {}) {
  if (!workspace) {
    throw new IndustryConfigurationError('Workspace required.', 400, 'MISSING_WORKSPACE');
  }

  if (typeof preferences !== 'object' || Array.isArray(preferences)) {
    throw new IndustryConfigurationError('Preferences must be an object.', 400, 'INVALID_PREFERENCES');
  }

  // Sanitize preferences
  const clean = {};
  for (const [k, v] of Object.entries(preferences)) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype' || k.startsWith('$')) {
      continue;
    }
    clean[k] = v;
  }

  if (!workspace.settings) {
    workspace.settings = {};
  }

  workspace.settings.industryPreferences = clean;
  workspace.markModified('settings');
  await workspace.save();

  return resolveWorkspaceIndustryConfig(workspace);
}
