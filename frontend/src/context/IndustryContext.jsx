/**
 * Industry Configuration Context
 * Provides workspace-aware industry configuration, terminology, contact field definitions,
 * template presets, and automation presets to the entire shared application.
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useWorkspace } from './WorkspaceContext';
import {
  getWorkspaceIndustryConfig,
  createTemplateDraftFromPreset,
  createAutomationDraftFromPreset,
  updateWorkspaceIndustryPreferences,
  validateContactFields as apiValidateContactFields,
} from '../services/industries';

const IndustryContext = createContext(null);

export function IndustryProvider({ children }) {
  const { currentWorkspace, loading: workspaceLoading } = useWorkspace();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadConfig = useCallback(async () => {
    if (!currentWorkspace) {
      setConfig(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await getWorkspaceIndustryConfig();
      setConfig(data);
    } catch (err) {
      console.error('Failed to load workspace industry configuration:', err);
      setError(err?.response?.data?.message || err.message || 'Failed to load industry configuration.');
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace]);

  useEffect(() => {
    if (!workspaceLoading) {
      loadConfig();
    }
  }, [workspaceLoading, currentWorkspace?._id, currentWorkspace?.industryKey, loadConfig]);

  const installTemplateDraft = useCallback(
    async ({ presetKey, title, body }) => {
      const result = await createTemplateDraftFromPreset({ presetKey, title, body });
      await loadConfig();
      return result;
    },
    [loadConfig]
  );

  const installAutomationDraft = useCallback(
    async ({ presetId, responseMessage }) => {
      const result = await createAutomationDraftFromPreset({ presetId, responseMessage });
      await loadConfig();
      return result;
    },
    [loadConfig]
  );

  const savePreferences = useCallback(
    async (prefs) => {
      const updated = await updateWorkspaceIndustryPreferences(prefs);
      setConfig(updated);
      return updated;
    },
    []
  );

  const validateFields = useCallback(async (fields) => {
    return await apiValidateContactFields(fields);
  }, []);

  const value = useMemo(() => {
    const industryKey = config?.industryKey || currentWorkspace?.industryKey || 'other';
    const terminology = config?.terminology || {
      leadLabel: 'Contact',
      leadPlural: 'Contacts',
      offeringLabel: 'Offering',
      offeringPlural: 'Offerings',
      interestFieldLabel: 'Interest',
      actionLabel: 'Take Action',
    };

    return {
      industryKey,
      config,
      effectiveConfig: config,
      terminology,
      contactFields: config?.contactFields || [],
      fieldDefinitions: config?.contactFields || [],
      displayPreferences: config?.contactDisplayPreferences || { defaultColumns: [] },
      tableColumns: config?.contactDisplayPreferences?.defaultColumns || [],
      filters: config?.contactFilters || [],
      filterDefinitions: config?.contactFilters || [],
      templateSuggestions: config?.templateSuggestions || [],
      automationPresets: config?.automationPresets || [],
      loading: workspaceLoading || loading,
      error,
      refreshIndustryConfig: loadConfig,
      installTemplateDraft,
      installAutomationDraft,
      savePreferences,
      validateFields,
    };
  }, [
    config,
    currentWorkspace?.industryKey,
    workspaceLoading,
    loading,
    error,
    loadConfig,
    installTemplateDraft,
    installAutomationDraft,
    savePreferences,
    validateFields,
  ]);

  return <IndustryContext.Provider value={value}>{children}</IndustryContext.Provider>;
}

export function useIndustryConfig() {
  const context = useContext(IndustryContext);
  if (!context) {
    return {
      industryKey: 'other',
      config: null,
      terminology: {
        leadLabel: 'Contact',
        leadPlural: 'Contacts',
        offeringLabel: 'Offering',
        offeringPlural: 'Offerings',
        interestFieldLabel: 'Interest',
        actionLabel: 'Take Action',
      },
      contactFields: [],
      displayPreferences: { defaultColumns: [] },
      filters: [],
      templateSuggestions: [],
      automationPresets: [],
      loading: false,
      error: null,
      refreshIndustryConfig: () => Promise.resolve(),
      installTemplateDraft: () => Promise.resolve(),
      installAutomationDraft: () => Promise.resolve(),
      savePreferences: () => Promise.resolve(),
      validateFields: () => Promise.resolve({ valid: true, sanitized: {} }),
    };
  }
  return context;
}

export default IndustryContext;
