import WorkspaceMembership from '../models/WorkspaceMembership.js';
import { tenantScope } from './tenantScope.js';

// Unassigned legacy planning records belong only to the owner's primary workspace.
// Resolve that boundary without rewriting existing records.
export async function legacyWorkspaceScope(req) {
  const scope = tenantScope(req);
  if (!req.workspaceId) return scope;
  const primary = await WorkspaceMembership.findOne({ userId: req.user._id, status: 'ACTIVE' }).sort({ isDefaultWorkspace: -1, createdAt: 1 }).select('workspaceId').lean();
  const primaryId = req.user.defaultWorkspaceId || primary?.workspaceId;
  if (String(primaryId) !== String(req.workspaceId)) return scope;
  return { ownerId: req.user._id, $or: [{ workspaceId: req.workspaceId }, { workspaceId: null }] };
}
