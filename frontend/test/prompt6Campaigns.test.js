import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const campaignsPagePath = path.resolve(__dirname, '../src/pages/CampaignsPage.jsx');
const campaignsServicePath = path.resolve(__dirname, '../src/services/campaigns.js');

test('Prompt 6 — Frontend: Campaigns Page exports 4 Primary KPI Cards and Compact Status Breakdown', () => {
  const code = fs.readFileSync(campaignsPagePath, 'utf8');
  assert.ok(code.includes('Total Campaigns'), 'Must display Total Campaigns primary card');
  assert.ok(code.includes('Scheduled'), 'Must display Scheduled primary card');
  assert.ok(code.includes('Running'), 'Must display Running primary card');
  assert.ok(code.includes('Completed'), 'Must display Completed primary card');
  assert.ok(code.includes('Status Breakdown:'), 'Must display compact status breakdown pills');
  assert.ok(code.includes('Drafts:'), 'Must show draft count');
  assert.ok(code.includes('Paused:'), 'Must show paused count');
  assert.ok(code.includes('Failed:'), 'Must show failed count');
  assert.ok(code.includes('Cancelled:'), 'Must show cancelled count');
});

test('Prompt 6 — Frontend: Four-Step Stepper (Template → Audience → Preview → Launch)', () => {
  const code = fs.readFileSync(campaignsPagePath, 'utf8');
  assert.ok(code.includes("const STEPS = ['Template', 'Audience', 'Preview', 'Launch']"), 'Must define 4-step stepper array');
  assert.ok(code.includes('Template'), 'Must include Template step');
  assert.ok(code.includes('Audience'), 'Must include Audience step');
  assert.ok(code.includes('Preview'), 'Must include Preview step');
  assert.ok(code.includes('Launch'), 'Must include Launch step');
  assert.ok(code.includes('campaign-stepper'), 'Must render campaign-stepper progress element');
});

test('Prompt 6 — Frontend: Step 1 Template Studio Integration & Version Pinning', () => {
  const code = fs.readFileSync(campaignsPagePath, 'utf8');
  assert.ok(code.includes('Choose Template & Campaign Basics'), 'Step 1 title');
  assert.ok(code.includes('listTemplates'), 'Must import listTemplates');
  assert.ok(code.includes('getTemplateVersions'), 'Must import getTemplateVersions');
  assert.ok(code.includes('templateSearch'), 'Must provide template search');
  assert.ok(code.includes('selectedTemplateVersionId') || code.includes('versionId'), 'Must manage pinned template version');
});

test('Prompt 6 — Frontend: Step 2 Audience Targeting & Live Eligibility Breakdown', () => {
  const code = fs.readFileSync(campaignsPagePath, 'utf8');
  assert.ok(code.includes('Contact group'), 'Must support Contact Groups');
  assert.ok(code.includes('Saved Dynamic Segment') || code.includes('Saved segment'), 'Must support Dynamic Segments');
  assert.ok(code.includes('previewAudience'), 'Must integrate live previewAudience endpoint');
  assert.ok(code.includes('Live Recipient Eligibility & Consent Breakdown'), 'Must display live eligibility breakdown card');
  assert.ok(code.includes('Currently Eligible'), 'Must highlight Currently Eligible recipients');
  assert.ok(code.includes('Missing Consent'), 'Must show Missing Consent exclusion breakdown');
  assert.ok(code.includes('Opted Out'), 'Must show Opted Out exclusion breakdown');
});

test('Prompt 6 — Frontend: Step 3 Personalized Message Preview & Pager', () => {
  const code = fs.readFileSync(campaignsPagePath, 'utf8');
  assert.ok(code.includes('WhatsApp Interactive Mobile Preview') || code.includes('Personalized Message Preview'), 'Step 3 mobile preview title');
  assert.ok(code.includes('wa-simulator-device') || code.includes('wa-message-bubble'), 'Must render WhatsApp simulator device container');
  assert.ok(code.includes('Campaign Plan Review Summary') || code.includes('Review Summary'), 'Must render campaign review summary');
  assert.ok(code.includes('ELIGIBLE TO SEND'), 'Must show eligible count in review');
  assert.ok(code.includes('EXCLUDED'), 'Must show excluded count in review');
});

test('Prompt 6 — Frontend: Step 4 Scheduling & Launch Mock Compliance Banner', () => {
  const code = fs.readFileSync(campaignsPagePath, 'utf8');
  assert.ok(code.includes('Run Mock Now'), 'Must provide Run Mock Now card');
  assert.ok(code.includes('Schedule Mock for Later'), 'Must provide Schedule Mock for Later card');
  assert.ok(code.includes('MOCK MODE — No real WhatsApp messages will be sent'), 'Must display prominent mock safety banner');
  assert.ok(code.includes('confirmMockAcknowledged'), 'Must require explicit operator mock confirmation');
  assert.ok(code.includes('Asia/Kolkata'), 'Must support Asia/Kolkata timezone default');
});

test('Prompt 6 — Frontend: Services API Surface Exports All Lifecycle Endpoints', () => {
  const serviceCode = fs.readFileSync(campaignsServicePath, 'utf8');
  assert.ok(serviceCode.includes('previewAudience'), 'Must export previewAudience');
  assert.ok(serviceCode.includes('launchCampaign'), 'Must export launchCampaign');
  assert.ok(serviceCode.includes('scheduleCampaign'), 'Must export scheduleCampaign');
  assert.ok(serviceCode.includes('rescheduleCampaign'), 'Must export rescheduleCampaign');
  assert.ok(serviceCode.includes('pauseCampaign'), 'Must export pauseCampaign');
  assert.ok(serviceCode.includes('resumeCampaign'), 'Must export resumeCampaign');
  assert.ok(serviceCode.includes('cancelCampaign'), 'Must export cancelCampaign');
  assert.ok(serviceCode.includes('retryFailedCampaignMessages'), 'Must export retryFailedCampaignMessages');
  assert.ok(serviceCode.includes('listCampaignRuns'), 'Must export listCampaignRuns');
  assert.ok(serviceCode.includes('getCampaignAnalytics'), 'Must export getCampaignAnalytics');
});
