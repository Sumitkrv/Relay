import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app, { isOriginAllowed, STATIC_APPROVED_ORIGINS, VERCEL_PREVIEW_RE } from '../src/app.js';

test('CORS Security Suite — Origin Policy & Preflight Handlers', async (t) => {
  await t.test('1. Static Approved Origins are authorized', () => {
    assert.equal(isOriginAllowed('https://relay-lilac-one.vercel.app'), true);
    assert.equal(isOriginAllowed('https://relay-8bwcassqe-sumitkrvs-projects.vercel.app'), true);
    assert.equal(isOriginAllowed('https://relay-7vfkwvd85-sumitkrvs-projects.vercel.app'), true);
    assert.equal(isOriginAllowed('http://localhost:5173'), true);
    assert.equal(isOriginAllowed('http://127.0.0.1:5173'), true);
  });

  await t.test('2. Dynamic Vercel preview deployments are safely matched via anchored regex', () => {
    // Valid preview patterns for Relay
    assert.equal(isOriginAllowed('https://relay-preview-123-sumitkrvs-projects.vercel.app'), true);
    assert.equal(isOriginAllowed('https://relay-git-main-sumitkrvs-projects.vercel.app'), true);
    assert.equal(isOriginAllowed('https://relay-sumitkrvs-projects.vercel.app'), true);
    assert.equal(isOriginAllowed('https://relay-abc99xyz-sumitkrvs-projects.vercel.app'), true);

    // Malicious or foreign origins must be rejected
    assert.equal(isOriginAllowed('https://evil-relay-sumitkrvs-projects.vercel.app'), false);
    assert.equal(isOriginAllowed('https://relay-7vfkwvd85-otheraccount-projects.vercel.app'), false);
    assert.equal(isOriginAllowed('https://relay-7vfkwvd85-sumitkrvs-projects.vercel.app.attacker.com'), false);
    assert.equal(isOriginAllowed('http://relay-7vfkwvd85-sumitkrvs-projects.vercel.app'), false); // Not HTTPS
    assert.equal(isOriginAllowed('https://arbitrary-site.com'), false);
    assert.equal(isOriginAllowed('https://phishing-relay.vercel.app'), false);
  });

  await t.test('3. Environment variables (FRONTEND_URL, CORS_ALLOWED_ORIGINS) expand allowlist', () => {
    process.env.CORS_ALLOWED_ORIGINS = 'https://custom-domain.com, https://another-domain.com/';
    assert.equal(isOriginAllowed('https://custom-domain.com'), true);
    assert.equal(isOriginAllowed('https://another-domain.com'), true);
    delete process.env.CORS_ALLOWED_ORIGINS;
  });

  await t.test('4. Preflight OPTIONS request succeeds for active Vercel frontend origin', async () => {
    const origin = 'https://relay-7vfkwvd85-sumitkrvs-projects.vercel.app';
    const res = await request(app)
      .options('/api/auth/me')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'x-relay-session-id,content-type,authorization');

    assert.equal(res.status, 204);
    assert.equal(res.headers['access-control-allow-origin'], origin);
    assert.equal(res.headers['access-control-allow-credentials'], 'true');
    assert.ok(res.headers['access-control-allow-methods'].includes('GET'));
    assert.ok(res.headers['access-control-allow-methods'].includes('OPTIONS'));
    assert.ok(res.headers['access-control-allow-headers'].toLowerCase().includes('x-relay-session-id'));
    assert.ok(res.headers['access-control-allow-headers'].toLowerCase().includes('content-type'));
    assert.ok(res.headers['access-control-allow-headers'].toLowerCase().includes('authorization'));
  });

  await t.test('5. Preflight OPTIONS succeeds for dynamic preview URL', async () => {
    const origin = 'https://relay-new-preview-test-sumitkrvs-projects.vercel.app';
    const res = await request(app)
      .options('/api/auth/me')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'x-relay-session-id,authorization');

    assert.equal(res.status, 204);
    assert.equal(res.headers['access-control-allow-origin'], origin);
    assert.equal(res.headers['access-control-allow-credentials'], 'true');
  });

  await t.test('6. Disallowed origin receives 403 Forbidden with CORS_ORIGIN_DENIED', async () => {
    const res = await request(app)
      .options('/api/auth/me')
      .set('Origin', 'https://malicious-site.example.com')
      .set('Access-Control-Request-Method', 'GET');

    assert.equal(res.status, 403);
    assert.equal(res.body.code, 'CORS_ORIGIN_DENIED');
    assert.equal(res.headers['access-control-allow-origin'], undefined);
  });

  await t.test('7. Unauthenticated GET /api/auth/me reaches auth middleware and returns 401 (not 403)', async () => {
    const origin = 'https://relay-7vfkwvd85-sumitkrvs-projects.vercel.app';
    const res = await request(app)
      .get('/api/auth/me')
      .set('Origin', origin)
      .set('x-relay-session-id', '0123456789abcdef0123456789abcdef');

    assert.equal(res.status, 401);
    assert.equal(res.headers['access-control-allow-origin'], origin);
    assert.equal(res.headers['access-control-allow-credentials'], 'true');
  });

  await t.test('8. Server-to-server or no-origin requests are permitted', () => {
    assert.equal(isOriginAllowed(''), true);
    assert.equal(isOriginAllowed(undefined), true);
  });
});
