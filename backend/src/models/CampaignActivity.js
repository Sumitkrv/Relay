import mongoose from 'mongoose';
const schema=new mongoose.Schema({ownerId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},campaignId:{type:mongoose.Schema.Types.ObjectId,ref:'Campaign',required:true,index:true},activityType:{type:String,required:true,maxlength:60},description:{type:String,required:true,maxlength:500},changes:{type:mongoose.Schema.Types.Mixed,default:{}},performedBy:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true}},{timestamps:{createdAt:true,updatedAt:false}});
schema.index({ownerId:1,campaignId:1,createdAt:-1});
export default mongoose.model('CampaignActivity',schema);
