import mongoose from 'mongoose';

const schema=new mongoose.Schema({
  ownerId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},
  campaignId:{type:mongoose.Schema.Types.ObjectId,ref:'Campaign',required:true,index:true},
  snapshotVersion:{type:Number,required:true,default:1},
  contactId:{type:mongoose.Schema.Types.ObjectId,ref:'Contact',required:true,index:true},
  selectionSource:{type:String,enum:['manual','all','import','filters','segment','duplicate','group'],required:true},
  eligibilityStatus:{type:String,enum:['Eligible for Campaign Preparation','Missing Consent','Opted Out','Invalid Phone Number','Missing Personalization Data','Duplicate Selection','Inactive or Deleted Contact','Template/Provider Requirement Pending'],default:'Missing Consent'},
  exclusionReasons:{type:[String],default:[]},missingVariables:{type:[String],default:[]},validationTimestamp:{type:Date,default:Date.now}
},{timestamps:{createdAt:true,updatedAt:false}});
schema.index({ownerId:1,campaignId:1,snapshotVersion:1,contactId:1},{unique:true});schema.index({ownerId:1,campaignId:1,snapshotVersion:1,eligibilityStatus:1,contactId:1});
export default mongoose.model('CampaignAudience',schema);
