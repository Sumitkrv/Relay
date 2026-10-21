import mongoose from 'mongoose';
const schema=new mongoose.Schema({ownerId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},name:{type:String,required:true,trim:true,maxlength:80},position:{type:Number,required:true,min:0},category:{type:String,enum:['open','won','lost'],default:'open'},isTerminal:{type:Boolean,default:false},isArchived:{type:Boolean,default:false}},{timestamps:true});
schema.index({ownerId:1,position:1});schema.index({ownerId:1,name:1},{unique:true});export default mongoose.model('PipelineStage',schema);
