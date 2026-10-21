export const FAQ_CATEGORIES = [
  { id: 'all', name: 'All Questions' },
  { id: 'general', name: 'General & Overview' },
  { id: 'whatsapp', name: 'WhatsApp Connection' },
  { id: 'billing', name: 'Pricing & Meta Charges' },
  { id: 'features', name: 'Features & Mock Mode' },
  { id: 'compliance', name: 'Compliance & Privacy' },
];

export const FAQS = [
  {
    category: 'general',
    question: 'What is Relay?',
    answer: 'Relay is a multi-industry WhatsApp automation platform designed for modern businesses. It combines contact management, personalized broadcast campaigns, interactive template design, and a unified conversational inbox with keyword auto-replies into one intuitive workspace tailored to your specific business type.',
  },
  {
    category: 'general',
    question: 'Who can use Relay?',
    answer: 'Relay is built for single-operator business owners, real estate consultants, gym and fitness studio managers, outpatient clinics, coaching institutes, salons, auto dealerships, and growing local businesses that need professional WhatsApp communications without enterprise complexity.',
  },
  {
    category: 'general',
    question: 'Which industries are currently supported?',
    answer: 'Relay features pre-configured workspace templates for Real Estate, Gym & Fitness, Clinic & Healthcare Services, Education & Coaching, Salon & Beauty, Automobile Dealerships, and a universal configuration for other businesses.',
  },
  {
    category: 'whatsapp',
    question: 'Can I connect my existing WhatsApp Business App number?',
    answer: 'Yes! Relay is designed to support official coexistence onboarding where supported by Meta, allowing eligible businesses to retain their existing WhatsApp Business App number while unlocking automated template messaging and web inbox capabilities.',
  },
  {
    category: 'whatsapp',
    question: 'Can I connect a dedicated WhatsApp Cloud API number?',
    answer: 'Yes. You can configure a new dedicated mobile or landline virtual number registered directly under your official Meta WhatsApp Business Account for high-volume broadcast operations.',
  },
  {
    category: 'whatsapp',
    question: 'Is Relay an unofficial bulk sender or Chrome extension?',
    answer: 'No. Relay does NOT use browser scraping, unapproved web bots, or unauthorized Chrome extensions that put your WhatsApp number at risk of permanent banning. Relay communicates strictly through official Meta WhatsApp Business APIs and verified offline simulation modes.',
  },
  {
    category: 'billing',
    question: 'How does billing work between Relay and Meta?',
    answer: 'Billing is completely transparent and separated: (1) You pay Relay a flat software subscription fee (e.g., ₹799/month for Relay Solo) for platform access, and (2) Meta charges per-conversation fees directly to your payment card linked inside your Meta Business Manager. Relay never adds any hidden markup to your Meta message costs.',
  },
  {
    category: 'billing',
    question: 'Does Relay charge per sent message?',
    answer: 'No. Relay does not levy any per-message surcharge or markup. You pay your fixed Relay subscription to us, and Meta conversation costs are settled directly between you and Meta.',
  },
  {
    category: 'billing',
    question: 'Can I cancel my subscription anytime?',
    answer: 'Yes. Relay subscriptions operate on a month-to-month basis with zero long-term lock-in. You can cancel or pause your plan directly from your workspace Settings.',
  },
  {
    category: 'features',
    question: 'What is Mock Mode?',
    answer: 'Mock Mode is Relay’s built-in offline simulation engine. It lets you test campaign workflows, audience previews, template variables, and keyword auto-replies safely without sending real messages or incurring any Meta fees. It is ideal for staff training and campaign rehearsals.',
  },
  {
    category: 'features',
    question: 'Can I import contacts from Excel or CSV files?',
    answer: 'Yes. Relay includes a smart 5-step spreadsheet import wizard that supports up to 10,000 rows per file, automatic phone number normalization (E.164), duplicate detection, and tag assignment.',
  },
  {
    category: 'features',
    question: 'Can a human operator take over automated conversations?',
    answer: 'Absolutely. Every conversation in Relay’s Unified Inbox features an instant "Operator Takeover" toggle. When enabled, auto-reply rules are paused for that chat so you or your staff can converse manually with the client.',
  },
  {
    category: 'compliance',
    question: 'Do I need customer consent before sending WhatsApp messages?',
    answer: 'Yes. In compliance with Meta WhatsApp Business Policies and global communication laws, businesses must obtain explicit opt-in consent before initiating marketing or promotional template messages. Relay includes built-in consent status tracking and instant STOP keyword suppression.',
  },
  {
    category: 'compliance',
    question: 'How does Relay protect cross-tenant data privacy?',
    answer: 'Relay enforces strict multi-tenant authorization barriers in MongoDB. Each business operates inside an isolated workspace. A user from Workspace A can never view, query, or enumerate contacts, campaigns, or conversations belonging to Workspace B.',
  },
  {
    category: 'compliance',
    question: 'Do you offer white-label partnerships for digital marketing agencies?',
    answer: 'Yes! We are developing an Agency White-Label program that will allow agencies to manage multiple client workspaces with custom agency branding. Contact us to join our early agency preview waitlist.',
  },
];
