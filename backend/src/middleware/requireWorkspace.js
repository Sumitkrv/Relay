import mongoose from 'mongoose';
import Workspace from '../models/Workspace.js';
import WorkspaceMembership from '../models/WorkspaceMembership.js';

/**
 * Middleware: requireWorkspace
 * 
 * Enforces strict multi-tenant authorization for workspace-scoped routes.
 * 
 * Invariants:
 * 1. Requires valid authenticated session (req.user must exist).
 * 2. Resolves target workspace from HTTP header 'x-workspace-id' OR user's default active membership.
 * 3. Authoritatively verifies user's active WorkspaceMembership in MongoDB.
 * 4. Checks workspace lifecycle status (fails closed if SUSPENDED, ARCHIVED, etc.).
 * 5. Secures req.workspace, req.workspaceId, and req.workspaceMembership against client tampering.
 */
export async function requireWorkspace(req, res, next) {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required before resolving workspace context.',
      });
    }

    const requestedWorkspaceId = req.get('x-workspace-id');

    let membership = null;

    if (requestedWorkspaceId) {
      // Validate requested format to avoid NoSQL injection or BSON cast errors
      if (!mongoose.isObjectIdOrHexString(requestedWorkspaceId)) {
        return res.status(400).json({
          code: 'INVALID_WORKSPACE_ID',
          message: 'The requested workspace ID format is invalid.',
        });
      }

      // Query authoritative membership for this specific workspace
      membership = await WorkspaceMembership.findOne({
        workspaceId: requestedWorkspaceId,
        userId: req.user._id,
      });

      if (!membership) {
        return res.status(403).json({
          code: 'FORBIDDEN_WORKSPACE_ACCESS',
          message: 'You do not have access to this business workspace.',
        });
      }

      if (membership.status !== 'ACTIVE') {
        return res.status(403).json({
          code: 'MEMBERSHIP_INACTIVE',
          message: `Your membership in this workspace is ${membership.status.toLowerCase()}. Access denied.`,
        });
      }
    } else {
      // Fallback to user's default or first active workspace membership
      if (req.user.defaultWorkspaceId) {
        membership = await WorkspaceMembership.findOne({
          workspaceId: req.user.defaultWorkspaceId,
          userId: req.user._id,
          status: 'ACTIVE',
        });
      }

      if (!membership) {
        membership = await WorkspaceMembership.findOne({
          userId: req.user._id,
          status: 'ACTIVE',
        }).sort({ isDefaultWorkspace: -1, createdAt: 1 });
      }

      if (!membership) {
        return res.status(403).json({
          code: 'NO_ACTIVE_WORKSPACE',
          message: 'No active business workspace found for your account.',
        });
      }
    }

    // Load and validate Workspace entity
    const workspace = await Workspace.findById(membership.workspaceId);
    if (!workspace) {
      return res.status(404).json({
        code: 'WORKSPACE_NOT_FOUND',
        message: 'The requested workspace no longer exists.',
      });
    }

    // Validate workspace status
    if (workspace.status === 'SUSPENDED') {
      return res.status(403).json({
        code: 'WORKSPACE_SUSPENDED',
        message: 'This workspace is suspended. Please contact platform support.',
      });
    }

    if (workspace.status === 'ARCHIVED') {
      return res.status(403).json({
        code: 'WORKSPACE_ARCHIVED',
        message: 'This workspace has been archived.',
      });
    }

    if (workspace.status !== 'ACTIVE') {
      return res.status(403).json({
        code: 'WORKSPACE_INACTIVE',
        message: `Workspace is in ${workspace.status} state. Access denied.`,
      });
    }

    // Attach immutable workspace context to request
    Object.defineProperty(req, 'workspace', {
      value: workspace,
      writable: false,
      configurable: true,
      enumerable: true,
    });

    Object.defineProperty(req, 'workspaceId', {
      value: workspace._id,
      writable: false,
      configurable: true,
      enumerable: true,
    });

    Object.defineProperty(req, 'workspaceMembership', {
      value: membership,
      writable: false,
      configurable: true,
      enumerable: true,
    });

    next();
  } catch (err) {
    next(err);
  }
}
