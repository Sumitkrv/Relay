import { legacyWorkspaceScope } from '../utils/legacyWorkspaceScope.js';
import { validateAndSanitizeIndustryData } from '../services/industryConfigurationService.js';
import { tenantScope } from '../utils/tenantScope.js';
import mongoose from 'mongoose';
import ExcelJS from 'exceljs';
import Contact,{LEAD_STATUSES,PRIORITIES,CONSENT_STATUSES} from '../models/Contact.js';
import ConsentRecord from '../models/ConsentRecord.js';
import ContactActivity from '../models/ContactActivity.js';
import ContactGroup from '../models/ContactGroup.js';
import {cleanContactInput} from '../utils/contactValidation.js';import {scoreContact} from '../services/leadScoringService.js';import {recordConvertedContact} from '../services/leadConversionService.js';

const MAX_PAGE_SIZE=100;const MAX_BULK=500;
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const escapeRegExp=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const parseIntParam=(value,fallback,min,max)=>{const n=Number(value);return Number.isInteger(n)?Math.min(max,Math.max(min,n)):fallback;};
const validId=id=>mongoose.isObjectIdOrHexString(id);
function parseId(id){if(!validId(id))throw fail('Contact ID is invalid.');return id;}
function activityFor(contact,performedBy,activityType,description,changes={}){return {ownerId:contact.ownerId,workspaceId:contact.workspaceId,contactId:contact._id,performedBy,activityType,description,changes};}
async function addActivity(contact,userId,type,description,changes={}){await ContactActivity.create(activityFor(contact,userId,type,description,changes));}
function allowedInList(value,allowed,key){if(!value)return null;const values=String(value).split(',').map(v=>v.trim()).filter(Boolean);const invalid=values.find(v=>!allowed.includes(v));if(invalid)throw fail(`Invalid ${key} filter.`);return values.length?{$in:values}:null;}

export function buildContactFilter(ownerId,query={},workspaceId=null){
  const filter={ownerId,isDeleted:false,...(workspaceId?{workspaceId}:{})};
  const archived=query.archived??'false';if(!['true','false','all'].includes(String(archived)))throw fail('Invalid archived filter.');if(String(archived)!=='all')filter.isArchived=String(archived)==='true';
  const statuses=allowedInList(query.leadStatus,LEAD_STATUSES,'lead status');if(statuses)filter.leadStatus=statuses;
  const priorities=allowedInList(query.priority,PRIORITIES,'priority');if(priorities)filter.priority=priorities;
  const consents=allowedInList(query.whatsappConsentStatus,CONSENT_STATUSES,'consent');if(consents)filter.whatsappConsentStatus=consents;
  for(const [key,field] of [['industry','industry'],['businessCategory','businessCategory'],['subcategory','businessSubcategory'],['service','interestedService'],['source','leadSource']])if(query[key]){if(typeof query[key]!=='string'||query[key].length>120)throw fail(`Invalid ${key} filter.`);const value=query[key].trim();filter[field]=key==='businessCategory'&&value.toLowerCase()==='uncategorized'?{$in:[new RegExp('^uncategorized$','i'),'',null]}:new RegExp(`^${escapeRegExp(value)}$`,'i');}
  
  // Industry Interest Filter (Property / Course / Service / Vehicle)
  const interestParam = query.propertyInterest || query.interestedPropertyType || query.interestedService || query.courseInterest || query.serviceInterest || query.vehicleInterest;
  if (interestParam) {
    if (typeof interestParam !== 'string' || interestParam.length > 120) throw fail('Invalid interest filter.');
    const intRegex = new RegExp(escapeRegExp(interestParam.trim()), 'i');
    if (!filter.$and) filter.$and = [];
    filter.$and.push({
      $or: [
        { interestedPropertyType: intRegex },
        { interestedService: intRegex },
        { 'industryData.courseInterest': intRegex },
        { 'industryData.preferredService': intRegex },
        { 'industryData.vehicleInterest': intRegex },
      ]
    });
  }

  // Real Estate City & Location Filter
  const location = query.location || query.city;
  if (location) {
    if (typeof location !== 'string' || location.length > 160) throw fail('Invalid location filter.');
    const locRegex = new RegExp(escapeRegExp(location.trim()), 'i');
    if (!filter.$and) filter.$and = [];
    filter.$and.push({ $or: [{ location: locRegex }, { city: locRegex }, { preferredLocation: locRegex }] });
  }

  // Real Estate State Filter
  if(query.state){
    if(typeof query.state!=='string'||query.state.length>120)throw fail('Invalid state filter.');
    filter.state=new RegExp(escapeRegExp(query.state.trim()),'i');
  }

  // Project / Batch / Department Filter
  const project = query.project || query.interestedProject || query.batch || query.preferredBatch || query.targetExam;
  if(project){
    if(typeof project!=='string'||project.length>160)throw fail('Invalid project filter.');
    const projRegex=new RegExp(escapeRegExp(project.trim()),'i');
    filter.$and=filter.$and?filter.$and:[];
    filter.$and.push({
      $or: [
        { interestedProject: projRegex },
        { businessCategory: projRegex },
        { 'industryData.preferredBatch': projRegex },
        { 'industryData.targetExam': projRegex }
      ]
    });
  }

  // Budget Range (Numeric estimatedDealValue or string budgetRange)
  if(query.budgetMin!=null||query.budgetMax!=null){
    filter.estimatedDealValue={};
    if(query.budgetMin!=null&&query.budgetMin!==''){
      const min=Number(query.budgetMin);
      if(!Number.isNaN(min))filter.estimatedDealValue.$gte=min;
    }
    if(query.budgetMax!=null&&query.budgetMax!==''){
      const max=Number(query.budgetMax);
      if(!Number.isNaN(max))filter.estimatedDealValue.$lte=max;
    }
    if(!Object.keys(filter.estimatedDealValue).length)delete filter.estimatedDealValue;
  }

  // Contact Group Filter
  const group=query.group||query.groupId||query.contactGroupId;
  if(group){
    if(!validId(group))throw fail('Invalid contact group filter.');
    filter.groups=new mongoose.Types.ObjectId(group);
  }

  // Suppression / Do Not Contact Filter
  if(query.isSuppressed!==undefined&&['true','false'].includes(String(query.isSuppressed))){
    filter.isSuppressed=String(query.isSuppressed)==='true';
  }

  // Demo Filter
  if(query.isDemo!==undefined&&['true','false'].includes(String(query.isDemo))){
    filter.isDemo=String(query.isDemo)==='true';
  }

  if(query.sourceImportJobId){if(!mongoose.isObjectIdOrHexString(query.sourceImportJobId))throw fail('Invalid import batch filter.');filter.sourceImportJobId=query.sourceImportJobId;}
  
  // Tags Filter (single or multiple comma-separated)
  if(query.tag||query.tags){
    const tagInput=String(query.tag||query.tags).split(',').map(t=>t.trim().toLowerCase()).filter(Boolean);
    if(tagInput.length===1)filter.tags=tagInput[0];
    else if(tagInput.length>1)filter.tags={$all:tagInput};
  }

  if(query.createdFrom||query.createdTo){filter.createdAt={};if(query.createdFrom){const d=new Date(query.createdFrom);if(Number.isNaN(d.valueOf()))throw fail('Invalid start date.');filter.createdAt.$gte=d;}if(query.createdTo){const d=new Date(query.createdTo);if(Number.isNaN(d.valueOf()))throw fail('Invalid end date.');d.setUTCHours(23,59,59,999);filter.createdAt.$lte=d;}if(filter.createdAt.$gte&&filter.createdAt.$lte&&filter.createdAt.$gte>filter.createdAt.$lte)throw fail('Start date must be before end date.');}
  if(query.lastContactedFrom||query.lastContactedTo){filter.lastContactedAt={};if(query.lastContactedFrom){const d=new Date(query.lastContactedFrom);if(Number.isNaN(d.valueOf()))throw fail('Invalid last-contacted start date.');filter.lastContactedAt.$gte=d;}if(query.lastContactedTo){const d=new Date(query.lastContactedTo);if(Number.isNaN(d.valueOf()))throw fail('Invalid last-contacted end date.');d.setUTCHours(23,59,59,999);filter.lastContactedAt.$lte=d;}if(filter.lastContactedAt.$gte&&filter.lastContactedAt.$lte&&filter.lastContactedAt.$gte>filter.lastContactedAt.$lte)throw fail('Last-contacted start date must be before end date.');}
  
  const search=typeof query.search==='string'?query.search.trim().slice(0,100):'';
  if(search){
    const re=new RegExp(escapeRegExp(search),'i');
    const searchConditions=['fullName','phoneNumber','whatsappNumber','email','companyName','businessCategory','businessSubcategory','interestedService','location','city','interestedProject','preferredLocation','state'].map(field=>({[field]:re}));
    searchConditions.push({tags:re});
    filter.$and=filter.$and?filter.$and:[];
    filter.$and.push({$or:searchConditions});
  }
  return filter;
}

function pagination(req){const page=parseIntParam(req.query.page,1,1,1000000),limit=parseIntParam(req.query.limit,25,1,MAX_PAGE_SIZE);return {page,limit,skip:(page-1)*limit};}
function sortSpec(query){const allowed=['createdAt','updatedAt','fullName','companyName','leadStatus','priority','lastContactedAt','estimatedDealValue'];const sort=allowed.includes(query.sort)?query.sort:'createdAt';const direction=query.direction==='asc'?1:-1;return {[sort]:direction,_id:direction};}
async function contactsForExport(req){const filter=buildContactFilter(req.user._id,req.query,req.workspaceId);if(req.query.ids){const ids=String(req.query.ids).split(',').filter(Boolean);if(!ids.length||ids.length>MAX_BULK||ids.some(id=>!validId(id)))throw fail(`Select between 1 and ${MAX_BULK} valid contacts.`);filter._id={$in:ids};}return Contact.find(filter).sort(sortSpec(req.query)).lean();}

export async function listContacts(req,res){
  const filter=buildContactFilter(req.user._id,req.query,req.workspaceId);
  const {page,limit,skip}=pagination(req);
  const sort=sortSpec(req.query);
  const [records,total]=await Promise.all([
    Contact.find(filter).populate('groups','name color').sort(sort).skip(skip).limit(limit).lean(),
    Contact.countDocuments(filter)
  ]);
  res.json({records,total,page,pageSize:limit,totalPages:Math.ceil(total/limit)});
}

export async function getOwnerContactStats(userId, workspaceId = null){
  const ownerId = new mongoose.Types.ObjectId(userId);
  const targetWsId = workspaceId && mongoose.isObjectIdOrHexString(workspaceId)
    ? new mongoose.Types.ObjectId(workspaceId)
    : null;
  // Mirrors buildContactFilter/tenantScope: active workspace AND the signed-in author.
  const matchFilter = targetWsId
    ? { workspaceId: targetWsId, ownerId, isDeleted: false }
    : { ownerId, isDeleted: false };
  const consentMatch = targetWsId
    ? { workspaceId: targetWsId, ownerId }
    : { ownerId };

  const [counts,latest,growth]=await Promise.all([
    Contact.aggregate([
      {$match: matchFilter},
      {$group:{
        _id:null,
        total:{$sum:1},
        newLeads:{$sum:{$cond:[{$eq:['$leadStatus','New']},1,0]}},
        interestedLeads:{$sum:{$cond:[{$eq:['$leadStatus','Interested']},1,0]}},
        convertedLeads:{$sum:{$cond:[{$eq:['$leadStatus','Converted']},1,0]}},
        optedOut:{$sum:{$cond:[{$eq:['$whatsappConsentStatus','Opted Out']},1,0]}},
        consentUnknown:{$sum:{$cond:[{$eq:['$whatsappConsentStatus','Unknown']},1,0]}},
        suppressed:{$sum:{$cond:[{$eq:['$isSuppressed',true]},1,0]}},
        demoCount:{$sum:{$cond:[{$eq:['$isDemo',true]},1,0]}},
        missingRequired:{$sum:{$cond:[{$or:[{$eq:['$fullName','']},{$eq:['$phoneNumber','']}]},1,0]}}
      }}
    ]),
    ConsentRecord.aggregate([
      {$match: consentMatch},
      {$sort:{recordedAt:-1,_id:-1}},
      {$group:{_id:'$contactId',record:{$first:'$$ROOT'}}},
      {$match:{
        'record.status':'Opted In',
        'record.consentPurpose':{$type:'string',$ne:''},
        'record.consentSource':{$type:'string',$ne:''},
        'record.evidenceReference':{$type:'string',$ne:''},
        'record.consentCapturedAt':{$type:'date'}
      }},
      {$lookup:{
        from:Contact.collection.name,
        let:{cid:'$_id'},
        pipeline:[
          {$match:{
            $expr:{
              $and:[
                {$eq:['$_id','$$cid']},
                targetWsId ? {$and:[{$eq:['$workspaceId', targetWsId]},{$eq:['$ownerId', ownerId]}]} : {$eq:['$ownerId', ownerId]},
                {$eq:['$isDeleted',false]},
                {$eq:['$isArchived',false]},
                {$eq:['$whatsappConsentStatus','Opted In']},
                {$ne:['$isSuppressed',true]}
              ]
            }
          }}
        ],
        as:'contact'
      }},
      {$match:{'contact.0':{$exists:true}}},
      {$count:'total'}
    ]),
    Contact.aggregate([
      {$match:{ ...matchFilter, createdAt:{$gte:new Date(Date.now()-30*24*60*60*1000)}}},
      {$group:{_id:{$dateTrunc:{date:'$createdAt',unit:'day'}},contacts:{$sum:1}}},
      {$sort:{_id:1}},
      {$project:{_id:0,day:{$dateToString:{format:'%b %d',date:'$_id'}},contacts:1}}
    ])
  ]);
  return {
    totalContacts:counts[0]?.total||0,
    newLeads:counts[0]?.newLeads||0,
    interestedLeads:counts[0]?.interestedLeads||0,
    convertedLeads:counts[0]?.convertedLeads||0,
    eligibleWhatsAppContacts:latest[0]?.total||0,
    optedOutContacts:counts[0]?.optedOut||0,
    unknownConsentContacts:counts[0]?.consentUnknown||0,
    suppressedContacts:counts[0]?.suppressed||0,
    demoContacts:counts[0]?.demoCount||0,
    missingRequiredCount:counts[0]?.missingRequired||0,
    contactGrowth:growth
  };
}

export async function contactStats(req,res){
  const wsId = req.workspace?._id || req.headers?.['x-workspace-id'] || null;
  res.json({stats:await getOwnerContactStats(req.user._id, wsId)});
}

export async function getContact(req,res){
  const id=parseId(req.params.id);
  const contact=await Contact.findOne({_id:id,...tenantScope(req),isDeleted:false})
    .populate('groups','name color description')
    .lean();
  if(!contact)return res.status(404).json({message:'Contact not found.'});
  const [consentHistory,activities]=await Promise.all([
    ConsentRecord.find({...tenantScope(req),contactId:id}).sort({recordedAt:-1}).lean(),
    ContactActivity.find({...tenantScope(req),contactId:id}).sort({createdAt:-1}).limit(100).lean()
  ]);
  res.json({contact,consentHistory,activities});
}

export async function createContact(req,res){
  const {consent,...contactPayload}=req.body||{};
  const data=cleanContactInput(contactPayload);
  if (data.groups?.length && await ContactGroup.countDocuments({ ...await legacyWorkspaceScope(req), _id: { $in: data.groups } }) !== new Set(data.groups.map(String)).size) throw fail('One or more contact groups are unavailable in this workspace.');
  if (data.industryData) {
    const { sanitized, canonicalUpdates } = validateAndSanitizeIndustryData(data.industryData, req.workspace?.industryKey);
    data.industryData = sanitized;
    Object.assign(data, canonicalUpdates);
  }
  if(consent!==undefined&&(!consent||typeof consent!=='object'||Array.isArray(consent)))throw fail('Consent details must be an object.');
  const status=consent?.status||'Unknown';
  if(!CONSENT_STATUSES.includes(status))throw fail('Choose a valid WhatsApp consent status.');
  if(status==='Opted In')validateOptIn(consent);
  const phoneNumber=data.phoneNumber;
  const duplicate=await Contact.findOne({...tenantScope(req),phoneNumber});
  if(duplicate)throw fail('A contact with this phone number already exists in your account.',409);
  Object.assign(data,tenantScope(req));
  data.whatsappNumber=phoneNumber;
  data.whatsappConsentStatus='Unknown';
  const contact=await Contact.create(data);
  try{
    if(consent&&consent.status&&consent.status!=='Unknown'){
      await recordConsent(contact,req.user._id,{...consent,status});
    }
    await addActivity(contact,req.user._id,'created','Contact created');
    await scoreContact(req.user._id,contact._id);
    if(data.groups?.length){
      await ContactGroup.updateMany({_id:{$in:data.groups},...tenantScope(req)},{$inc:{contactCount:1}});
    }
  }catch(error){
    await Promise.all([
      Contact.deleteOne({_id:contact._id,...tenantScope(req)}),
      ConsentRecord.deleteMany({...tenantScope(req),contactId:contact._id}),
      ContactActivity.deleteMany({...tenantScope(req),contactId:contact._id})
    ]);
    throw error;
  }
  const created=await Contact.findById(contact._id).populate('groups','name color').lean();
  res.status(201).json({contact:created});
}

function validateOptIn(consent){
  for(const key of ['consentSource','consentPurpose','evidenceReference'])if(typeof consent[key]!=='string'||!consent[key].trim())throw fail(`A genuine affirmative opt-in requires ${key.replace(/([A-Z])/g,' $1').toLowerCase()}.`);
  const captured=new Date(consent.consentCapturedAt);
  if(!consent.consentCapturedAt||Number.isNaN(captured.valueOf())||captured>new Date())throw fail('Provide a valid date and time when consent was captured.');
  if(consent.evidenceReference.trim().length>1000)throw fail('Supporting evidence reference is too long.');
}

async function recordConsent(contact,userId,details){
  const status=details.status;
  const optIn=status==='Opted In';
  if(optIn)validateOptIn(details);
  const purpose=typeof details.consentPurpose==='string'&&details.consentPurpose.trim()?details.consentPurpose.trim():`WhatsApp consent ${status.toLowerCase()}`;
  const source=typeof details.consentSource==='string'&&details.consentSource.trim()?details.consentSource.trim():'User recorded';
  const record=await ConsentRecord.create({
    ownerId:contact.ownerId,
    workspaceId:contact.workspaceId,
    contactId:contact._id,
    status,
    consentPurpose:purpose,
    consentedBusinessName:typeof details.consentedBusinessName==='string'?details.consentedBusinessName.trim().slice(0,120):'',
    consentSource:source,
    evidenceReference:optIn?details.evidenceReference.trim():'',
    consentCapturedAt:optIn?new Date(details.consentCapturedAt):new Date(),
    recordedBy:userId
  });
  const previous=contact.whatsappConsentStatus;
  contact.whatsappConsentStatus=status;
  if(status==='Opted Out'){
    contact.isSuppressed=true;
    contact.suppressedAt=new Date();
    contact.suppressionReason=details.suppressionReason||details.consentPurpose||'Opted out via consent record';
  }else if(status==='Opted In'){
    contact.isSuppressed=false;
    contact.suppressedAt=null;
    contact.suppressionReason='';
  }
  await contact.save();
  await addActivity(contact,userId,'consent_changed',`WhatsApp consent changed from ${previous} to ${status}`,{from:previous,to:status,consentRecordId:record._id});
  return record;
}

export async function updateConsent(req,res){
  const id=parseId(req.params.id);
  const contact=await Contact.findOne({_id:id,...tenantScope(req),isDeleted:false});
  if(!contact)return res.status(404).json({message:'Contact not found.'});
  const {status}=req.body||{};
  if(!CONSENT_STATUSES.includes(status))throw fail('Choose a valid WhatsApp consent status.');
  const record=await recordConsent(contact,req.user._id,req.body);
  res.status(201).json({contact,consentRecord:record});
}

export async function getConsent(req,res){
  const id=parseId(req.params.id);
  const contact=await Contact.findOne({_id:id,...tenantScope(req),isDeleted:false}).select('whatsappConsentStatus isSuppressed suppressionReason suppressedAt fullName phoneNumber').lean();
  if(!contact)return res.status(404).json({message:'Contact not found.'});
  const consentHistory=await ConsentRecord.find({...tenantScope(req),contactId:id}).sort({recordedAt:-1}).lean();
  res.json({
    status:contact.whatsappConsentStatus,
    isSuppressed:Boolean(contact.isSuppressed),
    suppressionReason:contact.suppressionReason||'',
    suppressedAt:contact.suppressedAt,
    consentHistory
  });
}

export async function getEligibility(req,res){
  const id=parseId(req.params.id);
  const contact=await Contact.findOne({_id:id,...tenantScope(req),isDeleted:false}).lean();
  if(!contact)return res.status(404).json({message:'Contact not found.'});
  const reasons=[];
  if(contact.isArchived)reasons.push('Contact is archived');
  if(contact.isDeleted)reasons.push('Contact is soft-deleted');
  if(contact.isSuppressed)reasons.push(`Contact is suppressed / Do Not Contact (${contact.suppressionReason||'Unspecified'})`);
  if(contact.isDemo && process.env.NODE_ENV === 'production')reasons.push('Demo contact fixture is strictly ineligible for real WhatsApp messaging in production');
  if(contact.whatsappConsentStatus!=='Opted In')reasons.push(`Consent status is ${contact.whatsappConsentStatus} (affirmative Opted In required)`);
  
  const latestOptIn=await ConsentRecord.findOne({
    ...tenantScope(req),
    contactId:id,
    status:'Opted In',
    consentPurpose:{$type:'string',$ne:''},
    consentSource:{$type:'string',$ne:''},
    evidenceReference:{$type:'string',$ne:''},
    consentCapturedAt:{$type:'date'}
  }).sort({recordedAt:-1}).lean();
  
  if(contact.whatsappConsentStatus==='Opted In'&&!latestOptIn){
    reasons.push('No valid affirmative consent record with auditable evidence on file');
  }
  
  const eligible=reasons.length===0;
  res.json({
    contactId:id,
    eligible,
    reasons,
    eligibility:{
      eligible,
      reasons
    },
    whatsappConsentStatus:contact.whatsappConsentStatus,
    isSuppressed:Boolean(contact.isSuppressed),
    isDemo:Boolean(contact.isDemo),
    evidenceOnRecord:Boolean(latestOptIn)
  });
}

export async function updateContact(req,res){
  const id=parseId(req.params.id);
  const data=cleanContactInput(req.body,{partial:true});
  if (data.groups?.length && await ContactGroup.countDocuments({ ...await legacyWorkspaceScope(req), _id: { $in: data.groups } }) !== new Set(data.groups.map(String)).size) throw fail('One or more contact groups are unavailable in this workspace.');
  if(!Object.keys(data).length)return res.status(400).json({message:'Provide at least one field to update.'});
  if(data.countryCode&&!data.phoneNumber)throw fail('Update country and phone number together.');
  const contact=await Contact.findOne({_id:id,...tenantScope(req),isDeleted:false});
  if(!contact)return res.status(404).json({message:'Contact not found.'});
  if (data.industryData) {
    const { sanitized, canonicalUpdates } = validateAndSanitizeIndustryData(data.industryData, req.workspace?.industryKey);
    data.industryData = { ...contact.industryData, ...sanitized };
    Object.assign(data, canonicalUpdates);
  }

  if(data.phoneNumber){
    const duplicate=await Contact.findOne({...tenantScope(req),phoneNumber:data.phoneNumber,_id:{$ne:id}}).select('_id').lean();
    if(duplicate)throw fail('A contact with this phone number already exists in your account.',409);
    data.whatsappNumber=data.phoneNumber;
  }
  
  // Track group updates to maintain accurate group counts
  if(data.groups!==undefined){
    const oldGroupIds=(contact.groups||[]).map(String);
    const newGroupIds=(data.groups||[]).map(String);
    const added=newGroupIds.filter(g=>!oldGroupIds.includes(g));
    const removed=oldGroupIds.filter(g=>!newGroupIds.includes(g));
    if(added.length)await ContactGroup.updateMany({_id:{$in:added},...tenantScope(req)},{$inc:{contactCount:1}});
    if(removed.length)await ContactGroup.updateMany({_id:{$in:removed},...tenantScope(req)},{$inc:{contactCount:-1}});
  }

  const changes={};
  for(const [key,value] of Object.entries(data)){
    const before=contact[key];
    if(JSON.stringify(before)===JSON.stringify(value))continue;
    changes[key]={from:before??null,to:value};
    contact[key]=value;
  }
  if(!Object.keys(changes).length){
    const refreshed=await Contact.findById(contact._id).populate('groups','name color').lean();
    return res.json({contact:refreshed});
  }
  await contact.save();
  const significant=[];
  if(changes.businessCategory||changes.interestedProject)significant.push(['category_changed',`Project/Category changed to ${contact.interestedProject||contact.businessCategory||'Uncategorized'}`,{project:contact.interestedProject||contact.businessCategory}]);
  if(changes.leadStatus)significant.push(['status_changed',`Lead status changed to ${contact.leadStatus}`,{leadStatus:changes.leadStatus}]);
  if(changes.priority)significant.push(['priority_changed',`Priority changed to ${contact.priority}`,{priority:changes.priority}]);
  if(changes.notes)significant.push(['notes_updated','Notes updated',{notes:changes.notes}]);
  const logged=significant.length?significant:[['edited','Contact details updated',changes]];
  await Promise.all(logged.map(([type,description,fields])=>addActivity(contact,req.user._id,type,description,fields)));
  if(changes.leadStatus?.to==='Converted')await recordConvertedContact(contact,req.user._id);
  await scoreContact(req.user._id,contact._id);
  const updated=await Contact.findById(contact._id).populate('groups','name color').lean();
  res.json({contact:updated});
}

export async function archiveContact(req,res){return setArchived(req,res,true);}
export async function restoreContact(req,res){return setArchived(req,res,false);}

async function setArchived(req,res,archived){
  const id=parseId(req.params.id);
  const contact=await Contact.findOneAndUpdate(
    {_id:id,...tenantScope(req),isDeleted:false},
    {$set:{isArchived:archived,archivedAt:archived?new Date():null}},
    {new:true,runValidators:true}
  );
  if(!contact)return res.status(404).json({message:'Contact not found.'});
  await addActivity(contact,req.user._id,archived?'archived':'restored',archived?'Contact archived':'Contact restored');
  res.json({contact});
}

export async function softDeleteContact(req,res){
  const id=parseId(req.params.id);
  const contact=await Contact.findOneAndUpdate(
    {_id:id,...tenantScope(req),isDeleted:false},
    {$set:{isDeleted:true,deletedAt:new Date()}},
    {new:true}
  );
  if(!contact)return res.status(404).json({message:'Contact not found.'});
  if(contact.groups?.length){
    await ContactGroup.updateMany({_id:{$in:contact.groups},...tenantScope(req)},{$inc:{contactCount:-1}});
  }
  await addActivity(contact,req.user._id,'deleted','Contact moved to deleted records');
  res.json({message:'Contact deleted.'});
}

export async function bulkContacts(req,res){
  const {ids,action,value}=req.body||{};
  if(!Array.isArray(ids)||ids.length<1||ids.length>MAX_BULK||ids.some(id=>!validId(id)))throw fail(`Select between 1 and ${MAX_BULK} valid contacts.`);
  const uniqueIds=[...new Set(ids)];
  const filter={_id:{$in:uniqueIds},...tenantScope(req),isDeleted:false};
  const contacts=await Contact.find(filter);
  if(!contacts.length)return res.status(404).json({message:'No matching contacts were found.'});
  
  let set={},activityType='edited',description='Contacts updated';
  if(action==='status'){
    if(!LEAD_STATUSES.includes(value))throw fail('Choose a valid lead status.');
    set={leadStatus:value};
    activityType='status_changed';
    description=`Lead status changed to ${value}`;
  }else if(action==='category'){
    if(typeof value!=='string'||!value.trim()||value.trim().length>80)throw fail('Choose a valid business category.');
    set={businessCategory:value.trim(),interestedProject:value.trim()};
    activityType='category_changed';
    description=`Business category changed to ${value.trim()}`;
  }else if(action==='priority'){
    if(!PRIORITIES.includes(value))throw fail('Choose a valid priority.');
    set={priority:value};
    activityType='priority_changed';
    description=`Priority changed to ${value}`;
  }else if(action==='addTags'){
    if(!Array.isArray(value)||!value.length||value.length>20||value.some(t=>typeof t!=='string'||t.trim().length>40))throw fail('Provide up to 20 valid tags.');
    const tags=[...new Set(value.map(t=>t.trim().toLowerCase()).filter(Boolean))];
    for(const c of contacts)c.tags=[...new Set([...c.tags,...tags])];
    await Promise.all(contacts.map(c=>c.save()));
    description='Tags added';
  }else if(action==='removeTags'){
    if(!Array.isArray(value)||!value.length||value.some(t=>typeof t!=='string'))throw fail('Provide valid tags to remove.');
    const tagsToRemove=value.map(t=>t.trim().toLowerCase());
    for(const c of contacts)c.tags=c.tags.filter(t=>!tagsToRemove.includes(t));
    await Promise.all(contacts.map(c=>c.save()));
    description='Tags removed';
  }else if(action==='addToGroup'){
    if(!validId(value))throw fail('Valid group ID is required.');
    const group=await ContactGroup.findOne({_id:value,...await legacyWorkspaceScope(req)});
    if(!group)throw fail('Contact group not found.',404);
    await Contact.updateMany(filter,{$addToSet:{groups:group._id}});
    const newCount=await Contact.countDocuments({...tenantScope(req),groups:group._id,isDeleted:false});
    group.contactCount=newCount;
    await group.save();
    description=`Added to group ${group.name}`;
  }else if(action==='removeFromGroup'){
    if(!validId(value))throw fail('Valid group ID is required.');
    const group=await ContactGroup.findOne({_id:value,...await legacyWorkspaceScope(req)});
    if(!group)throw fail('Contact group not found.',404);
    await Contact.updateMany(filter,{$pull:{groups:group._id}});
    const newCount=await Contact.countDocuments({...tenantScope(req),groups:group._id,isDeleted:false});
    group.contactCount=newCount;
    await group.save();
    description=`Removed from group ${group.name}`;
  }else if(action==='suppress'){
    set={isSuppressed:true,suppressionReason:String(value||'Bulk suppression').slice(0,250),suppressedAt:new Date()};
    activityType='suppressed';
    description='Contacts marked Do Not Contact';
  }else if(action==='unsuppress'){
    set={isSuppressed:false,suppressionReason:'',suppressedAt:null};
    activityType='unsuppressed';
    description='Suppression removed';
  }else if(action==='archive'||action==='restore'){
    set={isArchived:action==='archive',archivedAt:action==='archive'?new Date():null};
    activityType=action==='archive'?'archived':'restored';
    description=action==='archive'?'Contacts archived':'Contacts restored';
  }else if(action==='delete'){
    set={isDeleted:true,deletedAt:new Date()};
    activityType='deleted';
    description='Contacts moved to deleted records';
  }else throw fail('Choose a valid bulk action.');

  if(Object.keys(set).length)await Contact.updateMany(filter,{$set:set},{runValidators:true});
  const activities=contacts.map(c=>activityFor(c,req.user._id,activityType,description,{...(action==='category'?{businessCategory:{from:c.businessCategory,to:value}}:{})}));
  await ContactActivity.insertMany(activities);
  if(action==='status'&&value==='Converted'){for(const c of contacts)c.leadStatus=value;}
  await Promise.all(contacts.map(async c=>{
    if(action==='status'&&value==='Converted')await recordConvertedContact(c,req.user._id);
    await scoreContact(req.user._id,c._id);
  }));
  res.json({updatedCount:contacts.length,action});
}

export async function listTags(req,res){
  const tags=await Contact.aggregate([
    {$match:{...tenantScope(req),isDeleted:false}},
    {$unwind:'$tags'},
    {$group:{_id:'$tags',count:{$sum:1}}},
    {$sort:{count:-1,_id:1}}
  ]);
  res.json({tags:tags.map(t=>({name:t._id,count:t.count}))});
}

export async function createTag(req,res){
  const name=String(req.body?.name||'').trim().toLowerCase();
  if(!name||name.length>40)throw fail('Tag name must be 1–40 characters.');
  res.status(201).json({tag:{name,count:0}});
}

export async function renameTag(req,res){
  const oldTag=String(req.params.tag||req.body?.oldName||req.body?.oldTag||'').trim().toLowerCase();
  const newTag=String(req.body?.name||req.body?.newName||req.body?.newTag||'').trim().toLowerCase();
  if(!oldTag||!newTag||newTag.length>40)throw fail('Provide valid tag names (up to 40 characters).');
  
  // Step 1: Add new tag to matching contacts
  await Contact.updateMany(
    {...tenantScope(req),tags:oldTag},
    {$addToSet:{tags:newTag}}
  );
  
  // Step 2: Remove old tag from contacts
  const result=await Contact.updateMany(
    {...tenantScope(req),tags:oldTag},
    {$pull:{tags:oldTag}}
  );
  
  res.json({message:`Tag renamed from ${oldTag} to ${newTag}`,modifiedCount:result.modifiedCount});
}

export async function deleteTag(req,res){
  const tag=String(req.params.tag||req.query.name||req.body?.name||'').trim().toLowerCase();
  if(!tag)throw fail('Tag name is required.');
  const result=await Contact.updateMany(
    {...tenantScope(req),tags:tag},
    {$pull:{tags:tag}}
  );
  res.json({message:`Tag ${tag} removed from contacts.`,modifiedCount:result.modifiedCount});
}

function safeCell(value){
  let text=value==null?'':value instanceof Date?value.toISOString():Array.isArray(value)?value.join(', '):String(value);
  if(/^[\s\u0000-\u001f]*[=+@\-]/.test(text))text=`'${text}`;
  return text;
}

const EXPORT_COLUMNS=[
  ['fullName','Full name'],
  ['phoneNumber','Phone number'],
  ['alternatePhone','Alternate phone'],
  ['email','Email'],
  ['city','City'],
  ['state','State'],
  ['preferredLocation','Preferred location'],
  ['interestedService','Property interest'],
  ['interestedProject','Interested project'],
  ['budgetRange','Budget range'],
  ['companyName','Company'],
  ['designation','Designation'],
  ['website','Website'],
  ['leadSource','Enquiry source'],
  ['leadStatus','Lead status'],
  ['priority','Priority'],
  ['estimatedDealValue','Estimated deal value'],
  ['currency','Currency'],
  ['whatsappConsentStatus','WhatsApp consent'],
  ['isSuppressed','Do Not Contact'],
  ['tags','Tags'],
  ['notes','Notes'],
  ['createdAt','Created at'],
  ['updatedAt','Updated at']
];

export async function exportContacts(req,res){
  const records=await contactsForExport(req);
  const format=String(req.query.format||'csv').toLowerCase();
  if(!['csv','xlsx'].includes(format))throw fail('Export format must be csv or xlsx.');
  if(format==='csv'){
    const lines=[
      EXPORT_COLUMNS.map(([,h])=>csvCell(h)).join(','),
      ...records.map(record=>EXPORT_COLUMNS.map(([k])=>csvCell(safeCell(record[k]))).join(','))
    ];
    res.setHeader('Content-Type','text/csv; charset=utf-8');
    res.setHeader('Content-Disposition','attachment; filename="relay-contacts.csv"');
    return res.send(`\uFEFF${lines.join('\r\n')}`);
  }
  const workbook=new ExcelJS.Workbook();
  const sheet=workbook.addWorksheet('Contacts');
  sheet.columns=EXPORT_COLUMNS.map(([key,header])=>({header,key,width:Math.min(32,Math.max(14,header.length+2))}));
  for(const record of records){
    const row={};
    for(const [key] of EXPORT_COLUMNS)row[key]=safeCell(record[key]);
    sheet.addRow(row);
  }
  sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};
  sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF10251F'}};
  sheet.views=[{state:'frozen',ySplit:1}];
  const buffer=await workbook.xlsx.writeBuffer();
  res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition','attachment; filename="relay-contacts.xlsx"');
  res.send(Buffer.from(buffer));
}

function csvCell(value){const text=String(value??'');return `"${text.replace(/"/g,'""')}"`;}

export async function contactActivity(req,res){
  const id=parseId(req.params.id);
  const exists=await Contact.exists({_id:id,...tenantScope(req),isDeleted:false});
  if(!exists)return res.status(404).json({message:'Contact not found.'});
  const activities=await ContactActivity.find({...tenantScope(req),contactId:id}).sort({createdAt:-1}).limit(200).lean();
  res.json({activities});
}

