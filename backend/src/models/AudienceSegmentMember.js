import mongoose from 'mongoose';
const schema=new mongoose.Schema({workspaceId:{type:mongoose.Schema.Types.ObjectId,ref:'Workspace',index:true},ownerId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},segmentId:{type:mongoose.Schema.Types.ObjectId,ref:'AudienceSegment',required:true,index:true},contactId:{type:mongoose.Schema.Types.ObjectId,ref:'Contact',required:true,index:true}},{timestamps:{createdAt:true,updatedAt:false}});
schema.index({ownerId:1,segmentId:1,contactId:1},{unique:true});
export default mongoose.model('AudienceSegmentMember',schema);
