import { getAllIndustryConfigs } from '../config/industries/industryRegistry.js';
const CORE = new Set([
  'name', 'first_name', 'last_name', 'customer_name',
  'company', 'company_name', 'business_category', 'designation', 'service', 'industry',
  'city', 'location', 'website', 'business_website', 'email', 'phone', 'sender_name',
  'business_name', 'business_phone',
  'property_type', 'interested_property_type', 'property_interest',
  'project', 'interested_project', 'project_name',
  'preferred_location',
  'budget', 'budget_range',
  'membership_type', 'membership_plan', 'fitness_program', 'fitness_goal', 'trial_session_interest', 'trial_date',
  'service_category', 'service_name', 'service_interest', 'enquiry_type',
  'preferred_enquiry_time', 'appointment_date', 'site_visit_date', 'test_drive_date',
  'branch', 'branch_name', 'course_name', 'batch_date', 'vehicle_model',
  'meeting_date', 'meeting_time', 'consultation_mode', 'representative_name', 'business_email',
  'product_name', 'business_address', 'business_hours'
]);
for (const config of getAllIndustryConfigs()) for (const variable of config.supportedVariables || []) CORE.add(variable.token);
const TOKEN_RE = /{{\s*([a-zA-Z][a-zA-Z0-9_.: -]{0,63}?)\s*}}/g;
export function valuesFor(input = {}, user = {}) {
  const source = input?.toObject ? input.toObject() : input;
  const contact = { ...source?.industryData, ...source };
  // Canonical fields take precedence, but empty legacy fields must not mask saved industry data.
  for (const [key, value] of Object.entries(source?.industryData || {})) {
    if (contact[key] === '' || contact[key] == null) contact[key] = value;
  }
  const dynamic = Object.fromEntries(Object.entries(contact).map(([key, value]) => [key.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`), value]));
  const aliases = {
  name: contact.fullName || '',
  customer_name: contact.fullName || '',
  first_name: String(contact.fullName || '').trim().split(/\s+/)[0] || '',
  last_name: String(contact.fullName || '').trim().split(/\s+/).slice(1).join(' '),
  company: contact.companyName || user.businessName || user.workspaceName || user.name || '',
  company_name: contact.companyName || '',
  business_category: contact.businessCategory || '',
  designation: contact.designation || '',
  service: contact.serviceName || contact.interestedService || contact.interestedPropertyType || contact.serviceCategory || contact.serviceInterest || '',
  service_name: contact.serviceName || contact.service || contact.interestedService || contact.serviceCategory || contact.serviceInterest || '',
  service_interest: contact.serviceInterest || contact.interestedService || '',
  enquiry_type: contact.enquiryType || '',
  industry: contact.industry || '',
  city: contact.city || contact.location || '',
  location: contact.location || contact.city || '',
  website: contact.website || user.website || '',
  business_website: user.website || '',
  email: contact.email || '',
  phone: contact.phoneNumber || '',
  sender_name: user.name || '',
  business_name: user.businessName || user.workspaceName || user.name || '',
  business_phone: user.businessPhone || user.phone || '',
  property_type: contact.interestedPropertyType || contact.propertyType || contact.interestedService || '',
  interested_property_type: contact.interestedPropertyType || contact.propertyType || contact.interestedService || '',
  property_interest: contact.propertyInterest || contact.interestedPropertyType || contact.interestedService || '',
  project: contact.interestedProject || contact.projectName || contact.businessCategory || '',
  interested_project: contact.interestedProject || contact.projectName || contact.businessCategory || '',
  project_name: contact.interestedProject || contact.projectName || contact.businessCategory || '',
  preferred_location: contact.preferredLocation || contact.location || '',
  budget: contact.budgetRange || contact.budget || (contact.estimatedDealValue ? `₹${Number(contact.estimatedDealValue).toLocaleString()}` : ''),
  budget_range: contact.budgetRange || contact.budget || (contact.estimatedDealValue ? `₹${Number(contact.estimatedDealValue).toLocaleString()}` : ''),
  membership_type: contact.membershipType || contact.membershipPlan || contact.interestedService || '',
  membership_plan: contact.membershipPlan || contact.membershipType || '',
  fitness_program: contact.fitnessProgram || contact.interestedService || '',
  fitness_goal: contact.fitnessGoal || contact.fitnessProgram || '',
  trial_session_interest: contact.trialSessionInterest || '',
  trial_date: contact.trialDate || contact.preferredJoiningDate || '',
  service_category: contact.serviceCategory || contact.interestedService || '',
  preferred_enquiry_time: contact.preferredEnquiryTime || '',
  appointment_date: contact.appointmentDate || contact.preferredEnquiryDate || contact.appointmentRequestDate || contact.preferredEnquiryTime || '',
  site_visit_date: contact.industryData?.siteVisitDate || contact.siteVisitDate || contact.preferredContactTime || '',
  test_drive_date: contact.testDriveDate || contact.preferredContactTime || '',
  branch: contact.branch || contact.branchName || '',
  branch_name: contact.branchName || contact.branch || contact.preferredLocation || '',
  course_name: contact.courseName || contact.courseInterest || '',
  batch_date: contact.batchDate || contact.preferredBatchDate || '',
  vehicle_model: contact.vehicleModel || contact.modelInterest || '',
  meeting_date: contact.industryData?.meetingDate ? new Date(contact.industryData.meetingDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : (contact.meetingDate || contact.appointmentDate || ''),
  meeting_time: contact.industryData?.meetingTime || contact.meetingTime || contact.preferredEnquiryTime || '',
  consultation_mode: contact.industryData?.meetingMode || contact.meetingMode || '',
  representative_name: contact.representativeName || user.name || user.senderName || '',
  business_email: user.businessEmail || user.email || '',
  product_name: contact.productName || contact.productServiceInterest || contact.interestedService || '',
  business_address: user.businessAddress || user.address || '',
  business_hours: user.businessHours || '',
  };
  return { ...dynamic, ...Object.fromEntries(Object.entries(aliases).filter(([, value]) => value !== '' && value != null)), ...(contact.customFields || {}) };
}

export function extractVariables(text = '') { return [...new Set([...String(text).matchAll(TOKEN_RE)].map(m => m[1].trim()))]; }
export function malformedVariables(text = '') {
  const stripped = String(text).replace(TOKEN_RE, '');
  return /{{|}}/.test(stripped);
}
export function resolveTemplate(template, contact = {}, user = {}) {
  const values = valuesFor(contact, user);
  const fields = ['header','body','footer'];
  const missing = new Set();
  const fallbackUsed = new Set();
  const rendered = Object.fromEntries(fields.map(field => [field, String(template[field] || '').replace(TOKEN_RE, (_token, key) => {
    key=key.trim(); const customKey = key.startsWith('custom:') || key.startsWith('custom.') ? key.slice(7) : null;
    const raw = customKey ? contact.customFields?.[customKey] : values[key];
    let value = raw == null || typeof raw === 'object' ? '' : String(raw).trim();
    if (!value) { const fallback=template.fallbackValues?.[key]; if(typeof fallback==='string'&&fallback.trim()){value=fallback.trim();fallbackUsed.add(key);}else missing.add(key); }
    return value;
  })]));
  const variables = [...new Set([...fields.flatMap(f => extractVariables(template[f] || '')),...(template.buttons||[]).flatMap(b=>[...extractVariables(b.text||''),...extractVariables(b.value||'')])])];
  const buttons=(template.buttons||[]).map(button=>({...button,text:String(button.text||'').replace(TOKEN_RE,(_token,key)=>{key=key.trim();const value=key.startsWith('custom:')||key.startsWith('custom.')?contact.customFields?.[key.slice(7)]:values[key];if(value==null||String(value).trim()===''){missing.add(key);return '';}return String(value);}),value:String(button.value||'').replace(TOKEN_RE,(_token,key)=>{key=key.trim();const value=key.startsWith('custom:')||key.startsWith('custom.')?contact.customFields?.[key.slice(7)]:values[key];if(value==null||String(value).trim()===''){missing.add(key);return '';}return String(value);})}));
  return { ...rendered, buttons, variables, missingVariables: [...missing], fallbackVariables:[...fallbackUsed], valid: missing.size === 0 && !!rendered.body.trim(), contact: { id: String(contact._id), name: contact.fullName, company: contact.companyName || '', businessCategory:contact.businessCategory||'', phone:contact.phoneNumber||'' } };
}
export function validateTemplate(template = {}) {
  const errors = [], warnings = [];
  const text = [template.header, template.body, template.footer,...(template.buttons||[]).flatMap(b=>[b.text,b.value])].filter(Boolean).join('\n');
  if (!String(template.body || '').trim()) errors.push('Message body is required.');
  if (malformedVariables(text)) errors.push('Variable syntax is malformed. Use {{variable_name}}.');
  if (String(template.body || '').length > 1024) warnings.push('Body is longer than 1,024 characters.');
  
  const hType = (template.headerType && template.headerType !== 'NONE') ? template.headerType : (template.header ? 'TEXT' : 'NONE');
  if (hType === 'TEXT' && String(template.header || '').length > 60) {
    errors.push('Header text must be 60 characters or fewer.');
  }
  if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(hType)) {
    if (!template.headerMediaUrl && !template.headerMediaId) {
      warnings.push(`Header type is ${hType}, but no media asset has been uploaded or attached yet.`);
    }
  }

  if(extractVariables(template.footer||'').length)errors.push('Footer text cannot contain variables in the supported Meta template structure.');
  const vars = extractVariables(text);
  for (const v of vars) if (!CORE.has(v) && !/^custom[.:][a-zA-Z0-9 _-]{1,50}$/.test(v)) errors.push(`{{${v}}} is not a supported variable. Use an approved field or {{custom.field_name}}.`); else if(v.startsWith('custom'))warnings.push(`{{${v}}} is a custom field; confirm it exists on your contacts.`);
  if (template.category === 'Utility' && /\b(offer|discount|deal|introduc(?:e|ing)|services?|promot(?:e|ion)|book a call|sales)\b/i.test(text)) warnings.push('This wording may be promotional; Marketing is normally the appropriate category. Category review does not guarantee Meta approval.');
  const buttons = Array.isArray(template.buttons) ? template.buttons : [];
  if (buttons.some(b => !['QUICK_REPLY','URL','PHONE_NUMBER'].includes(b.type))) errors.push('A button type is not supported.');
  const quickReplies=buttons.filter(b=>b.type==='QUICK_REPLY'),ctas=buttons.filter(b=>b.type==='URL'||b.type==='PHONE_NUMBER');
  if(quickReplies.length>3)errors.push('Configure up to 3 quick-reply buttons.');
  if(ctas.length>2)errors.push('Configure up to 2 call-to-action buttons.');
  if(quickReplies.length&&ctas.length)errors.push('Use quick-reply buttons or call-to-action buttons in one template, not a mixture.');
  if(new Set(ctas.map(b=>b.type)).size!==ctas.length)errors.push('Use at most one URL button and one phone call button.');
  if (buttons.some(b => !String(b.text || '').trim() || String(b.text).length > 25)) errors.push('Button labels must contain 1 to 25 characters.');
  for (const b of buttons) {
    if (b.type === 'URL' && !/^https:\/\//i.test(b.value || '')) errors.push('URL buttons require an HTTPS URL.');
    if (b.type === 'URL' && /^https:\/\//i.test(b.value||'')){try{const u=new URL(b.value);if(u.protocol!=='https:'||!u.hostname)throw new Error();}catch{errors.push('URL buttons require a valid HTTPS URL.');}}
    if (b.type === 'PHONE_NUMBER' && !/^\+[1-9]\d{7,14}$/.test(b.value || '')) errors.push('Phone buttons require an international E.164 number.');
  }
  return { errors, warnings, variables: vars, valid: errors.length === 0 };
}
export function buildMetaStructure(template = {}) {
  const components = [];
  const mappings = { header: [], body: [], buttons: [] };
  
  const hType = (template.headerType && template.headerType !== 'NONE') ? template.headerType : (template.header ? 'TEXT' : 'NONE');
  if (hType === 'TEXT' && template.header) {
    const text = String(template.header || '');
    let parameter = 0;
    mappings.header = [...text.matchAll(TOKEN_RE)].map(match=>({ variable:match[1].trim(), parameter:++parameter }));
    parameter = 0;
    components.push({ type: 'HEADER', format: 'TEXT', text: text.replace(TOKEN_RE, () => `{{${++parameter}}}`) });
  } else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(hType)) {
    components.push({
      type: 'HEADER',
      format: hType,
      example: { header_handle: [template.headerMediaUrl || ''] }
    });
  }

  const bodyText = String(template.body || '');
  let bodyParam = 0;
  mappings.body = [...bodyText.matchAll(TOKEN_RE)].map(match=>({ variable:match[1].trim(), parameter:++bodyParam }));
  bodyParam = 0;
  if (bodyText) {
    components.push({ type: 'BODY', text: bodyText.replace(TOKEN_RE, () => `{{${++bodyParam}}}`) });
  }

  if (template.footer) components.push({ type: 'FOOTER', text: template.footer });
  if (template.buttons?.length) {let parameter=0;const buttons=template.buttons.map((button,index)=>{const mapped=String(button.value||'').replace(TOKEN_RE,(_match,variable)=>{variable=variable.trim();const n=++parameter;mappings.buttons.push({buttonIndex:index,variable,parameter:n});return `{{${n}}}`;});return button.type==='QUICK_REPLY'?{type:'QUICK_REPLY',text:button.text}:{type:button.type==='URL'?'URL':'PHONE_NUMBER',text:button.text,[button.type==='URL'?'url':'phone_number']:mapped};});components.push({ type: 'BUTTONS', buttons });}
  return { mappings, structure: { name: template.metaTemplateName || '', language: template.metaLanguage || template.language || 'en', category: template.category, components } };
}
