import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Workspace, { VALID_INDUSTRIES } from '../models/Workspace.js';
import WorkspaceMembership from '../models/WorkspaceMembership.js';
import BusinessProfile from '../models/BusinessProfile.js';
import OnboardingDraft from '../models/OnboardingDraft.js';
import { generateSlug } from './workspaceContextService.js';
import { provisionNewWorkspaceSafely, provisionWorkspaceStarterData } from './industryStarterProvisioningService.js';

export const LOGOS_DIR = path.join(process.cwd(), 'uploads/logos');

export async function ensureLogosDir() {
  await fs.promises.mkdir(LOGOS_DIR, { recursive: true, mode: 0o700 });
}

// Ensure directory exists
ensureLogosDir().catch(console.error);

/**
 * Validates magic bytes for image uploads
 */
export async function verifyImageMagicBytes(filePath, ext) {
  const fh = await fs.promises.open(filePath, 'r');
  const buf = Buffer.alloc(16);
  const { bytesRead } = await fh.read(buf, 0, 16, 0);
  await fh.close();

  if (bytesRead < 4) return false;

  const normalizedExt = ext.toLowerCase();

  // JPEG: FF D8 FF
  if (['.jpg', '.jpeg'].includes(normalizedExt)) {
    return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  }
  // PNG: 89 50 4E 47
  if (normalizedExt === '.png') {
    return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  }
  // WEBP: RIFF .... WEBP
  if (normalizedExt === '.webp') {
    return (
      buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
      bytesRead >= 12 &&
      buf.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }

  return false;
}

/**
 * Validates that an authenticated user is eligible to onboard and provision a workspace.
 */
export async function validateProvisioningEligibility(userId) {
  const user = await User.findById(userId);
  if (!user) {
    return { eligible: false, status: 404, code: 'USER_NOT_FOUND', message: 'User account not found.' };
  }

  if (user.accountStatus === 'SUSPENDED' || user.accountStatus === 'DISABLED') {
    return {
      eligible: false,
      status: 403,
      code: 'ACCOUNT_RESTRICTED',
      message: 'Account is suspended or disabled. Onboarding is not permitted.',
    };
  }

  // Auto-activate user if email verification is not strictly enforced
  if (user.accountStatus === 'PENDING_EMAIL_VERIFICATION' || !user.isEmailVerified) {
    if (process.env.AUTH_REQUIRE_EMAIL_VERIFICATION !== 'true') {
      user.isEmailVerified = true;
      if (!user.emailVerifiedAt) user.emailVerifiedAt = new Date();
      user.accountStatus = 'ACTIVE';
      await user.save();
    } else {
      return {
        eligible: false,
        status: 403,
        code: 'EMAIL_VERIFICATION_REQUIRED',
        message: 'Email verification is required before starting business onboarding.',
      };
    }
  }

  // Check if user already owns an active workspace
  const existingMembership = await WorkspaceMembership.findOne({
    userId: user._id,
    status: 'ACTIVE',
  }).populate('workspaceId');

  if (existingMembership && existingMembership.workspaceId && existingMembership.workspaceId.status === 'ACTIVE') {
    return {
      eligible: false,
      status: 409,
      code: 'ALREADY_HAS_WORKSPACE',
      message: 'User already has an active business workspace.',
      workspace: existingMembership.workspaceId,
      membership: existingMembership,
    };
  }

  return { eligible: true, user };
}

/**
 * Retrieves the current onboarding draft for the user or creates a fresh one.
 */
export async function getOrCreateDraft(userId) {
  const eligibility = await validateProvisioningEligibility(userId);
  if (!eligibility.eligible) {
    const error = new Error(eligibility.message);
    error.status = eligibility.status;
    error.code = eligibility.code;
    if (eligibility.workspace) error.workspace = eligibility.workspace;
    throw error;
  }

  let draft = await OnboardingDraft.findOne({ userId });
  if (!draft) {
    draft = await OnboardingDraft.create({
      userId,
      step: 1,
      businessIdentity: {
        name: '',
        email: eligibility.user.email || '',
        phone: '',
        website: '',
        description: '',
      },
      industryKey: 'other',
      businessDetails: {
        address: '',
        city: '',
        state: '',
        country: 'India',
        timezone: 'Asia/Kolkata',
        preferredLanguage: 'en',
        industryMetadata: {},
      },
      branding: {
        logoUrl: '',
        logoFilename: '',
        logoMimeType: '',
        logoSizeBytes: 0,
      },
      status: 'DRAFT',
    });
  }

  return draft;
}

/**
 * Sanitizes and bounds industry metadata object to prevent prototype pollution or NoSQL injections
 */
function sanitizeIndustryMetadata(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const clean = {};
  const entries = Object.entries(raw).slice(0, 20); // max 20 keys
  for (const [key, val] of entries) {
    if (!key || typeof key !== 'string') continue;
    if (key.startsWith('$') || key.includes('.') || key === '__proto__' || key === 'constructor') continue;
    if (typeof val === 'string') {
      clean[key] = val.trim().slice(0, 500);
    } else if (typeof val === 'number' || typeof val === 'boolean') {
      clean[key] = val;
    } else if (Array.isArray(val)) {
      clean[key] = val.slice(0, 20).filter((item) => typeof item === 'string').map((s) => s.trim().slice(0, 100));
    }
  }
  return clean;
}

/**
 * Updates an onboarding draft safely with validation.
 */
export async function updateDraft(userId, data) {
  const draft = await getOrCreateDraft(userId);

  if (data.step !== undefined) {
    const s = Number(data.step);
    if (!Number.isNaN(s) && s >= 1 && s <= 6) {
      draft.step = s;
    }
  }

  if (data.businessIdentity && typeof data.businessIdentity === 'object') {
    const bi = data.businessIdentity;
    if (bi.name !== undefined) {
      draft.businessIdentity.name = String(bi.name).trim().slice(0, 120);
    }
    if (bi.email !== undefined) {
      const email = String(bi.email).trim().toLowerCase();
      draft.businessIdentity.email = email.slice(0, 120);
    }
    if (bi.phone !== undefined) {
      draft.businessIdentity.phone = String(bi.phone).trim().slice(0, 40);
    }
    if (bi.website !== undefined) {
      const web = String(bi.website).trim();
      // Basic scheme validation
      if (web && !/^https?:\/\//i.test(web) && !web.startsWith('//')) {
        draft.businessIdentity.website = `https://${web}`.slice(0, 240);
      } else {
        draft.businessIdentity.website = web.slice(0, 240);
      }
    }
    if (bi.description !== undefined) {
      draft.businessIdentity.description = String(bi.description).trim().slice(0, 2000);
    }
  }

  if (data.industryKey !== undefined) {
    const k = String(data.industryKey).toLowerCase().trim();
    if (VALID_INDUSTRIES.includes(k)) {
      draft.industryKey = k;
    } else {
      const err = new Error(`Invalid industry key: "${k}". Supported: ${VALID_INDUSTRIES.join(', ')}`);
      err.status = 400;
      err.code = 'INVALID_INDUSTRY';
      throw err;
    }
  }

  if (data.businessDetails && typeof data.businessDetails === 'object') {
    const bd = data.businessDetails;
    if (bd.address !== undefined) draft.businessDetails.address = String(bd.address).trim().slice(0, 300);
    if (bd.city !== undefined) draft.businessDetails.city = String(bd.city).trim().slice(0, 80);
    if (bd.state !== undefined) draft.businessDetails.state = String(bd.state).trim().slice(0, 80);
    if (bd.country !== undefined) draft.businessDetails.country = String(bd.country).trim().slice(0, 80);
    if (bd.preferredLanguage !== undefined) draft.businessDetails.preferredLanguage = String(bd.preferredLanguage).trim().slice(0, 20);

    if (bd.timezone !== undefined) {
      const tz = String(bd.timezone).trim();
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: tz });
        draft.businessDetails.timezone = tz;
      } catch {
        const err = new Error(`Invalid IANA timezone: "${tz}".`);
        err.status = 400;
        err.code = 'INVALID_TIMEZONE';
        throw err;
      }
    }

    if (bd.industryMetadata !== undefined) {
      draft.businessDetails.industryMetadata = sanitizeIndustryMetadata(bd.industryMetadata);
    }
  }

  await draft.save();
  return draft;
}

/**
 * Handles logo upload for the onboarding draft.
 */
export async function saveDraftLogo(userId, file) {
  if (!file) {
    const err = new Error('No logo file provided.');
    err.status = 400;
    err.code = 'MISSING_FILE';
    throw err;
  }

  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = ['.png', '.jpg', '.jpeg', '.webp'];

  if (!allowedExts.includes(ext)) {
    await fs.promises.unlink(file.path).catch(() => {});
    const err = new Error('Unsupported logo format. Allowed formats: PNG, JPEG, WEBP. Vector SVG uploads are prohibited for security.');
    err.status = 415;
    err.code = 'UNSUPPORTED_MEDIA_TYPE';
    throw err;
  }

  // 2 MB max size
  const maxBytes = 2 * 1024 * 1024;
  if (file.size > maxBytes) {
    await fs.promises.unlink(file.path).catch(() => {});
    const err = new Error('Logo exceeds maximum allowed file size of 2 MB.');
    err.status = 413;
    err.code = 'FILE_TOO_LARGE';
    throw err;
  }

  // Content magic bytes inspection
  const isValidContent = await verifyImageMagicBytes(file.path, ext);
  if (!isValidContent) {
    await fs.promises.unlink(file.path).catch(() => {});
    const err = new Error('File content does not match its declared image extension. Spoofed or corrupted image rejected.');
    err.status = 400;
    err.code = 'SPOOFED_FILE_CONTENT';
    throw err;
  }

  await ensureLogosDir();
  const safeFilename = `logo-${userId}-${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
  const permanentPath = path.join(LOGOS_DIR, safeFilename);

  await fs.promises.rename(file.path, permanentPath);

  const draft = await getOrCreateDraft(userId);

  // If there was an old logo, clean it up
  if (draft.branding.logoFilename && draft.branding.logoFilename !== safeFilename) {
    const oldPath = path.join(LOGOS_DIR, draft.branding.logoFilename);
    await fs.promises.unlink(oldPath).catch(() => {});
  }

  const logoUrl = `/api/onboarding/logo/${safeFilename}`;
  draft.branding = {
    logoUrl,
    logoFilename: safeFilename,
    logoMimeType: file.mimetype,
    logoSizeBytes: file.size,
  };

  await draft.save();
  return {
    logoUrl,
    filename: safeFilename,
    sizeBytes: file.size,
    mimeType: file.mimetype,
    draft,
  };
}

/**
 * Removes the logo from an onboarding draft.
 */
export async function removeDraftLogo(userId) {
  const draft = await getOrCreateDraft(userId);
  if (draft.branding.logoFilename) {
    const filePath = path.join(LOGOS_DIR, draft.branding.logoFilename);
    await fs.promises.unlink(filePath).catch(() => {});
  }

  draft.branding = {
    logoUrl: '',
    logoFilename: '',
    logoMimeType: '',
    logoSizeBytes: 0,
  };

  await draft.save();
  return draft;
}

/**
 * Generates an available unique slug for a workspace name.
 * Handles collisions gracefully by appending random alphanumeric suffixes.
 */
async function generateUniqueWorkspaceSlug(name) {
  const baseSlug = generateSlug(name) || 'workspace';
  let candidate = baseSlug.slice(0, 50);

  const existing = await Workspace.findOne({ slug: candidate });
  if (!existing) return candidate;

  // Collision detected: generate unique suffix
  for (let attempt = 1; attempt <= 10; attempt++) {
    const suffix = crypto.randomBytes(3).toString('hex'); // 6 chars
    const candidateWithSuffix = `${baseSlug.slice(0, 43)}-${suffix}`;
    const match = await Workspace.findOne({ slug: candidateWithSuffix });
    if (!match) return candidateWithSuffix;
  }

  return `${baseSlug.slice(0, 35)}-${Date.now()}`;
}

/**
 * Validates E.164 international phone number format
 */
export function isValidE164(phone) {
  if (!phone || typeof phone !== 'string') return false;
  return /^\+[1-9]\d{7,14}$/.test(phone.trim());
}

/**
 * Automatically provisions an authorized Workspace, OWNER Membership,
 * and BusinessProfile from an approved onboarding draft.
 * Idempotent: repeated calls by the same user return the existing provisioned workspace.
 */
export async function provisionWorkspaceFromDraft(userId) {
  const eligibility = await validateProvisioningEligibility(userId);
  if (!eligibility.eligible) {
    if (eligibility.code === 'ALREADY_HAS_WORKSPACE') {
      // Idempotent return of existing workspace
      const existingProfile = await BusinessProfile.findOne({ ownerId: userId });
      const ws = eligibility.workspace;
      let starterProvisioning = ws?.starterProvisioning || null;
      // Resume an interrupted provisioning for workspaces created by this flow only.
      // Legacy workspaces (no starterProvisioning field) are never seeded here.
      if (starterProvisioning && starterProvisioning.status !== 'COMPLETED' && String(ws.createdBy) === String(userId)) {
        try {
          starterProvisioning = await provisionWorkspaceStarterData({ workspaceId: ws._id, ownerId: userId, industryKey: ws.industryKey });
        } catch (err) {
          starterProvisioning = { status: 'FAILED', error: err.code || 'PROVISIONING_FAILED', message: err.message };
        }
      }
      return {
        isExisting: true,
        workspace: ws,
        membership: eligibility.membership,
        businessProfile: existingProfile,
        starterProvisioning,
      };
    }
    const err = new Error(eligibility.message);
    err.status = eligibility.status;
    err.code = eligibility.code;
    throw err;
  }

  const draft = await OnboardingDraft.findOne({ userId });
  if (!draft) {
    const err = new Error('Onboarding draft not found. Please complete the business setup form.');
    err.status = 400;
    err.code = 'DRAFT_NOT_FOUND';
    throw err;
  }

  const { businessIdentity, industryKey, businessDetails, branding } = draft;

  // Validation of required fields
  const name = businessIdentity.name?.trim();
  if (!name || name.length < 2) {
    const err = new Error('Business name is required and must be at least 2 characters.');
    err.status = 400;
    err.code = 'INVALID_BUSINESS_NAME';
    throw err;
  }

  const email = businessIdentity.email?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const err = new Error('A valid business email address is required.');
    err.status = 400;
    err.code = 'INVALID_BUSINESS_EMAIL';
    throw err;
  }

  let phone = businessIdentity.phone?.trim();
  if (phone) {
    // If not starting with +, provide helpful normalization if 10-digit Indian number
    if (/^[6-9]\d{9}$/.test(phone)) {
      phone = `+91${phone}`;
    }
    if (!isValidE164(phone)) {
      const err = new Error('Business phone must be in valid E.164 international format (e.g. +919811223344).');
      err.status = 400;
      err.code = 'INVALID_PHONE_FORMAT';
      throw err;
    }
  } else {
    // Fallback safe placeholder phone if omitted
    phone = '+919800000000';
  }

  const uniqueSlug = await generateUniqueWorkspaceSlug(name);

  // Atomically claim the draft (compare-and-swap on the state we observed) so
  // concurrent/duplicate submissions cannot create two workspaces. A claim older
  // than 2 minutes is treated as a crashed attempt and may be taken over.
  const staleBefore = new Date(Date.now() - 2 * 60 * 1000);
  const inFlight = () => {
    const err = new Error('Workspace setup is already in progress. Please wait a moment and refresh.');
    err.status = 409;
    err.code = 'PROVISIONING_IN_PROGRESS';
    return err;
  };
  if (draft.status === 'PROVISIONING' && draft.updatedAt && draft.updatedAt >= staleBefore) throw inFlight();
  const claimedDraft = await OnboardingDraft.findOneAndUpdate(
    { _id: draft._id, status: draft.status, updatedAt: draft.updatedAt },
    { $set: { status: 'PROVISIONING' } },
    { new: true }
  );
  if (!claimedDraft) {
    const recheck = await validateProvisioningEligibility(userId);
    if (recheck.code === 'ALREADY_HAS_WORKSPACE') return provisionWorkspaceFromDraft(userId);
    throw inFlight();
  }
  // A concurrent request may have finished between our eligibility check and claim.
  const finishedMeanwhile = (await validateProvisioningEligibility(userId)).code === 'ALREADY_HAS_WORKSPACE';
  if (finishedMeanwhile) {
    await OnboardingDraft.updateOne({ _id: draft._id }, { $set: { status: 'COMPLETED' } });
    return provisionWorkspaceFromDraft(userId);
  }
  draft.status = 'PROVISIONING';

  try {
    // Create Workspace
    const workspace = await Workspace.create({
      name,
      slug: uniqueSlug,
      industryKey: industryKey || 'other',
      businessEmail: email,
      businessPhone: phone,
      country: businessDetails.country || 'India',
      city: businessDetails.city || '',
      timezone: businessDetails.timezone || 'Asia/Kolkata',
      currency: 'INR',
      status: 'ACTIVE',
      onboardingStatus: 'COMPLETED',
      logoUrl: branding.logoUrl || '',
      logoReference: branding.logoFilename || '',
      settings: {
        ...businessDetails.industryMetadata,
        description: businessIdentity.description || '',
        website: businessIdentity.website || '',
        preferredLanguage: businessDetails.preferredLanguage || 'en',
      },
      createdBy: userId,
    });

    // Create OWNER membership
    const membership = await WorkspaceMembership.create({
      workspaceId: workspace._id,
      userId,
      role: 'OWNER',
      status: 'ACTIVE',
      isDefaultWorkspace: true,
      joinedAt: new Date(),
    });

    // Create or Update BusinessProfile
    const businessProfile = await BusinessProfile.findOneAndUpdate(
      { ownerId: userId },
      {
        $set: {
          workspaceId: workspace._id,
          legalOrTradingName: name,
          displayName: name,
          businessCategory: industryKey || 'other',
          email,
          phone,
          website: businessIdentity.website || '',
          description: businessIdentity.description || '',
          address: businessDetails.address || '',
          city: businessDetails.city || '',
          state: businessDetails.state || '',
          country: businessDetails.country || 'India',
          logoUrl: branding.logoUrl || '',
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Update User default workspace
    await User.findByIdAndUpdate(userId, { defaultWorkspaceId: workspace._id });

    // Mark draft COMPLETED
    draft.status = 'COMPLETED';
    draft.provisionedWorkspaceId = workspace._id;
    await draft.save();

    // Provision the industry starter pack (15 templates, 8 quick replies,
    // 5 disabled rules, 2 draft campaigns). Never throws: a failure is reported
    // honestly and can be retried without losing the account or workspace.
    const starterProvisioning = await provisionNewWorkspaceSafely({
      workspaceId: workspace._id,
      ownerId: userId,
      industryKey: workspace.industryKey,
    });

    return {
      isExisting: false,
      workspace: await Workspace.findById(workspace._id),
      membership,
      businessProfile,
      starterProvisioning,
    };
  } catch (err) {
    draft.status = 'FAILED';
    await draft.save().catch(() => {});
    throw err;
  }
}
