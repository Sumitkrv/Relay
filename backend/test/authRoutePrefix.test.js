import test from 'node:test';
import request from 'supertest';
import app from '../src/app.js';

process.env.NODE_ENV = 'test';

test('the canonical session route requires authentication', async () => {
  await request(app).get('/api/auth/me').expect(401);
});

test('login and registration use /api/auth and retain input validation', async () => {
  // Invalid input is rejected before any database access or account creation.
  await request(app).post('/api/auth/login').send({}).expect(400);
  await request(app).post('/api/auth/register').send({}).expect(400);
});

test('unprefixed authentication aliases are not exposed', async () => {
  await request(app).get('/auth/me').expect(404);
  await request(app).post('/auth/login').send({}).expect(404);
  await request(app).post('/auth/register').send({}).expect(404);
});
