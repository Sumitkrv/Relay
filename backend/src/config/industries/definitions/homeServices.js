/**
 * Relay SaaS — Industry Pack: Home Services & Repairs
 * Key: home_services
 * Never invents rates, technician arrival times or completed jobs.
 */
import { buildTemplate, buildQuickReply, buildRule, buildOptOutRule, buildCampaignDraft, finalizePack, COMMON_BUSINESS_VARIABLES, baseContactFields } from '../packBuilder.js';

const V = '1.1.0';
const LEAD_STATUSES = ['New', 'Contacted', 'Visit Requested', 'Visit Scheduled', 'Quote Shared', 'Job Completed', 'Closed'];

const TEMPLATES = [
  ['home_welcome', 'Welcome & Service Enquiry', 'Welcome', 'Welcome to {{business_name}}', 'Hello {{customer_name}}, thank you for contacting {{business_name}}. Please tell us what needs fixing or servicing and our team will help you.', 'Greets a new service enquiry.', ['welcome']],
  ['home_service_info', 'Service Information', 'Services', 'About {{service_name}}', 'Hello {{customer_name}}, thanks for asking about {{service_name}}. Our team will share how the service works and what to expect.', 'Explains a requested service.', ['service']],
  ['home_issue_details', 'Request Issue Details', 'Services', '', 'Hello {{customer_name}}, to help us understand the problem, please share a short description and, if possible, a photo of the issue.', 'Collects issue details before a visit.', ['diagnosis']],
  ['home_rate_enquiry', 'Rate Enquiry Acknowledgement', 'Pricing', '', 'Hello {{customer_name}}, thank you for asking about charges for {{service_name}}. Charges depend on the issue and work required; our team will share an estimate after reviewing the details.', 'Acknowledges rate questions without quoting prices.', ['pricing']],
  ['home_quote_shared', 'Estimate Follow-up', 'Pricing', '', 'Hello {{customer_name}}, we are following up on the estimate shared for {{service_name}}. Let us know if you have any questions or would like to proceed.', 'Follows up on an estimate the operator already shared.', ['estimate']],
  ['home_visit_request_ack', 'Visit Request Acknowledgement', 'Visits', 'Visit request received', 'Hello {{customer_name}}, we have received your request for a technician visit. Please share your address and preferred time so we can check availability.', 'Acknowledges a visit request; does not confirm a slot.', ['visit']],
  ['home_visit_confirmation', 'Visit Confirmation', 'Visits', 'Visit confirmed', 'Hello {{customer_name}}, your {{service_name}} visit with {{business_name}} is confirmed for {{visit_date}} at {{visit_time}}.', 'Use only after a visit is genuinely confirmed.', ['visit', 'confirmation']],
  ['home_visit_reminder', 'Visit Reminder', 'Visits', '', 'Hello {{customer_name}}, this is a reminder of your {{service_name}} visit on {{visit_date}} at {{visit_time}}. Reply here if you need to reschedule.', 'Reminder for a confirmed visit.', ['reminder']],
  ['home_technician_on_way', 'Technician Update', 'Visits', '', 'Hello {{customer_name}}, our technician {{technician_name}} is assigned to your visit. We will keep you updated on their arrival.', 'Operator-triggered technician update; no promised ETA.', ['technician']],
  ['home_job_completed', 'Job Completion Follow-up', 'Follow-Up', '', 'Hello {{customer_name}}, thank you for choosing {{business_name}}. Please let us know if everything is working well after our visit.', 'After-service check-in.', ['completion']],
  ['home_emergency_ack', 'Urgent Request Acknowledgement', 'Support', '', 'Hello {{customer_name}}, we have noted that your request is urgent. Our team will review it and contact you as soon as possible.', 'Acknowledges urgent requests without promising response times.', ['urgent']],
  ['home_amc_info', 'Maintenance Plan Information', 'Services', '', 'Hello {{customer_name}}, {{business_name}} can share details of periodic maintenance options for {{service_name}}. Reply YES if you would like the details.', 'Introduces maintenance plans without pricing.', ['maintenance']],
  ['home_service_area', 'Address & Working Hours', 'Business Info', '', 'Hello {{customer_name}}, {{business_name}} is based at {{business_address}}. Our working hours are {{business_hours}}.', 'Configured address and hours only.', ['info']],
  ['home_seasonal_service', 'Seasonal Service Reminder', 'Marketing', '', 'Hello {{customer_name}}, this is a good time to get your {{service_name}} checked. Reply BOOK if you would like {{business_name}} to schedule a visit.', 'Marketing for opted-in customers only.', ['marketing']],
  ['home_feedback_request', 'Feedback Request', 'Feedback', '', 'Hello {{customer_name}}, we would appreciate your feedback on the recent service by {{business_name}}.', 'Post-service feedback.', ['feedback']],
];

const QUICK_REPLIES = [
  ['home_qr_services', 'Services Offered', 'Services', 'Thank you for contacting {{business_name}}. Please tell us the appliance or area that needs service and we will guide you.', 'Asks what needs servicing.'],
  ['home_qr_rates', 'Charges Information', 'Pricing', 'Charges depend on the problem and parts required. Please describe the issue and our team will share an estimate.', 'No invented rates.'],
  ['home_qr_book_visit', 'Book a Visit', 'Visits', 'Please share your address, the issue and your preferred day and time. We will confirm availability with you.', 'Collects visit details.'],
  ['home_qr_photo', 'Share a Photo', 'Services', 'If possible, please send a photo or short video of the issue. It helps our technician come prepared.', 'Requests media of the issue.'],
  ['home_qr_reschedule', 'Reschedule Visit', 'Visits', 'No problem. Please share a new preferred day and time and we will check availability.', 'Reschedule request.'],
  ['home_qr_urgent', 'Urgent Help', 'Support', 'We understand this is urgent. Please share your address and a short description, and our team will contact you as soon as possible.', 'Urgent intake.'],
  ['home_qr_hours', 'Address & Hours', 'Business Info', '{{business_name}} is based at {{business_address}}. Our working hours are {{business_hours}}.', 'Configured details.'],
  ['home_qr_thanks', 'Thank You', 'Support', 'Thank you for choosing {{business_name}}. Reach out anytime if you need help again.', 'Courteous closing.'],
];

const RULES = [
  ['home_auto_services', 'Service Enquiries', ['SERVICE', 'REPAIR', 'FIX', 'INSTALL'], 'Thank you for contacting {{business_name}}. Please tell us what needs service or repair.', 'home_service_info', 'Handles general service enquiries.'],
  ['home_auto_rates', 'Charges Enquiries', ['PRICE', 'CHARGES', 'COST', 'RATE'], 'Charges depend on the issue. Please describe the problem and our team will share an estimate.', 'home_rate_enquiry', 'Collects details before estimating.'],
  ['home_auto_visit', 'Visit Requests', ['VISIT', 'BOOK', 'TECHNICIAN', 'APPOINTMENT'], 'Please share your address and preferred time. We will confirm availability with you; your visit is not booked until we confirm.', 'home_visit_request_ack', 'Visit intake; never auto-confirms.'],
  ['home_auto_urgent', 'Urgent Requests', ['URGENT', 'EMERGENCY', 'LEAK', 'ASAP'], 'We have noted your urgent request. Please share your address and a short description and our team will contact you as soon as possible.', 'home_emergency_ack', 'Flags urgent requests for staff.'],
  ['home_auto_hours', 'Address & Hours', ['ADDRESS', 'LOCATION', 'TIMING', 'HOURS'], '{{business_name}} is based at {{business_address}}. Our working hours are {{business_hours}}.', 'home_service_area', 'Shares configured details.'],
];

const CAMPAIGNS = [
  ['home_camp_enquiry_followup', 'Service Enquiry Follow-up', 'Follow up with customers who enquired about a service but have not booked.', 'Recent service enquiries with valid consent', 'home_quote_shared'],
  ['home_camp_seasonal', 'Seasonal Maintenance Reminder', 'Remind opted-in past customers about periodic servicing.', 'Past customers with valid consent', 'home_seasonal_service'],
];

const homeServices = finalizePack({
  key: 'home_services',
  id: 'home_services',
  name: 'Home Services & Repairs',
  displayLabel: 'Home Services',
  description: 'Service requests, technician visits, estimates and maintenance follow-ups.',
  icon: 'Wrench',
  version: 1,
  packVersion: V,
  status: 'ready',
  terminology: {
    leadLabel: 'Service Request',
    leadPlural: 'Service Requests',
    offeringLabel: 'Service',
    offeringPlural: 'Services',
    interestFieldLabel: 'Service Needed',
    actionLabel: 'Technician Visit',
    categoryLabel: 'Service Category',
  },
  defaultLeadStatuses: LEAD_STATUSES,
  templateCategories: ['Welcome', 'Services', 'Pricing', 'Visits', 'Support', 'Follow-Up', 'Marketing', 'Business Info', 'Feedback'],
  contactFields: baseContactFields([
    { key: 'serviceNeeded', label: 'Service Needed', type: 'text', required: false, filterable: true, showInTable: true, order: 5 },
    { key: 'issueDescription', label: 'Issue Description', type: 'text', required: false, filterable: false, showInTable: false, order: 6 },
    { key: 'serviceAddress', label: 'Service Address', type: 'text', required: false, filterable: false, showInTable: false, order: 7 },
    { key: 'urgency', label: 'Urgency', type: 'select', required: false, filterable: true, showInTable: true, options: ['Normal', 'Soon', 'Urgent'], order: 10 },
    { key: 'preferredVisitTime', label: 'Preferred Visit Time', type: 'select', required: false, filterable: true, showInTable: false, options: ['Morning', 'Afternoon', 'Evening'], order: 11 },
  ], LEAD_STATUSES),
  contactDisplayPreferences: { defaultSort: 'createdAt', tableColumns: ['fullName', 'phoneNumber', 'city', 'serviceNeeded', 'urgency', 'leadStatus', 'whatsappConsentStatus'] },
  contactFilters: ['serviceNeeded', 'urgency', 'leadStatus', 'leadSource', 'whatsappConsentStatus'],
  templateSuggestions: TEMPLATES.map((row, i) => buildTemplate('HOME', V, i, row)),
  quickReplyPresets: QUICK_REPLIES.map(buildQuickReply),
  automationPresets: [...RULES.map((row, i) => buildRule(i + 2, row)), buildOptOutRule('home')],
  sampleCampaignDrafts: CAMPAIGNS.map(buildCampaignDraft),
  supportedVariables: [
    ...COMMON_BUSINESS_VARIABLES,
    { token: 'service_name', label: 'Service Name', sampleValue: 'AC Servicing', category: 'Service', description: 'Requested service' },
    { token: 'visit_date', label: 'Visit Date', sampleValue: 'Friday, 31 Oct', category: 'Scheduling', description: 'Confirmed visit date' },
    { token: 'visit_time', label: 'Visit Time', sampleValue: '11:00 AM', category: 'Scheduling', description: 'Confirmed visit time' },
    { token: 'technician_name', label: 'Technician Name', sampleValue: 'Ramesh', category: 'Business', description: 'Assigned technician' },
  ],
});

export default homeServices;
