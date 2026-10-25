# Relay — Freelance Outreach CRM

A JavaScript monorepo for a consent based freelance outreach CRM. It includes registration, login, protected workspace pages, live dashboard data, account settings, MongoDB backed contact and lead management, and persistent Excel/CSV contact imports. Campaigns, WhatsApp integration, and messaging are intentionally not implemented.

## Requirements

For production hosting, see [Deploying Relay](docs/DEPLOYMENT.md).

- Node.js 20 or newer and npm
- MongoDB Community Server running locally, or a MongoDB connection string

## Local setup

1. Copy `backend/.env.example` to `backend/.env` and set `MONGODB_URI`, `FRONTEND_URL`, and a random `JWT_SECRET` with at least 32 characters.
2. From the repository root run `npm install --prefix backend` and `npm install --prefix frontend`.
3. Start MongoDB.
4. In one terminal run `npm run dev:backend`.
5. In another terminal run `npm run dev:frontend`.
6. Open the Vite URL (normally `http://localhost:5173`) and create your account.

The frontend API base defaults to `http://localhost:5000/api`. Override it with `VITE_API_URL` in `frontend/.env` if needed. Backend configuration is documented in `backend/.env.example`.

## API overview

- `POST /api/auth/register` and `POST /api/auth/login` create an HTTP-only session cookie.
- `POST /api/auth/logout` clears the cookie.
- `GET /api/auth/me`, `PATCH /api/auth/profile`, and `PATCH /api/auth/password` require a valid session.
- `GET /api/dashboard/stats` and `GET /api/dashboard/activity` require a valid session; contact counts and recent activity come from MongoDB, while unimplemented campaign and message metrics remain zero.
- `GET /api/contacts` supports owner scoped search, filters, sort, and bounded pagination.
- `POST /api/contacts`, `GET /api/contacts/:id`, `PATCH /api/contacts/:id`, and `DELETE /api/contacts/:id` create, view, update, and soft delete contacts.
- `POST /api/contacts/:id/consent` appends an audit record; an opt-in requires source, purpose, capture time, and evidence reference.
- `GET /api/contacts/:id/activity` returns the owner's contact timeline.
- `PATCH /api/contacts/:id/archive`, `PATCH /api/contacts/:id/restore`, and `PATCH /api/contacts/bulk` manage records without hard deletion or bulk consent changes.
- `GET /api/contacts/export?format=csv|xlsx` exports all or filtered contacts; an `ids` parameter exports selected records.
- `GET /api/contacts/stats` and the dashboard stats endpoint calculate contact and verified opt-in counts from MongoDB.
- `POST /api/imports/upload` stages an `.xlsx` or `.csv` import (10 MB / 10,000 row limits); `/api/imports/:id/preview`, `PATCH /api/imports/:id/mapping`, and `POST /api/imports/:id/validate` prepare it without creating contacts.
- `POST /api/imports/:id/execute` starts a persisted import worker; poll `GET /api/imports/:id/status`. `GET /api/imports/history`, `GET /api/imports/:id/errors`, and `/api/imports/:id/error-report` provide job history and reports. Mapping presets and the blank template are available from `/api/imports/mapping-presets` and `/api/imports/template`.
- `GET /api/health` reports API and MongoDB readiness.

Cookies use `SameSite=Lax`, `HttpOnly`, and `Secure` in production. Passwords are hashed with bcrypt. Auth endpoints have a rate limit. The backend exits at startup if its MongoDB URI or sufficiently long JWT secret is missing.

## Structure

```text
frontend/  React, Vite, Tailwind, dashboard UI and API client
backend/   Express API, MongoDB connection, models and middleware
```

The contact module includes server-side search and multi-filter support, E.164 phone normalization, account-scoped phone uniqueness, activity and consent audit trails, CSV/XLSX export, bulk status/priority/tag/archive/restore/soft-delete operations, and a profile drawer. Imports are staged in MongoDB, can be resumed after a server restart, and use a private temporary upload directory cleaned at startup and after parsing. The importer accepts `.xlsx` and `.csv`; legacy `.xls` is rejected. WhatsApp eligibility requires a current Opted In record with affirmative-consent evidence and excludes archived or deleted contacts. Imported numbers always start as Unknown, and no integration or sending behavior is simulated.

## Verification

Run `npm --prefix backend test` for API integration checks using an ephemeral MongoDB instance, and `npm --prefix frontend run build` for the production frontend build. Starting the app normally still requires the MongoDB service configured in `backend/.env`.

## Message templates

The authenticated `/templates` workspace stores owner-scoped message drafts and revision snapshots in MongoDB. It supports internal variable previews against existing contact records, explicit fallback values, bounded bulk planning previews, and a non-AI example library. Preview and bulk-preview endpoints never send messages. Draft deletion is restricted to unused templates; other templates can be archived.

Local draft validation and Meta submission-readiness checks are separate. A local template's provider status stays `Not Submitted` until a future provider integration supplies genuine status. The compatibility preview maps internal named variables to deterministic numeric `{{1}}` parameters in separate header/body components. This mapping is a review artifact, not a submission or approval claim.

The AI writing assistant is disabled unless `AI_BASE_URL`, `AI_MODEL`, and `AI_API_KEY` are configured on the backend. It sends only the user's writing brief and current template draft, never contact records; generated text remains an unsaved draft for review. The endpoint expects an OpenAI-compatible `/chat/completions` API.
