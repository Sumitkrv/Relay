import Workspace from '../models/Workspace.js';
import WorkspaceMembership from '../models/WorkspaceMembership.js';
import { provisionWorkspaceInternal } from '../services/workspaceContextService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

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
