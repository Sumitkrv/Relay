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

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/relay_demo';
  await mongoose.connect(uri);
  console.log('Connected to MongoDB:', uri);

  const email = 'owner.gym@relay-demo.test';
  const password = 'password123';
  const slug = 'fitzone-fitness-club';
  const businessName = 'FitZone Fitness Club';

  let user = await User.findOne({ email });
  if (!user) {
    const passwordHash = await bcrypt.hash(password, 10);
    user = await User.create({
      name: 'FitZone Club Owner',
      businessName,
      email,
      passwordHash,
      role: 'owner',
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
      accountStatus: 'ACTIVE',
    });
    console.log('Created Gym test user:', user._id);
  } else {
    // Ensure password is password123 for verified test access
    user.passwordHash = await bcrypt.hash(password, 10);
    user.isEmailVerified = true;
    user.accountStatus = 'ACTIVE';
    await user.save();
    console.log('Updated existing Gym user credentials:', user._id);
  }

  let ws = await Workspace.findOne({ slug });
  if (!ws) {
    ws = await Workspace.create({
      name: businessName,
      slug,
      industryKey: 'gym',
      businessEmail: email,
      businessPhone: '+919876500200',
      city: 'Mumbai',
      country: 'India',
      timezone: 'Asia/Kolkata',
      status: 'ACTIVE',
      onboardingStatus: 'COMPLETED',
      createdBy: user._id,
      settings: {
        whatsappConnection: {
          status: 'MOCK_SIMULATED_READY',
          businessPhone: '+919876500200',
          connectedAt: new Date(),
        },
      },
    });
    console.log('Created Gym test workspace:', ws._id);
  } else {
    ws.industryKey = 'gym';
    ws.name = businessName;
    await ws.save();
    console.log('Found existing Gym workspace:', ws._id);
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
        businessCategory: 'Gym / Fitness',
        industry: 'gym',
        businessEmail: email,
        businessPhone: '+919876500200',
        city: 'Mumbai',
        state: 'Maharashtra',
        country: 'India',
        address: 'FitZone Center, Sector 18, Andheri West, Mumbai',
        website: 'https://fitzone.demo.test',
        operationalStatus: 'OPERATIONAL',
      },
    },
    { upsert: true, new: true }
  );

  console.log('Gym workspace provisioned safely and ready for verification.');
  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
