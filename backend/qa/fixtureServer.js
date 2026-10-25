// Browser verification only: a disposable MongoDB, synthetic records, no workers or providers.
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { MongoMemoryServer } from 'mongodb-memory-server';
import User from '../src/models/User.js';
import Workspace from '../src/models/Workspace.js';
import WorkspaceMembership from '../src/models/WorkspaceMembership.js';
import BusinessProfile from '../src/models/BusinessProfile.js';
import Contact from '../src/models/Contact.js';
import Conversation from '../src/models/Conversation.js';
import ConversationMessage from '../src/models/ConversationMessage.js';
import MessageTemplate from '../src/models/MessageTemplate.js';
import { getIndustryConfig } from '../src/config/industries/industryRegistry.js';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'isolated-relay-browser-qa-secret-at-least-32';
process.env.EMAIL_PROVIDER = 'inmemory';
process.env.APP_MODE = 'test';
const { default: app } = await import('../src/app.js');
const mongo = await MongoMemoryServer.create();
await mongoose.connect(mongo.getUri());
for (const [i, industryKey] of ['real_estate', 'clinic', 'gym'].entries()) {
  const name = industryKey === 'real_estate' ? 'M2W Realty (isolated QA)' : industryKey === 'clinic' ? 'Clinic QA' : 'Fitness QA';
  const email = `${industryKey}@isolated.example.test`;
  const user = await User.create({ name: 'Isolated QA Operator', email, passwordHash: await bcrypt.hash('IsolatedTest123!', 10), businessName: name, isEmailVerified: true, emailVerifiedAt: new Date() });
  const workspace = await Workspace.create({ name, slug: `qa-${industryKey}`, industryKey, businessEmail: email, businessPhone: '+14155550100', city: 'QA City', createdBy: user._id, status: 'ACTIVE' });
  await WorkspaceMembership.create({ workspaceId: workspace._id, userId: user._id, role: 'OWNER', status: 'ACTIVE', isDefaultWorkspace: true });
  await BusinessProfile.create({ ownerId: user._id, workspaceId: workspace._id, legalOrTradingName: name, displayName: name, businessCategory: getIndustryConfig(industryKey).displayLabel, email });
  const contact = await Contact.create({ ownerId: user._id, workspaceId: workspace._id, fullName: 'Isolated QA Contact', phoneNumber: `+1415555010${i + 1}`, email: `contact-${i}@isolated.example.test`, leadStatus: 'New', whatsappConsentStatus: 'Unknown', isDemo: true, ...(i === 0 ? { interestedProject: 'QA Project', interestedPropertyType: 'Apartment', budgetRange: 'QA budget', preferredLocation: 'QA District' } : {}) });
  await MessageTemplate.create({ ownerId: user._id, workspaceId: workspace._id, name: `qa_${industryKey}_saved`, category: 'Utility', body: 'Hello {{customer_name}}, thank you for your enquiry to {{business_name}}.', localStatus: 'Draft' });
  const conversation = await Conversation.create({ ownerId: user._id, workspaceId: workspace._id, contactId: contact._id, source: 'test', status: 'Open' });
  const message = await ConversationMessage.create({ ownerId: user._id, workspaceId: workspace._id, conversationId: conversation._id, contactId: contact._id, direction: 'inbound', messageBody: 'Isolated QA enquiry', messageSource: 'synthetic_test', trustLevel: 'synthetic', providerStatus: 'Unavailable' });
  conversation.lastMessageId = message._id;
  await conversation.save();
}
const server = app.listen(5001, '127.0.0.1', () => console.log('Isolated QA API ready on 127.0.0.1:5001; disposable database only.'));
async function close() { server.close(); await mongoose.disconnect(); await mongo.stop(); process.exit(0); }
process.on('SIGTERM', close);
process.on('SIGINT', close);
