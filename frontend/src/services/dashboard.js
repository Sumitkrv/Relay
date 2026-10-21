import api from './api';

export async function getDashboardOverview() {
  const res = await api.get('/dashboard/overview');
  return res.data;
}

export async function getDashboardStats() {
  const res = await api.get('/dashboard/stats');
  return res.data;
}

export async function getDashboardActivity(limit = 8) {
  const res = await api.get(`/dashboard/activity?limit=${limit}`);
  return res.data;
}

export default {
  getDashboardOverview,
  getDashboardStats,
  getDashboardActivity,
};
