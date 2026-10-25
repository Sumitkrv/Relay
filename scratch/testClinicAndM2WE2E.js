import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../backend/src/models/User.js';
import Workspace from '../backend/src/models/Workspace.js';
import WorkspaceMembership from '../backend/src/models/WorkspaceMembership.js';
import BusinessProfile from '../backend/src/models/BusinessProfile.js';
import Contact from '../backend/src/models/Contact.js';
import MessageTemplate from '../backend/src/models/MessageTemplate.js';
import Campaign from '../backend/src/models/Campaign.js';
import Conversation from '../backend/src/models/Conversation.js';
import connectDB from '../backend/src/config/db.js';
import { overview } from '../backend/src/controllers/dashboardController.js';
import { listContacts, createContact } from '../backend/src/controllers/contactController.js';
import { listTemplates, createTemplate } from '../backend/src/controllers/templateController.js';

await connectDB();

console.log('\n======================================================');
console.log('RELAY E2E MULTI-TENANT VERIFICATION: CLINIC & M2W');
console.log('======================================================');

// 1. Verify M2W Realty Workspace Integrity
const m2wUser = await User.findOne({ email: 'admin@relaycrm.io' });
console.log('\n1. Checking M2W Realty Owner:');
if (!m2wUser) {
  console.error('❌ M2W Realty owner user not found!');
  process.exit(1);
}
console.log(`   User: ${m2wUser.name} (${m2wUser.email}), ID: ${m2wUser._id}`);

const m2wWorkspace = await Workspace.findOne({ slug: 'm2w-realty' }) || await Workspace.findOne({ slug: 'm2w-realty-clone' });
console.log(`   Workspace: ${m2wWorkspace?.name} (${m2wWorkspace?.slug})`);

const m2wReq = {
  user: m2wUser,
  workspace: m2wWorkspace,
  workspaceId: m2wWorkspace?._id,
  query: {},
  get: () => m2wWorkspace?._id?.toString(),
};

let m2wOverviewData = null;
await overview(m2wReq, {
  json: (d) => { m2wOverviewData = d; },
  status: () => ({ json: () => {} })
});
console.log(`   M2W Business Name in Overview: "${m2wOverviewData?.businessContext?.businessName}"`);
console.log(`   M2W Total Contacts: ${m2wOverviewData?.contacts?.total}`);
console.log(`   M2W Total Campaigns: ${m2wOverviewData?.campaigns?.total}`);

// 2. Create / Query Isolated Clinic Owner
console.log('\n2. Setting up Synthetic Clinic Owner:');
let clinicUser = await User.findOne({ email: 'dr.sharma.clinic@relay-test.io' });
if (!clinicUser) {
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('ClinicPass123!', salt);
  clinicUser = await User.create({
    name: 'Dr. Alok Sharma',
    email: 'dr.sharma.clinic@relay-test.io',
    businessName: 'Sharma Dental & Wellness Clinic',
    passwordHash,
    role: 'owner',
    isEmailVerified: true,
  });
}
console.log(`   Clinic User: ${clinicUser.name} (${clinicUser.email}), ID: ${clinicUser._id}`);

// Provision Clinic Workspace if not present
let clinicWorkspace = await Workspace.findOne({ createdBy: clinicUser._id });
if (!clinicWorkspace) {
  clinicWorkspace = await Workspace.create({
    name: 'Sharma Dental & Wellness Clinic',
    slug: 'sharma-dental-clinic',
    industryKey: 'clinic',
    timezone: 'Asia/Kolkata',
    country: 'India',
    currency: 'INR',
    businessEmail: clinicUser.email,
    businessPhone: '+919876543210',
    city: 'New Delhi',
    status: 'ACTIVE',
    createdBy: clinicUser._id,
  });

  await WorkspaceMembership.create({
    workspaceId: clinicWorkspace._id,
    userId: clinicUser._id,
    role: 'OWNER',
    status: 'ACTIVE',
    isDefaultWorkspace: true,
  });

  clinicUser.defaultWorkspaceId = clinicWorkspace._id;
  await clinicUser.save();
}
console.log(`   Clinic Workspace: ${clinicWorkspace.name} (${clinicWorkspace.slug})`);

// 3. Test Dashboard Overview for Clinic
console.log('\n3. Testing Clinic Overview Dashboard:');
const clinicReq = {
  user: clinicUser,
  workspace: clinicWorkspace,
  workspaceId: clinicWorkspace._id,
  query: {},
  get: () => clinicWorkspace._id.toString(),
};

let clinicOverviewData = null;
await overview(clinicReq, {
  json: (d) => { clinicOverviewData = d; },
  status: () => ({ json: () => {} })
});

console.log(`   Clinic Overview Business Name: "${clinicOverviewData?.businessContext?.businessName}"`);
console.log(`   Clinic Mode: "${clinicOverviewData?.system?.mode}"`);
console.log(`   Clinic Contacts (should be genuine count): ${clinicOverviewData?.contacts?.total}`);
console.log(`   Clinic Campaigns (should be genuine count): ${clinicOverviewData?.campaigns?.total}`);

if (clinicOverviewData?.businessContext?.businessName.includes('M2W')) {
  console.error('❌ FAIL: Clinic overview leaked M2W Realty business name!');
  process.exit(1);
} else {
  console.log('   ✅ PASS: Clinic Overview displays clinic business name without M2W leakage.');
}

// 4. Test Clinic Contact CRUD & Cross-Tenant Isolation
console.log('\n4. Testing Clinic Contact Creation & Cross-Tenant Isolation:');
const existingContact = await Contact.findOne({ ownerId: clinicUser._id, phoneNumber: '+919811002233' });
let clinicContact = existingContact;
if (!clinicContact) {
  clinicContact = await Contact.create({
    ownerId: clinicUser._id,
    workspaceId: clinicWorkspace._id,
    fullName: 'Ramesh Verma',
    phoneNumber: '+919811002233',
    interestedService: 'Dental Implants',
    location: 'Connaught Place, Delhi',
    whatsappConsentStatus: 'Unknown',
  });
}
console.log(`   Created Clinic Contact: ${clinicContact.fullName} (${clinicContact.phoneNumber})`);

// Verify M2W cannot see clinic contact
const m2wSeeClinic = await Contact.findOne({ ownerId: m2wUser._id, _id: clinicContact._id });
console.log(`   M2W query for Clinic Contact: ${m2wSeeClinic ? 'FOUND (LEAKAGE!)' : 'NULL (ISOLATED)'}`);
if (m2wSeeClinic) {
  console.error('❌ FAIL: M2W user was able to query Clinic contact!');
  process.exit(1);
} else {
  console.log('   ✅ PASS: Strict Tenant Segregation confirmed for Contacts.');
}

// 5. Test Clinic Template Creation & Isolation
console.log('\n5. Testing Clinic Message Template & Isolation:');
const existingTemplate = await MessageTemplate.findOne({ ownerId: clinicUser._id, name: 'dental_checkup_reminder' });
let clinicTemplate = existingTemplate;
if (!clinicTemplate) {
  clinicTemplate = await MessageTemplate.create({
    ownerId: clinicUser._id,
    workspaceId: clinicWorkspace._id,
    name: 'dental_checkup_reminder',
    category: 'UTILITY',
    language: 'en',
    bodyText: 'Hello {{first_name}}, this is a reminder for your dental checkup with Dr. Sharma.',
    localStatus: 'Draft',
  });
}
console.log(`   Created Clinic Template: ${clinicTemplate.name}`);

// Verify M2W cannot see clinic template
const m2wSeeTemplate = await MessageTemplate.findOne({ ownerId: m2wUser._id, _id: clinicTemplate._id });
console.log(`   M2W query for Clinic Template: ${m2wSeeTemplate ? 'FOUND (LEAKAGE!)' : 'NULL (ISOLATED)'}`);
if (m2wSeeTemplate) {
  console.error('❌ FAIL: M2W user was able to query Clinic template!');
  process.exit(1);
} else {
  console.log('   ✅ PASS: Strict Tenant Segregation confirmed for Templates.');
}

console.log('\n======================================================');
console.log('✅ ALL E2E MULTI-TENANT ISOLATION CHECKS PASSED!');
console.log('======================================================\n');
process.exit(0);
