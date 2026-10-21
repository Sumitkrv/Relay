/**
 * Frontend Industry Configuration API Client
 * Wraps public industry metadata and authorized workspace-scoped configuration endpoints.
 */

import api from './api';

/**
 * Fetch public metadata for all 7 supported industries.
 */
export async function getPublicIndustries() {
  const { data } = await api.get('/industries');
  return data.industries || [];
}

/**
 * Fetch public definition of a specific industry by key.
 */
export async function getPublicIndustryByKey(industryKey) {
  const { data } = await api.get(`/industries/${industryKey}`);
  return data.industry;
}

/**
 * Fetch effective industry configuration for the active workspace.
 */
export async function getWorkspaceIndustryConfig() {
  const { data } = await api.get('/workspaces/current/industry-config');
  return data.config;
}

/**
 * Fetch dynamic contact field definitions and table display preferences.
 */
export async function getWorkspaceFieldDefinitions() {
  const { data } = await api.get('/workspaces/current/contact-field-definitions');
  return data;
}

/**
 * Fetch allowed contact filters for the active workspace.
 */
export async function getWorkspaceFilterDefinitions() {
  const { data } = await api.get('/workspaces/current/filter-definitions');
  return data.filters || [];
}

/**
 * Fetch vetted WhatsApp message template suggestions.
 */
export async function getWorkspaceTemplateSuggestions() {
  const { data } = await api.get('/workspaces/current/template-suggestions');
  return data.templateSuggestions || [];
}

/**
 * Fetch keyword automation presets.
 */
export async function getWorkspaceAutomationSuggestions() {
  const { data } = await api.get('/workspaces/current/automation-suggestions');
  return data.automationPresets || [];
}

/**
 * Create an authorized, inactive MessageTemplate draft from an industry preset.
 */
export async function createTemplateDraftFromPreset({ presetKey, title, body }) {
  const { data } = await api.post('/workspaces/current/template-draft', {
    presetKey,
    title,
    body,
  });
  return data;
}

/**
 * Create an authorized, inactive AutoReplyRule draft from a keyword preset.
 */
export async function createAutomationDraftFromPreset({ presetId, responseMessage }) {
  const { data } = await api.post('/workspaces/current/automation-draft', {
    presetId,
    responseMessage,
  });
  return data;
}

/**
 * Update workspace-level industry preferences (custom terminology, visible columns).
 */
export async function updateWorkspaceIndustryPreferences(preferences) {
  const { data } = await api.put('/workspaces/current/industry-preferences', {
    preferences,
  });
  return data.config;
}

/**
 * Validate raw contact fields against active industry constraints.
 */
export async function validateContactFields(fields) {
  const { data } = await api.post('/workspaces/current/validate-contact-fields', {
    fields,
  });
  return data;
}

// Aliases for unified naming conventions
export async function getPublicIndustry(key) {
  return getPublicIndustryByKey(key);
}

export async function getWorkspaceContactFieldDefinitions() {
  return getWorkspaceFieldDefinitions();
}

export async function createWorkspaceTemplateDraft(args) {
  return createTemplateDraftFromPreset(args);
}

export async function createWorkspaceAutomationDraft(args) {
  return createAutomationDraftFromPreset(args);
}

export async function validateWorkspaceDynamicFields(fields) {
  return validateContactFields(fields);
}
