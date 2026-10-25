import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Safely load local demo configuration if present in non-production
if (process.env.NODE_ENV !== 'production') {
  const demoPaths = [
    path.resolve(process.cwd(), '.env.demo'),
    path.resolve(process.cwd(), 'backend/.env.demo'),
    path.resolve(new URL('.', import.meta.url).pathname, '../../.env.demo'),
  ];
  for (const p of demoPaths) {
    if (fs.existsSync(p)) {
      dotenv.config({ path: p, override: true });
      break;
    }
  }
}

import app from './app.js';
import connectDB from './config/db.js';
import { resumeImportJobs } from './controllers/importController.js';
import { cleanupImportTempFiles } from './routes/importRoutes.js';
import { startWorkflowWorker } from './services/workflowExecutionService.js';
import { startCampaignWorker } from './services/campaignExecutionService.js';
import { startMessageWorker } from './services/messageQueueService.js';

const port = Number(process.env.PORT) || 5000;
try {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be configured with at least 32 characters');
  }
  await connectDB();
  await cleanupImportTempFiles();
  await resumeImportJobs();
  await startWorkflowWorker();
  startCampaignWorker();
  startMessageWorker();
  app.listen(port, () => console.log(`API listening on port ${port}`));
} catch (err) {
  console.error(`Startup failed: ${err.message}`);
  process.exit(1);
}
