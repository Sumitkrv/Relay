import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { parse } from 'csv-parse/sync';
import Contact from '../models/Contact.js';
import ContactGroup from '../models/ContactGroup.js';
import AudienceSegment from '../models/AudienceSegment.js';
import MessageTemplate, { TemplateVersion } from '../models/MessageTemplate.js';
import Campaign from '../models/Campaign.js';
import CampaignExecution from '../models/CampaignExecution.js';
import CampaignMessageJob from '../models/CampaignMessageJob.js';
import Conversation from '../models/Conversation.js';
import ConversationMessage from '../models/ConversationMessage.js';
import ConsentRecord from '../models/ConsentRecord.js';
import Message from '../models/Message.js';
import MessageEvent from '../models/MessageEvent.js';
import User from '../models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../../');
const FIXTURES_DIR = path.join(ROOT_DIR, 'test-fixtures');

export const DEMO_DATASET_ID = 'relay-real-estate-qa-v1';

export async function getFixturesStatus(ownerId) {
  const contactsCsvPath = path.join(FIXTURES_DIR, 'Relay_Demo_Contacts_60.csv');
  const testPackXlsxPath = path.join(FIXTURES_DIR, 'Relay_Demo_Test_Pack.xlsx');
  const edgeCasesCsvPath = path.join(FIXTURES_DIR, 'Relay_Import_Edge_Cases_12.csv');

  const files = [
    {
      name: 'Relay_Demo_Contacts_60.csv',
      exists: fs.existsSync(contactsCsvPath),
      size: fs.existsSync(contactsCsvPath) ? fs.statSync(contactsCsvPath).size : 0,
      path: contactsCsvPath
    },
    {
      name: 'Relay_Demo_Test_Pack.xlsx',
      exists: fs.existsSync(testPackXlsxPath),
      size: fs.existsSync(testPackXlsxPath) ? fs.statSync(testPackXlsxPath).size : 0,
      path: testPackXlsxPath
    },
    {
      name: 'Relay_Import_Edge_Cases_12.csv',
      exists: fs.existsSync(edgeCasesCsvPath),
      size: fs.existsSync(edgeCasesCsvPath) ? fs.statSync(edgeCasesCsvPath).size : 0,
      path: edgeCasesCsvPath
    }
  ];

  const demoContactsFilter = {
    ownerId,
    $or: [
      { 'customFields.demoDatasetId': DEMO_DATASET_ID },
      { 'customFields.isDemo': true },
      { tags: 'demo' }
    ]
  };

  const [demoContactsCount, totalContactsCount, demoConversationsCount, demoCampaignsCount] = await Promise.all([
    Contact.countDocuments(demoContactsFilter),
    Contact.countDocuments({ ownerId, isDeleted: false }),
    Conversation.countDocuments({ ownerId, source: { $in: ['test', 'synthetic_test'] } }),
    Campaign.countDocuments({ ownerId, isDemo: true })
  ]);

  return {
    fixturesAvailable: files.every(f => f.exists),
    files,
    demoDatasetId: DEMO_DATASET_ID,
    counts: {
      demoContacts: demoContactsCount,
      totalContacts: totalContactsCount,
      demoConversations: demoConversationsCount,
      demoCampaigns: demoCampaignsCount
    }
  };
}

export async function seedDemoDataForOwner(ownerId) {
  if (process.env.NODE_ENV === 'production') {
    const err = new Error('Demo data seeding is strictly prohibited in production mode.');
    err.status = 403;
    err.code = 'PROD_FORBIDDEN';
    throw err;
  }

  const owner = await User.findById(ownerId);
  if (!owner) throw new Error('Owner workspace not found.');

  const contactsCsvPath = path.join(FIXTURES_DIR, 'Relay_Demo_Contacts_60.csv');
  let csvRecords = [];
  if (fs.existsSync(contactsCsvPath)) {
    const raw = fs.readFileSync(contactsCsvPath, 'utf8');
    csvRecords = parse(raw, { columns: true, skip_empty_lines: true, trim: true });
  }

  const results = {
    groupsCreated: 0,
    contactsInserted: 0,
    contactsUpdated: 0,
    consentRecordsCreated: 0,
    segmentsCreated: 0,
    templatesCreated: 0,
    campaignsCreated: 0,
    conversationsCreated: 0
  };

  // 1. Contact Groups
  const groupDefs = [
    { name: 'Gurugram Luxury Prospects', color: '#0D9488', description: 'Buyers seeking premium apartments & villas in Gurugram' },
    { name: 'Plot & Land Enquiries', color: '#3B82F6', description: 'Prospects interested in residential and commercial plots' },
    { name: 'NRI Investors Club', color: '#8B5CF6', description: 'High net worth overseas buyers and cross-border investors' },
    { name: 'Weekend Farmhouse Leads', color: '#F59E0B', description: 'Clients looking for 1 to 5 acre gated retreat properties' }
  ];

  const groupMap = {};
  for (const g of groupDefs) {
    const normalizedName = g.name.toLowerCase().trim();
    let groupDoc = await ContactGroup.findOne({ ownerId, normalizedName });
    if (!groupDoc) {
      groupDoc = await ContactGroup.create({
        ownerId,
        name: g.name,
        normalizedName,
        color: g.color,
        description: g.description,
        contactCount: 0
      });
      results.groupsCreated++;
    }
    groupMap[g.name] = groupDoc;
  }

  // 2. Contacts
  const insertedContactDocs = [];
  for (let i = 0; i < csvRecords.length; i++) {
    const row = csvRecords[i];
    const phone = row.phoneNumber || row.Phone || row['Phone Number'] || `+91981100${String(i).padStart(4, '0')}`;
    const name = row.name || row.Name || row.fullName || `Demo Prospect ${i + 1}`;
    const email = row.email || row.Email || `demo.prospect.${i + 1}@relay-realestate.test`;
    const city = row.city || row.City || 'Gurugram';
    const propertyType = row.propertyType || row['Property Type'] || 'Apartment';
    const consentStatus = row.consentStatus || row['Consent Status'] || 'Opted In';

    let groupIds = [];
    if (i % 4 === 0 && groupMap['Gurugram Luxury Prospects']) groupIds.push(groupMap['Gurugram Luxury Prospects']._id);
    if (i % 4 === 1 && groupMap['Plot & Land Enquiries']) groupIds.push(groupMap['Plot & Land Enquiries']._id);
    if (i % 4 === 2 && groupMap['NRI Investors Club']) groupIds.push(groupMap['NRI Investors Club']._id);
    if (i % 4 === 3 && groupMap['Weekend Farmhouse Leads']) groupIds.push(groupMap['Weekend Farmhouse Leads']._id);

    const contactDoc = await Contact.findOneAndUpdate(
      { ownerId, phoneNumber: phone },
      {
        $set: {
          fullName: name,
          email,
          location: city,
          industry: propertyType,
          leadStatus: i % 5 === 0 ? 'Converted' : i % 3 === 0 ? 'Interested' : 'New',
          whatsappConsentStatus: consentStatus,
          whatsappConsentDate: new Date(),
          tags: ['demo', 'real-estate', city.toLowerCase()],
          groupIds,
          isDeleted: false,
          isArchived: false,
          customFields: {
            isDemo: true,
            demoDatasetId: DEMO_DATASET_ID,
            propertyInterest: propertyType,
            budget: i % 2 === 0 ? '₹2.5 Cr' : '₹1.5 Cr'
          }
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    if (contactDoc) {
      insertedContactDocs.push(contactDoc);
      results.contactsInserted++;

      // Consent record
      await ConsentRecord.create({
        ownerId,
        contactId: contactDoc._id,
        phoneNumber: contactDoc.phoneNumber,
        status: consentStatus,
        source: 'DEMO_DATASET_IMPORT',
        ipAddress: '127.0.0.1',
        businessName: owner.businessName || 'M2W Luxury Realty',
        purpose: 'Real estate portfolio updates and project launches (Simulation)',
        notes: 'Pre-seeded synthetic demo record for offline testing.'
      });
      results.consentRecordsCreated++;
    }
  }

  // 3. Demo Template
  const templateName = 'Luxury_Property_Brochure_Demo';
  let demoTemplate = await MessageTemplate.findOne({ ownerId, name: templateName, isArchived: false });
  if (!demoTemplate) {
    demoTemplate = await MessageTemplate.create({
      ownerId,
      name: templateName,
      description: 'Official luxury property brochure presentation with pricing and floor layouts.',
      category: 'Marketing',
      language: 'en',
      headerType: 'DOCUMENT',
      header: 'Brochure: Prestige Golf Villas',
      body: 'Hi {{name}}, here is the digital brochure and floor plans for {{project}} in {{city}}. Units start from {{budget}} with flexible 20:80 plans.',
      footer: 'Reply STOP to unsubscribe',
      buttons: [
        { type: 'QUICK_REPLY', text: 'Schedule Visit', value: 'VISIT' },
        { type: 'URL', text: 'View Master Plan', value: 'https://relaycrm.io/master-plan' }
      ],
      internalVariables: ['name', 'project', 'city', 'budget'],
      localStatus: 'Ready for Review',
      providerStatus: 'Not Submitted',
      mockProviderApprovalStatus: 'Simulated Approved'
    });
    results.templatesCreated++;
  }

  // 4. Demo Conversation for first contact
  if (insertedContactDocs.length > 0) {
    const demoContact = insertedContactDocs[0];
    let demoConv = await Conversation.findOne({ ownerId, contactId: demoContact._id });
    if (!demoConv) {
      demoConv = await Conversation.create({
        ownerId,
        contactId: demoContact._id,
        status: 'Open',
        source: 'synthetic_test',
        automationStatus: 'ACTIVE',
        lastMessageText: 'Hi, please send the brochure.',
        lastMessageAt: new Date(),
        lastMessageDirection: 'inbound',
        internalUnreadCount: 1
      });

      await ConversationMessage.create({
        ownerId,
        conversationId: demoConv._id,
        contactId: demoContact._id,
        direction: 'inbound',
        messageType: 'TEXT',
        body: 'Hi, please send the brochure.',
        providerMessageId: `mock_msg_demo_${Date.now()}`,
        status: 'DELIVERED',
        deliveredAt: new Date(),
        metadata: { source: 'SYNTHETIC_TEST', isSimulated: true }
      });

      results.conversationsCreated++;
    }
  }

  return {
    success: true,
    results,
    notice: 'Demo dataset safely seeded for this workspace in MOCK mode.'
  };
}

export async function resetDemoDataForOwner(ownerId) {
  if (process.env.NODE_ENV === 'production') {
    const err = new Error('Demo data reset is strictly prohibited in production mode.');
    err.status = 403;
    err.code = 'PROD_FORBIDDEN';
    throw err;
  }

  // 1. Identify Demo Contacts
  const demoContactsFilter = {
    ownerId,
    $or: [
      { 'customFields.demoDatasetId': DEMO_DATASET_ID },
      { 'customFields.isDemo': true },
      { tags: 'demo' }
    ]
  };

  const demoContacts = await Contact.find(demoContactsFilter).select('_id').lean();
  const demoContactIds = demoContacts.map(c => c._id);

  // 2. Identify Demo Conversations
  const demoConvs = await Conversation.find({
    ownerId,
    $or: [
      { contactId: { $in: demoContactIds } },
      { source: { $in: ['test', 'synthetic_test'] } }
    ]
  }).select('_id').lean();
  const demoConvIds = demoConvs.map(c => c._id);

  // Execute safe deletions
  const [
    delMessages,
    delConvs,
    delConsent,
    delContacts,
    delCampaigns,
    delTemplates
  ] = await Promise.all([
    ConversationMessage.deleteMany({ ownerId, conversationId: { $in: demoConvIds } }),
    Conversation.deleteMany({ ownerId, _id: { $in: demoConvIds } }),
    ConsentRecord.deleteMany({ ownerId, $or: [{ contactId: { $in: demoContactIds } }, { source: 'DEMO_DATASET_IMPORT' }] }),
    Contact.deleteMany({ ownerId, _id: { $in: demoContactIds } }),
    Campaign.deleteMany({ ownerId, isDemo: true }),
    MessageTemplate.deleteMany({ ownerId, name: 'Luxury_Property_Brochure_Demo' })
  ]);

  return {
    success: true,
    deleted: {
      contacts: delContacts.deletedCount,
      conversations: delConvs.deletedCount,
      messages: delMessages.deletedCount,
      consentRecords: delConsent.deletedCount,
      campaigns: delCampaigns.deletedCount,
      templates: delTemplates.deletedCount
    },
    notice: 'Demo data cleared safely. Workspace production records remain preserved.'
  };
}
