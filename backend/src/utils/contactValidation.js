import { getCountryCallingCode,getCountries,parsePhoneNumberFromString } from 'libphonenumber-js';
import { LEAD_STATUSES,PRIORITIES } from '../models/Contact.js';

import mongoose from 'mongoose';

export const CONTACT_FIELDS=[
  'fullName','phoneNumber','countryCode','email','companyName','designation','website',
  'location','interestedService','interestedPropertyType','industry','businessCategory','businessSubcategory',
  'leadSource','leadStatus','priority','estimatedDealValue','currency','notes','tags',
  'customFields','industryData','city','state','country','preferredLocation','interestedProject','budgetRange',
  'alternatePhone','groups','preferredContactTime','enquiryDate','isSuppressed','suppressionReason',
  'siteVisitInterest','preferredVisitDate'
];
export function normalizePhone(input,region='IN'){
  if(typeof input!=='string'||!input.trim())throw Object.assign(new Error('A valid phone number is required.'),{status:400});
  let regionCode=String(region||'IN').toUpperCase();if(/^\+\d+$/.test(regionCode))regionCode=getCountries().find(country=>`+${getCountryCallingCode(country)}`===regionCode)||'IN';
  const phone=parsePhoneNumberFromString(input.trim(),regionCode);
  if(!phone?.isValid())throw Object.assign(new Error('Enter a valid international phone number.'),{status:400});
  return {phoneNumber:phone.number,countryCode:phone.country||String(region||'IN').toUpperCase()};
}
export function cleanContactInput(input,{partial=false}={}){
  if(!input||typeof input!=='object'||Array.isArray(input))throw Object.assign(new Error('A contact object is required.'),{status:400});
  const unknown=Object.keys(input).filter(key=>!CONTACT_FIELDS.includes(key));
  if(unknown.length)throw Object.assign(new Error(`Unsupported contact field: ${unknown[0]}`),{status:400});
  const out={};
  for(const key of CONTACT_FIELDS)if(Object.hasOwn(input,key))out[key]=input[key];
  if(!partial||Object.hasOwn(out,'fullName')){if(typeof out.fullName!=='string'||out.fullName.trim().length<2)throw Object.assign(new Error('Full name must contain at least 2 characters.'),{status:400});out.fullName=out.fullName.trim();}
  if(!partial||Object.hasOwn(out,'phoneNumber')){const normalized=normalizePhone(out.phoneNumber,out.countryCode||'IN');out.phoneNumber=normalized.phoneNumber;out.countryCode=normalized.countryCode;}
  if(Object.hasOwn(out,'email')){if(typeof out.email!=='string')throw Object.assign(new Error('Email must be a string.'),{status:400});out.email=out.email.trim().toLowerCase();if(out.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email))throw Object.assign(new Error('Enter a valid email address.'),{status:400});}
  if(Object.hasOwn(out,'website')){if(typeof out.website!=='string')throw Object.assign(new Error('Website must be a URL.'),{status:400});out.website=out.website.trim();if(out.website){try{const u=new URL(out.website);if(!['http:','https:'].includes(u.protocol))throw new Error();}catch{throw Object.assign(new Error('Enter a valid website URL beginning with http:// or https://.'),{status:400});}}}
  for(const key of ['companyName','designation','location','interestedService','interestedPropertyType','industry','businessCategory','businessSubcategory','leadSource','notes','currency','city','state','country','preferredLocation','interestedProject','budgetRange','alternatePhone','suppressionReason','preferredContactTime'])if(Object.hasOwn(out,key)&&typeof out[key]!=='string')throw Object.assign(new Error(`${key} must be text.`),{status:400});
  if(Object.hasOwn(out,'city')&&out.city){out.city=out.city.trim().slice(0,120);if(!out.location)out.location=out.city;}
  if(Object.hasOwn(out,'location')&&out.location){out.location=out.location.trim().slice(0,160);if(!out.city)out.city=out.location;}
  if(Object.hasOwn(out,'interestedPropertyType')&&out.interestedPropertyType){out.interestedPropertyType=out.interestedPropertyType.trim().slice(0,120);if(!out.interestedService)out.interestedService=out.interestedPropertyType;}
  if(Object.hasOwn(out,'interestedService')&&out.interestedService){out.interestedService=out.interestedService.trim().slice(0,120);if(!out.interestedPropertyType)out.interestedPropertyType=out.interestedService;}
  if(Object.hasOwn(out,'interestedProject')&&out.interestedProject){out.interestedProject=out.interestedProject.trim().slice(0,160);if(!out.businessCategory)out.businessCategory=out.interestedProject;}
  if(Object.hasOwn(out,'businessCategory')&&out.businessCategory){out.businessCategory=out.businessCategory.trim().slice(0,80);if(!out.interestedProject)out.interestedProject=out.businessCategory;}
  if(Object.hasOwn(out,'state')&&out.state)out.state=out.state.trim().slice(0,120);
  if(Object.hasOwn(out,'country')&&out.country)out.country=out.country.trim().slice(0,80);
  if(Object.hasOwn(out,'preferredLocation')&&out.preferredLocation)out.preferredLocation=out.preferredLocation.trim().slice(0,160);
  if(Object.hasOwn(out,'budgetRange')&&out.budgetRange)out.budgetRange=out.budgetRange.trim().slice(0,80);
  if(Object.hasOwn(out,'alternatePhone')&&out.alternatePhone)out.alternatePhone=out.alternatePhone.trim().slice(0,30);
  if(Object.hasOwn(out,'preferredContactTime')&&out.preferredContactTime)out.preferredContactTime=out.preferredContactTime.trim().slice(0,80);
  if(Object.hasOwn(out,'enquiryDate')&&out.enquiryDate){const ed=new Date(out.enquiryDate);if(Number.isNaN(ed.valueOf()))throw Object.assign(new Error('Invalid enquiry date.'),{status:400});out.enquiryDate=ed;}
  if(Object.hasOwn(out,'isSuppressed'))out.isSuppressed=Boolean(out.isSuppressed);
  if(Object.hasOwn(out,'groups')){if(!Array.isArray(out.groups)||out.groups.some(g=>!mongoose.isObjectIdOrHexString(g)))throw Object.assign(new Error('Groups must be an array of valid IDs.'),{status:400});out.groups=[...new Set(out.groups.map(String))];}
  if(Object.hasOwn(out,'leadStatus')&&!LEAD_STATUSES.includes(out.leadStatus))throw Object.assign(new Error('Choose a valid lead status.'),{status:400});
  if(Object.hasOwn(out,'priority')&&!PRIORITIES.includes(out.priority))throw Object.assign(new Error('Choose a valid priority.'),{status:400});
  if(Object.hasOwn(out,'estimatedDealValue')&&out.estimatedDealValue!==null&&out.estimatedDealValue!==''){const n=Number(out.estimatedDealValue);if(!Number.isFinite(n)||n<0)throw Object.assign(new Error('Deal value must be zero or greater.'),{status:400});out.estimatedDealValue=n;}else if(Object.hasOwn(out,'estimatedDealValue'))out.estimatedDealValue=null;
  if(Object.hasOwn(out,'currency')){out.currency=out.currency.trim().toUpperCase();if(!/^[A-Z]{3}$/.test(out.currency))throw Object.assign(new Error('Currency must be a 3-letter ISO code.'),{status:400});}
  if(Object.hasOwn(out,'tags')){if(!Array.isArray(out.tags)||out.tags.length>30||out.tags.some(t=>typeof t!=='string'||t.trim().length>40))throw Object.assign(new Error('Use up to 30 tags, each no longer than 40 characters.'),{status:400});out.tags=[...new Set(out.tags.map(t=>t.trim().toLowerCase()).filter(Boolean))];}
  if(Object.hasOwn(out,'customFields')){if(!out.customFields||typeof out.customFields!=='object'||Array.isArray(out.customFields)||Object.keys(out.customFields).length>30)throw Object.assign(new Error('Custom fields must be an object with up to 30 fields.'),{status:400});const clean={};for(const [k,v] of Object.entries(out.customFields)){if(!/^[\w -]{1,50}$/.test(k)||['__proto__','constructor','prototype'].includes(k)||typeof v!=='string'||v.length>500)throw Object.assign(new Error('Custom field names or values are invalid.'),{status:400});clean[k]=v;}out.customFields=clean;}
  if(Object.hasOwn(out,'industryData')){if(!out.industryData||typeof out.industryData!=='object'||Array.isArray(out.industryData)||Object.keys(out.industryData).length>30)throw Object.assign(new Error('industryData must be an object with up to 30 fields.'),{status:400});const cleanInd={};for(const [k,v] of Object.entries(out.industryData)){if(['__proto__','constructor','prototype'].includes(k)||k.startsWith('$')||k.includes('.'))continue;cleanInd[k]=v;}out.industryData=cleanInd;}
  return out;
}
