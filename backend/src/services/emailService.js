/**
 * Transactional Email Service
 * 
 * Provides an enterprise-grade email delivery abstraction supporting:
 * 1. In-memory mailbox for automated tests and isolated local development.
 * 2. Resend API integration via HTTPS for production delivery.
 * 3. SMTP configuration adapter for custom email relays.
 * 4. Professional Midnight Slate × Jade responsive HTML & plain-text templates.
 */

import nodemailer from 'nodemailer';

// In-memory mailbox for testing and local inspection
const inMemoryMailbox = [];

export function getEmailHistory() {
  return [...inMemoryMailbox];
}

export function getLastEmail() {
  return inMemoryMailbox.length > 0 ? inMemoryMailbox[inMemoryMailbox.length - 1] : null;
}

export function clearEmailHistory() {
  inMemoryMailbox.length = 0;
}

/**
 * Base email dispatcher
 */
export async function sendEmail({ to, subject, html, text, from = null }) {
  const sender = from || process.env.SMTP_FROM || process.env.EMAIL_FROM || 'Relay <notifications@relayautomation.io>';
  const provider = (process.env.EMAIL_PROVIDER || 'inmemory').toLowerCase();

  const emailRecord = {
    to,
    from: sender,
    subject,
    html,
    text,
    sentAt: new Date(),
    provider,
  };

  // 1. In-memory / Test Mode / Mock Provider
  if (provider === 'inmemory' || provider === 'mock' || (process.env.NODE_ENV === 'test' && provider !== 'smtp')) {
    inMemoryMailbox.push(emailRecord);
    return { success: true, messageId: `mock_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`, inMemory: true };
  }

  // 2. SMTP Provider (Brevo / Sendinblue / Custom SMTP)
  if (provider === 'smtp') {
    const host = process.env.SMTP_HOST || 'smtp-relay.brevo.com';
    const port = Number(process.env.SMTP_PORT || 587);
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!user || user === 'YOUR_BREVO_SMTP_LOGIN' || !pass || pass === 'YOUR_BREVO_SMTP_KEY') {
      console.warn('[EmailService] SMTP credentials are not fully configured (placeholder detected). Intercepting email in local test mailbox.');
      inMemoryMailbox.push(emailRecord);
      return { success: true, messageId: `mock_smtp_placeholder_${Date.now()}`, inMemory: true, note: 'SMTP placeholder detected' };
    }

    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
          user,
          pass,
        },
      });

      const info = await transporter.sendMail({
        from: sender,
        to: Array.isArray(to) ? to.join(', ') : to,
        subject,
        text,
        html,
      });

      inMemoryMailbox.push({ ...emailRecord, messageId: info.messageId, provider: 'smtp' });
      return { success: true, messageId: info.messageId, provider: 'smtp' };
    } catch (err) {
      console.error('[EmailService] SMTP delivery failed:', err.message);
      // Keep in local mailbox for safety so verification is never lost
      inMemoryMailbox.push({ ...emailRecord, error: err.message });
      throw err;
    }
  }

  // 3. Resend Provider
  if (provider === 'resend') {
    const apiKey = process.env.EMAIL_API_KEY;
    if (!apiKey) {
      throw new Error('EMAIL_API_KEY is required for Resend email provider.');
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: sender,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        text,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Resend email delivery failed (${response.status}): ${errBody}`);
    }

    const data = await response.json();
    return { success: true, messageId: data.id, provider: 'resend' };
  }

  // Fallback to in-memory record if provider not explicitly recognized
  inMemoryMailbox.push(emailRecord);
  return { success: true, messageId: `mock_fallback_${Date.now()}`, inMemory: true };
}

/**
 * Sends account verification email
 */
export async function sendVerificationEmail({ to, name, verificationUrl, token }) {
  const recipientName = name ? name.split(' ')[0] : 'there';
  const subject = 'Verify your Relay account email';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F5F7FA; margin: 0; padding: 0; }
    .container { max-width: 580px; margin: 40px auto; background-color: #FFFFFF; border-radius: 16px; border: 1px solid #E5E7EB; overflow: hidden; }
    .header { background-color: #111827; padding: 32px 40px; text-align: left; }
    .brand { color: #FFFFFF; font-size: 20px; font-weight: 800; letter-spacing: -0.5px; }
    .brand span { color: #2563EB; }
    .content { padding: 40px; color: #1F2937; line-height: 1.6; }
    h1 { font-size: 22px; font-weight: 700; color: #111827; margin-top: 0; margin-bottom: 16px; }
    p { font-size: 15px; color: #4B5563; margin-bottom: 24px; }
    .btn { display: inline-block; background-color: #2563EB; color: #FFFFFF !important; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 10px; margin-bottom: 24px; }
    .fallback-url { font-size: 12px; color: #6B7280; word-break: break-all; background-color: #F9FAFB; padding: 12px; border-radius: 8px; border: 1px solid #E5E7EB; margin-bottom: 24px; }
    .notice { font-size: 13px; color: #6B7280; border-top: 1px solid #E5E7EB; padding-top: 24px; margin-top: 32px; }
    .footer { background-color: #F9FAFB; padding: 20px 40px; text-align: center; font-size: 12px; color: #9CA3AF; border-top: 1px solid #E5E7EB; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">RELAY<span>.</span></div>
    </div>
    <div class="content">
      <h1>Verify your email address</h1>
      <p>Hello ${recipientName},</p>
      <p>Welcome to Relay! Please confirm your email address to activate your account and proceed with business workspace onboarding.</p>
      
      <div style="text-align: center; margin: 32px 0;">
        <a href="${verificationUrl}" class="btn">Verify Email Address</a>
      </div>

      <p style="font-size: 13px; margin-bottom: 8px;">If the button above doesn't work, copy and paste this link into your browser:</p>
      <div class="fallback-url">${verificationUrl}</div>

      <div class="notice">
        <strong>Security Notice:</strong> This verification link will expire in 24 hours. If you did not create a Relay account, please disregard this email.
      </div>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} Relay SaaS. All rights reserved.
    </div>
  </div>
</body>
</html>
`;

  const text = `
Hello ${recipientName},

Welcome to Relay! Please verify your email address to activate your account:

${verificationUrl}

This link is valid for 24 hours.

If you did not sign up for Relay, please disregard this message.

© ${new Date().getFullYear()} Relay SaaS
`;

  return sendEmail({ to, subject, html, text });
}

/**
 * Sends password reset email
 */
export async function sendPasswordResetEmail({ to, name, resetUrl, token }) {
  const recipientName = name ? name.split(' ')[0] : 'there';
  const subject = 'Reset your Relay password';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F5F7FA; margin: 0; padding: 0; }
    .container { max-width: 580px; margin: 40px auto; background-color: #FFFFFF; border-radius: 16px; border: 1px solid #E5E7EB; overflow: hidden; }
    .header { background-color: #111827; padding: 32px 40px; text-align: left; }
    .brand { color: #FFFFFF; font-size: 20px; font-weight: 800; letter-spacing: -0.5px; }
    .brand span { color: #2563EB; }
    .content { padding: 40px; color: #1F2937; line-height: 1.6; }
    h1 { font-size: 22px; font-weight: 700; color: #111827; margin-top: 0; margin-bottom: 16px; }
    p { font-size: 15px; color: #4B5563; margin-bottom: 24px; }
    .btn { display: inline-block; background-color: #2563EB; color: #FFFFFF !important; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 10px; margin-bottom: 24px; }
    .fallback-url { font-size: 12px; color: #6B7280; word-break: break-all; background-color: #F9FAFB; padding: 12px; border-radius: 8px; border: 1px solid #E5E7EB; margin-bottom: 24px; }
    .notice { font-size: 13px; color: #6B7280; border-top: 1px solid #E5E7EB; padding-top: 24px; margin-top: 32px; }
    .footer { background-color: #F9FAFB; padding: 20px 40px; text-align: center; font-size: 12px; color: #9CA3AF; border-top: 1px solid #E5E7EB; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">RELAY<span>.</span></div>
    </div>
    <div class="content">
      <h1>Reset your password</h1>
      <p>Hello ${recipientName},</p>
      <p>We received a request to reset the password for your Relay account. Click the button below to choose a new secure password:</p>
      
      <div style="text-align: center; margin: 32px 0;">
        <a href="${resetUrl}" class="btn">Reset Password</a>
      </div>

      <p style="font-size: 13px; margin-bottom: 8px;">If the button above doesn't work, copy and paste this link into your browser:</p>
      <div class="fallback-url">${resetUrl}</div>

      <div class="notice">
        <strong>Security Notice:</strong> This password reset link will expire in 30 minutes and can only be used once. If you did not request this change, please ignore this email; your account remains secure.
      </div>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} Relay SaaS. All rights reserved.
    </div>
  </div>
</body>
</html>
`;

  const text = `
Hello ${recipientName},

We received a request to reset your Relay account password. Use this link to set a new password:

${resetUrl}

This link is valid for 30 minutes and single-use only.

If you did not request this, please disregard this email. Your current password will remain unchanged.

© ${new Date().getFullYear()} Relay SaaS
`;

  return sendEmail({ to, subject, html, text });
}
