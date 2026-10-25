import mongoose from 'mongoose';

const schema=new mongoose.Schema({
  workspaceId:{type:mongoose.Schema.Types.ObjectId,ref:'Workspace',index:true},ownerId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},
  campaignId:{type:mongoose.Schema.Types.ObjectId,ref:'Campaign',required:true,index:true},
  mode:{type:String,enum:['mock'],default:'mock'},
  trigger:{type:String,enum:['manual','scheduled'],default:'manual'},
  status:{type:String,enum:['queued','running','paused','completed','failed','cancelled'],default:'queued',index:true},
  audienceSnapshotVersion:{type:Number,required:true},
  templateId:{type:mongoose.Schema.Types.ObjectId,ref:'MessageTemplate',default:null},
  templateVersionId:{type:mongoose.Schema.Types.ObjectId,ref:'TemplateVersion',default:null},
  totalJobs:{type:Number,default:0},startedAt:Date,completedAt:Date,cancelRequested:{type:Boolean,default:false},
  scheduledFor:Date,summary:{type:mongoose.Schema.Types.Mixed,default:{}}
},{timestamps:true});
schema.index({ownerId:1,campaignId:1,status:1});
schema.index({ownerId:1,campaignId:1,createdAt:-1});
schema.index({ownerId:1,campaignId:1,scheduledFor:1},{unique:true,partialFilterExpression:{trigger:'scheduled'}});
export default mongoose.model('CampaignExecution',schema);
