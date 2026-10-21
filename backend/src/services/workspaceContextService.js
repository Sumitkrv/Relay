import mongoose from 'mongoose';
import Workspace, { VALID_INDUSTRIES } from '../models/Workspace.js';
import WorkspaceMembership from '../models/WorkspaceMembership.js';
import User from '../models/User.js';

/**
 * Custom Authorization Error class
 */
export class WorkspaceAuthorizationError extends Error {
  constructor(message, status = 403, code = 'FORBIDDEN_WORKSPACE_ACCESS') {
    super(message);
    this.name = 'WorkspaceAuthorizationError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Validates and normalizes an ObjectId representation
 */
export function toObjectId(id, fieldName = 'ID') {
  if (!id) {
    throw new WorkspaceAuthorizationError(`Invalid ${fieldName}: identifier cannot be empty.`, 400, 'INVALID_IDENTIFIER');
  }
  if (!mongoose.isObjectIdOrHexString(id)) {
    throw new WorkspaceAuthorizationError(`Invalid ${fieldName}: malformed identifier.`, 400, 'INVALID_IDENTIFIER');
  }
  return new mongoose.Types.ObjectId(id);
}

/**
 * Extracts and asserts the trusted workspace context from a verified Express request.
 * Fails closed if the request was not processed by requireWorkspace middleware.
 */
export function getAuthorizedWorkspaceContext(req) {
  if (!req.user || !req.user._id) {
    throw new WorkspaceAuthorizationError('Authentication required to access workspace context.', 401, 'AUTHENTICATION_REQUIRED');
  }
  if (!req.workspace || !req.workspaceId) {
    throw new WorkspaceAuthorizationError('No authorized workspace attached to request.', 403, 'NO_WORKSPACE_CONTEXT');
  }
  return {
    user: req.user,
    userId: req.user._id,
    workspace: req.workspace,
    workspaceId: req.workspaceId,
    membership: req.workspaceMembership,
  };
}

/**
 * Builds a strict, validated MongoDB query scope for a workspace.
 * Prevents undefined or malformed workspace queries from matching all documents.
 */
export function buildWorkspaceScope(workspaceId) {
  if (!workspaceId) {
    throw new WorkspaceAuthorizationError('Tenant boundary violation: workspaceId is required.', 403, 'MISSING_TENANT_BOUNDARY');
  }
  const oid = toObjectId(workspaceId, 'workspaceId');
  return { workspaceId: oid };
}

/**
 * Asserts that a user has an active membership in the specified workspace.
 */
export async function assertWorkspaceMembership(userId, workspaceId, requiredRole = null) {
  const userOid = toObjectId(userId, 'userId');
  const wsOid = toObjectId(workspaceId, 'workspaceId');

  const membership = await WorkspaceMembership.findOne({
    workspaceId: wsOid,
    userId: userOid,
  });

  if (!membership) {
    throw new WorkspaceAuthorizationError('You do not have membership in this workspace.', 403, 'MEMBERSHIP_NOT_FOUND');
  }

  if (membership.status !== 'ACTIVE') {
    throw new WorkspaceAuthorizationError(
      `Your membership in this workspace is ${membership.status.toLowerCase()}. Access denied.`,
      403,
      'MEMBERSHIP_INACTIVE'
    );
  }

  if (requiredRole && membership.role !== requiredRole.toUpperCase()) {
    throw new WorkspaceAuthorizationError(
      `Action requires ${requiredRole.toUpperCase()} role. Current role: ${membership.role}.`,
      403,
      'INSUFFICIENT_ROLE'
    );
  }

  return membership;
}

/**
 * Asserts that a given database resource strictly belongs to the specified workspace.
 * Avoids leaking whether the resource exists in another workspace.
 */
export function assertResourceWorkspaceOwnership(resource, workspaceId, resourceName = 'Resource') {
  if (!resource) {
    throw new WorkspaceAuthorizationError(`${resourceName} not found.`, 404, 'RESOURCE_NOT_FOUND');
  }
  const wsOid = toObjectId(workspaceId, 'workspaceId');
  const resourceWsId = resource.workspaceId;

  if (!resourceWsId || resourceWsId.toString() !== wsOid.toString()) {
    // Return 404 rather than 403 to prevent cross-tenant enumeration attacks
    throw new WorkspaceAuthorizationError(`${resourceName} not found.`, 404, 'RESOURCE_NOT_FOUND');
  }
  return true;
}

/**
 * Generates a clean URL-safe slug from a business name
 */
export function generateSlug(name) {
  return String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

/**
 * Internal, idempotent workspace provisioning service.
 * Used for onboarding foundations and isolated integration testing.
 */
export async function provisionWorkspaceInternal({
  ownerId,
  name,
  slug,
  industryKey = 'other',
  businessEmail,
  businessPhone,
  country = 'India',
  city = '',
  timezone = 'Asia/Kolkata',
  currency = 'INR',
  settings = {},
  isDefault = true,
}) {
  const user = await User.findById(ownerId);
  if (!user) {
    throw new WorkspaceAuthorizationError('Owner user account not found.', 404, 'USER_NOT_FOUND');
  }

  const finalSlug = slug ? generateSlug(slug) : generateSlug(name);
  if (!finalSlug || finalSlug.length < 3) {
    throw new WorkspaceAuthorizationError('Slug must be at least 3 alphanumeric characters.', 400, 'INVALID_SLUG');
  }

  // Idempotency: check if identical workspace slug exists
  const existingWs = await Workspace.findOne({ slug: finalSlug });
  if (existingWs) {
    // Check if the current user is already the owner of this workspace
    const existingMembership = await WorkspaceMembership.findOne({
      workspaceId: existingWs._id,
      userId: user._id,
    });
    if (existingMembership && existingMembership.status === 'ACTIVE') {
      return { workspace: existingWs, membership: existingMembership, isExisting: true };
    }
    throw new WorkspaceAuthorizationError(`Workspace with slug "${finalSlug}" already exists.`, 409, 'SLUG_CONFLICT');
  }

  // Create Workspace
  const workspace = await Workspace.create({
    name,
    slug: finalSlug,
    industryKey,
    businessEmail: businessEmail || user.email,
    businessPhone: businessPhone || '+919811223344',
    country,
    city,
    timezone,
    currency,
    settings,
    status: 'ACTIVE',
    onboardingStatus: 'COMPLETED',
    createdBy: user._id,
  });

  // Create OWNER membership
  const membership = await WorkspaceMembership.create({
    workspaceId: workspace._id,
    userId: user._id,
    role: 'OWNER',
    status: 'ACTIVE',
    isDefaultWorkspace: isDefault,
    joinedAt: new Date(),
  });

  // If user has no default workspace, update it
  if (!user.defaultWorkspaceId || isDefault) {
    user.defaultWorkspaceId = workspace._id;
    await user.save();
  }

  return { workspace, membership, isExisting: false };
}
