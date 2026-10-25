import mongoose from 'mongoose';

const schema=new mongoose.Schema({
  workspaceId:{type:mongoose.Schema.Types.ObjectId,ref:'Workspace',index:true},ownerId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},
  name:{type:String,required:true,trim:true,minlength:2,maxlength:100},
  description:{type:String,trim:true,default:'',maxlength:500},
  segmentType:{type:String,enum:['dynamic','static'],required:true},
  filterDefinition:{type:mongoose.Schema.Types.Mixed,default:{}},
  memberCount:{type:Number,default:0},
  createdBy:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true}
},{timestamps:true});
schema.index({ownerId:1,segmentType:1,updatedAt:-1});schema.index({ownerId:1,name:1});
export default mongoose.model('AudienceSegment',schema);
