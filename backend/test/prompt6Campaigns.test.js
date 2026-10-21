import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Contact from '../src/models/Contact.js';
import ContactGroup from '../src/models/ContactGroup.js';
import ConsentRecord from '../src/models/ConsentRecord.js';
import Campaign from '../src/models/Campaign.js';
import CampaignAudience from '../src/models/CampaignAudience.js';
import AudienceSegment from '../src/models/AudienceSegment.js';
import MessageTemplate, { TemplateVersion } from '../src/models/MessageTemplate.js';
import CampaignExecution from '../src/models/CampaignExecution.js';
import CampaignMessageJob from '../src/models/CampaignMessageJob.js';
import { campaignWorkerTick } from '../src/services/campaignExecutionService.js';

process.env.JWT_SECRET = 'test-secret-prompt6-campaigns-orchestration-suite';
let mongo, owner, otherOwner, ownerToken, otherToken;
let contactOptedIn, contactOptedOut, contactUnknown, contactSuppressed, contactDemo;
let contactGroupA, contactGroupB;
let templateA, versionA, templateB, versionB;

const auth = token => ({ Authorization: `Bearer ${token}` });

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());

  owner = await User.create({
    name: 'M2W Owner',
    businessName: 'M2W Luxury Realty',
    email: 'owner@m2wrealty.example',
    passwordHash: 'testHash'
  });

  otherOwner = await User.create({
    name: 'Other Operator',
    businessName: 'Skyline Properties',
    email: 'other@skyline.example',
    passwordHash: 'testHash'
  });

  ownerToken = jwt.sign({ sub: String(owner._id) }, process.env.JWT_SECRET, { expiresIn: '2h' });
  otherToken = jwt.sign({ sub: String(otherOwner._id) }, process.env.JWT_SECRET, { expiresIn: '2h' });

  // Contact Groups
  contactGroupA = await ContactGroup.create({
    ownerId: owner._id,
    name: 'Gurugram High Net Worth',
    normalizedName: 'gurugram high net worth',
    description: 'HNW clients looking for luxury plots'
  });
  contactGroupB = await ContactGroup.create({
    ownerId: owner._id,
    name: 'Plot Investors Club',
    normalizedName: 'plot investors club',
    description: 'Frequent plot buyers'
  });

  // Contacts
  contactOptedIn = await Contact.create({
    ownerId: owner._id,
    fullName: 'Priya Sharma',
    phoneNumber: '+919876543210',
    companyName: 'Apex Innovations',
    city: 'Gurugram',
    location: 'Gurugram',
    interestedService: 'Residential Plots',
    interestedPropertyType: 'Residential Plots',
    interestedProject: 'DLF Privana',
    businessCategory: 'Real Estate',
    whatsappConsentStatus: 'Opted In',
    groups: [contactGroupA._id, contactGroupB._id]
  });

  // Recorded Consent with Audit for contactOptedIn
  await ConsentRecord.create({
    ownerId: owner._id,
    contactId: contactOptedIn._id,
    status: 'Opted In',
    consentedBusinessName: 'M2W Luxury Realty',
    consentPurpose: 'Property information and residential plots update',
    consentSource: 'Digital Sign-up Form',
    evidenceReference: 'FORM_AUDIT_REF_101',
    consentCapturedAt: new Date(Date.now() - 3600000),
    recordedBy: owner._id
  });

  contactOptedOut = await Contact.create({
    ownerId: owner._id,
    fullName: 'Rahul Verma',
    phoneNumber: '+919876543211',
    companyName: 'Verma Traders',
    city: 'Gurugram',
    interestedService: 'Residential Plots',
    businessCategory: 'Real Estate',
    whatsappConsentStatus: 'Opted Out',
    groups: [contactGroupA._id]
  });

  contactUnknown = await Contact.create({
    ownerId: owner._id,
    fullName: 'Amit Kapoor',
    phoneNumber: '+919876543212',
    companyName: 'Kapoor Corp',
    city: 'Noida',
    interestedService: 'Luxury Villas',
    businessCategory: 'Real Estate',
    whatsappConsentStatus: 'Unknown',
    groups: [contactGroupA._id]
  });

  contactSuppressed = await Contact.create({
    ownerId: owner._id,
    fullName: 'Suresh DNC',
    phoneNumber: '+919876543213',
    companyName: 'Do Not Contact LLC',
    city: 'Delhi',
    interestedService: 'Residential Plots',
    businessCategory: 'Real Estate',
    whatsappConsentStatus: 'Opted In',
    isSuppressed: true,
    suppressionReason: 'Do Not Contact requested'
  });

  contactDemo = await Contact.create({
    ownerId: owner._id,
    fullName: 'Demo Contact A',
    phoneNumber: '+919876543214',
    companyName: 'Demo Corp',
    city: 'Gurugram',
    interestedService: 'Residential Plots',
    businessCategory: 'Real Estate',
    whatsappConsentStatus: 'Opted In',
    isDemo: true
  });

  // Templates
  templateA = await MessageTemplate.create({
    ownerId: owner._id,
    name: 'Gurugram Plot Introduction',
    category: 'Marketing',
    language: 'en',
    body: 'Hi {{first_name}}, thank you for your interest in {{property_type}} in {{city}}.'
  });
  versionA = await TemplateVersion.create({
    ownerId: owner._id,
    templateId: templateA._id,
    versionNumber: 1,
    snapshot: {
      name: templateA.name,
      category: 'Marketing',
      language: 'en',
      body: templateA.body,
      header: 'Plot Alert',
      headerType: 'TEXT',
      footer: 'Reply STOP to opt out',
      buttons: [{ type: 'QUICK_REPLY', text: 'Schedule Visit' }],
      providerStatus: 'Approved'
    },
    internalVariables: ['first_name', 'property_type', 'city'],
    createdBy: owner._id
  });
  templateA.currentVersionId = versionA._id;
  templateA.currentVersionNumber = 1;
  await templateA.save();
});

after(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

test('Prompt 6 — 1. Campaign Wizard Step 1: Creation, Validation & Template Pinned Reference', async () => {
  // Rejects invalid short name
  const bad = await request(app)
    .post('/api/campaigns')
    .set(auth(ownerToken))
    .send({ name: 'ab', goal: 'Property Launch' });
  assert.equal(bad.status, 400);

  // Successfully creates draft campaign
  const res = await request(app)
    .post('/api/campaigns')
    .set(auth(ownerToken))
    .send({
      name: 'Gurugram Plot Launch Campaign',
      description: 'Exclusive plot opportunities for high net worth investors',
      goal: 'Plot & Land Investment Update',
      service: 'Residential Plots',
      category: 'Residential Plots',
      location: 'Gurugram',
      language: 'en',
      tags: ['gurugram', 'plots', 'hnw'],
      campaignType: 'one-time',
      selectedTemplateId: String(templateA._id),
      selectedTemplateVersionId: String(versionA._id),
      wizardStep: 1
    });

  assert.equal(res.status, 201);
  const campaign = res.body.campaign;
  assert.equal(campaign.name, 'Gurugram Plot Launch Campaign');
  assert.equal(campaign.status, 'Draft');
  assert.equal(campaign.executionMode, 'MOCK');
  assert.equal(String(campaign.selectedTemplateId), String(templateA._id));
  assert.equal(String(campaign.selectedTemplateVersionId), String(versionA._id));

  // Multi-tenant check: Other owner cannot access
  const otherCheck = await request(app)
    .get(`/api/campaigns/${campaign._id}`)
    .set(auth(otherToken));
  assert.equal(otherCheck.status, 404);
});

test('Prompt 6 — 2. Template Snapshot Immutability (Preserves pinned content when template is edited)', async () => {
  const cRes = await request(app)
    .post('/api/campaigns')
    .set(auth(ownerToken))
    .send({
      name: 'Immutable Template Test Campaign',
      goal: 'Property Launch Announcement',
      service: 'Residential Plots',
      selectedTemplateId: String(templateA._id),
      selectedTemplateVersionId: String(versionA._id),
      wizardStep: 1
    });
  const campaignId = cRes.body.campaign._id;

  // Snapshot audience
  await request(app)
    .post(`/api/campaigns/${campaignId}/audience`)
    .set(auth(ownerToken))
    .send({ mode: 'manual', definition: { contactIds: [contactOptedIn._id] } });

  // Launch mock campaign to freeze templateSnapshot
  const launchRes = await request(app)
    .post(`/api/campaigns/${campaignId}/launch`)
    .set(auth(ownerToken));
  assert.equal(launchRes.status, 201);

  const runningCampaign = await Campaign.findById(campaignId).lean();
  assert.equal(runningCampaign.status, 'Running');
  assert.ok(runningCampaign.templateSnapshot, 'Template snapshot must be stored on campaign');
  assert.equal(runningCampaign.templateSnapshot.body, templateA.body);

  // Now mutate source template in Template Studio
  templateA.body = 'MUTATED BODY: Special luxury penthouse collection now open.';
  await templateA.save();

  // Run worker tick to process the message job
  await campaignWorkerTick();

  // Inspect the generated Message record
  const updatedCampaign = await Campaign.findById(campaignId).lean();
  // Pinned template snapshot remains unaffected by the mutation!
  assert.equal(updatedCampaign.templateSnapshot.body, 'Hi {{first_name}}, thank you for your interest in {{property_type}} in {{city}}.');
});

test('Prompt 6 — 3. Live Audience Eligibility Endpoint (POST /api/campaigns/audience/preview)', async () => {
  // Test live audience preview across group A
  const res = await request(app)
    .post('/api/campaigns/audience/preview')
    .set(auth(ownerToken))
    .send({
      mode: 'group',
      definition: { groupId: String(contactGroupA._id) },
      templateId: String(templateA._id),
      templateVersionId: String(versionA._id),
      goal: 'Plot & Land Investment Update',
      service: 'Residential Plots'
    });

  assert.equal(res.status, 200);
  const { summary, samplePreviews } = res.body;

  assert.ok(summary.matchingContacts >= 3, 'Must match at least 3 contacts in Group A');
  assert.ok(summary.validPhoneCount >= 3, 'All 3 sample contacts have valid international phones');
  assert.ok(summary.optedInCount >= 1, 'At least 1 contact has affirmative consent');
  assert.ok(summary.optedOutCount >= 1, 'Rahul Verma is detected as Opted Out');
  assert.ok(summary.unknownConsentCount >= 1, 'Amit Kapoor is detected as Unknown Consent');
  assert.ok(summary.currentlyEligibleRecipients >= 1, 'Priya Sharma is currently eligible');
  assert.equal(summary.exclusionBreakdown.CONTACT_OPTED_OUT >= 1, true);
  assert.equal(summary.exclusionBreakdown.MISSING_CONSENT >= 1, true);

  // Check sample preview resolution
  const priyaPreview = samplePreviews.find(s => s.fullName === 'Priya Sharma');
  assert.ok(priyaPreview);
  assert.equal(priyaPreview.isEligible, true);
  assert.ok(priyaPreview.renderedPreview.body.includes('Priya'));
  assert.ok(priyaPreview.renderedPreview.body.includes('Residential Plots'));
});

test('Prompt 6 — 4. Audience Deduplication (Eliminates duplicates across multiple groups & criteria)', async () => {
  const cRes = await request(app)
    .post('/api/campaigns')
    .set(auth(ownerToken))
    .send({
      name: 'Deduplication Test Campaign',
      goal: 'Plot & Land Investment Update',
      service: 'Residential Plots',
      selectedTemplateId: String(templateA._id),
      selectedTemplateVersionId: String(versionA._id)
    });
  const campaignId = cRes.body.campaign._id;

  // Contact Priya is in both Group A and Group B.
  // Snapshot audience with manual duplicates
  const snapRes = await request(app)
    .post(`/api/campaigns/${campaignId}/audience`)
    .set(auth(ownerToken))
    .send({
      mode: 'manual',
      definition: { contactIds: [contactOptedIn._id, contactOptedIn._id, contactOptedIn._id] }
    });

  assert.equal(snapRes.status, 200);
  assert.equal(snapRes.body.audience.count, 1, 'Audience snapshot must deduplicate identical contact IDs to 1 unique recipient');
  assert.equal(snapRes.body.audience.duplicates, 2);

  // Verify unique index in CampaignAudience
  const audienceDocs = await CampaignAudience.find({ campaignId, snapshotVersion: snapRes.body.audience.version });
  assert.equal(audienceDocs.length, 1);
});

test('Prompt 6 — 5. Consent Enforcement: Ineligible Contacts Are Blocked From Dispatch', async () => {
  const cRes = await request(app)
    .post('/api/campaigns')
    .set(auth(ownerToken))
    .send({
      name: 'Consent Block Test Campaign',
      goal: 'Plot & Land Investment Update',
      service: 'Residential Plots',
      selectedTemplateId: String(templateA._id),
      selectedTemplateVersionId: String(versionA._id)
    });
  const campaignId = cRes.body.campaign._id;

  // Snapshot Rahul (Opted Out) and Amit (Unknown Consent)
  await request(app)
    .post(`/api/campaigns/${campaignId}/audience`)
    .set(auth(ownerToken))
    .send({
      mode: 'manual',
      definition: { contactIds: [contactOptedOut._id, contactUnknown._id, contactSuppressed._id] }
    });

  // Launch mock campaign
  const launchRes = await request(app)
    .post(`/api/campaigns/${campaignId}/launch`)
    .set(auth(ownerToken));
  assert.equal(launchRes.status, 201);

  // Process jobs via worker
  await campaignWorkerTick();

  // Check job records: All 3 contacts must be marked 'blocked', ZERO mock success!
  const jobs = await CampaignMessageJob.find({ campaignId }).lean();
  assert.equal(jobs.length, 3);
  for (const job of jobs) {
    assert.equal(job.status, 'blocked', `Job for contact ${job.contactId} must be blocked`);
    assert.ok(job.error.length > 0, 'Must record specific blocking reason');
  }
});

test('Prompt 6 — 6. Durable Scheduling, Validation & Worker Reconciliation', async () => {
  const cRes = await request(app)
    .post('/api/campaigns')
    .set(auth(ownerToken))
    .send({
      name: 'Scheduled Launch Campaign',
      goal: 'Plot & Land Investment Update',
      service: 'Residential Plots',
      selectedTemplateId: String(templateA._id),
      selectedTemplateVersionId: String(versionA._id)
    });
  const campaignId = cRes.body.campaign._id;

  // Snapshot audience
  await request(app)
    .post(`/api/campaigns/${campaignId}/audience`)
    .set(auth(ownerToken))
    .send({ mode: 'manual', definition: { contactIds: [contactOptedIn._id] } });

  // 1. Rejects past schedule
  const pastRes = await request(app)
    .post(`/api/campaigns/${campaignId}/schedule`)
    .set(auth(ownerToken))
    .send({ startAt: new Date(Date.now() - 3600000).toISOString(), timezone: 'Asia/Kolkata' });
  assert.equal(pastRes.status, 400);

  // 2. Rejects invalid timezone
  const tzRes = await request(app)
    .post(`/api/campaigns/${campaignId}/schedule`)
    .set(auth(ownerToken))
    .send({ startAt: new Date(Date.now() + 3600000).toISOString(), timezone: 'Invalid/NonExistent_Tz' });
  assert.equal(tzRes.status, 400);

  // 3. Schedules future run in Asia/Kolkata
  const futureDate = new Date(Date.now() + 7200000);
  const schedRes = await request(app)
    .post(`/api/campaigns/${campaignId}/schedule`)
    .set(auth(ownerToken))
    .send({ startAt: futureDate.toISOString(), timezone: 'Asia/Kolkata' });
  assert.equal(schedRes.status, 201);
  assert.equal(schedRes.body.campaign.status, 'Scheduled');
  assert.equal(schedRes.body.schedule.status, 'scheduled');

  // 4. Reschedule to a new future time
  const newFutureDate = new Date(Date.now() + 10800000);
  const reschedRes = await request(app)
    .post(`/api/campaigns/${campaignId}/reschedule`)
    .set(auth(ownerToken))
    .send({ startAt: newFutureDate.toISOString(), timezone: 'Asia/Kolkata' });
  assert.equal(reschedRes.status, 200);
  assert.equal(reschedRes.body.campaign.status, 'Scheduled');

  // 5. Worker tick picks up due scheduled campaigns
  // Temporarily set startAt to past to simulate due time
  await Campaign.updateOne({ _id: campaignId }, { $set: { 'mockSchedule.startAt': new Date(Date.now() - 1000) } });
  await campaignWorkerTick();

  const triggered = await Campaign.findById(campaignId).lean();
  assert.equal(triggered.status, 'Running');
  assert.equal(triggered.mockSchedule.status, 'triggered');
  assert.ok(triggered.activeExecutionId, 'Execution must be active');
});

test('Prompt 6 — 7. Pause, Resume and Cancel Lifecycle Semantics', async () => {
  const cRes = await request(app)
    .post('/api/campaigns')
    .set(auth(ownerToken))
    .send({
      name: 'Pause Resume Cancel Lifecycle Campaign',
      goal: 'Plot & Land Investment Update',
      service: 'Residential Plots',
      selectedTemplateId: String(templateA._id),
      selectedTemplateVersionId: String(versionA._id)
    });
  const campaignId = cRes.body.campaign._id;

  await request(app)
    .post(`/api/campaigns/${campaignId}/audience`)
    .set(auth(ownerToken))
    .send({ mode: 'manual', definition: { contactIds: [contactOptedIn._id] } });

  // Launch mock campaign
  await request(app).post(`/api/campaigns/${campaignId}/launch`).set(auth(ownerToken));

  // Pause
  const pauseRes = await request(app).post(`/api/campaigns/${campaignId}/pause`).set(auth(ownerToken));
  assert.equal(pauseRes.status, 200);
  assert.equal(pauseRes.body.campaignStatus, 'Paused');

  const pausedDoc = await Campaign.findById(campaignId).lean();
  assert.equal(pausedDoc.status, 'Paused');

  // Resume
  const resumeRes = await request(app).post(`/api/campaigns/${campaignId}/resume`).set(auth(ownerToken));
  assert.equal(resumeRes.status, 200);
  assert.equal(resumeRes.body.campaignStatus, 'Running');

  const runningDoc = await Campaign.findById(campaignId).lean();
  assert.equal(runningDoc.status, 'Running');

  // Cancel
  const cancelRes = await request(app).post(`/api/campaigns/${campaignId}/cancel`).set(auth(ownerToken));
  assert.equal(cancelRes.status, 200);
  assert.equal(cancelRes.body.cancelled, true);

  const cancelledDoc = await Campaign.findById(campaignId).lean();
  assert.equal(cancelledDoc.status, 'Cancelled');
  assert.equal(cancelledDoc.activeExecutionId, null);
});

test('Prompt 6 — 8. Campaign Duplication & Archiving', async () => {
  const cRes = await request(app)
    .post('/api/campaigns')
    .set(auth(ownerToken))
    .send({
      name: 'Original Luxury Villa Campaign',
      goal: 'Luxury Apartment Showcase',
      service: 'Residential Plots',
      selectedTemplateId: String(templateA._id),
      selectedTemplateVersionId: String(versionA._id)
    });
  const origId = cRes.body.campaign._id;

  // Duplicate
  const dupRes = await request(app).post(`/api/campaigns/${origId}/duplicate`).set(auth(ownerToken));
  assert.equal(dupRes.status, 201);
  const dupCampaign = dupRes.body.campaign;
  assert.notEqual(String(dupCampaign._id), String(origId));
  assert.equal(dupCampaign.status, 'Draft');
  assert.ok(dupCampaign.name.includes('Copy of Original Luxury Villa Campaign'));
  assert.equal(dupCampaign.activeExecutionId, null);

  // Archive original
  const archRes = await request(app).post(`/api/campaigns/${origId}/archive`).set(auth(ownerToken));
  assert.equal(archRes.status, 200);
  assert.equal(archRes.body.campaign.status, 'Archived');
});

test('Prompt 6 — 9. Campaign Analytics & Statistics', async () => {
  const cRes = await request(app)
    .post('/api/campaigns')
    .set(auth(ownerToken))
    .send({
      name: 'Analytics Test Campaign',
      goal: 'Plot & Land Investment Update',
      service: 'Residential Plots',
      selectedTemplateId: String(templateA._id),
      selectedTemplateVersionId: String(versionA._id)
    });
  const campaignId = cRes.body.campaign._id;

  await request(app)
    .post(`/api/campaigns/${campaignId}/audience`)
    .set(auth(ownerToken))
    .send({ mode: 'manual', definition: { contactIds: [contactOptedIn._id] } });

  await request(app).post(`/api/campaigns/${campaignId}/launch`).set(auth(ownerToken));
  await campaignWorkerTick();

  const analyticsRes = await request(app).get(`/api/campaigns/${campaignId}/analytics`).set(auth(ownerToken));
  assert.equal(analyticsRes.status, 200);
  const a = analyticsRes.body;
  assert.equal(a.executionMode, 'MOCK');
  assert.equal(a.mockSummary.totalJobs, 1);
  assert.equal(a.mockSummary.simulatedSent, 1);

  // Stats
  const statsRes = await request(app).get('/api/campaigns/stats').set(auth(ownerToken));
  assert.equal(statsRes.status, 200);
  assert.ok(statsRes.body.stats.totalCampaigns >= 4);
});
