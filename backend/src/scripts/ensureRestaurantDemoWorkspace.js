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

  const email = 'owner.restaurant@relay-demo.test';
  const password = 'password123';
  const slug = 'the-grand-bistro';
  const businessName = 'The Grand Bistro & Lounge';

  let user = await User.findOne({ email });
  if (!user) {
    const passwordHash = await bcrypt.hash(password, 10);
    user = await User.create({
      name: 'Chef Marco & Bistro Management',
      businessName,
      email,
      passwordHash,
      role: 'owner',
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
      accountStatus: 'ACTIVE',
    });
    console.log('Created Restaurant test user:', user._id);
  } else {
    user.passwordHash = await bcrypt.hash(password, 10);
    user.isEmailVerified = true;
    user.accountStatus = 'ACTIVE';
    await user.save();
    console.log('Updated existing Restaurant user credentials:', user._id);
  }

  let ws = await Workspace.findOne({ slug });
  if (!ws) {
    ws = await Workspace.create({
      name: businessName,
      slug,
      industryKey: 'restaurant_food',
      businessEmail: email,
      businessPhone: '+919876500700',
      city: 'Bengaluru',
      country: 'India',
      timezone: 'Asia/Kolkata',
      status: 'ACTIVE',
      onboardingStatus: 'COMPLETED',
      createdBy: user._id,
      settings: {
        whatsappConnection: {
          status: 'MOCK_SIMULATED_READY',
          businessPhone: '+919876500700',
          connectedAt: new Date(),
        },
      },
    });
    console.log('Created Restaurant test workspace:', ws._id);
  } else {
    ws.industryKey = 'restaurant_food';
    ws.name = businessName;
    await ws.save();
    console.log('Found existing Restaurant workspace:', ws._id);
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
        businessCategory: 'Restaurants & Food',
        industry: 'restaurant_food',
        businessEmail: email,
        businessPhone: '+919876500700',
        city: 'Bengaluru',
        state: 'Karnataka',
        country: 'India',
        address: '12 Lavelle Road, Shanthala Nagar, Bengaluru, Karnataka 560001',
        website: 'https://thegrandbistro.demo.test',
        operationalStatus: 'OPERATIONAL',
      },
    },
    { upsert: true, new: true }
  );

  // Optional: add 3 isolated demo dining leads if none exist for this workspace
  const existingContacts = await Contact.countDocuments({ workspaceId: ws._id });
  if (existingContacts === 0) {
    const demoLeads = [
      {
        ownerId: user._id,
        workspaceId: ws._id,
        fullName: 'Vikram Malhotra',
        phoneNumber: '+919876520001',
        email: 'vikram.m@example.com',
        city: 'Bengaluru',
        state: 'Karnataka',
        country: 'India',
        leadSource: 'Table Reservation Form',
        leadStatus: 'Interested',
        priority: 'High',
        interestedService: 'Chef Tasting Menu',
        businessCategory: 'Downtown Bistro & Lounge',
        budgetRange: '₹4,000 - ₹6,000',
        industryData: {
          enquiryType: 'Dine-In Reservation',
          serviceMode: 'Dine-In',
          foodInterest: 'Chef Tasting Menu',
          branchName: 'Downtown Bistro & Lounge',
          reservationDate: new Date(Date.now() + 86400000 * 2),
          reservationTime: '08:00 PM',
          partySize: 4,
          budgetRange: '₹4,000 - ₹6,000',
          followUpDate: new Date(Date.now() + 86400000),
        },
        whatsappConsentStatus: 'Opted In',
        isDemo: true,
      },
      {
        ownerId: user._id,
        workspaceId: ws._id,
        fullName: 'Ananya Deshmukh',
        phoneNumber: '+919876520002',
        email: 'ananya.d@example.com',
        city: 'Bengaluru',
        state: 'Karnataka',
        country: 'India',
        leadSource: 'Corporate Event Form',
        leadStatus: 'New',
        priority: 'Urgent',
        interestedService: 'Corporate Buffet Catering',
        businessCategory: 'Banquet & Catering Division',
        budgetRange: '₹35,000 - ₹50,000',
        industryData: {
          enquiryType: 'Catering / Event Enquiry',
          serviceMode: 'Catering / Private Event',
          foodInterest: 'Corporate Buffet Catering',
          branchName: 'Banquet & Catering Division',
          cateringType: 'Corporate Lunch / Dinner',
          partySize: 45,
          budgetRange: '₹35,000 - ₹50,000',
          followUpDate: new Date(Date.now() + 86400000 * 2),
        },
        whatsappConsentStatus: 'Unknown',
        isDemo: true,
      },
      {
        ownerId: user._id,
        workspaceId: ws._id,
        fullName: 'Rajesh Singhania',
        phoneNumber: '+919876520003',
        email: 'rajesh.s@example.com',
        city: 'Bengaluru',
        state: 'Karnataka',
        country: 'India',
        leadSource: 'WhatsApp Inbound',
        leadStatus: 'Follow-up Required',
        priority: 'Medium',
        interestedService: 'North Indian Specialties',
        businessCategory: 'Downtown Bistro & Lounge',
        budgetRange: '₹1,500 - ₹2,500',
        industryData: {
          enquiryType: 'Takeaway Order',
          serviceMode: 'Takeaway / Pickup',
          foodInterest: 'North Indian Specialties',
          branchName: 'Downtown Bistro & Lounge',
          budgetRange: '₹1,500 - ₹2,500',
          followUpDate: new Date(Date.now() + 86400000),
        },
        whatsappConsentStatus: 'Opted In',
        isDemo: true,
      },
    ];
    await Contact.insertMany(demoLeads);
    console.log(`Created ${demoLeads.length} demo dining contacts for The Grand Bistro & Lounge.`);
  }

  console.log('Restaurant workspace provisioned safely and ready for verification.');
  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
