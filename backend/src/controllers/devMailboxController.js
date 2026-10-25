/**
 * Developer Mailbox Controller
 * Provides API access to intercepted transactional emails in local demo / development mode.
 */

import { getEmailHistory, getLastEmail, clearEmailHistory } from '../services/emailService.js';

export function getMailbox(req, res) {
  const emails = getEmailHistory().map((email, idx) => {
    // Extract verification, reset, or invite URLs from html or text
    const textContent = `${email.text || ''} ${email.html || ''}`;
    const urlMatch = textContent.match(/https?:\/\/[^\s"'>]+/i);
    const actionUrl = urlMatch ? urlMatch[0] : null;

    return {
      id: `email_${idx + 1}`,
      to: email.to,
      from: email.from,
      subject: email.subject,
      sentAt: email.sentAt,
      actionUrl,
      previewText: (email.text || '').slice(0, 180),
      html: email.html,
      provider: email.provider,
    };
  });

  res.json({
    total: emails.length,
    emails: emails.reverse(), // Most recent first
  });
}

export function getLatestEmail(req, res) {
  const last = getLastEmail();
  if (!last) {
    return res.status(404).json({ message: 'No emails in mailbox.' });
  }

  const textContent = `${last.text || ''} ${last.html || ''}`;
  const urlMatch = textContent.match(/https?:\/\/[^\s"'>]+/i);
  const actionUrl = urlMatch ? urlMatch[0] : null;

  res.json({
    email: {
      ...last,
      actionUrl,
    },
  });
}

export function clearMailbox(req, res) {
  clearEmailHistory();
  res.json({ success: true, message: 'Local developer mailbox cleared.' });
}

export default {
  getMailbox,
  getLatestEmail,
  clearMailbox,
};
