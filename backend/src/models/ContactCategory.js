import mongoose from 'mongoose';
const schema=new mongoose.Schema({ownerId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},name:{type:String,required:true,trim:true,maxlength:80},normalizedName:{type:String,required:true,lowercase:true,trim:true},isDefault:{type:Boolean,default:false}},{timestamps:true});
schema.index({ownerId:1,normalizedName:1},{unique:true});
export default mongoose.model('ContactCategory',schema);
