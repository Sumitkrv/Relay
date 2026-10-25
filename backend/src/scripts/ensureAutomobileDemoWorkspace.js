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

  const email = 'owner.automobile@relay-demo.test';
  const password = 'password123';
  const slug = 'apex-motors-showroom';
  const businessName = 'Apex Motors Showroom';

  let user = await User.findOne({ email });
  if (!user) {
    const passwordHash = await bcrypt.hash(password, 10);
    user = await User.create({
      name: 'Apex Showroom Principal',
      businessName,
      email,
      passwordHash,
      role: 'owner',
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
      accountStatus: 'ACTIVE',
    });
    console.log('Created Automobile test user:', user._id);
  } else {
    user.passwordHash = await bcrypt.hash(password, 10);
    user.isEmailVerified = true;
    user.accountStatus = 'ACTIVE';
    await user.save();
    console.log('Updated existing Automobile user credentials:', user._id);
  }

  let ws = await Workspace.findOne({ slug });
  if (!ws) {
    ws = await Workspace.create({
      name: businessName,
      slug,
      industryKey: 'automobile',
      businessEmail: email,
      businessPhone: '+919876500600',
      city: 'Bengaluru',
      country: 'India',
      timezone: 'Asia/Kolkata',
      status: 'ACTIVE',
      onboardingStatus: 'COMPLETED',
      createdBy: user._id,
      settings: {
        whatsappConnection: {
          status: 'MOCK_SIMULATED_READY',
          businessPhone: '+919876500600',
          connectedAt: new Date(),
        },
      },
    });
    console.log('Created Automobile test workspace:', ws._id);
  } else {
    ws.industryKey = 'automobile';
    ws.name = businessName;
    await ws.save();
    console.log('Found existing Automobile workspace:', ws._id);
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
        businessCategory: 'Automobile & Dealerships',
        industry: 'automobile',
        businessEmail: email,
        businessPhone: '+919876500600',
        city: 'Bengaluru',
        state: 'Karnataka',
        country: 'India',
        address: 'Apex Towers, 100 Feet Road, Indiranagar, Bengaluru',
        website: 'https://apexmotors.demo.test',
        operationalStatus: 'OPERATIONAL',
      },
    },
    { upsert: true, new: true }
  );

  // Optional: add 3 isolated demo vehicle leads if none exist for this workspace
  const existingContacts = await Contact.countDocuments({ workspaceId: ws._id });
  if (existingContacts === 0) {
    const demoLeads = [
      {
        ownerId: user._id,
        workspaceId: ws._id,
        fullName: 'Rohan Mehra',
        phoneNumber: '+919876510001',
        email: 'rohan.mehra@example.com',
        city: 'Bengaluru',
        state: 'Karnataka',
        country: 'India',
        leadSource: 'Showroom Walk-In',
        leadStatus: 'Interested',
        priority: 'High',
        interestedService: 'Apex Cruiser EV',
        businessCategory: 'Central Showroom & Lounge',
        budgetRange: '₹25 Lakh - ₹35 Lakh',
        industryData: {
          vehicleType: 'Electric Vehicle (EV)',
          vehicleModel: 'Apex Cruiser EV',
          branchName: 'Central Showroom & Lounge',
          testDriveInterest: 'Requested',
          testDriveDate: new Date(Date.now() + 86400000 * 2),
          budgetRange: '₹25 Lakh - ₹35 Lakh',
        },
        whatsappConsentStatus: 'Opted In',
        isDemo: true,
      },
      {
        ownerId: user._id,
        workspaceId: ws._id,
        fullName: 'Kavita Sundaram',
        phoneNumber: '+919876510002',
        email: 'kavita.s@example.com',
        city: 'Bengaluru',
        state: 'Karnataka',
        country: 'India',
        leadSource: 'Website Test Drive Form',
        leadStatus: 'New',
        priority: 'Medium',
        interestedService: 'Horizon X7',
        businessCategory: 'Highway Auto City',
        budgetRange: '₹18 Lakh - ₹25 Lakh',
        industryData: {
          vehicleType: 'Mid-Size SUV',
          vehicleModel: 'Horizon X7',
          branchName: 'Highway Auto City',
          testDriveInterest: 'Scheduled',
          testDriveDate: new Date(Date.now() + 86400000 * 3),
          budgetRange: '₹18 Lakh - ₹25 Lakh',
        },
        whatsappConsentStatus: 'Unknown',
        isDemo: true,
      },
      {
        ownerId: user._id,
        workspaceId: ws._id,
        fullName: 'Arjun Singhania',
        phoneNumber: '+919876510003',
        email: 'arjun.s@example.com',
        city: 'Bengaluru',
        state: 'Karnataka',
        country: 'India',
        leadSource: 'CarDekho / CarWale',
        leadStatus: 'Follow-up Required',
        priority: 'Urgent',
        interestedService: 'Apex Stealth Pro Edition',
        businessCategory: 'Central Showroom & Lounge',
        budgetRange: '₹35 Lakh - ₹50 Lakh',
        industryData: {
          vehicleType: 'Luxury Full-Size SUV',
          vehicleModel: 'Apex Stealth Pro Edition',
          branchName: 'Central Showroom & Lounge',
          testDriveInterest: 'Completed',
          budgetRange: '₹35 Lakh - ₹50 Lakh',
        },
        whatsappConsentStatus: 'Opted In',
        isDemo: true,
      },
    ];
    await Contact.insertMany(demoLeads);
    console.log(`Created ${demoLeads.length} demo vehicle contacts for Apex Motors.`);
  }

  console.log('Automobile workspace provisioned safely and ready for verification.');
  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
