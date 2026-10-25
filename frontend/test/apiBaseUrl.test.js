import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { resolveApiBaseUrl } from '../src/utils/apiBaseUrl.js';

const backend = 'https://relay-kvfx.onrender.com';

test('origin-only API configuration includes the backend /api prefix', () => {
  for (const configured of [backend, `${backend}/`, `  ${backend}/  `]) {
    assert.equal(resolveApiBaseUrl(configured, { production: true }), `${backend}/api`);
  }
});

test('an explicit API base is preserved without duplicating /api', () => {
  for (const configured of [`${backend}/api`, `${backend}/api/`, `${backend}/api///`]) {
    assert.equal(resolveApiBaseUrl(configured), `${backend}/api`);
  }
  assert.equal(resolveApiBaseUrl('/api/'), '/api');
  assert.equal(resolveApiBaseUrl('/relay/api/'), '/relay/api');
});

test('API configuration retains production and development defaults', () => {
  assert.equal(resolveApiBaseUrl(undefined, { production: true }), '/api');
  assert.equal(resolveApiBaseUrl('  ', { production: true }), '/api');
  assert.equal(resolveApiBaseUrl(undefined), 'http://localhost:5000/api');
  assert.equal(resolveApiBaseUrl('', { hostname: '127.0.0.1' }), 'http://127.0.0.1:5000/api');
});

test('Axios resolves session, login and signup requests to the canonical backend routes', () => {
  for (const configured of [backend, `${backend}/`, `${backend}/api`, `${backend}/api/`]) {
    const client = axios.create({ baseURL: resolveApiBaseUrl(configured), withCredentials: true });
    for (const [method, url] of [['get', '/auth/me'], ['post', '/auth/login'], ['post', '/auth/register']]) {
      assert.equal(client.getUri({ method, url }), `${backend}/api${url}`);
    }
    assert.equal(client.defaults.withCredentials, true);
  }
});
