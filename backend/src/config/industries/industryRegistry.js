/**
 * Central Authoritative Industry Registry for Relay Multi-Industry SaaS
 * Key Architecture: Phase 1 Universal Industry Starter Pack System
 * 
 * Supports:
 * - 13 Target Industry Identifiers
 * - Complete Real Estate Starter Pack (15 templates, 8 quick replies, 5 rules, 2 campaigns, 14 fields)
 * - Metadata & Planned status for other industries without inventing incomplete packs
 * - Backward compatibility with active demo suites
 */

import { validateIndustryDefinition } from './industrySchema.js';
import { buildIndustryPresentation } from './industryPresentation.js';
import realEstate from './definitions/realEstate.js';
import gym from './definitions/gym.js';
import clinic from './definitions/clinic.js';
import education from './definitions/education.js';
import salon from './definitions/salon.js';
import automobile from './definitions/automobile.js';
import travel from './definitions/travel.js';
import restaurant from './definitions/restaurant.js';
import professionalServices from './definitions/professionalServices.js';
import genericBusiness from './definitions/genericBusiness.js';
import ecommerceRetail from './definitions/ecommerceRetail.js';
import homeServices from './definitions/homeServices.js';
import hospitality from './definitions/hospitality.js';
import other from './definitions/other.js';

// The 11 active loaded packs for existing offline demo regression suites
export const VALID_INDUSTRY_KEYS = [
  'real_estate',
  'gym',
  'clinic',
  'education',
  'salon',
  'automobile',
  'travel_tourism',
  'restaurant_food',
  'professional_services',
  'generic_business',
  'ecommerce_retail',
  'home_services',
  'hospitality',
  'other',
];

// TASK 2: 13 Initial Industry Identifiers
export const TARGET_INDUSTRY_IDENTIFIERS = [
  'real_estate',
  'education_coaching',
  'gym_fitness',
  'clinic_dental',
  'salon_beauty',
  'automobile',
  'travel_tourism',
  'ecommerce_retail',
  'restaurant_food',
  'home_services',
  'hospitality',
  'professional_services',
  'generic_business',
];

// Reusable Industry Starter Pack Catalog
export const SUPPORTED_INDUSTRY_CATALOG = [
  {
    id: 'real_estate',
    name: 'Real Estate & Housing',
    displayLabel: 'Real Estate',
    description: 'Properties, project enquiries, floor plans, and automated site visit booking.',
    icon: 'Building2',
    status: 'ready',
    packVersion: '1.1.0',
    hasCompletePack: true,
  },
  {
    id: 'education_coaching',
    name: 'Education & Coaching',
    displayLabel: 'Education & Coaching',
    description: 'Course admissions, batch schedules, entrance exam prep, and student counselling.',
    icon: 'GraduationCap',
    status: 'ready',
    packVersion: '1.1.0',
    aliasOf: 'education',
    hasCompletePack: true,
  },
  {
    id: 'gym_fitness',
    name: 'Gym & Fitness Centers',
    displayLabel: 'Gym / Fitness',
    description: 'Membership plans, trial sessions, personal training, and workout reminders.',
    icon: 'Dumbbell',
    status: 'ready',
    packVersion: '1.1.0',
    aliasOf: 'gym',
    hasCompletePack: true,
  },
  {
    id: 'clinic_dental',
    name: 'Healthcare, Clinic & Dental',
    displayLabel: 'Clinic / Healthcare',
    description: 'Consultation scheduling, clinic hours, directions, and visit confirmations.',
    icon: 'Stethoscope',
    status: 'ready',
    packVersion: '1.1.0',
    aliasOf: 'clinic',
    hasCompletePack: true,
  },
  {
    id: 'salon_beauty',
    name: 'Salon, Spa & Beauty',
    displayLabel: 'Salon & Spa',
    description: 'Service menus, appointment scheduling, styling consultations, and reminders.',
    icon: 'Sparkles',
    status: 'ready',
    packVersion: '1.1.0',
    aliasOf: 'salon',
    hasCompletePack: true,
  },
  {
    id: 'automobile',
    name: 'Automobile Dealerships & Service',
    displayLabel: 'Automobile',
    description: 'Test drive scheduling, service bookings, vehicle quotes, and maintenance alerts.',
    icon: 'Car',
    status: 'ready',
    packVersion: '1.1.0',
    aliasOf: 'automobile',
    hasCompletePack: true,
  },
  {
    id: 'travel_tourism',
    name: 'Travel & Tourism',
    displayLabel: 'Travel & Tourism',
    description: 'Tour packages, itinerary requests, visa guidance, and holiday booking replies.',
    icon: 'Plane',
    status: 'ready',
    packVersion: '1.1.0',
    hasCompletePack: true,
  },
  {
    id: 'ecommerce_retail',
    name: 'E-commerce & Retail',
    displayLabel: 'E-commerce & Retail',
    description: 'Order tracking, product inquiries, catalog browsing, and return policies.',
    icon: 'ShoppingBag',
    status: 'ready',
    packVersion: '1.1.0',
    hasCompletePack: true,
  },
  {
    id: 'restaurant_food',
    name: 'Restaurants & Food',
    displayLabel: 'Restaurants & Food',
    description: 'Table reservations, menu exploration, catering inquiries, order requests, and restaurant operating hours.',
    icon: 'Utensils',
    status: 'ready',
    packVersion: '1.1.0',
    hasCompletePack: true,
  },
  {
    id: 'home_services',
    name: 'Home Services & Repairs',
    displayLabel: 'Home Services',
    description: 'Service requests, technician visits, rate cards, and emergency support.',
    icon: 'Wrench',
    status: 'ready',
    packVersion: '1.1.0',
    hasCompletePack: true,
  },
  {
    id: 'hospitality',
    name: 'Hotels & Hospitality',
    displayLabel: 'Hospitality',
    description: 'Room reservations, banquet inquiries, check-in information, and guest support.',
    icon: 'Hotel',
    status: 'ready',
    packVersion: '1.1.0',
    hasCompletePack: true,
  },
  {
    id: 'professional_services',
    name: 'Professional & Legal Services',
    displayLabel: 'Professional Services',
    description: 'Client consultations, fee structures, appointment intake, and legal advisory.',
    icon: 'Briefcase',
    status: 'ready',
    packVersion: '1.1.0',
    hasCompletePack: true,
  },
  {
    id: 'generic_business',
    name: 'Generic Business & Services',
    displayLabel: 'Generic Business',
    description: 'General enquiries, product/service information, quotations, working hours, and customer follow-up templates.',
    icon: 'Briefcase',
    status: 'ready',
    packVersion: '1.1.0',
    hasCompletePack: true,
  },
];

const ALIAS_MAP = {
  education_coaching: 'education',
  gym_fitness: 'gym',
  fitness: 'gym',
  clinic_dental: 'clinic',
  healthcare: 'clinic',
  salon_beauty: 'salon',
  beauty: 'salon',
  spa: 'salon',
  dealership: 'automobile',
  dealerships: 'automobile',
  auto: 'automobile',
  travel: 'travel_tourism',
  tourism: 'travel_tourism',
  tours: 'travel_tourism',
  holidays: 'travel_tourism',
  travel_agency: 'travel_tourism',
  restaurants_food: 'restaurant_food',
  restaurant_food: 'restaurant_food',
  restaurant: 'restaurant_food',
  restaurants: 'restaurant_food',
  food: 'restaurant_food',
  cafe: 'restaurant_food',
  catering: 'restaurant_food',
  bakery: 'restaurant_food',
  cloud_kitchen: 'restaurant_food',
  food_beverage: 'restaurant_food',
  professional_services: 'professional_services',
  professional: 'professional_services',
  legal: 'professional_services',
  consulting: 'professional_services',
  accounting: 'professional_services',
  agency: 'professional_services',
  ca_firm: 'professional_services',
  law_firm: 'professional_services',
  tax_consultant: 'professional_services',
  generic_business: 'generic_business',
  generic: 'generic_business',
  general: 'generic_business',
  general_business: 'generic_business',
  standard: 'generic_business',
  default: 'generic_business',
  misc: 'generic_business',
  commercial: 'generic_business',
  other: 'generic_business',
  ecommerce_retail: 'ecommerce_retail',
  ecommerce: 'ecommerce_retail',
  e_commerce: 'ecommerce_retail',
  retail: 'ecommerce_retail',
  online_store: 'ecommerce_retail',
  home_services: 'home_services',
  home_service: 'home_services',
  repairs: 'home_services',
  home_repairs: 'home_services',
  hospitality: 'hospitality',
  hotels_hospitality: 'hospitality',
  hotel: 'hospitality',
  hotels: 'hospitality',
};

const registry = new Map();

// Validate and register all core active industries at startup
const rawDefinitions = [realEstate, gym, clinic, education, salon, automobile, travel, restaurant, professionalServices, genericBusiness, ecommerceRetail, homeServices, hospitality, other];

rawDefinitions.forEach((def) => {
  validateIndustryDefinition(def);
  // Older packs name the same catalog personalizationVariables/sample.
  const normalized = {
    ...def,
    supportedVariables: (def.supportedVariables || def.personalizationVariables || []).map(variable => ({
      ...variable, sampleValue: variable.sampleValue ?? variable.sample ?? '',
      category: variable.category || 'Personalization',
    })),
  };
  const frozen = Object.freeze(JSON.parse(JSON.stringify({ ...normalized, ui: buildIndustryPresentation(normalized) })));
  registry.set(def.key, frozen);
  if (def.key === 'restaurant_food') {
    registry.set('restaurants_food', frozen);
  }
  if (def.key === 'professional_services') {
    registry.set('professional', frozen);
  }
  if (def.key === 'generic_business') {
    registry.set('other', frozen);
    registry.set('generic', frozen);
  }
});

function normalizeIndustryKey(rawKey) {
  const norm = String(rawKey || '').trim().toLowerCase();
  if (norm in ALIAS_MAP) {
    return ALIAS_MAP[norm];
  }
  return norm;
}

/**
 * Returns the immutable industry configuration for a given key.
 * If key is unrecognized or missing, returns the generic 'generic_business' configuration.
 * Supports aliases: 'education_coaching' -> 'education', 'other' -> 'generic_business', etc.
 */
export function getIndustryConfig(industryKey) {
  const key = normalizeIndustryKey(industryKey);
  if (registry.has(key)) {
    return registry.get(key);
  }
  return registry.get('generic_business') || registry.get('other');
}

/**
 * Strict resolver: returns null if the key is not one of the registered configurations.
 */
export function getStrictIndustryConfig(industryKey) {
  const key = normalizeIndustryKey(industryKey);
  if (registry.has(key)) {
    return registry.get(key);
  }
  return null;
}

/**
 * Returns all 7 full industry configurations.
 */
export function getAllIndustryConfigs() {
  return VALID_INDUSTRY_KEYS.map((k) => registry.get(k));
}

/**
 * Returns the full 13-industry catalog with pack status and readiness.
 */
export function getAllSupportedIndustries() {
  return SUPPORTED_INDUSTRY_CATALOG;
}

/**
 * Returns public-safe marketing summaries for all industries.
 */
export function getPublicIndustrySummaries() {
  return TARGET_INDUSTRY_IDENTIFIERS.map((k) => {
    const item = getStrictIndustryConfig(k);
    return {
      key: item.key,
      name: item.name,
      displayLabel: item.displayLabel || item.name,
      description: item.description,
      icon: item.icon,
      version: item.version,
      packVersion: item.packVersion || '1.0.0',
      status: item.status || 'ready',
      terminology: item.terminology,
      templateCount: (item.templateSuggestions || item.starterTemplatePack || []).length,
      automationCount: (item.automationPresets || item.keywordAutoReplyPack || []).length,
      quickReplyCount: (item.quickReplyPresets || item.quickReplyPack || []).length,
      aliases: Object.entries(ALIAS_MAP).filter(([, canonical]) => canonical === item.key).map(([alias]) => alias),
    };
  });
}

export default {
  VALID_INDUSTRY_KEYS,
  TARGET_INDUSTRY_IDENTIFIERS,
  SUPPORTED_INDUSTRY_CATALOG,
  getIndustryConfig,
  getStrictIndustryConfig,
  getAllIndustryConfigs,
  getAllSupportedIndustries,
  getPublicIndustrySummaries,
};
