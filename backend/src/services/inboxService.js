import mongoose from 'mongoose';
import Conversation from '../models/Conversation.js';
import ConversationMessage from '../models/ConversationMessage.js';
import ConversationActivity from '../models/ConversationActivity.js';
import Contact from '../models/Contact.js';
import InboxNotification from '../models/InboxNotification.js';

export const objectId=value=>mongoose.isValidObjectId(value);
export async function requireConversation(ownerId, id, workspaceId) {
  if (!objectId(id)) return null;
  const conversation = await Conversation.findOne({ _id: id, ownerId }).lean();
  if (!conversation || !workspaceId) return conversation;
  if (conversation.workspaceId && String(conversation.workspaceId) !== String(workspaceId)) return null;
  // Legacy conversations have no workspaceId. Their contact must establish the tenant.
  const contact = await Contact.exists({ _id: conversation.contactId, ownerId, workspaceId, isDeleted: false });
  return contact ? conversation : null;
}
export async function writeActivity({conversation,eventType,eventSource='crm',metadata={},performedBy}){return ConversationActivity.create({ownerId:conversation.ownerId,workspaceId:conversation.workspaceId,conversationId:conversation._id,contactId:conversation.contactId,eventType,eventSource,metadata,performedBy});}
export async function makeConversation({ ownerId, workspaceId, contactId, performedBy, source = 'manual' }) {
  if (!objectId(contactId)) throw Object.assign(new Error('Contact ID is invalid.'), { status: 400 });
  const scope = { ownerId, ...(workspaceId ? { workspaceId } : {}) };
  const contact = await Contact.findOne({ _id: contactId, ...scope, isDeleted: false }).lean();
  if (!contact) throw Object.assign(new Error('Contact not found.'), { status: 404 });
  const filter = {
    ownerId, contactId, source, status: { $ne: 'Archived' },
    ...(workspaceId ? { $or: [{ workspaceId }, { workspaceId: null }] } : {}),
  };
  let conversation = await Conversation.findOne(filter);
  if (conversation) return conversation;
  const activeWorkspaceKey = String(ownerId) + ':' + String(contactId) + ':' + source;
  try {
    conversation = await Conversation.create({ ...scope, contactId, source, status: 'Open', activeWorkspaceKey });
  } catch (error) {
    if (error?.code !== 11000) throw error;
    conversation = await Conversation.findOne({ activeWorkspaceKey });
    if (conversation) return conversation;
    throw error;
  }
  await writeActivity({ conversation, eventType: 'conversation_created', eventSource: source === 'test' ? 'synthetic_test' : 'manual', metadata: { source }, performedBy });
  return conversation;
}
export async function logManualCommunication({ownerId,conversation,performedBy,body,direction='outbound',occurredAt=new Date(),type='Other'}){if(!['inbound','outbound'].includes(direction))throw Object.assign(new Error('Choose inbound or outbound direction.'),{status:400});if(typeof body!=='string'||!body.trim()||body.length>10000)throw Object.assign(new Error('Communication summary must contain 1–10000 characters.'),{status:400});const communicationType=['Phone Call','Meeting','Manual WhatsApp Conversation','Email Conversation','Client Discussion','Proposal Shared','Other'].includes(type)?type:'Other';const message=await ConversationMessage.create({ownerId,workspaceId:conversation.workspaceId,conversationId:conversation._id,contactId:conversation.contactId,direction,messageType:'text',mediaMetadata:{communicationType},messageSource:'manual',trustLevel:'unverified',messageBody:body.trim(),providerStatus:'Unavailable',simulationStatus:'Manually Logged',occurredAt:new Date(occurredAt)});const stored=await Conversation.findOne({_id:conversation._id,ownerId});stored.lastMessageId=message._id;stored.lastActivityAt=message.occurredAt;await stored.save();await writeActivity({conversation,eventType:'message_logged',eventSource:'manual',metadata:{messageId:message._id,direction,messageSource:'manual',communicationType},performedBy});return message;}
export async function getProviderStatus(){return {connected:false,provider:'none',inboundWebhookEnabled:false,sendEnabled:false,customerServiceWindow:'Unknown',message:'Provider Not Connected. Manual and test records are not provider verified.'};}
export async function normalizeProviderEvent(input){if(!input||typeof input!=='object'||input.trustLevel!=='trusted_provider')throw Object.assign(new Error('Only authenticated provider events can be normalized as trusted.'),{status:400});return {provider:'meta',providerEventKey:String(input.providerEventKey||''),providerMessageId:String(input.providerMessageId||''),eventType:String(input.eventType||''),trustLevel:'trusted_provider',providerTimestamp:input.providerTimestamp?new Date(input.providerTimestamp):null};}
