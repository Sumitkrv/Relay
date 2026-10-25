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

  const email = 'owner.professional@relay-demo.test';
  const password = 'password123';
  const slug = 'vanguard-advisory';
  const businessName = 'Vanguard Advisory & Legal';

  let user = await User.findOne({ email });
  if (!user) {
    const passwordHash = await bcrypt.hash(password, 10);
    user = await User.create({
      name: 'Advocate Siddharth & Partners',
      businessName,
      email,
      passwordHash,
      role: 'owner',
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
      accountStatus: 'ACTIVE',
    });
    console.log('Created Professional Services test user:', user._id);
  } else {
    user.passwordHash = await bcrypt.hash(password, 10);
    user.isEmailVerified = true;
    user.accountStatus = 'ACTIVE';
    await user.save();
    console.log('Updated existing Professional Services user credentials:', user._id);
  }

  let ws = await Workspace.findOne({ slug });
  if (!ws) {
    ws = await Workspace.create({
      name: businessName,
      slug,
      industryKey: 'professional_services',
      businessEmail: email,
      businessPhone: '+919876500800',
      city: 'Gurugram',
      country: 'India',
      timezone: 'Asia/Kolkata',
      status: 'ACTIVE',
      onboardingStatus: 'COMPLETED',
      createdBy: user._id,
      settings: {
        whatsappConnection: {
          status: 'MOCK_SIMULATED_READY',
          businessPhone: '+919876500800',
          connectedAt: new Date(),
        },
      },
    });
    console.log('Created Professional Services test workspace:', ws._id);
  } else {
    ws.industryKey = 'professional_services';
    ws.name = businessName;
    await ws.save();
    console.log('Found existing Professional Services workspace:', ws._id);
  }

  await WorkspaceMembership.findOneAndUpdate(
    { workspaceId: ws._id, userId: user._id },
    { $set: { role: 'OWNER', status: 'ACTIVE', isDefaultWorkspace: true } },
    { upsert: true, new: true }
  );

  if (!user.defaultWorkspaceId || String(user.defaultWorkspaceId) !== String(ws._id)) {
    user.defaultWorkspaceId = ws._id;
    await user.save();
  }

  await BusinessProfile.findOneAndUpdate(
    { workspaceId: ws._id },
    {
      $set: {
        ownerId: user._id,
        businessName,
        legalOrTradingName: businessName,
        displayName: businessName,
        businessCategory: 'Professional Services',
        industry: 'professional_services',
        businessEmail: email,
        businessPhone: '+919876500800',
        city: 'Gurugram',
        state: 'Haryana',
        country: 'India',
        address: 'Level 7, Cyber City Tower B, DLF Phase 2, Gurugram, Haryana 122002',
        website: 'https://vanguardadvisory.demo.test',
        operationalStatus: 'OPERATIONAL',
      },
    },
    { upsert: true, new: true }
  );

  // Add 3 isolated demo client leads if none exist for this workspace
  const existingContacts = await Contact.countDocuments({ workspaceId: ws._id });
  if (existingContacts === 0) {
    const demoLeads = [
      {
        ownerId: user._id,
        workspaceId: ws._id,
        fullName: 'Aarav Mehta',
        phoneNumber: '+919876530001',
        email: 'aarav.mehta@nexustech.demo',
        companyName: 'Nexus Tech Ventures',
        city: 'Gurugram',
        state: 'Haryana',
        country: 'India',
        leadSource: 'Website Consultation Form',
        leadStatus: 'Interested',
        priority: 'High',
        interestedService: 'Corporate Tax Audit & Filing',
        businessCategory: 'Professional Services',
        budgetRange: '₹50,000 - ₹1,00,000',
        industryData: {
          companyName: 'Nexus Tech Ventures',
          serviceCategory: 'Accounting, Audit & Tax',
          serviceInterest: 'Corporate Tax Audit & Filing',
          enquiryType: 'Consultation Request',
          meetingMode: 'Video Call (Google Meet / Zoom)',
          meetingDate: new Date(Date.now() + 86400000 * 2),
          meetingTime: '11:30 AM',
          proposalRequested: 'Under Preparation',
          followUpDate: new Date(Date.now() + 86400000),
        },
        whatsappConsentStatus: 'Opted In',
        isDemo: true,
      },
      {
        ownerId: user._id,
        workspaceId: ws._id,
        fullName: 'Priya Singhal',
        phoneNumber: '+919876530002',
        email: 'priya@luminadesign.demo',
        companyName: 'Lumina Design Studio',
        city: 'Delhi',
        state: 'Delhi',
        country: 'India',
        leadSource: 'Referral',
        leadStatus: 'New',
        priority: 'Urgent',
        interestedService: 'Trademark & IP Registration',
        businessCategory: 'Professional Services',
        budgetRange: '₹30,000 - ₹60,000',
        industryData: {
          companyName: 'Lumina Design Studio',
          serviceCategory: 'Legal Services & Advisory',
          serviceInterest: 'Trademark & IP Registration',
          enquiryType: 'New Client Enquiry',
          meetingMode: 'Office Visit / In-Person',
          meetingDate: new Date(Date.now() + 86400000 * 3),
          meetingTime: '03:00 PM',
          proposalRequested: 'Yes',
          followUpDate: new Date(Date.now() + 86400000 * 2),
        },
        whatsappConsentStatus: 'Opted In',
        isDemo: true,
      },
      {
        ownerId: user._id,
        workspaceId: ws._id,
        fullName: 'Ramesh Chawla',
        phoneNumber: '+919876530003',
        email: 'rchawla@chawlalogistics.demo',
        companyName: 'Chawla Logistics Ltd',
        city: 'Noida',
        state: 'Uttar Pradesh',
        country: 'India',
        leadSource: 'LinkedIn / Advisory Outreach',
        leadStatus: 'Follow-up Required',
        priority: 'Medium',
        interestedService: 'Cloud ERP & Digital Advisory',
        businessCategory: 'Professional Services',
        budgetRange: '₹2,00,000 - ₹3,50,000',
        industryData: {
          companyName: 'Chawla Logistics Ltd',
          serviceCategory: 'IT, Cloud & Software Services',
          serviceInterest: 'Cloud ERP & Digital Advisory',
          enquiryType: 'Proposal / Quote Request',
          meetingMode: 'Video Call (Google Meet / Zoom)',
          meetingDate: new Date(Date.now() + 86400000 * 4),
          meetingTime: '04:30 PM',
          proposalRequested: 'Shared with Client',
          followUpDate: new Date(Date.now() + 86400000),
        },
        whatsappConsentStatus: 'Opted In',
        isDemo: true,
      },
    ];
    await Contact.insertMany(demoLeads);
    console.log(`Created ${demoLeads.length} demo client contacts for Vanguard Advisory & Legal.`);
  }

  console.log('Professional Services workspace provisioned safely and ready for verification.');
  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
