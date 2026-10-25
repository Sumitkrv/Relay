import { workspaceBusinessContext } from '../utils/workspaceBusinessContext.js';
import { tenantScope } from '../utils/tenantScope.js';
import mongoose from 'mongoose';
import ExcelJS from 'exceljs';
import Campaign from '../models/Campaign.js';
import CampaignAudience from '../models/CampaignAudience.js';
import CampaignActivity from '../models/CampaignActivity.js';
import Contact from '../models/Contact.js';
import AudienceSegment from '../models/AudienceSegment.js';
import AudienceSegmentMember from '../models/AudienceSegmentMember.js';
import ConsentRecord from '../models/ConsentRecord.js';
import MessageTemplate, { TemplateVersion } from '../models/MessageTemplate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { recordCampaignActivity } from '../services/campaignActivityService.js';
import { snapshotAudience, buildAudienceFilter } from '../services/audienceSelectionService.js';
import { validateCampaignAudience, campaignTemplateContext } from '../services/eligibilityValidationService.js';
import { resolveTemplate } from '../utils/templateEngine.js';
import { getStrictIndustryConfig } from '../config/industries/industryRegistry.js';
import CampaignExecution from '../models/CampaignExecution.js';

const fail=(message,status=400)=>Object.assign(new Error(message),{status});const oid=id=>mongoose.isObjectIdOrHexString(id);
const allowedFields=['name','description','goal','customGoal','category','subcategory','service','location','language','tags','internalNotes','wizardStep','campaignType','executionMode','status'];
const cleanString=(v,max,label,{required=false,min=0}={})=>{if(v==null&&required)throw fail(`${label} is required.`);if(v==null)return '';if(typeof v!=='string')throw fail(`${label} must be text.`);const value=v.trim();if(value.length>max||value.length<min)throw fail(`${label} must contain ${min||1}–${max} characters.`);return value;};
function cleanCampaign(input={},partial=false){if(!input||typeof input!=='object'||Array.isArray(input))throw fail('Campaign details must be an object.');if(JSON.stringify(input).length>50000)throw fail('Campaign request is too large.',413);const unknown=Object.keys(input).filter(k=>!allowedFields.includes(k)&&!['selectedTemplateId','selectedTemplateVersionId'].includes(k));if(unknown.length)throw fail(`Unsupported campaign field: ${unknown[0]}.`);const out={};for(const [key,max]of [['name',120],['description',1000],['goal',100],['customGoal',120],['category',80],['subcategory',80],['service',120],['location',160],['internalNotes',5000]])if(input[key]!==undefined||(!partial&&key==='name'))out[key]=cleanString(input[key],max,key==='name'?'Campaign name':key,{required:key==='name',min:key==='name'?3:0});if(input.language!==undefined){if(!['en','hi','hinglish'].includes(input.language))throw fail('Choose English, Hindi, or Hinglish.');out.language=input.language;}if(input.tags!==undefined){if(!Array.isArray(input.tags)||input.tags.length>30||input.tags.some(v=>typeof v!=='string'||v.trim().length>40))throw fail('Use up to 30 campaign tags, each 40 characters or fewer.');out.tags=[...new Set(input.tags.map(v=>v.trim().toLowerCase()).filter(Boolean))];}if(input.wizardStep!==undefined){const n=Number(input.wizardStep);if(!Number.isInteger(n)||n<1||n>6)throw fail('Wizard step must be from 1 to 6.');out.wizardStep=n;}if(input.campaignType!==undefined){if(!['one-time','scheduled'].includes(input.campaignType))throw fail('Invalid campaign type.');out.campaignType=input.campaignType;}if(input.executionMode!==undefined){out.executionMode='MOCK';}for(const key of ['selectedTemplateId','selectedTemplateVersionId'])if(input[key]!==undefined){if(input[key]!==null&&!oid(input[key]))throw fail(`${key} is invalid.`);out[key]=input[key]||null;}return out;}
async function campaignFor(req){if(!oid(req.params.id))throw fail('Campaign ID is invalid.');const c=await Campaign.findOne({_id:req.params.id,...tenantScope(req)});if(!c)throw fail('Campaign not found.',404);return c;}
function pageSpec(req){const page=Math.max(1,Math.min(100000,Number.parseInt(req.query.page)||1));const limit=Math.max(1,Math.min(100,Number.parseInt(req.query.limit)||25));return{page,limit,skip:(page-1)*limit};}
function escapeRegex(s){return String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}

const ALL_CAMPAIGN_STATUSES=['Draft','Needs Review','Validated for Preparation','Ready','Scheduled','Running','Paused','Completed','Failed','Cancelled','Archived','Awaiting Provider Setup','Awaiting Template Approval'];

export async function listCampaigns(req,res){
  const {page,limit,skip}=pageSpec(req);
  const query={...tenantScope(req)};
  if(req.query.status){
    const matched=ALL_CAMPAIGN_STATUSES.find(s=>s.toLowerCase()===String(req.query.status).trim().toLowerCase());
    if(!matched)throw fail('Invalid campaign status filter.');
    query.status=matched;
  }
  if(req.query.search){
    const q=new RegExp(escapeRegex(String(req.query.search).slice(0,100)),'i');
    query.$or=[{name:q},{description:q},{category:q},{service:q}];
  }
  if(req.query.category)query.category=new RegExp(`^${escapeRegex(String(req.query.category).slice(0,80))}$`,'i');
  const sortMap={name:'name',status:'status',createdAt:'createdAt',updatedAt:'updatedAt'};
  const sort=sortMap[req.query.sort]||'updatedAt';
  const direction=req.query.direction==='asc'?1:-1;
  const [items,total]=await Promise.all([
    Campaign.find(query).sort({[sort]:direction,_id:direction}).skip(skip).limit(limit).lean(),
    Campaign.countDocuments(query)
  ]);
  const records=await Promise.all(items.map(async campaign=>{
    const audience=await CampaignAudience.aggregate([
      {$match:{...tenantScope(req),campaignId:campaign._id,snapshotVersion:campaign.audienceSnapshotVersion}},
      {$group:{_id:null,total:{$sum:1},eligible:{$sum:{$cond:[{$eq:['$eligibilityStatus','Eligible for Campaign Preparation']},1,0]}},excluded:{$sum:{$cond:[{$ne:['$eligibilityStatus','Eligible for Campaign Preparation']},1,0]}}}}
    ]);
    const template=campaign.selectedTemplateId
      ? await MessageTemplate.findOne({_id:campaign.selectedTemplateId,...tenantScope(req)}).select('name category language providerStatus currentVersionNumber').lean()
      : null;
    return {...campaign,audienceCounts:audience[0]||{total:0,eligible:0,excluded:0},template};
  }));
  res.json({records,total,page,pageSize:limit,totalPages:Math.ceil(total/limit)});
}

export async function campaignStats(req,res){
  const ownerId=req.user._id;const scope=tenantScope(req);
  const [groups,audience,latest,runs]=await Promise.all([
    Campaign.aggregate([{$match:{...scope}},{$group:{_id:'$status',count:{$sum:1}}}]),
    CampaignAudience.aggregate([{$match:{...scope}},{$sort:{snapshotVersion:-1}},{$group:{_id:{campaignId:'$campaignId',contactId:'$contactId'},member:{$first:'$$ROOT'}}},{$group:{_id:null,total:{$sum:1}}}]),
    Campaign.find({...scope}).sort({createdAt:-1}).limit(5).select('name status createdAt updatedAt category').lean(),
    CampaignExecution.aggregate([{$match:{...scope}},{$group:{_id:'$status',count:{$sum:1}}}])
  ]);
  const statusCounts=Object.fromEntries(groups.map(x=>[x._id,x.count]));
  const executionCounts=Object.fromEntries(runs.map(x=>[x._id,x.count]));
  const scheduledCount = (statusCounts.Scheduled||0) + (await Campaign.countDocuments({...scope,'mockSchedule.status':'scheduled',status:{$ne:'Scheduled'}}));
  res.json({
    stats:{
      totalCampaigns:groups.reduce((n,x)=>n+x.count,0),
      draftCampaigns:statusCounts.Draft||0,
      awaitingRequirements:(statusCounts['Awaiting Provider Setup']||0)+(statusCounts['Awaiting Template Approval']||0),
      readyForFutureExecution:(statusCounts['Validated for Preparation']||0)+(statusCounts.Ready||0),
      archivedCampaigns:statusCounts.Archived||0,
      totalSelectedContacts:audience[0]?.total||0,
      requiringAttention:statusCounts['Needs Review']||0,
      scheduledMockCampaigns:scheduledCount,
      runningMockCampaigns:(statusCounts.Running||0)+(executionCounts.running||0),
      pausedMockCampaigns:statusCounts.Paused||0,
      completedMockCampaigns:statusCounts.Completed||executionCounts.completed||0,
      failedMockCampaigns:statusCounts.Failed||executionCounts.failed||0,
      cancelledMockCampaigns:statusCounts.Cancelled||0
    },
    recent:latest
  });
}

export async function previewAudienceEligibility(req, res) {
  const ownerId = req.user._id;
  const { mode = 'manual', definition = {}, templateId = null, templateVersionId = null, goal = '', service = '' } = req.body || {};

  let query = { ownerId, isDeleted: false, isArchived: false };
  let manualIds = [];
  if (mode === 'manual') {
    manualIds = Array.isArray(definition.contactIds) ? [...new Set(definition.contactIds.map(String).filter(oid))] : [];
    query = { ownerId, _id: { $in: manualIds } };
  } else if (mode === 'all') {
    query = { ownerId, isDeleted: false, isArchived: false };
  } else if (mode === 'filters') {
    const built = buildAudienceFilter(ownerId, definition.filters || {});
    query = built.query;
  } else if (mode === 'group') {
    if (definition.groupId && oid(definition.groupId)) {
      query = { ownerId, groups: new mongoose.Types.ObjectId(definition.groupId), isDeleted: false, isArchived: false };
    }
  } else if (mode === 'segment') {
    if (definition.segmentId && oid(definition.segmentId)) {
      const segment = await AudienceSegment.findOne({ _id: definition.segmentId, ownerId }).lean();
      if (segment) {
        if (segment.segmentType === 'dynamic') {
          query = buildAudienceFilter(ownerId, segment.filterDefinition).query;
        } else {
          const ids = await AudienceSegmentMember.find({ ownerId, segmentId: segment._id }).distinct('contactId');
          query = { ownerId, _id: { $in: ids }, isDeleted: false };
        }
      }
    }
  } else if (mode === 'import') {
    if (definition.batchId && oid(definition.batchId)) {
      query = { ownerId, isDeleted: false, isArchived: false, sourceImportJobId: definition.batchId };
    }
  }

  if (Array.isArray(definition.excludedContactIds) && definition.excludedContactIds.length) {
    query._id = { ...(query._id || {}), $nin: definition.excludedContactIds.map(String).filter(oid) };
  }

  Object.assign(query, tenantScope(req));
  const [contacts, totalMatching] = await Promise.all([
    Contact.find(query).limit(1000).lean(),
    Contact.countDocuments(query)
  ]);

  const contactIds = contacts.map(c => c._id);
  const latestConsent = contactIds.length ? await ConsentRecord.aggregate([
    { $match: { ownerId, contactId: { $in: contactIds } } },
    { $sort: { recordedAt: -1, _id: -1 } },
    { $group: { _id: '$contactId', record: { $first: '$$ROOT' } } }
  ]) : [];
  const consentMap = new Map(latestConsent.map(x => [String(x._id), x.record]));

  let templateSnapshot = null;
  if (templateId && templateVersionId) {
    const version = await TemplateVersion.findOne({ _id: templateVersionId, templateId, ownerId }).lean();
    templateSnapshot = version?.snapshot || null;
  }

  const phoneRegex = /^\+[1-9]\d{7,14}$/;
  let validPhoneCount = 0;
  let invalidPhoneCount = 0;
  let optedInCount = 0;
  let unknownConsentCount = 0;
  let optedOutCount = 0;
  let doNotContactCount = 0;
  let demoCount = 0;
  let missingVariablesCount = 0;
  let eligibleCount = 0;

  const exclusionBreakdown = {
    MISSING_CONSENT: 0,
    CONTACT_OPTED_OUT: 0,
    DO_NOT_CONTACT: 0,
    INVALID_PHONE: 0,
    DEMO_CONTACT: 0,
    UNRESOLVED_VARIABLE: 0
  };

  const samplePreviews = [];

  for (const contact of contacts) {
    const reasons = [];
    const isPhoneValid = phoneRegex.test(contact.phoneNumber || '');
    if (isPhoneValid) validPhoneCount++; else { invalidPhoneCount++; reasons.push('INVALID_PHONE'); exclusionBreakdown.INVALID_PHONE++; }

    if (contact.isSuppressed || contact.isDoNotContact) {
      doNotContactCount++;
      reasons.push('DO_NOT_CONTACT');
      exclusionBreakdown.DO_NOT_CONTACT++;
    }

    if (contact.isDemo) {
      demoCount++;
      if (req.body?.executionMode && req.body.executionMode !== 'MOCK') {
        reasons.push('DEMO_CONTACT');
        exclusionBreakdown.DEMO_CONTACT++;
      }
    }

    const consentRec = consentMap.get(String(contact._id));
    if (contact.whatsappConsentStatus === 'Opted Out' || consentRec?.status === 'Opted Out' || contact.isSuppressed) {
      optedOutCount++;
      reasons.push('CONTACT_OPTED_OUT');
      exclusionBreakdown.CONTACT_OPTED_OUT++;
    } else if (contact.whatsappConsentStatus === 'Opted In' && consentRec?.status === 'Opted In') {
      optedInCount++;
    } else if (!contact.isDemo) {
      unknownConsentCount++;
      reasons.push('MISSING_CONSENT');
      exclusionBreakdown.MISSING_CONSENT++;
    }

    let renderedMsg = null;
    let missingVars = [];
    if (templateSnapshot) {
      const p = resolveTemplate(templateSnapshot, contact, workspaceBusinessContext(req.user, req.workspace));
      renderedMsg = p;
      if (!p.valid) {
        missingVariablesCount++;
        missingVars = p.missingVariables;
        reasons.push('UNRESOLVED_VARIABLE');
        exclusionBreakdown.UNRESOLVED_VARIABLE++;
      }
    }

    const isEligible = reasons.length === 0;
    if (isEligible) eligibleCount++;

    if (samplePreviews.length < 10) {
      samplePreviews.push({
        contactId: contact._id,
        fullName: contact.fullName,
        phoneNumber: contact.phoneNumber,
        city: contact.city || contact.location || '',
        interestedPropertyType: contact.interestedPropertyType || contact.interestedService || '',
        interestedProject: contact.interestedProject || '',
        whatsappConsentStatus: contact.whatsappConsentStatus,
        isEligible,
        exclusionReasons: reasons,
        missingVariables: missingVars,
        renderedPreview: renderedMsg ? {
          header: renderedMsg.header,
          body: renderedMsg.body,
          footer: renderedMsg.footer,
          buttons: renderedMsg.buttons,
          valid: renderedMsg.valid
        } : null
      });
    }
  }

  const factor = contacts.length > 0 ? totalMatching / contacts.length : 1;
  const scaled = num => Math.round(num * factor);

  res.json({
    summary: {
      matchingContacts: totalMatching,
      validPhoneCount: scaled(validPhoneCount),
      invalidPhoneCount: scaled(invalidPhoneCount),
      optedInCount: scaled(optedInCount),
      unknownConsentCount: scaled(unknownConsentCount),
      optedOutCount: scaled(optedOutCount),
      doNotContactCount: scaled(doNotContactCount),
      demoCount: scaled(demoCount),
      missingVariablesCount: scaled(missingVariablesCount),
      currentlyEligibleRecipients: scaled(eligibleCount),
      excludedRecipients: Math.max(0, totalMatching - scaled(eligibleCount)),
      exclusionBreakdown: {
        MISSING_CONSENT: scaled(exclusionBreakdown.MISSING_CONSENT),
        CONTACT_OPTED_OUT: scaled(exclusionBreakdown.CONTACT_OPTED_OUT),
        DO_NOT_CONTACT: scaled(exclusionBreakdown.DO_NOT_CONTACT),
        INVALID_PHONE: scaled(exclusionBreakdown.INVALID_PHONE),
        DEMO_CONTACT: scaled(exclusionBreakdown.DEMO_CONTACT),
        UNRESOLVED_VARIABLE: scaled(exclusionBreakdown.UNRESOLVED_VARIABLE)
      }
    },
    samplePreviews,
    executionMode: 'MOCK'
  });
}

export async function categoryCounts(req,res){const rows=await Contact.aggregate([{$match:{...tenantScope(req),isDeleted:false}},{$group:{_id:{$cond:[{$ne:['$businessCategory','']},'$businessCategory',{$cond:[{$ne:['$industry','']},'$industry','Uncategorized']}]},count:{$sum:1}}},{$sort:{count:-1,_id:1}},{$limit:100}]);res.json({records:rows.map(x=>({category:x._id,count:x.count}))});}

export async function createCampaign(req,res){const data=cleanCampaign(req.body||{});if(data.selectedTemplateId||data.selectedTemplateVersionId){const refs=await checkTemplateRef({selectedTemplateId:null,selectedTemplateVersionId:null},data,req.user._id);data.selectedTemplateId=refs.templateId;data.selectedTemplateVersionId=refs.versionId;}const campaign=await Campaign.create({...data,...tenantScope(req),createdBy:req.user._id,status:'Draft',audienceSelectionMode:'manual'});await recordCampaignActivity(campaign,req.user._id,'created','Campaign draft created.');res.status(201).json({campaign});}

async function checkTemplateRef(campaign,data,ownerId){const templateId=data.selectedTemplateId!==undefined?data.selectedTemplateId:campaign.selectedTemplateId;const versionId=data.selectedTemplateVersionId!==undefined?data.selectedTemplateVersionId:campaign.selectedTemplateVersionId;if(!templateId&&!versionId)return {templateId:null,versionId:null};if(!templateId||!versionId)throw fail('Select both a saved template and its exact version.');const [t,v]=await Promise.all([MessageTemplate.findOne({_id:templateId,ownerId}),TemplateVersion.findOne({_id:versionId,ownerId,templateId})]);if(!t||!v)throw fail('The selected template or version is not available in your workspace.',404);return {templateId:t._id,versionId:v._id,template:t,version:v};}

export async function updateCampaign(req,res){const c=await campaignFor(req);if(c.status==='Archived')throw fail('Archived campaigns cannot be edited.',409);const data=cleanCampaign(req.body||{},true);const refs=await checkTemplateRef(c,data,req.user._id);const changed=[];for(const [key,value]of Object.entries(data)){if(JSON.stringify(c[key])!==JSON.stringify(value)){changed.push(key);c[key]=value;}}if(data.selectedTemplateId!==undefined||data.selectedTemplateVersionId!==undefined){if(String(c.selectedTemplateId||'')!==String(refs.templateId||'')||String(c.selectedTemplateVersionId||'')!==String(refs.versionId||'')){changed.push('template');c.selectedTemplateId=refs.templateId;c.selectedTemplateVersionId=refs.versionId;}}
  if(changed.length){c.status='Draft';await c.save();await recordCampaignActivity(c,req.user._id,changed.includes('template')?'template_changed':'updated',changed.includes('template')?'Campaign template version changed.':'Campaign details updated.',{fields:changed});}res.json({campaign:c});}

export async function getCampaign(req,res){const c=await campaignFor(req);const {template,version}=await campaignTemplateContext(c);const [summary,memberCount]=await Promise.all([c.validationSummary||{},CampaignAudience.countDocuments({...tenantScope(req),campaignId:c._id,snapshotVersion:c.audienceSnapshotVersion})]);res.json({campaign:c,template:template?{...template,selectedVersion:version}:null,audienceCount:memberCount,validation:summary});}

export async function deleteCampaign(req,res){const c=await campaignFor(req);if(c.status!=='Draft')throw fail('Only campaign drafts can be deleted. Archive this campaign instead.',409);if(await CampaignExecution.exists({...tenantScope(req),campaignId:c._id}))throw fail('Campaigns with execution history cannot be deleted. Archive this campaign instead.',409);await Promise.all([CampaignAudience.deleteMany({...tenantScope(req),campaignId:c._id}),CampaignActivity.deleteMany({...tenantScope(req),campaignId:c._id}),c.deleteOne()]);res.json({deleted:true});}

export async function duplicateCampaign(req,res){const source=await campaignFor(req);const copy=await Campaign.create({...tenantScope(req),createdBy:req.user._id,name:`Copy of ${source.name}`.slice(0,120),description:source.description,goal:source.goal,customGoal:source.customGoal,category:source.category,subcategory:source.subcategory,service:source.service,location:source.location,language:source.language,tags:source.tags,internalNotes:source.internalNotes,audienceSelectionMode:source.audienceSelectionMode,audienceDefinition:source.audienceDefinition,selectedSegmentId:source.selectedSegmentId,selectedTemplateId:source.selectedTemplateId,selectedTemplateVersionId:source.selectedTemplateVersionId,status:'Draft',wizardStep:1});if(source.audienceSnapshotVersion){if(source.audienceSelectionMode==='manual'){const version=1,ops=[];const cursor=CampaignAudience.find({...tenantScope(req),campaignId:source._id,snapshotVersion:source.audienceSnapshotVersion}).select('contactId').cursor();for await(const member of cursor){ops.push({insertOne:{document:{...tenantScope(req),campaignId:copy._id,snapshotVersion:version,contactId:member.contactId,selectionSource:'duplicate',eligibilityStatus:'Missing Consent',exclusionReasons:['Revalidation pending'],validationTimestamp:new Date()}}});if(ops.length>=500){await CampaignAudience.bulkWrite(ops,{ordered:false});ops.length=0;}}if(ops.length)await CampaignAudience.bulkWrite(ops,{ordered:false});copy.audienceSnapshotVersion=version;copy.audienceDefinition={};await copy.save();}else await snapshotAudience(copy,req.user._id,{mode:copy.audienceSelectionMode,definition:copy.audienceDefinition});const summary=await validateCampaignAudience(copy,workspaceBusinessContext(req.user, req.workspace));copy.validationSummary=summary;await copy.save();}await recordCampaignActivity(copy,req.user._id,'duplicated',`Campaign duplicated from ${source.name}.`);res.status(201).json({campaign:copy});}

export async function archiveCampaign(req,res){const c=await campaignFor(req);if(c.activeExecutionId&&await CampaignExecution.exists({_id:c.activeExecutionId,status:{$in:['queued','running','paused']}}))throw fail('Pause or cancel the active simulation before archiving this campaign.',409);if(c.status!=='Archived'){c.status='Archived';await c.save();await recordCampaignActivity(c,req.user._id,'archived','Campaign archived.');}res.json({campaign:c});}

export async function setAudience(req,res){const c=await campaignFor(req);if(c.status==='Archived')throw fail('Archived campaigns cannot change audience.',409);const result=await snapshotAudience(c,req.user._id,req.body||{});c.status='Draft';c.validationSummary={...c.validationSummary,duplicateSelections:result.duplicates};await c.save();const validation=await validateCampaignAudience(c,workspaceBusinessContext(req.user, req.workspace));c.validationSummary=validation;await c.save();await recordCampaignActivity(c,req.user._id,'audience_modified',`Campaign audience snapshot updated with ${result.count} contacts.`,{mode:c.audienceSelectionMode,count:result.count,snapshotVersion:result.version,duplicateSelections:result.duplicates});res.json({audience:{...result,...validation.counts},validation});}

export async function validateCampaign(req,res){const c=await campaignFor(req);const v=await validateCampaignAudience(c,workspaceBusinessContext(req.user, req.workspace));const issues=[];if(c.name.trim().length<3)issues.push('Campaign name must contain at least 3 characters.');if(!(c.goal||c.customGoal))issues.push('Choose a campaign goal.');if(!c.audienceSnapshotVersion||v.counts.total===0)issues.push('Select at least one contact for the audience snapshot.');if(!c.selectedTemplateId||!c.selectedTemplateVersionId)issues.push('Select a saved message template version.');if(v.counts.missingConsent||v.counts.optedOut||v.counts.invalidPhone||v.counts.missingPersonalization||v.counts.inactive)issues.push('Resolve audience eligibility findings before validating preparation.');if(v.template.currentVersionChanged)issues.push('The selected template is an earlier version. Review it or explicitly select the current version.');const localReady=issues.length===0&&v.counts.eligible===v.counts.total;let status;if(!localReady)status='Needs Review';else if(v.template.providerStatus!=='Approved')status='Awaiting Template Approval';else status='Awaiting Provider Setup';
  c.validationSummary={...v,issues,localPreparationChecksPassed:localReady,sendEligible:false,sendEligibilityNote:'No sender integration is configured. Campaign preparation is not authorization to send.'};c.status=status;c.wizardStep=5;await c.save();await recordCampaignActivity(c,req.user._id,'validated','Campaign preparation validation completed.',{status,eligible:v.counts.eligible,total:v.counts.total,issues:issues.length});res.json({campaign:c,validation:c.validationSummary});}

export async function listAudience(req,res){const c=await campaignFor(req);const base={...tenantScope(req),campaignId:c._id,snapshotVersion:c.audienceSnapshotVersion};if(req.query.idsOnly==='true'){const total=await CampaignAudience.countDocuments(base);if(total>5000)throw fail('This manual audience is too large to edit as a manual selection. Keep its filters or remove contacts individually.',413);const members=await CampaignAudience.find(base).select('contactId').sort({contactId:1}).lean();return res.json({contactIds:members.map(m=>String(m.contactId)),total});}const {page,limit,skip}=pageSpec(req);const memberFilter={...base};if(req.query.status)memberFilter.eligibilityStatus=String(req.query.status).slice(0,80);if(req.query.search){const rx=new RegExp(escapeRegex(String(req.query.search).slice(0,80)),'i');const matches=await Contact.find({...tenantScope(req),$or:['fullName','companyName','phoneNumber','businessCategory'].map(k=>({[k]:rx}))}).select('_id').limit(5000).lean();memberFilter.contactId={$in:matches.map(x=>x._id)};}const [members,total]=await Promise.all([CampaignAudience.find(memberFilter).sort({createdAt:1,_id:1}).skip(skip).limit(limit).lean(),CampaignAudience.countDocuments(memberFilter)]);const contacts=await Contact.find({...tenantScope(req),_id:{$in:members.map(x=>x.contactId)}}).lean();const map=new Map(contacts.map(x=>[String(x._id),x]));res.json({records:members.map(m=>({member:m,contact:map.get(String(m.contactId))||null})),total,page,pageSize:limit,totalPages:Math.ceil(total/limit)});}

export async function removeAudienceMember(req,res){const c=await campaignFor(req);if(!oid(req.params.contactId))throw fail('Contact ID is invalid.');const result=await CampaignAudience.deleteOne({...tenantScope(req),campaignId:c._id,snapshotVersion:c.audienceSnapshotVersion,contactId:req.params.contactId});if(!result.deletedCount)throw fail('Campaign audience member not found.',404);c.status='Draft';c.validationSummary={};await c.save();await recordCampaignActivity(c,req.user._id,'audience_modified','Contact removed from campaign audience.',{contactId:req.params.contactId});res.json({removed:true});}

export async function previews(req,res){const c=await campaignFor(req);const {page,limit,skip}=pageSpec(req);const base={...tenantScope(req),campaignId:c._id,snapshotVersion:c.audienceSnapshotVersion};if(req.query.validation==='valid')base.eligibilityStatus='Eligible for Campaign Preparation';else if(req.query.validation==='issues')base.eligibilityStatus={$ne:'Eligible for Campaign Preparation'};const members=await CampaignAudience.find(base).sort({createdAt:1,_id:1}).skip(skip).limit(limit).lean();const total=await CampaignAudience.countDocuments(base);const {version}=await campaignTemplateContext(c);const contacts=members.length?await Contact.find({...tenantScope(req),_id:{$in:members.map(m=>m.contactId)}}).lean():[];const map=new Map(contacts.map(x=>[String(x._id),x]));const records=members.map(m=>{const contact=map.get(String(m.contactId));const message=contact&&version?.snapshot?resolveTemplate(version.snapshot,contact,workspaceBusinessContext(req.user, req.workspace)):null;return {member:m,contact:contact?{_id:contact._id,fullName:contact.fullName,companyName:contact.companyName,phoneNumber:contact.phoneNumber,businessCategory:contact.businessCategory,location:contact.location}:null,preview:message};});res.json({records,total,page,pageSize:limit,totalPages:Math.ceil(total/limit),planningOnly:true});}

export async function activity(req,res){const c=await campaignFor(req);const records=await CampaignActivity.find({...tenantScope(req),campaignId:c._id}).sort({createdAt:-1}).limit(100).lean();res.json({records});}
function csvCell(value){let s=String(value??'');if(/^[\s]*[=+@\-]/.test(s))s=`'${s}`;return `"${s.replaceAll('"','""')}"`;}
export async function exportAudience(req,res){const c=await campaignFor(req);const members=await CampaignAudience.find({...tenantScope(req),campaignId:c._id,snapshotVersion:c.audienceSnapshotVersion}).sort({createdAt:1}).limit(100000).lean();const contacts=await Contact.find({...tenantScope(req),_id:{$in:members.map(m=>m.contactId)}}).lean();const map=new Map(contacts.map(x=>[String(x._id),x]));const rows=[['Name','Company','Phone','Category','Location','Eligibility','Reasons'],...members.map(m=>{const x=map.get(String(m.contactId))||{};return[x.fullName,x.companyName,x.phoneNumber,x.businessCategory,x.location,m.eligibilityStatus,m.exclusionReasons.join('; ')];})];res.type('text/csv');res.setHeader('Content-Disposition','attachment; filename="campaign-audience.csv"');res.send(rows.map(row=>row.map(csvCell).join(',')).join('\r\n'));}

export async function starterDrafts(req, res) {
  const config = getStrictIndustryConfig(req.workspace?.industryKey);
  res.json({ records: config?.sampleCampaignDrafts || [], industryKey: req.workspace?.industryKey || null, source: 'unsaved_industry_definitions' });
}
