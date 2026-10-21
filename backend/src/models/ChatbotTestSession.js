import mongoose from 'mongoose';
const schema=new mongoose.Schema({ownerId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},chatbotId:{type:mongoose.Schema.Types.ObjectId,ref:'ChatbotDefinition',required:true,index:true},versionId:{type:mongoose.Schema.Types.ObjectId,ref:'ChatbotVersion',required:true},status:{type:String,enum:['active','completed','error'],default:'active',index:true},currentNodeId:{type:String,default:''},variables:{type:mongoose.Schema.Types.Mixed,default:{}},transcript:{type:[mongoose.Schema.Types.Mixed],default:[]},testMode:{type:Boolean,default:true},error:{type:String,default:''}},{timestamps:true});
schema.index({ownerId:1,chatbotId:1,createdAt:-1});
export default mongoose.model('ChatbotTestSession',schema);
