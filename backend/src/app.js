import express from 'express'; import cors from 'cors'; import cookieParser from 'cookie-parser'; import helmet from 'helmet'; import authRoutes from './routes/authRoutes.js'; import settingsRoutes from './routes/settingsRoutes.js'; import dashboardRoutes from './routes/dashboardRoutes.js'; import contactRoutes from './routes/contactRoutes.js'; import contactGroupRoutes from './routes/contactGroupRoutes.js'; import contactCategoryRoutes from './routes/contactCategoryRoutes.js'; import importRoutes from './routes/importRoutes.js'; import templateRoutes from './routes/templateRoutes.js'; import campaignRoutes from './routes/campaignRoutes.js'; import segmentRoutes from './routes/segmentRoutes.js'; import workflowRoutes from './routes/workflowRoutes.js'; import workflowExecutionRoutes from './routes/workflowExecutionRoutes.js'; import workflowScheduleRoutes from './routes/workflowScheduleRoutes.js'; import chatbotRoutes from './routes/chatbotRoutes.js'; import chatbotTestRoutes from './routes/chatbotTestRoutes.js'; import healthRoutes from './routes/healthRoutes.js'; import activityLogRoutes from './routes/activityLogRoutes.js'; import inboxRoutes from './routes/inboxRoutes.js'; import followUpRoutes from './routes/followUpRoutes.js'; import notificationRoutes from './routes/notificationRoutes.js'; import analyticsRoutes from './routes/analyticsRoutes.js'; import leadScoringRoutes from './routes/leadScoringRoutes.js'; import reportRoutes from './routes/reportRoutes.js';import reportGenerationRoutes from './routes/reportGenerationRoutes.js'; import salesRoutes from './routes/salesRoutes.js'; import proposalRoutes from './routes/proposalRoutes.js'; import templateMediaRoutes from './routes/templateMediaRoutes.js'; import messageRoutes from './routes/messageRoutes.js'; import systemMessagingRoutes from './routes/systemMessagingRoutes.js'; import devMessagingRoutes from './routes/devMessagingRoutes.js'; import workspaceRoutes from './routes/workspaceRoutes.js'; import onboardingRoutes from './routes/onboardingRoutes.js'; import billingRoutes from './routes/billingRoutes.js'; import publicRoutes from './routes/publicRoutes.js'; import industryRoutes from './routes/industryRoutes.js';
import platformAdminRoutes from './routes/platformAdminRoutes.js';
import { errorHandler,notFound } from './middleware/errors.js';
const app=express();app.disable('x-powered-by');app.use(helmet());
const allowedOrigins = [process.env.FRONTEND_URL, 'http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173', 'http://127.0.0.1:5174'].filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json({
  limit: '100kb',
  verify: (req, _res, buf) => {
    req.rawBody = buf.toString();
  }
}));
app.use(cookieParser());
app.use('/api/public',publicRoutes);
app.use('/api/industries',industryRoutes);
app.use('/api/platform-admin', platformAdminRoutes);
app.use('/api/auth',authRoutes);
app.use('/api/workspaces',workspaceRoutes);
app.use('/api/billing',billingRoutes);
app.use('/api/onboarding',onboardingRoutes);
app.use('/api/settings',settingsRoutes);
app.use('/api/dashboard',dashboardRoutes);
app.use('/api/contact-categories',contactCategoryRoutes);
app.use('/api/contact-groups',contactGroupRoutes);
app.use('/api/contacts',contactRoutes);
app.use('/api/imports',importRoutes);
app.use('/api/templates',templateRoutes);
app.use('/api/template-media',templateMediaRoutes);
app.use('/api/messages',messageRoutes);
app.use('/api/system',systemMessagingRoutes);
app.use('/api/dev/mock-messaging',devMessagingRoutes);
app.use('/api/campaigns',campaignRoutes);
app.use('/api/segments',segmentRoutes);
app.use('/api/audience-segments',segmentRoutes);
app.use('/api/workflows',workflowRoutes);
app.use('/api/workflow-executions',workflowExecutionRoutes);
app.use('/api/workflow-schedules',workflowScheduleRoutes);
app.use('/api/chatbots',chatbotRoutes);
app.use('/api/chatbot-test-sessions',chatbotTestRoutes);
app.use('/api/inbox',inboxRoutes);
app.use('/api/follow-ups',followUpRoutes);
app.use('/api/notifications',notificationRoutes);
app.use('/api/analytics',analyticsRoutes);
app.use('/api/activity-logs',activityLogRoutes);
app.use('/api/lead-scoring',leadScoringRoutes);
app.use('/api/reports',reportRoutes);
app.use('/api/report-generations',reportGenerationRoutes);
app.use('/api/health',healthRoutes);
app.use('/api',salesRoutes);
app.use('/api/proposals',proposalRoutes);
app.use(notFound);
app.use(errorHandler);
export default app;

