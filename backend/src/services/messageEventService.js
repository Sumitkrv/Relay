import MessageEvent from '../models/MessageEvent.js';

export async function recordMessageEvent({
  ownerId,
  messageId,
  eventType,
  previousStatus = '',
  newStatus,
  source = 'engine',
  attemptNumber = 1,
  correlationId = '',
  safeMetadata = {}
}) {
  if (!ownerId || !messageId || !eventType || !newStatus) {
    return null;
  }

  try {
    return await MessageEvent.create({
      ownerId,
      messageId,
      eventType,
      previousStatus,
      newStatus,
      source,
      attemptNumber,
      timestamp: new Date(),
      correlationId,
      safeMetadata
    });
  } catch (err) {
    console.error('Failed to record MessageEvent:', err.message);
    return null;
  }
}

export async function getMessageEvents(messageId, ownerId) {
  return MessageEvent.find({ messageId, ownerId })
    .sort({ timestamp: 1, _id: 1 })
    .lean();
}
