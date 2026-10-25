import axios from 'axios';
import { getTabSessionId, getTabToken } from './tabSession';

const getBaseUrl = () => {
  let url = import.meta.env.VITE_API_URL;
  if (url && String(url).trim()) {
    url = String(url).trim().replace(/\/+$/, '');
    if (!url.endsWith('/api')) {
      url = `${url}/api`;
    }
    return url;
  }
  if (import.meta.env.PROD) {
    return 'https://relay-kvfx.onrender.com/api';
  }
  const host = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';
  return `http://${host}:5000/api`;
};

const api = axios.create({
  baseURL: getBaseUrl(),
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  try {
    config.headers['x-relay-session-id'] = getTabSessionId();

    const token = getTabToken();
    if (token && !config.headers['Authorization']) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    const workspaceId = sessionStorage.getItem('relay_active_workspace_id');
    if (workspaceId && !config.headers['x-workspace-id']) {
      config.headers['x-workspace-id'] = workspaceId;
    }
  } catch (error) {
    return Promise.reject(new Error('Tab session storage is unavailable. Enable browser storage to sign in.', { cause: error }));
  }
  return config;
});

export default api;
