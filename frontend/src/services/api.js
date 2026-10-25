import axios from 'axios';
import { getTabSessionId } from './tabSession';

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
