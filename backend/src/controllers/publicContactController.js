import crypto from 'crypto';
import PublicEnquiry from '../models/PublicEnquiry.js';

export async function submitContactEnquiry(req, res, next) {
  try {
    const {
      fullName,
      businessEmail,
      businessName,
      industry = 'other',
      contactReason = 'general',
      phone = '',
      message,
    } = req.body;

    // 1. Validation
    if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2) {
      return res.status(400).json({ code: 'INVALID_NAME', message: 'Full name is required (at least 2 characters).' });
    }

    if (!businessEmail || typeof businessEmail !== 'string') {
      return res.status(400).json({ code: 'INVALID_EMAIL', message: 'A valid business email address is required.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const cleanEmail = businessEmail.toLowerCase().trim();
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ code: 'INVALID_EMAIL', message: 'Please provide a valid email format.' });
    }

    if (!businessName || typeof businessName !== 'string' || businessName.trim().length < 2) {
      return res.status(400).json({ code: 'INVALID_BUSINESS_NAME', message: 'Business name is required.' });
    }

    if (!message || typeof message !== 'string' || message.trim().length < 5) {
      return res.status(400).json({ code: 'INVALID_MESSAGE', message: 'Message must be at least 5 characters.' });
    }

    const validIndustries = ['real_estate', 'gym', 'clinic', 'education', 'salon', 'automobile', 'other'];
    const safeIndustry = validIndustries.includes(industry) ? industry : 'other';

    const validReasons = ['general', 'early_access', 'pricing', 'agency_partnership', 'technical'];
    const safeReason = validReasons.includes(contactReason) ? contactReason : 'general';

    // Hash client IP for privacy-preserving spam prevention
    const rawIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
    const ipHash = rawIp ? crypto.createHash('sha256').update(String(rawIp)).digest('hex').slice(0, 16) : '';

    // 2. Persist
    const enquiry = await PublicEnquiry.create({
      fullName: fullName.trim().slice(0, 120),
      businessEmail: cleanEmail.slice(0, 254),
      businessName: businessName.trim().slice(0, 160),
      industry: safeIndustry,
      contactReason: safeReason,
      phone: String(phone || '').trim().slice(0, 30),
      message: message.trim().slice(0, 2000),
      ipHash,
      status: 'new',
    });

    return res.status(201).json({
      success: true,
      code: 'ENQUIRY_SUBMITTED',
      message: 'Thank you for reaching out. The Relay team will review your enquiry and respond within 1 business day.',
      enquiryId: enquiry._id,
    });
  } catch (err) {
    next(err);
  }
}
