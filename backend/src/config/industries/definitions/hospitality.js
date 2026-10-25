/**
 * Relay SaaS — Industry Pack: Hotels & Hospitality
 * Key: hospitality
 * Never invents room rates, availability or confirmed reservations.
 */
import { buildTemplate, buildQuickReply, buildRule, buildOptOutRule, buildCampaignDraft, finalizePack, COMMON_BUSINESS_VARIABLES, baseContactFields } from '../packBuilder.js';

const V = '1.1.0';
const LEAD_STATUSES = ['New', 'Enquiry', 'Availability Shared', 'Reservation Requested', 'Confirmed', 'Checked Out', 'Closed'];

const TEMPLATES = [
  ['hotel_welcome', 'Welcome & Stay Enquiry', 'Welcome', 'Welcome to {{business_name}}', 'Hello {{customer_name}}, thank you for contacting {{business_name}}. Please share your travel dates and number of guests so we can help with your stay.', 'Greets a new stay enquiry.', ['welcome']],
  ['hotel_room_info', 'Room Types Information', 'Rooms', '', 'Hello {{customer_name}}, thank you for your interest in staying with {{business_name}}. Our team will share details of the room types that suit your requirements.', 'Room information without rates.', ['rooms']],
  ['hotel_availability_check', 'Availability Check', 'Reservations', 'Checking availability', 'Hello {{customer_name}}, we are checking availability for {{check_in_date}} to {{check_out_date}} for {{guest_count}} guests. We will update you shortly.', 'Confirms a check is in progress; not a booking.', ['availability']],
  ['hotel_rate_enquiry', 'Tariff Enquiry Acknowledgement', 'Pricing', '', 'Hello {{customer_name}}, tariffs depend on dates, room type and occupancy. Our reservations team will share the applicable tariff for your dates.', 'No invented tariffs.', ['tariff']],
  ['hotel_reservation_request', 'Reservation Request Received', 'Reservations', 'Reservation request received', 'Hello {{customer_name}}, we have received your reservation request at {{business_name}}. Your booking is not confirmed until our team shares a confirmation.', 'Acknowledges a request; explicitly not a confirmation.', ['reservation']],
  ['hotel_reservation_confirmed', 'Reservation Confirmation', 'Reservations', 'Reservation {{booking_reference}} confirmed', 'Hello {{customer_name}}, your stay at {{business_name}} is confirmed from {{check_in_date}} to {{check_out_date}}. Booking reference: {{booking_reference}}.', 'Use only after a reservation is genuinely confirmed.', ['confirmation']],
  ['hotel_pre_arrival', 'Pre-Arrival Information', 'Guest Info', '', 'Hello {{customer_name}}, we look forward to welcoming you on {{check_in_date}}. {{business_name}} is located at {{business_address}}. Reply here if you need any assistance before arrival.', 'Pre-arrival note with configured address.', ['arrival']],
  ['hotel_check_in_info', 'Check-in Information', 'Guest Info', '', 'Hello {{customer_name}}, for check-in at {{business_name}}, please carry a valid photo ID for each guest. Our front desk will assist you on arrival.', 'Generic check-in guidance.', ['check-in']],
  ['hotel_special_request', 'Special Request Acknowledgement', 'Guest Info', '', 'Hello {{customer_name}}, we have noted your special request. Our team will check and confirm whether it can be arranged.', 'Notes a request without promising it.', ['requests']],
  ['hotel_banquet_enquiry', 'Event / Banquet Enquiry', 'Events', 'Event enquiry received', 'Hello {{customer_name}}, thank you for your event enquiry at {{business_name}}. Please share the date, expected guest count and type of event.', 'Collects event requirements.', ['events']],
  ['hotel_checkout_thanks', 'Post-Stay Thank You', 'Follow-Up', '', 'Hello {{customer_name}}, thank you for staying with {{business_name}}. We hope you had a comfortable stay.', 'Thanks guests after checkout.', ['checkout']],
  ['hotel_enquiry_followup', 'Stay Enquiry Follow-up', 'Follow-Up', '', 'Hello {{customer_name}}, we are following up on your stay enquiry with {{business_name}}. Let us know if you would like help with your reservation.', 'Follows up an open enquiry.', ['followup']],
  ['hotel_location_hours', 'Address & Front Desk Hours', 'Business Info', '', 'Hello {{customer_name}}, {{business_name}} is located at {{business_address}}. Front desk hours: {{business_hours}}.', 'Configured address and hours only.', ['info']],
  ['hotel_seasonal_offer', 'Seasonal Stay Update', 'Marketing', '', 'Hello {{customer_name}}, planning your next getaway? Reply STAY to receive the latest availability from {{business_name}}.', 'Marketing for opted-in guests only; no invented discounts.', ['marketing']],
  ['hotel_feedback_request', 'Guest Feedback Request', 'Feedback', '', 'Hello {{customer_name}}, we would value your feedback about your recent stay at {{business_name}}.', 'Post-stay feedback.', ['feedback']],
];

const QUICK_REPLIES = [
  ['hotel_qr_rooms', 'Room Options', 'Rooms', 'We would be happy to help. Please share your travel dates and number of guests so we can suggest suitable rooms.', 'Collects stay details.'],
  ['hotel_qr_tariff', 'Tariff Information', 'Pricing', 'Tariffs depend on dates, room type and occupancy. Please share your dates and guests, and our team will confirm the applicable tariff.', 'No invented rates.'],
  ['hotel_qr_availability', 'Check Availability', 'Reservations', 'Please share your check-in date, check-out date and number of guests. We will check availability for you.', 'Availability intake.'],
  ['hotel_qr_reservation', 'Reservation Request', 'Reservations', 'Thank you. Please share the guest name, dates and room preference. Our team will confirm the reservation with you.', 'Reservation intake; not a confirmation.'],
  ['hotel_qr_checkin', 'Check-in Guidance', 'Guest Info', 'Please carry a valid photo ID for each guest at check-in. Our front desk will assist you on arrival.', 'Generic check-in guidance.'],
  ['hotel_qr_events', 'Events & Banquets', 'Events', 'For events, please share the date, expected guest count and type of event. Our team will get back with options.', 'Event intake.'],
  ['hotel_qr_location', 'Address & Hours', 'Business Info', '{{business_name}} is located at {{business_address}}. Front desk hours: {{business_hours}}.', 'Configured details.'],
  ['hotel_qr_thanks', 'Thank You', 'Guest Info', 'Thank you for choosing {{business_name}}. We look forward to hosting you.', 'Courteous closing.'],
];

const RULES = [
  ['hotel_auto_rooms', 'Room Enquiries', ['ROOM', 'ROOMS', 'STAY', 'SUITE'], 'Thank you for your interest in {{business_name}}. Please share your travel dates and number of guests.', 'hotel_room_info', 'Room enquiries.'],
  ['hotel_auto_tariff', 'Tariff Enquiries', ['PRICE', 'TARIFF', 'RATE', 'COST'], 'Tariffs depend on dates and room type. Please share your dates and guests so our team can confirm the applicable tariff.', 'hotel_rate_enquiry', 'Collects details before quoting.'],
  ['hotel_auto_booking', 'Reservation Requests', ['BOOK', 'BOOKING', 'RESERVE', 'RESERVATION'], 'Thank you. Please share your dates, guests and room preference. Your booking is confirmed only after our team confirms it.', 'hotel_reservation_request', 'Reservation intake; never auto-confirms.'],
  ['hotel_auto_checkin', 'Check-in Questions', ['CHECKIN', 'CHECK-IN', 'CHECKOUT', 'CHECK-OUT'], 'Our front desk will assist you with check-in and check-out. Please carry a valid photo ID for each guest.', 'hotel_check_in_info', 'Check-in guidance.'],
  ['hotel_auto_location', 'Address & Hours', ['ADDRESS', 'LOCATION', 'DIRECTIONS', 'TIMING'], '{{business_name}} is located at {{business_address}}. Front desk hours: {{business_hours}}.', 'hotel_location_hours', 'Shares configured details.'],
];

const CAMPAIGNS = [
  ['hotel_camp_enquiry_followup', 'Stay Enquiry Follow-up', 'Follow up with guests who enquired about a stay but have not booked.', 'Recent stay enquiries with valid consent', 'hotel_enquiry_followup'],
  ['hotel_camp_returning_guests', 'Returning Guest Update', 'Invite opted-in past guests to plan their next stay.', 'Past guests with valid consent', 'hotel_seasonal_offer'],
];

const hospitality = finalizePack({
  key: 'hospitality',
  id: 'hospitality',
  name: 'Hotels & Hospitality',
  displayLabel: 'Hospitality',
  description: 'Stay enquiries, availability checks, reservation requests, guest information and events.',
  icon: 'Hotel',
  version: 1,
  packVersion: V,
  status: 'ready',
  terminology: {
    leadLabel: 'Guest Enquiry',
    leadPlural: 'Guest Enquiries',
    offeringLabel: 'Room / Stay',
    offeringPlural: 'Rooms & Stays',
    interestFieldLabel: 'Room Preference',
    actionLabel: 'Reservation Request',
    categoryLabel: 'Stay Type',
  },
  defaultLeadStatuses: LEAD_STATUSES,
  templateCategories: ['Welcome', 'Rooms', 'Pricing', 'Reservations', 'Guest Info', 'Events', 'Follow-Up', 'Marketing', 'Business Info', 'Feedback'],
  contactFields: baseContactFields([
    { key: 'roomPreference', label: 'Room Preference', type: 'text', required: false, filterable: true, showInTable: true, order: 5 },
    { key: 'checkInDate', label: 'Check-in Date', type: 'date', required: false, filterable: true, showInTable: true, order: 6 },
    { key: 'checkOutDate', label: 'Check-out Date', type: 'date', required: false, filterable: true, showInTable: false, order: 7 },
    { key: 'guestCount', label: 'Number of Guests', type: 'number', required: false, filterable: true, showInTable: false, order: 10 },
    { key: 'stayPurpose', label: 'Purpose of Stay', type: 'select', required: false, filterable: true, showInTable: false, options: ['Leisure', 'Business', 'Event / Wedding', 'Other'], order: 11 },
  ], LEAD_STATUSES),
  contactDisplayPreferences: { defaultSort: 'createdAt', tableColumns: ['fullName', 'phoneNumber', 'roomPreference', 'checkInDate', 'leadStatus', 'whatsappConsentStatus'] },
  contactFilters: ['roomPreference', 'stayPurpose', 'leadStatus', 'leadSource', 'whatsappConsentStatus'],
  templateSuggestions: TEMPLATES.map((row, i) => buildTemplate('HOTEL', V, i, row)),
  quickReplyPresets: QUICK_REPLIES.map(buildQuickReply),
  automationPresets: [...RULES.map((row, i) => buildRule(i + 2, row)), buildOptOutRule('hotel')],
  sampleCampaignDrafts: CAMPAIGNS.map(buildCampaignDraft),
  supportedVariables: [
    ...COMMON_BUSINESS_VARIABLES,
    { token: 'check_in_date', label: 'Check-in Date', sampleValue: '12 Nov', category: 'Reservation', description: 'Guest check-in date' },
    { token: 'check_out_date', label: 'Check-out Date', sampleValue: '14 Nov', category: 'Reservation', description: 'Guest check-out date' },
    { token: 'guest_count', label: 'Guest Count', sampleValue: '2', category: 'Reservation', description: 'Number of guests' },
    { token: 'booking_reference', label: 'Booking Reference', sampleValue: 'BK-2210', category: 'Reservation', description: 'Real booking reference entered by staff' },
  ],
});

export default hospitality;
