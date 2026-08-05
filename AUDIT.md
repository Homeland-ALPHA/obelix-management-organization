# Cloudflare migration audit

Audit of the original stack (FastAPI + MongoDB + CRA frontend) against
Cloudflare's platform, and the decisions behind the reorganization. The new
implementation lives in [worker/](worker); the original backend remains in
[backend/](backend) as a reference.

## Why the original stack could not run on Cloudflare

| # | Finding | Impact | Resolution |
|---|---------|--------|------------|
| 1 | Backend is Python (FastAPI, uvicorn) with `motor`/`pymongo`, `bcrypt`, `requests` | Workers' Python support is beta with a restricted package set; none of these run there | API re-implemented in TypeScript with Hono ([worker/src](worker/src)), same `/api` contract |
| 2 | MongoDB as the datastore | No MongoDB on Cloudflare; Atlas's HTTP Data API is discontinued and the TCP driver doesn't run on Workers | Cloudflare D1 (SQLite). Collections map to tables keeping queried keys as columns and the document as JSON (see [worker/migrations/0001_init.sql](worker/migrations/0001_init.sql)) |
| 3 | Document uploads written to local disk (`backend/uploads/`) | Workers have no filesystem | R2 bucket (`DOCS` binding); D1 keeps metadata + `r2_key` |
| 4 | `bcrypt` password hashing, `PyJWT` tokens | No native bcrypt on Workers; hashing in JS would blow CPU limits | PBKDF2-SHA256 (100k iterations) via WebCrypto; JWT via `hono/jwt` (same HS256 claims: `sub`/`iat`/`exp`/`jti`, 7-day TTL) |
| 5 | Blocking `requests` calls to Socrata/GeoSearch pushed to threads (`asyncio.to_thread`) | No threads on Workers | Native `fetch()` with `AbortSignal.timeout(25s)`, all 12 datasets in parallel ([worker/src/nyc.ts](worker/src/nyc.ts)) |
| 6 | CORS + separate origins assumed (frontend :3000 → API :8000) | Unnecessary complexity in production | Single Worker serves the built SPA and `/api` on one origin (Workers Static Assets, `run_worker_first: ["/api/*"]`, SPA fallback). CORS stays configurable for split deploys |
| 7 | Frontend hardcoded `http://localhost:8000` as API fallback | Broken default in production | Default is now same-origin `""`; `frontend/.env.production` pins it for builds |

## Non-blocking findings (fixed during reorganization)

- `frontend/public/index.html` shipped Emergent-platform telemetry with every
  build: `assets.emergent.sh/scripts/emergent-main.js` plus a PostHog snippet
  with **session recording** pointed at Emergent's analytics host. Removed —
  dead weight and a privacy leak on a self-hosted Cloudflare deployment.

## Non-blocking findings (legacy backend)

- `backend/requirements.txt` carries unused dependencies (`boto3`, `pandas`,
  `numpy`, `python-jose` alongside `pyjwt`, `passlib` alongside `bcrypt`,
  `emergentintegrations` from a private index). Irrelevant to the Cloudflare
  deployment; left untouched in the reference backend.
- JWT secret defaults to a dev value when `JWT_SECRET` is unset — same
  behavior kept in the Worker for local dev, but production setup makes
  `wrangler secret put JWT_SECRET` an explicit deploy step.
- The dismissed-notifications collection grows unboundedly per user (keys are
  never pruned when notifications resolve). Behavior preserved as-is.

## Data model mapping (Mongo → D1)

Mongo stored schemaless documents scoped by `user_id`, with a whitelisted
field registry per entity. D1 keeps that shape: **queried keys become
columns, the document body stays JSON** in a `data` column. `user_id` lives
only in the column, so `data` is already the public API shape (Mongo needed
`{"_id": 0, "user_id": 0}` projections everywhere).

| Mongo collection | D1 table | Notes |
|---|---|---|
| `users` | `users` | plain columns; unique email |
| `buildings` | `buildings` | unique `(user_id, bbl)`; profile/summary in JSON |
| `units`, `tenants`, `revenue`, `expenses`, `budgets`, `loans`, `work_orders`, `vendors` | `records` | one table, `entity` column — mirrors the registry that already drove generic CRUD |
| `nyc_data` | `nyc_data` | PK `(building_id, key)`, upserted per sync |
| `documents` | `documents` | link ids as columns for filtering; file body in R2 |
| `activity` | `activity` | indexed `(user_id, at DESC)` |
| `settings` | `settings` | PK `user_id` |
| `violation_tracking` | `violation_tracking` | PK `(user_id, violation_id)` |
| `dismissed` | `dismissed` | PK `(user_id, key)` |

All aggregation (dashboard, compliance calendar, financial summary/series,
rent roll, attention list) was already computed in application code over
full result sets — that logic ports 1:1 and D1 only does keyed lookups.

## Behavioral differences to know about

- **Fresh start**: no data migration from Mongo is included. Accounts are
  re-registered; buildings re-sync from NYC Open Data on add. (Existing bcrypt
  password hashes would not verify under PBKDF2 anyway.)
- **Email validation** is a pragmatic regex instead of pydantic's `EmailStr`
  (which also rejected reserved TLDs).
- **Validation errors** return `{"detail": "message"}` with status 422 rather
  than pydantic's error-array format; the frontend's `apiError()` handles both.
- **Subrequest budget**: a building sync = 12 Socrata fetches (more if
  candidate filters fall back) + batched D1 writes. Fine on the paid plan;
  tight on the free plan's 50-subrequest cap.
- **Timestamps** are `Date.toISOString()` (millisecond precision, `Z` suffix)
  instead of Python's microsecond ISO strings — comparisons remain
  string-sortable and the frontend formats them identically.
