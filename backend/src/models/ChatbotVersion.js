import mongoose from 'mongoose';
const schema=new mongoose.Schema({ownerId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},chatbotId:{type:mongoose.Schema.Types.ObjectId,ref:'ChatbotDefinition',required:true,index:true},versionNumber:{type:Number,required:true},nodes:{type:[mongoose.Schema.Types.Mixed],default:[]},edges:{type:[mongoose.Schema.Types.Mixed],default:[]},validationResult:{type:mongoose.Schema.Types.Mixed,default:{}},isPublished:{type:Boolean,default:false},publishedAt:Date,createdBy:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true}},{timestamps:true});
schema.index({ownerId:1,chatbotId:1,versionNumber:1},{unique:true});
export default mongoose.model('ChatbotVersion',schema);
