import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import data configs
import { INDUSTRIES, getIndustryBySlug } from '../src/marketing/data/industryData.js';
import { PRICING_TIERS, BILLING_EXPLANATION } from '../src/marketing/data/pricingData.js';
import { FAQS, FAQ_CATEGORIES } from '../src/marketing/data/faqData.js';

test('SaaS Prompt 3 — 1. Public Route Architecture in App.jsx', () => {
  const appPath = path.resolve(__dirname, '../src/App.jsx');
  const code = fs.readFileSync(appPath, 'utf8');

  // Verify MarketingLayout wrapper
  assert.ok(code.includes('MarketingLayout'), 'App.jsx must import and use MarketingLayout');

  // Verify all 11 required public marketing routes
  const requiredPublicRoutes = [
    'path="/"',
    'path="/features"',
    'path="/industries"',
    'path="/industries/:slug"',
    'path="/how-it-works"',
    'path="/pricing"',
    'path="/faq"',
    'path="/contact"',
    'path="/privacy"',
    'path="/terms"',
    'path="/signup"',
  ];

  for (const route of requiredPublicRoutes) {
    assert.ok(code.includes(route), `App.jsx must declare public route ${route}`);
  }

  // Verify authentication entry points
  assert.ok(code.includes('path="/login"'), 'App.jsx must declare /login route');
  assert.ok(code.includes('path="/register"'), 'App.jsx must declare /register route');

  // Verify authenticated workspace routes preservation
  assert.ok(code.includes('path="/app"'), 'App.jsx must support /app dashboard route');
  assert.ok(code.includes('path="/app/overview"'), 'App.jsx must support /app/overview route');
  assert.ok(code.includes('path="/contacts"'), 'App.jsx must preserve legacy /contacts route');
  assert.ok(code.includes('path="/templates"'), 'App.jsx must preserve legacy /templates route');
  assert.ok(code.includes('path="/campaigns"'), 'App.jsx must preserve legacy /campaigns route');
  assert.ok(code.includes('path="/inbox"'), 'App.jsx must preserve legacy /inbox route');
  assert.ok(code.includes('path="/reports"'), 'App.jsx must preserve legacy /reports route');
  assert.ok(code.includes('path="/settings"'), 'App.jsx must preserve legacy /settings route');
});

test('SaaS Prompt 3 — 2. Seven Specialized Industries Configuration', () => {
  // Validate exact count of 7 industries
  assert.equal(INDUSTRIES.length, 7, 'Must define exactly 7 specialized industry configurations');

  const expectedSlugs = [
    'real-estate',
    'gym',
    'clinic',
    'education',
    'salon',
    'automobile',
    'other',
  ];

  const actualSlugs = INDUSTRIES.map((i) => i.slug);
  for (const slug of expectedSlugs) {
    assert.ok(actualSlugs.includes(slug), `Industry configurations must include slug: ${slug}`);

    const item = getIndustryBySlug(slug);
    assert.ok(item, `getIndustryBySlug('${slug}') must return valid configuration`);
    assert.ok(item.name && item.name.length > 2, `Industry ${slug} must have a valid name`);
    assert.ok(item.tagline && item.tagline.length > 5, `Industry ${slug} must have a tagline`);
    assert.ok(item.description && item.description.length > 20, `Industry ${slug} must have a description`);
    assert.ok(Array.isArray(item.features) && item.features.length >= 3, `Industry ${slug} must have at least 3 features`);
    assert.ok(Array.isArray(item.useCases) && item.useCases.length >= 3, `Industry ${slug} must have at least 3 use cases`);
    const kw = item.keywords || item.keywordPresets;
    assert.ok(Array.isArray(kw) && kw.length >= 3, `Industry ${slug} must have keyword presets`);
  }

  // Verify non-existent slug returns null
  assert.equal(getIndustryBySlug('crypto-trading'), null, 'Unknown slug must return null');
});

test('SaaS Prompt 3 — 3. Real Estate Industry Flagship Data Integrity', () => {
  const realEstate = getIndustryBySlug('real-estate');
  assert.equal(realEstate.badge, 'Flagship Industry', 'Real Estate must be designated as flagship industry');
  assert.ok(
    realEstate.features.some((f) => f.title.includes('Property') || f.title.includes('Site Visit')),
    'Real Estate must feature Property Enquiries or Site Visits'
  );
  const kw = realEstate.keywords || realEstate.keywordPresets;
  assert.ok(
    kw.some((k) => k.trigger === 'BROCHURE' || k.keyword === 'BROCHURE'),
    'Real Estate must include BROCHURE keyword preset'
  );
});

test('SaaS Prompt 3 — 4. Pricing Tiers & Separate Meta Billing Truthfulness', () => {
  assert.equal(PRICING_TIERS.length, 3, 'Pricing tiers must include Free Exploration, Relay Solo, and Agency');

  const freeTier = PRICING_TIERS.find((t) => t.id === 'free');
  assert.ok(freeTier, 'Free tier must exist');
  assert.equal(freeTier.price, '₹0', 'Free tier must be ₹0');
  assert.ok(freeTier.features.some((f) => f.toLowerCase().includes('mock')), 'Free tier must highlight Mock Mode');

  const soloTier = PRICING_TIERS.find((t) => t.id === 'solo');
  assert.ok(soloTier, 'Relay Solo tier must exist');
  assert.equal(soloTier.price, '₹799', 'Relay Solo must be ₹799 introductory price');
  assert.equal(soloTier.regularPrice, '₹999', 'Regular price must be ₹999');

  const agencyTier = PRICING_TIERS.find((t) => t.id === 'agency');
  assert.ok(agencyTier, 'Agency tier must exist');
  assert.ok(agencyTier.badge.includes('Coming Soon') || agencyTier.isComingSoon, 'Agency tier must be labeled Coming Soon');

  // Verify separate billing explanation
  assert.ok(BILLING_EXPLANATION.relaySubscription, 'Must explain Relay subscription');
  assert.ok(BILLING_EXPLANATION.metaCharges, 'Must explain separate Meta charges');
  assert.ok(
    BILLING_EXPLANATION.metaCharges.recipient.includes('Meta') ||
    BILLING_EXPLANATION.metaCharges.recipient.includes('zero markup'),
    'Meta charges must clarify zero markup from Relay'
  );
});

test('SaaS Prompt 3 — 5. FAQ Categorization & Knowledge Coverage', () => {
  assert.ok(FAQ_CATEGORIES.length >= 5, 'FAQ must have at least 5 categories');
  assert.ok(FAQS.length >= 10, 'FAQ must have at least 10 comprehensive questions');

  const questions = FAQS.map((f) => f.question.toLowerCase());
  assert.ok(questions.some((q) => q.includes('what is relay')), 'Must answer What is Relay');
  assert.ok(questions.some((q) => q.includes('mock mode')), 'Must explain Mock Mode');
  assert.ok(questions.some((q) => q.includes('coexistence') || q.includes('existing whatsapp')), 'Must explain coexistence');
  assert.ok(questions.some((q) => q.includes('cloud api')), 'Must explain Cloud API');
  assert.ok(questions.some((q) => q.includes('billing') || q.includes('charge')), 'Must explain billing');
  assert.ok(questions.some((q) => q.includes('multi-tenant') || q.includes('privacy')), 'Must explain data privacy');
});

test('SaaS Prompt 3 — 6. Marketing Navbar Component Capabilities', () => {
  const navbarPath = path.resolve(__dirname, '../src/marketing/components/MarketingNavbar.jsx');
  const code = fs.readFileSync(navbarPath, 'utf8');

  // Logo & Brand
  assert.ok(code.includes('RELAY'), 'Navbar must render RELAY brand');

  // Navigation Links & Dropdowns
  assert.ok(code.includes('Product'), 'Navbar must include Product dropdown');
  assert.ok(code.includes('Industries'), 'Navbar must include Industries dropdown');
  assert.ok(code.includes('How It Works'), 'Navbar must include How It Works link');
  assert.ok(code.includes('Pricing'), 'Navbar must include Pricing link');
  assert.ok(code.includes('FAQ'), 'Navbar must include FAQ link');
  assert.ok(code.includes('Contact'), 'Navbar must include Contact link');

  // Authenticated vs Visitor handling
  assert.ok(code.includes('user ?'), 'Navbar must check user authentication state');
  assert.ok(code.includes('Go to Dashboard') || code.includes('/app'), 'Navbar must link authenticated users to /app');
  assert.ok(code.includes('/login') && code.includes('/signup'), 'Navbar must provide login and early access buttons');

  // Mobile drawer & Accessibility
  assert.ok(code.includes('mobileMenuOpen'), 'Navbar must support mobile menu state');
  assert.ok(code.includes('Escape'), 'Navbar must handle Escape key for accessibility');
});

test('SaaS Prompt 3 — 7. Contact Form API Client & Honeypot Spam Protection', () => {
  const contactPagePath = path.resolve(__dirname, '../src/marketing/pages/ContactPage.jsx');
  const code = fs.readFileSync(contactPagePath, 'utf8');

  assert.ok(code.includes('/public/contact'), 'ContactPage must POST to /public/contact');
  assert.ok(code.includes('honeypot'), 'ContactPage must include bot protection honeypot');
  assert.ok(code.includes('fullName') && code.includes('businessEmail'), 'ContactPage must collect name and email');
  assert.ok(code.includes('businessName') && code.includes('industry'), 'ContactPage must collect business name and industry');
  assert.ok(code.includes('contactReason'), 'ContactPage must collect contact reason');
  assert.ok(code.includes('isSubmitting'), 'ContactPage must indicate loading state');
  assert.ok(code.includes('successInfo'), 'ContactPage must render success feedback with reference ID');
});

test('SaaS Prompt 3 — 8. Early Access Signup Shell Boundaries', () => {
  const signupPagePath = path.resolve(__dirname, '../src/marketing/pages/SignupPage.jsx');
  const code = fs.readFileSync(signupPagePath, 'utf8');

  // Early access truthfulness
  assert.ok(
    code.includes('Early Access') || code.includes('Phase 3 Preview') || code.includes('Phase 4'),
    'SignupPage must clearly explain Early Access state'
  );
  assert.ok(
    code.includes('/public/contact'),
    'SignupPage must submit priority registration through public contact endpoint'
  );
  assert.ok(
    code.includes('/login'),
    'SignupPage must link existing workspace owners to /login'
  );
});

test('SaaS Prompt 3 — 9. Privacy Policy & Terms of Service Integrity', () => {
  const privacyPath = path.resolve(__dirname, '../src/marketing/pages/PrivacyPage.jsx');
  const privacyCode = fs.readFileSync(privacyPath, 'utf8');

  assert.ok(privacyCode.includes('Data Processor') || privacyCode.includes('Data Controller'), 'Privacy policy must define data roles');
  assert.ok(privacyCode.includes('Multi-Tenant') || privacyCode.includes('Data Isolation'), 'Privacy policy must explain multi-tenant isolation');
  assert.ok(privacyCode.includes('STOP'), 'Privacy policy must explain opt-out suppression keyword');

  const termsPath = path.resolve(__dirname, '../src/marketing/pages/TermsPage.jsx');
  const termsCode = fs.readFileSync(termsPath, 'utf8');

  assert.ok(termsCode.includes('WhatsApp Business Messaging Policy'), 'Terms must reference Meta WhatsApp policies');
  assert.ok(termsCode.includes('Prohibited Activities'), 'Terms must define prohibited activities');
  assert.ok(termsCode.includes('Mock Mode'), 'Terms must clarify Mock Mode simulation');
});
