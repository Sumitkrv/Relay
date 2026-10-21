import mongoose from 'mongoose';
const schema=new mongoose.Schema({
 ownerId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},workspaceId:{type:mongoose.Schema.Types.ObjectId,ref:'Workspace',index:true},campaignId:{type:mongoose.Schema.Types.ObjectId,ref:'Campaign',required:true},executionId:{type:mongoose.Schema.Types.ObjectId,ref:'CampaignExecution',required:true,index:true},contactId:{type:mongoose.Schema.Types.ObjectId,ref:'Contact',required:true},
 templateId:{type:mongoose.Schema.Types.ObjectId,ref:'MessageTemplate',default:null},templateVersionId:{type:mongoose.Schema.Types.ObjectId,ref:'TemplateVersion',default:null},status:{type:String,enum:['queued','processing','simulated_success','failed','blocked','cancelled'],default:'queued',index:true},attempts:{type:Number,default:0},leaseOwner:{type:String,default:''},leaseUntil:{type:Date,default:null},error:{type:String,default:''},validationStatus:{type:String,default:'pending'},processingMs:{type:Number,default:0},processedAt:Date
},{timestamps:true});
schema.index({ownerId:1,executionId:1,contactId:1},{unique:true});schema.index({status:1,leaseUntil:1,createdAt:1});
export default mongoose.model('CampaignMessageJob',schema);
