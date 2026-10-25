import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

const production = 'https://relay-lilac-one.vercel.app';
const preview = 'https://relay-7vfkwvd85-sumitkrvs-projects.vercel.app';
const branch = 'https://relay-git-main-sumitkrvs-projects.vercel.app';
const originalFrontend = process.env.FRONTEND_URL;
const originalAdditional = process.env.CORS_ALLOWED_ORIGINS;
let app;
try {
  process.env.FRONTEND_URL = `${production}/`;
  process.env.CORS_ALLOWED_ORIGINS = ` ${preview}/, ${branch}/, `;
  ({ default: app } = await import('../src/app.js'));
} finally {
  if (originalFrontend === undefined) delete process.env.FRONTEND_URL;
  else process.env.FRONTEND_URL = originalFrontend;
  if (originalAdditional === undefined) delete process.env.CORS_ALLOWED_ORIGINS;
  else process.env.CORS_ALLOWED_ORIGINS = originalAdditional;
}

test('production and explicitly approved previews accept authentication preflights', async () => {
  for (const origin of [production, preview, branch]) {
    for (const [path, method] of [['me', 'GET'], ['login', 'POST'], ['register', 'POST']]) {
      const response = await request(app).options(`/api/auth/${path}`)
        .set('Origin', origin)
        .set('Access-Control-Request-Method', method)
        .set('Access-Control-Request-Headers', 'content-type,x-relay-session-id,x-workspace-id')
        .expect(204);
      assert.equal(response.headers['access-control-allow-origin'], origin);
      assert.equal(response.headers['access-control-allow-credentials'], 'true');
      assert.match(response.headers.vary, /Origin/);
      assert.match(response.headers['access-control-allow-headers'], /x-relay-session-id/);
      assert.match(response.headers['access-control-allow-headers'], /x-workspace-id/);
    }
  }
});

test('approved preview access does not bypass authentication', async () => {
  const response = await request(app).get('/api/auth/me').set('Origin', preview).expect(401);
  assert.equal(response.headers['access-control-allow-origin'], preview);
  assert.equal(response.headers['access-control-allow-credentials'], 'true');
});

test('unlisted origins and lookalike domains are denied without a server error', async () => {
  for (const origin of [
    'https://unrelated-project.vercel.app',
    'https://relay-unapproved-sumitkrvs-projects.vercel.app',
    `${preview}.example.test`,
    'null',
  ]) {
    const response = await request(app).options('/api/auth/me')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'GET')
      .expect(403);
    assert.equal(response.body.code, 'CORS_ORIGIN_DENIED');
    assert.equal(response.headers['access-control-allow-origin'], undefined);
  }
});

test('requests without an Origin retain normal authentication enforcement', async () => {
  await request(app).get('/api/auth/me').expect(401);
});
