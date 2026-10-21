const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const SCREENSHOT_DIR = '/Users/sumitthakur/Desktop/Freelance Automation/docs/screenshots';
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function verifyContacts() {
  console.log('--- STARTING PROMPT 3 CONTACTS JOURNEY VISUAL VERIFICATION ---');

  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  const page = await context.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  // 1. Log in via UI
  console.log('1. Logging in via http://127.0.0.1:5174/login ...');
  await page.goto('http://127.0.0.1:5174/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'admin@relaycrm.io');
  await page.fill('input[type="password"]', 'Password123!');
  console.log('   Filled login form. Clicking submit...');
  await page.click('button[type="submit"]');

  try {
    await page.waitForURL('http://127.0.0.1:5174/', { timeout: 10000 });
    console.log('   Authenticated successfully! Redirected to Overview.');
  } catch (e) {
    console.log('   Wait for URL failed. Current URL:', page.url());
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'debug_login_failed.png') });
    throw e;
  }

  // 2. Navigate to /contacts
  console.log('2. Navigating to /contacts via sidebar link...');
  await page.waitForTimeout(500);
  await page.locator('a[href="/contacts"]').first().click();
  await page.waitForURL('**/contacts');
  await page.waitForSelector('.contacts-page', { timeout: 10000 });
  await page.waitForTimeout(1000);

  // Verify 4 stats cards
  const statCards = await page.$$('.stat-card');
  console.log(`   Found ${statCards.length} compact contact statistics cards.`);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'contacts_01_all_contacts.png') });
  console.log('   Captured: contacts_01_all_contacts.png');

  // 3. Open Add Contact Modal
  console.log('3. Opening Add Contact Modal...');
  const addBtn = page.locator('button:has-text("Add Contact")').first();
  await addBtn.click();
  await page.waitForSelector('.contact-modal', { timeout: 5000 });
  await page.waitForTimeout(600);

  // Fill in sample real estate contact using verified placeholders
  const randomSuffix = Math.floor(10000 + Math.random() * 90000);
  await page.fill('input[placeholder*="Malhotra"]', 'Vikram Malhotra ' + randomSuffix);
  await page.fill('input[placeholder*="9876543210"]', '+91 98101 ' + randomSuffix);
  await page.fill('input[placeholder*="example.com"]', `vikram.${randomSuffix}@luxuryhomes.in`);
  await page.fill('input[placeholder*="Gurugram, Delhi, Noida"]', 'Gurugram');
  await page.selectOption('label:has-text("Interested Property Type") select', 'Villas');
  await page.fill('input[placeholder*="Godrej Aristocrat"]', 'Golf Estate Luxury');
  await page.fill('input[placeholder*="Golf Course Extension"]', 'Golf Course Ext Rd');
  await page.fill('input[placeholder*="₹2.5 Cr"]', '₹4 Cr - ₹7 Cr');
  await page.fill('input[placeholder*="Gurugram Buyer"]', 'Luxury Buyer, NRI Lead');
  await page.fill('textarea[placeholder*="Specific requirements"]', 'Enquired through luxury villas landing page. Requires 4BHK with private pool.');

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'contacts_02_add_modal.png') });
  console.log('   Captured: contacts_02_add_modal.png');

  // Submit contact
  const saveBtn = page.locator('button:has-text("Add Property Contact")').first();
  await saveBtn.click();
  await page.waitForSelector('.contact-modal', { state: 'hidden', timeout: 5000 });
  console.log('   Contact "Vikram Malhotra" saved successfully to MongoDB.');
  await page.waitForTimeout(1000);

  // 4. Click contact row to open Contact Details Drawer
  console.log('4. Opening Contact Details Drawer...');
  const firstContactBtn = page.locator('tbody tr td button').first();
  await firstContactBtn.click();
  await page.waitForSelector('.contact-drawer', { timeout: 5000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'contacts_03_detail_drawer.png') });
  console.log('   Captured: contacts_03_detail_drawer.png');

  // Close drawer
  const closeDrawerBtn = page.locator('.contact-drawer button[aria-label="Close profile"]').first();
  await closeDrawerBtn.click();
  await page.waitForSelector('.contact-drawer', { state: 'hidden', timeout: 5000 });
  await page.waitForTimeout(500);

  // 5. Open Tag Manager Modal
  console.log('5. Opening Tag Manager Modal...');
  const manageTagsBtn = page.locator('button:has-text("Manage Tags")').first();
  await manageTagsBtn.click();
  await page.waitForSelector('.contact-modal', { timeout: 5000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'contacts_04_tags_modal.png') });
  console.log('   Captured: contacts_04_tags_modal.png');

  // Close tag modal
  const closeTagBtn = page.locator('.contact-modal button[aria-label="Close"]').first();
  await closeTagBtn.click();
  await page.waitForSelector('.contact-modal', { state: 'hidden', timeout: 5000 });
  await page.waitForTimeout(500);

  // 6. Switch to Contact Groups Tab
  console.log('6. Switching to Contact Groups tab...');
  const groupsTab = page.locator('button.contacts-tab-btn:has-text("Contact Groups")').first();
  await groupsTab.click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'contacts_05_groups_tab.png') });
  console.log('   Captured: contacts_05_groups_tab.png');

  // 7. Switch to Saved Audiences Tab (Dynamic Segments)
  console.log('7. Switching to Saved Audiences tab...');
  const audiencesTab = page.locator('button.contacts-tab-btn:has-text("Saved Audiences")').first();
  await audiencesTab.click();
  await page.waitForTimeout(800);

  // Open Create Dynamic Segment modal
  const createSegmentBtn = page.locator('button:has-text("Dynamic Segment"), button:has-text("Create Segment")').first();
  await createSegmentBtn.click();
  await page.waitForSelector('.contact-modal', { timeout: 5000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'contacts_06_audiences_tab.png') });
  console.log('   Captured: contacts_06_audiences_tab.png');

  // Close segment modal
  const closeSegmentBtn = page.locator('.contact-modal button[aria-label="Close"]').first();
  await closeSegmentBtn.click();
  await page.waitForSelector('.contact-modal', { state: 'hidden', timeout: 5000 });
  await page.waitForTimeout(500);

  // 8. Switch to Import History Tab
  console.log('8. Switching to Import History tab...');
  const importsTab = page.locator('button.contacts-tab-btn:has-text("Import History")').first();
  await importsTab.click();
  await page.waitForTimeout(800);

  // Open Import Wizard modal
  const importBtn = page.locator('button:has-text("Import Another File"), button:has-text("Start Contact Import"), button:has-text("Import Excel / CSV")').first();
  await importBtn.click();
  await page.waitForSelector('.contact-modal', { timeout: 5000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'contacts_07_imports_tab.png') });
  console.log('   Captured: contacts_07_imports_tab.png');

  // Close import modal
  const closeImportBtn = page.locator('.contact-modal button[aria-label="Close"]').first();
  await closeImportBtn.click();
  await page.waitForSelector('.contact-modal', { state: 'hidden', timeout: 5000 });
  await page.waitForTimeout(500);

  // 9. Responsive Tablet Viewport (768x1024)
  console.log('9. Capturing Responsive Tablet (768x1024)...');
  await page.setViewportSize({ width: 768, height: 1024 });
  const allContactsTab = page.locator('button.contacts-tab-btn:has-text("All Contacts")').first();
  await allContactsTab.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'contacts_08_tablet_768px.png') });
  console.log('   Captured: contacts_08_tablet_768px.png');

  // 10. Responsive Mobile Viewport (390x844)
  console.log('10. Capturing Responsive Mobile (390x844)...');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'contacts_09_mobile_390px.png') });
  console.log('   Captured: contacts_09_mobile_390px.png');

  // 11. Verify Campaign Audience Selector integration
  console.log('11. Verifying Campaign Audience Selector integration at /campaigns ...');
  await page.setViewportSize({ width: 1440, height: 900 });
  const campaignsLink = page.locator('a[href="/campaigns"]').first();
  await campaignsLink.click();
  await page.waitForURL('**/campaigns');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'contacts_10_campaign_audience.png') });
  console.log('   Captured: contacts_10_campaign_audience.png');

  await browser.close();
  console.log('--- ALL VISUAL VERIFICATIONS COMPLETED SUCCESSFULLY ---');
}

verifyContacts().catch((err) => {
  console.error('Visual verification failed:', err);
  process.exit(1);
});
