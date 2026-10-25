import express from 'express';
import rateLimit from 'express-rate-limit';
import { submitContactEnquiry } from '../controllers/publicContactController.js';

const router = express.Router();

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // limit each IP to 15 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many contact requests. Please wait a few minutes before submitting again.',
  },
});

router.post('/contact', contactLimiter, submitContactEnquiry);

export default router;
