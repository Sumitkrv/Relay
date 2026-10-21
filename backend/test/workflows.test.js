import {after,before,test} from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import {MongoMemoryServer} from 'mongodb-memory-server';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Contact from '../src/models/Contact.js';
import AutomationWorkflow from '../src/models/AutomationWorkflow.js';
import WorkflowVersion from '../src/models/WorkflowVersion.js';
import WorkflowExecution from '../src/models/WorkflowExecution.js';
import WorkflowStepExecution from '../src/models/WorkflowStepExecution.js';
import {processExecutionStep} from '../src/services/workflowExecutionService.js';
import {validateWorkflowGraph} from '../src/services/workflowValidationService.js';
import {evaluateCondition} from '../src/services/workflowConditionService.js';
import {nextOccurrence,validTimezone} from '../src/services/workflowSchedulerService.js';

process.env.JWT_SECRET='test-secret-value-that-is-long-enough-for-workflow-tests';
let mongo,owner,other,token,otherToken,contact;
const auth=t=>({Authorization:`Bearer ${t}`});
const graph=()=>({nodes:[{id:'start',type:'manualTrigger',position:{x:0,y:0},label:'Manual Trigger',config:{}},{id:'status',type:'updateLeadStatus',position:{x:0,y:120},label:'Update Lead Status',config:{status:'Interested'}},{id:'end',type:'end',position:{x:0,y:240},label:'End Workflow',config:{}}],edges:[{id:'a',source:'start',target:'status'},{id:'b',source:'status',target:'end'}]});
async function drain(id){for(let i=0;i<10;i++){const e=await WorkflowExecution.findById(id);if(!e||e.status!=='queued')return e;await processExecutionStep(id,`test-worker-${i}`);}return WorkflowExecution.findById(id);}

before(async()=>{mongo=await MongoMemoryServer.create();await mongoose.connect(mongo.getUri());await WorkflowExecution.init();await WorkflowStepExecution.init();owner=await User.create({name:'Workflow Owner',email:'workflow-owner@test.example',passwordHash:'test'});other=await User.create({name:'Workflow Other',email:'workflow-other@test.example',passwordHash:'test'});token=jwt.sign({sub:String(owner._id)},process.env.JWT_SECRET,{expiresIn:'1h'});otherToken=jwt.sign({sub:String(other._id)},process.env.JWT_SECRET,{expiresIn:'1h'});contact=await Contact.create({ownerId:owner._id,fullName:'Test Prospect',phoneNumber:'+14155550123',leadStatus:'New'});});
after(async()=>{await mongoose.disconnect();await mongo?.stop();});

test('condition engine preserves UNKNOWN and validation rejects unsafe graphs',()=>{
  assert.equal(evaluateCondition({leadStatus:'Interested'},{field:'leadStatus',operator:'eq',value:'Interested'}).result,'TRUE');
  assert.equal(evaluateCondition({},{field:'leadStatus',operator:'eq',value:'New'}).result,'UNKNOWN');
  assert.equal(evaluateCondition(null,{kind:'hasReplied'},{}).result,'UNKNOWN');
  assert.equal(evaluateCondition(null,{kind:'hasReplied'},{syntheticReplyEvent:true}).result,'TRUE');
  const g=graph();assert.equal(validateWorkflowGraph(g.nodes,g.edges).valid,true);
  const cycle={...g,edges:[...g.edges,{id:'cycle',source:'end',target:'start'}]};assert.ok(validateWorkflowGraph(cycle.nodes,cycle.edges).errors.some(x=>/Cycles/.test(x)));
  const unsafe={...g,nodes:[...g.nodes,{id:'code',type:'javascript',position:{x:0,y:0},config:{code:'process.exit()'}}]};assert.ok(validateWorkflowGraph(unsafe.nodes,unsafe.edges).errors.some(x=>/Unsupported/.test(x)));
});

test('workflow graph lifecycle, dry-run isolation, version immutability, internal authorization and ownership',async()=>{
  assert.equal((await request(app).get('/api/workflows')).status,401);
  const created=await request(app).post('/api/workflows').set(auth(token)).send({name:'Interested lead handling',description:'Test status actions',...graph()});assert.equal(created.status,201,created.body.message);const id=created.body.workflow._id;const versionId=created.body.version._id;
  const hidden=await request(app).get(`/api/workflows/${id}`).set(auth(otherToken));assert.equal(hidden.status,404);
  const invalid=await request(app).patch(`/api/workflows/${id}`).set(auth(token)).send({nodes:[{id:'x',type:'manualTrigger',position:{x:0,y:0},config:{}},{id:'y',type:'manualTrigger',position:{x:0,y:100},config:{}}],edges:[]});assert.equal(invalid.status,200);
  const checked=await request(app).post(`/api/workflows/${id}/validate`).set(auth(token));assert.equal(checked.status,200);assert.equal(checked.body.validation.valid,false);
  const saved=await request(app).patch(`/api/workflows/${id}`).set(auth(token)).send(graph());assert.equal(saved.status,200);
  const valid=await request(app).post(`/api/workflows/${id}/validate`).set(auth(token));assert.equal(valid.body.validation.valid,true);
  const tested=await request(app).post(`/api/workflows/${id}/test`).set(auth(token)).send({contactId:contact._id});assert.equal(tested.status,202);assert.match(tested.body.notice,/TEST MODE/);const testRun=await drain(tested.body.execution._id);assert.equal(testRun.status,'completed');assert.equal((await Contact.findById(contact._id)).leadStatus,'New');assert.equal(await WorkflowStepExecution.countDocuments({executionId:testRun._id}),3);
  const deniedInternal=await request(app).post(`/api/workflows/${id}/executions`).set(auth(token)).send({executionMode:'internal',contactId:contact._id});assert.equal(deniedInternal.status,409);
  const published=await request(app).post(`/api/workflows/${id}/publish`).set(auth(token));assert.equal(published.status,200);assert.equal(published.body.version.isPublished,true);assert.equal(String(published.body.version._id),String(versionId));
  const activated=await request(app).post(`/api/workflows/${id}/activate`).set(auth(token));assert.equal(activated.status,200);assert.equal(activated.body.workflow.status,'Active');
  const internal=await request(app).post(`/api/workflows/${id}/executions`).set(auth(token)).send({executionMode:'internal',confirmInternalActions:true,contactId:contact._id,triggerEventId:'internal-test-unique'});assert.equal(internal.status,202);const actual=await drain(internal.body.execution._id);assert.equal(actual.status,'completed');assert.equal((await Contact.findById(contact._id)).leadStatus,'Interested');
  const duplicate=await request(app).post(`/api/workflows/${id}/executions`).set(auth(token)).send({executionMode:'internal',confirmInternalActions:true,contactId:contact._id,triggerEventId:'internal-test-unique'});assert.equal(duplicate.status,409);
  const oldVersion=await WorkflowVersion.findOne({_id:versionId});const changed=graph();changed.nodes[1].config.status='Negotiation';const edit=await request(app).patch(`/api/workflows/${id}`).set(auth(token)).send(changed);assert.equal(edit.status,200);assert.notEqual(String(edit.body.version._id),String(versionId));assert.equal(String((await WorkflowVersion.findById(versionId))._id),String(oldVersion._id));assert.equal(String((await AutomationWorkflow.findById(id)).activeVersionId),String(versionId));
  const runs=await request(app).get(`/api/workflows/${id}/executions`).set(auth(token));assert.equal(runs.body.total,2);
  const detail=await request(app).get(`/api/workflow-executions/${internal.body.execution._id}/steps`).set(auth(token));assert.equal(detail.status,200);assert.equal(detail.body.records.length,3);
  const noSend=await request(app).post(`/api/workflows/${id}/send`).set(auth(token));assert.equal(noSend.status,404);
});

test('scheduling validates IANA zones, calculates recurring local times and persists tenant scoped schedules',async()=>{
  assert.equal(validTimezone('Asia/Kolkata'),true);assert.equal(validTimezone('Not/AZone'),false);
  const next=nextOccurrence(new Date('2026-10-18T12:00:00Z'),{type:'daily',time:'09:00'},'Asia/Kolkata');assert.ok(next instanceof Date);assert.ok(next>new Date('2026-10-18T12:00:00Z'));
  const w=await AutomationWorkflow.create({ownerId:owner._id,createdBy:owner._id,name:'Schedule test',status:'Active'});const v=await WorkflowVersion.create({ownerId:owner._id,workflowId:w._id,versionNumber:1,nodes:graph().nodes,edges:graph().edges,isPublished:true,createdBy:owner._id});w.activeVersionId=v._id;await w.save();
  const bad=await request(app).post('/api/workflow-schedules').set(auth(token)).send({workflowId:w._id,startAt:new Date(Date.now()+3600000).toISOString(),timezone:'Mars/Olympus',recurrenceRule:{type:'daily',time:'09:00'}});assert.equal(bad.status,400);
  const good=await request(app).post('/api/workflow-schedules').set(auth(token)).send({workflowId:w._id,startAt:new Date(Date.now()+3600000).toISOString(),timezone:'Asia/Kolkata',recurrenceRule:{type:'daily',time:'09:00'},maxRuns:3});assert.equal(good.status,201,good.body.message);assert.equal(good.body.schedule.status,'active');
  const hidden=await request(app).get('/api/workflow-schedules').set(auth(otherToken));assert.equal(hidden.body.records.length,0);
  const paused=await request(app).patch(`/api/workflow-schedules/${good.body.schedule._id}`).set(auth(token)).send({action:'pause'});assert.equal(paused.body.schedule.status,'paused');
});
