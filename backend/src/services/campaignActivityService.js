import CampaignActivity from '../models/CampaignActivity.js';
export async function recordCampaignActivity(campaign,userId,activityType,description,changes={}){return CampaignActivity.create({ownerId:campaign.ownerId,campaignId:campaign._id,activityType,description,changes,performedBy:userId});}
