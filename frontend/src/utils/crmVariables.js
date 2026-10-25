// Preview substitution only. Catalog definitions and examples arrive from the backend.
export const CRM_TOKEN_REGEX = /{{\s*([a-zA-Z][\w.:-]*)\s*}}/g;
export function extractCrmTokens(text = '') {
  return [...new Set([...String(text).matchAll(CRM_TOKEN_REGEX)].map(match => match[1].trim()))];
}
export function resolveSampleContext(config) {
  return { ...(config?.syntheticDemoContacts?.[0] || {}) };
}
export function resolveCrmVariables(text, contact = {}, workspace = {}, definitions = [], preserveMissing = false) {
  const name = contact.fullName || contact.customer_name || contact.name || '';
  const data = { ...contact.industryData, ...contact };
  for (const [key, value] of Object.entries(contact.industryData || {})) if (data[key] === '' || data[key] == null) data[key] = value;
  const values = {
    ...Object.fromEntries(definitions.map(v => [v.token, v.sampleValue])),
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
    customer_name: name, name, first_name: name.split(/\s+/)[0],
    business_name: workspace.name || workspace.businessName,
    company: workspace.name || workspace.businessName,
    business_phone: workspace.businessPhone,
    business_website: workspace.website,
    business_email: workspace.businessEmail,
    business_address: workspace.address || workspace.settings?.address,
    business_hours: workspace.businessHours || workspace.settings?.businessHours,
    sender_name: workspace.senderName,
    phone: contact.phoneNumber || contact.phone,
  };
  for (const [key, value] of Object.entries(values)) {
    if (value == null || value === '') {
      const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      values[key] = data[key] ?? data[camelKey] ?? definitions.find(v => v.token === key)?.sampleValue;
    }
  }
  return String(text || '').replace(CRM_TOKEN_REGEX, (match, key) => {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    const value = values[key] ?? values[camelKey] ?? contact.customFields?.[key];
    return value === undefined || value === null || value === '' ? (preserveMissing ? match : `[${key.replaceAll('_', ' ')}]`) : String(value);
  });
}

// Operational drafts preserve unresolved tokens for review; never use preview sample values.
export function resolveContactVariables(text, contact = {}, workspace = {}) {
  return resolveCrmVariables(text, contact, workspace, [], true);
}
