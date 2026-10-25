import { Router } from 'express';
import os from 'os';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import mongoose from 'mongoose';
import WorkspaceMembership from '../models/WorkspaceMembership.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  getProfile,
  updateProfile,
  getBusinessProfile,
  updateBusinessProfile,
  uploadBusinessLogo,
  deleteBusinessLogo,
  getPreferences,
  updatePreferences,
  getSecurityOverview,
  getIntegrationStatus,
  getSystemStatus,
  getDemoStatus,
  triggerDemoSeed,
  triggerDemoReset,
} from '../controllers/settingsController.js';

const router = Router();

// Multer temporary upload config for logo
const tempUploadDir = path.join(os.tmpdir(), 'relay-settings-uploads');
fs.mkdirSync(tempUploadDir, { recursive: true, mode: 0o700 });

const uploadStorage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, tempUploadDir);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '');
    cb(null, `logo-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage: uploadStorage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB
    files: 1,
  },
  fileFilter(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = ['.png', '.jpg', '.jpeg', '.webp'];
    if (!allowed.includes(ext)) {
      return cb(
        Object.assign(
          new Error('Unsupported logo format. Allowed: PNG, JPEG, WEBP. Vector SVG uploads are prohibited.'),
          { status: 415 }
        )
      );
    }
    cb(null, true);
  },
});

// All settings routes require authentication
router.use(requireAuth);

// A client-supplied x-workspace-id is never trusted: it must belong to the caller.
router.use(
  asyncHandler(async (req, res, next) => {
    const wsId = req.get('x-workspace-id');
    if (!wsId) return next();
    if (!mongoose.isObjectIdOrHexString(wsId)) {
      return res.status(400).json({ code: 'INVALID_WORKSPACE_ID', message: 'Invalid workspace ID.' });
    }
    const owned = await WorkspaceMembership.exists({ workspaceId: wsId, userId: req.user._id, status: 'ACTIVE' });
    if (!owned) {
      return res.status(403).json({ code: 'FORBIDDEN_WORKSPACE_ACCESS', message: 'You do not have access to this business workspace.' });
    }
    next();
  })
);

router.get('/profile', asyncHandler(getProfile));
router.patch('/profile', asyncHandler(updateProfile));

router.get('/business', asyncHandler(getBusinessProfile));
router.put('/business', asyncHandler(updateBusinessProfile));
router.post('/logo', upload.single('logo'), asyncHandler(uploadBusinessLogo));
router.delete('/logo', asyncHandler(deleteBusinessLogo));

router.get('/preferences', asyncHandler(getPreferences));
router.put('/preferences', asyncHandler(updatePreferences));

router.get('/security', asyncHandler(getSecurityOverview));
router.get('/integrations', asyncHandler(getIntegrationStatus));
router.get('/system-status', asyncHandler(getSystemStatus));
router.get('/demo-status', asyncHandler(getDemoStatus));
router.post('/demo-seed', asyncHandler(triggerDemoSeed));
router.post('/demo-reset', asyncHandler(triggerDemoReset));

export default router;

