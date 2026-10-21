import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export async function requireAuth(req, res, next) {
  try {
    const token =
      req.cookies?.session || req.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const userId = payload.sub || payload.id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({ message: 'Session is no longer valid.' });
    }

    // Invalidate sessions if password was rotated / authVersion incremented
    if (
      payload.ver !== undefined &&
      user.authVersion !== undefined &&
      payload.ver !== user.authVersion
    ) {
      return res.status(401).json({ message: 'Session has expired due to security updates. Please sign in again.' });
    }

    // Fail closed on suspended or disabled accounts
    if (user.accountStatus === 'SUSPENDED') {
      return res.status(403).json({
        code: 'ACCOUNT_SUSPENDED',
        message: 'Your account has been suspended. Please contact support.',
      });
    }
    if (user.accountStatus === 'DISABLED') {
      return res.status(403).json({
        code: 'ACCOUNT_DISABLED',
        message: 'Your account has been disabled. Please contact support.',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Please sign in again.' });
    }
    next(err);
  }
}
