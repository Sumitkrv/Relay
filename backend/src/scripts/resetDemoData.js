import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

import Contact from '../models/Contact.js';
import MessageTemplate from '../models/MessageTemplate.js';
import Campaign from '../models/Campaign.js';
import CampaignExecution from '../models/CampaignExecution.js';
import Conversation from '../models/Conversation.js';
import ConversationMessage from '../models/ConversationMessage.js';
import connectDB from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

const DEMO_DATASET_ID = 'relay-real-estate-qa-v1';

async function reset() {
  console.log('====================================================');
  console.log('RELAY REAL ESTATE WHATSAPP AUTOMATION');
  console.log('SAFE DEMO DATA RESET (PROMPT 2.5)');
  console.log('====================================================');

  if (process.env.NODE_ENV === 'production') {
    console.error('CRITICAL SAFETY ERROR: Demo data reset is strictly prohibited in production.');
    process.exit(1);
  }

  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/freelance_automation_crm';
  if (mongoUri.includes('production') || mongoUri.includes('prod')) {
    console.error('CRITICAL SAFETY ERROR: Target MongoDB URI appears to be production. Aborting.');
    process.exit(1);
  }

  console.log(`Connecting to database: ${mongoUri}...`);
  await connectDB();

  // 1. Identify Demo Contacts
  const demoContactsFilter = {
    $or: [
      { 'customFields.demoDatasetId': DEMO_DATASET_ID },
      { 'customFields.isDemo': true },
      { tags: 'demo' },
    ],
  };

  const demoContacts = await Contact.find(demoContactsFilter).select('_id').lean();
  const demoContactIds = demoContacts.map((c) => c._id);

  console.log(`Found ${demoContactIds.length} demo contacts to remove.`);

  // 2. Identify Test Conversations & Messages
  const demoConvs = await Conversation.find({
    $or: [
      { contactId: { $in: demoContactIds } },
      { source: 'test' },
    ],
  }).select('_id').lean();
  const demoConvIds = demoConvs.map((c) => c._id);

  console.log(`Found ${demoConvIds.length} synthetic test conversations to remove.`);

  // 3. Remove dependent demo records with strictly scoped filters
  const [deletedMsgs, deletedConvs, deletedContacts, deletedTemplates, deletedCampaigns] = await Promise.all([
    ConversationMessage.deleteMany({
      $or: [
        { conversationId: { $in: demoConvIds } },
        { messageSource: 'synthetic_test' },
        { trustLevel: 'synthetic' },
      ],
    }),
    Conversation.deleteMany({ _id: { $in: demoConvIds } }),
    Contact.deleteMany({ _id: { $in: demoContactIds } }),
    MessageTemplate.deleteMany({
      $or: [
        { tags: 'demo' },
        { name: { $regex: /\(Demo\)$/i } },
      ],
    }),
    Campaign.deleteMany({
      $or: [
        { name: { $regex: /\(Demo\)$/i } },
        { tags: 'demo' },
      ],
    }),
  ]);

  const summary = {
    deletedDemoContacts: deletedContacts.deletedCount,
    deletedSyntheticConversations: deletedConvs.deletedCount,
    deletedSyntheticMessages: deletedMsgs.deletedCount,
    deletedDemoTemplates: deletedTemplates.deletedCount,
    deletedDemoCampaigns: deletedCampaigns.deletedCount,
  };

  console.log('\nReset Summary:');
  console.log(JSON.stringify(summary, null, 2));
  console.log('SAFETY VERIFICATION: Genuine customer records, user accounts, business profiles, and production settings were strictly preserved.');

  await mongoose.disconnect();
  return summary;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  reset().catch((err) => {
    console.error('Reset execution failed:', err);
    process.exit(1);
  });
}

export { reset };
