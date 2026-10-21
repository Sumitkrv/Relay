import mongoose from 'mongoose';
import ExcelJS from 'exceljs';
import Campaign from '../models/Campaign.js';
import CampaignAudience from '../models/CampaignAudience.js';
import CampaignExecution from '../models/CampaignExecution.js';
import CampaignMessageJob from '../models/CampaignMessageJob.js';
import Message from '../models/Message.js';
import Contact from '../models/Contact.js';
import {TemplateVersion} from '../models/MessageTemplate.js';
import {resolveTemplate} from '../utils/templateEngine.js';
import {createCampaignExecution,finishIfDone} from '../services/campaignExecutionService.js';
import {validateCampaignAudience} from '../services/eligibilityValidationService.js';
import {recordCampaignActivity} from '../services/campaignActivityService.js';
const fail=(message,status=400,code=undefined)=>Object.assign(new Error(message),{status,...(code?{code}:{})});
const id=v=>mongoose.isObjectIdOrHexString(v);
const ownerExecution=async req=>{if(!id(req.params.executionId))throw fail('Execution ID is invalid.');const x=await CampaignExecution.findOne({_id:req.params.executionId,ownerId:req.user._id});if(!x)throw fail('Execution not found.',404);return x;};
const escapeCsv=v=>{let s=String(v??'');if(/^[\s]*[=+@-]/.test(s))s=`'${s}`;return `"${s.replaceAll('"','""')}"`;};
export async function start(req,res){if(!id(req.params.id))throw fail('Campaign ID is invalid.');const x=await createCampaignExecution(req.params.id,req.user._id,req.user._id);res.status(201).json({execution:x,mockOnly:true});}
export async function launch(req,res){if(!id(req.params.id))throw fail('Campaign ID is invalid.');const campaign=await Campaign.findOne({_id:req.params.id,ownerId:req.user._id});if(!campaign)throw fail('Campaign not found.',404);if(campaign.status==='Running')throw fail('Campaign is already running.',409);const x=await createCampaignExecution(req.params.id,req.user._id,req.user._id);res.status(201).json({execution:x,campaignStatus:'Running',mockOnly:true});}
export async function list(req,res){if(!id(req.params.id))throw fail('Campaign ID is invalid.');const campaign=await Campaign.exists({_id:req.params.id,ownerId:req.user._id});if(!campaign)throw fail('Campaign not found.',404);const records=await CampaignExecution.find({ownerId:req.user._id,campaignId:req.params.id}).sort({createdAt:-1}).limit(100).lean();res.json({records});}
export async function get(req,res){const x=await ownerExecution(req);const [counts,progress]=await Promise.all([CampaignMessageJob.aggregate([{$match:{ownerId:req.user._id,executionId:x._id}},{$group:{_id:'$status',count:{$sum:1}}}]),CampaignMessageJob.countDocuments({ownerId:req.user._id,executionId:x._id,status:{$in:['simulated_success','failed','blocked','cancelled']}})]);res.json({execution:x,counts:Object.fromEntries(counts.map(r=>[r._id,r.count])),progressPercentage:x.totalJobs?Math.round(progress/x.totalJobs*100):0,mockOnly:true});}
export async function jobs(req,res){const x=await ownerExecution(req);const page=Math.max(1,Number.parseInt(req.query.page)||1),limit=Math.max(1,Math.min(100,Number.parseInt(req.query.limit)||25));const query={ownerId:req.user._id,executionId:x._id};if(['simulated_success','failed','blocked','cancelled','queued','processing'].includes(req.query.status))query.status=req.query.status;const [records,total,version]=await Promise.all([CampaignMessageJob.find(query).sort({createdAt:1,_id:1}).skip((page-1)*limit).limit(limit).lean(),CampaignMessageJob.countDocuments(query),TemplateVersion.findOne({_id:x.templateVersionId,ownerId:req.user._id}).lean()]);const contacts=await Contact.find({ownerId:req.user._id,_id:{$in:records.map(r=>r.contactId)}}).select('fullName companyName businessCategory phoneNumber').lean();const map=new Map(contacts.map(c=>[String(c._id),c]));res.json({records:records.map(r=>{const contact=map.get(String(r.contactId))||null;const preview=contact&&version?resolveTemplate(version.snapshot,contact,req.user):null;return {...r,contact,preview:preview?{header:preview.header,body:preview.body,footer:preview.footer,valid:preview.valid,missingVariables:preview.missingVariables}:null};}),total,page,pageSize:limit,totalPages:Math.ceil(total/limit)});}
export async function control(req,res){const x=await ownerExecution(req);const action=req.params.action;if(action==='pause'){if(!['queued','running'].includes(x.status))throw fail('Only queued or running simulations can be paused.',409);x.status='paused';await x.save();}else if(action==='resume'){if(x.status!=='paused')throw fail('Only paused simulations can be resumed.',409);const campaign=await Campaign.findOne({_id:x.campaignId,ownerId:req.user._id});if(!campaign)throw fail('Campaign not found.',404);await validateCampaignAudience(campaign,req.user);await CampaignMessageJob.updateMany({ownerId:req.user._id,executionId:x._id,status:'processing'},{$set:{status:'queued',leaseOwner:'',leaseUntil:null}});x.status='queued';x.cancelRequested=false;await x.save();}else if(action==='cancel'){if(!['queued','running','paused'].includes(x.status))throw fail('This simulation is already finished.',409);x.cancelRequested=true;x.status='cancelled';await x.save();await CampaignMessageJob.updateMany({ownerId:req.user._id,executionId:x._id,status:{$in:['queued','processing']}},{$set:{status:'cancelled',error:'Cancelled by user.',leaseOwner:'',leaseUntil:null,processedAt:new Date()}});await Campaign.updateOne({_id:x.campaignId,ownerId:req.user._id,activeExecutionId:x._id},{$set:{activeExecutionId:null}});}else throw fail('Unsupported execution action.');const campaign=await Campaign.findOne({_id:x.campaignId,ownerId:req.user._id});if(campaign)await recordCampaignActivity(campaign,req.user._id,`simulation_${action}`,`Mock simulation ${action}.`,{executionId:String(x._id)});res.json({execution:x,mockOnly:true});}
export async function exportReport(req,res){const x=await ownerExecution(req);const format=String(req.query.format||'csv').toLowerCase();if(!['csv','xlsx'].includes(format))throw fail('Export format must be csv or xlsx.');const statuses=['simulated_success','failed','blocked','cancelled'];const status=statuses.includes(req.query.status)?req.query.status:null;const q={ownerId:req.user._id,executionId:x._id,...(status?{status}:{})};const jobs=await CampaignMessageJob.find(q).sort({createdAt:1}).limit(100000).lean();const contacts=await Contact.find({ownerId:req.user._id,_id:{$in:jobs.map(j=>j.contactId)}}).select('fullName companyName businessCategory phoneNumber').lean();const map=new Map(contacts.map(c=>[String(c._id),c]));const rows=[['Execution ID','Contact','Company','Category','Phone','Template Version','Validation Status','Simulation Status','Attempts','Error','Processed At'],...jobs.map(j=>{const c=map.get(String(j.contactId))||{};return[x._id,c.fullName,c.companyName,c.businessCategory,c.phoneNumber,j.templateVersionId,j.validationStatus,j.status,j.attempts,j.error,j.processedAt?.toISOString()];})];if(format==='xlsx'){const workbook=new ExcelJS.Workbook(),sheet=workbook.addWorksheet('Mock execution');sheet.addRows(rows.map(row=>row.map(v=>String(v??''))));sheet.getRow(1).font={bold:true};sheet.views=[{state:'frozen',ySplit:1}];const buffer=await workbook.xlsx.writeBuffer();res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');res.setHeader('Content-Disposition',`attachment; filename="campaign-execution-${x._id}.xlsx"`);return res.send(Buffer.from(buffer));}res.type('text/csv; charset=utf-8');res.setHeader('Content-Disposition',`attachment; filename="campaign-execution-${x._id}.csv"`);res.send(`\uFEFF${rows.map(row=>row.map(escapeCsv).join(',')).join('\r\n')}`);}
export async function schedule(req,res){
  if(!id(req.params.id))throw fail('Campaign ID is invalid.');
  const campaign=await Campaign.findOne({_id:req.params.id,ownerId:req.user._id});
  if(!campaign)throw fail('Campaign not found.',404);
  if(!campaign.selectedTemplateId || !campaign.selectedTemplateVersionId){
    throw fail('Campaign must have a valid template selected before scheduling.', 400, 'TEMPLATE_REQUIRED');
  }
  const at=new Date(req.body?.startAt);
  const timezone=String(req.body?.timezone||'Asia/Kolkata');
  try{new Intl.DateTimeFormat('en',{timeZone:timezone});}catch{throw fail('Choose a valid IANA timezone.');}
  if(!req.body?.startAt||Number.isNaN(at.valueOf())||at<=new Date())throw fail('Choose a future schedule date and time.');
  campaign.mockSchedule={startAt:at,timezone,status:'scheduled',createdAt:new Date()};
  campaign.status='Scheduled';
  campaign.campaignType='scheduled';
  await campaign.save();
  await recordCampaignActivity(campaign,req.user._id,'simulation_scheduled','Mock simulation scheduled.',{startAt:at,timezone});
  res.status(201).json({schedule:campaign.mockSchedule,campaign,status:'Scheduled'});
}
export async function reschedule(req,res){
  if(!id(req.params.id))throw fail('Campaign ID is invalid.');
  const campaign=await Campaign.findOne({_id:req.params.id,ownerId:req.user._id});
  if(!campaign)throw fail('Campaign not found.',404);
  if(campaign.status==='Running'||campaign.status==='Completed')throw fail('Active or completed campaigns cannot be rescheduled.',409);
  if(!campaign.selectedTemplateId || !campaign.selectedTemplateVersionId){
    throw fail('Campaign must have a valid template selected before scheduling.', 400, 'TEMPLATE_REQUIRED');
  }
  const at=new Date(req.body?.startAt);
  const timezone=String(req.body?.timezone||campaign.mockSchedule?.timezone||'Asia/Kolkata');
  try{new Intl.DateTimeFormat('en',{timeZone:timezone});}catch{throw fail('Choose a valid IANA timezone.');}
  if(!req.body?.startAt||Number.isNaN(at.valueOf())||at<=new Date())throw fail('Choose a future schedule date and time.');
  campaign.mockSchedule={startAt:at,timezone,status:'scheduled',updatedAt:new Date()};
  campaign.status='Scheduled';
  campaign.campaignType='scheduled';
  await campaign.save();
  await recordCampaignActivity(campaign,req.user._id,'simulation_rescheduled','Mock simulation rescheduled.',{startAt:at,timezone});
  res.json({schedule:campaign.mockSchedule,campaign,status:'Scheduled'});
}
export async function unschedule(req,res){
  if(!id(req.params.id))throw fail('Campaign ID is invalid.');
  const campaign=await Campaign.findOne({_id:req.params.id,ownerId:req.user._id});
  if(!campaign)throw fail('Campaign not found.',404);
  campaign.mockSchedule=null;
  if(campaign.status==='Scheduled')campaign.status='Draft';
  await campaign.save();
  res.json({schedule:null,campaign,status:campaign.status});
}
export async function pauseCampaign(req,res){
  if(!id(req.params.id))throw fail('Campaign ID is invalid.');
  const campaign=await Campaign.findOne({_id:req.params.id,ownerId:req.user._id});
  if(!campaign)throw fail('Campaign not found.',404);
  const execution=campaign.activeExecutionId
    ? await CampaignExecution.findOne({_id:campaign.activeExecutionId,ownerId:req.user._id})
    : await CampaignExecution.findOne({campaignId:campaign._id,ownerId:req.user._id,status:{$in:['queued','running']}}).sort({createdAt:-1});
  if(!execution||!['queued','running'].includes(execution.status))throw fail('No running simulation to pause.',409);
  execution.status='paused';
  await execution.save();
  campaign.status='Paused';
  await campaign.save();
  await recordCampaignActivity(campaign,req.user._id,'simulation_paused','Mock simulation paused.',{executionId:String(execution._id)});
  res.json({execution,campaignStatus:'Paused',mockOnly:true});
}
export async function resumeCampaign(req,res){
  if(!id(req.params.id))throw fail('Campaign ID is invalid.');
  const campaign=await Campaign.findOne({_id:req.params.id,ownerId:req.user._id});
  if(!campaign)throw fail('Campaign not found.',404);
  const execution=campaign.activeExecutionId
    ? await CampaignExecution.findOne({_id:campaign.activeExecutionId,ownerId:req.user._id})
    : await CampaignExecution.findOne({campaignId:campaign._id,ownerId:req.user._id,status:'paused'}).sort({createdAt:-1});
  if(!execution||execution.status!=='paused')throw fail('Only paused simulations can be resumed.',409);
  await validateCampaignAudience(campaign,req.user);
  await CampaignMessageJob.updateMany({ownerId:req.user._id,executionId:execution._id,status:'processing'},{$set:{status:'queued',leaseOwner:'',leaseUntil:null}});
  execution.status='queued';
  execution.cancelRequested=false;
  await execution.save();
  campaign.status='Running';
  await campaign.save();
  await recordCampaignActivity(campaign,req.user._id,'simulation_resumed','Mock simulation resumed.',{executionId:String(execution._id)});
  res.json({execution,campaignStatus:'Running',mockOnly:true});
}
export async function cancelCampaign(req,res){
  if(!id(req.params.id))throw fail('Campaign ID is invalid.');
  const campaign=await Campaign.findOne({_id:req.params.id,ownerId:req.user._id});
  if(!campaign)throw fail('Campaign not found.',404);
  if(campaign.mockSchedule&&campaign.mockSchedule.status==='scheduled'){
    campaign.mockSchedule.status='cancelled';
  }
  const execution=campaign.activeExecutionId
    ? await CampaignExecution.findOne({_id:campaign.activeExecutionId,ownerId:req.user._id})
    : await CampaignExecution.findOne({campaignId:campaign._id,ownerId:req.user._id,status:{$in:['queued','running','paused']}}).sort({createdAt:-1});
  if(execution){
    execution.cancelRequested=true;
    execution.status='cancelled';
    await execution.save();
    await CampaignMessageJob.updateMany(
      {ownerId:req.user._id,executionId:execution._id,status:{$in:['queued','processing']}},
      {$set:{status:'cancelled',error:'Cancelled by user.',leaseOwner:'',leaseUntil:null,processedAt:new Date()}}
    );
    campaign.activeExecutionId=null;
  }
  campaign.status='Cancelled';
  await campaign.save();
  await recordCampaignActivity(campaign,req.user._id,'simulation_cancelled','Campaign and mock simulation cancelled.');
  res.json({campaign,cancelled:true,mockOnly:true});
}
export async function retryFailed(req,res){
  if(!id(req.params.id))throw fail('Campaign ID is invalid.');
  const campaign=await Campaign.findOne({_id:req.params.id,ownerId:req.user._id});
  if(!campaign)throw fail('Campaign not found.',404);
  const execution=campaign.activeExecutionId
    ? await CampaignExecution.findOne({_id:campaign.activeExecutionId,ownerId:req.user._id})
    : await CampaignExecution.findOne({campaignId:campaign._id,ownerId:req.user._id}).sort({createdAt:-1});
  if(!execution)throw fail('No execution found to retry.',404);
  const failedJobs=await CampaignMessageJob.find({ownerId:req.user._id,executionId:execution._id,status:'failed'}).lean();
  if(!failedJobs.length)return res.json({retriedCount:0,message:'No failed messages found to retry.'});
  const contactIds=failedJobs.map(j=>j.contactId);
  const validContacts=await Contact.find({_id:{$in:contactIds},ownerId:req.user._id,isDeleted:false,isArchived:false,whatsappConsentStatus:'Opted In'}).select('_id phoneNumber').lean();
  const eligibleContactIds=new Set(validContacts.filter(c=>/^\+[1-9]\d{7,14}$/.test(c.phoneNumber||'')).map(c=>String(c._id)));
  const retryJobIds=failedJobs.filter(j=>eligibleContactIds.has(String(j.contactId))).map(j=>j._id);
  if(!retryJobIds.length)return res.json({retriedCount:0,message:'None of the failed contacts are currently eligible for retry (consent or phone invalid).'});
  await CampaignMessageJob.updateMany({_id:{$in:retryJobIds}},{$set:{status:'queued',error:'',leaseOwner:'',leaseUntil:null}});
  execution.status='running';
  await execution.save();
  campaign.status='Running';
  campaign.activeExecutionId=execution._id;
  await campaign.save();
  await recordCampaignActivity(campaign,req.user._id,'retry_requested',`Retried ${retryJobIds.length} failed messages.`);
  res.json({retriedCount:retryJobIds.length,totalFailed:failedJobs.length,executionId:execution._id});
}
export async function analytics(req,res){
  if(!id(req.params.id))throw fail('Campaign ID is invalid.');
  const campaign=await Campaign.findOne({_id:req.params.id,ownerId:req.user._id});
  if(!campaign)throw fail('Campaign not found.',404);
  const executions=await CampaignExecution.find({campaignId:campaign._id,ownerId:req.user._id}).sort({createdAt:-1}).lean();
  const [jobCounts,failureReasons,audienceTotal]=await Promise.all([
    CampaignMessageJob.aggregate([
      {$match:{ownerId:req.user._id,campaignId:campaign._id}},
      {$group:{_id:'$status',count:{$sum:1},attempts:{$sum:'$attempts'}}}
    ]),
    CampaignMessageJob.aggregate([
      {$match:{ownerId:req.user._id,campaignId:campaign._id,status:{$in:['failed','blocked']}}},
      {$group:{_id:'$error',count:{$sum:1}}},
      {$sort:{count:-1}},
      {$limit:10}
    ]),
    CampaignAudience.countDocuments({ownerId:req.user._id,campaignId:campaign._id,snapshotVersion:campaign.audienceSnapshotVersion})
  ]);
  const countsMap=Object.fromEntries(jobCounts.map(r=>[r._id,r.count]));
  const totalAttempts=jobCounts.reduce((sum,r)=>sum+(r.attempts||0),0);
  res.json({
    campaignId:campaign._id,
    campaignName:campaign.name,
    campaignType:campaign.campaignType,
    status:campaign.status,
    executionMode:'MOCK',
    audienceSize:audienceTotal,
    mockSummary:{
      totalJobs:executions.reduce((sum,e)=>sum+(e.totalJobs||0),0),
      simulatedSent:countsMap.simulated_success||0,
      blocked:countsMap.blocked||0,
      failed:countsMap.failed||0,
      queued:countsMap.queued||0,
      processing:countsMap.processing||0,
      cancelled:countsMap.cancelled||0,
      totalAttempts
    },
    failureReasons:failureReasons.map(r=>({reason:r._id||'Unspecified error',count:r.count})),
    executionsCount:executions.length,
    latestRun:executions[0]||null
  });
}

export async function campaignMessages(req, res) {
  if (!id(req.params.id)) throw fail('Campaign ID is invalid.');
  const campaign = await Campaign.findOne({ _id: req.params.id, ownerId: req.user._id });
  if (!campaign) throw fail('Campaign not found.', 404);

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 25));
  const query = { ownerId: req.user._id, campaignId: campaign._id };
  if (req.query.status && req.query.status !== 'all') {
    query.status = req.query.status;
  }
  if (req.query.search) {
    const term = req.query.search.trim();
    query.$or = [
      { recipientName: { $regex: term, $options: 'i' } },
      { recipientPhone: { $regex: term, $options: 'i' } },
      { 'renderedContentSnapshot.body': { $regex: term, $options: 'i' } }
    ];
  }

  const [records, total] = await Promise.all([
    Message.find(query)
      .populate('contactId', 'fullName phoneNumber email companyName city interestedPropertyType leadStatus')
      .populate('templateId', 'name category language')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Message.countDocuments(query)
  ]);

  res.json({ records, total, page, limit, totalPages: Math.ceil(total / limit) });
}

export async function activeExecution(req, res) {
  if (!id(req.params.id)) throw fail('Campaign ID is invalid.');
  const campaign = await Campaign.findOne({ _id: req.params.id, ownerId: req.user._id });
  if (!campaign) throw fail('Campaign not found.', 404);

  const execution = campaign.activeExecutionId
    ? await CampaignExecution.findOne({ _id: campaign.activeExecutionId, ownerId: req.user._id }).lean()
    : await CampaignExecution.findOne({ campaignId: campaign._id, ownerId: req.user._id }).sort({ createdAt: -1 }).lean();

  if (!execution) {
    return res.json({ execution: null, counts: {}, progressPercentage: 0, mockOnly: true });
  }

  const [counts, progress] = await Promise.all([
    CampaignMessageJob.aggregate([
      { $match: { ownerId: req.user._id, executionId: execution._id } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    CampaignMessageJob.countDocuments({
      ownerId: req.user._id,
      executionId: execution._id,
      status: { $in: ['simulated_success', 'failed', 'blocked', 'cancelled'] }
    })
  ]);

  res.json({
    execution,
    counts: Object.fromEntries(counts.map(r => [r._id, r.count])),
    progressPercentage: execution.totalJobs ? Math.round((progress / execution.totalJobs) * 100) : 0,
    mockOnly: true
  });
}

export async function campaignQueueStatus(req, res) {
  if (!id(req.params.id)) throw fail('Campaign ID is invalid.');
  const campaign = await Campaign.findOne({ _id: req.params.id, ownerId: req.user._id });
  if (!campaign) throw fail('Campaign not found.', 404);

  const active = campaign.activeExecutionId
    ? await CampaignExecution.findOne({ _id: campaign.activeExecutionId, ownerId: req.user._id }).lean()
    : null;

  const counts = active
    ? await CampaignMessageJob.aggregate([
        { $match: { ownerId: req.user._id, executionId: active._id } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ])
    : [];

  res.json({
    campaignId: campaign._id,
    hasActiveExecution: Boolean(active),
    executionStatus: active?.status || 'none',
    mode: 'MOCK',
    counts: Object.fromEntries(counts.map(r => [r._id, r.count]))
  });
}

