# Deploying Relay

Relay has two services: the Vite frontend and the persistent Express API. Deploying the frontend alone does not deploy MongoDB or the API. The API process also runs the existing campaign, message, and workflow workers.

## Frontend on Vercel

Both repository-root and `frontend` Root Directory settings are supported by the checked-in `vercel.json` files. They install from the frontend lockfile with `npm ci`, run the Vite build, publish `frontend/dist` (or `dist` within `frontend`), and serve React Router deep links through `index.html`.

The SPA fallback follows [Vercel's Vite deployment instructions](https://vercel.com/docs/frameworks/frontend/vite#using-vite-to-make-spas). It serves frontend pages; it does not create API endpoints.

Set `VITE_API_URL` in Vercel to the deployed API's full HTTPS base URL, including `/api`. Rebuild after changing this setting: Vite embeds it at build time. Only public configuration belongs in `VITE_*` variables.

For the current deployment, set this in Vercel's Production environment and redeploy:

```dotenv
VITE_API_URL=https://relay-kvfx.onrender.com/api
```

The shared frontend client normalizes either `https://relay-kvfx.onrender.com` or `https://relay-kvfx.onrender.com/api` to the same API base and removes trailing slashes. Media URL resolution uses the same normalization.

Authentication routes are mounted once, at `/api/auth` in `backend/src/app.js`; `server.js` starts that app. The session endpoint is `GET /api/auth/me`, login is `POST /api/auth/login`, and signup is `POST /api/auth/register`. Frontend service calls remain `/auth/me`, `/auth/login`, and `/auth/register` relative to the normalized API base. No `/auth/*` backend aliases are required. An anonymous `/api/auth/me` request correctly returns HTTP 401; `/auth/me` returns HTTP 404.

When no API URL is configured, production requests use `/api` on the frontend origin. That requires a real same-origin API proxy; the SPA fallback alone cannot provide one. Development retains the local API on port 5000.

## Persistent backend service

Run the existing Node server on a host that supports a persistent Node process and its background workers. Use Node.js 20.19+ or a current supported LTS release.

From the repository root:

```sh
npm --prefix backend ci --omit=dev
npm --prefix backend start
```

### Render settings

For the existing Render web service, open **Settings → Build & Deploy** and set:

| Setting | Value |
| --- | --- |
| Root Directory | `backend` |
| Build Command | `npm ci --omit=dev` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |

Save these settings and redeploy the latest commit. Render's explicit build and start commands are documented in its [Express deployment guide](https://render.com/docs/deploy-node-express-app).

The start script runs `node src/server.js` from `backend`. `backend/index.js` is also a compatibility launcher for an existing service still configured with `node index.js`. Keep `package-lock.json`: the npm build command uses it and respects the existing npm dependency overrides. The Yarn deprecation warnings in the supplied log did not cause the crash; the missing entry point did.

Nodemailer is a required production dependency because `src/services/emailService.js` imports it when the API starts, even with `EMAIL_PROVIDER=inmemory`. It is declared in `backend/package.json` and synchronized with `backend/package-lock.json`. Commit both files together. An undeclared package left in a local installation or as an orphan lockfile entry is not a valid dependency declaration. The source import audit covers all 262 backend source files; no other external imports need an additional production dependency.

The server reads Render's `PORT` and explicitly binds to `0.0.0.0`. Set `FRONTEND_URL` to the Vercel origin below; its optional trailing slash is normalized before CORS comparison. CORS retains its explicit origin allowlist and credential support.

For Blueprint deployments, the repository-root `render.yaml` supplies these settings and prompts for the private MongoDB URI and JWT secret. An existing manually configured Render service does not automatically adopt this file; update its settings as shown above. The Blueprint selects free compute for initial setup. Scheduled background processing needs an always-on service because [free Render web services spin down when idle](https://render.com/docs/free#spinning-down-on-idle).

Configure these variables in the backend host's environment:

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `MONGODB_URI` | The private MongoDB connection string for the intended database |
| `JWT_SECRET` | A private random secret of at least 32 characters |
| `FRONTEND_URL` | `https://relay-lilac-one.vercel.app` (or the final custom frontend origin) |
| `CORS_ALLOWED_ORIGINS` | Optional comma-separated additional exact origins; for the supplied preview, `https://relay-7vfkwvd85-sumitkrvs-projects.vercel.app` |
| `PUBLIC_APP_URL` | The same public frontend origin |
| `EMAIL_PROVIDER` | `inmemory`, retaining offline email behavior |
| `WHATSAPP_PROVIDER` | `mock`, retaining offline messaging |
| `PORT` | Usually supplied by the backend host; defaults to `5000` |

Keep real provider credentials unset. Do not run seeds, resets, or migrations as deployment commands. Existing local MongoDB records are not automatically transferred to a hosted MongoDB instance; any data transfer needs a separate explicit instruction.

The current authentication cookies use `SameSite=Lax` and `Secure` in production. Use a same-site frontend/API domain arrangement or a same-origin API proxy for cookie authentication. Unrelated frontend/backend domains require a separately configured and verified cross-site cookie policy.

### Preview-origin CORS preflights

The production frontend origin and a Vercel preview origin are different origins. Keep `FRONTEND_URL=https://relay-lilac-one.vercel.app` on Render and add the approved preview separately:

```dotenv
CORS_ALLOWED_ORIGINS=https://relay-7vfkwvd85-sumitkrvs-projects.vercel.app
```

Save this variable in Render and redeploy the backend with the CORS allowlist changes. Local `.env` edits do not update Render's environment. This is an exact allowlist; other previews must be explicitly added, separated by commas. All `*.vercel.app` origins are not automatically trusted.

Allowed origins receive HTTP 204 for the authentication preflight and the appropriate response from the actual endpoint (HTTP 401 for an anonymous `/api/auth/me`). Denied origins return HTTP 403 with code `CORS_ORIGIN_DENIED` instead of being reported as an internal server error. Session validation and API route prefixes are unchanged. The existing application-level CORS middleware handles preflights; no duplicate auth or OPTIONS routes are needed. See the [Express CORS documentation](https://expressjs.com/en/resources/middleware/cors.html).

## Verification before enabling traffic

```sh
npm --prefix frontend test
npm --prefix frontend run build
node --import ./backend/qa/noLiveDatabase.js --test backend/test/deploymentStartup.test.js
```

For a complete production-install smoke check, first install the backend's development dependencies locally with `npm --prefix backend ci`, then run:

```sh
npm --prefix backend run verify:production
```

This check copies source and dependency manifests to a temporary directory without `.env` files or existing `node_modules`. It runs `npm ci --omit=dev`, checks the production dependency tree and offline email behavior, and runs the real `npm start` against a newly created disposable MongoDB instance. It verifies HTTP 200 from `/api/health`, credentialed requests and preflights from `https://relay-lilac-one.vercel.app`, and authentication enforcement. The harness uses local development test tools; those tools are absent from the production install being tested. It neither connects to existing MongoDB instances nor sends real email.

The production check passed on Node.js `24.22.1` with npm `11.21.1`, matching the reported Render Node runtime. The deployment/authentication regression suites passed 54 tests. These local checks do not change Render or Vercel settings and do not replace verification of the deployed backend's own `/api/health` URL after redeployment.

Check the deployed API's `/api/health`, then the frontend's direct `/login` URL, sign-in, and the M2W workspace screens. Confirm the API uses the intended MongoDB database and reports Mock Mode. A frontend-only deployment can show the login screen but cannot authenticate or load CRM data until the backend is deployed.
