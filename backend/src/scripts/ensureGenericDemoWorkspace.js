import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import User from '../models/User.js';
import Workspace from '../models/Workspace.js';
import WorkspaceMembership from '../models/WorkspaceMembership.js';
import BusinessProfile from '../models/BusinessProfile.js';
import Contact from '../models/Contact.js';

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/relay_demo';
  await mongoose.connect(uri);
  console.log('Connected to MongoDB:', uri);

  // 1. Primary Generic Business: Apex Commercial Traders
  const emailA = 'owner.generic@relay-demo.test';
  const password = 'password123';
  const slugA = 'apex-commercial';
  const businessNameA = 'Apex Commercial Traders';

  let userA = await User.findOne({ email: emailA });
  if (!userA) {
    const passwordHash = await bcrypt.hash(password, 10);
    userA = await User.create({
      name: 'Rajesh Sharma',
      businessName: businessNameA,
      email: emailA,
      passwordHash,
      role: 'owner',
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
      accountStatus: 'ACTIVE',
    });
    console.log('Created Generic Business user A:', userA._id);
  } else {
    userA.passwordHash = await bcrypt.hash(password, 10);
    userA.isEmailVerified = true;
    userA.accountStatus = 'ACTIVE';
    await userA.save();
    console.log('Updated existing Generic Business user A credentials:', userA._id);
  }

  let wsA = await Workspace.findOne({ slug: slugA });
  if (!wsA) {
    wsA = await Workspace.create({
      name: businessNameA,
      slug: slugA,
      industryKey: 'generic_business',
      businessEmail: emailA,
      businessPhone: '+919876500900',
      city: 'Mumbai',
      country: 'India',
      timezone: 'Asia/Kolkata',
      status: 'ACTIVE',
      onboardingStatus: 'COMPLETED',
      createdBy: userA._id,
      settings: {
        whatsappConnection: {
          status: 'MOCK_SIMULATED_READY',
          businessPhone: '+919876500900',
          connectedAt: new Date(),
        },
      },
    });
    console.log('Created Generic Business workspace A:', wsA._id);
  } else {
    wsA.industryKey = 'generic_business';
    wsA.name = businessNameA;
    await wsA.save();
    console.log('Found existing Generic Business workspace A:', wsA._id);
  }

  await WorkspaceMembership.findOneAndUpdate(
    { workspaceId: wsA._id, userId: userA._id },
    { $set: { role: 'OWNER', status: 'ACTIVE', isDefaultWorkspace: true } },
    { upsert: true, new: true }
  );

  if (!userA.defaultWorkspaceId || String(userA.defaultWorkspaceId) !== String(wsA._id)) {
    userA.defaultWorkspaceId = wsA._id;
    await userA.save();
  }

  await BusinessProfile.findOneAndUpdate(
    { workspaceId: wsA._id },
    {
      $set: {
        ownerId: userA._id,
        businessName: businessNameA,
        legalOrTradingName: businessNameA,
        displayName: businessNameA,
        businessCategory: 'Commercial & Trading',
        industry: 'generic_business',
        businessEmail: emailA,
        businessPhone: '+919876500900',
        city: 'Mumbai',
        state: 'Maharashtra',
        country: 'India',
        address: 'Unit 402, Trade Link Towers, Lower Parel, Mumbai, Maharashtra 400013',
        website: 'https://apexcommercial.demo.test',
        operationalStatus: 'OPERATIONAL',
      },
    },
    { upsert: true, new: true }
  );

  // Add 3 demo contacts for Apex Commercial Traders if none exist
  const countA = await Contact.countDocuments({ workspaceId: wsA._id });
  if (countA === 0) {
    const demoContactsA = [
      {
        ownerId: userA._id,
        workspaceId: wsA._id,
        fullName: 'Vikram Singhal',
        phoneNumber: '+919876540001',
        email: 'vikram.singhal@industrialtools.demo',
        companyName: 'Singhal Tools & Hardware',
        city: 'Mumbai',
        state: 'Maharashtra',
        country: 'India',
        leadSource: 'Website Enquiry',
        leadStatus: 'Interested',
        priority: 'High',
        interestedService: 'Industrial Power Tools',
        businessCategory: 'Commercial & Trading',
        industryData: {
          companyName: 'Singhal Tools & Hardware',
          productServiceInterest: 'Industrial Power Tools',
          enquiryType: 'Product Information',
          preferredContactMethod: 'WhatsApp Message',
          callbackRequested: 'Yes - Afternoon',
          followUpDate: new Date(Date.now() + 86400000 * 2),
        },
        whatsappConsentStatus: 'Opted In',
        isDemo: true,
      },
      {
        ownerId: userA._id,
        workspaceId: wsA._id,
        fullName: 'Sneha Kapoor',
        phoneNumber: '+919876540002',
        email: 'sneha.kapoor@globallogistics.demo',
        companyName: 'Global Logistics Hub',
        city: 'Pune',
        state: 'Maharashtra',
        country: 'India',
        leadSource: 'WhatsApp Inbound',
        leadStatus: 'New',
        priority: 'Urgent',
        interestedService: 'Warehouse Packaging Solutions',
        businessCategory: 'Commercial & Trading',
        industryData: {
          companyName: 'Global Logistics Hub',
          productServiceInterest: 'Warehouse Packaging Solutions',
          enquiryType: 'Quotation Request',
          preferredContactMethod: 'Email',
          callbackRequested: 'No',
          followUpDate: new Date(Date.now() + 86400000),
        },
        whatsappConsentStatus: 'Opted In',
        isDemo: true,
      },
      {
        ownerId: userA._id,
        workspaceId: wsA._id,
        fullName: 'Amit Deshmukh',
        phoneNumber: '+919876540003',
        email: 'amit@deshmukhelectricals.demo',
        companyName: 'Deshmukh Electricals',
        city: 'Nagpur',
        state: 'Maharashtra',
        country: 'India',
        leadSource: 'Customer Referral',
        leadStatus: 'Contacted',
        priority: 'Medium',
        interestedService: 'Commercial Transformers',
        businessCategory: 'Commercial & Trading',
        industryData: {
          companyName: 'Deshmukh Electricals',
          productServiceInterest: 'Commercial Transformers',
          enquiryType: 'General Enquiry',
          preferredContactMethod: 'Phone Call',
          callbackRequested: 'Yes - Morning',
          followUpDate: new Date(Date.now() + 86400000 * 3),
        },
        whatsappConsentStatus: 'Unknown',
        isDemo: true,
      },
    ];

    await Contact.insertMany(demoContactsA);
    console.log(`Seeded ${demoContactsA.length} demo contacts for Apex Commercial Traders.`);
  }

  // 2. Secondary Generic Business for Stage 15 Isolation Testing: Zenith Wholesale Distributors
  const emailB = 'owner.zenith@relay-demo.test';
  const slugB = 'zenith-wholesale';
  const businessNameB = 'Zenith Wholesale Distributors';

  let userB = await User.findOne({ email: emailB });
  if (!userB) {
    const passwordHash = await bcrypt.hash(password, 10);
    userB = await User.create({
      name: 'Sunil Verma',
      businessName: businessNameB,
      email: emailB,
      passwordHash,
      role: 'owner',
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
      accountStatus: 'ACTIVE',
    });
    console.log('Created Generic Business user B:', userB._id);
  } else {
    userB.passwordHash = await bcrypt.hash(password, 10);
    userB.isEmailVerified = true;
    userB.accountStatus = 'ACTIVE';
    await userB.save();
    console.log('Updated existing Generic Business user B credentials:', userB._id);
  }

  let wsB = await Workspace.findOne({ slug: slugB });
  if (!wsB) {
    wsB = await Workspace.create({
      name: businessNameB,
      slug: slugB,
      industryKey: 'generic_business',
      businessEmail: emailB,
      businessPhone: '+919876500911',
      city: 'Ahmedabad',
      country: 'India',
      timezone: 'Asia/Kolkata',
      status: 'ACTIVE',
      onboardingStatus: 'COMPLETED',
      createdBy: userB._id,
      settings: {
        whatsappConnection: {
          status: 'MOCK_SIMULATED_READY',
          businessPhone: '+919876500911',
          connectedAt: new Date(),
        },
      },
    });
    console.log('Created Generic Business workspace B:', wsB._id);
  } else {
    wsB.industryKey = 'generic_business';
    wsB.name = businessNameB;
    await wsB.save();
    console.log('Found existing Generic Business workspace B:', wsB._id);
  }

  await WorkspaceMembership.findOneAndUpdate(
    { workspaceId: wsB._id, userId: userB._id },
    { $set: { role: 'OWNER', status: 'ACTIVE', isDefaultWorkspace: true } },
    { upsert: true, new: true }
  );

  if (!userB.defaultWorkspaceId || String(userB.defaultWorkspaceId) !== String(wsB._id)) {
    userB.defaultWorkspaceId = wsB._id;
    await userB.save();
  }

  await BusinessProfile.findOneAndUpdate(
    { workspaceId: wsB._id },
    {
      $set: {
        ownerId: userB._id,
        businessName: businessNameB,
        legalOrTradingName: businessNameB,
        displayName: businessNameB,
        businessCategory: 'Wholesale & Distribution',
        industry: 'generic_business',
        businessEmail: emailB,
        businessPhone: '+919876500911',
        city: 'Ahmedabad',
        state: 'Gujarat',
        country: 'India',
        address: 'Wholesale Grain Market, APMC Complex, Ahmedabad, Gujarat 380001',
        website: 'https://zenithwholesale.demo.test',
        operationalStatus: 'OPERATIONAL',
      },
    },
    { upsert: true, new: true }
  );

  const countB = await Contact.countDocuments({ workspaceId: wsB._id });
  if (countB === 0) {
    const demoContactsB = [
      {
        ownerId: userB._id,
        workspaceId: wsB._id,
        fullName: 'Kavita Nair',
        phoneNumber: '+919876540055',
        email: 'kavita@zenithretailers.demo',
        companyName: 'Zenith Retail Outlets',
        city: 'Ahmedabad',
        state: 'Gujarat',
        country: 'India',
        leadSource: 'Trade Show / Exhibition',
        leadStatus: 'Interested',
        priority: 'High',
        interestedService: 'Wholesale Grain Supplies',
        businessCategory: 'Wholesale & Distribution',
        industryData: {
          companyName: 'Zenith Retail Outlets',
          productServiceInterest: 'Wholesale Grain Supplies',
          enquiryType: 'Quotation Request',
          preferredContactMethod: 'WhatsApp Message',
          callbackRequested: 'Yes - Afternoon',
          followUpDate: new Date(Date.now() + 86400000 * 2),
        },
        whatsappConsentStatus: 'Opted In',
        isDemo: true,
      },
    ];
    await Contact.insertMany(demoContactsB);
    console.log(`Seeded ${demoContactsB.length} demo contacts for Zenith Wholesale Distributors.`);
  }

  console.log('\n=== Generic Business Workspaces Setup Completed Successfully ===');
  console.log('Apex Commercial Traders (A):');
  console.log('  Login: owner.generic@relay-demo.test / password123');
  console.log('  Workspace ID:', wsA._id.toString());
  console.log('Zenith Wholesale Distributors (B):');
  console.log('  Login: owner.zenith@relay-demo.test / password123');
  console.log('  Workspace ID:', wsB._id.toString());

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Failed to setup generic business demo workspaces:', err);
  process.exit(1);
});
