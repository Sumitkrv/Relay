import mongoose from 'mongoose';
const schema=new mongoose.Schema({ownerId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},name:{type:String,required:true,trim:true,minlength:3,maxlength:120},description:{type:String,default:'',maxlength:500},status:{type:String,enum:['Draft','Validated','Published','Active','Paused','Archived'],default:'Draft',index:true},draftVersionId:{type:mongoose.Schema.Types.ObjectId,ref:'ChatbotVersion',default:null},activeVersionId:{type:mongoose.Schema.Types.ObjectId,ref:'ChatbotVersion',default:null},createdBy:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},archivedAt:Date},{timestamps:true});
schema.index({ownerId:1,status:1,updatedAt:-1});
export default mongoose.model('ChatbotDefinition',schema);
