import mongoose from 'mongoose';

export const LEAD_STATUSES=['New','Contacted','Interested','Follow-up Required','Negotiation','Converted','Not Interested','Closed'];
export const PRIORITIES=['Low','Medium','High','Urgent'];
export const CONSENT_STATUSES=['Unknown','Opted In','Opted Out'];
const contactSchema=new mongoose.Schema({
  ownerId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},
  workspaceId:{type:mongoose.Schema.Types.ObjectId,ref:'Workspace',index:true},
  fullName:{type:String,required:true,trim:true,minlength:2,maxlength:120},
  phoneNumber:{type:String,required:true,trim:true,match:/^\+[1-9]\d{7,14}$/},
  countryCode:{type:String,default:'IN',uppercase:true,trim:true,maxlength:3},email:{type:String,trim:true,lowercase:true,default:'',maxlength:254},
  companyName:{type:String,trim:true,default:'',maxlength:160},designation:{type:String,trim:true,default:'',maxlength:120},website:{type:String,trim:true,default:'',maxlength:300},location:{type:String,trim:true,default:'',maxlength:160},
  interestedService:{type:String,trim:true,default:'',maxlength:120},industry:{type:String,trim:true,default:'',maxlength:120},businessCategory:{type:String,trim:true,default:'',maxlength:80},businessSubcategory:{type:String,trim:true,default:'',maxlength:80},leadSource:{type:String,trim:true,default:'',maxlength:120},leadStatus:{type:String,enum:LEAD_STATUSES,default:'New'},clientClassification:{type:String,enum:['Prospect','Active Client','Previous Client','Inactive Client'],default:'Prospect',index:true},priority:{type:String,enum:PRIORITIES,default:'Medium'},estimatedDealValue:{type:Number,min:0,default:null},currency:{type:String,uppercase:true,trim:true,default:'INR',match:/^[A-Z]{3}$/},notes:{type:String,trim:true,default:'',maxlength:10000},tags:{type:[{type:String,trim:true,lowercase:true,maxlength:40}],default:[]},
  whatsappNumber:{type:String,trim:true,default:''},whatsappConsentStatus:{type:String,enum:CONSENT_STATUSES,default:'Unknown'},lastContactedAt:{type:Date,default:null},lastRepliedAt:{type:Date,default:null},totalMessagesSent:{type:Number,min:0,default:0},totalReplies:{type:Number,min:0,default:0},
  customFields:{type:mongoose.Schema.Types.Mixed,default:{}},industryData:{type:mongoose.Schema.Types.Mixed,default:{}},isArchived:{type:Boolean,default:false,index:true},archivedAt:{type:Date,default:null},isDeleted:{type:Boolean,default:false,index:true},deletedAt:{type:Date,default:null},
  alternatePhone:{type:String,trim:true,default:'',maxlength:30},
  city:{type:String,trim:true,default:'',maxlength:120},
  state:{type:String,trim:true,default:'',maxlength:120},
  country:{type:String,trim:true,default:'India',maxlength:80},
  interestedPropertyType:{type:String,trim:true,default:'',maxlength:120},
  preferredLocation:{type:String,trim:true,default:'',maxlength:160},
  interestedProject:{type:String,trim:true,default:'',maxlength:160},
  budgetRange:{type:String,trim:true,default:'',maxlength:80},
  groups:[{type:mongoose.Schema.Types.ObjectId,ref:'ContactGroup'}],
  isSuppressed:{type:Boolean,default:false,index:true},
  suppressionReason:{type:String,trim:true,default:'',maxlength:250},
  suppressedAt:{type:Date,default:null},
  isDemo:{type:Boolean,default:false,index:true},
  demoDatasetId:{type:String,default:'',trim:true},
  preferredContactTime:{type:String,trim:true,default:'',maxlength:80},
  enquiryDate:{type:Date,default:null},
  sourceImportJobId:{type:mongoose.Schema.Types.ObjectId,ref:'ImportJob',default:null},sourceImportBatchName:{type:String,default:'',maxlength:120},lastImportJobId:{type:mongoose.Schema.Types.ObjectId,ref:'ImportJob',default:null}
},{timestamps:true,strict:'throw'});
contactSchema.index({ownerId:1,phoneNumber:1},{unique:true,name:'owner_phone_unique'});
contactSchema.index({workspaceId:1,phoneNumber:1},{unique:true,partialFilterExpression:{workspaceId:{$type:'objectId'}},name:'workspace_phone_unique'});
contactSchema.index({ownerId:1,isDeleted:1,isArchived:1,createdAt:-1});
contactSchema.index({ownerId:1,leadStatus:1,priority:1,createdAt:-1});
contactSchema.index({ownerId:1,tags:1});
contactSchema.index({ownerId:1,fullName:1});contactSchema.index({ownerId:1,email:1});contactSchema.index({ownerId:1,companyName:1});contactSchema.index({ownerId:1,interestedService:1});contactSchema.index({ownerId:1,location:1});
contactSchema.index({ownerId:1,city:1});contactSchema.index({ownerId:1,interestedProject:1});contactSchema.index({ownerId:1,groups:1});contactSchema.index({ownerId:1,isSuppressed:1});contactSchema.index({ownerId:1,isDemo:1});
contactSchema.index({ownerId:1,businessCategory:1,businessSubcategory:1});
export default mongoose.model('Contact',contactSchema);
