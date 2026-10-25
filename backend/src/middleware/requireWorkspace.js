import mongoose from 'mongoose';
import Workspace from '../models/Workspace.js';
import WorkspaceMembership from '../models/WorkspaceMembership.js';
import Agency from '../models/Agency.js';
import AgencyMembership from '../models/AgencyMembership.js';
import AgencyClientRelation from '../models/AgencyClientRelation.js';

/**
 * Middleware: requireWorkspace
 * 
 * Enforces strict multi-tenant authorization for workspace-scoped routes.
 * 
 * Invariants:
 * 1. Requires valid authenticated session (req.user must exist).
 * 2. Resolves target workspace from HTTP header 'x-workspace-id' OR user's default active membership.
 * 3. Authoritatively verifies user's active WorkspaceMembership or active AgencyClientRelation in MongoDB.
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

      // If direct membership not found, check authorized agency delegation
      if (!membership) {
        const agencyMemberships = await AgencyMembership.find({ userId: req.user._id, status: 'ACTIVE' });
        const agencyIds = agencyMemberships.map((m) => m.agencyId);
        const ownedAgency = await Agency.findOne({ ownerId: req.user._id, status: 'ACTIVE' });
        if (ownedAgency) agencyIds.push(ownedAgency._id);

        if (agencyIds.length > 0) {
          const delegation = await AgencyClientRelation.findOne({
            agencyId: { $in: agencyIds },
            clientWorkspaceId: requestedWorkspaceId,
            status: 'ACTIVE',
          });
          if (delegation) {
            membership = {
              _id: delegation._id,
              workspaceId: requestedWorkspaceId,
              userId: req.user._id,
              role: 'AGENCY_DELEGATE',
              status: 'ACTIVE',
              isDelegated: true,
              delegatedPermissions: delegation.delegatedPermissions,
            };
          }
        }
      }

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

      // If still no membership, check if user is agency owner with delegated clients
      if (!membership) {
        const agency = await Agency.findOne({ ownerId: req.user._id, status: 'ACTIVE' });
        if (agency) {
          const rel = await AgencyClientRelation.findOne({ agencyId: agency._id, status: 'ACTIVE' });
          if (rel) {
            membership = {
              _id: rel._id,
              workspaceId: rel.clientWorkspaceId,
              userId: req.user._id,
              role: 'AGENCY_DELEGATE',
              status: 'ACTIVE',
              isDelegated: true,
              delegatedPermissions: rel.delegatedPermissions,
            };
          }
        }
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

/**
 * Middleware: resolveWorkspaceContext
 * 
 * Non-blocking workspace context resolver.
 * Inspects 'x-workspace-id' header or falls back to user's active membership.
 * If authorized, sets req.workspace, req.workspaceId, and req.workspaceMembership.
 * If no workspace exists (e.g. legacy test environment), continues gracefully without 403.
 */
export async function resolveWorkspaceContext(req, res, next) {
  try {
    if (!req.user || !req.user._id) {
      req.workspace = null;
      req.workspaceId = null;
      req.workspaceMembership = null;
      return next();
    }

    const requestedWorkspaceId = req.get('x-workspace-id');
    let membership = null;

    // Explicit tenant selection must be authorized, never silently replaced by a default.
    if (requestedWorkspaceId) return requireWorkspace(req, res, next);

    if (requestedWorkspaceId && mongoose.isObjectIdOrHexString(requestedWorkspaceId)) {
      membership = await WorkspaceMembership.findOne({
        workspaceId: requestedWorkspaceId,
        userId: req.user._id,
        status: 'ACTIVE',
      });
    }

    if (!membership) {
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
    }

    if (membership) {
      // Apply the same lifecycle checks to implicit/default selection as explicit headers.
      return requireWorkspace(req, res, next);
    } else {
      if (await WorkspaceMembership.exists({ userId: req.user._id })) {
        return res.status(403).json({ code: 'NO_ACTIVE_WORKSPACE', message: 'No active workspace membership is available.' });
      }
      req.workspace = null;
      req.workspaceId = null;
      req.workspaceMembership = null;
    }

    next();
  } catch (err) {
    next(err);
  }
}

export default requireWorkspace;
