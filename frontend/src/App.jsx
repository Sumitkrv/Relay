import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

// Authentication & Dashboard
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './layout/AppLayout';
import AuthPage from './pages/AuthPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import OnboardingHandoffPage from './pages/OnboardingHandoffPage';
import BusinessOnboardingPage from './pages/BusinessOnboardingPage';
import WorkspaceGettingStartedPage from './pages/WorkspaceGettingStartedPage';
import Dashboard from './pages/Dashboard';
import SettingsPage from './pages/SettingsPage';
import ContactsPage from './pages/ContactsPage';
import ImportPage from './pages/ImportPage';
import TemplatesPage from './pages/TemplatesPage';
import { CampaignDetailPage, CampaignsPage, CampaignWizardPage } from './pages/CampaignsPage';
import { WorkflowsPage, WorkflowEditorPage } from './pages/WorkflowsPage';
import { InboxPage, FollowUpsPage } from './pages/InboxPage';
import AnalyticsPage from './pages/AnalyticsPage';
import HotLeadsPage from './pages/HotLeadsPage';
import LeadScoringSettingsPage from './pages/LeadScoringSettingsPage';
import ReportsPage from './pages/ReportsPage';
import ActivityLogsPage from './pages/ActivityLogsPage';
import ChatbotStudioPage from './pages/ChatbotStudioPage';
import { PipelinePage, DealDetailsPage, ClientsPage, ClientDetailsPage } from './pages/SalesPage';
import { ProposalsPage, ProposalEditorPage } from './pages/ProposalPages';

// Public Marketing Website
import MarketingLayout from './marketing/components/MarketingLayout';
import HomePage from './marketing/pages/HomePage';
import FeaturesPage from './marketing/pages/FeaturesPage';
import IndustriesPage from './marketing/pages/IndustriesPage';
import IndustryDetailPage from './marketing/pages/IndustryDetailPage';
import HowItWorksPage from './marketing/pages/HowItWorksPage';
import PricingPage from './marketing/pages/PricingPage';
import FAQPage from './marketing/pages/FAQPage';
import ContactPage from './marketing/pages/ContactPage';
import PrivacyPage from './marketing/pages/PrivacyPage';
import TermsPage from './marketing/pages/TermsPage';
import SignupPage from './marketing/pages/SignupPage';

import DevMailboxPage from './pages/DevMailboxPage';
import DevTestingHubPage from './pages/DevTestingHubPage';
import IndustryPreviewPage from './pages/IndustryPreviewPage';
import SuperAdminPage from './pages/SuperAdminPage';
import AgencyDashboardPage from './pages/AgencyDashboardPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route element={<MarketingLayout />}>
        <Route path="/features" element={<FeaturesPage />} />
        <Route path="/industries" element={<IndustriesPage />} />
        <Route path="/industries/:slug" element={<IndustryDetailPage />} />
        <Route path="/how-it-works" element={<HowItWorksPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/faq" element={<FAQPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/signup" element={<SignupPage />} />
      </Route>

      {/* Offline Testing Control & Local Mailbox Entry Points */}
      {import.meta.env.DEV && <Route path="/dev/mailbox" element={<DevMailboxPage />} />}
      {import.meta.env.DEV && <Route path="/dev/testing" element={<DevTestingHubPage />} />}
      {import.meta.env.DEV && <Route path="/dev/industry-preview" element={<IndustryPreviewPage />} />}

      {/* Authentication Entry Points */}
      <Route path="/login" element={<AuthPage />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/onboarding" element={<BusinessOnboardingPage />} />
      <Route path="/onboarding/handoff" element={<OnboardingHandoffPage />} />

      {/* Platform Super Admin & Agency Dedicated Control Panels */}
      <Route element={<ProtectedRoute />}>
        <Route path="/admin" element={<SuperAdminPage />} />
        <Route path="/agency" element={<AgencyDashboardPage />} />
      </Route>

      {/* Authenticated Workspace Application Routes */}
      <Route element={<ProtectedRoute />}>
        <Route path="/app/getting-started" element={<Navigate to="/app" replace />} />
        <Route element={<AppLayout />}>
          {/* New namespaced workspace routes */}
          <Route path="/app" element={<Dashboard />} />
          <Route path="/app/overview" element={<Dashboard />} />
          <Route path="/app/contacts" element={<ContactsPage />} />
          <Route path="/app/templates" element={<TemplatesPage />} />
          <Route path="/app/campaigns" element={<CampaignsPage />} />
          <Route path="/app/inbox" element={<InboxPage />} />
          <Route path="/app/reports" element={<ReportsPage />} />
          <Route path="/app/settings" element={<SettingsPage />} />

          {/* Fully preserved legacy authenticated deep-links */}
          <Route path="/pipeline" element={<PipelinePage />} />
          <Route path="/deals/:id" element={<DealDetailsPage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/clients/:id" element={<ClientDetailsPage />} />
          <Route path="/proposals" element={<ProposalsPage />} />
          <Route path="/proposals/new" element={<ProposalEditorPage />} />
          <Route path="/proposals/:id" element={<ProposalEditorPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/contacts" element={<ContactsPage />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/campaigns" element={<CampaignsPage />} />
          <Route path="/campaigns/new" element={<CampaignWizardPage />} />
          <Route path="/campaigns/:id/edit" element={<CampaignWizardPage />} />
          <Route path="/campaigns/:id" element={<CampaignDetailPage />} />
          <Route path="/workflows" element={<WorkflowsPage />} />
          <Route path="/workflows/new" element={<WorkflowEditorPage />} />
          <Route path="/workflows/:id" element={<WorkflowEditorPage />} />
          <Route path="/chatbots" element={<ChatbotStudioPage />} />
          <Route path="/chatbots/:id" element={<ChatbotStudioPage />} />
          <Route path="/inbox" element={<InboxPage />} />
          <Route path="/follow-ups" element={<FollowUpsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/hot-leads" element={<HotLeadsPage />} />
          <Route path="/lead-scoring/settings" element={<LeadScoringSettingsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/activity" element={<ActivityLogsPage />} />
        </Route>
      </Route>

      {/* Catch-all redirect to public homepage */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
