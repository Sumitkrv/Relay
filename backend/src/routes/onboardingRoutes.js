import { Router } from 'express';
import os from 'os';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.js';
import * as onboardingController from '../controllers/onboardingController.js';

const router = Router();

// Multer temporary upload config
const tempUploadDir = path.join(os.tmpdir(), 'relay-onboarding-uploads');
fs.mkdirSync(tempUploadDir, { recursive: true, mode: 0o700 });

const uploadStorage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, tempUploadDir);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '');
    cb(null, `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
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

const logoUploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { message: 'Too many logo upload requests. Please try again later.' },
});

const provisioningLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { message: 'Too many provisioning attempts. Please try again later.' },
});

// Public logo serving (safely serves image bytes with nosniff and cache headers)
router.get('/logo/:filename', onboardingController.serveLogo);

// All subsequent onboarding endpoints require authenticated and verified sessions
router.use(requireAuth);

router.get('/status', onboardingController.getOnboardingStatus);
router.get('/draft', onboardingController.getDraft);
router.put('/draft', onboardingController.putDraft);
router.post(
  '/logo',
  logoUploadLimiter,
  upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'file', maxCount: 1 }]),
  onboardingController.uploadLogo
);
router.delete('/logo', onboardingController.deleteLogo);
router.post('/complete', provisioningLimiter, onboardingController.completeOnboarding);

export default router;
