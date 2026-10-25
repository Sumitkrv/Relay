import path from 'path';
import fs from 'fs';
import { asyncHandler } from '../utils/asyncHandler.js';
import OnboardingDraft from '../models/OnboardingDraft.js';
import WorkspaceMembership from '../models/WorkspaceMembership.js';
import {
  validateProvisioningEligibility,
  getOrCreateDraft,
  updateDraft,
  saveDraftLogo,
  removeDraftLogo,
  provisionWorkspaceFromDraft,
  LOGOS_DIR,
} from '../services/workspaceProvisioningService.js';

/**
 * GET /api/onboarding/status
 * Returns onboarding progress, draft state, and workspace status
 */
export const getOnboardingStatus = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Check if user already has an active workspace
  const activeMembership = await WorkspaceMembership.findOne({
    userId,
    status: 'ACTIVE',
  }).populate('workspaceId');

  if (activeMembership && activeMembership.workspaceId && activeMembership.workspaceId.status === 'ACTIVE') {
    return res.json({
      hasWorkspace: true,
      workspace: activeMembership.workspaceId,
      membership: {
        role: activeMembership.role,
        status: activeMembership.status,
        joinedAt: activeMembership.joinedAt,
      },
      hasDraft: false,
      draft: null,
      currentStep: 6,
    });
  }

  // Check eligibility for unverified accounts
  const isVerified = Boolean(
    req.user.emailVerifiedAt &&
    req.user.accountStatus !== 'PENDING_EMAIL_VERIFICATION' &&
    req.user.isEmailVerified !== false
  );

  if (!isVerified) {
    return res.status(403).json({
      code: 'EMAIL_VERIFICATION_REQUIRED',
      message: 'Email verification is required before starting business onboarding.',
    });
  }

  const draft = await OnboardingDraft.findOne({ userId });

  res.json({
    hasWorkspace: false,
    workspace: null,
    membership: null,
    hasDraft: Boolean(draft),
    draft,
    currentStep: draft?.step || 1,
  });
});

/**
 * GET /api/onboarding/draft
 * Fetches the user's active onboarding draft
 */
export const getDraft = asyncHandler(async (req, res) => {
  const draft = await getOrCreateDraft(req.user._id);
  res.json({ draft });
});

/**
 * PUT /api/onboarding/draft
 * Saves or updates onboarding draft values
 */
export const putDraft = asyncHandler(async (req, res) => {
  const draft = await updateDraft(req.user._id, req.body);
  res.json({ message: 'Draft saved successfully.', draft });
});

/**
 * POST /api/onboarding/logo
 * Uploads a business logo to the draft
 */
export const uploadLogo = asyncHandler(async (req, res) => {
  const file = req.file || req.files?.logo?.[0] || req.files?.file?.[0];
  if (!file) {
    return res.status(400).json({ message: 'No image file uploaded.' });
  }

  const result = await saveDraftLogo(req.user._id, file);
  res.json({
    message: 'Logo uploaded successfully.',
    logoUrl: result.logoUrl,
    filename: result.filename,
    sizeBytes: result.sizeBytes,
    mimeType: result.mimeType,
  });
});

/**
 * GET /api/onboarding/logo/:filename
 * Safely serves an uploaded logo image
 */
export const serveLogo = asyncHandler(async (req, res) => {
  const { filename } = req.params;

  // Prevent path traversal
  if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).json({ message: 'Invalid logo filename.' });
  }

  const filePath = path.join(LOGOS_DIR, filename);

  try {
    await fs.promises.access(filePath, fs.constants.R_OK);
  } catch {
    return res.status(404).json({ message: 'Logo image not found.' });
  }

  const ext = path.extname(filename).toLowerCase();
  const mimeTypes = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
  };

  const contentType = mimeTypes[ext] || 'application/octet-stream';
  res.setHeader('Content-Type', contentType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'public, max-age=86400');

  fs.createReadStream(filePath).pipe(res);
});

/**
 * DELETE /api/onboarding/logo
 * Removes the logo from the draft
 */
export const deleteLogo = asyncHandler(async (req, res) => {
  const draft = await removeDraftLogo(req.user._id);
  res.json({ message: 'Logo removed successfully.', draft });
});

/**
 * POST /api/onboarding/complete
 * Atomically provisions workspace, OWNER membership, and BusinessProfile
 */
export const completeOnboarding = asyncHandler(async (req, res) => {
  const result = await provisionWorkspaceFromDraft(req.user._id);
  res.status(result.isExisting ? 200 : 201).json({
    message: result.isExisting
      ? 'Existing business workspace matched.'
      : 'Business workspace provisioned successfully.',
    workspace: result.workspace,
    membership: result.membership,
    businessProfile: result.businessProfile,
    starterProvisioning: result.starterProvisioning || null,
  });
});
