// Persist only a random cookie selector and tab-scoped auth token in tab storage.
const SESSION_KEY = 'relay_tab_session_id';
const TOKEN_KEY = 'relay_tab_auth_token';
export const WORKSPACE_KEY = 'relay_active_workspace_id';

export function getTabSessionId() {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!/^[a-f0-9]{32}$/.test(id || '')) {
    id = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function getTabToken() {
  return sessionStorage.getItem(TOKEN_KEY) || null;
}

export function setTabToken(token) {
  if (token && typeof token === 'string') {
    sessionStorage.setItem(TOKEN_KEY, token);
  } else {
    sessionStorage.removeItem(TOKEN_KEY);
  }
}

export function clearTabToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

export function clearWorkspaceSelection() {
  sessionStorage.removeItem(WORKSPACE_KEY);
}

export function startTabLogin() {
  // A tab opened with an opener may inherit sessionStorage. Signing in must fork it.
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  clearWorkspaceSelection();
  return getTabSessionId();
}

