/**
 * Relay SaaS — Industry Pack: E-commerce & Retail
 * Key: ecommerce_retail
 * Never invents prices, stock, discounts, delivery dates or order states.
 */
import { buildTemplate, buildQuickReply, buildRule, buildOptOutRule, buildCampaignDraft, finalizePack, COMMON_BUSINESS_VARIABLES, baseContactFields } from '../packBuilder.js';

const V = '1.1.0';
const LEAD_STATUSES = ['New', 'Browsing', 'Interested', 'Order Placed', 'Support Open', 'Repeat Customer', 'Closed'];

const TEMPLATES = [
  ['ecom_welcome', 'Welcome to the Store', 'Welcome', 'Welcome to {{business_name}}', 'Hello {{customer_name}}, thank you for messaging {{business_name}}! Tell us what you are shopping for and our team will help you find the right product.', 'Greets a new shopper and asks what they are looking for.', ['welcome']],
  ['ecom_product_enquiry', 'Product Enquiry Response', 'Products', 'About {{product_name}}', 'Hello {{customer_name}}, thanks for asking about {{product_name}}. Our team will share the available details and options with you shortly.', 'Acknowledges a product question without promising stock.', ['product']],
  ['ecom_availability_check', 'Stock Availability Check', 'Products', 'Checking availability', 'Hello {{customer_name}}, we are checking the current availability of {{product_name}} at {{business_name}}. We will update you as soon as we have confirmed it.', 'Confirms an availability check is in progress; does not claim stock.', ['stock']],
  ['ecom_price_enquiry', 'Price Enquiry Acknowledgement', 'Pricing', 'Price details', 'Hello {{customer_name}}, thank you for your price enquiry for {{product_name}}. Our team will share the current price and any applicable charges with you.', 'Acknowledges price questions without quoting a price.', ['pricing']],
  ['ecom_order_received', 'Order Request Received', 'Orders', 'Order request received', 'Hello {{customer_name}}, we have received your order request at {{business_name}}. Our team will confirm the details, total and next steps with you before processing.', 'Acknowledges an order request; does not confirm payment or dispatch.', ['order']],
  ['ecom_order_confirmed', 'Order Confirmation', 'Orders', 'Order {{order_id}} confirmed', 'Hello {{customer_name}}, your order {{order_id}} with {{business_name}} has been confirmed. We will share shipping updates once it is dispatched.', 'Use only after the order is genuinely confirmed.', ['order', 'confirmation']],
  ['ecom_shipping_update', 'Shipping Update', 'Delivery', 'Shipping update for {{order_id}}', 'Hello {{customer_name}}, here is an update on your order {{order_id}}: {{shipping_status}}. Reply here if you have any questions.', 'Shares a real shipping status supplied by the operator.', ['shipping']],
  ['ecom_delivery_followup', 'Delivery Follow-up', 'Delivery', '', 'Hello {{customer_name}}, we hope your order {{order_id}} from {{business_name}} reached you safely. Please let us know if anything needs attention.', 'Checks in after delivery.', ['delivery']],
  ['ecom_return_request', 'Return / Exchange Request', 'Support', 'Return request received', 'Hello {{customer_name}}, we have received your return or exchange request for order {{order_id}}. Our team will review it against our return policy and get back to you.', 'Acknowledges returns without promising approval or refunds.', ['returns']],
  ['ecom_payment_link_request', 'Payment Details Request', 'Orders', '', 'Hello {{customer_name}}, to complete your order with {{business_name}}, our team will share the payment details for the confirmed amount. Please do not pay until you receive them from our official number.', 'Safe payment step messaging; never claims payment was received.', ['payment']],
  ['ecom_cart_reminder', 'Pending Enquiry Reminder', 'Follow-Up', '', 'Hello {{customer_name}}, you recently asked about {{product_name}} at {{business_name}}. Would you like us to help you complete your order?', 'Gentle reminder for an unfinished enquiry.', ['reminder']],
  ['ecom_new_arrivals', 'New Arrivals Announcement', 'Marketing', 'New at {{business_name}}', 'Hello {{customer_name}}, new products have arrived at {{business_name}}. Reply NEW to see what has been added.', 'Marketing message for opted-in customers only.', ['marketing']],
  ['ecom_store_info', 'Store Address & Hours', 'Business Info', '', 'Hello {{customer_name}}, you can find {{business_name}} at {{business_address}}. Our working hours are {{business_hours}}.', 'Uses configured address and hours only.', ['info']],
  ['ecom_support_response', 'Customer Support Response', 'Support', '', 'Hello {{customer_name}}, thank you for contacting {{business_name}} support. We have noted your query and our team will assist you with the next steps.', 'General support acknowledgement.', ['support']],
  ['ecom_feedback_request', 'Feedback Request', 'Feedback', '', 'Hello {{customer_name}}, thank you for shopping with {{business_name}}. We would value your feedback on your recent purchase.', 'Post-purchase feedback request.', ['feedback']],
];

const QUICK_REPLIES = [
  ['ecom_qr_catalog', 'Product Catalogue', 'Products', 'Thank you for your interest in {{business_name}}. Please tell us the product or category you are looking for and we will share the available options.', 'Asks what the shopper wants to browse.'],
  ['ecom_qr_price', 'Price Information', 'Pricing', 'Prices can vary by size, variant and quantity. Please share the exact product and variant, and our team will confirm the current price.', 'Asks for variant details before quoting.'],
  ['ecom_qr_stock', 'Availability Check', 'Products', 'Let us check the current availability for you. Please share the product name, size or colour you need.', 'Collects details to check stock.'],
  ['ecom_qr_order_status', 'Order Status', 'Orders', 'Please share your order number and we will check the latest status for you.', 'Requests order number.'],
  ['ecom_qr_shipping', 'Shipping Information', 'Delivery', 'Delivery timelines depend on your location and the item. Please share your PIN code and we will confirm the expected timeline.', 'Collects PIN code; no promised dates.'],
  ['ecom_qr_returns', 'Returns & Exchanges', 'Support', 'We are happy to help with returns or exchanges as per our policy. Please share your order number and the reason for the request.', 'Starts a return request.'],
  ['ecom_qr_store_info', 'Store Address & Hours', 'Business Info', 'You can find {{business_name}} at {{business_address}}. Our working hours are {{business_hours}}.', 'Configured address and hours.'],
  ['ecom_qr_thanks', 'Thank You', 'Support', 'Thank you for shopping with {{business_name}}! Let us know if there is anything else we can help with.', 'Courteous closing.'],
];

const RULES = [
  ['ecom_auto_products', 'Product Enquiries', ['PRODUCT', 'CATALOG', 'CATALOGUE', 'COLLECTION'], 'Thank you for your interest in {{business_name}}. Please tell us the product or category you are looking for.', 'ecom_product_enquiry', 'Responds to product browsing enquiries.'],
  ['ecom_auto_price', 'Price Enquiries', ['PRICE', 'COST', 'RATE', 'MRP'], 'Thank you for asking. Please share the exact product and variant so our team can confirm the current price.', 'ecom_price_enquiry', 'Collects details for accurate pricing.'],
  ['ecom_auto_order_status', 'Order Status', ['ORDER', 'TRACK', 'TRACKING', 'STATUS'], 'Please share your order number and our team will check the latest status for you.', 'ecom_shipping_update', 'Asks for order number.'],
  ['ecom_auto_returns', 'Returns & Exchanges', ['RETURN', 'EXCHANGE', 'REFUND', 'REPLACE'], 'We have noted your request. Please share your order number and reason, and our team will review it as per our policy.', 'ecom_return_request', 'Starts a return review without promising refunds.'],
  ['ecom_auto_store', 'Store Location & Hours', ['ADDRESS', 'LOCATION', 'TIMING', 'HOURS'], 'You can find {{business_name}} at {{business_address}}. Our working hours are {{business_hours}}.', 'ecom_store_info', 'Shares configured store details.'],
];

const CAMPAIGNS = [
  ['ecom_camp_enquiry_followup', 'Product Enquiry Follow-up', 'Follow up with shoppers who asked about products but have not ordered yet.', 'Recent product enquiries with valid consent', 'ecom_cart_reminder'],
  ['ecom_camp_new_arrivals', 'New Arrivals Update', 'Share new arrivals with opted-in customers.', 'Opted-in customers', 'ecom_new_arrivals'],
];

const ecommerceRetail = finalizePack({
  key: 'ecommerce_retail',
  id: 'ecommerce_retail',
  name: 'E-commerce & Retail',
  displayLabel: 'E-commerce & Retail',
  description: 'Product enquiries, availability checks, order requests, shipping updates and returns.',
  icon: 'ShoppingBag',
  version: 1,
  packVersion: V,
  status: 'ready',
  terminology: {
    leadLabel: 'Shopper',
    leadPlural: 'Shoppers',
    offeringLabel: 'Product',
    offeringPlural: 'Products',
    interestFieldLabel: 'Product Interest',
    actionLabel: 'Order Request',
    categoryLabel: 'Product Category',
  },
  defaultLeadStatuses: LEAD_STATUSES,
  templateCategories: ['Welcome', 'Products', 'Pricing', 'Orders', 'Delivery', 'Support', 'Follow-Up', 'Marketing', 'Business Info', 'Feedback'],
  contactFields: baseContactFields([
    { key: 'productInterest', label: 'Product Interest', type: 'text', required: false, filterable: true, showInTable: true, order: 5 },
    { key: 'productCategory', label: 'Product Category', type: 'text', required: false, filterable: true, showInTable: false, order: 6 },
    { key: 'lastOrderId', label: 'Last Order Reference', type: 'text', required: false, filterable: true, showInTable: false, order: 7 },
    { key: 'pinCode', label: 'Delivery PIN Code', type: 'text', required: false, filterable: true, showInTable: false, order: 10 },
    { key: 'preferredChannel', label: 'Preferred Channel', type: 'select', required: false, filterable: true, showInTable: false, options: ['WhatsApp', 'Phone Call', 'Email'], order: 11 },
  ], LEAD_STATUSES),
  contactDisplayPreferences: { defaultSort: 'createdAt', tableColumns: ['fullName', 'phoneNumber', 'city', 'productInterest', 'leadStatus', 'whatsappConsentStatus'] },
  contactFilters: ['productInterest', 'productCategory', 'leadStatus', 'leadSource', 'whatsappConsentStatus'],
  templateSuggestions: TEMPLATES.map((row, i) => buildTemplate('ECOM', V, i, row)),
  quickReplyPresets: QUICK_REPLIES.map(buildQuickReply),
  automationPresets: [...RULES.map((row, i) => buildRule(i + 2, row)), buildOptOutRule('ecom')],
  sampleCampaignDrafts: CAMPAIGNS.map(buildCampaignDraft),
  supportedVariables: [
    ...COMMON_BUSINESS_VARIABLES,
    { token: 'product_name', label: 'Product Name', sampleValue: 'Cotton Kurta', category: 'Product', description: 'Product the customer asked about' },
    { token: 'order_id', label: 'Order Reference', sampleValue: 'ORD-1024', category: 'Order', description: 'Real order reference entered by the operator' },
    { token: 'shipping_status', label: 'Shipping Status', sampleValue: 'Dispatched', category: 'Order', description: 'Real shipping status entered by the operator' },
  ],
});

export default ecommerceRetail;
