// Persist only a random cookie selector in tab storage. The session cookie stays HttpOnly.
const SESSION_KEY = 'relay_tab_session_id';
export const WORKSPACE_KEY = 'relay_active_workspace_id';

export function getTabSessionId() {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!/^[a-f0-9]{32}$/.test(id || '')) {
    id = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function clearWorkspaceSelection() {
  sessionStorage.removeItem(WORKSPACE_KEY);
}

export function startTabLogin() {
  // A tab opened with an opener may inherit sessionStorage. Signing in must fork it.
  sessionStorage.removeItem(SESSION_KEY);
  clearWorkspaceSelection();
  return getTabSessionId();
}
