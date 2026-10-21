import axios from 'axios';

const getBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  const host = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';
  return `http://${host}:5000/api`;
};

const api = axios.create({
  baseURL: getBaseUrl(),
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
  try {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('relay_auth_token') : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const workspaceId = typeof localStorage !== 'undefined' ? localStorage.getItem('relay_active_workspace_id') : null;
    if (workspaceId) {
      config.headers['x-workspace-id'] = workspaceId;
    }
  } catch {}
  return config;
});

export default api;
