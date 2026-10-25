// Backend routes are mounted below /api; accept either an origin or its API base.
export function resolveApiBaseUrl(configuredUrl, { production = false, hostname = 'localhost' } = {}) {
  const base = configuredUrl?.trim() || (production ? '/api' : `http://${hostname || 'localhost'}:5000/api`);
  const normalized = base.replace(/\/+$/, '');
  return normalized.endsWith('/api') ? normalized : `${normalized}/api`;
}
