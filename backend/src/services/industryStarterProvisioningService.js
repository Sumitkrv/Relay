/**
 * Industry Starter Provisioning Service
 *
 * Copies the immutable industry pack (15 templates, 8 quick replies, 5 starter
 * auto-reply rules, 2 campaign drafts) into Workspace-owned MongoDB records.
 *
 * Idempotency & race safety:
 *  - Every starter record gets a deterministic _id = sha256(kind:workspaceId:presetKey),
 *    the same scheme already used by the inbox "install starter" endpoints, so the
 *    two paths can never create duplicates of each other.
 *  - Writes are upserts with $setOnInsert only: existing (possibly user-edited)
 *    records are never overwritten.
 *  - A partial unique index on { workspaceId, starterPresetKey } backs this up.
 *  - Concurrent runs that race on the same _id surface as E11000 and are ignored.
 *  - COMPLETED is only written after every expected record is verified to exist.
 *
 * Safety: rules are inserted disabled, campaigns as unscheduled Drafts with no
 * recipients, templates as local Drafts that are NOT Meta-approved. No contacts,
 * conversations or messages are ever created here.
 */
import Workspace from '../models/Workspace.js';
import MessageTemplate, { TemplateVersion } from '../models/MessageTemplate.js';
import QuickReply from '../models/QuickReply.js';
import AutoReplyRule from '../models/AutoReplyRule.js';
import Campaign from '../models/Campaign.js';
import { getStrictIndustryConfig } from '../config/industries/industryRegistry.js';
import { presetRecordId } from './autoReplyRuleService.js';

export const PROVISIONING_SOURCE = 'industry_starter';
const MARKETING_HINT = /(marketing|promo|offer|welcome|new|seasonal|announcement|intro|arrival|feedback)/i;
const LANGS = ['en', 'hi', 'hinglish'];

const clip = (value, max) => String(value ?? '').slice(0, max);
const tplKeyOf = (t) => t.presetKey || t.key || t.templateId;
const qrKeyOf = (q) => q.key || q.presetKey || q.id;
const ruleKeyOf = (r) => r.presetId || r.id;
const draftKeyOf = (d) => d.presetKey || d.campaignId || d.draftId || d.id;
const draftTemplateRefOf = (d) => d.templateReference || d.targetTemplateKey || d.templateRef || d.templateId || null;

function isOptOutPreset(rule) {
  return rule.intendedAction === 'RECORD_OPT_OUT' || /(^|_)stop$/.test(String(ruleKeyOf(rule) || ''));
}

/**
 * Pure: resolves the pack and returns the starter definitions that will be copied.
 * Throws INVALID_INDUSTRY instead of falling back to any other industry.
 */
export function resolveStarterPack(industryKey) {
  const config = getStrictIndustryConfig(industryKey);
  if (!config) {
    const err = new Error(`Unsupported industry "${industryKey}". Starter content was not provisioned.`);
    err.status = 400;
    err.code = 'INVALID_INDUSTRY';
    throw err;
  }
  return {
    config,
    packVersion: config.packVersion || String(config.version || '1'),
    templates: config.templateSuggestions || config.starterTemplatePack || [],
    quickReplies: config.quickReplyPresets || config.quickReplyPack || [],
    rules: (config.automationPresets || config.keywordAutoReplyPack || []).filter((r) => !isOptOutPreset(r)),
    campaigns: config.sampleCampaignDrafts || (config.sampleCampaignDraft ? [config.sampleCampaignDraft] : []),
  };
}

/** Deterministic ids for every starter record of a workspace (used for writes and verification). */
export function expectedStarterIds(workspaceId, pack) {
  const ws = String(workspaceId);
  return {
    templates: pack.templates.map((t) => presetRecordId('template', ws, tplKeyOf(t))),
    quickReplies: pack.quickReplies.map((q) => presetRecordId('reply', ws, qrKeyOf(q))),
    rules: pack.rules.map((r) => presetRecordId('rule', ws, ruleKeyOf(r))),
    campaigns: pack.campaigns.map((c) => presetRecordId('campaign', ws, draftKeyOf(c))),
  };
}

function ruleActionType(key) {
  return /(visit|appointment|call|book|trial|demo|reschedule|urgent|test_drive)/.test(key) ? 'MARK_NEEDS_ATTENTION' : 'RUN_MOCK_REPLY';
}

function ruleMatchType(matchType) {
  const m = String(matchType || '').toLowerCase();
  if (m === 'exact' || m === 'exact_match') return 'EXACT_MATCH';
  if (m === 'contains') return 'CONTAINS';
  return 'WHOLE_WORD';
}

function buildOps({ workspaceId, ownerId, industryKey, pack }) {
  const ws = String(workspaceId);
  const meta = { starterPackVersion: pack.packVersion, provisioningSource: PROVISIONING_SOURCE };
  const upsert = (_id, doc) => ({ updateOne: { filter: { _id }, update: { $setOnInsert: doc }, upsert: true } });

  const templateIdByKey = new Map();
  const templateOps = [];
  const versionOps = [];
  for (const t of pack.templates) {
    const key = tplKeyOf(t);
    const _id = presetRecordId('template', ws, key);
    const versionId = presetRecordId('template_version', ws, key);
    templateIdByKey.set(key, _id);
    const variables = Array.isArray(t.variables) ? t.variables : [];
    const header = clip(t.header, 60);
    const fields = {
      name: clip(t.title || t.displayName || key, 120),
      description: clip(t.description, 500),
      category: MARKETING_HINT.test(`${t.category} ${key}`) ? 'Marketing' : 'Utility',
      language: LANGS.includes(t.language) ? t.language : 'en',
      headerType: header ? 'TEXT' : 'NONE',
      header,
      body: clip(t.body, 4096),
      footer: clip(t.footer, 60),
      buttons: [],
      internalVariables: variables,
      businessCategory: clip(industryKey, 80),
      intendedService: clip(t.category, 120),
      tags: (Array.isArray(t.tags) ? t.tags : []).slice(0, 10).map((x) => clip(String(x).toLowerCase(), 40)),
    };
    templateOps.push(upsert(_id, {
      ...fields,
      ownerId,
      workspaceId,
      localStatus: 'Draft',
      providerStatus: 'Not Submitted',
      mockProviderApprovalStatus: 'Not Submitted',
      currentVersionId: versionId,
      currentVersionNumber: 1,
      isArchived: false,
      starterPresetKey: key,
      ...meta,
    }));
    versionOps.push(upsert(versionId, {
      ownerId,
      workspaceId,
      templateId: _id,
      versionNumber: 1,
      revisionNotes: `Provisioned from ${industryKey} starter pack v${pack.packVersion}.`,
      snapshot: fields,
      internalVariables: variables,
      createdBy: ownerId,
    }));
  }

  const quickReplyOps = pack.quickReplies.map((q) => {
    const key = qrKeyOf(q);
    const text = q.text || q.body || q.responseBody;
    return upsert(presetRecordId('reply', ws, key), {
      ownerId,
      workspaceId,
      presetKey: key,
      name: clip(q.title || q.label || key, 120),
      description: clip(q.description || q.title, 500),
      messageText: clip(text, 5000),
      category: q.category || 'General',
      supportedVariables: q.supportedVariables || q.variables || [],
      isActive: true,
      usageCount: 0,
      archivedAt: null,
      starterPresetKey: key,
      ...meta,
    });
  });

  const ruleOps = pack.rules.map((r) => {
    const key = ruleKeyOf(r);
    const keywords = (r.triggerKeywords || r.keywords || []).map((k) => String(k).trim().toUpperCase()).filter(Boolean);
    return upsert(presetRecordId('rule', ws, key), {
      ownerId,
      workspaceId,
      presetKey: key,
      name: clip(r.displayName || r.name || r.ruleName || key, 120),
      triggerKeyword: keywords[0] || 'HELP',
      synonyms: keywords.slice(1),
      matchType: ruleMatchType(r.matchType),
      actionType: r.intendedAction && r.intendedAction !== 'RECORD_OPT_OUT' ? r.intendedAction : ruleActionType(key),
      responseMessage: clip(r.suggestedResponse || r.responseBody || r.responseMessage, 5000),
      priority: Number(r.priority) || 10,
      enabled: false,
      cooldownSeconds: 15,
      executionCount: 0,
      lastExecutedAt: null,
      archivedAt: null,
      starterPresetKey: key,
      ...meta,
    });
  });

  const campaignOps = pack.campaigns.map((c) => {
    const key = draftKeyOf(c);
    const ref = draftTemplateRefOf(c);
    return upsert(presetRecordId('campaign', ws, key), {
      ownerId,
      workspaceId,
      createdBy: ownerId,
      name: clip(c.campaignName || c.name || c.title || key, 120),
      description: clip(c.description, 1000),
      goal: clip(c.goal, 100),
      category: clip(industryKey, 80),
      language: 'en',
      tags: ['starter'],
      internalNotes: clip(c.targetAudience ? `Suggested audience: ${c.targetAudience}` : '', 5000),
      audienceSelectionMode: 'manual',
      audienceDefinition: {},
      selectedTemplateId: (ref && templateIdByKey.get(ref)) || null,
      campaignType: 'one-time',
      executionMode: 'MOCK',
      status: 'Draft',
      mockSchedule: null,
      wizardStep: 1,
      starterPresetKey: key,
      ...meta,
    });
  });

  return { templateOps, versionOps, quickReplyOps, ruleOps, campaignOps };
}

async function runUpserts(Model, ops) {
  if (!ops.length) return;
  try {
    await Model.bulkWrite(ops, { ordered: false });
  } catch (err) {
    // A concurrent run inserted the same deterministic _id first: that is the desired outcome.
    const writeErrors = err?.writeErrors || err?.result?.result?.writeErrors || [];
    const onlyDuplicates = err?.code === 11000 || (writeErrors.length > 0 && writeErrors.every((e) => (e.code ?? e.err?.code) === 11000));
    if (!onlyDuplicates) throw err;
  }
}

async function countExisting(workspaceId, ids) {
  const [templates, quickReplies, rules, campaigns] = await Promise.all([
    MessageTemplate.countDocuments({ workspaceId, _id: { $in: ids.templates } }),
    QuickReply.countDocuments({ workspaceId, _id: { $in: ids.quickReplies } }),
    AutoReplyRule.countDocuments({ workspaceId, _id: { $in: ids.rules } }),
    Campaign.countDocuments({ workspaceId, _id: { $in: ids.campaigns } }),
  ]);
  return { templates, quickReplies, rules, campaigns };
}

/** Read-only: what would be created for a workspace (used by dry-run backfill and status endpoint). */
export async function inspectWorkspaceStarterData(workspaceId, industryKey) {
  const pack = resolveStarterPack(industryKey);
  const ids = expectedStarterIds(workspaceId, pack);
  const existing = await countExisting(workspaceId, ids);
  const expected = { templates: ids.templates.length, quickReplies: ids.quickReplies.length, rules: ids.rules.length, campaigns: ids.campaigns.length };
  const missing = Object.fromEntries(Object.keys(expected).map((k) => [k, expected[k] - existing[k]]));
  return { industryKey: pack.config.key, packVersion: pack.packVersion, expected, existing, missing, complete: Object.values(missing).every((n) => n === 0) };
}

/**
 * Provisions starter records for a workspace. Safe to call repeatedly.
 * Options:
 *  - force: run even if status is COMPLETED (only used by the explicit backfill tool).
 *  - _failAfter: test-only hook to simulate an interruption after N collections.
 */
export async function provisionWorkspaceStarterData({ workspaceId, ownerId, industryKey, force = false, _failAfter = null }) {
  if (!workspaceId || !ownerId) {
    const err = new Error('workspaceId and ownerId are required for starter provisioning.');
    err.status = 400;
    err.code = 'INVALID_PROVISIONING_REQUEST';
    throw err;
  }
  const pack = resolveStarterPack(industryKey);
  const now = new Date();

  const claimFilter = force ? { _id: workspaceId } : { _id: workspaceId, 'starterProvisioning.status': { $ne: 'COMPLETED' } };
  const claimed = await Workspace.findOneAndUpdate(
    claimFilter,
    {
      $set: {
        'starterProvisioning.status': 'IN_PROGRESS',
        'starterProvisioning.industryKey': pack.config.key,
        'starterProvisioning.packVersion': pack.packVersion,
        'starterProvisioning.startedAt': now,
        'starterProvisioning.lastError': '',
      },
      $inc: { 'starterProvisioning.attempts': 1 },
    },
    { new: true }
  );
  if (!claimed) {
    const ws = await Workspace.findById(workspaceId).select('starterProvisioning').lean();
    if (!ws) {
      const err = new Error('Workspace not found.');
      err.status = 404;
      err.code = 'WORKSPACE_NOT_FOUND';
      throw err;
    }
    return { status: 'COMPLETED', skipped: true, counts: ws.starterProvisioning?.counts || null };
  }

  try {
    const ops = buildOps({ workspaceId: claimed._id, ownerId, industryKey: pack.config.key, pack });
    const steps = [
      [MessageTemplate, ops.templateOps],
      [TemplateVersion, ops.versionOps],
      [QuickReply, ops.quickReplyOps],
      [AutoReplyRule, ops.ruleOps],
      [Campaign, ops.campaignOps],
    ];
    for (let i = 0; i < steps.length; i += 1) {
      if (_failAfter !== null && i >= _failAfter) throw new Error('Simulated provisioning interruption.');
      await runUpserts(steps[i][0], steps[i][1]);
    }

    const ids = expectedStarterIds(claimed._id, pack);
    const counts = await countExisting(claimed._id, ids);
    const complete =
      counts.templates === ids.templates.length &&
      counts.quickReplies === ids.quickReplies.length &&
      counts.rules === ids.rules.length &&
      counts.campaigns === ids.campaigns.length;

    await Workspace.updateOne(
      { _id: claimed._id },
      {
        $set: {
          'starterProvisioning.status': complete ? 'COMPLETED' : 'FAILED',
          'starterProvisioning.completedAt': complete ? new Date() : null,
          'starterProvisioning.counts': counts,
          'starterProvisioning.lastError': complete ? '' : 'Verification found missing starter records.',
        },
      }
    );
    return { status: complete ? 'COMPLETED' : 'FAILED', skipped: false, counts, packVersion: pack.packVersion, industryKey: pack.config.key };
  } catch (err) {
    await Workspace.updateOne(
      { _id: claimed._id },
      { $set: { 'starterProvisioning.status': 'FAILED', 'starterProvisioning.lastError': clip(err.message, 300) } }
    ).catch(() => {});
    throw err;
  }
}

/** Marks a freshly created workspace as awaiting provisioning (before the first attempt). */
export async function markStarterProvisioningPending(workspaceId, industryKey) {
  const pack = resolveStarterPack(industryKey);
  await Workspace.updateOne(
    { _id: workspaceId, starterProvisioning: { $exists: false } },
    { $set: { starterProvisioning: { status: 'PENDING', industryKey: pack.config.key, packVersion: pack.packVersion, attempts: 0 } } }
  );
}

/**
 * Creation-path helper: never throws, so a provisioning failure can't lose the
 * user's account or workspace. Returns an honest status for the API response.
 */
export async function provisionNewWorkspaceSafely({ workspaceId, ownerId, industryKey }) {
  try {
    await markStarterProvisioningPending(workspaceId, industryKey);
    return await provisionWorkspaceStarterData({ workspaceId, ownerId, industryKey });
  } catch (err) {
    console.error(`[starter-provisioning] workspace ${workspaceId} failed: ${err.message}`);
    return { status: 'FAILED', error: err.code || 'PROVISIONING_FAILED', message: err.message };
  }
}

export default {
  resolveStarterPack,
  expectedStarterIds,
  inspectWorkspaceStarterData,
  provisionWorkspaceStarterData,
  provisionNewWorkspaceSafely,
  markStarterProvisioningPending,
};
