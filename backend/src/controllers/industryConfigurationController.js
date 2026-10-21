/**
 * Industry Configuration Controller
 * Handles public industry metadata as well as authorized workspace-scoped
 * configuration resolution, field validation, and draft creation.
 */

import { asyncHandler } from '../utils/asyncHandler.js';
import { industryRegistry } from '../config/industries/industryRegistry.js';
import {
  resolveWorkspaceIndustryConfig,
  createTemplateDraftFromPreset,
  createAutomationDraftFromPreset,
  updateWorkspaceIndustryPreferences,
  IndustryConfigurationError,
} from '../services/industry/industryConfigurationService.js';
import { validateContactIndustryData } from '../services/industry/industryValidationService.js';

/**
 * GET /api/public/industries or /api/industries
 * Public: returns marketing metadata and capability overview for all 7 verticals.
 */
export const getPublicIndustries = asyncHandler(async (req, res) => {
  const industries = industryRegistry.getPublicIndustryMetadata();
  res.json({ industries });
});

/**
 * GET /api/public/industries/:industryKey or /api/industries/:industryKey
 * Public: returns full schema definition for preview / marketing.
 */
export const getPublicIndustryByKey = asyncHandler(async (req, res) => {
  const { industryKey } = req.params;
  if (!industryRegistry.isValidIndustry(industryKey)) {
    return res.status(404).json({
      code: 'INDUSTRY_NOT_FOUND',
      message: `Industry "${industryKey}" not found. Supported: ${industryRegistry.getRegisteredKeys().join(', ')}`,
    });
  }
  const industry = industryRegistry.getIndustryDefinition(industryKey);
  res.json({ industry });
});

/**
 * GET /api/workspaces/current/industry-config
 * Protected: returns effective configuration tailored to the active authorized workspace.
 */
export const getWorkspaceIndustryConfig = asyncHandler(async (req, res) => {
  const config = resolveWorkspaceIndustryConfig(req.workspace);
  res.json({ config });
});

/**
 * GET /api/workspaces/current/contact-field-definitions
 * Protected: returns contact field definitions, terminology, and table preferences.
 */
export const getWorkspaceFieldDefinitions = asyncHandler(async (req, res) => {
  const config = resolveWorkspaceIndustryConfig(req.workspace);
  res.json({
    industryKey: config.industryKey,
    contactFields: config.contactFields,
    displayPreferences: config.contactDisplayPreferences,
    terminology: config.terminology,
  });
});

/**
 * GET /api/workspaces/current/filter-definitions
 * Protected: returns supported filter definitions for the active workspace.
 */
export const getWorkspaceFilterDefinitions = asyncHandler(async (req, res) => {
  const config = resolveWorkspaceIndustryConfig(req.workspace);
  res.json({
    industryKey: config.industryKey,
    filters: config.contactFilters,
  });
});

/**
 * GET /api/workspaces/current/template-suggestions
 * Protected: returns vetted message template suggestions for the active workspace.
 */
export const getWorkspaceTemplateSuggestions = asyncHandler(async (req, res) => {
  const config = resolveWorkspaceIndustryConfig(req.workspace);
  res.json({
    industryKey: config.industryKey,
    templateSuggestions: config.templateSuggestions,
  });
});

/**
 * GET /api/workspaces/current/automation-suggestions
 * Protected: returns keyword automation presets for the active workspace.
 */
export const getWorkspaceAutomationSuggestions = asyncHandler(async (req, res) => {
  const config = resolveWorkspaceIndustryConfig(req.workspace);
  res.json({
    industryKey: config.industryKey,
    automationPresets: config.automationPresets,
  });
});

/**
 * POST /api/workspaces/current/template-draft
 * Protected: creates an editable, inactive MessageTemplate DRAFT in the workspace.
 * Fails closed against false Meta approvals and live dispatching.
 */
export const createTemplateDraft = asyncHandler(async (req, res) => {
  const { presetKey, title, body } = req.body;
  if (!presetKey) {
    return res.status(400).json({ code: 'PRESET_KEY_REQUIRED', message: 'presetKey is required.' });
  }

  try {
    const result = await createTemplateDraftFromPreset({
      workspace: req.workspace,
      presetKey,
      customTitle: title,
      customBody: body,
      user: req.user,
    });

    res.status(result.isExisting ? 200 : 201).json({
      message: result.isExisting
        ? 'Template draft already exists in workspace.'
        : 'Template draft created successfully.',
      template: result.template,
      isExisting: result.isExisting,
    });
  } catch (err) {
    if (err instanceof IndustryConfigurationError) {
      return res.status(err.status).json({ code: err.code, message: err.message });
    }
    throw err;
  }
});

/**
 * POST /api/workspaces/current/automation-draft
 * Protected: creates an inactive AutoReplyRule draft from a keyword preset.
 * Strictly disabled by default.
 */
export const createAutomationDraft = asyncHandler(async (req, res) => {
  const { presetId, responseMessage } = req.body;
  if (!presetId) {
    return res.status(400).json({ code: 'PRESET_ID_REQUIRED', message: 'presetId is required.' });
  }

  try {
    const result = await createAutomationDraftFromPreset({
      workspace: req.workspace,
      presetId,
      customResponse: responseMessage,
      user: req.user,
    });

    res.status(result.isExisting ? 200 : 201).json({
      message: result.isExisting
        ? 'Automation rule already exists in workspace.'
        : 'Automation draft rule created successfully.',
      rule: result.rule,
      isExisting: result.isExisting,
    });
  } catch (err) {
    if (err instanceof IndustryConfigurationError) {
      return res.status(err.status).json({ code: err.code, message: err.message });
    }
    throw err;
  }
});

/**
 * PUT /api/workspaces/current/industry-preferences
 * Protected: updates workspace-level industry preferences (terminology, columns).
 */
export const updateIndustryPreferences = asyncHandler(async (req, res) => {
  const { preferences } = req.body;
  if (!preferences || typeof preferences !== 'object') {
    return res.status(400).json({
      code: 'INVALID_PREFERENCES',
      message: 'Preferences object is required.',
    });
  }

  try {
    const updatedConfig = await updateWorkspaceIndustryPreferences(req.workspace, preferences);
    res.json({
      message: 'Workspace industry preferences updated successfully.',
      config: updatedConfig,
    });
  } catch (err) {
    if (err instanceof IndustryConfigurationError) {
      return res.status(err.status).json({ code: err.code, message: err.message });
    }
    throw err;
  }
});

/**
 * POST /api/workspaces/current/validate-contact-fields
 * Protected: validates raw dynamic contact fields for the workspace's industry.
 */
export const validateContactFields = asyncHandler(async (req, res) => {
  const { fields } = req.body;
  const industryKey = req.workspace.industryKey || 'other';

  const validation = validateContactIndustryData(fields, industryKey);
  if (!validation.isValid) {
    return res.status(400).json({
      valid: false,
      code: 'INVALID_CONTACT_FIELDS',
      errors: validation.errors,
    });
  }

  res.json({
    valid: true,
    sanitized: validation.sanitized,
  });
});
