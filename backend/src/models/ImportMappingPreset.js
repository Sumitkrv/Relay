import mongoose from 'mongoose';
const schema=new mongoose.Schema({ownerId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},name:{type:String,required:true,trim:true,maxlength:80},mappings:{type:mongoose.Schema.Types.Mixed,default:{}},defaultCountry:{type:String,default:'IN',uppercase:true},createdAt:{type:Date,default:Date.now},updatedAt:{type:Date,default:Date.now}},{timestamps:false});schema.index({ownerId:1,name:1},{unique:true});
export default mongoose.model('ImportMappingPreset',schema);
