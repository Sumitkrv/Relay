import mongoose from 'mongoose';
import * as reportService from '../services/reportService.js';
import ReportGeneration from '../models/ReportGeneration.js';

const fail = (m, s = 400) => Object.assign(new Error(m), { status: s });

export async function overview(req, res) {
  const data = await reportService.getOverview(req.user._id, req.query);
  res.json(data);
}

export async function campaigns(req, res) {
  const data = await reportService.getCampaignPerformance(req.user._id, req.query);
  res.json(data);
}

export async function compare(req, res) {
  const idsParam = req.query.ids;
  if (!idsParam) throw fail('Please provide comma-separated campaign IDs in the "ids" query parameter.', 400);
  const ids = String(idsParam)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const data = await reportService.compareCampaigns(req.user._id, ids);
  res.json(data);
}

export async function getCampaign(req, res) {
  const cId = req.params.id;
  const data = await reportService.getCampaignPerformance(req.user._id, { campaignId: cId });
  if (!data.records.length) throw fail('Campaign report not found.', 404);
  res.json({ campaign: data.records[0] });
}

export async function campaignRecipients(req, res) {
  const data = await reportService.getCampaignRecipients(req.user._id, req.params.id, req.query);
  res.json(data);
}

export async function messages(req, res) {
  const data = await reportService.getMessages(req.user._id, req.query);
  res.json(data);
}

export async function messageStatus(req, res) {
  const data = await reportService.getMessageStatusSummary(req.user._id, req.query);
  res.json(data);
}

export async function failures(req, res) {
  const data = await reportService.getFailureAnalytics(req.user._id, req.query);
  res.json(data);
}

export async function retries(req, res) {
  const data = await reportService.getRetryAnalytics(req.user._id, req.query);
  res.json(data);
}

export async function scheduling(req, res) {
  const data = await reportService.getSchedulingAnalytics(req.user._id, req.query);
  res.json(data);
}

export async function consent(req, res) {
  const data = await reportService.getConsentReporting(req.user._id, req.query);
  res.json(data);
}

export async function optOuts(req, res) {
  const data = await reportService.getOptOutReporting(req.user._id, req.query);
  res.json(data);
}

export async function audienceExclusions(req, res) {
  const data = await reportService.getAudienceExclusions(req.user._id, req.query);
  res.json(data);
}

export async function inbox(req, res) {
  const data = await reportService.getInboxAnalytics(req.user._id, req.query);
  res.json(data);
}

export async function autoReplies(req, res) {
  const data = await reportService.getAutoReplyAnalytics(req.user._id, req.query);
  res.json(data);
}

export async function filters(req, res) {
  const data = await reportService.getAvailableFilters(req.user._id);
  res.json(data);
}

export async function exportReport(req, res) {
  const b = req.body || {};
  const reportType = b.reportType || req.query.reportType || 'campaign_summary';
  const format = String(b.format || req.query.format || 'csv').toLowerCase();
  const filters = b.filters || req.query || {};

  const file = await reportService.exportReportData(req.user._id, {
    reportType,
    format,
    filters
  });

  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
  res.setHeader('Content-Length', file.buffer.length);
  res.setHeader('X-Report-Generation-Id', String(file.generationId));
  res.setHeader('X-Export-Row-Count', String(file.rowCount));
  res.send(file.buffer);
}

export async function listExports(req, res) {
  const records = await ReportGeneration.find({ ownerId: req.user._id })
    .sort({ createdAt: -1 })
    .limit(50)
    .select('-fileData')
    .lean();
  res.json({ records });
}

export async function downloadExport(req, res) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) throw fail('Invalid Generation ID.', 400);
  const row = await ReportGeneration.findOne({ _id: req.params.id, ownerId: req.user._id })
    .select('+fileData')
    .lean();
  if (!row || !row.fileData) throw fail('Export file is unavailable or expired.', 404);

  res.setHeader('Content-Type', row.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${row.fileName}"`);
  res.setHeader('Content-Length', row.fileData.length);
  res.send(row.fileData);
}
