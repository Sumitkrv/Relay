import mongoose from 'mongoose';
import Contact from '../models/Contact.js';
import ContactGroup from '../models/ContactGroup.js';
import ImportJob from '../models/ImportJob.js';
import AudienceSegment from '../models/AudienceSegment.js';
import AudienceSegmentMember from '../models/AudienceSegmentMember.js';
import CampaignAudience from '../models/CampaignAudience.js';

export const MAX_CAMPAIGN_MEMBERS=100000;
const MAX_MANUAL_SELECTION=5000;
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const oid=id=>mongoose.isObjectIdOrHexString(id);
const escape=value=>String(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const bounded=(value,max=160)=>{if(typeof value!=='string')throw fail('Audience filter values must be text.');return value.trim().slice(0,max);};

const ALLOWED_RULE_FIELDS=['city','location','propertyInterest','interestedPropertyType','service','project','businessCategory','interestedProject','budget','budgetRange','estimatedDealValue','tags','tag','source','leadSource','status','leadStatus','priority','consent','consentStatus','whatsappConsentStatus','group','groupId','isSuppressed','isDemo','createdDate','createdAt'];
const ALLOWED_RULE_OPS=['equals','notEquals','contains','inList','isEmpty','isNotEmpty','greaterThan','lessThan'];

export function cleanAudienceFilters(source={}){
  if(!source||typeof source!=='object'||Array.isArray(source))throw fail('Audience filters must be an object.');
  
  // If structured rules provided
  if(Array.isArray(source.conditions)){
    if(source.conditions.length>20)throw fail('Structured rules support up to 20 conditions.');
    const conjunction=String(source.conjunction||'AND').toUpperCase()==='OR'?'OR':'AND';
    const cleanConditions=[];
    for(const c of source.conditions){
      if(!c||typeof c!=='object')throw fail('Each filter condition must be an object.');
      const field=String(c.field||'').trim();
      const op=String(c.operator||'').trim();
      if(!ALLOWED_RULE_FIELDS.includes(field))throw fail(`Unsupported condition field: ${field}`);
      if(!ALLOWED_RULE_OPS.includes(op))throw fail(`Unsupported condition operator: ${op}`);
      let val=c.value;
      if(['isEmpty','isNotEmpty'].includes(op)){
        val=null;
      }else if(op==='inList'){
        if(Array.isArray(val))val=val.map(v=>String(v).trim().slice(0,100)).filter(Boolean);
        else val=String(val||'').split(',').map(v=>v.trim().slice(0,100)).filter(Boolean);
      }else if(['greaterThan','lessThan'].includes(op)){
        const n=Number(val);
        if(!Number.isFinite(n))throw fail(`Numeric value required for ${op} condition.`);
        val=n;
      }else{
        val=String(val==null?'':val).trim().slice(0,120);
      }
      cleanConditions.push({field,operator:op,value:val});
    }
    return {conjunction,conditions:cleanConditions,archived:String(source.archived||'false')};
  }

  // Legacy flat filters
  const allowed=['businessCategory','subcategory','industry','service','propertyInterest','interestedPropertyType','city','location','project','interestedProject','source','status','priority','batchId','tag','tags','createdFrom','createdTo','lastContactedFrom','lastContactedTo','consent','consentStatus','archived','search','group','budgetMin','budgetMax','budgetRange'];
  const unknown=Object.keys(source).find(k=>!allowed.includes(k));if(unknown)throw fail(`Unsupported audience filter: ${unknown}`);
  const f={};for(const key of ['businessCategory','subcategory','industry','service','propertyInterest','interestedPropertyType','project','interestedProject','source','status','priority','consent','consentStatus','budgetRange'])if(source[key])f[key]=bounded(source[key],120);
  for(const key of ['city','location','tag','tags','search'])if(source[key])f[key]=bounded(source[key],120);
  if(source.batchId){if(!oid(source.batchId))throw fail('Import batch ID is invalid.');f.batchId=String(source.batchId);}
  if(source.group){if(!oid(source.group))throw fail('Group ID is invalid.');f.group=String(source.group);}
  for(const key of ['createdFrom','createdTo','lastContactedFrom','lastContactedTo'])if(source[key]){const d=new Date(source[key]);if(Number.isNaN(d.valueOf()))throw fail(`Invalid ${key} date.`);f[key]=d.toISOString();}
  if(source.budgetMin!=null&&source.budgetMin!==''){const n=Number(source.budgetMin);if(!Number.isNaN(n))f.budgetMin=n;}
  if(source.budgetMax!=null&&source.budgetMax!==''){const n=Number(source.budgetMax);if(!Number.isNaN(n))f.budgetMax=n;}
  if(source.archived!==undefined&&!['true','false','all'].includes(String(source.archived)))throw fail('Archived filter must be true, false, or all.');
  f.archived=String(source.archived||'false');
  if(f.createdFrom&&f.createdTo&&f.createdFrom>f.createdTo)throw fail('Created date range is invalid.');
  if(f.lastContactedFrom&&f.lastContactedTo&&f.lastContactedFrom>f.lastContactedTo)throw fail('Last contacted date range is invalid.');
  return f;
}

function conditionToMongoClause(c){
  const {field,operator,value}=c;

  // Handle city / location
  if(['city','location'].includes(field)){
    if(operator==='isEmpty')return {$and:[{city:{$in:[null,'']}},{location:{$in:[null,'']}}]};
    if(operator==='isNotEmpty')return {$or:[{city:{$nin:[null,'']}},{location:{$nin:[null,'']}}]};
    const re = operator==='contains' ? new RegExp(escape(value),'i') : new RegExp(`^${escape(value)}$`,'i');
    if(operator==='notEquals')return {$and:[{city:{$not:re}},{location:{$not:re}}]};
    if(operator==='inList')return {$or:[{city:{$in:value.map(v=>new RegExp(`^${escape(v)}$`,'i'))}},{location:{$in:value.map(v=>new RegExp(`^${escape(v)}$`,'i'))}}]};
    return {$or:[{city:re},{location:re}]};
  }

  // Handle propertyInterest / interestedPropertyType / service
  if(['propertyInterest','interestedPropertyType','service'].includes(field)){
    if(operator==='isEmpty')return {$and:[{interestedPropertyType:{$in:[null,'']}},{interestedService:{$in:[null,'']}}]};
    if(operator==='isNotEmpty')return {$or:[{interestedPropertyType:{$nin:[null,'']}},{interestedService:{$nin:[null,'']}}]};
    const re = operator==='contains' ? new RegExp(escape(value),'i') : new RegExp(`^${escape(value)}$`,'i');
    if(operator==='notEquals')return {$and:[{interestedPropertyType:{$not:re}},{interestedService:{$not:re}}]};
    if(operator==='inList')return {$or:[{interestedPropertyType:{$in:value.map(v=>new RegExp(`^${escape(v)}$`,'i'))}},{interestedService:{$in:value.map(v=>new RegExp(`^${escape(v)}$`,'i'))}}]};
    return {$or:[{interestedPropertyType:re},{interestedService:re}]};
  }

  // Handle project / interestedProject / businessCategory
  if(['project','interestedProject','businessCategory'].includes(field)){
    if(operator==='isEmpty')return {$and:[{interestedProject:{$in:[null,'']}},{businessCategory:{$in:[null,'']}}]};
    if(operator==='isNotEmpty')return {$or:[{interestedProject:{$nin:[null,'']}},{businessCategory:{$nin:[null,'']}}]};
    const re = operator==='contains' ? new RegExp(escape(value),'i') : new RegExp(`^${escape(value)}$`,'i');
    if(operator==='notEquals')return {$and:[{interestedProject:{$not:re}},{businessCategory:{$not:re}}]};
    if(operator==='inList')return {$or:[{interestedProject:{$in:value.map(v=>new RegExp(`^${escape(v)}$`,'i'))}},{businessCategory:{$in:value.map(v=>new RegExp(`^${escape(v)}$`,'i'))}}]};
    return {$or:[{interestedProject:re},{businessCategory:re}]};
  }

  let targetPath=field;
  if(['budget','estimatedDealValue'].includes(field))targetPath='estimatedDealValue';
  else if(field==='budgetRange')targetPath='budgetRange';
  else if(['source','leadSource'].includes(field))targetPath='leadSource';
  else if(['status','leadStatus'].includes(field))targetPath='leadStatus';
  else if(['consent','consentStatus','whatsappConsentStatus'].includes(field))targetPath='whatsappConsentStatus';
  else if(['tags','tag'].includes(field))targetPath='tags';
  else if(['group','groupId'].includes(field))targetPath='groups';

  if(operator==='isEmpty')return {[targetPath]:{$in:[null,'']}};
  if(operator==='isNotEmpty')return {[targetPath]:{$nin:[null,'']}};
  if(operator==='greaterThan')return {[targetPath]:{$gt:value}};
  if(operator==='lessThan')return {[targetPath]:{$lt:value}};
  if(operator==='inList'){
    if(targetPath==='groups')return {[targetPath]:{$in:value.filter(oid).map(id=>new mongoose.Types.ObjectId(id))}};
    return {[targetPath]:{$in:value.map(v=>new RegExp(`^${escape(v)}$`,'i'))}};
  }
  if(operator==='contains')return {[targetPath]:new RegExp(escape(value),'i')};
  if(operator==='notEquals'){
    if(targetPath==='groups'&&oid(value))return {[targetPath]:{$ne:new mongoose.Types.ObjectId(value)}};
    return {[targetPath]:{$not:new RegExp(`^${escape(value)}$`,'i')}};
  }
  // Default 'equals'
  if(targetPath==='groups'&&oid(value))return {[targetPath]:new mongoose.Types.ObjectId(value)};
  if(targetPath==='isSuppressed'||targetPath==='isDemo')return {[targetPath]:String(value)==='true'};
  return {[targetPath]:new RegExp(`^${escape(value)}$`,'i')};
}

export function buildAudienceFilter(ownerId,raw={}){
  const f=cleanAudienceFilters(raw);const q={ownerId,isDeleted:false};
  if(f.archived!=='all')q.isArchived=f.archived==='true';
  
  // If structured rules conditions
  if(Array.isArray(f.conditions)&&f.conditions.length>0){
    const clauses=f.conditions.map(conditionToMongoClause);
    if(f.conjunction==='OR'){
      q.$or=clauses;
    }else{
      q.$and=clauses;
    }
    return {query:q,filters:f};
  }

  const exact={businessCategory:'businessCategory',subcategory:'businessSubcategory',industry:'industry',service:'interestedService',propertyInterest:'interestedService',project:'interestedProject',source:'leadSource',status:'leadStatus',priority:'priority',consent:'whatsappConsentStatus'};
  for(const [key,path]of Object.entries(exact))if(f[key])q[path]=new RegExp(`^${escape(f[key])}$`,'i');
  if(f.city||f.location){const text=f.location||f.city;q.location=new RegExp(escape(text),'i');}
  if(f.tag||f.tags)q.tags=new RegExp(`^${escape(f.tag||f.tags)}$`,'i');
  if(f.batchId)q.sourceImportJobId=f.batchId;
  if(f.group&&oid(f.group))q.groups=new mongoose.Types.ObjectId(f.group);
  if(f.budgetMin!=null||f.budgetMax!=null){
    q.estimatedDealValue={};
    if(f.budgetMin!=null)q.estimatedDealValue.$gte=f.budgetMin;
    if(f.budgetMax!=null)q.estimatedDealValue.$lte=f.budgetMax;
  }
  const date={};if(f.createdFrom)date.$gte=new Date(f.createdFrom);if(f.createdTo)date.$lte=new Date(f.createdTo);if(Object.keys(date).length)q.createdAt=date;
  if(f.lastContactedFrom||f.lastContactedTo){q.lastContactedAt={};if(f.lastContactedFrom)q.lastContactedAt.$gte=new Date(f.lastContactedFrom);if(f.lastContactedTo)q.lastContactedAt.$lte=new Date(f.lastContactedTo);}
  if(f.search){const re=new RegExp(escape(f.search),'i');q.$or=['fullName','companyName','phoneNumber','email','businessCategory','interestedProject','location','city'].map(key=>({[key]:re}));}
  return {query:q,filters:f};
}

async function queryForSelection(ownerId,mode,definition={}){
  if(!['manual','all','import','filters','segment','group'].includes(mode))throw fail('Choose a supported audience selection method.');
  if(mode==='manual'){
    if(!Array.isArray(definition.contactIds)||definition.contactIds.length>MAX_MANUAL_SELECTION)throw fail(`Select up to ${MAX_MANUAL_SELECTION.toLocaleString()} contacts at a time.`);
    if(definition.contactIds.some(id=>!oid(id)))throw fail('One or more contact IDs are invalid.');
    const distinct=[...new Set(definition.contactIds.map(String))];return {query:{ownerId,_id:{$in:distinct}},source:'manual',duplicates:definition.contactIds.length-distinct.length,selectionCount:distinct.length,cleanDefinition:{}};
  }
  if(mode==='all')return {query:{ownerId,isDeleted:false,isArchived:false},source:'all',duplicates:0,cleanDefinition:{}};
  if(mode==='filters'){const built=buildAudienceFilter(ownerId,definition.filters||{});return {query:built.query,source:'filters',duplicates:0,cleanDefinition:{filters:built.filters}};}
  if(mode==='import'){
    if(!oid(definition.batchId))throw fail('Choose a valid import batch.');const job=await ImportJob.exists({_id:definition.batchId,ownerId});if(!job)throw fail('Import batch not found.',404);
    return {query:{ownerId,isDeleted:false,isArchived:false,sourceImportJobId:definition.batchId},source:'import',duplicates:0,cleanDefinition:{batchId:String(definition.batchId)}};
  }
  if(mode==='group'){
    if(!oid(definition.groupId))throw fail('Choose a valid contact group.');
    const group=await ContactGroup.findOne({_id:definition.groupId,ownerId}).lean();
    if(!group)throw fail('Contact group not found.',404);
    return {query:{ownerId,groups:new mongoose.Types.ObjectId(definition.groupId),isDeleted:false,isArchived:false},source:'group',duplicates:0,cleanDefinition:{groupId:String(group._id),groupName:group.name}};
  }
  if(!oid(definition.segmentId))throw fail('Choose a valid saved segment.');const segment=await AudienceSegment.findOne({_id:definition.segmentId,ownerId}).lean();if(!segment)throw fail('Saved segment not found.',404);
  if(segment.segmentType==='dynamic'){const built=buildAudienceFilter(ownerId,segment.filterDefinition);return {query:built.query,source:'segment',duplicates:0,cleanDefinition:{segmentId:String(segment._id),segmentType:'dynamic',filters:built.filters}};}
  const ids=await AudienceSegmentMember.find({ownerId,segmentId:segment._id}).distinct('contactId');return {query:{ownerId,_id:{$in:ids}},source:'segment',duplicates:0,cleanDefinition:{segmentId:String(segment._id),segmentType:'static'}};
}

export async function snapshotAudience(campaign,ownerId,input={}){
  const mode=input.mode||campaign.audienceSelectionMode||'manual';const definition=input.definition||{};const exclusionIds=definition.excludedContactIds||[];
  if(!Array.isArray(exclusionIds)||exclusionIds.length>MAX_CAMPAIGN_MEMBERS||exclusionIds.some(id=>!oid(id)))throw fail('Excluded contact list is invalid.');
  const selection=await queryForSelection(ownerId,mode,definition);const exclude=new Set(exclusionIds.map(String));const query=selection.query;
  const version=(campaign.audienceSnapshotVersion||0)+1;const ops=[];let matched=0;let ownedFound=0;
  try{
    const cursor=Contact.find(query).select('_id').sort({_id:1}).cursor();
    for await(const contact of cursor){ownedFound++;const id=String(contact._id);if(exclude.has(id))continue;if(++matched>MAX_CAMPAIGN_MEMBERS)throw fail(`Audience exceeds the ${MAX_CAMPAIGN_MEMBERS.toLocaleString()} contact snapshot limit. Add filters to narrow it.` ,413);
      ops.push({updateOne:{filter:{ownerId,campaignId:campaign._id,snapshotVersion:version,contactId:contact._id},update:{$setOnInsert:{ownerId,campaignId:campaign._id,snapshotVersion:version,contactId:contact._id,selectionSource:selection.source,eligibilityStatus:'Missing Consent',exclusionReasons:['Validation pending'],validationTimestamp:new Date()}},upsert:true}});
      if(ops.length>=500){await CampaignAudience.bulkWrite(ops,{ordered:false});ops.length=0;}
    }
    if(ops.length)await CampaignAudience.bulkWrite(ops,{ordered:false});
    if(mode==='manual'&&ownedFound!==selection.selectionCount)throw fail('One or more selected contacts do not belong to your workspace.',404);
    const old=campaign.audienceSnapshotVersion;
    campaign.audienceSelectionMode=mode;campaign.audienceDefinition=selection.cleanDefinition;campaign.selectedSegmentId=mode==='segment'?selection.cleanDefinition.segmentId:null;campaign.audienceSnapshotVersion=version;
    await campaign.save();
    if(old)await CampaignAudience.deleteMany({ownerId,campaignId:campaign._id,snapshotVersion:old});
    campaign._audienceDuplicateInputCount=selection.duplicates;
    return {count:matched,duplicates:selection.duplicates,version,selectionSource:selection.source};
  }catch(error){await CampaignAudience.deleteMany({ownerId,campaignId:campaign._id,snapshotVersion:version});throw error;}
}

export async function segmentQuery(ownerId,segment){
  if(segment.segmentType==='dynamic')return buildAudienceFilter(ownerId,segment.filterDefinition).query;
  const ids=await AudienceSegmentMember.find({ownerId,segmentId:segment._id}).distinct('contactId');return {ownerId,_id:{$in:ids},isDeleted:false};
}
