/**
 * Comprehensive Deterministic Demo Data Seeder for Relay Master Prompt 13.5
 * Seeds 13 test personas, 8 synthetic organizations, industry contacts,
 * templates, campaigns, inbox conversations, auto-reply rules, subscriptions,
 * agency relationships, and support cases.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/freelance_automation_crm';

import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';

// Models
import User from '../models/User.js';
import Workspace from '../models/Workspace.js';
import WorkspaceMembership from '../models/WorkspaceMembership.js';
import BusinessProfile from '../models/BusinessProfile.js';
import WorkspaceSubscription from '../models/WorkspaceSubscription.js';
import BillingInvoice from '../models/BillingInvoice.js';
import Contact from '../models/Contact.js';
import MessageTemplate from '../models/MessageTemplate.js';
import Campaign from '../models/Campaign.js';
import Conversation from '../models/Conversation.js';
import ConversationMessage from '../models/ConversationMessage.js';
import AutoReplyRule from '../models/AutoReplyRule.js';
import Agency from '../models/Agency.js';
import AgencyMembership from '../models/AgencyMembership.js';
import AgencyClientRelation from '../models/AgencyClientRelation.js';
import SupportCase from '../models/SupportCase.js';

const DEMO_PASSWORD = 'DemoPass123!';

export async function seedCompleteDemo() {
  console.log('--- RELAY DEMO SEEDING STARTING ---');
  if (mongoose.connection.readyState === 0) {
    await connectDB();
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, salt);

  // 1. Seed Personas
  console.log('1. Seeding 13 Demo Personas...');

  const personasData = [
    { name: 'Relay Admin', email: 'admin@relay-demo.test', isPlatformAdmin: true, role: 'admin' },
    { name: 'Vikram Realty Owner', email: 'm2w-owner@relay-demo.test', role: 'owner' },
    { name: 'Alex Gym Owner', email: 'gym-owner@relay-demo.test', role: 'owner' },
    { name: 'Elena Salon Owner', email: 'salon-owner@relay-demo.test', role: 'owner' },
    { name: 'Dr. Priya Clinic Owner', email: 'clinic-owner@relay-demo.test', role: 'owner' },
    { name: 'Prof. Rajesh Edu Owner', email: 'education-owner@relay-demo.test', role: 'owner' },
    { name: 'Siddharth Auto Owner', email: 'automobile-owner@relay-demo.test', role: 'owner' },
    { name: 'Neha Services Owner', email: 'business-owner@relay-demo.test', role: 'owner' },
    { name: 'Marcus Agency Owner', email: 'agency-owner@relay-demo.test', role: 'owner' },
    { name: 'Sarah Agency Manager', email: 'agency-manager@relay-demo.test', role: 'member' },
    { name: 'Dave Agency Viewer', email: 'agency-viewer@relay-demo.test', role: 'member' },
    { name: 'Pending Pete', email: 'unverified@relay-demo.test', accountStatus: 'PENDING_EMAIL_VERIFICATION', isEmailVerified: false, emailVerifiedAt: null, role: 'owner' },
    { name: 'Suspended Sam', email: 'suspended@relay-demo.test', accountStatus: 'SUSPENDED', role: 'owner' },
  ];

  const userMap = new Map();
  for (const p of personasData) {
    let u = await User.findOne({ email: p.email });
    if (!u) {
      u = await User.create({
        name: p.name,
        email: p.email,
        passwordHash,
        role: p.role,
        isPlatformAdmin: Boolean(p.isPlatformAdmin),
        accountStatus: p.accountStatus || 'ACTIVE',
        isEmailVerified: p.isEmailVerified !== false,
        emailVerifiedAt: p.isEmailVerified === false ? null : new Date(),
        authVersion: 1,
      });
    } else {
      u.passwordHash = passwordHash;
      u.isPlatformAdmin = Boolean(p.isPlatformAdmin);
      if (p.accountStatus) u.accountStatus = p.accountStatus;
      await u.save();
    }
    userMap.set(p.email, u);
  }

  // 2. Seed Workspaces
  console.log('2. Seeding 7 Synthetic Industry Workspaces...');

  const workspacesData = [
    {
      name: 'M2W Realty Demo Clone',
      slug: 'm2w-realty-clone',
      industryKey: 'real_estate',
      ownerEmail: 'm2w-owner@relay-demo.test',
      phone: '+919811223344',
      city: 'Gurugram',
    },
    {
      name: 'FitZone Gym',
      slug: 'fitzone-gym',
      industryKey: 'gym',
      ownerEmail: 'gym-owner@relay-demo.test',
      phone: '+919822334455',
      city: 'Bengaluru',
    },
    {
      name: 'Glow Studio',
      slug: 'glow-studio',
      industryKey: 'salon',
      ownerEmail: 'salon-owner@relay-demo.test',
      phone: '+919833445566',
      city: 'Mumbai',
    },
    {
      name: 'CarePlus Demo Clinic',
      slug: 'careplus-clinic',
      industryKey: 'clinic',
      ownerEmail: 'clinic-owner@relay-demo.test',
      phone: '+919844556677',
      city: 'New Delhi',
    },
    {
      name: 'BrightPath Academy',
      slug: 'brightpath-academy',
      industryKey: 'education',
      ownerEmail: 'education-owner@relay-demo.test',
      phone: '+919855667788',
      city: 'Pune',
    },
    {
      name: 'DriveMax Autos',
      slug: 'drivemax-autos',
      industryKey: 'automobile',
      ownerEmail: 'automobile-owner@relay-demo.test',
      phone: '+919866778899',
      city: 'Hyderabad',
    },
    {
      name: 'Nova Services',
      slug: 'nova-services',
      industryKey: 'other',
      ownerEmail: 'business-owner@relay-demo.test',
      phone: '+919877889900',
      city: 'Chennai',
    },
  ];

  const workspaceMap = new Map();
  for (const w of workspacesData) {
    const owner = userMap.get(w.ownerEmail);
    let ws = await Workspace.findOne({ slug: w.slug });
    if (!ws) {
      ws = await Workspace.create({
        name: w.name,
        slug: w.slug,
        industryKey: w.industryKey,
        businessEmail: w.ownerEmail,
        businessPhone: w.phone,
        city: w.city,
        country: 'India',
        timezone: 'Asia/Kolkata',
        status: 'ACTIVE',
        onboardingStatus: 'COMPLETED',
        createdBy: owner._id,
        settings: {
          whatsappConnection: {
            status: 'MOCK_SIMULATED_READY',
            businessPhone: w.phone,
            wabaId: `waba_${w.slug}_test`,
            phoneId: `phone_${w.slug}_test`,
            connectedAt: new Date(),
          },
        },
      });
    }

    // Ensure OWNER Membership
    await WorkspaceMembership.findOneAndUpdate(
      { workspaceId: ws._id, userId: owner._id },
      { $set: { role: 'OWNER', status: 'ACTIVE', isDefaultWorkspace: true } },
      { upsert: true, new: true }
    );

    // Ensure BusinessProfile
    await BusinessProfile.findOneAndUpdate(
      { workspaceId: ws._id },
      {
        $set: {
          ownerId: owner._id,
          legalOrTradingName: w.name,
          displayName: w.name,
          businessCategory: w.industryKey,
          email: w.ownerEmail,
          phone: w.phone,
          city: w.city,
          country: 'India',
          timezone: 'Asia/Kolkata',
          description: `Synthetic demo workspace for ${w.name} WhatsApp automation.`,
        },
      },
      { upsert: true }
    );

    // Ensure Subscription
    await WorkspaceSubscription.findOneAndUpdate(
      { workspaceId: ws._id },
      {
        $set: {
          planId: 'solo_799',
          planName: 'Solo Growth Plan',
          amount: 799,
          status: 'ACTIVE',
          currentPeriodStartsAt: new Date(),
          currentPeriodEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          isMock: true,
        },
      },
      { upsert: true }
    );

    workspaceMap.set(w.slug, ws);
  }

  // 3. Seed Industry Contacts
  console.log('3. Seeding Contacts with Dynamic Industry Fields...');

  const gymWs = workspaceMap.get('fitzone-gym');
  const gymOwner = userMap.get('gym-owner@relay-demo.test');

  const gymContacts = [
    {
      fullName: 'Rahul Sharma',
      phoneNumber: '+919876500101',
      industryData: { membershipType: 'Quarterly (3 Months)', fitnessProgram: 'Strength Training', trialSessionInterest: 'Requested', preferredTiming: 'Evening (4:00 PM - 8:00 PM)' },
      whatsappConsentStatus: 'Opted In',
    },
    {
      fullName: 'Ananya Verma',
      phoneNumber: '+919876500102',
      industryData: { membershipType: 'Annual Membership', fitnessProgram: 'Yoga & Pilates', trialSessionInterest: 'Completed', preferredTiming: 'Morning (6:00 AM - 9:00 AM)' },
      whatsappConsentStatus: 'Opted In',
    },
    {
      fullName: 'Karan Mehra',
      phoneNumber: '+919876500103',
      industryData: { membershipType: 'Monthly Pass', fitnessProgram: 'CrossFit', trialSessionInterest: 'Scheduled', preferredTiming: 'Evening (4:00 PM - 8:00 PM)' },
      whatsappConsentStatus: 'Opted In',
    },
    {
      fullName: 'Sneha Patel',
      phoneNumber: '+919876500104',
      industryData: { membershipType: 'Day / Casual Pass', fitnessProgram: 'Cardio & HIIT', trialSessionInterest: 'Requested', preferredTiming: 'Mid-Day (10:00 AM - 2:00 PM)' },
      whatsappConsentStatus: 'Unknown',
    },
  ];

  for (const c of gymContacts) {
    await Contact.findOneAndUpdate(
      { workspaceId: gymWs._id, phoneNumber: c.phoneNumber },
      {
        $set: {
          ownerId: gymOwner._id,
          fullName: c.fullName,
          phoneNumber: c.phoneNumber,
          industryData: c.industryData,
          whatsappConsentStatus: c.whatsappConsentStatus,
          city: 'Bengaluru',
          isDeleted: false,
        },
      },
      { upsert: true }
    );
  }

  // 4. Seed Auto-Reply Rules for Gym
  console.log('4. Seeding Gym Auto-Reply Keyword Rules...');
  const gymRules = [
    {
      name: 'Gym Membership Pricing Guide',
      keywords: ['MEMBERSHIP', 'PLANS', 'FEE'],
      matchType: 'contains',
      replyMessage: 'Hi! Thank you for inquiring about FitZone Gym memberships. We offer Monthly (₹2,500), Quarterly (₹6,500), and Annual (₹18,000) plans with full equipment & steam access. Reply TRIAL to book a free pass!',
    },
    {
      name: 'Free Trial Pass Booking',
      keywords: ['TRIAL', 'PASS', 'FREE'],
      matchType: 'contains',
      replyMessage: 'We would love to host you for a workout! Your free 1-Day VIP pass includes a trainer orientation. Please reply with: 1) Your preferred day, 2) Morning or Evening slot.',
    },
    {
      name: 'Gym Hours & Schedule',
      keywords: ['TIMINGS', 'HOURS', 'OPEN'],
      matchType: 'contains',
      replyMessage: 'FitZone Gym hours: Mon–Sat: 6:00 AM – 10:30 PM. Sunday: 7:00 AM – 8:00 PM. Lockers and showers are available.',
    },
  ];

  for (const r of gymRules) {
    await AutoReplyRule.findOneAndUpdate(
      { workspaceId: gymWs._id, name: r.name },
      {
        $set: {
          ownerId: gymOwner._id,
          workspaceId: gymWs._id,
          triggerKeyword: r.keywords[0],
          synonyms: r.keywords.slice(1),
          matchType: 'CONTAINS',
          actionType: 'RUN_MOCK_REPLY',
          responseMessage: r.replyMessage,
          enabled: true,
          priority: 10,
        },
      },
      { upsert: true }
    );
  }

  // 5. Seed Real Estate Contacts & Rules (M2W Demo Clone)
  const reWs = workspaceMap.get('m2w-realty-clone');
  const reOwner = userMap.get('m2w-owner@relay-demo.test');

  const reContacts = [
    {
      fullName: 'Deepak Singhania',
      phoneNumber: '+919876500201',
      interestedPropertyType: '3 BHK Apartment',
      interestedProject: 'DLF Privana',
      budgetRange: '₹2.5 Crore - ₹5 Crore',
      preferredLocation: 'Golf Course Extension Road',
      whatsappConsentStatus: 'Opted In',
    },
    {
      fullName: 'Ritu Kapoor',
      phoneNumber: '+919876500202',
      interestedPropertyType: 'Villas',
      interestedProject: 'Godrej Aristocrat',
      budgetRange: '₹5 Crore+',
      preferredLocation: 'Sector 49',
      whatsappConsentStatus: 'Opted In',
    },
  ];

  for (const c of reContacts) {
    await Contact.findOneAndUpdate(
      { workspaceId: reWs._id, phoneNumber: c.phoneNumber },
      {
        $set: {
          ownerId: reOwner._id,
          fullName: c.fullName,
          phoneNumber: c.phoneNumber,
          interestedPropertyType: c.interestedPropertyType,
          interestedProject: c.interestedProject,
          budgetRange: c.budgetRange,
          preferredLocation: c.preferredLocation,
          city: 'Gurugram',
          whatsappConsentStatus: c.whatsappConsentStatus,
          isDeleted: false,
        },
      },
      { upsert: true }
    );
  }

  // 6. Seed Inbox Conversations
  console.log('5. Seeding Simulated Conversations...');
  const gymContact1 = await Contact.findOne({ workspaceId: gymWs._id, phoneNumber: '+919876500101' });
  if (gymContact1) {
    let conv = await Conversation.findOne({ workspaceId: gymWs._id, contactId: gymContact1._id });
    if (!conv) {
      conv = await Conversation.create({
        workspaceId: gymWs._id,
        ownerId: gymOwner._id,
        contactId: gymContact1._id,
        channel: 'whatsapp',
        provider: 'none',
        source: 'synthetic_test',
        status: 'Open',
        automationStatus: 'ACTIVE',
        internalUnreadCount: 1,
        lastActivityAt: new Date(),
        lastInboundAt: new Date(Date.now() - 300000),
      });

      const inMsg = await ConversationMessage.create({
        conversationId: conv._id,
        contactId: gymContact1._id,
        ownerId: gymOwner._id,
        direction: 'inbound',
        messageType: 'text',
        messageSource: 'synthetic_test',
        trustLevel: 'synthetic',
        messageBody: 'Hi, what are your membership packages?',
        occurredAt: new Date(Date.now() - 300000),
      });

      const outMsg = await ConversationMessage.create({
        conversationId: conv._id,
        contactId: gymContact1._id,
        ownerId: gymOwner._id,
        direction: 'outbound',
        messageType: 'text',
        messageSource: 'synthetic_test',
        trustLevel: 'synthetic',
        messageBody: 'Hi Rahul! We offer Monthly (₹2,500), Quarterly (₹6,500), and Annual (₹18,000) plans. Reply TRIAL to book a free session!',
        occurredAt: new Date(Date.now() - 150000),
      });

      conv.lastMessageId = outMsg._id;
      await conv.save();
    }
  }

  // 7. Seed Agency & Client Relationship
  console.log('6. Seeding Spark Digital Agency & Delegated Client Relations...');
  const agencyOwner = userMap.get('agency-owner@relay-demo.test');
  const agencyManager = userMap.get('agency-manager@relay-demo.test');
  const agencyViewer = userMap.get('agency-viewer@relay-demo.test');

  let agency = await Agency.findOne({ slug: 'spark-digital' });
  if (!agency) {
    agency = await Agency.create({
      name: 'Spark Digital Demo Agency',
      slug: 'spark-digital',
      ownerId: agencyOwner._id,
      branding: {
        companyName: 'Spark Digital Agency',
        logoUrl: '',
        brandColor: '#0D9488',
        portalTitle: 'Spark Client Portal',
        customDomain: 'crm.sparkagency.test',
        domainStatus: 'ACTIVE',
        supportEmail: 'support@sparkagency.test',
        supportPhone: '+919876500000',
      },
      status: 'ACTIVE',
    });
  }

  // Agency memberships
  await AgencyMembership.findOneAndUpdate(
    { agencyId: agency._id, userId: agencyOwner._id },
    { $set: { role: 'AGENCY_OWNER', status: 'ACTIVE' } },
    { upsert: true }
  );

  await AgencyMembership.findOneAndUpdate(
    { agencyId: agency._id, userId: agencyManager._id },
    { $set: { role: 'AGENCY_MANAGER', status: 'ACTIVE' } },
    { upsert: true }
  );

  await AgencyMembership.findOneAndUpdate(
    { agencyId: agency._id, userId: agencyViewer._id },
    { $set: { role: 'AGENCY_VIEWER', status: 'ACTIVE' } },
    { upsert: true }
  );

  // Link client workspaces to agency
  const clientSlugs = ['fitzone-gym', 'glow-studio', 'careplus-clinic'];
  for (const slug of clientSlugs) {
    const ws = workspaceMap.get(slug);
    if (ws) {
      await AgencyClientRelation.findOneAndUpdate(
        { agencyId: agency._id, clientWorkspaceId: ws._id },
        {
          $set: {
            status: 'ACTIVE',
            delegatedPermissions: ['contacts:read', 'contacts:write', 'campaigns:manage', 'templates:manage', 'inbox:reply'],
          },
        },
        { upsert: true }
      );
    }
  }

  // 8. Seed Support Cases
  console.log('7. Seeding Platform Support Cases...');
  const supportCases = [
    {
      caseNumber: 'CASE-1001',
      workspaceId: gymWs._id,
      userId: gymOwner._id,
      subject: 'Inquiry regarding annual plan invoice receipt',
      description: 'Customer requested a PDF receipt for their simulated annual subscription renewal.',
      status: 'OPEN',
      priority: 'MEDIUM',
    },
    {
      caseNumber: 'CASE-1002',
      workspaceId: reWs._id,
      userId: reOwner._id,
      subject: 'Assistance with floor plan template brochure download',
      description: 'Verifying that digital brochure link resolves quickly in mock messaging mode.',
      status: 'RESOLVED',
      priority: 'LOW',
    },
  ];

  for (const sc of supportCases) {
    await SupportCase.findOneAndUpdate(
      { caseNumber: sc.caseNumber },
      { $set: sc },
      { upsert: true }
    );
  }

  console.log('--- RELAY DEMO SEEDING COMPLETED SUCCESSFULLY ---');
  console.log(`Default Demo Password for all accounts: ${DEMO_PASSWORD}`);
  return { success: true };
}

// Execute when invoked directly
if (process.argv[1]?.endsWith('seedCompleteDemoData.js')) {
  seedCompleteDemo()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seeding error:', err);
      process.exit(1);
    });
}

export default seedCompleteDemo;
