import { Router } from 'express'; import mongoose from 'mongoose';
const router = Router();
router.get('/', (_req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;
  const dbStatus = isDbConnected ? 'connected' : 'disconnected';
  res.status(isDbConnected ? 200 : 503).json({
    status: isDbConnected ? 'ok' : 'degraded',
    backend: 'connected',
    database: dbStatus,
    whatsappProvider: 'disconnected',
    mockMode: true,
    timestamp: new Date().toISOString(),
  });
});
export default router;
