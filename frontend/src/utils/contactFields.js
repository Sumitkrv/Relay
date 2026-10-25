// Field definitions and choices are supplied by the authorized industry API.
export const COMMON_CONTACT_FIELDS = new Set(['fullName', 'phoneNumber', 'email', 'city', 'leadSource', 'leadStatus', 'priority', 'notes', 'whatsappConsentStatus']);
export function fieldOptions(field) {
  return (field?.options || []).map(option => typeof option === 'object' ? option : { value: option, label: option });
}
export function readContactField(contact, field) {
  const value = field.isCanonical ? (contact?.[field.key] ?? contact?.industryData?.[field.key]) : (contact?.industryData?.[field.key] ?? contact?.[field.key]);
  if (value === undefined || value === null) return field.type === 'multiselect' ? [] : '';
  return field.type === 'date' ? String(value).slice(0, 10) : value;
}
export function industryFieldPayload(fields, values, contact) {
  const payload = { industryData: {} };
  for (const field of fields) {
    let value = values[field.key];
    // Do not resubmit legacy values merely because the user edited a different field.
    if (contact && JSON.stringify(value) === JSON.stringify(readContactField(contact, field))) continue;
    if (field.type === 'number') value = value === '' ? null : Number(value);
    if (field.type === 'date' && !value) value = null;
    if (field.isCanonical || field.key === 'companyName') payload[field.key] = value;
    else payload.industryData[field.key] = value;
  }
  return payload;
}
