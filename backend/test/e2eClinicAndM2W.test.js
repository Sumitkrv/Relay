import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../src/models/User.js';
import Workspace from '../src/models/Workspace.js';
import WorkspaceMembership from '../src/models/WorkspaceMembership.js';
import Contact from '../src/models/Contact.js';
import MessageTemplate from '../src/models/MessageTemplate.js';
import Campaign from '../src/models/Campaign.js';
import Conversation from '../src/models/Conversation.js';
import connectDB from '../src/config/db.js';
import { overview } from '../src/controllers/dashboardController.js';

test('E2E Multi-Tenant Verification: Clinic & M2W Segregation', async () => {
  await connectDB();

  // 1. Verify M2W Realty Owner Integrity
  const m2wUser = (await User.findOne({ email: 'owner.m2w@relay-demo.test' })) || (await User.findOne({ email: 'admin@relaycrm.io' }));
  assert.ok(m2wUser, 'M2W Realty owner user must exist');

  const m2wWorkspace = (await Workspace.findOne({ slug: 'm2w-realty' })) || (await Workspace.findOne({ slug: 'm2w-realty-clone' }));
  assert.ok(m2wWorkspace, 'M2W Realty workspace must exist');

  const m2wReq = {
    user: m2wUser,
    workspace: m2wWorkspace,
    workspaceId: m2wWorkspace._id,
    query: {},
    get: () => m2wWorkspace._id.toString(),
  };

  let m2wOverviewData = null;
  await overview(m2wReq, {
    json: (d) => { m2wOverviewData = d; },
    status: () => ({ json: () => {} })
  });

  assert.ok(m2wOverviewData?.businessContext?.businessName.includes('M2W'), 'M2W Overview must show M2W name');

  // 2. Setup Synthetic Clinic Owner
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
  assert.ok(clinicUser, 'Clinic user must exist');

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
  assert.ok(clinicWorkspace, 'Clinic workspace must exist');

  // 3. Test Clinic Dashboard Overview
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

  assert.equal(
    clinicOverviewData?.businessContext?.businessName,
    'Sharma Dental & Wellness Clinic',
    'Clinic Overview must display Clinic business name'
  );
  assert.ok(
    !clinicOverviewData?.businessContext?.businessName.includes('M2W'),
    'Clinic Overview must NOT leak M2W business name'
  );
  assert.equal(
    clinicOverviewData?.system?.mode,
    'Single-Owner Clinic Automation',
    'Clinic system mode must show Clinic vertical'
  );

  // 4. Test Clinic Contact CRUD & Cross-Tenant Boundary
  let clinicContact = await Contact.findOne({ ownerId: clinicUser._id, phoneNumber: '+919811002233' });
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
  assert.ok(clinicContact, 'Clinic contact must exist');

  const m2wSeeClinic = await Contact.findOne({ ownerId: m2wUser._id, _id: clinicContact._id });
  assert.equal(m2wSeeClinic, null, 'M2W must not see Clinic contact');

  // 5. Test Clinic Template CRUD & Cross-Tenant Boundary
  let clinicTemplate = await MessageTemplate.findOne({ ownerId: clinicUser._id, name: 'dental_checkup_reminder' });
  if (!clinicTemplate) {
    clinicTemplate = await MessageTemplate.create({
      ownerId: clinicUser._id,
      workspaceId: clinicWorkspace._id,
      name: 'dental_checkup_reminder',
      category: 'Utility',
      language: 'en',
      bodyText: 'Hello {{first_name}}, this is a reminder for your dental checkup with Dr. Sharma.',
      localStatus: 'Draft',
    });
  }
  assert.ok(clinicTemplate, 'Clinic template must exist');

  const m2wSeeTemplate = await MessageTemplate.findOne({ ownerId: m2wUser._id, _id: clinicTemplate._id });
  assert.equal(m2wSeeTemplate, null, 'M2W must not see Clinic template');
});

test('E2E Multi-Tenant Verification: Gym and Salon Strict Isolation', async () => {
  const gymUser = await User.findOne({ email: 'gym-owner@relay-demo.test' });
  const salonUser = await User.findOne({ email: 'salon-owner@relay-demo.test' });

  assert.ok(gymUser, 'Gym user must exist');
  assert.ok(salonUser, 'Salon user must exist');

  const gymWorkspace = await Workspace.findOne({ slug: 'fitzone-gym' });
  const salonWorkspace = await Workspace.findOne({ slug: 'glow-studio' });

  assert.ok(gymWorkspace, 'Gym workspace must exist');
  assert.ok(salonWorkspace, 'Salon workspace must exist');

  // Create Gym Contact
  let gymContact = await Contact.findOne({ ownerId: gymUser._id, phoneNumber: '+919822001122' });
  if (!gymContact) {
    gymContact = await Contact.create({
      ownerId: gymUser._id,
      workspaceId: gymWorkspace._id,
      fullName: 'Rahul Fitness',
      phoneNumber: '+919822001122',
      interestedService: 'Annual Gym Membership',
      whatsappConsentStatus: 'Opted In',
    });
  }

  // Create Salon Contact
  let salonContact = await Contact.findOne({ ownerId: salonUser._id, phoneNumber: '+919833004455' });
  if (!salonContact) {
    salonContact = await Contact.create({
      ownerId: salonUser._id,
      workspaceId: salonWorkspace._id,
      fullName: 'Pooja Glamour',
      phoneNumber: '+919833004455',
      interestedService: 'Hair Spa & Styling',
      whatsappConsentStatus: 'Opted In',
    });
  }

  // Verify Gym Contact appears only for Gym owner
  const gymOwnerQueryGymContact = await Contact.findOne({ ownerId: gymUser._id, _id: gymContact._id });
  assert.ok(gymOwnerQueryGymContact, 'Gym owner can query Gym contact');

  // Verify Salon owner CANNOT query Gym Contact
  const salonOwnerQueryGymContact = await Contact.findOne({ ownerId: salonUser._id, _id: gymContact._id });
  assert.equal(salonOwnerQueryGymContact, null, 'Salon owner CANNOT query Gym contact');

  // Verify Gym owner CANNOT query Salon Contact
  const gymOwnerQuerySalonContact = await Contact.findOne({ ownerId: gymUser._id, _id: salonContact._id });
  assert.equal(gymOwnerQuerySalonContact, null, 'Gym owner CANNOT query Salon contact');

  // Verify Overview isolation
  let gymOverview = null;
  await overview(
    { user: gymUser, workspace: gymWorkspace, query: {}, get: () => gymWorkspace._id.toString() },
    { json: (d) => { gymOverview = d; }, status: () => ({ json: () => {} }) }
  );
  assert.equal(gymOverview?.businessContext?.businessName, 'FitZone Gym');
  assert.equal(gymOverview?.system?.mode, 'Single-Owner Gym Automation');

  let salonOverview = null;
  await overview(
    { user: salonUser, workspace: salonWorkspace, query: {}, get: () => salonWorkspace._id.toString() },
    { json: (d) => { salonOverview = d; }, status: () => ({ json: () => {} }) }
  );
  assert.equal(salonOverview?.businessContext?.businessName, 'Glow Studio');
  assert.equal(salonOverview?.system?.mode, 'Single-Owner Salon Automation');

  await mongoose.disconnect();
});
