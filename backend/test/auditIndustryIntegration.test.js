import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import User from '../src/models/User.js';
import Workspace from '../src/models/Workspace.js';
import WorkspaceMembership from '../src/models/WorkspaceMembership.js';
import Contact from '../src/models/Contact.js';
import { getPublicIndustrySummaries, getStrictIndustryConfig } from '../src/config/industries/industryRegistry.js';
import { resolveStarterPack } from '../src/services/industryStarterProvisioningService.js';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'audit-industry-isolated-tests-secret-over-32-characters';
process.env.EMAIL_PROVIDER = 'inmemory';
const { default: app } = await import('../src/app.js');

test('authoritative industry API: all 13 packs, variables, dynamic fields and same-owner isolation', async () => {
  const mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  try {
    const owner = await User.create({ name: 'Audit Operator', email: 'audit@isolated.test', passwordHash: 'test-only-hash', isEmailVerified: true });
    const token = jwt.sign({ sub: String(owner._id) }, process.env.JWT_SECRET);
    const summaries = await request(app).get('/api/industries').expect(200);
    assert.equal(summaries.body.industries.length, 13);
    assert.equal(new Set(summaries.body.industries.map(i => i.key)).size, 13);
    await request(app).get('/api/industries/workspace/current').expect(401);
    await request(app).get('/api/industries/unknown').expect(404);
    let previous;
    for (const [i, summary] of getPublicIndustrySummaries().entries()) {
      const key = summary.key;
      const workspace = await Workspace.create({ name: `Audit ${key}`, slug: `audit-${key}`, industryKey: key, businessEmail: 'workspace@isolated.test', businessPhone: '+14155550100', createdBy: owner._id, status: 'ACTIVE' });
      await WorkspaceMembership.create({ workspaceId: workspace._id, userId: owner._id, role: 'OWNER', status: 'ACTIVE' });
      const headers = { Authorization: `Bearer ${token}`, 'x-workspace-id': String(workspace._id) };
      const config = (await request(app).get('/api/industries/workspace/current?industryKey=real_estate').set(headers).expect(200)).body;
      assert.equal(config.industryKey, key);
      assert.equal(config.workspaceId, String(workspace._id));
      assert.equal(config.compatibilityFallback, false);
      assert.deepEqual(config.ui, getStrictIndustryConfig(key).ui);
      const pack = resolveStarterPack(key);
      assert.deepEqual([pack.templates.length, pack.quickReplies.length, pack.rules.length, pack.campaigns.length], [15, 8, 5, 2]);
      assert.equal(config.quickReplyPresets.length, 8);
      assert.equal(config.sampleCampaignDrafts.length, 2);
      const variables = (await request(app).get('/api/templates/variables').set(headers).expect(200)).body.categories;
      assert.ok(variables.some(g => g.id === key));
      for (const variable of config.supportedVariables) assert.ok(variables.flatMap(g => g.variables).some(v => v.key === variable.token));
      if (key === 'real_estate') for (const token of ['project', 'budget', 'property_type', 'preferred_location']) assert.ok(variables.flatMap(g => g.variables).some(v => v.key === token));
      const interest = config.contactFields.find(f => f.key === config.ui.contactBindings.interest);
      const value = interest.type === 'select' ? (typeof interest.options[0] === 'object' ? interest.options[0].value : interest.options[0]) : 'Isolated QA interest';
      const created = (await request(app).post('/api/contacts').set(headers).send({ fullName: 'Audit Contact', phoneNumber: `+14155550${String(i).padStart(3, '0')}`, industryData: { [interest.key]: value } }).expect(201)).body.contact;
      assert.equal(created.industryData[interest.key], value);
      const read = (await request(app).get(`/api/contacts/${created._id}`).set(headers).expect(200)).body.contact;
      assert.equal(read.industryData[interest.key], value);
      const filtered = await request(app).get('/api/contacts').query({ interestedPropertyType: value }).set(headers).expect(200);
      assert.equal(filtered.body.total, 1);
      await request(app).patch(`/api/contacts/${created._id}`).set(headers).send({ fullName: 'Audit Contact Edited' }).expect(200);
      assert.equal((await Contact.findById(created._id).lean()).industryData[interest.key], value);
      if (previous) {
        await request(app).get(`/api/contacts/${previous.contact}`).set(headers).expect(404);
        await request(app).patch(`/api/contacts/${previous.contact}`).set(headers).send({ fullName: 'Forbidden Edit' }).expect(404);
        await request(app).get(`/api/messages/${previous.message}`).set(headers).expect(404);
        await request(app).post(`/api/messages/${previous.message}/cancel`).set(headers).send({}).expect(404);
        await request(app).post('/api/messages/prepare').set(headers).send({ contactId: previous.contact }).expect(404);
        await request(app).get(`/api/contact-groups/${previous.group}`).set(headers).expect(404);
        await request(app).delete(`/api/contact-groups/${previous.group}`).set(headers).expect(404);
        await request(app).patch(`/api/contacts/${created._id}`).set(headers).send({ groups: [previous.group] }).expect(400);
        await request(app).get(`/api/segments/${previous.segment}`).set(headers).expect(404);
        await request(app).post('/api/segments/preview').set(headers).send({ segmentId: previous.segment }).expect(404);
      }
      const group = (await request(app).post('/api/contact-groups').set(headers).send({ name: `Audit group ${i}`, contactIds: [created._id] }).expect(201)).body.group;
      assert.equal(group.workspaceId, String(workspace._id));
      assert.equal((await request(app).get('/api/contact-groups').set(headers).expect(200)).body.records.length, 1);
      const segment = (await request(app).post('/api/segments').set(headers).send({ name: `Audit segment ${i}`, segmentType: 'dynamic', filterDefinition: {} }).expect(201)).body.segment;
      assert.equal(segment.workspaceId, String(workspace._id));
      assert.equal((await request(app).post('/api/segments/preview').set(headers).send({ segmentId: segment._id }).expect(200)).body.total, 1);
      const message = (await request(app).post('/api/messages/prepare').set(headers).send({ contactId: created._id, idempotencyKey: 'same-key-different-workspaces' }).expect(201)).body.message;
      assert.equal(message.workspaceId, String(workspace._id));
      assert.equal((await request(app).get('/api/messages').set(headers).expect(200)).body.total, 1);
      assert.equal((await request(app).get('/api/messages/stats').set(headers).expect(200)).body.stats.total, 1);
      previous = { contact: created._id, message: message._id, group: group._id, segment: segment._id, headers };
    }
    const foreign = new mongoose.Types.ObjectId();
    await request(app).get('/api/industries/workspace/current').set({ Authorization: `Bearer ${token}`, 'x-workspace-id': String(foreign) }).expect(403);
    await Workspace.updateMany({ createdBy: owner._id }, { $set: { status: 'SUSPENDED' } });
    await request(app).get('/api/contacts').set({ Authorization: `Bearer ${token}` }).expect(403);
  } finally {
    await mongoose.disconnect();
    await mongo.stop();
  }
});

test('saved industry variables render without invented business details or another workspace identity', async () => {
  const { resolveTemplate, validateTemplate, valuesFor } = await import('../src/utils/templateEngine.js');
  const { interpolateVariables } = await import('../src/services/autoReplyRuleService.js');
  const { workspaceBusinessContext } = await import('../src/utils/workspaceBusinessContext.js');
  for (const { key } of getPublicIndustrySummaries()) {
    const config = getStrictIndustryConfig(key);
    for (const { token } of config.supportedVariables) {
      assert.equal(validateTemplate({ body: `Hello {{${token}}}` }).valid, true, `${key}: ${token}`);
    }
  }
  const contact = { _id: 'qa', fullName: 'QA Customer', industryData: { visitDate: '2030-01-01', technicianName: 'QA Technician', guestCount: 0, membershipPlan: 'Monthly', serviceName: 'Repair' } };
  assert.equal(valuesFor(contact).guest_count, 0);
  assert.equal(interpolateVariables('{{technician_name}} {{visit_date}} {{guest_count}}', contact), 'QA Technician 2030-01-01 0');
  assert.equal(resolveTemplate({ body: '{{membership_type}} / {{service_name}}' }, contact).body, 'Monthly / Repair');
  const missing = resolveTemplate({ body: '{{business_hours}} {{business_address}} {{consultation_mode}}' }, contact);
  assert.equal(missing.valid, false);
  assert.deepEqual(missing.missingVariables, ['business_hours', 'business_address', 'consultation_mode']);
  const business = workspaceBusinessContext({ name: 'Operator', businessName: 'Other workspace', website: 'https://other.example' }, { name: 'Authorized workspace' });
  assert.equal(resolveTemplate({ body: '{{business_name}}' }, contact, business).body, 'Authorized workspace');
  assert.equal(business.website, '');
});
