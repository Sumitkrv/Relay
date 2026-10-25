import { resolveApiBaseUrl } from './apiBaseUrl';

/**
 * Helper to resolve media and asset URLs (e.g. uploaded logos, brochures)
 * Ensures relative backend paths like /api/onboarding/logo/... resolve correctly
 * regardless of whether they are rendered on Vite dev server (port 5174) or production.
 */
export function resolveMediaUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // Already an absolute or data URL
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }

  // If it's a public static asset in /public like /logo.png, leave as-is
  if (trimmed === '/logo.png' || trimmed === '/favicon.png') {
    return trimmed;
  }

  // If it's an API route like /api/onboarding/logo/...
  const apiBase = resolveApiBaseUrl(import.meta.env.VITE_API_URL, {
    production: import.meta.env.PROD,
    hostname: typeof window !== 'undefined' ? window.location.hostname : 'localhost',
  });
  const backendOrigin = apiBase.replace(/\/api\/?$/, '');
  const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${backendOrigin}${cleanPath}`;
}
