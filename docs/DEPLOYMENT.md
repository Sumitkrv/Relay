# Deploying Relay

Relay has two services: the Vite frontend and the persistent Express API. Deploying the frontend alone does not deploy MongoDB or the API. The API process also runs the existing campaign, message, and workflow workers.

## Frontend on Vercel

Both repository-root and `frontend` Root Directory settings are supported by the checked-in `vercel.json` files. They install from the frontend lockfile with `npm ci`, run the Vite build, publish `frontend/dist` (or `dist` within `frontend`), and serve React Router deep links through `index.html`.

The SPA fallback follows [Vercel's Vite deployment instructions](https://vercel.com/docs/frameworks/frontend/vite#using-vite-to-make-spas). It serves frontend pages; it does not create API endpoints.

Set `VITE_API_URL` in Vercel to the deployed API's full HTTPS base URL, including `/api`. Rebuild after changing this setting: Vite embeds it at build time. Only public configuration belongs in `VITE_*` variables.

When no API URL is configured, production requests use `/api` on the frontend origin. That requires a real same-origin API proxy; the SPA fallback alone cannot provide one. Development retains the local API on port 5000.

## Persistent backend service

Run the existing Node server on a host that supports a persistent Node process and its background workers. Use Node.js 20.19+ or a current supported LTS release.

From the repository root:

```sh
npm --prefix backend ci --omit=dev
npm --prefix backend start
```

Configure these variables in the backend host's environment:

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `MONGODB_URI` | The private MongoDB connection string for the intended database |
| `JWT_SECRET` | A private random secret of at least 32 characters |
| `FRONTEND_URL` | `https://relay-lilac-one.vercel.app` (or the final custom frontend origin) |
| `PUBLIC_APP_URL` | The same public frontend origin |
| `EMAIL_PROVIDER` | `inmemory`, retaining offline email behavior |
| `WHATSAPP_PROVIDER` | `mock`, retaining offline messaging |
| `PORT` | Usually supplied by the backend host; defaults to `5000` |

Keep real provider credentials unset. Do not run seeds, resets, or migrations as deployment commands. Existing local MongoDB records are not automatically transferred to a hosted MongoDB instance; any data transfer needs a separate explicit instruction.

The current authentication cookies use `SameSite=Lax` and `Secure` in production. Use a same-site frontend/API domain arrangement or a same-origin API proxy for cookie authentication. Unrelated frontend/backend domains require a separately configured and verified cross-site cookie policy.

## Verification before enabling traffic

```sh
npm --prefix frontend test
npm --prefix frontend run build
node --import ./backend/qa/noLiveDatabase.js --test backend/test/deploymentStartup.test.js
```

Check the deployed API's `/api/health`, then the frontend's direct `/login` URL, sign-in, and the M2W workspace screens. Confirm the API uses the intended MongoDB database and reports Mock Mode. A frontend-only deployment can show the login screen but cannot authenticate or load CRM data until the backend is deployed.
