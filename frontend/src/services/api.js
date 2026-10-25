import axios from 'axios';
import { getTabSessionId } from './tabSession';
import { resolveApiBaseUrl } from '../utils/apiBaseUrl';

const getBaseUrl = () => {
  const host = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';
  return resolveApiBaseUrl(import.meta.env.VITE_API_URL, {
    production: import.meta.env.PROD,
    hostname: host,
  });
};

const api = axios.create({
  baseURL: getBaseUrl(),
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
  try {
    config.headers['x-relay-session-id'] = getTabSessionId();
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
