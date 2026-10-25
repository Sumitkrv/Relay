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

export async function getStarterProvisioningStatus() {
  const { data } = await api.get('/workspaces/current/starter-provisioning');
  return data;
}

// Resumes an unfinished provisioning; the backend inserts only missing starter records.
export async function retryStarterProvisioning() {
  const { data } = await api.post('/workspaces/current/starter-provisioning/retry');
  return data;
}

export default {
  getCurrentWorkspace,
  getMyWorkspaces,
  internalProvisionWorkspace,
  getStarterProvisioningStatus,
  retryStarterProvisioning,
};
