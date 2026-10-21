import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Contact from '../src/models/Contact.js';
import MessageTemplate, { TemplateVersion } from '../src/models/MessageTemplate.js';
import Campaign from '../src/models/Campaign.js';

process.env.JWT_SECRET='test-secret-value-that-is-long-enough-for-template-tests';
let mongo,owner,other,ownerToken,otherToken,contact;
const auth=token=>({Authorization:`Bearer ${token}`});

before(async()=>{mongo=await MongoMemoryServer.create();await mongoose.connect(mongo.getUri());owner=await User.create({name:'Template Owner',email:'template-owner@test.example',passwordHash:'test'});other=await User.create({name:'Other Owner',email:'template-other@test.example',passwordHash:'test'});ownerToken=jwt.sign({sub:String(owner._id)},process.env.JWT_SECRET,{expiresIn:'1h'});otherToken=jwt.sign({sub:String(other._id)},process.env.JWT_SECRET,{expiresIn:'1h'});contact=await Contact.create({ownerId:owner._id,fullName:'Mira Patel',phoneNumber:'+919876543210',companyName:'Northstar',businessCategory:'Gym & Fitness',interestedService:'Website Development',industry:'Design',customFields:{'Referral Code':'R-7'}});});
after(async()=>{await mongoose.disconnect();await mongo?.stop();});

test('template CRUD, versions, duplication, archive and safe draft deletion',async()=>{
  const unauth=await request(app).get('/api/templates');assert.equal(unauth.status,401);
  const created=await request(app).post('/api/templates').set(auth(ownerToken)).send({name:'Website hello',category:'Marketing',body:'Hello {{first_name}} at {{company}}'});assert.equal(created.status,201,created.body.message);const id=created.body.template._id;assert.equal(created.body.template.providerStatus,'Not Submitted');assert.equal(created.body.template.currentVersionNumber,1);
  const changed=await request(app).patch(`/api/templates/${id}`).set(auth(ownerToken)).send({body:'Hello {{first_name}} from {{service}}',revisionNotes:'Clarified offer'});assert.equal(changed.status,200);assert.equal(changed.body.template.currentVersionNumber,2);
  const versions=await request(app).get(`/api/templates/${id}/versions`).set(auth(ownerToken));assert.equal(versions.body.records.length,2);
  const historicalPreview=await request(app).post(`/api/templates/${id}/versions/${versions.body.records.at(-1)._id}/preview`).set(auth(ownerToken)).send({contactId:contact._id});assert.equal(historicalPreview.status,200);assert.equal(historicalPreview.body.versionNumber,1);assert.equal(historicalPreview.body.planningOnly,true);
  const restored=await request(app).post(`/api/templates/${id}/restore-version`).set(auth(ownerToken)).send({versionId:versions.body.records.at(-1)._id});assert.equal(restored.status,200);assert.equal(restored.body.template.body,'Hello {{first_name}} at {{company}}');assert.equal(restored.body.template.currentVersionNumber,3);
  const duplicate=await request(app).post(`/api/templates/${id}/duplicate`).set(auth(ownerToken));assert.equal(duplicate.status,201);assert.equal(duplicate.body.template.providerStatus,'Not Submitted');
  const archived=await request(app).patch(`/api/templates/${duplicate.body.template._id}`).set(auth(ownerToken)).send({localStatus:'Archived'});assert.equal(archived.body.template.isArchived,true);
  const blocked=await request(app).delete(`/api/templates/${duplicate.body.template._id}`).set(auth(ownerToken));assert.equal(blocked.status,409);
  const protectedDraft=await request(app).post('/api/templates').set(auth(ownerToken)).send({name:'Campaign reference',body:'A draft'});await Campaign.create({ownerId:owner._id,createdBy:owner._id,name:'Pinned template campaign',selectedTemplateId:protectedDraft.body.template._id,selectedTemplateVersionId:protectedDraft.body.template.currentVersionId});const usage=await request(app).get(`/api/templates/${protectedDraft.body.template._id}`).set(auth(ownerToken));assert.equal(usage.body.campaignUsage.length,1);const protectedDelete=await request(app).delete(`/api/templates/${protectedDraft.body.template._id}`).set(auth(ownerToken));assert.equal(protectedDelete.status,409);
  const temp=await request(app).post('/api/templates').set(auth(ownerToken)).send({name:'Throwaway draft',body:'unfinished'});const deleted=await request(app).delete(`/api/templates/${temp.body.template._id}`).set(auth(ownerToken));assert.equal(deleted.status,200);
  const isolated=await request(app).get(`/api/templates/${id}`).set(auth(otherToken));assert.equal(isolated.status,404);
  const list=await request(app).get('/api/templates?search=website&category=Marketing').set(auth(ownerToken));assert.ok(list.body.records.some(t=>t._id===id));
});

test('real owner-scoped preview, imported custom fields, Meta mapping and bounded bulk preview',async()=>{
  const template=await MessageTemplate.create({ownerId:owner._id,name:'Contact intro',category:'Marketing',language:'en',header:'Hi {{first_name}}',body:'Hello {{first_name}}, {{company}} needs {{custom:Referral Code}}. {{service}}',metaTemplateName:'contact_intro',metaLanguage:'en',sampleValues:{first_name:'Mira',company:'Northstar','custom:Referral Code':'R-7',service:'Website Development'}});
  const preview=await request(app).post(`/api/templates/${template._id}/preview`).set(auth(ownerToken)).send({contactId:contact._id});assert.equal(preview.status,200);assert.equal(preview.body.preview.body,'Hello Mira, Northstar needs R-7. Website Development');assert.equal(preview.body.preview.valid,true);assert.deepEqual(preview.body.meta.mappings.header,[{variable:'first_name',parameter:1}]);assert.match(preview.body.meta.structure.components[0].text,/\{\{1\}\}/);
  const hidden=await request(app).post(`/api/templates/${template._id}/preview`).set(auth(otherToken)).send({contactId:contact._id});assert.equal(hidden.status,404);
  const bulk=await request(app).post(`/api/templates/${template._id}/bulk-preview`).set(auth(ownerToken)).send({ids:[contact._id],limit:100});assert.equal(bulk.status,200);assert.equal(bulk.body.records.length,1);assert.equal(bulk.body.planningOnly,true);
  const tooMany=await request(app).post(`/api/templates/${template._id}/bulk-preview`).set(auth(ownerToken)).send({ids:Array(101).fill(String(contact._id))});assert.equal(tooMany.status,400);
  const ready=await request(app).post(`/api/templates/${template._id}/validate`).set(auth(ownerToken));assert.equal(ready.status,200);assert.equal(ready.body.submission.ready,true);
});

test('malformed variables, missing values and AI-disabled behavior are reported honestly',async()=>{
  const t=await MessageTemplate.create({ownerId:owner._id,name:'Incomplete values',body:'Hello {{unknown}} and {{company'});
  const validation=await request(app).post(`/api/templates/${t._id}/validate`).set(auth(ownerToken));assert.equal(validation.status,200);assert.equal(validation.body.validation.valid,false);assert.ok(validation.body.validation.errors.some(x=>x.includes('malformed')));
  const contactNoCustom=await Contact.create({ownerId:owner._id,fullName:'Sam Lee',phoneNumber:'+14155550100'});
  const preview=await request(app).post(`/api/templates/${t._id}/preview`).set(auth(ownerToken)).send({contactId:contactNoCustom._id});assert.equal(preview.body.preview.valid,false);assert.ok(preview.body.preview.missingVariables.includes('unknown'));
  const versionsBefore=await TemplateVersion.countDocuments({ownerId:owner._id}),templatesBefore=await MessageTemplate.countDocuments({ownerId:owner._id});
  delete process.env.AI_API_KEY;delete process.env.AI_BASE_URL;delete process.env.AI_MODEL;
  const status=await request(app).get('/api/templates/ai/status').set(auth(ownerToken));assert.equal(status.body.configured,false);
  const ai=await request(app).post('/api/templates/ai/generate').set(auth(ownerToken)).send({service:'web design'});assert.equal(ai.status,503);assert.match(ai.body.message,/AI Not Configured/);
  assert.equal(await MessageTemplate.countDocuments({ownerId:owner._id}),templatesBefore); // No preview or AI endpoint sends or creates messages.
  assert.equal(await TemplateVersion.countDocuments({ownerId:owner._id}),versionsBefore);
});

test('namespaced CRM variables, fallbacks, business category and button parameters preview without sending',async()=>{
 const t=await request(app).post('/api/templates').set(auth(ownerToken)).send({name:'Localized service draft',businessCategory:'Gym & Fitness',intendedService:'Website Development',body:'Hi {{last_name}}, {{company}} in {{business_category}} at {{city}}. I can help with {{service}} and {{custom.Referral Code}}.',fallbackValues:{city:'Mumbai'},buttons:[{type:'URL',text:'View details',value:'https://example.test/{{first_name}}'}],sampleValues:{first_name:'Mira'}});assert.equal(t.status,201,t.body.message);const id=t.body.template._id;assert.equal(t.body.template.fallbackValues.city,'Mumbai');
 const preview=await request(app).post(`/api/templates/${id}/preview`).set(auth(ownerToken)).send({contactId:contact._id});assert.equal(preview.status,200);assert.match(preview.body.preview.body,/Patel, Northstar in Gym & Fitness at Mumbai/);assert.deepEqual(preview.body.preview.fallbackVariables,['city']);assert.equal(preview.body.preview.buttons[0].value,'https://example.test/Mira');assert.equal(preview.body.preview.valid,true);
 assert.deepEqual(preview.body.meta.mappings.buttons,[{buttonIndex:0,variable:'first_name',parameter:1}]);assert.equal(preview.body.meta.structure.components.at(-1).buttons[0].url,'https://example.test/{{1}}');const before=contact.totalMessagesSent||0;await Contact.create({ownerId:owner._id,fullName:'Ravi Kumar',phoneNumber:'+919876543211',businessCategory:'Gym & Fitness'});const page1=await request(app).post(`/api/templates/${id}/bulk-preview`).set(auth(ownerToken)).send({page:1,limit:1,filters:{businessCategory:'Gym & Fitness'}});const page2=await request(app).post(`/api/templates/${id}/bulk-preview`).set(auth(ownerToken)).send({page:2,limit:1,filters:{businessCategory:'Gym & Fitness'}});assert.equal(page1.body.total,2);assert.equal(page2.body.page,2);assert.equal(page1.body.records.length,1);assert.equal(page2.body.records.length,1);const unchanged=await Contact.findById(contact._id);assert.equal(unchanged.totalMessagesSent||0,before);
});
