export function sessionCookieName(req) {
  const tabId = req?.get('x-relay-session-id');
  if (tabId === undefined) return 'session'; // Existing API clients remain compatible.
  if (!/^[a-f0-9]{32}$/.test(tabId)) {
    throw Object.assign(new Error('Invalid tab session identifier.'), { status: 400 });
  }
  return `relay_session_${tabId}`;
}

export function requestToken(req) {
  // An explicit invalid credential must never fall back to another account's cookie.
  const authorization = req.get('authorization');
  if (authorization !== undefined) {
    return /^Bearer\s+\S+$/i.test(authorization) ? authorization.replace(/^Bearer\s+/i, '') : '';
  }
  return req.cookies?.[sessionCookieName(req)];
}
