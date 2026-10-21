import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  register,
  verifyEmail,
  resendVerification,
  login,
  logout,
  me,
  forgotPassword,
  resetPassword,
  updatePassword,
  updateProfile,
} from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// General auth rate limiter (30 requests per 15 min window in production)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { message: 'Too many authentication attempts. Please try again later.' },
});

// Stricter recovery / resend rate limiter (10 requests per 15 min window in production)
const recoveryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { message: 'Too many requests. Please try again in a few minutes.' },
});

// Registration & Verification
router.post('/register', authLimiter, asyncHandler(register));
router.post('/verify-email', authLimiter, asyncHandler(verifyEmail));
router.post('/resend-verification', recoveryLimiter, asyncHandler(resendVerification));

// Login & Session
router.post('/login', authLimiter, asyncHandler(login));
router.post('/logout', logout);
router.get('/me', requireAuth, asyncHandler(me));

// Password Recovery & Reset
router.post('/forgot-password', recoveryLimiter, asyncHandler(forgotPassword));
router.post('/reset-password', recoveryLimiter, asyncHandler(resetPassword));

// Authenticated Account Updates
router.patch('/profile', requireAuth, asyncHandler(updateProfile));
router.patch('/password', requireAuth, asyncHandler(updatePassword));
router.post('/change-password', requireAuth, asyncHandler(updatePassword));

export default router;
