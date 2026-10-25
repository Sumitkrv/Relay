import CampaignAudience from '../models/CampaignAudience.js';
import Contact from '../models/Contact.js';
import ConsentRecord from '../models/ConsentRecord.js';
import MessageTemplate, { TemplateVersion } from '../models/MessageTemplate.js';
import { resolveTemplate } from '../utils/templateEngine.js';

const PHONE=/^\+[1-9]\d{7,14}$/;
const normalize=value=>String(value||'').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
function purposeMatches(record,campaign){const p=normalize(record?.consentPurpose);const target=normalize(campaign.service||campaign.customGoal||campaign.goal);return !!target&&p.includes(target);}

export async function validateCampaignAudience(campaign,user){
  const members=await CampaignAudience.find({ownerId:campaign.ownerId,campaignId:campaign._id,snapshotVersion:campaign.audienceSnapshotVersion}).select('contactId').lean();
  const ids=members.map(m=>m.contactId);const contacts=await Contact.find({ownerId:campaign.ownerId,_id:{$in:ids}}).lean();const contactMap=new Map(contacts.map(c=>[String(c._id),c]));
  const latest=ids.length?await ConsentRecord.aggregate([{$match:{ownerId:campaign.ownerId,contactId:{$in:ids}}},{$sort:{recordedAt:-1,_id:-1}},{$group:{_id:'$contactId',record:{$first:'$$ROOT'}}}]):[];const consentMap=new Map(latest.map(x=>[String(x._id),x.record]));
  const template=campaign.selectedTemplateId?await MessageTemplate.findOne({_id:campaign.selectedTemplateId,ownerId:campaign.ownerId}).select('_id providerStatus currentVersionId').lean():null;
  const version=campaign.selectedTemplateVersionId?await TemplateVersion.findOne({_id:campaign.selectedTemplateVersionId,templateId:campaign.selectedTemplateId,ownerId:campaign.ownerId}).lean():null;
  const currentTemplateVersion=template?.currentVersionId?String(template.currentVersionId):null;const versionChanged=Boolean(version&&currentTemplateVersion&&currentTemplateVersion!==String(version._id));
  const out=[];const counts={total:ids.length,eligible:0,missingConsent:0,optedOut:0,invalidPhone:0,missingPersonalization:0,inactive:0,providerPending:0,duplicateSelections:campaign.validationSummary?.duplicateSelections||0};
  for(const member of members){const c=contactMap.get(String(member.contactId));const reasons=[],missing=[];let status='Eligible for Campaign Preparation';
    if(!c){status='Inactive or Deleted Contact';reasons.push('Contact is unavailable or was deleted.');}
    else if(c.isDeleted||c.isArchived){status='Inactive or Deleted Contact';reasons.push(c.isDeleted?'Contact is deleted.':'Contact is archived.');}
    else{
      if(c.whatsappConsentStatus==='Opted Out'||c.isSuppressed){status='Opted Out';reasons.push('Contact has opted out.');counts.optedOut++;}
      const record=consentMap.get(String(c._id));
      const isMockDemo = Boolean((c.isDemo || c.demoDatasetId) && (campaign.executionMode === 'MOCK' || campaign.executionMode === 'mock'));
      if(status!=='Opted Out'){
        const hasAudit=!!record&&record.status==='Opted In'&&c.whatsappConsentStatus==='Opted In'&&record.consentSource&&record.evidenceReference&&record.consentCapturedAt&&new Date(record.consentCapturedAt)<=new Date();
        const businessMatches=!!user.businessName&&normalize(record?.consentedBusinessName)===normalize(user.businessName);
        const intentMatches=purposeMatches(record,campaign);
        if(!isMockDemo && (!hasAudit||!businessMatches||!intentMatches)){if(status==='Eligible for Campaign Preparation')status='Missing Consent';reasons.push(!hasAudit?'No current affirmative opt-in audit record with evidence.':!businessMatches?'Consent is not explicitly recorded for this workspace business name.':'Recorded consent purpose does not clearly cover this campaign objective or service.');counts.missingConsent++;}
      }
      if(!PHONE.test(c.phoneNumber||'')){if(status==='Eligible for Campaign Preparation')status='Invalid Phone Number';reasons.push('Phone number is not in valid international format.');counts.invalidPhone++;}
      if(version?.snapshot){const rendered=resolveTemplate(version.snapshot,c,user);if(rendered.missingVariables.length){missing.push(...rendered.missingVariables);if(status==='Eligible for Campaign Preparation')status='Missing Personalization Data';reasons.push(`Missing personalization values: ${rendered.missingVariables.join(', ')}.`);counts.missingPersonalization++;}}
      if(!template||!version){if(status==='Eligible for Campaign Preparation')status='Template/Provider Requirement Pending';reasons.push(!template?'Select a saved template.':'The selected template version is unavailable.');counts.providerPending++;}
      else if(!isMockDemo && (template.providerStatus!=='Approved'||versionChanged)){if(status==='Eligible for Campaign Preparation')status='Template/Provider Requirement Pending';reasons.push(versionChanged?'The selected template version changed and needs explicit review.':'The selected WhatsApp template is not externally approved.');counts.providerPending++;}
    }
    if(status==='Inactive or Deleted Contact')counts.inactive++;
    if(status==='Eligible for Campaign Preparation')counts.eligible++;
    out.push({updateOne:{filter:{ownerId:campaign.ownerId,campaignId:campaign._id,snapshotVersion:campaign.audienceSnapshotVersion,contactId:member.contactId},update:{$set:{eligibilityStatus:status,exclusionReasons:reasons,missingVariables:missing,validationTimestamp:new Date()}}}});
  }
  for(let i=0;i<out.length;i+=500)await CampaignAudience.bulkWrite(out.slice(i,i+500),{ordered:false});
  return {counts,template:{selected:Boolean(template),versionSelected:Boolean(version),currentVersionChanged:versionChanged,providerStatus:template?.providerStatus||'Not selected',senderIntegration:'Not configured'},consentScope:{workspaceBusinessNameConfigured:Boolean(user.businessName),purposeChecked:true},validatedAt:new Date()};
}

export async function campaignTemplateContext(campaign){if(!campaign.selectedTemplateId||!campaign.selectedTemplateVersionId)return {template:null,version:null};const [template,version]=await Promise.all([MessageTemplate.findOne({_id:campaign.selectedTemplateId,ownerId:campaign.ownerId}).lean(),TemplateVersion.findOne({_id:campaign.selectedTemplateVersionId,templateId:campaign.selectedTemplateId,ownerId:campaign.ownerId}).lean()]);return {template,version};}
