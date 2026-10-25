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

  const email = 'owner.education@relay-demo.test';
  const password = 'password123';
  const slug = 'apex-learning-academy';
  const businessName = 'Apex Learning Academy';

  let user = await User.findOne({ email });
  if (!user) {
    const passwordHash = await bcrypt.hash(password, 10);
    user = await User.create({
      name: 'Apex Academy Director',
      businessName,
      email,
      passwordHash,
      role: 'owner',
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
      accountStatus: 'ACTIVE',
    });
    console.log('Created Education test user:', user._id);
  } else {
    console.log('Found existing Education user:', user._id);
  }

  let ws = await Workspace.findOne({ slug });
  if (!ws) {
    ws = await Workspace.create({
      name: businessName,
      slug,
      industryKey: 'education',
      businessEmail: email,
      businessPhone: '+919876543210',
      city: 'Kota',
      country: 'India',
      timezone: 'Asia/Kolkata',
      status: 'ACTIVE',
      onboardingStatus: 'COMPLETED',
      createdBy: user._id,
      settings: {
        whatsappConnection: {
          status: 'MOCK_SIMULATED_READY',
          businessPhone: '+919876543210',
          connectedAt: new Date(),
        },
      },
    });
    console.log('Created Education test workspace:', ws._id);
  } else {
    console.log('Found existing Education workspace:', ws._id);
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
        businessName,
        industry: 'education',
        businessEmail: email,
        businessPhone: '+919876543210',
        city: 'Kota',
        state: 'Rajasthan',
        country: 'India',
        address: 'Plot 42, Education City, Kota',
        website: 'https://apexlearning.demo.test',
        operationalStatus: 'OPERATIONAL',
      },
    },
    { upsert: true, new: true }
  );

  console.log('Education workspace provisioned safely and ready for verification.');
  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
