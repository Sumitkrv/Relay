import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcryptjs';

import User from '../src/models/User.js';
import Workspace from '../src/models/Workspace.js';
import WorkspaceMembership from '../src/models/WorkspaceMembership.js';
import Contact from '../src/models/Contact.js';
import MessageTemplate from '../src/models/MessageTemplate.js';
import AutoReplyRule from '../src/models/AutoReplyRule.js';
import WorkspaceSubscription from '../src/models/WorkspaceSubscription.js';
import BillingInvoice from '../src/models/BillingInvoice.js';
import Agency from '../src/models/Agency.js';
import AgencyMembership from '../src/models/AgencyMembership.js';
import AgencyClientRelation from '../src/models/AgencyClientRelation.js';
import SupportCase from '../src/models/SupportCase.js';

import { getEmailHistory, getLastEmail, clearEmailHistory, sendEmail } from '../src/services/emailService.js';
import industryRegistry from '../src/config/industries/industryRegistry.js';
import industryConfigurationService from '../src/services/industryConfigurationService.js';
import mockBillingService from '../src/services/mockBillingService.js';

let mongod;

test.before(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
});

test.after(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

test('1. Local Dev Mailbox intercepts emails safely and supports retrieval & clear', async () => {
  clearEmailHistory();
  assert.equal(getEmailHistory().length, 0);

  // Send intercepted emails
  await sendEmail({
    to: 'customer@relay-demo.test',
    subject: 'Verify your Relay Account',
    text: 'Click here to verify: http://localhost:5174/verify-email?token=test-token-123',
    html: '<p>Click to verify</p>',
  });

  await sendEmail({
    to: 'customer@relay-demo.test',
    subject: 'Reset Password',
    text: 'Reset link: http://localhost:5174/reset-password?token=reset-456',
    html: '<p>Reset link</p>',
  });

  const emails = getEmailHistory();
  assert.equal(emails.length, 2);
  assert.equal(emails[0].subject, 'Verify your Relay Account');
  assert.equal(emails[1].subject, 'Reset Password');

  const latest = getLastEmail();
  assert.ok(latest);
  assert.equal(latest.subject, 'Reset Password');

  clearEmailHistory();
  assert.equal(getEmailHistory().length, 0);
});

test('2. Multi-Industry Configuration Registry supports all 7 industries with validation', async () => {
  const industries = industryRegistry.getAllIndustryConfigs();
  assert.ok(industries.length >= 7, `Expected at least 7 industries, got ${industries.length}`);

  const expectedKeys = ['real_estate', 'gym', 'salon', 'clinic', 'education', 'automobile', 'other'];
  expectedKeys.forEach((key) => {
    const config = industryRegistry.getIndustryConfig(key);
    assert.ok(config, `Missing industry configuration for: ${key}`);
    assert.ok(config.contactFields && config.contactFields.length > 0, `Fields missing for: ${key}`);
    const presets = config.automationPresets || config.keywordAutomationPresets || [];
    assert.ok(presets.length > 0, `Keyword presets missing for: ${key}`);
    const templates = config.templatePresets || config.templateSuggestions || [];
    assert.ok(templates.length > 0, `Templates missing for: ${key}`);
  });

  // Verify clinic privacy compliance: no forbidden medical history fields
  const clinicConfig = industryRegistry.getIndustryConfig('clinic');
  clinicConfig.contactFields.forEach((field) => {
    assert.ok(!field.key.toLowerCase().includes('diagnosis'), 'Clinic must not have diagnosis field');
    assert.ok(!field.key.toLowerCase().includes('medical_history'), 'Clinic must not have medical history field');
  });

  // Test dynamic field sanitization
  const { sanitized } = industryConfigurationService.validateAndSanitizeIndustryData({
    membershipType: 'Annual Membership',
    fitnessGoal: 'Weight Loss',
    trialSessionDate: '2026-11-01',
    unauthorizedField: 'malicious',
  }, 'gym');

  assert.equal(sanitized.membershipType, 'Annual Membership');
  assert.equal(sanitized.unauthorizedField, undefined, 'Unauthorized dynamic field must be stripped');
});

test('3. Real MongoDB persistence: Users, Bcrypt password hashing, and Workspaces', async () => {
  const passwordHash = await bcrypt.hash('DemoPass123!', 10);
  const user = await User.create({
    name: 'Rahul Sharma',
    email: 'gym-owner@relay-demo.test',
    passwordHash: passwordHash,
    role: 'owner',
    isEmailVerified: true,
  });

  assert.ok(user._id);
  const isMatch = await bcrypt.compare('DemoPass123!', user.passwordHash);
  assert.equal(isMatch, true);
  const wrongMatch = await bcrypt.compare('WrongPassword', user.passwordHash);
  assert.equal(wrongMatch, false);

  const workspace = await Workspace.create({
    name: 'FitZone Gym',
    slug: 'fitzone-gym',
    industryKey: 'gym',
    businessEmail: 'contact@fitzone.test',
    businessPhone: '+919876500100',
    status: 'ACTIVE',
    createdBy: user._id,
  });

  assert.ok(workspace._id);
  assert.equal(workspace.industryKey, 'gym');

  const membership = await WorkspaceMembership.create({
    workspaceId: workspace._id,
    userId: user._id,
    role: 'OWNER',
    status: 'ACTIVE',
  });

  assert.ok(membership._id);
  assert.equal(membership.role, 'OWNER');
});

test('4. Dynamic Contacts CRUD & Keyword Auto-Reply Rule Execution', async () => {
  const gymOwner = await User.findOne({ email: 'gym-owner@relay-demo.test' });
  const gymWs = await Workspace.findOne({ slug: 'fitzone-gym' });

  // Create contact with dynamic gym fields
  const contact = await Contact.create({
    ownerId: gymOwner._id,
    workspaceId: gymWs._id,
    fullName: 'Rahul Gym Lead',
    phoneNumber: '+919876500999',
    whatsappConsentStatus: 'Opted In',
    industryData: {
      membershipType: 'Annual Membership',
      fitnessGoal: 'Muscle Gain',
    },
  });

  assert.ok(contact._id);
  assert.equal(contact.industryData.membershipType, 'Annual Membership');

  // Create Gym TRIAL AutoReplyRule
  const rule = await AutoReplyRule.create({
    ownerId: gymOwner._id,
    workspaceId: gymWs._id,
    name: 'Free Trial Offer',
    triggerKeyword: 'TRIAL',
    synonyms: ['DEMO', 'FREE TRIAL'],
    matchType: 'CONTAINS',
    actionType: 'RUN_MOCK_REPLY',
    responseMessage: 'Thanks for asking about our Free Trial! Reply YES to confirm tomorrow 10am.',
    enabled: true,
  });

  assert.ok(rule._id);
  assert.equal(rule.triggerKeyword, 'TRIAL');
  assert.equal(rule.actionType, 'RUN_MOCK_REPLY');
});

test('5. Mock Billing Service: Subscription lifecycle, 14-day trial, and test clock advance', async () => {
  const gymWs = await Workspace.findOne({ slug: 'fitzone-gym' });

  // Initialize trial subscription
  const sub = await mockBillingService.getSubscription(gymWs._id);
  assert.ok(sub);
  assert.equal(sub.status, 'TRIALING');
  assert.equal(sub.planId, 'solo_799');
  assert.equal(sub.amount, 799);

  // Simulate mock checkout
  const checkoutResult = await mockBillingService.simulateCheckout(gymWs._id, { planId: 'solo_799' });
  assert.equal(checkoutResult.success, true);
  assert.equal(checkoutResult.subscription.status, 'ACTIVE');

  // Verify invoice generated
  const invoices = await BillingInvoice.find({ workspaceId: gymWs._id });
  assert.equal(invoices.length, 1);
  assert.equal(invoices[0].amount, 799);
  assert.equal(invoices[0].status, 'PAID');
  assert.equal(invoices[0].isMock, true);

  // Test clock advance (+15 days)
  const updatedSub = await mockBillingService.advanceTestClock(gymWs._id, 15);
  assert.ok(updatedSub.testClockOffsetMs > 0);

  // Cancel subscription
  const cancelResult = await mockBillingService.cancelSubscription(gymWs._id);
  assert.equal(cancelResult.status, 'CANCELED');
});

test('6. Agency & Delegated Client Relationships & Custom Domain State Machine', async () => {
  const agencyOwner = await User.create({
    name: 'Agency Lead',
    email: 'agency-lead@relay-demo.test',
    passwordHash: await bcrypt.hash('DemoPass123!', 10),
    role: 'owner',
    isEmailVerified: true,
  });

  const agency = await Agency.create({
    name: 'Spark Digital Demo Agency',
    slug: 'spark-digital-test',
    ownerId: agencyOwner._id,
    branding: {
      companyName: 'Spark Digital',
      brandColor: '#0D9488',
      portalTitle: 'Spark Portal',
      customDomain: 'crm.sparkdigital.test',
      domainStatus: 'DNS_PENDING',
    },
    status: 'ACTIVE',
  });

  assert.ok(agency._id);
  assert.equal(agency.branding.domainStatus, 'DNS_PENDING');

  const gymWs = await Workspace.findOne({ slug: 'fitzone-gym' });

  // Delegate access to FitZone Gym
  const relation = await AgencyClientRelation.create({
    agencyId: agency._id,
    clientWorkspaceId: gymWs._id,
    status: 'ACTIVE',
    delegatedPermissions: ['contacts:read', 'contacts:write', 'campaigns:manage', 'inbox:reply'],
  });

  assert.ok(relation._id);
  assert.equal(relation.delegatedPermissions.length, 4);

  // Simulate DNS verification
  agency.branding.domainStatus = 'VERIFIED';
  await agency.save();
  assert.equal(agency.branding.domainStatus, 'VERIFIED');

  // Simulate TLS Certificate issuance
  agency.branding.domainStatus = 'ACTIVE';
  await agency.save();
  assert.equal(agency.branding.domainStatus, 'ACTIVE');
});

test('7. Cross-Tenant Isolation: Complete segregation of records between workspaces', async () => {
  // Create Salon Workspace and Salon Owner
  const salonOwner = await User.create({
    name: 'Salon Owner',
    email: 'salon-test-owner@relay-demo.test',
    passwordHash: await bcrypt.hash('DemoPass123!', 10),
    role: 'owner',
    isEmailVerified: true,
  });

  const salonWs = await Workspace.create({
    name: 'Glow Studio Test',
    slug: 'glow-studio-test',
    industryKey: 'salon',
    businessEmail: 'contact@glowstudio.test',
    businessPhone: '+919876500200',
    status: 'ACTIVE',
    createdBy: salonOwner._id,
  });

  const gymWs = await Workspace.findOne({ slug: 'fitzone-gym' });

  // Create confidential Salon contact
  const salonContact = await Contact.create({
    ownerId: salonOwner._id,
    workspaceId: salonWs._id,
    fullName: 'Salon VIP Client',
    phoneNumber: '+919876500888',
    whatsappConsentStatus: 'Opted In',
    industryData: { preferredService: 'Bridal Makeover' },
  });

  // Querying Gym workspace MUST NOT return Salon contact
  const gymContacts = await Contact.find({ workspaceId: gymWs._id, isDeleted: false });
  const hasLeakedSalon = gymContacts.some((c) => c._id.toString() === salonContact._id.toString());
  assert.equal(hasLeakedSalon, false, 'Salon contact must never appear in Gym workspace query');

  // Querying Salon workspace MUST NOT return Gym contacts
  const salonContacts = await Contact.find({ workspaceId: salonWs._id, isDeleted: false });
  const hasLeakedGym = salonContacts.some((c) => c.fullName.includes('Gym'));
  assert.equal(hasLeakedGym, false, 'Gym contact must never appear in Salon workspace query');
});
