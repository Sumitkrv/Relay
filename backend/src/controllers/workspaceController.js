import Workspace from '../models/Workspace.js';
import WorkspaceMembership from '../models/WorkspaceMembership.js';
import { provisionWorkspaceInternal } from '../services/workspaceContextService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { inspectWorkspaceStarterData, provisionWorkspaceStarterData } from '../services/industryStarterProvisioningService.js';

/**
 * GET /api/workspaces/current
 * Returns the currently authorized workspace and user's membership details
 */
export const getCurrentWorkspace = asyncHandler(async (req, res) => {
  res.json({
    workspace: req.workspace,
    membership: {
      role: req.workspaceMembership.role,
      status: req.workspaceMembership.status,
      joinedAt: req.workspaceMembership.joinedAt,
      isDefaultWorkspace: req.workspaceMembership.isDefaultWorkspace,
    },
  });
});

/**
 * GET /api/workspaces/my-workspaces
 * Returns all active workspaces the authenticated user belongs to
 */
export const getMyWorkspaces = asyncHandler(async (req, res) => {
  const memberships = await WorkspaceMembership.find({
    userId: req.user._id,
    status: 'ACTIVE',
  })
    .populate('workspaceId')
    .sort({ isDefaultWorkspace: -1, createdAt: 1 })
    .lean();

  const workspaces = memberships
    .filter((m) => m.workspaceId && m.workspaceId.status === 'ACTIVE')
    .map((m) => ({
      _id: m.workspaceId._id,
      id: m.workspaceId._id,
      name: m.workspaceId.name,
      slug: m.workspaceId.slug,
      industryKey: m.workspaceId.industryKey,
      logoUrl: m.workspaceId.logoUrl,
      role: m.role,
      isDefaultWorkspace: m.isDefaultWorkspace,
      createdAt: m.workspaceId.createdAt,
    }));

  res.json({ workspaces });
});

/**
 * POST /api/workspaces/internal-provision
 * Safe internal workspace provisioning endpoint for tests, onboarding and admin.
 * Requires authenticated session. Not an unauthenticated public signup endpoint.
 */
export const provisionWorkspace = asyncHandler(async (req, res) => {
  const {
    name,
    slug,
    industryKey,
    businessEmail,
    businessPhone,
    country,
    city,
    timezone,
    currency,
    settings,
    isDefault,
  } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return res.status(400).json({ message: 'Workspace name is required and must be at least 2 characters.' });
  }

  const result = await provisionWorkspaceInternal({
    ownerId: req.user._id,
    name: name.trim(),
    slug: slug ? slug.trim() : undefined,
    industryKey,
    businessEmail,
    businessPhone,
    country,
    city,
    timezone,
    currency,
    settings,
    isDefault,
  });

  res.status(result.isExisting ? 200 : 201).json({
    message: result.isExisting
      ? 'Existing workspace matched for user.'
      : 'Workspace provisioned successfully.',
    workspace: result.workspace,
    membership: result.membership,
  });
});

/**
 * GET /api/workspaces/current/starter-provisioning
 * Read-only: provisioning lifecycle + verified saved counts for the authorized workspace.
 */
export const getStarterProvisioningStatus = asyncHandler(async (req, res) => {
  const ws = req.workspace;
  let inventory = null;
  try {
    inventory = await inspectWorkspaceStarterData(ws._id, ws.industryKey);
  } catch (err) {
    inventory = { error: err.code || 'INSPECTION_FAILED', message: err.message };
  }
  res.json({
    workspaceId: ws._id,
    industryKey: ws.industryKey,
    // null => legacy workspace created before automatic provisioning; never auto-seeded.
    starterProvisioning: ws.starterProvisioning || null,
    inventory,
  });
});

/**
 * POST /api/workspaces/current/starter-provisioning/retry
 * Owner/Admin only. Resumes a PENDING/FAILED/interrupted provisioning; inserts only
 * missing starter records and never overwrites edits. Legacy workspaces are refused.
 */
export const retryStarterProvisioning = asyncHandler(async (req, res) => {
  const ws = req.workspace;
  const role = req.workspaceMembership?.role;
  if (!['OWNER', 'ADMIN'].includes(role)) {
    return res.status(403).json({ code: 'INSUFFICIENT_ROLE', message: 'Only workspace owners or admins can retry provisioning.' });
  }
  if (!ws.starterProvisioning) {
    return res.status(409).json({ code: 'LEGACY_WORKSPACE', message: 'This workspace predates automatic provisioning. Use the explicit backfill tool instead.' });
  }
  if (ws.starterProvisioning.status === 'COMPLETED') {
    return res.json({ status: 'COMPLETED', skipped: true, counts: ws.starterProvisioning.counts });
  }
  const ownerId = ws.createdBy || req.user._id;
  const result = await provisionWorkspaceStarterData({ workspaceId: ws._id, ownerId, industryKey: ws.industryKey });
  res.json(result);
});
