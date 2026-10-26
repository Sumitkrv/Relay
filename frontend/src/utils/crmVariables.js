// Preview substitution only. Catalog definitions and examples arrive from the backend.
export const CRM_TOKEN_REGEX = /{{\s*([a-zA-Z][\w.:-]*)\s*}}/g;
export function extractCrmTokens(text = '') {
  return [...new Set([...String(text).matchAll(CRM_TOKEN_REGEX)].map(match => match[1].trim()))];
}
export function resolveSampleContext(config) {
  return { ...(config?.syntheticDemoContacts?.[0] || {}) };
}
export function resolveCrmVariables(text, contact = {}, workspace = {}, definitions = [], preserveMissing = false) {
  const safeContact = contact || {};
  const safeWorkspace = workspace || {};
  const safeDefs = Array.isArray(definitions) ? definitions : [];
  const name = safeContact.fullName || safeContact.customer_name || safeContact.name || '';
  const industryData = (safeContact.industryData && typeof safeContact.industryData === 'object') ? safeContact.industryData : {};
  const data = { ...industryData, ...safeContact };
  for (const [key, value] of Object.entries(industryData)) {
    if (data[key] === '' || data[key] == null) data[key] = value;
  }
  const values = {
    ...Object.fromEntries(safeDefs.map(v => [v?.token, v?.sampleValue]).filter(([k]) => k)),
    ...data,
    property_type: data.interestedPropertyType || data.propertyType || data.interestedService,
    project: data.interestedProject || data.projectName || data.businessCategory,
    project_name: data.interestedProject || data.projectName || data.businessCategory,
    service_name: data.service_name || data.serviceName || data.interestedService,
    membership_type: data.membershipType || data.membershipPlan,
    course_name: data.courseName || data.courseInterest,
    vehicle_model: data.vehicleModel || data.modelInterest,
    consultation_mode: data.meetingMode,
    budget: data.budgetRange || data.budget,
    customer_name: name, name, first_name: name ? name.split(/\s+/)[0] : '',
    business_name: safeWorkspace.name || safeWorkspace.businessName,
    company: safeWorkspace.name || safeWorkspace.businessName,
    business_phone: safeWorkspace.businessPhone,
    business_website: safeWorkspace.website,
    business_email: safeWorkspace.businessEmail,
    business_address: safeWorkspace.address || safeWorkspace.settings?.address,
    business_hours: safeWorkspace.businessHours || safeWorkspace.settings?.businessHours,
    sender_name: safeWorkspace.senderName,
    phone: safeContact.phoneNumber || safeContact.phone,
  };
  for (const [key, value] of Object.entries(values)) {
    if (value == null || value === '') {
      const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      values[key] = data[key] ?? data[camelKey] ?? safeDefs.find(v => v?.token === key)?.sampleValue;
    }
  }
  return String(text || '').replace(CRM_TOKEN_REGEX, (match, key) => {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    const value = values[key] ?? values[camelKey] ?? safeContact.customFields?.[key];
    return value === undefined || value === null || value === '' ? (preserveMissing ? match : `[${key.replaceAll('_', ' ')}]`) : String(value);
  });
}

// Operational drafts preserve unresolved tokens for review; never use preview sample values.
export function resolveContactVariables(text, contact = {}, workspace = {}) {
  return resolveCrmVariables(text, contact || {}, workspace || {}, [], true);
}
