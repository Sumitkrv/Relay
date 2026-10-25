import api from './api';

export async function getIndustrySummaries() {
  const { data } = await api.get('/industries');
  if (!Array.isArray(data.industries)) throw new Error('Industry catalog is unavailable.');
  return data.industries;
}

export async function getIndustryDetails(industryKey) {
  const { data } = await api.get(`/industries/${encodeURIComponent(industryKey)}`);
  if (!data.industry) throw new Error('Industry configuration is unavailable.');
  return data.industry;
}

export async function getWorkspaceIndustryConfig(workspaceId) {
  const { data } = await api.get('/industries/workspace/current', {
    headers: { 'x-workspace-id': workspaceId },
  });
  if (!data.industryKey || !data.ui || String(data.workspaceId) !== String(workspaceId)) {
    throw new Error('Workspace industry configuration is unavailable.');
  }
  return data;
}

export default { getIndustrySummaries, getIndustryDetails, getWorkspaceIndustryConfig };
