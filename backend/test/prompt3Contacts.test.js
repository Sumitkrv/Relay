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
import AudienceSegment from '../src/models/AudienceSegment.js';
import ConsentRecord from '../src/models/ConsentRecord.js';
import ContactActivity from '../src/models/ContactActivity.js';

process.env.JWT_SECRET = 'test-secret-value-that-is-long-enough-for-contact-tests';
let mongo, owner, otherOwner, ownerToken, otherToken;
const auth = (token) => ({ Authorization: `Bearer ${token}` });

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([
    Contact.init(),
    ContactGroup.init(),
    AudienceSegment.init(),
    ConsentRecord.init(),
    ContactActivity.init()
  ]);

  owner = await User.create({
    name: 'M2W Owner',
    email: 'realty.owner@m2w.test',
    passwordHash: 'not-a-real-hash',
    businessName: 'M2W Realty'
  });

  otherOwner = await User.create({
    name: 'Competitor Owner',
    email: 'other.owner@realty.test',
    passwordHash: 'not-a-real-hash',
    businessName: 'Other Realty'
  });

  ownerToken = jwt.sign({ sub: owner._id.toString() }, process.env.JWT_SECRET, { expiresIn: '1h' });
  otherToken = jwt.sign({ sub: otherOwner._id.toString() }, process.env.JWT_SECRET, { expiresIn: '1h' });
});

after(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

test('Prompt 3 - 1. Real Estate Contact CRUD & E.164 Phone Normalization', async () => {
  // Create contact with real estate fields
  const res = await request(app)
    .post('/api/contacts')
    .set(auth(ownerToken))
    .send({
      fullName: 'Vikram Malhotra',
      phoneNumber: '98112 34567',
      alternatePhone: '98112 34568',
      countryCode: 'IN',
      city: 'Gurugram',
      state: 'Haryana',
      country: 'India',
      interestedPropertyType: 'Apartments',
      interestedProject: 'DLF Privana',
      preferredLocation: 'Golf Course Extension Road',
      budgetRange: '₹3 Cr - ₹4.5 Cr',
      estimatedDealValue: 35000000,
      leadSource: 'Website Enquiry',
      leadStatus: 'Interested',
      priority: 'High',
      tags: ['Gurugram Buyer', 'High Budget'],
      notes: 'Prefers 4 BHK on high floor with panoramic green view'
    });

  assert.equal(res.status, 201);
  assert.equal(res.body.contact.phoneNumber, '+919811234567');
  assert.equal(res.body.contact.city, 'Gurugram');
  assert.equal(res.body.contact.interestedPropertyType, 'Apartments');
  assert.equal(res.body.contact.interestedProject, 'DLF Privana');
  // Default consent must strictly be Unknown
  assert.equal(res.body.contact.whatsappConsentStatus, 'Unknown');
  assert.equal(res.body.contact.isSuppressed, false);

  const contactId = res.body.contact._id;

  // Retrieve contact details
  const getRes = await request(app).get(`/api/contacts/${contactId}`).set(auth(ownerToken));
  assert.equal(getRes.status, 200);
  assert.equal(getRes.body.contact.fullName, 'Vikram Malhotra');
  assert.equal(getRes.body.contact.budgetRange, '₹3 Cr - ₹4.5 Cr');

  // Edit contact
  const updateRes = await request(app)
    .patch(`/api/contacts/${contactId}`)
    .set(auth(ownerToken))
    .send({
      leadStatus: 'Negotiation',
      budgetRange: '₹4 Cr - ₹5 Cr',
      interestedProject: 'Godrej Aristocrat'
    });

  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.body.contact.leadStatus, 'Negotiation');
  assert.equal(updateRes.body.contact.interestedProject, 'Godrej Aristocrat');

  // Tenant isolation: other owner cannot read or update
  const leakGet = await request(app).get(`/api/contacts/${contactId}`).set(auth(otherToken));
  assert.equal(leakGet.status, 404);

  const leakPatch = await request(app).patch(`/api/contacts/${contactId}`).set(auth(otherToken)).send({ leadStatus: 'Closed' });
  assert.equal(leakPatch.status, 404);
});

test('Prompt 3 - 2. Duplicate Phone Validation and Scoped Uniqueness', async () => {
  // Same owner attempting duplicate normalized phone (+919811234567)
  const dup = await request(app)
    .post('/api/contacts')
    .set(auth(ownerToken))
    .send({
      fullName: 'Vikram Duplicate',
      phoneNumber: '+91 98112 34567',
      countryCode: 'IN'
    });
  assert.equal(dup.status, 409);
  assert.ok(dup.body.message.includes('already exists'));

  // Other owner CAN have same phone number in their isolated account
  const otherOwnerContact = await request(app)
    .post('/api/contacts')
    .set(auth(otherToken))
    .send({
      fullName: 'Vikram in Other Workspace',
      phoneNumber: '+91 98112 34567',
      countryCode: 'IN'
    });
  assert.equal(otherOwnerContact.status, 201);
});

test('Prompt 3 - 3. Real Estate Contact Groups CRUD & Safe Member Detachment', async () => {
  // Create a contact group
  const createGroupRes = await request(app)
    .post('/api/contact-groups')
    .set(auth(ownerToken))
    .send({
      name: 'Gurugram Luxury Prospects',
      description: 'Prospects interested in projects above ₹3 Crore in Gurugram',
      color: '#0D9488'
    });

  assert.equal(createGroupRes.status, 201);
  const groupId = createGroupRes.body.group._id;
  assert.equal(createGroupRes.body.group.name, 'Gurugram Luxury Prospects');
  assert.equal(createGroupRes.body.group.normalizedName, 'gurugram luxury prospects');

  // Duplicate group name for same owner rejected
  const dupGroup = await request(app)
    .post('/api/contact-groups')
    .set(auth(ownerToken))
    .send({
      name: '  gurugram luxury prospects  '
    });
  assert.equal(dupGroup.status, 409);

  // Find our contact
  const contact = await Contact.findOne({ ownerId: owner._id, fullName: 'Vikram Malhotra' });
  assert.ok(contact);

  // Add contact to group via group members API
  const addMemberRes = await request(app)
    .post(`/api/contact-groups/${groupId}/members`)
    .set(auth(ownerToken))
    .send({
      action: 'add',
      contactIds: [contact._id.toString()]
    });

  assert.equal(addMemberRes.status, 200);
  assert.equal(addMemberRes.body.contactCount, 1);

  // Verify contact now has group ID
  const refreshedContact = await Contact.findById(contact._id);
  assert.ok(refreshedContact.groups.some(g => g.toString() === groupId));

  // List members of group
  const listMembersRes = await request(app)
    .get(`/api/contact-groups/${groupId}/members`)
    .set(auth(ownerToken));

  assert.equal(listMembersRes.status, 200);
  assert.equal(listMembersRes.body.total, 1);
  assert.equal(listMembersRes.body.records[0].fullName, 'Vikram Malhotra');

  // Filter contacts by group
  const filterByGroupRes = await request(app)
    .get(`/api/contacts?group=${groupId}`)
    .set(auth(ownerToken));

  assert.equal(filterByGroupRes.status, 200);
  assert.equal(filterByGroupRes.body.total, 1);

  // Safe deletion of group does NOT delete member contacts
  const deleteGroupRes = await request(app)
    .delete(`/api/contact-groups/${groupId}`)
    .set(auth(ownerToken));

  assert.equal(deleteGroupRes.status, 200);

  // Contact still exists in MongoDB!
  const survivingContact = await Contact.findById(contact._id);
  assert.ok(survivingContact);
  assert.equal(survivingContact.fullName, 'Vikram Malhotra');
  // Group ID is pulled from contact's groups array
  assert.ok(!survivingContact.groups.some(g => g.toString() === groupId));
});

test('Prompt 3 - 4. Tag Taxonomy Management (Create, Rename across contacts, Delete safely)', async () => {
  const contact = await Contact.findOne({ ownerId: owner._id, fullName: 'Vikram Malhotra' });

  // List tags
  const listTagsRes = await request(app).get('/api/contacts/tags').set(auth(ownerToken));
  assert.equal(listTagsRes.status, 200);
  assert.ok(listTagsRes.body.tags.some(t => t.name.toLowerCase() === 'gurugram buyer'));

  // Rename tag: 'gurugram buyer' -> 'ncr luxury buyer'
  const renameRes = await request(app)
    .patch('/api/contacts/tags')
    .set(auth(ownerToken))
    .send({
      oldName: 'gurugram buyer',
      newName: 'ncr luxury buyer'
    });

  assert.equal(renameRes.status, 200);
  assert.ok(renameRes.body.modifiedCount >= 1);

  // Verify contact now has the renamed tag
  const updatedContact = await Contact.findById(contact._id);
  assert.ok(updatedContact.tags.includes('ncr luxury buyer'));
  assert.ok(!updatedContact.tags.includes('gurugram buyer'));

  // Delete tag: 'ncr luxury buyer'
  const deleteTagRes = await request(app)
    .delete('/api/contacts/tags?name=ncr%20luxury%20buyer')
    .set(auth(ownerToken));

  assert.equal(deleteTagRes.status, 200);

  // Contact still exists, tag removed
  const finalContact = await Contact.findById(contact._id);
  assert.ok(!finalContact.tags.includes('ncr luxury buyer'));
});

test('Prompt 3 - 5. Dynamic Segment Condition Engine with Allowlisted Operators', async () => {
  // Create additional test contact
  await request(app)
    .post('/api/contacts')
    .set(auth(ownerToken))
    .send({
      fullName: 'Sunita Rao',
      phoneNumber: '+919822334455',
      city: 'Delhi',
      interestedPropertyType: 'Farmhouses',
      budgetRange: '₹10 Cr+',
      leadStatus: 'Interested',
      tags: ['Farmhouse Interested']
    });

  // Dynamic Segment with AND conjunction: City = Gurugram AND Property Type = Apartments
  const dynamicRules = {
    conjunction: 'AND',
    conditions: [
      { field: 'city', operator: 'equals', value: 'Gurugram' },
      { field: 'interestedPropertyType', operator: 'equals', value: 'Apartments' }
    ]
  };

  // Preview matching contacts
  const previewRes = await request(app)
    .post('/api/segments/preview')
    .set(auth(ownerToken))
    .send({ filters: dynamicRules });

  assert.equal(previewRes.status, 200);
  assert.equal(previewRes.body.total, 1);
  assert.equal(previewRes.body.records[0].fullName, 'Vikram Malhotra');

  // Preview with OR conjunction: City = Gurugram OR City = Delhi
  const orRules = {
    conjunction: 'OR',
    conditions: [
      { field: 'city', operator: 'equals', value: 'Gurugram' },
      { field: 'city', operator: 'equals', value: 'Delhi' }
    ]
  };

  const orPreviewRes = await request(app)
    .post('/api/segments/preview')
    .set(auth(ownerToken))
    .send({ filters: orRules });

  assert.equal(orPreviewRes.status, 200);
  assert.equal(orPreviewRes.body.total, 2);

  // Save the segment
  const createSegRes = await request(app)
    .post('/api/segments')
    .set(auth(ownerToken))
    .send({
      name: 'Gurugram Apartments Segment',
      description: 'Active buyers in Gurugram seeking apartments',
      segmentType: 'dynamic',
      filterDefinition: dynamicRules
    });

  assert.equal(createSegRes.status, 201);
  assert.equal(createSegRes.body.segment.name, 'Gurugram Apartments Segment');
  assert.equal(createSegRes.body.totalMatchingContacts, 1);

  // Reject invalid / unallowlisted operators or fields
  const maliciousRule = {
    conjunction: 'AND',
    conditions: [
      { field: '$where', operator: 'equals', value: 'this.passwordHash' }
    ]
  };

  const rejectRes = await request(app)
    .post('/api/segments/preview')
    .set(auth(ownerToken))
    .send({ filters: maliciousRule });

  assert.equal(rejectRes.status, 400);
  assert.ok(rejectRes.body.message.includes('Unsupported condition field'));
});

test('Prompt 3 - 6. WhatsApp Consent Audit, Suppression & Zero-Policy Enforcement', async () => {
  const contact = await Contact.findOne({ ownerId: owner._id, fullName: 'Vikram Malhotra' });

  // 1. Check initial stats: eligibleWhatsAppContacts must be 0 (Unknown consent does not allow broadcast)
  const initialStats = await request(app).get('/api/contacts/stats').set(auth(ownerToken));
  assert.equal(initialStats.body.stats.eligibleWhatsAppContacts, 0);

  // 2. Reject fake opt-in without required evidence fields
  const fakeOptIn = await request(app)
    .post(`/api/contacts/${contact._id}/consent`)
    .set(auth(ownerToken))
    .send({
      status: 'Opted In',
      consentSource: '',
      consentPurpose: '',
      evidenceReference: ''
    });
  assert.equal(fakeOptIn.status, 400);

  // 3. Genuine affirmative opt-in with valid evidence
  const validOptIn = await request(app)
    .post(`/api/contacts/${contact._id}/consent`)
    .set(auth(ownerToken))
    .send({
      status: 'Opted In',
      consentSource: 'Signed Site Visit Booking Slip',
      consentPurpose: 'Project brochures and site visit updates for DLF Privana',
      consentCapturedAt: new Date().toISOString(),
      evidenceReference: 'SV-SLIP-9402'
    });

  assert.equal(validOptIn.status, 201);
  assert.equal(validOptIn.body.contact.whatsappConsentStatus, 'Opted In');

  // Stats should now report 1 verified opted-in contact
  const optedInStats = await request(app).get('/api/contacts/stats').set(auth(ownerToken));
  assert.equal(optedInStats.body.stats.eligibleWhatsAppContacts, 1);

  // 4. Do Not Contact (Suppression)
  const suppressRes = await request(app)
    .patch(`/api/contacts/${contact._id}`)
    .set(auth(ownerToken))
    .send({
      isSuppressed: true,
      suppressionReason: 'Client requested stop messages during site visit'
    });

  assert.equal(suppressRes.status, 200);
  assert.equal(suppressRes.body.contact.isSuppressed, true);

  // Stats: Suppressed contact MUST NOT be eligible for marketing broadcasts!
  const suppressedStats = await request(app).get('/api/contacts/stats').set(auth(ownerToken));
  assert.equal(suppressedStats.body.stats.eligibleWhatsAppContacts, 0);
  assert.equal(suppressedStats.body.stats.suppressedContacts, 1);

  // Check eligibility endpoint returns honest failure
  const eligRes = await request(app).get(`/api/contacts/${contact._id}/eligibility`).set(auth(ownerToken));
  assert.equal(eligRes.status, 200);
  assert.equal(eligRes.body.eligibility.eligible, false);
  assert.ok(eligRes.body.eligibility.reasons.some(r => r.includes('Contact is suppressed')));
});

test('Prompt 3 - 7. Safe CSV Export Neutralizes Spreadsheet Formula Injection', async () => {
  // Create contact with formula injection attempt
  await request(app)
    .post('/api/contacts')
    .set(auth(ownerToken))
    .send({
      fullName: '=CMD|"/C calc"!A0',
      phoneNumber: '+919911002233',
      city: '+1+1',
      interestedPropertyType: '@SUM(1,1)',
      notes: '-2+3'
    });

  const exportRes = await request(app)
    .get('/api/contacts/export?format=csv')
    .set(auth(ownerToken));

  assert.equal(exportRes.status, 200);
  const csvContent = exportRes.text;

  // Values starting with =, +, -, @ must be prefixed with single quote ' to neutralize formulas
  assert.ok(csvContent.includes("'=CMD"));
  assert.ok(csvContent.includes("'+1+1"));
  assert.ok(csvContent.includes("'@SUM"));
  assert.ok(csvContent.includes("'-2+3"));
});

test('Prompt 3 - 8. Bulk Operations (Add/Remove Tags, Group, Suppression)', async () => {
  const contacts = await Contact.find({ ownerId: owner._id }).limit(2);
  const ids = contacts.map(c => c._id.toString());

  // Bulk add tags
  const bulkTags = await request(app)
    .patch('/api/contacts/bulk')
    .set(auth(ownerToken))
    .send({
      ids,
      action: 'addTags',
      value: ['VIP Investor']
    });

  assert.equal(bulkTags.status, 200);
  assert.equal(bulkTags.body.updatedCount, 2);

  const c1 = await Contact.findById(ids[0]);
  assert.ok(c1.tags.includes('vip investor'));

  // Bulk remove tag
  const bulkRemoveTag = await request(app)
    .patch('/api/contacts/bulk')
    .set(auth(ownerToken))
    .send({
      ids,
      action: 'removeTags',
      value: ['VIP Investor']
    });

  assert.equal(bulkRemoveTag.status, 200);
  const c1After = await Contact.findById(ids[0]);
  assert.ok(!c1After.tags.includes('vip investor'));
});
