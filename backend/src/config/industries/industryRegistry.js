/**
 * Central Industry Registry
 * Authoritative, immutable repository of all supported Relay industry definitions.
 * Validates all schemas at module load time.
 */

import { validateIndustryDefinition } from './industrySchema.js';
import { ALL_INDUSTRY_DEFINITIONS } from './definitions/index.js';

class IndustryRegistry {
  constructor() {
    this._registry = new Map();
    this._initialize();
  }

  _initialize() {
    for (const def of ALL_INDUSTRY_DEFINITIONS) {
      // Validate definition schema integrity
      validateIndustryDefinition(def);
      // Store deep-frozen structured clone to guarantee registry immutability
      const cloned = JSON.parse(JSON.stringify(def));
      Object.freeze(cloned);
      this._registry.set(def.key, cloned);
    }
  }

  /**
   * Checks whether an industry key is recognized.
   */
  isValidIndustry(key) {
    if (!key || typeof key !== 'string') return false;
    return this._registry.has(key.toLowerCase().trim());
  }

  /**
   * Returns list of all registered industry keys.
   */
  getRegisteredKeys() {
    return Array.from(this._registry.keys());
  }

  /**
   * Resolves an industry definition by key.
   * Throws a precise Error if the key is unknown.
   */
  getIndustryDefinition(key) {
    if (!key || typeof key !== 'string') {
      throw new Error(`Invalid industry key: key must be a non-empty string.`);
    }
    const normalizedKey = key.toLowerCase().trim();
    const def = this._registry.get(normalizedKey);
    if (!def) {
      throw new Error(
        `Unknown industry key "${key}". Supported industries: ${this.getRegisteredKeys().join(', ')}`
      );
    }
    // Return a fresh clone so consumers cannot mutate cached registry data
    return JSON.parse(JSON.stringify(def));
  }

  /**
   * Returns client-safe public marketing metadata for all industries.
   */
  getPublicIndustryMetadata() {
    return Array.from(this._registry.values()).map((def) => ({
      key: def.key,
      name: def.name,
      description: def.description,
      icon: def.icon,
      version: def.version,
      defaultLocale: def.defaultLocale,
      featureAvailability: { ...def.featureAvailability },
      terminology: { ...def.terminology },
    }));
  }

  /**
   * Returns contact field definitions for a specific industry.
   */
  getIndustryContactFields(key) {
    const def = this.getIndustryDefinition(key);
    return def.contactFields || [];
  }

  /**
   * Returns contact display preferences for a specific industry.
   */
  getIndustryDisplayPreferences(key) {
    const def = this.getIndustryDefinition(key);
    return def.contactDisplayPreferences || { defaultColumns: [] };
  }

  /**
   * Returns contact filter definitions for an industry.
   */
  getIndustryFilters(key) {
    const def = this.getIndustryDefinition(key);
    return def.contactFilters || [];
  }

  /**
   * Returns template suggestions for an industry.
   */
  getIndustryTemplateSuggestions(key) {
    const def = this.getIndustryDefinition(key);
    return def.templateSuggestions || [];
  }

  /**
   * Returns keyword automation presets for an industry.
   */
  getIndustryAutomationPresets(key) {
    const def = this.getIndustryDefinition(key);
    return def.automationPresets || [];
  }

  /**
   * Returns terminology definitions for an industry.
   */
  getIndustryTerminology(key) {
    const def = this.getIndustryDefinition(key);
    return def.terminology || {};
  }
}

// Export singleton instance
export const industryRegistry = new IndustryRegistry();
export default industryRegistry;
