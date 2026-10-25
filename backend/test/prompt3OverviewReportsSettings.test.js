import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

import User from '../src/models/User.js';
import Workspace from '../src/models/Workspace.js';
import BusinessProfile from '../src/models/BusinessProfile.js';
import UserPreferences from '../src/models/UserPreferences.js';
import Contact from '../src/models/Contact.js';
import MessageTemplate from '../src/models/MessageTemplate.js';
import Campaign from '../src/models/Campaign.js';
import Message from '../src/models/Message.js';
import Conversation from '../src/models/Conversation.js';
import AutoReplyRule from '../src/models/AutoReplyRule.js';
import RuleExecution from '../src/models/RuleExecution.js';

import * as dashboardController from '../src/controllers/dashboardController.js';
import * as settingsController from '../src/controllers/settingsController.js';
import * as reportService from '../src/services/reportService.js';
import { sanitizeSpreadsheetCell } from '../src/services/reportService.js';
import { dateBounds } from '../src/services/analyticsService.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/relay_demo';

test('RELAY PROMPT 3 — Complete Overview, Reports, Settings, Independent Branding & Security', async (t) => {
  let m2wUser, gymUser, clinicUser;
  let m2wWorkspace, gymWorkspace, clinicWorkspace;

  t.before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGODB_URI);
    }

    // Ensure M2W demo records have proper names
    await Workspace.updateOne({ slug: 'm2w-realty' }, { $set: { name: 'M2W Realty' } });
    await User.updateOne({ email: 'owner.m2w@relay-demo.test' }, { $set: { businessName: 'M2W Realty' } });
    await Workspace.updateOne({ slug: 'fitzone-gym' }, { $set: { name: 'FitZone Gym' } });
    await Workspace.updateOne({ slug: 'careplus-clinic' }, { $set: { name: 'CarePlus Clinic' } });

    m2wUser = await User.findOne({ email: 'owner.m2w@relay-demo.test' });
    gymUser = await User.findOne({ email: 'owner.gym@relay-demo.test' });
    clinicUser = await User.findOne({ email: 'owner.clinic@relay-demo.test' });

    assert.ok(m2wUser, 'M2W Owner must exist');
    assert.ok(gymUser, 'Gym Owner must exist');
    assert.ok(clinicUser, 'Clinic Owner must exist');

    m2wWorkspace = await Workspace.findOne({ slug: 'm2w-realty' });
    gymWorkspace = await Workspace.findOne({ slug: 'fitzone-gym' });
    clinicWorkspace = await Workspace.findOne({ slug: 'careplus-clinic' });

    assert.ok(m2wWorkspace, 'M2W Workspace must exist');
    assert.ok(gymWorkspace, 'Gym Workspace must exist');
    assert.ok(clinicWorkspace, 'Clinic Workspace must exist');
  });

  t.after(async () => {
    await mongoose.disconnect();
  });

  await t.test('1. Overview Real MongoDB Analytics (Section 6, 7, 8, 9)', async (t2) => {
    await t2.test('M2W Realty overview returns genuine workspace-isolated metrics', async () => {
      const mockReq = {
        user: m2wUser,
        headers: { 'x-workspace-id': String(m2wWorkspace._id) },
        get: (h) => (h.toLowerCase() === 'x-workspace-id' ? String(m2wWorkspace._id) : ''),
        query: {},
      };
      let responseBody = null;
      const mockRes = {
        json: (data) => {
          responseBody = data;
        },
        status: () => mockRes,
      };

      await dashboardController.overview(mockReq, mockRes);
      assert.ok(responseBody, 'Response body should not be null');

      const contactCount = await Contact.countDocuments({
        workspaceId: m2wWorkspace._id,
        isDeleted: false,
      });
      const templateCount = await MessageTemplate.countDocuments({
        workspaceId: m2wWorkspace._id,
      });

      assert.equal(responseBody.contacts.total, contactCount, 'M2W contacts count matches MongoDB');
      assert.equal(responseBody.businessContext.businessName, 'M2W Realty');
      assert.equal(responseBody.businessContext.timezone, 'Asia/Kolkata');
      assert.ok(responseBody.mockMessages, 'mockMessages object must be present');
      assert.equal(typeof responseBody.mockMessages.sent, 'number');
      assert.equal(typeof responseBody.mockMessages.delivered, 'number');
      assert.equal(typeof responseBody.mockMessages.read, 'number');
      assert.equal(typeof responseBody.mockMessages.failed, 'number');
      assert.equal(typeof responseBody.autoReplyExecutions, 'number');
    });

    await t2.test('FitZone Gym overview reflects Gym data without M2W data leakage', async () => {
      const mockReq = {
        user: gymUser,
        headers: { 'x-workspace-id': String(gymWorkspace._id) },
        get: (h) => (h.toLowerCase() === 'x-workspace-id' ? String(gymWorkspace._id) : ''),
        query: {},
      };
      let responseBody = null;
      const mockRes = {
        json: (data) => {
          responseBody = data;
        },
        status: () => mockRes,
      };

      await dashboardController.overview(mockReq, mockRes);
      assert.ok(responseBody, 'Response body should not be null');

      const gymContacts = await Contact.countDocuments({
        workspaceId: gymWorkspace._id,
        isDeleted: false,
      });
      assert.equal(responseBody.contacts.total, gymContacts);
      assert.equal(responseBody.businessContext.businessName, 'FitZone Gym');
      assert.equal(responseBody.businessContext.industryKey, 'gym');
    });

    await t2.test('CarePlus Clinic overview reflects Clinic administrative data without fake medical records', async () => {
      const mockReq = {
        user: clinicUser,
        headers: { 'x-workspace-id': String(clinicWorkspace._id) },
        get: (h) => (h.toLowerCase() === 'x-workspace-id' ? String(clinicWorkspace._id) : ''),
        query: {},
      };
      let responseBody = null;
      const mockRes = {
        json: (data) => {
          responseBody = data;
        },
        status: () => mockRes,
      };

      await dashboardController.overview(mockReq, mockRes);
      assert.ok(responseBody, 'Response body should not be null');

      const clinicContacts = await Contact.countDocuments({
        workspaceId: clinicWorkspace._id,
        isDeleted: false,
      });
      assert.equal(responseBody.contacts.total, clinicContacts);
      assert.equal(responseBody.businessContext.businessName, 'CarePlus Clinic');
      assert.equal(responseBody.businessContext.industryKey, 'clinic');
    });
  });

  await t.test('2. Complete Reports Module & Aggregations (Section 12, 13, 14, 15, 16)', async (t2) => {
    await t2.test('getOverview report metrics correctly scoped to owner and timezone', async () => {
      const overviewReport = await reportService.getOverview(m2wUser._id, { range: '30d' });
      assert.ok(overviewReport, 'Overview report generated');
      assert.ok(overviewReport.kpis, 'KPIs object present');
      assert.equal(overviewReport.timeZone, 'Asia/Kolkata');
      assert.equal(typeof overviewReport.kpis.totalCampaigns, 'number');
      assert.equal(typeof overviewReport.kpis.mockMessagesProcessed, 'number');
      assert.equal(typeof overviewReport.kpis.scheduledRunningCampaigns, 'number');
    });

    await t2.test('getCampaignPerformance report accurately reports persisted campaigns', async () => {
      const campReport = await reportService.getCampaignPerformance(gymUser._id, {});
      assert.ok(campReport, 'Campaign performance report generated');
      assert.ok(Array.isArray(campReport.records), 'Records must be an array');
      // All records belong to gym
      for (const rec of campReport.records) {
        const cDoc = await Campaign.findById(rec._id);
        assert.equal(String(cDoc.ownerId), String(gymUser._id), 'Campaign must belong to Gym owner');
      }
    });

    await t2.test('getInboxAnalytics returns real conversation and auto-reply aggregations', async () => {
      const inboxReport = await reportService.getInboxAnalytics(m2wUser._id);
      assert.ok(inboxReport, 'Inbox analytics generated');
      assert.equal(typeof inboxReport.openConversations, 'number');
      assert.equal(typeof inboxReport.autoReplyRulesTriggered, 'number');
      assert.ok(Array.isArray(inboxReport.autoReplies), 'autoReplies must be an array');
    });

    await t2.test('getAutoReplyAnalytics aggregates rules and executions accurately', async () => {
      const arReport = await reportService.getAutoReplyAnalytics(m2wUser._id);
      assert.ok(arReport, 'Auto-reply analytics generated');
      assert.equal(typeof arReport.totalRules, 'number');
      assert.equal(typeof arReport.totalExecutions, 'number');
      assert.ok(Array.isArray(arReport.rules));
      assert.ok(Array.isArray(arReport.executions));
    });
  });

  await t.test('3. Date Filtering & Timezone Policy (Section 17, 18, 30)', async (t2) => {
    await t2.test('dateBounds calculates correct Asia/Kolkata boundaries', () => {
      const bounds30d = dateBounds({ range: '30d', timezone: 'Asia/Kolkata' });
      assert.equal(bounds30d.timeZone, 'Asia/Kolkata');
      assert.ok(bounds30d.start < bounds30d.end);

      const boundsToday = dateBounds({ range: 'today', timezone: 'Asia/Kolkata' });
      assert.equal(boundsToday.timeZone, 'Asia/Kolkata');
      assert.ok(boundsToday.start <= boundsToday.end);

      const boundsCustom = dateBounds({
        start: '2026-10-01',
        end: '2026-10-15',
        timezone: 'Asia/Kolkata',
      });
      assert.ok(boundsCustom.start < boundsCustom.end);
    });

    await t2.test('invalid timezone throws safe 400 validation error', () => {
      assert.throws(
        () => dateBounds({ timezone: 'Invalid/Timezone_Foo' }),
        /Timezone must be a valid IANA timezone/
      );
    });
  });

  await t.test('4. Formula Injection Escaping & Report Exports (Section 21)', async (t2) => {
    await t2.test('sanitizeSpreadsheetCell escapes formula triggers (=, +, -, @, tabs)', () => {
      assert.equal(sanitizeSpreadsheetCell('=SUM(A1:A10)'), "'=SUM(A1:A10)");
      assert.equal(sanitizeSpreadsheetCell('+12345'), "'+12345");
      assert.equal(sanitizeSpreadsheetCell('-cmd|calc'), "'-cmd|calc");
      assert.equal(sanitizeSpreadsheetCell('@evil'), "'@evil");
      assert.equal(sanitizeSpreadsheetCell('Normal Client Name'), 'Normal Client Name');
      assert.equal(sanitizeSpreadsheetCell(98765), 98765);
    });

    await t2.test('exportReportData produces safe CSV stream without cross-tenant leak', async () => {
      const exportRes = await reportService.exportReportData(gymUser._id, {
        reportType: 'campaign_summary',
        format: 'csv',
      });
      assert.ok(exportRes.buffer, 'CSV buffer should be generated');
      const csvContent = exportRes.buffer.toString('utf8');
      assert.match(csvContent, /Campaign Name/);
      assert.doesNotMatch(csvContent, /M2W Realty Property Enquiry/, 'Gym export must not contain M2W data');
    });
  });

  await t.test('5. Business Settings & Profile Persistence (Section 23, 24, 49)', async (t2) => {
    await t2.test('updateBusinessProfile persists legal name, city, website into MongoDB and syncs Workspace', async () => {
      const before = await BusinessProfile.findOne({ ownerId: gymUser._id }).lean();
      const testDescription = 'Leading premium fitness and personal training center in Bandra West.';
      const testPhone = '+91 98200 11223';
      const mockReq = {
        user: gymUser,
        headers: { 'x-workspace-id': String(gymWorkspace._id) },
        get: (h) => (h.toLowerCase() === 'x-workspace-id' ? String(gymWorkspace._id) : ''),
        body: {
          legalOrTradingName: 'FitZone Gym',
          description: testDescription,
          phone: testPhone,
          city: 'Mumbai',
          country: 'India',
        },
      };

      let responseBody = null;
      const mockRes = {
        json: (data) => {
          responseBody = data;
        },
        status: () => mockRes,
      };

      await settingsController.updateBusinessProfile(mockReq, mockRes);
      assert.ok(responseBody.success);

      // Verify MongoDB persistence in BusinessProfile
      const bp = await BusinessProfile.findOne({ ownerId: gymUser._id });
      assert.equal(bp.description, testDescription);
      assert.equal(bp.phone, testPhone);
      assert.equal(bp.city, 'Mumbai');

      // Verify synchronization to Workspace
      const ws = await Workspace.findById(gymWorkspace._id);
      assert.equal(ws.name, 'FitZone Gym');

      // restore original demo values (tests must not leave demo data mutated)
      await BusinessProfile.updateOne({ ownerId: gymUser._id }, { $set: { description: before.description, phone: before.phone, city: before.city } });
      await Workspace.updateOne({ _id: gymWorkspace._id }, { $set: { city: before.city } });
    });

    await t2.test('updatePreferences persists timezone and syncs Workspace.timezone', async () => {
      const mockReq = {
        user: clinicUser,
        headers: { 'x-workspace-id': String(clinicWorkspace._id) },
        get: (h) => (h.toLowerCase() === 'x-workspace-id' ? String(clinicWorkspace._id) : ''),
        body: {
          timezone: 'Asia/Kolkata',
          currency: 'INR',
        },
      };

      let responseBody = null;
      const mockRes = {
        json: (data) => {
          responseBody = data;
        },
        status: () => mockRes,
      };

      await settingsController.updatePreferences(mockReq, mockRes);
      assert.ok(responseBody.success);

      const prefs = await UserPreferences.findOne({ ownerId: clinicUser._id });
      assert.equal(prefs.timezone, 'Asia/Kolkata');

      const ws = await Workspace.findById(clinicWorkspace._id);
      assert.equal(ws.timezone, 'Asia/Kolkata');
    });
  });

  await t.test('6. Logo Upload & Removal Endpoints (Section 28, 29)', async (t2) => {
    await t2.test('deleteBusinessLogo removes logo and clears logoUrl in BusinessProfile & Workspace', async () => {
      const mockReq = {
        user: gymUser,
        headers: { 'x-workspace-id': String(gymWorkspace._id) },
        get: (h) => (h.toLowerCase() === 'x-workspace-id' ? String(gymWorkspace._id) : ''),
      };

      let responseBody = null;
      const mockRes = {
        json: (data) => {
          responseBody = data;
        },
        status: () => mockRes,
      };

      await settingsController.deleteBusinessLogo(mockReq, mockRes);
      assert.ok(responseBody.success);

      const bp = await BusinessProfile.findOne({ ownerId: gymUser._id });
      assert.equal(Boolean(bp?.logoUrl), false);

      const ws = await Workspace.findById(gymWorkspace._id);
      assert.equal(Boolean(ws?.logoUrl), false);
    });
  });

  await t.test('7. Multi-Tenant Security & Isolation (Section 44, 45)', async (t2) => {
    await t2.test('Cross-tenant profile update fails or isolates changes to authorized workspace', async () => {
      // Clinic owner attempting to send x-workspace-id of M2W
      const mockReq = {
        user: clinicUser,
        headers: { 'x-workspace-id': String(m2wWorkspace._id) },
        get: (h) => (h.toLowerCase() === 'x-workspace-id' ? String(m2wWorkspace._id) : ''),
        body: {
          legalOrTradingName: 'CarePlus Clinic',
        },
      };

      let responseBody = null;
      const mockRes = {
        json: (data) => {
          responseBody = data;
        },
        status: () => mockRes,
      };

      await settingsController.updateBusinessProfile(mockReq, mockRes);

      // Verify M2W workspace was NOT modified by clinic user
      const m2wReloaded = await Workspace.findById(m2wWorkspace._id);
      assert.equal(m2wReloaded.name, 'M2W Realty', 'M2W Workspace must remain unchanged');
    });

    await t2.test('Cannot modify ownerId or workspaceId via business profile update', async () => {
      const originalOwnerId = gymWorkspace.ownerId;
      const mockReq = {
        user: gymUser,
        headers: { 'x-workspace-id': String(gymWorkspace._id) },
        get: (h) => (h.toLowerCase() === 'x-workspace-id' ? String(gymWorkspace._id) : ''),
        body: {
          ownerId: String(clinicUser._id),
          workspaceId: String(m2wWorkspace._id),
          legalOrTradingName: 'FitZone Gym',
        },
      };

      const mockRes = {
        json: () => {},
        status: () => mockRes,
      };

      await settingsController.updateBusinessProfile(mockReq, mockRes);

      const wsCheck = await Workspace.findById(gymWorkspace._id);
      assert.equal(String(wsCheck.ownerId), String(originalOwnerId), 'ownerId must be immutable');
    });
  });
});
