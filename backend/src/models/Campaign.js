import mongoose from 'mongoose';

const campaignSchema=new mongoose.Schema({
  ownerId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},
  workspaceId:{type:mongoose.Schema.Types.ObjectId,ref:'Workspace',index:true},
  name:{type:String,required:true,trim:true,minlength:3,maxlength:120},
  description:{type:String,trim:true,default:'',maxlength:1000},
  goal:{type:String,trim:true,default:'',maxlength:100},customGoal:{type:String,trim:true,default:'',maxlength:120},
  category:{type:String,trim:true,default:'',maxlength:80},subcategory:{type:String,trim:true,default:'',maxlength:80},
  service:{type:String,trim:true,default:'',maxlength:120},location:{type:String,trim:true,default:'',maxlength:160},
  language:{type:String,enum:['en','hi','hinglish'],default:'en'},tags:{type:[{type:String,trim:true,lowercase:true,maxlength:40}],default:[]},internalNotes:{type:String,trim:true,default:'',maxlength:5000},
  audienceSelectionMode:{type:String,enum:['manual','all','import','filters','segment','group'],default:'manual'},audienceDefinition:{type:mongoose.Schema.Types.Mixed,default:{}},selectedSegmentId:{type:mongoose.Schema.Types.ObjectId,ref:'AudienceSegment',default:null},audienceSnapshotVersion:{type:Number,default:0},
  selectedTemplateId:{type:mongoose.Schema.Types.ObjectId,ref:'MessageTemplate',default:null},selectedTemplateVersionId:{type:mongoose.Schema.Types.ObjectId,ref:'TemplateVersion',default:null},
  templateSnapshot:{type:mongoose.Schema.Types.Mixed,default:null},
  campaignType:{type:String,enum:['one-time','scheduled'],default:'one-time'},
  executionMode:{type:String,enum:['MOCK','mock'],default:'MOCK'},
  status:{type:String,enum:['Draft','Needs Review','Validated for Preparation','Ready','Scheduled','Running','Paused','Completed','Failed','Cancelled','Archived','Awaiting Provider Setup','Awaiting Template Approval'],default:'Draft',index:true},
  activeExecutionId:{type:mongoose.Schema.Types.ObjectId,ref:'CampaignExecution',default:null,index:true},
  mockSchedule:{type:mongoose.Schema.Types.Mixed,default:null},
  validationSummary:{type:mongoose.Schema.Types.Mixed,default:{}},wizardStep:{type:Number,min:1,max:6,default:1},createdBy:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},
  archivedAt:{type:Date,default:null}
},{timestamps:true});
campaignSchema.index({ownerId:1,status:1,updatedAt:-1});campaignSchema.index({ownerId:1,name:1});
campaignSchema.index({ownerId:1,'mockSchedule.status':1,'mockSchedule.startAt':1});
export default mongoose.model('Campaign',campaignSchema);
