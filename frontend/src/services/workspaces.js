import api from './api';

export async function getCurrentWorkspace() {
  const { data } = await api.get('/workspaces/current');
  return data;
}

export async function getMyWorkspaces() {
  const { data } = await api.get('/workspaces/my-workspaces');
  return data.workspaces || [];
}

export async function internalProvisionWorkspace(payload) {
  const { data } = await api.post('/workspaces/internal-provision', payload);
  return data;
}

export default {
  getCurrentWorkspace,
  getMyWorkspaces,
  internalProvisionWorkspace,
};
