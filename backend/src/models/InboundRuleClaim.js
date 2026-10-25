import mongoose from 'mongoose';

// A separate collection avoids imposing a new unique constraint on historical executions.
const schema = new mongoose.Schema({
  _id: String,
  ownerId: { type: mongoose.Schema.Types.ObjectId, required: true },
  workspaceId: { type: mongoose.Schema.Types.ObjectId },
  status: { type: String, enum: ['PROCESSING', 'COMPLETE', 'FAILED'], default: 'PROCESSING' },
}, { timestamps: true });
export default mongoose.model('InboundRuleClaim', schema);
