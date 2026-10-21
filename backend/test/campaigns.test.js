import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Contact from '../src/models/Contact.js';
import ConsentRecord from '../src/models/ConsentRecord.js';
import Campaign from '../src/models/Campaign.js';
import CampaignAudience from '../src/models/CampaignAudience.js';
import AudienceSegment from '../src/models/AudienceSegment.js';
import MessageTemplate, { TemplateVersion } from '../src/models/MessageTemplate.js';
import CampaignExecution from '../src/models/CampaignExecution.js';
import CampaignMessageJob from '../src/models/CampaignMessageJob.js';
import {campaignWorkerTick} from '../src/services/campaignExecutionService.js';

process.env.JWT_SECRET='test-secret-value-that-is-long-enough-for-campaign-tests';
let mongo,owner,other,ownerToken,otherToken,contact,template,version;
const auth=token=>({Authorization:`Bearer ${token}`});

before(async()=>{
  mongo=await MongoMemoryServer.create();await mongoose.connect(mongo.getUri());
  owner=await User.create({name:'Campaign Owner',businessName:'Northstar Studio',email:'campaign-owner@test.example',passwordHash:'test'});
  other=await User.create({name:'Other Owner',email:'campaign-other@test.example',passwordHash:'test'});
  ownerToken=jwt.sign({sub:String(owner._id)},process.env.JWT_SECRET,{expiresIn:'1h'});otherToken=jwt.sign({sub:String(other._id)},process.env.JWT_SECRET,{expiresIn:'1h'});
  contact=await Contact.create({ownerId:owner._id,fullName:'Mira Patel',phoneNumber:'+919876543210',companyName:'Northstar',interestedService:'Website Development',industry:'Design',businessCategory:'Gym',businessSubcategory:'Fitness studio',location:'Delhi',whatsappConsentStatus:'Opted In'});
  template=await MessageTemplate.create({ownerId:owner._id,name:'Website introduction',category:'Marketing',language:'en',body:'Hi {{first_name}}, we help with {{service}} for {{company}}.'});
  version=await TemplateVersion.create({ownerId:owner._id,templateId:template._id,versionNumber:1,snapshot:{name:template.name,category:'Marketing',language:'en',body:template.body,header:'',footer:'',buttons:[],internalVariables:['first_name','service','company'],providerStatus:'Not Submitted'},internalVariables:['first_name','service','company'],createdBy:owner._id});
  template.currentVersionId=version._id;template.currentVersionNumber=1;await template.save();
});
after(async()=>{await mongoose.disconnect();await mongo?.stop();});

test('campaign planning, immutable template reference, consent validation, segments and tenant isolation',async()=>{
  assert.equal((await request(app).get('/api/campaigns')).status,401);
  const made=await request(app).post('/api/campaigns').set(auth(ownerToken)).send({name:'Delhi Gym Website Outreach',goal:'Website Development Promotion',service:'Website Development',category:'Gym',wizardStep:1});
  assert.equal(made.status,201,made.body.message);const id=made.body.campaign._id;
  assert.equal(made.body.campaign.status,'Draft');
  assert.equal((await request(app).get(`/api/campaigns/${id}`).set(auth(otherToken))).status,404);
  const unsafe=await request(app).patch(`/api/campaigns/${id}`).set(auth(ownerToken)).send({$where:'true'});assert.equal(unsafe.status,400);
  const pinned=await request(app).patch(`/api/campaigns/${id}`).set(auth(ownerToken)).send({selectedTemplateId:template._id,selectedTemplateVersionId:version._id,wizardStep:3});assert.equal(pinned.status,200);
  const denied=await request(app).patch(`/api/campaigns/${id}`).set(auth(otherToken)).send({name:'Hijacked campaign'});assert.equal(denied.status,404);

  const dynamic=await request(app).post('/api/audience-segments').set(auth(ownerToken)).send({name:'Delhi gyms',segmentType:'dynamic',filterDefinition:{businessCategory:'Gym',city:'Delhi',service:'Website Development'}});
  assert.equal(dynamic.status,201,dynamic.body.message);assert.equal(dynamic.body.totalMatchingContacts,1);
  const staticSegment=await request(app).post('/api/audience-segments').set(auth(ownerToken)).send({name:'Selected prospect',segmentType:'static',selectedContactIds:[contact._id]});
  assert.equal(staticSegment.status,201,staticSegment.body.message);assert.equal(staticSegment.body.totalMatchingContacts,1);
  const segPreview=await request(app).post('/api/audience-segments/preview').set(auth(ownerToken)).send({segmentId:dynamic.body.segment._id,limit:10});assert.equal(segPreview.body.total,1);
  const crossSegment=await request(app).get(`/api/audience-segments/${dynamic.body.segment._id}`).set(auth(otherToken));assert.equal(crossSegment.status,404);
  const injection=await request(app).post('/api/audience-segments/preview').set(auth(ownerToken)).send({filters:{ownerId:String(other._id)}});assert.equal(injection.status,400);

  const selected=await request(app).post(`/api/campaigns/${id}/audience`).set(auth(ownerToken)).send({mode:'filters',definition:{filters:{businessCategory:'Gym',city:'Delhi',service:'Website Development'}}});
  assert.equal(selected.status,200,selected.body.message);assert.equal(selected.body.audience.count,1);assert.equal(await CampaignAudience.countDocuments({campaignId:id}),1);
  const segmentSnapshot=await request(app).post(`/api/campaigns/${id}/audience`).set(auth(ownerToken)).send({mode:'segment',definition:{segmentId:dynamic.body.segment._id}});assert.equal(segmentSnapshot.body.audience.count,1);
  const editedSegment=await request(app).patch(`/api/audience-segments/${dynamic.body.segment._id}`).set(auth(ownerToken)).send({filterDefinition:{businessCategory:'Clinic',city:'Delhi'}});assert.equal(editedSegment.status,200);assert.equal(await CampaignAudience.countDocuments({campaignId:id,snapshotVersion:segmentSnapshot.body.audience.version}),1);
  const badManual=await request(app).post(`/api/campaigns/${id}/audience`).set(auth(ownerToken)).send({mode:'manual',definition:{contactIds:[new mongoose.Types.ObjectId()]}});assert.equal(badManual.status,404);

  const firstValidation=await request(app).post(`/api/campaigns/${id}/validate`).set(auth(ownerToken));assert.equal(firstValidation.status,200);assert.equal(firstValidation.body.validation.counts.missingConsent,1);assert.equal(firstValidation.body.validation.sendEligible,false);assert.equal(firstValidation.body.campaign.status,'Needs Review');
  const previews=await request(app).get(`/api/campaigns/${id}/previews?page=1&limit=10`).set(auth(ownerToken));assert.equal(previews.status,200);assert.equal(previews.body.records[0].preview.body,'Hi Mira, we help with Website Development for Northstar.');assert.equal(previews.body.planningOnly,true);
  await ConsentRecord.create({ownerId:owner._id,contactId:contact._id,status:'Opted In',consentPurpose:'Website Development outreach',consentedBusinessName:'Northstar Studio',consentSource:'Website form',evidenceReference:'form:consent-42',consentCapturedAt:new Date(),recordedBy:owner._id});
  const allowedValidation=await request(app).post(`/api/campaigns/${id}/validate`).set(auth(ownerToken));assert.equal(allowedValidation.body.validation.counts.missingConsent,0);assert.equal(allowedValidation.body.validation.counts.providerPending,1);assert.equal(allowedValidation.body.campaign.status,'Needs Review');assert.equal(allowedValidation.body.validation.sendEligible,false);

  const changed=await request(app).patch(`/api/templates/${template._id}`).set(auth(ownerToken)).send({body:'Hello {{first_name}} from {{company}}'});assert.equal(changed.status,200);assert.notEqual(String(changed.body.template.currentVersionId),String(version._id));
  const campaignRead=await request(app).get(`/api/campaigns/${id}`).set(auth(ownerToken));assert.equal(campaignRead.body.template.selectedVersion._id,String(version._id));
  const refreshed=await request(app).post(`/api/campaigns/${id}/validate`).set(auth(ownerToken));assert.equal(refreshed.body.validation.template.currentVersionChanged,true);assert.equal(refreshed.body.campaign.status,'Needs Review');

  const duplicated=await request(app).post(`/api/campaigns/${id}/duplicate`).set(auth(ownerToken));assert.equal(duplicated.status,201);assert.match(duplicated.body.campaign.name,/Copy of/);assert.equal(duplicated.body.campaign.status,'Draft');assert.notEqual(duplicated.body.campaign._id,id);
  const archived=await request(app).post(`/api/campaigns/${id}/archive`).set(auth(ownerToken));assert.equal(archived.body.campaign.status,'Archived');
  const stats=await request(app).get('/api/campaigns/stats').set(auth(ownerToken));assert.equal(stats.status,200);assert.ok(stats.body.stats.totalCampaigns>=2);assert.equal(stats.body.stats.archivedCampaigns,1);assert.ok(!('sentMessages' in stats.body.stats));
  const dashboard=await request(app).get('/api/dashboard/stats').set(auth(ownerToken));assert.equal(dashboard.status,200);assert.equal(dashboard.body.stats.totalCampaigns,2);
  const removed=await request(app).delete(`/api/audience-segments/${staticSegment.body.segment._id}`).set(auth(ownerToken));assert.equal(removed.body.deleted,true);
  assert.equal(await Campaign.countDocuments({_id:id}),1);
});

test('campaign draft deletion and unique audience membership are enforced',async()=>{
  await CampaignAudience.init();const c=await Campaign.create({ownerId:owner._id,createdBy:owner._id,name:'Delete this draft'});
  await CampaignAudience.create({ownerId:owner._id,campaignId:c._id,snapshotVersion:1,contactId:contact._id,selectionSource:'manual'});c.audienceSnapshotVersion=1;await c.save();
  await assert.rejects(()=>CampaignAudience.create({ownerId:owner._id,campaignId:c._id,snapshotVersion:1,contactId:contact._id,selectionSource:'manual'}));
  const deleted=await request(app).delete(`/api/campaigns/${c._id}`).set(auth(ownerToken));assert.equal(deleted.status,200);assert.equal(await CampaignAudience.countDocuments({campaignId:c._id}),0);
});

test('campaign mock execution is durable, owner scoped, controllable, and never reports a real send',async()=>{
 await ConsentRecord.deleteMany({ownerId:owner._id,contactId:contact._id});await Contact.updateOne({_id:contact._id,ownerId:owner._id},{$set:{whatsappConsentStatus:'Unknown'}});
 const c=await Campaign.create({ownerId:owner._id,createdBy:owner._id,name:'Mock rehearsal',goal:'Website Development',service:'Website Development',selectedTemplateId:template._id,selectedTemplateVersionId:version._id});
 const audience=await request(app).post(`/api/campaigns/${c._id}/audience`).set(auth(ownerToken)).send({mode:'manual',definition:{contactIds:[contact._id]}});assert.equal(audience.status,200,audience.body.message);
 const started=await request(app).post(`/api/campaigns/${c._id}/executions`).set(auth(ownerToken)).send({});assert.equal(started.status,201,started.body.message);const executionId=started.body.execution._id;assert.equal(started.body.mockOnly,true);assert.equal(await CampaignMessageJob.countDocuments({executionId}),1);
 assert.equal((await request(app).get(`/api/campaigns/executions/${executionId}`).set(auth(otherToken))).status,404);
 const paused=await request(app).post(`/api/campaigns/executions/${executionId}/pause`).set(auth(ownerToken));assert.equal(paused.status,200);await campaignWorkerTick();assert.equal((await CampaignExecution.findById(executionId)).status,'paused');
 const resumed=await request(app).post(`/api/campaigns/executions/${executionId}/resume`).set(auth(ownerToken));assert.equal(resumed.status,200);await campaignWorkerTick();
 const run=await CampaignExecution.findById(executionId).lean(),job=await CampaignMessageJob.findOne({executionId}).lean();assert.equal(run.status,'completed');assert.equal(job.status,'blocked');assert.match(job.error,/consent/i);
 const report=await request(app).get(`/api/campaigns/executions/${executionId}/export`).set(auth(ownerToken));assert.equal(report.status,200);assert.match(report.text,/simulated_success|blocked/i);assert.doesNotMatch(report.text,/Delivered|Read/);const xlsx=await request(app).get(`/api/campaigns/executions/${executionId}/export?format=xlsx`).set(auth(ownerToken));assert.equal(xlsx.status,200);assert.match(xlsx.headers['content-type'],/spreadsheetml/);
 const second=await request(app).post(`/api/campaigns/${c._id}/executions`).set(auth(ownerToken)).send({});assert.equal(second.status,201);const canceled=await request(app).post(`/api/campaigns/executions/${second.body.execution._id}/cancel`).set(auth(ownerToken));assert.equal(canceled.status,200);assert.equal((await CampaignExecution.findById(second.body.execution._id)).status,'cancelled');
 const scheduled=await request(app).post(`/api/campaigns/${c._id}/schedule`).set(auth(ownerToken)).send({startAt:new Date(Date.now()+86400000).toISOString(),timezone:'Asia/Kolkata'});assert.equal(scheduled.status,201,scheduled.body.message);assert.equal(scheduled.body.schedule.status,'scheduled');
 const stats=await request(app).get('/api/campaigns/stats').set(auth(ownerToken));assert.equal(stats.body.stats.scheduledMockCampaigns,1);assert.ok(await CampaignExecution.countDocuments({ownerId:owner._id})>=2);
});
