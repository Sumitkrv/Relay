/**
 * Industry Compatibility Adapter
 * Bridges legacy real-estate top-level schema properties with the dynamic industryData engine.
 * Ensures M2W Realty historical records remain intact and bidirectional.
 */

export const REAL_ESTATE_CANONICAL_KEYS = [
  'interestedPropertyType',
  'interestedProject',
  'budgetRange',
  'preferredLocation',
  'preferredContactTime',
  'enquiryDate',
  'siteVisitInterest',
  'preferredVisitDate',
];

/**
 * Extracts effective dynamic fields from a Contact document for frontend representation.
 * For real_estate, reads from canonical top-level fields first, falling back to industryData.
 * For other verticals, reads from contact.industryData.
 */
export function extractContactIndustryFields(contact, industryKey = 'other') {
  if (!contact) return {};

  const existingData = contact.industryData ? { ...contact.industryData } : {};

  if (industryKey === 'real_estate') {
    // Preserve canonical M2W Realty top-level properties
    if (contact.interestedPropertyType && !existingData.interestedPropertyType) {
      existingData.interestedPropertyType = contact.interestedPropertyType;
    }
    if (contact.interestedProject && !existingData.interestedProject) {
      existingData.interestedProject = contact.interestedProject;
    }
    if (contact.budgetRange && !existingData.budgetRange) {
      existingData.budgetRange = contact.budgetRange;
    }
    if (contact.preferredLocation && !existingData.preferredLocation) {
      existingData.preferredLocation = contact.preferredLocation;
    }
    if (contact.preferredContactTime && !existingData.preferredContactTime) {
      existingData.preferredContactTime = contact.preferredContactTime;
    }
    if (contact.enquiryDate && !existingData.enquiryDate) {
      existingData.enquiryDate = contact.enquiryDate;
    }
  }

  return existingData;
}

/**
 * Prepares a contact payload before saving to MongoDB.
 * For real_estate, synchronizes validated fields to canonical top-level fields
 * to maintain backward compatibility with legacy reporting, campaigns, and filters,
 * while also populating industryData.
 */
export function adaptContactPayloadForSave(updatePayload, validatedIndustryData, industryKey = 'other') {
  const result = { ...updatePayload };

  // Always store validated dynamic fields into industryData
  result.industryData = { ...(result.industryData || {}), ...validatedIndustryData };

  if (industryKey === 'real_estate') {
    // Mirror onto top-level fields for M2W Realty backward compatibility
    if (validatedIndustryData.interestedPropertyType !== undefined) {
      result.interestedPropertyType = validatedIndustryData.interestedPropertyType || '';
    }
    if (validatedIndustryData.interestedProject !== undefined) {
      result.interestedProject = validatedIndustryData.interestedProject || '';
    }
    if (validatedIndustryData.budgetRange !== undefined) {
      result.budgetRange = validatedIndustryData.budgetRange || '';
    }
    if (validatedIndustryData.preferredLocation !== undefined) {
      result.preferredLocation = validatedIndustryData.preferredLocation || '';
    }
    if (validatedIndustryData.preferredContactTime !== undefined) {
      result.preferredContactTime = validatedIndustryData.preferredContactTime || '';
    }
    if (validatedIndustryData.enquiryDate !== undefined) {
      result.enquiryDate = validatedIndustryData.enquiryDate;
    }
  }

  return result;
}
