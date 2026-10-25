import { workspaceBusinessContext } from '../utils/workspaceBusinessContext.js';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import Contact from '../models/Contact.js';
import Campaign from '../models/Campaign.js';
import MessageTemplate, { TemplateVersion } from '../models/MessageTemplate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { buildMetaStructure, extractVariables, resolveTemplate, validateTemplate } from '../utils/templateEngine.js';
import { tenantScope } from '../utils/tenantScope.js';
import { getStrictIndustryConfig } from '../config/industries/industryRegistry.js';

const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const objectId=id=>mongoose.isObjectIdOrHexString(id);
const editable=['name','description','category','businessCategory','intendedService','tags','isFavorite','language','headerType','header','headerMediaId','headerMediaUrl','headerMediaName','headerMediaSize','headerMediaMime','body','footer','buttons','localStatus','metaTemplateName','metaTemplateId','metaLanguage','sampleValues','fallbackValues','revisionNotes'];
const clean=(source={})=>{const out={};for(const key of editable)if(source[key]!==undefined)out[key]=source[key];if(typeof out.header==='object'&&out.header!==null){if(out.header.type)out.headerType=out.headerType||out.header.type;out.header=out.header.text||'';}if(source.localStatus==='Archived')out.isArchived=true;if(source.headerType!==undefined&&!['NONE','TEXT','IMAGE','VIDEO','DOCUMENT'].includes(source.headerType))throw fail('Invalid header type.');return out;};
const snapshot=t=>({name:t.name,description:t.description,category:t.category,businessCategory:t.businessCategory,intendedService:t.intendedService,tags:t.tags,isFavorite:t.isFavorite,language:t.language,headerType:t.headerType||'NONE',header:t.header||'',headerMediaId:t.headerMediaId||null,headerMediaUrl:t.headerMediaUrl||'',headerMediaName:t.headerMediaName||'',headerMediaSize:t.headerMediaSize||0,headerMediaMime:t.headerMediaMime||'',body:t.body,footer:t.footer,buttons:t.buttons,localStatus:t.localStatus,providerStatus:t.providerStatus,metaTemplateName:t.metaTemplateName,metaTemplateId:t.metaTemplateId,metaLanguage:t.metaLanguage,metaParameterMappings:t.metaParameterMappings,sampleValues:t.sampleValues,fallbackValues:t.fallbackValues});
async function recordVersion(t,userId,notes='') { const versionNumber=(t.currentVersionNumber||0)+1;const meta=buildMetaStructure(t);const v=await TemplateVersion.create({ownerId:t.ownerId,workspaceId:t.workspaceId,templateId:t._id,versionNumber,revisionNotes:notes||'',snapshot:snapshot(t),internalVariables:extractVariables(`${t.header||''}\n${t.body||''}\n${t.footer||''}\n${(t.buttons||[]).map(b=>`${b.text} ${b.value}`).join('\n')}`),metaParameterMappings:meta.mappings,sampleValues:t.sampleValues||{},validationResults:validateTemplate(t),createdBy:userId});t.currentVersionId=v._id;t.currentVersionNumber=versionNumber;await t.save();return v; }
function bodyFrom(req){if(!req.body||typeof req.body!=='object'||Array.isArray(req.body))throw fail('Request body must be an object.');if(JSON.stringify(req.body).length>25000)throw fail('Template request is too large.',413);return req.body;}
function queryFilter(req){const filter={...tenantScope(req)};if(req.query.category){if(!['Marketing','Utility','Authentication'].includes(req.query.category))throw fail('Invalid category.');filter.category=req.query.category;}if(req.query.businessCategory)filter.businessCategory=String(req.query.businessCategory).slice(0,80);if(req.query.service)filter.intendedService=String(req.query.service).slice(0,120);if(req.query.status&&['Draft','Ready for Review','Ready for Submission','Archived'].includes(req.query.status))filter.localStatus=req.query.status;if(req.query.language)filter.language=String(req.query.language).slice(0,12);if(req.query.favorite==='true')filter.isFavorite=true;if(req.query.search){const s=String(req.query.search).trim().slice(0,80).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');filter.$or=[{name:new RegExp(s,'i')},{description:new RegExp(s,'i')},{body:new RegExp(s,'i')}];}filter.isArchived=req.query.archived==='true';return filter;}
export async function listTemplates(req,res){const filter=queryFilter(req),page=Math.max(1,Math.min(100000,Number(req.query.page)||1)),limit=Math.max(1,Math.min(100,Number(req.query.limit)||100)),sort=['createdAt','updatedAt','name'].includes(req.query.sort)?req.query.sort:'updatedAt',direction=req.query.direction==='asc'?1:-1;const [records,total]=await Promise.all([MessageTemplate.find(filter).sort({[sort]:direction,_id:direction}).skip((page-1)*limit).limit(limit).lean(),MessageTemplate.countDocuments(filter)]);res.json({records,total,page,pageSize:limit,totalPages:Math.ceil(total/limit)});}
export async function createTemplate(req,res){const data=clean(bodyFrom(req));Object.assign(data,tenantScope(req));data.localStatus=['Draft','Ready for Review'].includes(data.localStatus)?data.localStatus:'Draft';data.providerStatus='Not Submitted';data.internalVariables=extractVariables(`${data.header||''}\n${data.body||''}\n${data.footer||''}\n${(data.buttons||[]).map(b=>`${b.text} ${b.value}`).join('\n')}`);const t=await MessageTemplate.create(data);await recordVersion(t,req.user._id,data.revisionNotes||'Initial template draft.');res.status(201).json({template:t});}
export async function getTemplate(req,res){if(!objectId(req.params.id))throw fail('Template ID is invalid.');const template=await MessageTemplate.findOne({_id:req.params.id,...tenantScope(req)}).lean();if(!template)return res.status(404).json({message:'Template not found.'});const campaignUsage=await Campaign.find({...tenantScope(req),selectedTemplateId:template._id}).select('_id name status selectedTemplateVersionId').lean();res.json({template,campaignUsage});}
export async function updateTemplate(req,res){if(!objectId(req.params.id))throw fail('Template ID is invalid.');const t=await MessageTemplate.findOne({_id:req.params.id,...tenantScope(req)});if(!t)return res.status(404).json({message:'Template not found.'});const payload=bodyFrom(req);if(payload.currentVersionNumber!==undefined&&Number(payload.currentVersionNumber)!==t.currentVersionNumber)throw fail('This template changed since you opened it. Reload before saving to avoid overwriting a newer version.',409);const data=clean(payload);delete data.providerStatus;delete data.ownerId;delete data.isArchived;const before=snapshot(t);Object.assign(t,data);if(before.providerStatus!=='Not Submitted'&&['body','header','headerType','headerMediaUrl','footer','buttons','category','language'].some(k=>JSON.stringify(before[k])!==JSON.stringify(t[k])))t.providerStatus='Not Submitted';t.internalVariables=extractVariables(`${t.header}\n${t.body}\n${t.footer}\n${(t.buttons||[]).map(b=>`${b.text} ${b.value}`).join('\n')}`);t.isArchived=t.localStatus==='Archived';await t.save();const changed=Object.keys(data).some(k=>!['revisionNotes','isFavorite','tags'].includes(k)&&JSON.stringify(before[k])!==JSON.stringify(t[k]));if(changed||data.revisionNotes)await recordVersion(t,req.user._id,data.revisionNotes||'Updated template content.');res.json({template:t});}
export async function deleteTemplate(req,res){if(!objectId(req.params.id))throw fail('Template ID is invalid.');const t=await MessageTemplate.findOne({_id:req.params.id,...tenantScope(req)});if(!t)return res.status(404).json({message:'Template not found.'});const referenced=await Campaign.exists({...tenantScope(req),$or:[{selectedTemplateId:t._id},{selectedTemplateVersionId:{$in:await TemplateVersion.find({...tenantScope(req),templateId:t._id}).distinct('_id')}}]});if(t.localStatus!=='Draft'||t.providerStatus!=='Not Submitted'||t.usageReferences?.length||referenced)throw fail('Only unused local drafts with no campaign references can be deleted. Archive this template instead.',409);await Promise.all([TemplateVersion.deleteMany({templateId:t._id,...tenantScope(req)}),t.deleteOne()]);res.json({deleted:true});}
export async function duplicateTemplate(req,res){if(!objectId(req.params.id))throw fail('Template ID is invalid.');const source=await MessageTemplate.findOne({_id:req.params.id,...tenantScope(req)}).lean();if(!source)return res.status(404).json({message:'Template not found.'});const data={...snapshot(source),_id:undefined,name:`${source.name} (copy)`.slice(0,120),localStatus:'Draft',providerStatus:'Not Submitted',isArchived:false,usageReferences:[],currentVersionId:null,currentVersionNumber:0,...tenantScope(req)};const copy=await MessageTemplate.create(data);await recordVersion(copy,req.user._id,'Duplicated from another template.');res.status(201).json({template:copy});}
export async function archiveTemplate(req,res){if(!objectId(req.params.id))throw fail('Template ID is invalid.');const t=await MessageTemplate.findOne({_id:req.params.id,...tenantScope(req)});if(!t)return res.status(404).json({message:'Template not found.'});t.localStatus='Archived';t.isArchived=true;await t.save();await recordVersion(t,req.user._id,'Archived template.');res.json({template:t});}
export async function restoreTemplate(req,res){if(!objectId(req.params.id))throw fail('Template ID is invalid.');const t=await MessageTemplate.findOne({_id:req.params.id,...tenantScope(req)});if(!t)return res.status(404).json({message:'Template not found.'});t.localStatus='Draft';t.isArchived=false;await t.save();await recordVersion(t,req.user._id,'Restored template to draft.');res.json({template:t});}
export async function templateHistory(req,res){if(!objectId(req.params.id))throw fail('Template ID is invalid.');const t=await MessageTemplate.exists({_id:req.params.id,...tenantScope(req)});if(!t)return res.status(404).json({message:'Template not found.'});const records=await TemplateVersion.find({templateId:req.params.id,...tenantScope(req)}).sort({versionNumber:-1}).populate('createdBy','name email').lean();res.json({records});}
export async function templateCampaigns(req,res){if(!objectId(req.params.id))throw fail('Template ID is invalid.');const t=await MessageTemplate.findOne({_id:req.params.id,...tenantScope(req)}).lean();if(!t)return res.status(404).json({message:'Template not found.'});const versionIds=await TemplateVersion.find({templateId:t._id,...tenantScope(req)}).distinct('_id');const campaigns=await Campaign.find({...tenantScope(req),$or:[{selectedTemplateId:t._id},{selectedTemplateVersionId:{$in:versionIds}}]}).select('_id name status goal category language selectedTemplateVersionId createdAt updatedAt').lean();res.json({records:campaigns});}
export async function previewTemplate(req,res){if(!objectId(req.params.id))throw fail('Template ID is invalid.');const t=await MessageTemplate.findOne({_id:req.params.id,...tenantScope(req)}).lean();if(!t)return res.status(404).json({message:'Template not found.'});const contactId=req.body?.contactId;if(!objectId(contactId))throw fail('Choose a valid contact.');const c=await Contact.findOne({_id:contactId,...tenantScope(req),isDeleted:false}).lean();if(!c)return res.status(404).json({message:'Contact not found.'});const validation=validateTemplate(t),preview=resolveTemplate(t,c,workspaceBusinessContext(req.user, req.workspace));preview.valid=preview.valid&&validation.valid;preview.validationErrors=validation.errors;await MessageTemplate.updateOne({_id:t._id,...tenantScope(req)},{$set:{lastUsedAt:new Date()}});res.json({preview,validation,meta:buildMetaStructure(t)});}
export async function bulkPreview(req,res){
 if(!objectId(req.params.id))throw fail('Template ID is invalid.');const t=await MessageTemplate.findOne({_id:req.params.id,...tenantScope(req)}).lean();if(!t)return res.status(404).json({message:'Template not found.'});
 const body=bodyFrom(req),ids=body.ids||[],filters=body.filters||{};if(!Array.isArray(ids)||ids.length>100)throw fail('Select up to 100 contacts per preview batch.');
 const filter={...tenantScope(req),isDeleted:false,isArchived:false};if(ids.length){if(ids.some(id=>!objectId(id)))throw fail('One or more contact IDs are invalid.');filter._id={$in:ids};}
 const bounded=(value,max,label)=>{if(value===undefined||value==='')return '';if(typeof value!=='string'||value.length>max)throw fail(`${label} filter is invalid.`);return value.trim();};
 const service=bounded(filters.service,120,'Service'),industry=bounded(filters.industry,120,'Industry'),category=bounded(filters.businessCategory,80,'Business category'),city=bounded(filters.city,160,'City'),batch=bounded(filters.importBatchId,100,'Import batch'),status=bounded(filters.status,80,'Status'),tag=bounded(filters.tag,40,'Tag'),search=bounded(filters.search,80,'Search');
 if(service)filter.interestedService=new RegExp(`^${service.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}$`,'i');if(industry)filter.industry=new RegExp(`^${industry.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}$`,'i');if(category)filter.businessCategory=new RegExp(`^${category.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}$`,'i');if(city)filter.location=new RegExp(city.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i');if(batch){if(!objectId(batch))throw fail('Import batch ID is invalid.');filter.sourceImportJobId=batch;}if(status){if(!['New','Contacted','Interested','Follow-up Required','Negotiation','Converted','Not Interested','Closed'].includes(status))throw fail('Lead status filter is invalid.');filter.leadStatus=status;}if(tag)filter.tags=tag.toLowerCase();if(search){const safe=search.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');filter.$or=['fullName','companyName','email'].map(k=>({[k]:new RegExp(safe,'i')}));}
 const page=Math.max(1,Math.min(100000,Number(body.page)||1)),limit=Math.max(1,Math.min(100,Number(body.limit)||50));const [contacts,total]=await Promise.all([Contact.find(filter).sort({fullName:1,_id:1}).skip((page-1)*limit).limit(limit).lean(),Contact.countDocuments(filter)]);
 await MessageTemplate.updateOne({_id:t._id,...tenantScope(req)},{$set:{lastUsedAt:new Date()}});
 const templateValidation=validateTemplate(t);res.json({records:contacts.map(c=>{const preview=resolveTemplate(t,c,workspaceBusinessContext(req.user, req.workspace));preview.valid=preview.valid&&templateValidation.valid;preview.validationErrors=templateValidation.errors;return {contact:{id:String(c._id),name:c.fullName,company:c.companyName||'',businessCategory:c.businessCategory||'',phone:c.phoneNumber||''},preview,templateName:t.name};}),total,page,pageSize:limit,totalPages:Math.ceil(total/limit),planningOnly:true});
}
export async function templateVersions(req,res){if(!objectId(req.params.id))throw fail('Template ID is invalid.');const t=await MessageTemplate.exists({_id:req.params.id,...tenantScope(req)});if(!t)return res.status(404).json({message:'Template not found.'});const records=await TemplateVersion.find({templateId:req.params.id,...tenantScope(req)}).sort({versionNumber:-1}).lean();res.json({records});}
export async function previewTemplateVersion(req,res){const {id,versionId}=req.params;if(!objectId(id)||!objectId(versionId)||!objectId(req.body?.contactId))throw fail('Template, version, and contact IDs must be valid.');const [template,version,contact]=await Promise.all([MessageTemplate.exists({_id:id,...tenantScope(req)}),TemplateVersion.findOne({_id:versionId,templateId:id,...tenantScope(req)}).lean(),Contact.findOne({_id:req.body.contactId,...tenantScope(req),isDeleted:false}).lean()]);if(!template||!version||!contact)return res.status(404).json({message:'Template version or contact was not found.'});const validation=validateTemplate(version.snapshot),preview=resolveTemplate(version.snapshot,contact,workspaceBusinessContext(req.user, req.workspace));preview.valid=preview.valid&&validation.valid;preview.validationErrors=validation.errors;res.json({versionNumber:version.versionNumber,preview,validation,meta:buildMetaStructure(version.snapshot),planningOnly:true});}
export async function restoreVersion(req,res){if(!objectId(req.params.id)||!objectId(req.body?.versionId))throw fail('Template or version ID is invalid.');const t=await MessageTemplate.findOne({_id:req.params.id,...tenantScope(req)});const v=await TemplateVersion.findOne({_id:req.body.versionId,templateId:req.params.id,...tenantScope(req)});if(!t||!v)return res.status(404).json({message:'Template version not found.'});const data={...v.snapshot};delete data.providerStatus;delete data._id;delete data.ownerId;Object.assign(t,data,{localStatus:'Draft',providerStatus:'Not Submitted',isArchived:false});await t.save();await recordVersion(t,req.user._id,`Restored from version ${v.versionNumber} as a new draft.`);res.json({template:t});}
export async function validateTemplateRoute(req,res){if(!objectId(req.params.id))throw fail('Template ID is invalid.');const t=await MessageTemplate.findOne({_id:req.params.id,...tenantScope(req)}).lean();if(!t)return res.status(404).json({message:'Template not found.'});const validation=validateTemplate(t);const meta=buildMetaStructure(t);const submission={ready:validation.valid&&!!t.metaTemplateName&&Object.values(meta.mappings).flat().every(m=>t.sampleValues?.[m.variable]),errors:[...validation.errors,...(!t.metaTemplateName?['Meta template name is required for submission readiness.']:[]),...Object.values(meta.mappings).flat().filter(m=>!t.sampleValues?.[m.variable]).map(m=>`Sample value required for {{${m.variable}}}.`)],note:'Local validation cannot guarantee Meta approval.'};res.json({validation,submission,meta});}
export async function getVariables(req, res) {
  const config = getStrictIndustryConfig(req.workspace?.industryKey || 'other');
  const common = [
    { key: 'name', label: 'Full Name' }, { key: 'customer_name', label: 'Customer Name' },
    { key: 'first_name', label: 'First Name' }, { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email' }, { key: 'city', label: 'City' },
  ];
  const offering = (config?.supportedVariables || []).map(v => ({ key: v.token, label: v.label }));
  if (config?.key === 'real_estate') offering.push({ key: 'project', label: 'Project (Legacy)' }, { key: 'budget', label: 'Budget (Legacy)' });
  const toVariables = items => items.map(v => ({ ...v, token: `{{${v.key}}}`, type: 'string' }));
  res.json({ categories: [
    { id: 'contact', name: 'Contact Profile', variables: toVariables(common) },
    ...(config ? [{ id: config.key, name: config.name, variables: toVariables(offering) }] : []),
    { id: 'business', name: 'Workspace Business', variables: toVariables([{ key: 'business_name', label: 'Business Name' }, { key: 'business_phone', label: 'Business Phone' }, { key: 'business_website', label: 'Website' }]) },
  ] });
}
export async function getCategories(_req,res){
  res.json({
    categories:[
      {id:'Marketing',name:'Marketing',description:'Promotional updates and offers to opted-in contacts.',allowedHeaderTypes:['NONE','TEXT','IMAGE','VIDEO','DOCUMENT'],allowedButtons:['QUICK_REPLY','URL','PHONE_NUMBER'],maxButtons:3},
      {id:'Utility',name:'Utility',description:'Transactional confirmations, reminders, and customer follow-ups.',allowedHeaderTypes:['NONE','TEXT','IMAGE','VIDEO','DOCUMENT'],allowedButtons:['QUICK_REPLY','URL','PHONE_NUMBER'],maxButtons:3},
      {id:'Authentication',name:'Authentication',description:'Security verification codes and client OTP validation.',allowedHeaderTypes:['NONE','TEXT'],allowedButtons:['QUICK_REPLY'],maxButtons:1}
    ]
  });
}
export async function library(req, res) {
  let industryKey = 'other';
  if (req.workspace && req.workspace.industryKey) {
    industryKey = req.workspace.industryKey;

  }

  const config = getStrictIndustryConfig(industryKey);
  if (!config) return res.json({ records: [], industryKey, unavailable: true });
  const presets = (config.templateSuggestions || []).map((t) => ({
    id: t.presetKey || t.key || t.templateId,
    name: t.presetKey || t.key || t.name,
    title: t.title || t.name,
    description: t.purpose || t.description || '',
    category: ['Marketing', 'Utility', 'Authentication'].includes(t.category) ? t.category : 'Utility',
    presetCategory: t.category || 'General',
    source: 'industry_preset',
    localStatus: 'Draft',
    sampleValues: t.sampleValues || {},
    language: t.language || 'en',
    headerType: t.headerType || 'NONE',
    header: t.header || '',
    body: t.body || '',
    footer: t.footer || '',
    buttons: t.buttons || [],
    variables: t.variables || [],
  }));

  res.json({
    records: presets,
    industryKey: config.key,
    industryName: config.name,
    total: presets.length,
  });
}
const aiLimit=rateLimit({windowMs:60*60*1000,limit:Number(process.env.TEMPLATE_AI_HOURLY_LIMIT)||20,standardHeaders:true,legacyHeaders:false,message:{message:'AI request limit reached. Try again later.'}});
function aiConfig(){if(!process.env.AI_API_KEY||!process.env.AI_BASE_URL||!process.env.AI_MODEL)return null;return {url:`${process.env.AI_BASE_URL.replace(/\/$/,'')}/chat/completions`,key:process.env.AI_API_KEY,model:process.env.AI_MODEL};}
async function callAi(req,mode){const cfg=aiConfig();if(!cfg)throw fail('AI Not Configured: set AI_API_KEY, AI_BASE_URL, and AI_MODEL on the backend.',503);const b=req.body||{};const current=String(b.text||'').slice(0,4000);const variables=[...new Set((current.match(/{{[a-zA-Z][a-zA-Z0-9_.:-]*}}/g)||[]))];const ask={mode,service:String(b.service||'').slice(0,200),industry:String(b.industry||'').slice(0,200),audience:String(b.audience||'').slice(0,200),tone:String(b.tone||'Professional').slice(0,50),language:String(b.language||'English').slice(0,50),objective:String(b.objective||'').slice(0,300),length:String(b.length||'Concise').slice(0,50),callToAction:String(b.callToAction||'').slice(0,200),existingDraft:current,variables};const operations={generate:'Write a new draft from the supplied brief.',shorter:'Rewrite the current draft to be shorter while preserving its meaning.',professional:'Rewrite the current draft in a professional tone.',friendlier:'Rewrite the current draft in a warm, friendly tone without implying prior familiarity.',clarity:'Improve clarity while preserving the stated meaning.',cta:'Improve the call to action without pressure or unsupported promises.',grammar:'Correct grammar and spelling while preserving tone and meaning.',translate_hindi:'Translate the current draft to Hindi.',convert_hinglish:'Rewrite the current draft in natural Hinglish using Latin script.',alternatives:'Return three concise alternative versions separated by a blank line.'};const prompt=`${operations[mode]||'Rewrite the current draft according to the requested action.'} Return only the message text. Preserve these variable tokens exactly when used: ${variables.join(', ')||'(none)'}. Do not invent facts, results, prior interactions, or business claims. Avoid unsupported promotional claims. User brief JSON: ${JSON.stringify(ask)}`;let response;try{response=await fetch(cfg.url,{method:'POST',headers:{Authorization:`Bearer ${cfg.key}`,'Content-Type':'application/json'},body:JSON.stringify({model:cfg.model,messages:[{role:'user',content:prompt}],temperature:0.5,max_tokens:700}),signal:AbortSignal.timeout(20000)});}catch{throw fail('Configured AI provider could not be reached.',502);}if(!response.ok)throw fail(`Configured AI provider returned an error (${response.status}).`,502);const data=await response.json();const text=data.choices?.[0]?.message?.content;if(typeof text!=='string'||!text.trim())throw fail('Configured AI provider returned no draft.',502);return {draft:text.trim().slice(0,4000),warnings:['Review all factual and promotional claims before saving.','AI drafts are not Meta approved templates.'],provider:process.env.AI_PROVIDER||'configured provider'};}
export const generateAI=asyncHandler(async(req,res)=>res.json(await callAi(req,'generate')));
export const rewriteAI=asyncHandler(async(req,res)=>res.json(await callAi(req,req.body?.action||'rewrite')));
export function aiStatus(_req,res){res.json({configured:!!aiConfig(),label:aiConfig()?'AI Ready':'AI Not Configured'});}
export const aiRateLimit=aiLimit;

export async function setMockApproval(req, res) {
  const { id } = req.params;
  const { status } = req.body || {};
  const allowed = [
    'Not Submitted',
    'Simulated Submission',
    'Simulated Pending Review',
    'Simulated Approved',
    'Simulated Rejected',
    'Simulated Paused'
  ];

  if (!allowed.includes(status)) {
    throw fail(`Invalid mock approval status. Allowed: ${allowed.join(', ')}`);
  }

  const template = await MessageTemplate.findOne({ _id: id, ownerId: req.user._id, isArchived: false });
  if (!template) throw fail('Template not found or archived.', 404);

  template.mockProviderApprovalStatus = status;
  await template.save();

  res.json({
    message: `Template mock approval status transitioned to "${status}".`,
    template: {
      _id: template._id,
      name: template.name,
      mockProviderApprovalStatus: template.mockProviderApprovalStatus,
      verifiedMetaApprovalStatus: 'UNVERIFIED_OFFLINE',
      providerStatus: template.providerStatus
    },
    metaApiNotice: 'Simulation only. Official Meta Cloud API approval requires genuine Meta review in Prompt 10.'
  });
}

