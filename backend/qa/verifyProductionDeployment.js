// Exercise Render's production install and real server without existing data or providers.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { MongoMemoryServer } from 'mongodb-memory-server';

const backendRoot = fileURLToPath(new URL('../', import.meta.url));
const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'relay-production-check-'));
const origin = 'https://relay-lilac-one.vercel.app';
let mongo;
let server;
let serverExit;
let serverOutput = '';

function runNpm(args, env) {
  const result = spawnSync('npm', args, { cwd: directory, env, encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`npm ${args.join(' ')} failed:\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

async function unusedPort() {
  const listener = net.createServer();
  listener.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const { port } = listener.address();
  await new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
  return port;
}

try {
  for (const name of ['package.json', 'package-lock.json', 'src']) {
    await fs.cp(path.join(backendRoot, name), path.join(directory, name), { recursive: true });
  }
  await fs.mkdir(path.join(directory, 'tmp'));
  // .env files, uploads, local databases, and existing node_modules are never copied.
  const environment = { ...process.env };
  for (const key of Object.keys(environment)) {
    if (/^(SMTP_|RAZORPAY_|META_|WHATSAPP_|EMAIL_API_KEY$)/.test(key)) delete environment[key];
  }
  Object.assign(environment, {
    NODE_ENV: 'production',
    EMAIL_PROVIDER: 'inmemory',
    WHATSAPP_PROVIDER: 'mock',
    LIVE_WHATSAPP_ENABLED: 'false',
    LIVE_BILLING_ENABLED: 'false',
    RELAY_LIVE_BILLING_ENABLED: 'false',
    APP_MODE: 'test',
    JWT_SECRET: crypto.randomBytes(48).toString('hex'),
    FRONTEND_URL: `${origin}/`, // Accept configuration copied with a trailing slash.
    PUBLIC_APP_URL: origin,
    TMPDIR: path.join(directory, 'tmp'),
  });

  console.log(`Checking production deployment with Node ${process.versions.node}.`);
  runNpm(['ci', '--omit=dev', '--no-audit', '--no-fund'], environment);
  runNpm(['ls', '--omit=dev', '--depth=0'], environment);
  for (const name of ['mongodb-memory-server', 'supertest']) {
    await assert.rejects(fs.access(path.join(directory, 'node_modules', name)));
  }
  console.log('PASS: clean npm ci --omit=dev; production dependency tree resolves; test dependencies are absent.');

  const emailProbe = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import nodemailer from 'nodemailer';
    import { sendVerificationEmail, sendPasswordResetEmail, getEmailHistory, clearEmailHistory } from './src/services/emailService.js';
    clearEmailHistory();
    await sendVerificationEmail({ to: 'qa@example.test', name: 'QA Operator', verificationUrl: 'https://example.test/verify' });
    await sendPasswordResetEmail({ to: 'qa@example.test', name: 'QA Operator', resetUrl: 'https://example.test/reset' });
    const messages = getEmailHistory();
    assert.equal(messages.length, 2);
    assert.ok(messages.every(message => message.provider === 'inmemory'));
    assert.ok(messages[0].html.includes('https://example.test/verify'));
    assert.ok(messages[1].text.includes('https://example.test/reset'));
    const message = await nodemailer.createTransport({ streamTransport: true, buffer: true }).sendMail({
      from: 'qa@example.test', to: 'recipient@example.test', subject: 'Offline transport check', text: 'No network delivery.'
    });
    assert.ok(Buffer.isBuffer(message.message));
    await import('./src/app.js');
  `], { cwd: directory, env: environment, encoding: 'utf8' });
  if (emailProbe.error) throw emailProbe.error;
  assert.equal(emailProbe.status, 0, emailProbe.stderr);
  console.log('PASS: email and API imports resolve; verification/reset emails and Nodemailer MIME transport work offline.');

  mongo = await MongoMemoryServer.create({ instance: { dbName: 'relay_deployment_test' } });
  const port = await unusedPort();
  environment.MONGODB_URI = mongo.getUri();
  environment.DATABASE_NAME = 'relay_deployment_test';
  environment.PORT = String(port);
  server = spawn('npm', ['start'], {
    cwd: directory, env: environment, detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  serverExit = new Promise(resolve => server.once('exit', resolve));
  server.stdout.on('data', chunk => { serverOutput += chunk.toString(); });
  server.stderr.on('data', chunk => { serverOutput += chunk.toString(); });
  let spawnError;
  server.once('error', error => { spawnError = error; });

  let health;
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (spawnError) throw spawnError;
    if (server.exitCode !== null) throw new Error(`npm start exited early:\n${serverOutput}`);
    let response;
    try {
      response = await fetch(`http://127.0.0.1:${port}/api/health`, {
        headers: { Origin: origin }, signal: AbortSignal.timeout(1000),
      });
    } catch {}
    if (response?.status === 200) {
      assert.equal(response.headers.get('access-control-allow-origin'), origin);
      assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
      health = await response.json();
      break;
    }
    await delay(200);
  }
  assert.ok(health, `Server did not become healthy:\n${serverOutput}`);
  assert.equal(health.database, 'connected');
  assert.equal(health.mockMode, true);
  assert.match(serverOutput, new RegExp(`0\\.0\\.0\\.0:${port}`));
  const preflight = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
    method: 'OPTIONS', headers: {
      Origin: origin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type,x-relay-session-id,x-workspace-id',
    },
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
  assert.equal(preflight.headers.get('access-control-allow-credentials'), 'true');
  const protectedRoute = await fetch(`http://127.0.0.1:${port}/api/auth/me`);
  assert.equal(protectedRoute.status, 401);
  console.log('PASS: npm start binds 0.0.0.0 on PORT; /api/health returns HTTP 200 with MongoDB connected and Mock Mode.');
  console.log('PASS: Vercel-origin credentialed CORS and preflight work; authentication remains enforced.');
} finally {
  if (server?.pid && server.exitCode === null) {
    if (process.platform === 'win32') server.kill('SIGTERM');
    else {
      try { process.kill(-server.pid, 'SIGTERM'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
    }
    await Promise.race([serverExit, delay(3000)]);
  }
  await mongo?.stop();
  // Preserve the disposable files for inspection; never touch the working backend.
  console.log(`Isolated verification files: ${directory}`);
}
