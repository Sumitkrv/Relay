import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import TemplateMedia from '../models/TemplateMedia.js';

const router = Router();
router.use(requireAuth);

const MEDIA_DIR = path.join(process.cwd(), 'uploads', 'template-media');

export async function ensureMediaDir() {
  await fs.promises.mkdir(MEDIA_DIR, { recursive: true, mode: 0o700 });
}

// Ensure directory exists on load
ensureMediaDir().catch(console.error);

const uploadLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Media upload rate limit reached. Please try again later.' }
});

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    fs.mkdir(MEDIA_DIR, { recursive: true, mode: 0o700 }, (err) => {
      if (err) return cb(err);
      cb(null, MEDIA_DIR);
    });
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '');
    const unique = `${Date.now()}-${crypto.randomBytes(12).toString('hex')}${ext}`;
    cb(null, unique);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 16 * 1024 * 1024, // 16 MB max for video, smaller for images/docs enforced in filter
    files: 1
  },
  fileFilter(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.mp4', '.3gp', '.pdf'];
    if (!allowed.includes(ext)) {
      return cb(
        Object.assign(
          new Error('Unsupported media format. Supported formats: JPEG, PNG, WEBP, MP4, 3GPP, and PDF.'),
          { status: 415 }
        )
      );
    }
    cb(null, true);
  }
});

async function verifyMagicBytes(filePath, ext) {
  const fh = await fs.promises.open(filePath, 'r');
  const buf = Buffer.alloc(16);
  const { bytesRead } = await fh.read(buf, 0, 16, 0);
  await fh.close();

  if (bytesRead < 4) return false;

  // PDF: starts with %PDF
  if (ext === '.pdf') {
    return buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46;
  }
  // JPEG: starts with FF D8 FF
  if (['.jpg', '.jpeg'].includes(ext)) {
    return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  }
  // PNG: starts with 89 50 4E 47
  if (ext === '.png') {
    return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  }
  // WEBP: starts with RIFF ... WEBP
  if (ext === '.webp') {
    return buf.subarray(0, 4).toString() === 'RIFF';
  }
  // MP4: contains ftyp
  if (['.mp4', '.3gp'].includes(ext)) {
    return buf.subarray(4, 8).toString() === 'ftyp' || buf.subarray(0, 4).toString() === '\x00\x00\x00\x18';
  }
  return true;
}

function determineMediaType(ext) {
  if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) return 'IMAGE';
  if (['.mp4', '.3gp'].includes(ext)) return 'VIDEO';
  if (ext === '.pdf') return 'DOCUMENT';
  return 'DOCUMENT';
}

router.post('/', uploadLimit, upload.fields([{ name: 'file', maxCount: 1 }, { name: 'media', maxCount: 1 }]), asyncHandler(async (req, res) => {
  const file = req.files?.file?.[0] || req.files?.media?.[0] || req.file;
  if (!file) {
    return res.status(400).json({ message: 'No file uploaded. Provide a file in field "file" or "media".' });
  }

  const ext = path.extname(file.originalname).toLowerCase();
  const mediaType = determineMediaType(ext);

  // Size limit validation by type
  const maxSizes = {
    IMAGE: 5 * 1024 * 1024,
    DOCUMENT: 10 * 1024 * 1024,
    VIDEO: 16 * 1024 * 1024
  };

  if (file.size > maxSizes[mediaType]) {
    await fs.promises.unlink(file.path).catch(() => {});
    return res.status(400).json({
      message: `File exceeds maximum allowed size of ${maxSizes[mediaType] / (1024 * 1024)} MB for ${mediaType.toLowerCase()}s.`
    });
  }

  // Magic bytes content inspection
  const isValidContent = await verifyMagicBytes(file.path, ext);
  if (!isValidContent) {
    await fs.promises.unlink(file.path).catch(() => {});
    return res.status(400).json({
      message: 'File content does not match its declared extension. Potential corrupt or spoofed file rejected.'
    });
  }

  // Calculate sha256 checksum
  const fileBuffer = await fs.promises.readFile(file.path);
  const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

  const mediaDoc = await TemplateMedia.create({
    ownerId: req.user._id,
    storageKey: path.basename(file.path),
    originalFileName: file.originalname.slice(0, 255),
    mimeType: file.mimetype || 'application/octet-stream',
    sizeBytes: file.size,
    checksum,
    mediaType,
    storagePath: file.path,
    storageStatus: 'active'
  });

  res.status(201).json({
    media: {
      _id: mediaDoc._id,
      id: mediaDoc._id,
      storageKey: mediaDoc.storageKey,
      mediaType: mediaDoc.mediaType,
      originalFileName: mediaDoc.originalFileName,
      sizeBytes: mediaDoc.sizeBytes,
      mimeType: mediaDoc.mimeType,
      url: `/api/template-media/${mediaDoc._id}`,
      createdAt: mediaDoc.createdAt
    }
  });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) {
    return res.status(400).json({ message: 'Invalid media ID.' });
  }

  const media = await TemplateMedia.findOne({
    _id: req.params.id,
    ownerId: req.user._id,
    storageStatus: 'active'
  });

  if (!media) {
    return res.status(404).json({ message: 'Media not found.' });
  }

  try {
    await fs.promises.access(media.storagePath, fs.constants.R_OK);
  } catch {
    return res.status(404).json({ message: 'Media file missing on server.' });
  }

  const safeName = encodeURIComponent(media.originalFileName);
  res.setHeader('Content-Type', media.mimeType);
  res.setHeader('Content-Length', media.sizeBytes);
  res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  fs.createReadStream(media.storagePath).pipe(res);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) {
    return res.status(400).json({ message: 'Invalid media ID.' });
  }

  const media = await TemplateMedia.findOne({
    _id: req.params.id,
    ownerId: req.user._id
  });

  if (!media) {
    return res.status(404).json({ message: 'Media not found.' });
  }

  media.storageStatus = 'deleted';
  await media.save();
  await fs.promises.unlink(media.storagePath).catch(() => {});

  res.json({ message: 'Media removed successfully.' });
}));

export default router;
