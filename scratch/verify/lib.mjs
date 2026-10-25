import fs from 'node:fs';
export const BASE = process.env.RELAY_API || 'http://localhost:5000/api';
const pw = (() => { try { return JSON.parse(fs.readFileSync(new URL('../.demo-passwords.json', import.meta.url))); } catch { return {}; } })();
export const KNOWN = { ...pw };
export async function call(token, method, path, body, headers = {}) {
  const h = { 'Content-Type': 'application/json', ...headers };
  if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(BASE + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  let j = null; const txt = await r.text(); try { j = JSON.parse(txt); } catch { j = txt; }
  return { s: r.status, j };
}
export async function login(email, password) {
  const r = await call(null, 'POST', '/auth/login', { email, password });
  return { ...r, token: r.j?.token || r.j?.accessToken };
}
export const ws = (id) => ({ 'x-workspace-id': String(id) });
export const sh = (o, n = 220) => String(JSON.stringify(o)).slice(0, n);
