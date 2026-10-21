import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Contact from '../src/models/Contact.js';
import Campaign from '../src/models/Campaign.js';
import MessageTemplate, { TemplateVersion } from '../src/models/MessageTemplate.js';
import TemplateMedia from '../src/models/TemplateMedia.js';

process.env.JWT_SECRET = 'test-secret-value-that-is-long-enough-for-template-tests';
let mongo, owner, otherOwner, ownerToken, otherToken, sampleContact;
const auth = (token) => ({ Authorization: `Bearer ${token}` });

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([
    User.init(),
    Contact.init(),
    Campaign.init(),
    MessageTemplate.init(),
    TemplateVersion.init(),
    TemplateMedia.init()
  ]);

  owner = await User.create({
    name: 'M2W Realty Desk',
    email: 'admin@m2wrealty.test',
    passwordHash: 'mock-secret-hash',
    businessName: 'M2W Realty',
    phoneNumber: '+919811122233'
  });

  otherOwner = await User.create({
    name: 'Other Operator',
    email: 'other@rivalrealty.test',
    passwordHash: 'mock-secret-hash',
    businessName: 'Rival Estates'
  });

  ownerToken = jwt.sign({ sub: owner._id.toString() }, process.env.JWT_SECRET, { expiresIn: '1h' });
  otherToken = jwt.sign({ sub: otherOwner._id.toString() }, process.env.JWT_SECRET, { expiresIn: '1h' });

  sampleContact = await Contact.create({
    ownerId: owner._id,
    fullName: 'Vikram Malhotra',
    phoneNumber: '+919876543210',
    email: 'vikram@example.com',
    city: 'Gurugram',
    location: 'Gurugram',
    companyName: 'Malhotra Enterprises',
    interestedPropertyType: 'Luxury 4BHK Apartment',
    interestedProject: 'M2W Sky Villas',
    preferredLocation: 'Golf Course Extension',
    budgetRange: '₹3.5 Cr - ₹4.5 Cr'
  });
});

after(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

test('Prompt 4 - 1. Template Variables & Categories Registries', async () => {
  const varsRes = await request(app).get('/api/templates/variables').set(auth(ownerToken));
  assert.equal(varsRes.status, 200);
  assert.ok(Array.isArray(varsRes.body.categories));
  const catIds = varsRes.body.categories.map(c => c.id);
  assert.ok(catIds.includes('contact'));
  assert.ok(catIds.includes('real_estate'));
  assert.ok(catIds.includes('business'));

  // Verify real estate variables
  const reCategory = varsRes.body.categories.find(c => c.id === 'real_estate');
  const tokens = reCategory.variables.map(v => v.token);
  assert.ok(tokens.includes('{{property_type}}'));
  assert.ok(tokens.includes('{{project}}'));
  assert.ok(tokens.includes('{{preferred_location}}'));
  assert.ok(tokens.includes('{{budget}}'));

  // Verify WhatsApp categories registry
  const catsRes = await request(app).get('/api/templates/categories').set(auth(ownerToken));
  assert.equal(catsRes.status, 200);
  const ids = catsRes.body.categories.map(c => c.id);
  assert.ok(ids.includes('Marketing'));
  assert.ok(ids.includes('Utility'));
  assert.ok(ids.includes('Authentication'));
});

test('Prompt 4 - 2. Real Estate Presets Library', async () => {
  const libRes = await request(app).get('/api/templates/library').set(auth(ownerToken));
  assert.equal(libRes.status, 200);
  assert.ok(Array.isArray(libRes.body.records));
  const names = libRes.body.records.map(r => r.name);
  assert.ok(names.includes('property_launch_update'));
  assert.ok(names.includes('farmhouse_interest_followup'));
  assert.ok(names.includes('property_brochure_offer'));
  assert.ok(names.includes('site_visit_information'));
  assert.ok(names.includes('project_availability_update'));
  assert.ok(names.includes('customer_followup_courtesy'));
});

test('Prompt 4 - 3. Create Real Estate Template with Variables & Quick Replies', async () => {
  const payload = {
    name: 'property_launch_demo',
    category: 'Marketing',
    language: 'en',
    headerType: 'TEXT',
    header: 'New Property Information',
    body: 'Hi {{name}}, we have information about {{property_type}} options in {{city}}. Would you like to review the project details?',
    footer: 'Reply STOP to opt out',
    buttons: [
      { type: 'QUICK_REPLY', text: 'Yes, share details', value: 'YES_DETAILS' },
      { type: 'QUICK_REPLY', text: 'Not right now', value: 'NOT_NOW' }
    ]
  };

  const createRes = await request(app).post('/api/templates').set(auth(ownerToken)).send(payload);
  assert.equal(createRes.status, 201);
  const t = createRes.body.template;
  assert.equal(t.name, 'property_launch_demo');
  assert.equal(t.localStatus, 'Draft');
  assert.equal(t.providerStatus, 'Not Submitted');
  assert.equal(t.currentVersionNumber, 1);
  assert.ok(t.currentVersionId);

  // Validate contact preview resolves real estate fields
  const previewRes = await request(app).post(`/api/templates/${t._id}/preview`).set(auth(ownerToken)).send({ contactId: sampleContact._id });
  assert.equal(previewRes.status, 200);
  assert.equal(previewRes.body.preview.valid, true);
  assert.match(previewRes.body.preview.body, /Hi Vikram Malhotra/);
  assert.match(previewRes.body.preview.body, /Luxury 4BHK Apartment options in Gurugram/);

  // Missing variable detection on incomplete contact
  const incompleteContact = await Contact.create({
    ownerId: owner._id,
    fullName: 'Rohit Verma',
    phoneNumber: '+919810010010'
    // Missing location (city) and propertyType
  });
  const incompletePreview = await request(app).post(`/api/templates/${t._id}/preview`).set(auth(ownerToken)).send({ contactId: incompleteContact._id });
  assert.equal(incompletePreview.status, 200);
  assert.equal(incompletePreview.body.preview.valid, false);
  assert.ok(incompletePreview.body.preview.missingVariables.includes('property_type'));
  assert.ok(incompletePreview.body.preview.missingVariables.includes('city'));
});

test('Prompt 4 - 4. Media Upload & Attachment (PDF Brochure & Image Headers)', async () => {
  // Test PDF brochure upload
  const pdfBuffer = Buffer.from('%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
  const uploadPdfRes = await request(app)
    .post('/api/template-media')
    .set(auth(ownerToken))
    .attach('media', pdfBuffer, { filename: 'M2W_Sky_Villas_Brochure.pdf', contentType: 'application/pdf' });

  assert.equal(uploadPdfRes.status, 201);
  const pdfMedia = uploadPdfRes.body.media;
  assert.equal(pdfMedia.mediaType, 'DOCUMENT');
  assert.equal(pdfMedia.originalFileName, 'M2W_Sky_Villas_Brochure.pdf');
  assert.ok(pdfMedia.url);

  // Test Image upload (PNG magic bytes)
  const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]);
  const uploadPngRes = await request(app)
    .post('/api/template-media')
    .set(auth(ownerToken))
    .attach('media', pngBuffer, { filename: 'elevation_render.png', contentType: 'image/png' });

  assert.equal(uploadPngRes.status, 201);
  const imgMedia = uploadPngRes.body.media;
  assert.equal(imgMedia.mediaType, 'IMAGE');

  // Reject invalid executable or script file
  const exeBuffer = Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff');
  const uploadExeRes = await request(app)
    .post('/api/template-media')
    .set(auth(ownerToken))
    .attach('media', exeBuffer, { filename: 'malicious.exe', contentType: 'application/x-msdownload' });
  assert.ok([400, 415].includes(uploadExeRes.status));

  // Attach PDF brochure to template
  const brochureTemplateRes = await request(app).post('/api/templates').set(auth(ownerToken)).send({
    name: 'sky_villas_brochure_doc',
    category: 'Marketing',
    headerType: 'DOCUMENT',
    header: 'Brochure PDF',
    headerMediaId: pdfMedia._id,
    headerMediaUrl: pdfMedia.url,
    headerMediaName: pdfMedia.originalFileName,
    headerMediaSize: pdfMedia.sizeBytes,
    headerMediaMime: pdfMedia.mimeType,
    body: 'Hello {{name}}, here is the requested project brochure for {{project}}.',
    footer: 'M2W Realty Advisory'
  });
  assert.equal(brochureTemplateRes.status, 201);
  const bt = brochureTemplateRes.body.template;
  assert.equal(bt.headerType, 'DOCUMENT');
  assert.equal(bt.headerMediaName, 'M2W_Sky_Villas_Brochure.pdf');
  assert.equal(bt.headerMediaId, pdfMedia._id);
});

test('Prompt 4 - 5. Interactive Buttons Validation (URL CTA, Phone CTA, Mutual Exclusion)', async () => {
  // Valid URL and Phone Call CTAs
  const validCtaTemplate = await request(app).post('/api/templates').set(auth(ownerToken)).send({
    name: 'project_advisory_cta',
    category: 'Marketing',
    body: 'Hello {{name}}, exploring villas in {{city}}? Contact our lead architect directly.',
    buttons: [
      { type: 'URL', text: 'View Project', value: 'https://m2wrealty.com/villas' },
      { type: 'PHONE_NUMBER', text: 'Call Desk', value: '+919811122233' }
    ]
  });
  assert.equal(validCtaTemplate.status, 201);

  // Validate route reports ready
  const validateRes = await request(app).post(`/api/templates/${validCtaTemplate.body.template._id}/validate`).set(auth(ownerToken));
  assert.equal(validateRes.status, 200);
  assert.equal(validateRes.body.validation.valid, true);

  // Invalid: mixing Quick Replies and CTAs
  const mixedTemplate = await request(app).post('/api/templates').set(auth(ownerToken)).send({
    name: 'invalid_mixed_buttons',
    category: 'Marketing',
    body: 'Invalid button mix',
    buttons: [
      { type: 'QUICK_REPLY', text: 'Yes', value: 'YES' },
      { type: 'URL', text: 'Site', value: 'https://m2wrealty.com' }
    ]
  });
  const validateMixed = await request(app).post(`/api/templates/${mixedTemplate.body.template._id}/validate`).set(auth(ownerToken));
  assert.equal(validateMixed.body.validation.valid, false);
  assert.ok(validateMixed.body.validation.errors.some(e => e.includes('mixture')));

  // Invalid: non-HTTPS URL
  const httpTemplate = await request(app).post('/api/templates').set(auth(ownerToken)).send({
    name: 'invalid_http_url',
    category: 'Marketing',
    body: 'Invalid http',
    buttons: [{ type: 'URL', text: 'Insecure Link', value: 'http://insecure.test' }]
  });
  const validateHttp = await request(app).post(`/api/templates/${httpTemplate.body.template._id}/validate`).set(auth(ownerToken));
  assert.equal(validateHttp.body.validation.valid, false);
  assert.ok(validateHttp.body.validation.errors.some(e => e.includes('HTTPS')));
});

test('Prompt 4 - 6. Versioning, History & Version Restore', async () => {
  const initial = await request(app).post('/api/templates').set(auth(ownerToken)).send({
    name: 'versioned_site_visit',
    category: 'Utility',
    body: 'Initial draft v1: Hi {{name}}, visit scheduled for {{project}}.'
  });
  const tId = initial.body.template._id;
  assert.equal(initial.body.template.currentVersionNumber, 1);

  // Update template -> creates v2
  const updated = await request(app).patch(`/api/templates/${tId}`).set(auth(ownerToken)).send({
    body: 'Updated draft v2: Hello {{name}}, your site visit for {{project}} is confirmed.',
    revisionNotes: 'Polished courtesy tone'
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.template.currentVersionNumber, 2);

  // Check version history
  const historyRes = await request(app).get(`/api/templates/${tId}/history`).set(auth(ownerToken));
  assert.equal(historyRes.status, 200);
  assert.equal(historyRes.body.records.length, 2);
  assert.equal(historyRes.body.records[0].versionNumber, 2);
  assert.equal(historyRes.body.records[1].versionNumber, 1);
  assert.equal(historyRes.body.records[1].snapshot.body, 'Initial draft v1: Hi {{name}}, visit scheduled for {{project}}.');

  // Restore v1 as a new draft
  const v1Id = historyRes.body.records[1]._id;
  const restoreRes = await request(app).post(`/api/templates/${tId}/restore-version`).set(auth(ownerToken)).send({ versionId: v1Id });
  assert.equal(restoreRes.status, 200);
  assert.equal(restoreRes.body.template.currentVersionNumber, 3);
  assert.equal(restoreRes.body.template.body, 'Initial draft v1: Hi {{name}}, visit scheduled for {{project}}.');
});

test('Prompt 4 - 7. Campaign Snapshot Isolation (Template editing does NOT mutate pinned campaign)', async () => {
  // 1. Create template
  const templateRes = await request(app).post('/api/templates').set(auth(ownerToken)).send({
    name: 'campaign_isolated_template',
    category: 'Marketing',
    body: 'Original v1 message: Hi {{name}}, explore {{project}}.'
  });
  const tId = templateRes.body.template._id;
  const v1Id = templateRes.body.template.currentVersionId;

  // 2. Attach to campaign
  const campaign = await Campaign.create({
    ownerId: owner._id,
    createdBy: owner._id,
    name: 'Q4 Villa Campaign',
    selectedTemplateId: tId,
    selectedTemplateVersionId: v1Id,
    status: 'Draft'
  });

  // Verify campaign usage endpoint
  const usageRes = await request(app).get(`/api/templates/${tId}/campaigns`).set(auth(ownerToken));
  assert.equal(usageRes.status, 200);
  assert.equal(usageRes.body.records.length, 1);
  assert.equal(usageRes.body.records[0].name, 'Q4 Villa Campaign');

  // 3. Edit template to v2
  await request(app).patch(`/api/templates/${tId}`).set(auth(ownerToken)).send({
    body: 'Drastically modified v2 message: completely different text.'
  });

  // 4. Verify campaign remains pinned to v1 immutable snapshot
  const reloadedCampaign = await Campaign.findById(campaign._id);
  assert.equal(String(reloadedCampaign.selectedTemplateVersionId), String(v1Id));
  const v1Record = await TemplateVersion.findById(v1Id);
  assert.equal(v1Record.snapshot.body, 'Original v1 message: Hi {{name}}, explore {{project}}.');
});

test('Prompt 4 - 8. Duplicate, Archive & Restore Lifecycle', async () => {
  const orig = await request(app).post('/api/templates').set(auth(ownerToken)).send({
    name: 'base_template_for_duplication',
    category: 'Utility',
    body: 'Standard follow-up for {{name}} regarding {{property_type}}.'
  });
  const origId = orig.body.template._id;

  // Duplicate
  const dupRes = await request(app).post(`/api/templates/${origId}/duplicate`).set(auth(ownerToken));
  assert.equal(dupRes.status, 201);
  const dup = dupRes.body.template;
  assert.notEqual(String(dup._id), String(origId));
  assert.equal(dup.name, 'base_template_for_duplication (copy)');
  assert.equal(dup.localStatus, 'Draft');
  assert.equal(dup.providerStatus, 'Not Submitted');

  // Archive original
  const archiveRes = await request(app).post(`/api/templates/${origId}/archive`).set(auth(ownerToken));
  assert.equal(archiveRes.status, 200);
  assert.equal(archiveRes.body.template.localStatus, 'Archived');
  assert.equal(archiveRes.body.template.isArchived, true);

  // Active list should not include archived template
  const activeList = await request(app).get('/api/templates').set(auth(ownerToken));
  assert.ok(!activeList.body.records.some(r => r._id === origId));

  // Restore original
  const restoreRes = await request(app).post(`/api/templates/${origId}/restore`).set(auth(ownerToken));
  assert.equal(restoreRes.status, 200);
  assert.equal(restoreRes.body.template.localStatus, 'Draft');
  assert.equal(restoreRes.body.template.isArchived, false);
});

test('Prompt 4 - 9. Multi-Tenant Isolation & Ownership Enforcement', async () => {
  const ownerTemplate = await request(app).post('/api/templates').set(auth(ownerToken)).send({
    name: 'secret_m2w_template',
    body: 'Confidential luxury listings for {{name}}.'
  });
  const tId = ownerTemplate.body.template._id;

  // Other owner cannot read
  const getForbidden = await request(app).get(`/api/templates/${tId}`).set(auth(otherToken));
  assert.equal(getForbidden.status, 404);

  // Other owner cannot patch
  const patchForbidden = await request(app).patch(`/api/templates/${tId}`).set(auth(otherToken)).send({ body: 'Hacked' });
  assert.equal(patchForbidden.status, 404);

  // Other owner cannot duplicate
  const dupForbidden = await request(app).post(`/api/templates/${tId}/duplicate`).set(auth(otherToken));
  assert.equal(dupForbidden.status, 404);

  // Other owner cannot delete
  const delForbidden = await request(app).delete(`/api/templates/${tId}`).set(auth(otherToken));
  assert.equal(delForbidden.status, 404);
});
