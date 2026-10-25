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

  const email = 'owner.travel@relay-demo.test';
  const password = 'password123';
  const slug = 'wanderlust-journeys';
  const businessName = 'Wanderlust Journeys';

  let user = await User.findOne({ email });
  if (!user) {
    const passwordHash = await bcrypt.hash(password, 10);
    user = await User.create({
      name: 'Wanderlust Travel Director',
      businessName,
      email,
      passwordHash,
      role: 'owner',
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
      accountStatus: 'ACTIVE',
    });
    console.log('Created Travel test user:', user._id);
  } else {
    user.passwordHash = await bcrypt.hash(password, 10);
    user.isEmailVerified = true;
    user.accountStatus = 'ACTIVE';
    await user.save();
    console.log('Updated existing Travel user credentials:', user._id);
  }

  let ws = await Workspace.findOne({ slug });
  if (!ws) {
    ws = await Workspace.create({
      name: businessName,
      slug,
      industryKey: 'travel_tourism',
      businessEmail: email,
      businessPhone: '+919876500700',
      city: 'Mumbai',
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
    console.log('Created Travel test workspace:', ws._id);
  } else {
    ws.industryKey = 'travel_tourism';
    ws.name = businessName;
    await ws.save();
    console.log('Found existing Travel workspace:', ws._id);
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
        businessCategory: 'Travel & Tourism',
        industry: 'travel_tourism',
        businessEmail: email,
        businessPhone: '+919876500700',
        city: 'Mumbai',
        state: 'Maharashtra',
        country: 'India',
        address: 'Suite 401, Horizon Travels Tower, Bandra Kurla Complex, Mumbai',
        website: 'https://wanderlustjourneys.demo.test',
        operationalStatus: 'OPERATIONAL',
      },
    },
    { upsert: true, new: true }
  );

  // Add 3 isolated demo travel enquiries if none exist for this workspace
  const existingContacts = await Contact.countDocuments({ workspaceId: ws._id });
  if (existingContacts === 0) {
    const demoLeads = [
      {
        ownerId: user._id,
        workspaceId: ws._id,
        fullName: 'Rahul Sharma',
        phoneNumber: '+919876520001',
        email: 'rahul.sharma@example.com',
        city: 'Mumbai',
        state: 'Maharashtra',
        country: 'India',
        leadSource: 'Website Enquiry',
        leadStatus: 'Interested',
        priority: 'High',
        interestedPropertyType: 'International Holiday Package',
        budgetRange: '₹5,00,000+',
        estimatedDealValue: 550000,
        isDemo: true,
        whatsappConsentStatus: 'Opted In',
        industryData: {
          destination: 'Switzerland & Paris (Europe Grandeur)',
          travelScope: 'International Holiday',
          tripType: 'Honeymoon Package',
          travellerCount: 2,
          departureCity: 'Mumbai',
          travelDate: new Date(Date.now() + 86400000 * 14),
          returnDate: new Date(Date.now() + 86400000 * 24),
          budgetRange: '₹5,00,000+',
          accommodationPreference: '4-Star Premium Hotel',
          bookingRequestStatus: 'Itinerary Shared',
          followUpDate: new Date(Date.now() + 86400000 * 2),
        },
      },
      {
        ownerId: user._id,
        workspaceId: ws._id,
        fullName: 'Pooja Varma',
        phoneNumber: '+919876520002',
        email: 'pooja.varma@example.com',
        city: 'Delhi NCR',
        state: 'Delhi',
        country: 'India',
        leadSource: 'WhatsApp Inbound',
        leadStatus: 'New',
        priority: 'Medium',
        interestedPropertyType: 'Domestic Holiday Package',
        budgetRange: '₹1,00,000 - ₹2,50,000',
        estimatedDealValue: 180000,
        isDemo: true,
        whatsappConsentStatus: 'Opted In',
        industryData: {
          destination: 'Kashmir Valley & Gulmarg Paradise',
          travelScope: 'Domestic Holiday',
          tripType: 'Family Holiday',
          travellerCount: 4,
          departureCity: 'Delhi NCR',
          travelDate: new Date(Date.now() + 86400000 * 20),
          returnDate: new Date(Date.now() + 86400000 * 27),
          budgetRange: '₹1,00,000 - ₹2,50,000',
          accommodationPreference: 'Boutique Homestay / Villa',
          bookingRequestStatus: 'Enquiry Received',
          followUpDate: new Date(Date.now() + 86400000 * 1),
        },
      },
      {
        ownerId: user._id,
        workspaceId: ws._id,
        fullName: 'Amitabh Sen',
        phoneNumber: '+919876520003',
        email: 'amitabh.sen@example.com',
        city: 'Bengaluru',
        state: 'Karnataka',
        country: 'India',
        leadSource: 'Travel Expo / Fair',
        leadStatus: 'Follow-up Required',
        priority: 'High',
        interestedPropertyType: 'International Holiday Package',
        budgetRange: '₹1,00,000 - ₹2,50,000',
        estimatedDealValue: 220000,
        isDemo: true,
        whatsappConsentStatus: 'Opted In',
        industryData: {
          destination: 'Bali & Ubud Island Escape',
          travelScope: 'International Holiday',
          tripType: 'Weekend Getaway',
          travellerCount: 2,
          departureCity: 'Bengaluru',
          travelDate: new Date(Date.now() + 86400000 * 30),
          returnDate: new Date(Date.now() + 86400000 * 36),
          budgetRange: '₹1,00,000 - ₹2,50,000',
          accommodationPreference: '5-Star Luxury Resort',
          bookingRequestStatus: 'Quotation Proposed',
          followUpDate: new Date(Date.now() + 86400000 * 3),
        },
      },
    ];

    for (const lead of demoLeads) {
      await Contact.create(lead);
    }
    console.log(`Created ${demoLeads.length} demo Travel contacts for workspace: ${ws._id}`);
  } else {
    console.log(`Workspace ${ws._id} already has ${existingContacts} contacts.`);
  }

  console.log('Travel demo workspace setup complete.');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Travel demo workspace setup failed:', err);
  process.exit(1);
});
