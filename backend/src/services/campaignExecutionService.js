import crypto from 'node:crypto';
import Campaign from '../models/Campaign.js';
import CampaignAudience from '../models/CampaignAudience.js';
import CampaignExecution from '../models/CampaignExecution.js';
import CampaignMessageJob from '../models/CampaignMessageJob.js';
import Contact from '../models/Contact.js';
import ConsentRecord from '../models/ConsentRecord.js';
import MessageTemplate,{TemplateVersion} from '../models/MessageTemplate.js';
import User from '../models/User.js';
import {resolveTemplate} from '../utils/templateEngine.js';
import {validateCampaignAudience} from './eligibilityValidationService.js';
import {recordCampaignActivity} from './campaignActivityService.js';
import Message from '../models/Message.js';
import Conversation from '../models/Conversation.js';
import ConversationMessage from '../models/ConversationMessage.js';
import { recordMessageEvent } from './messageEventService.js';

const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const active=['queued','running','paused'];
export async function createCampaignExecution(campaignId,ownerId,actorId,{trigger='manual',scheduledFor=null,workspaceId=null}={}){
 const campaign=await Campaign.findOne({_id:campaignId,ownerId});if(!campaign)throw fail('Campaign not found.',404);if(campaign.status==='Archived')throw fail('Archived campaigns cannot run a simulation.',409);
 if(!campaign.audienceSnapshotVersion||!campaign.selectedTemplateId||!campaign.selectedTemplateVersionId)throw fail('Select an audience and a saved template version before starting a simulation.');
 const counts=await CampaignAudience.countDocuments({ownerId,campaignId,snapshotVersion:campaign.audienceSnapshotVersion});if(!counts)throw fail('The campaign audience is empty.',409);
 if(campaign.activeExecutionId){if(await CampaignExecution.exists({_id:campaign.activeExecutionId,status:{$in:active}}))throw fail('This campaign already has an active simulation.',409);await Campaign.updateOne({_id:campaign._id,ownerId,activeExecutionId:campaign.activeExecutionId},{$set:{activeExecutionId:null}});}
 const resolvedWorkspaceId = workspaceId || campaign.workspaceId || null;
 const user=await User.findById(ownerId).select('businessName').lean();const validation=await validateCampaignAudience(campaign,{_id:ownerId,businessName:user?.businessName||''});
 const version=await TemplateVersion.findOne({_id:campaign.selectedTemplateVersionId,templateId:campaign.selectedTemplateId,ownerId}).lean();
 const execution=await CampaignExecution.create({ownerId,campaignId,mode:'mock',trigger,audienceSnapshotVersion:campaign.audienceSnapshotVersion,templateId:campaign.selectedTemplateId,templateVersionId:campaign.selectedTemplateVersionId,totalJobs:counts,status:'queued',scheduledFor,summary:{validated:validation.counts.total,locallyEligible:validation.counts.eligible}});
 try{
   const cursor=CampaignAudience.find({ownerId,campaignId,snapshotVersion:campaign.audienceSnapshotVersion}).select('contactId').cursor();
   let ops=[];
   for await(const member of cursor){
     ops.push({updateOne:{filter:{ownerId,executionId:execution._id,contactId:member.contactId},update:{$setOnInsert:{ownerId,campaignId,executionId:execution._id,contactId:member.contactId,templateId:campaign.selectedTemplateId,templateVersionId:campaign.selectedTemplateVersionId,status:'queued'}},upsert:true}});
     if(ops.length>=500){await CampaignMessageJob.bulkWrite(ops,{ordered:false});ops=[];}
   }
   if(ops.length)await CampaignMessageJob.bulkWrite(ops,{ordered:false});
   const claimed=await Campaign.findOneAndUpdate(
     {_id:campaignId,ownerId,$or:[{activeExecutionId:null},{activeExecutionId:{$exists:false}}]},
     {$set:{activeExecutionId:execution._id,status:'Running',templateSnapshot:campaign.templateSnapshot||version?.snapshot||null}},
     {new:true}
   );
   if(!claimed)throw fail('Another simulation started for this campaign.',409);
 }catch(error){await CampaignMessageJob.deleteMany({executionId:execution._id,ownerId});await execution.deleteOne();throw error;}
 await recordCampaignActivity(campaign,actorId,trigger==='scheduled'?'simulation_scheduled':'simulation_started',trigger==='scheduled'?'Mock simulation scheduled occurrence created.':'Mock simulation queued.',{executionId:String(execution._id),mode:'MOCK'});return execution;
}
export async function processCampaignJob(jobId,workerId=`campaign-worker-${process.pid}`){const now=new Date();const job=await CampaignMessageJob.findOneAndUpdate({_id:jobId,$or:[{status:'queued'},{status:'processing',leaseUntil:{$lt:now}}]},{$set:{status:'processing',leaseOwner:workerId,leaseUntil:new Date(Date.now()+30000)},$inc:{attempts:1}},{new:true});if(!job)return false;
 const execution=await CampaignExecution.findOne({_id:job.executionId,ownerId:job.ownerId});if(!execution||!['queued','running'].includes(execution.status)){await CampaignMessageJob.updateOne({_id:job._id,leaseOwner:workerId},{$set:{status:execution?.status==='cancelled'?'cancelled':'queued',leaseOwner:'',leaseUntil:null}});return false;}
 if(execution.status==='queued'){execution.status='running';execution.startedAt=new Date();await execution.save();}
 const started=Date.now();let status='simulated_success',error='';const contact=await Contact.findOne({_id:job.contactId,ownerId:job.ownerId,isDeleted:false,isArchived:false}).lean();
 if(!contact) {status='blocked';error='Contact is deleted or archived.';}else if(!/^\+[1-9]\d{7,14}$/.test(contact.phoneNumber||'')){status='blocked';error='Invalid phone number.';}else {
   const [record,user,campaign,template,version]=await Promise.all([ConsentRecord.findOne({ownerId:job.ownerId,contactId:job.contactId}).sort({recordedAt:-1,_id:-1}).lean(),User.findById(job.ownerId).select('businessName').lean(),Campaign.findOne({_id:job.campaignId,ownerId:job.ownerId}).lean(),MessageTemplate.findOne({_id:job.templateId,ownerId:job.ownerId}).lean(),TemplateVersion.findOne({_id:job.templateVersionId,templateId:job.templateId,ownerId:job.ownerId}).lean()]);
   const isMockEligible = Boolean((contact.isDemo || contact.demoDatasetId) && (campaign?.executionMode === 'MOCK' || campaign?.executionMode === 'mock'));
   if(contact.whatsappConsentStatus==='Opted Out'||contact.isSuppressed){
     status='blocked';error='Contact opted out.';
   } else if(!isMockEligible && contact.whatsappConsentStatus!=='Opted In'){
     status='blocked';error='No recorded affirmative consent.';
   } else {
     const norm=v=>String(v||'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();const purpose=norm(campaign?.service||campaign?.customGoal||campaign?.goal);
     const activeSnapshot = campaign?.templateSnapshot || version?.snapshot;
     if(record?.status==='Opted Out'){status='blocked';error='Latest consent record is opted out.';}else if(!isMockEligible && (!record||record.status!=='Opted In'||!record.consentSource||!record.evidenceReference||!record.consentCapturedAt||new Date(record.consentCapturedAt)>new Date()||!user?.businessName||norm(record.consentedBusinessName)!==norm(user.businessName)||!purpose||!norm(record.consentPurpose).includes(purpose))){status='blocked';error='Current evidence-backed consent for this business and purpose is missing.';}else if(!activeSnapshot){status='blocked';error='Pinned template version is unavailable.';}else {const preview=resolveTemplate(activeSnapshot,contact,user);if(!preview.valid){status='blocked';error=`Missing personalization values: ${preview.missingVariables.join(', ')}.`;}}
   }
 }
  const write=await CampaignMessageJob.updateOne({_id:job._id,status:'processing',leaseOwner:workerId},{$set:{status,error,leaseOwner:'',leaseUntil:null,processedAt:new Date(),processingMs:Date.now()-started,validationStatus:status==='blocked'?'blocked':'eligible'}});if(!write.modifiedCount)return false;
  try {
    const idempKey = `${job.ownerId}:${job.executionId}:${job.contactId}:main`;
    const msgStatus = status === 'simulated_success' ? 'SIMULATED_SENT' : 'BLOCKED';
    const providerMessageId = status === 'simulated_success' ? `mock_msg_${crypto.randomBytes(8).toString('hex')}` : '';
    let renderedSnapshot = {};
    const [user, version, campaignDoc] = await Promise.all([
      User.findById(job.ownerId).select('businessName name phone website').lean(),
      TemplateVersion.findOne({ _id: job.templateVersionId, templateId: job.templateId, ownerId: job.ownerId }).lean(),
      Campaign.findById(job.campaignId).select('templateSnapshot workspaceId').lean()
    ]);
    const finalSnapshot = campaignDoc?.templateSnapshot || version?.snapshot;
    if (finalSnapshot && contact) {
      const p = resolveTemplate(finalSnapshot, contact, user);
      renderedSnapshot = {
        header: p.header || '',
        headerType: finalSnapshot.headerType || 'NONE',
        body: p.body || '',
        footer: p.footer || '',
        buttons: p.buttons || [],
        variables: p.variables || []
      };
    }
    const resolvedWsId = execution?.workspaceId || job.workspaceId || null;
    const messageDoc = await Message.findOneAndUpdate(
      { ownerId: job.ownerId, idempotencyKey: idempKey },
      {
        $setOnInsert: {
          messageId: `msg_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`,
          contactId: job.contactId,
          recipientPhone: contact?.phoneNumber || '',
          recipientName: contact?.fullName || '',
          campaignId: job.campaignId,
          campaignRunId: job.executionId,
          campaignJobId: job._id,
          templateId: job.templateId,
          templateVersionId: job.templateVersionId,
          channel: 'whatsapp',
          providerMode: 'MOCK',
          messageDirection: 'outbound'
        },
        $set: {
          status: msgStatus,
          providerMessageId,
          failureCode: status === 'blocked' ? (error.includes('consent') ? 'MISSING_CONSENT' : error.includes('phone') ? 'INVALID_PHONE' : 'BLOCKED') : '',
          failureReason: error,
          renderedContentSnapshot: renderedSnapshot,
          simulatedSentAt: status === 'simulated_success' ? new Date() : null,
          completedAt: new Date(),
          attemptCount: (job.attempts || 0) + 1
        }
      },
      { upsert: true, new: true }
    );
    if (messageDoc) {
      await recordMessageEvent({
        ownerId: job.ownerId,
        workspaceId: resolvedWsId,
        messageId: messageDoc._id,
        eventType: status === 'simulated_success' ? 'MOCK_SEND_SUCCEEDED' : 'MESSAGE_BLOCKED',
        previousStatus: 'PROCESSING',
        newStatus: msgStatus,
        source: 'campaign_worker',
        attemptNumber: (job.attempts || 0) + 1,
        correlationId: String(execution._id),
        safeMetadata: { executionId: String(execution._id), campaignId: String(job.campaignId) }
      });

      if (status === 'simulated_success') {
        try {
          const finishedAt = new Date();
          let conversation = await Conversation.findOne({
            ownerId: job.ownerId,
            contactId: job.contactId
          });
          if (!conversation) {
            conversation = await Conversation.create({
              ownerId: job.ownerId,
              workspaceId: campaignDoc?.workspaceId || job.workspaceId,
              contactId: job.contactId,
              lastMessageAt: finishedAt,
              status: 'Open'
            });
          }
          await ConversationMessage.create({
            ownerId: job.ownerId,
            workspaceId: campaignDoc?.workspaceId || job.workspaceId,
            conversationId: conversation._id,
            contactId: job.contactId,
            direction: 'outbound',
            messageType: 'text',
            messageSource: 'mock_simulation',
            trustLevel: 'synthetic',
            providerMessageId,
            templateVersionId: job.templateVersionId,
            messageBody: renderedSnapshot?.body || '',
            simulationStatus: 'Simulated Success',
            providerStatus: 'Sent',
            occurredAt: finishedAt
          });
          conversation.lastMessageId = messageDoc._id;
          conversation.lastActivityAt = finishedAt;
          await conversation.save();
        } catch (convErr) {
          // Non-blocking sync notice
        }
      }
    }
  } catch (syncErr) {
    // Non-blocking sync notice
  }
  await finishIfDone(execution);return true;
}
export async function finishIfDone(execution){
  const remaining=await CampaignMessageJob.countDocuments({executionId:execution._id,status:{$in:['queued','processing']}});
  if(remaining)return;
  const counts=await CampaignMessageJob.aggregate([{$match:{executionId:execution._id}},{$group:{_id:'$status',count:{$sum:1}}}]);
  const summary=Object.fromEntries(counts.map(x=>[x._id,x.count]));
  const status=execution.cancelRequested?'cancelled':summary.failed?'failed':'completed';
  const updated=await CampaignExecution.updateOne({_id:execution._id,status:{$in:['queued','running','cancelled']}},{$set:{status,completedAt:new Date(),summary:{...execution.summary,...summary}}});
  if(updated.modifiedCount){
    const campaignStatus = status==='cancelled'?'Cancelled':summary.failed?'Failed':'Completed';
    await Campaign.updateOne({_id:execution.campaignId,ownerId:execution.ownerId,activeExecutionId:execution._id},{$set:{activeExecutionId:null,status:campaignStatus}});
    const campaign=await Campaign.findOne({_id:execution.campaignId,ownerId:execution.ownerId});
    if(campaign)await recordCampaignActivity(campaign,execution.ownerId,`simulation_${status}`,`Mock simulation ${status}.`,{executionId:String(execution._id),mode:'MOCK',summary});
  }
}
export async function campaignWorkerTick(workerId=`campaign-worker-${process.pid}`){
  const now=new Date();
  for(let i=0;i<10;i++){
    const candidates=await CampaignMessageJob.find({status:'queued'}).sort({createdAt:1}).limit(100).select('_id executionId').lean();
    let next=null;
    for(const candidate of candidates){
      const run=await CampaignExecution.findOne({_id:candidate.executionId,status:{$in:['queued','running']}}).select('_id').lean();
      if(run){next=candidate;break;}
    }
    if(!next)break;
    if(!await processCampaignJob(next._id,workerId))break;
  }
  const due=await Campaign.findOne({'mockSchedule.status':'scheduled','mockSchedule.startAt':{$lte:now}}).sort({'mockSchedule.startAt':1}).lean();
  if(due){
    if(!due.selectedTemplateId || !due.selectedTemplateVersionId){
      await Campaign.updateOne(
        {_id:due._id,ownerId:due.ownerId,'mockSchedule.status':'scheduled'},
        {$set:{
          'mockSchedule.status':'blocked',
          'mockSchedule.error':'Template reference missing. Attach a template in Campaign Editor to execute.',
          status:'Needs Review'
        }}
      );
      return;
    }
    try{
      await createCampaignExecution(due._id,due.ownerId,due.ownerId,{trigger:'scheduled',scheduledFor:due.mockSchedule.startAt});
      await Campaign.updateOne({_id:due._id,ownerId:due.ownerId,'mockSchedule.status':'scheduled'},{$set:{'mockSchedule.status':'triggered',status:'Running'}});
    }catch(error){
      if(error.code===11000)await Campaign.updateOne({_id:due._id,ownerId:due.ownerId,'mockSchedule.status':'scheduled'},{$set:{'mockSchedule.status':'triggered',status:'Running'}});
      else await Campaign.updateOne({_id:due._id,ownerId:due.ownerId,'mockSchedule.status':'scheduled'},{$set:{'mockSchedule.status':'failed','mockSchedule.error':error.message.slice(0,300),status:'Failed'}});
    }
  }
}
export function startCampaignWorker(){let busy=false;const tick=async()=>{if(busy)return;busy=true;try{await campaignWorkerTick();}catch(e){console.error('Campaign worker tick failed:',e.message);}finally{busy=false;}};const timer=setInterval(tick,1000);timer.unref();tick();return timer;}
