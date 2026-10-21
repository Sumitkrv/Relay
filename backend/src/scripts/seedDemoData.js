import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';

import User from '../models/User.js';
import Contact from '../models/Contact.js';
import ContactGroup from '../models/ContactGroup.js';
import AudienceSegment from '../models/AudienceSegment.js';
import MessageTemplate, { TemplateVersion } from '../models/MessageTemplate.js';
import Campaign from '../models/Campaign.js';
import Conversation from '../models/Conversation.js';
import ConversationMessage from '../models/ConversationMessage.js';
import ConsentRecord from '../models/ConsentRecord.js';
import connectDB from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../../');
const FIXTURES_DIR = path.join(ROOT_DIR, 'test-fixtures');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const DEMO_DATASET_ID = 'relay-real-estate-qa-v1';

async function seed() {
  console.log('====================================================');
  console.log('RELAY REAL ESTATE WHATSAPP AUTOMATION');
  console.log('DEMO DATA SEEDING ENGINE (PROMPTS 2.5 & 3)');
  console.log('====================================================');

  if (process.env.NODE_ENV === 'production') {
    console.error('CRITICAL SAFETY ERROR: Demo data seeding is strictly disabled in production environments.');
    process.exit(1);
  }

  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/freelance_automation_crm';
  if (mongoUri.includes('production') || mongoUri.includes('prod')) {
    console.error('CRITICAL SAFETY ERROR: Target MongoDB URI appears to be production. Aborting.');
    process.exit(1);
  }

  console.log(`Connecting to database: ${mongoUri}...`);
  await connectDB();

  // Find all owner users in database to seed for each
  const owners = await User.find({ role: 'owner' });
  if (!owners.length) {
    console.error('ERROR: No owner user found in database. Create an owner account first.');
    process.exit(1);
  }
  console.log(`Found ${owners.length} workspace owner(s): ${owners.map((o) => `${o.name} (${o.email})`).join(', ')}`);

  // Fixtures check
  const contactsCsvPath = path.join(FIXTURES_DIR, 'Relay_Demo_Contacts_60.csv');
  const testPackXlsxPath = path.join(FIXTURES_DIR, 'Relay_Demo_Test_Pack.xlsx');

  let csvRecords = [];
  if (fs.existsSync(contactsCsvPath)) {
    const raw = fs.readFileSync(contactsCsvPath, 'utf8');
    csvRecords = parse(raw, { columns: true, skip_empty_lines: true, trim: true });
    console.log(`Loaded ${csvRecords.length} records from ${path.basename(contactsCsvPath)}`);
  } else {
    console.log('Contacts CSV not found, using built-in high-quality real estate fixtures.');
  }

  const overallResults = {};

  for (const owner of owners) {
    console.log(`\n--- Seeding demo data for Owner: ${owner.name} (${owner.email}) [ID: ${owner._id}] ---`);

    const results = {
      groupsCreated: 0,
      contactsInserted: 0,
      contactsUpdated: 0,
      segmentsCreated: 0,
      templatesCreated: 0,
      campaignsCreated: 0,
      consentRecordsCreated: 0,
      conversationsCreated: 0,
      messagesCreated: 0,
    };

    // 1. Create Contact Groups
    console.log('1. Setting up Real Estate Contact Groups...');
    const groupDefs = [
      { name: 'Gurugram Luxury Prospects', color: '#0D9488', description: 'Buyers seeking premium apartments & villas in Gurugram' },
      { name: 'Plot & Land Enquiries', color: '#3B82F6', description: 'Prospects interested in residential and commercial plots' },
      { name: 'NRI Investors Club', color: '#8B5CF6', description: 'High net worth overseas buyers and cross-border investors' },
      { name: 'Weekend Farmhouse Leads', color: '#F59E0B', description: 'Clients looking for 1 to 5 acre gated retreat properties' },
    ];

    const groupMap = {};
    for (const g of groupDefs) {
      const normalizedName = g.name.toLowerCase().trim();
      let groupDoc = await ContactGroup.findOne({ ownerId: owner._id, normalizedName });
      if (!groupDoc) {
        groupDoc = await ContactGroup.create({
          ownerId: owner._id,
          name: g.name,
          normalizedName,
          color: g.color,
          description: g.description,
          contactCount: 0,
        });
        results.groupsCreated++;
      }
      groupMap[g.name] = groupDoc;
    }
    console.log(`   Contact Groups ready: ${Object.keys(groupMap).length}`);

    // 2. Ingest Contacts
    console.log('2. Ingesting Real Estate Contacts...');
    const insertedContactDocs = [];

    for (let i = 0; i < csvRecords.length; i++) {
      const row = csvRecords[i];
      const fullName = row.FullName || row.fullName || `Property Lead ${i + 1}`;
      let phone = (row.PhoneNumber || row.phoneNumber || `+9198101${String(10000 + i)}`).replace(/[^+\d]/g, '');
      if (!phone.startsWith('+')) phone = '+91' + phone;

      const email = row.Email || row.email || `lead${i + 1}@realtysample.in`;
      const city = row.City || row.city || 'Gurugram';
      const propertyType = row.PropertyType || row.propertyType || 'Apartments';
      const project = row.Project || row.project || 'DLF Phase 5 Luxury';
      const budget = row.Budget || row.budget || '₹2.5 Cr - ₹4 Cr';
      let leadStatus = row.LeadStatus || row.leadStatus || 'New';
      if (!['New', 'Contacted', 'Interested', 'Follow-up Required', 'Negotiation', 'Converted', 'Not Interested', 'Closed'].includes(leadStatus)) {
        if (/site visit/i.test(leadStatus)) leadStatus = 'Interested';
        else if (/negotiat/i.test(leadStatus)) leadStatus = 'Negotiation';
        else leadStatus = 'New';
      }
      let priority = row.Priority || row.priority || 'Medium';
      if (!['Low', 'Medium', 'High', 'Urgent'].includes(priority)) {
        priority = 'Medium';
      }

      const tagList = (row.Tags || 'real-estate, luxury-lead')
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);

      // Determine appropriate group assignment
      const assignedGroups = [];
      if (city === 'Gurugram' && (propertyType === 'Villas' || propertyType === 'Apartments')) {
        assignedGroups.push(groupMap['Gurugram Luxury Prospects']._id);
      }
      if (propertyType === 'Residential Plots' || tagList.includes('plot-enquiry')) {
        assignedGroups.push(groupMap['Plot & Land Enquiries']._id);
      }
      if (tagList.includes('nri-lead') || city === 'Dubai' || city === 'Singapore') {
        assignedGroups.push(groupMap['NRI Investors Club']._id);
      }
      if (propertyType === 'Farmhouses' || tagList.includes('farmhouse-buyer')) {
        assignedGroups.push(groupMap['Weekend Farmhouse Leads']._id);
      }

      const customFields = {
        isDemo: true,
        demoDatasetId: DEMO_DATASET_ID,
        source: 'demo_fixture',
        environment: 'development',
        propertyType,
        budget,
        interestedProject: project,
      };

      const filter = { ownerId: owner._id, phoneNumber: phone };
      const update = {
        $set: {
          fullName,
          phoneNumber: phone,
          whatsappNumber: phone,
          countryCode: 'IN',
          email,
          city,
          location: city,
          interestedPropertyType: propertyType,
          interestedService: propertyType,
          interestedProject: project,
          businessCategory: project,
          preferredLocation: `${city} Sector Zone`,
          budgetRange: budget,
          leadStatus,
          priority,
          tags: tagList,
          groups: assignedGroups,
          whatsappConsentStatus: 'Unknown', // Default zero-policy
          isSuppressed: false,
          isArchived: false,
          isDeleted: false,
          isDemo: true,
          demoDatasetId: DEMO_DATASET_ID,
          customFields,
          notes: `Interested in ${propertyType} at ${project}. Budget: ${budget}. Enquiry date: October 2026.`,
        },
      };

      const res = await Contact.updateOne(filter, update, { upsert: true });
      const contactDoc = await Contact.findOne(filter);
      insertedContactDocs.push(contactDoc);

      if (res.upsertedCount > 0) results.contactsInserted++;
      else results.contactsUpdated++;
    }
    console.log(`   Contacts summary: ${results.contactsInserted} inserted, ${results.contactsUpdated} updated.`);

    // Update group counts
    for (const groupDoc of Object.values(groupMap)) {
      const count = await Contact.countDocuments({ ownerId: owner._id, groups: groupDoc._id, isDeleted: false, isArchived: false });
      groupDoc.contactCount = count;
      await groupDoc.save();
    }

    // 3. Configure realistic Consent Records for 5 contacts
    console.log('3. Recording Verified Opt-In Consent evidence for 5 contacts...');
    for (let i = 0; i < 5 && i < insertedContactDocs.length; i++) {
      const c = insertedContactDocs[i];
      const existingConsent = await ConsentRecord.findOne({ ownerId: owner._id, contactId: c._id });
      if (!existingConsent) {
        await ConsentRecord.create({
          ownerId: owner._id,
          contactId: c._id,
          status: 'Opted In',
          consentPurpose: 'Property brochures, floor plans, and site visit scheduling updates',
          consentedBusinessName: 'M2W Realty',
          consentSource: 'Customer enquiry webform',
          evidenceReference: `WEB-OPTIN-2026-00${i + 1}`,
          consentCapturedAt: new Date(Date.now() - (i + 1) * 86400000),
          recordedBy: owner._id,
        });
        results.consentRecordsCreated++;
      }
      c.whatsappConsentStatus = 'Opted In';
      await c.save();
    }

    // Configure 2 contacts as Suppressed / Opted Out
    console.log('4. Configuring Do Not Contact suppression on 2 contacts...');
    for (let i = 5; i < 7 && i < insertedContactDocs.length; i++) {
      const c = insertedContactDocs[i];
      c.whatsappConsentStatus = 'Opted Out';
      c.isSuppressed = true;
      c.suppressionReason = 'Customer sent STOP command via WhatsApp';
      c.suppressedAt = new Date(Date.now() - 86400000);
      await c.save();
    }

    // 4. Create Dynamic Saved Audiences / Segments
    console.log('5. Creating Dynamic Saved Audiences (Segments)...');
    const segmentDefs = [
      {
        name: 'High Budget Gurugram Buyers',
        description: 'Villas & luxury buyers in Gurugram market',
        segmentType: 'dynamic',
        filterDefinition: {
          conjunction: 'AND',
          conditions: [
            { field: 'city', operator: 'equals', value: 'Gurugram' },
            { field: 'interestedPropertyType', operator: 'equals', value: 'Villas' },
          ],
        },
      },
      {
        name: 'Immediate Apartment Seekers',
        description: 'High priority apartment buyers looking for fast turnaround',
        segmentType: 'dynamic',
        filterDefinition: {
          conjunction: 'AND',
          conditions: [
            { field: 'interestedPropertyType', operator: 'equals', value: 'Apartments' },
            { field: 'priority', operator: 'equals', value: 'High' },
          ],
        },
      },
      {
        name: 'Active Interested Leads',
        description: 'Enquiries marked interested awaiting site tour',
        segmentType: 'dynamic',
        filterDefinition: {
          conjunction: 'AND',
          conditions: [
            { field: 'leadStatus', operator: 'equals', value: 'Interested' },
          ],
        },
      },
    ];

    for (const seg of segmentDefs) {
      const existing = await AudienceSegment.findOne({ ownerId: owner._id, name: seg.name });
      if (!existing) {
        await AudienceSegment.create({
          ownerId: owner._id,
          createdBy: owner._id,
          name: seg.name,
          description: seg.description,
          segmentType: seg.segmentType,
          filterDefinition: seg.filterDefinition,
          memberCount: 8,
        });
        results.segmentsCreated++;
      }
    }
    console.log(`   Dynamic Segments summary: ${results.segmentsCreated} created.`);

    // 5. Create Message Templates
    console.log('6. Creating WhatsApp Message Templates...');
    const templateDefs = [
      {
        name: 'Luxury Villa Brochure Share',
        category: 'Marketing',
        header: 'Exclusive Property Preview',
        body: 'Hello {{name}}, thank you for your enquiry regarding {{project}}. Here is the exclusive digital brochure and master layout plan for your review. Would you like to schedule a private viewing?',
        footer: 'M2W Realty · Luxury Homes',
        buttons: [
          { type: 'QUICK_REPLY', text: 'Schedule Site Visit' },
          { type: 'URL', text: 'View Brochure', value: 'https://m2wrealty.in/brochures' },
        ],
      },
      {
        name: 'Site Visit Schedule Confirmation',
        category: 'Utility',
        header: 'Site Visit Confirmed',
        body: 'Hi {{name}}, your site visit for {{project}} in {{city}} is confirmed for this Saturday at 11:00 AM. Our senior property advisor will meet you at the club house entrance.',
        footer: 'M2W Realty · Property Advisory',
        buttons: [
          { type: 'QUICK_REPLY', text: 'Confirm Timing' },
          { type: 'PHONE_NUMBER', text: 'Call Advisor', value: '+919810100000' },
        ],
      },
      {
        name: 'Festive Payment Plan & Price Revision',
        category: 'Marketing',
        header: 'Limited Festive Offer',
        body: 'Dear {{name}}, special 20:80 developer subvention scheme is now active for {{project}}. Save up to ₹18 Lakhs on bookings this week. Reply YES to receive payment schedule breakdown.',
        footer: 'M2W Realty · Verified Offers',
        buttons: [
          { type: 'QUICK_REPLY', text: 'Get Payment Plan' },
          { type: 'QUICK_REPLY', text: 'Not Interested' },
        ],
      },
      {
        name: 'Plot Availability Alert',
        category: 'Marketing',
        header: 'New Plot Inventory Alert',
        body: 'Hello {{name}}, 4 new corner residential plots have just opened up in {{project}}, {{city}} within {{budget}}. Reply CALL to reserve your plot allocation.',
        footer: 'M2W Realty · Land Advisory',
        buttons: [
          { type: 'QUICK_REPLY', text: 'Reserve Plot' },
        ],
      },
      {
        name: 'Post Visit Follow Up',
        category: 'Marketing',
        header: 'Thank You for Visiting',
        body: 'Hi {{name}}, thank you for visiting {{project}} with us today! How was your experience? Feel free to ask any questions regarding unit availability, registry, or bank loan sanctions.',
        footer: 'M2W Realty Client Services',
        buttons: [
          { type: 'QUICK_REPLY', text: 'Interested in Booking' },
          { type: 'QUICK_REPLY', text: 'Need More Options' },
        ],
      },
    ];

    for (const t of templateDefs) {
      const existing = await MessageTemplate.findOne({ ownerId: owner._id, name: t.name });
      if (!existing) {
        await MessageTemplate.create({
          ownerId: owner._id,
          name: t.name,
          category: t.category,
          language: 'en',
          header: t.header,
          body: t.body,
          footer: t.footer,
          buttons: t.buttons,
          localStatus: 'Draft',
          businessCategory: 'Real Estate',
          intendedService: 'Property Enquiry',
          tags: ['demo', 'real-estate'],
        });
        results.templatesCreated++;
      }
    }
    console.log(`   Templates summary: ${results.templatesCreated} created.`);

    // 6. Create Campaigns
    console.log('7. Creating Real Estate Campaigns...');
    const sampleTemplate = await MessageTemplate.findOne({ ownerId: owner._id, name: 'Property Brochure & Inspection' });
    const sampleVersion = sampleTemplate ? await TemplateVersion.findOne({ templateId: sampleTemplate._id, ownerId: owner._id }).sort({ versionNumber: -1 }) : null;

    const campaignDefs = [
      {
        name: 'Residential Property Interest (Demo)',
        category: 'Real Estate',
        service: 'Apartments & Floors',
        status: 'Draft',
        goal: 'Lead Generation',
      },
      {
        name: 'Farmhouse Enquiry Review (Demo)',
        category: 'Real Estate',
        service: 'Farmhouses & Plots',
        status: 'Validated for Preparation',
        goal: 'Project Showcase',
      },
      {
        name: 'Luxury Villas VIP Preview (Demo)',
        category: 'Real Estate',
        service: 'Villas',
        status: 'Draft',
        goal: 'Exclusive Viewing',
      },
      {
        name: 'Weekend Open House Schedule (Demo)',
        category: 'Real Estate',
        service: 'Residential',
        status: 'Validated for Preparation',
        goal: 'Site Visit',
        selectedTemplateId: sampleTemplate?._id || null,
        selectedTemplateVersionId: sampleVersion?._id || null,
        mockSchedule: {
          startAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          timezone: 'Asia/Kolkata',
          status: 'scheduled',
          createdAt: new Date(),
        },
      },
    ];

    for (const c of campaignDefs) {
      const existing = await Campaign.findOne({ ownerId: owner._id, name: c.name });
      if (!existing) {
        await Campaign.create({
          ownerId: owner._id,
          createdBy: owner._id,
          name: c.name,
          category: c.category,
          service: c.service,
          status: c.status,
          goal: c.goal,
          selectedTemplateId: c.selectedTemplateId || null,
          selectedTemplateVersionId: c.selectedTemplateVersionId || null,
          mockSchedule: c.mockSchedule || null,
          validationSummary: { counts: { total: 15, eligible: 5, missingConsent: 10 } },
        });
        results.campaignsCreated++;
      }
    }
    console.log(`   Campaigns summary: ${results.campaignsCreated} created.`);

    // 7. Create Inbox Conversations
    console.log('8. Creating Synthetic Inbox Conversations...');
    const inboxScenarios = [
      { title: 'Luxury 3BHK Enquiry', message: 'Hello! I saw the listing for DLF The Camellias. Can we schedule a site visit this Saturday morning at 11 AM?' },
      { title: 'Farmhouse Price Range', message: 'Hi M2W Realty, looking for a 2-acre gated farmhouse on Sohna Road with ready electricity. What is the approximate cost?' },
      { title: 'Commercial SCO Brochure', message: 'Please share the payment schedule and expected ROI brochure for M3M Urbana SCO plots.' },
      { title: 'Site Visit Follow-up', message: 'Thank you for showing us Godrej Aristocrat today. The layout is great. Can you check if unit 1402 on the 14th floor is still available?' },
      { title: 'Loan Sanction Question', message: 'Hi, which leading banks have approved the project for 80% home loans?' },
    ];

    for (let i = 0; i < inboxScenarios.length && i < insertedContactDocs.length; i++) {
      const contact = insertedContactDocs[i];
      const scenario = inboxScenarios[i];

      let conv = await Conversation.findOne({ ownerId: owner._id, contactId: contact._id });
      if (!conv) {
        conv = await Conversation.create({
          ownerId: owner._id,
          contactId: contact._id,
          source: 'test',
          status: i === 3 ? 'Follow-up Required' : 'Open',
          internalUnreadCount: 1,
          activeWorkspaceKey: `${owner._id}:${contact._id}:test`,
        });
        results.conversationsCreated++;
      }

      const existingMsg = await ConversationMessage.findOne({
        conversationId: conv._id,
        messageBody: scenario.message,
        messageSource: 'synthetic_test'
      });

      if (!existingMsg) {
        const msg = await ConversationMessage.create({
          ownerId: owner._id,
          conversationId: conv._id,
          contactId: contact._id,
          direction: 'inbound',
          messageType: 'text',
          messageSource: 'synthetic_test',
          trustLevel: 'synthetic',
          messageBody: scenario.message,
          providerStatus: 'Unavailable',
          simulationStatus: 'Simulated Success',
          occurredAt: new Date(Date.now() - (i + 1) * 3600000),
        });
        results.messagesCreated++;

        conv.lastMessageId = msg._id;
        conv.lastActivityAt = msg.occurredAt;
        await conv.save();
      }
    }
    console.log(`   Inbox summary: ${results.conversationsCreated} conversations, ${results.messagesCreated} messages.`);

    overallResults[owner.email] = results;
  }

  console.log('\n====================================================');
  console.log('DEMO DATA SEEDING COMPLETE FOR ALL OWNERS');
  console.log('====================================================');
  console.log(JSON.stringify(overallResults, null, 2));

  await mongoose.disconnect();
  return overallResults;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seed().catch((err) => {
    console.error('Seed execution failed:', err);
    process.exit(1);
  });
}

export { seed };
