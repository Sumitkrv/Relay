import { Router } from 'express';
import { getMailbox, getLatestEmail, clearMailbox } from '../controllers/devMailboxController.js';

const router = Router();

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

/**
 * The local developer mailbox exposes verification and password-reset links for EVERY account that
 * triggered an email. It must never be reachable by anyone except the developer on this machine:
 *  - disabled in production,
 *  - disabled unless outbound email is the in-process mock/inmemory provider (no real mail is sent),
 *  - restricted to loopback connections (socket address only; X-Forwarded-For is deliberately ignored).
 */
router.use((req, res, next) => {
  const provider = String(process.env.EMAIL_PROVIDER || '').toLowerCase();
  const mockProvider = provider === 'mock' || provider === 'inmemory';
  if (process.env.NODE_ENV === 'production' || !mockProvider) {
    return res.status(404).json({ message: 'Developer mailbox is not available.' });
  }
  if (!LOOPBACK.has(req.socket?.remoteAddress)) {
    return res.status(403).json({ code: 'DEV_MAILBOX_LOCAL_ONLY', message: 'The developer mailbox is only available from this machine.' });
  }
  return next();
});

router.get('/', getMailbox);
router.get('/latest', getLatestEmail);
router.post('/clear', clearMailbox);
router.delete('/', clearMailbox);

export default router;
