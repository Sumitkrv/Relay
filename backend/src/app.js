import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

// Core routes
import authRoutes from './routes/authRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import contactRoutes from './routes/contactRoutes.js';
import contactGroupRoutes from './routes/contactGroupRoutes.js';
import contactCategoryRoutes from './routes/contactCategoryRoutes.js';
import importRoutes from './routes/importRoutes.js';
import templateRoutes from './routes/templateRoutes.js';
import campaignRoutes from './routes/campaignRoutes.js';
import segmentRoutes from './routes/segmentRoutes.js';
import workflowRoutes from './routes/workflowRoutes.js';
import workflowExecutionRoutes from './routes/workflowExecutionRoutes.js';
import workflowScheduleRoutes from './routes/workflowScheduleRoutes.js';
import chatbotRoutes from './routes/chatbotRoutes.js';
import chatbotTestRoutes from './routes/chatbotTestRoutes.js';
import healthRoutes from './routes/healthRoutes.js';
import activityLogRoutes from './routes/activityLogRoutes.js';
import inboxRoutes from './routes/inboxRoutes.js';
import followUpRoutes from './routes/followUpRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import leadScoringRoutes from './routes/leadScoringRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import reportGenerationRoutes from './routes/reportGenerationRoutes.js';
import salesRoutes from './routes/salesRoutes.js';
import proposalRoutes from './routes/proposalRoutes.js';
import templateMediaRoutes from './routes/templateMediaRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import systemMessagingRoutes from './routes/systemMessagingRoutes.js';
import devMessagingRoutes from './routes/devMessagingRoutes.js';
import workspaceRoutes from './routes/workspaceRoutes.js';
import onboardingRoutes from './routes/onboardingRoutes.js';
import publicRoutes from './routes/publicRoutes.js';

// SaaS Phase Extensions
import industryRoutes from './routes/industryRoutes.js';
import devMailboxRoutes from './routes/devMailboxRoutes.js';
import billingRoutes from './routes/billingRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import agencyRoutes from './routes/agencyRoutes.js';

import { errorHandler, notFound } from './middleware/errors.js';

const app = express();
app.disable('x-powered-by');
app.use(helmet());

const parseOrigins = (raw) => {
  if (!raw) return [];
  return String(raw)
    .split(/[,\s]+/)
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
};

// Approved exact origins across production, previews, and local development
export const STATIC_APPROVED_ORIGINS = [
  'https://relay-lilac-one.vercel.app',
  'https://relay-8bwcassqe-sumitkrvs-projects.vercel.app',
  'https://relay-7vfkwvd85-sumitkrvs-projects.vercel.app',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
];

// Anchored, HTTPS-only pattern for Relay project preview deployments on Vercel
export const VERCEL_PREVIEW_RE = /^https:\/\/relay(-[a-z0-9-]+)?-(sumitkrvs-projects|sumitkrv)\.vercel\.app$/i;
export const LOCALHOST_DEV_RE = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

export function isOriginAllowed(origin) {
  if (!origin) return true; // Server-to-server, CLI curl without Origin, same-origin, health checks
  const normalized = origin.trim().replace(/\/+$/, '');

  const envOrigins = [
    ...parseOrigins(process.env.FRONTEND_URL),
    ...parseOrigins(process.env.CORS_ALLOWED_ORIGINS),
    ...parseOrigins(process.env.ALLOWED_ORIGINS),
    ...parseOrigins(process.env.CORS_ORIGIN),
  ];

  if (STATIC_APPROVED_ORIGINS.includes(normalized) || envOrigins.includes(normalized)) {
    return true;
  }

  if (VERCEL_PREVIEW_RE.test(normalized)) {
    return true;
  }

  if (process.env.NODE_ENV !== 'production' && LOCALHOST_DEV_RE.test(normalized)) {
    return true;
  }

  return false;
}

export const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      callback(
        Object.assign(new Error('Origin is not allowed by CORS.'), {
          status: 403,
          code: 'CORS_ORIGIN_DENIED',
        })
      );
    }
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Relay-Session-Id',
    'X-Workspace-Id',
    'Accept',
    'Origin',
    'X-Requested-With',
  ],
  exposedHeaders: ['Set-Cookie'],
  optionsSuccessStatus: 204,
  maxAge: 86400,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

// Mount API routes
app.use('/api/public', publicRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/industries', industryRoutes);
app.use('/api/dev/mailbox', devMailboxRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/agency', agencyRoutes);

app.use('/api/settings', settingsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/contact-categories', contactCategoryRoutes);
app.use('/api/contact-groups', contactGroupRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/imports', importRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/template-media', templateMediaRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/system', systemMessagingRoutes);
app.use('/api/dev/mock-messaging', devMessagingRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/segments', segmentRoutes);
app.use('/api/audience-segments', segmentRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/workflow-executions', workflowExecutionRoutes);
app.use('/api/workflow-schedules', workflowScheduleRoutes);
app.use('/api/chatbots', chatbotRoutes);
app.use('/api/chatbot-test-sessions', chatbotTestRoutes);
app.use('/api/inbox', inboxRoutes);
app.use('/api/follow-ups', followUpRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/activity-logs', activityLogRoutes);
app.use('/api/lead-scoring', leadScoringRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/report-generations', reportGenerationRoutes);
app.use('/api/health', healthRoutes);
app.use('/api', salesRoutes);
app.use('/api/proposals', proposalRoutes);

// Error handlers
app.use(notFound);
app.use(errorHandler);

export default app;
