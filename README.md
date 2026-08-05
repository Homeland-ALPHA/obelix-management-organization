# Obelix Property Management

NYC property-management platform: portfolio dashboard, live NYC Open Data
compliance (HPD/DOB/ECB violations, 311, boiler, facade, bedbug, litigation,
DOF valuation), financials, rent roll, work orders, vendors, documents and an
audit trail.

## Architecture (Cloudflare)

One Cloudflare Worker serves everything:

| Piece | Technology | Where |
|---|---|---|
| API (`/api/*`) | TypeScript + [Hono](https://hono.dev) on Cloudflare Workers | [worker/src](worker/src) |
| Database | Cloudflare D1 (SQLite) | [worker/migrations](worker/migrations) |
| Document storage | Cloudflare R2 | `DOCS` binding |
| Frontend | React (CRA/CRACO) built to static files, served as Workers Static Assets with SPA fallback | [frontend](frontend) |
| NYC Open Data | Fetched live from Socrata / GeoSearch via `fetch()` | [worker/src/nyc.ts](worker/src/nyc.ts) |

The Worker owns `/api/*` (`run_worker_first` in
[wrangler.jsonc](wrangler.jsonc) — the config lives at the repo root so
git-connected builds and `npx wrangler deploy` work with zero settings);
every other route is served from `frontend/build` with
`single-page-application` fallback, so client-side routing works on refresh.
[build.mjs](build.mjs) runs automatically before every deploy and compiles
the frontend + installs worker deps. Auth is a 7-day HS256 JWT (WebCrypto);
passwords are PBKDF2-SHA256.

`backend/` is the original FastAPI + MongoDB implementation, kept as a
reference and for local Mongo-based development. It is **not** part of the
Cloudflare deployment. See [AUDIT.md](AUDIT.md) for why it could not run on
Cloudflare as-is and how each piece was mapped.

## Deploy to Cloudflare

### Option A — Git-connected (Workers Builds / "Deploy to Cloudflare")

Connect the repo in the dashboard (Workers & Pages → Create → import this
repository). The defaults work: no build command needed, deploy command
`npx wrangler deploy` — [build.mjs](build.mjs) compiles the frontend
automatically inside the deploy. The flow can provision the D1 database and
R2 bucket declared in [wrangler.jsonc](wrangler.jsonc); if the deploy errors
about a missing `database_id`, create the resources once (steps 1–2 below)
and paste the id.

Two one-time steps after the first successful deploy:

1. Apply the schema (or set the project's deploy command to `npm run deploy`,
   which migrates before every deploy):

```bash
npx wrangler d1 migrations apply obelix --remote
```

2. Set a real JWT secret (any long random string):

```bash
npx wrangler secret put JWT_SECRET
```

### Option B — CLI from your machine

Prereqs: Node 18+, `npx wrangler login`. From the repo root:

```bash
npm install
```

1. **Create the D1 database** and paste the printed `database_id` into
   [wrangler.jsonc](wrangler.jsonc):

```bash
npx wrangler d1 create obelix
```

2. **Create the R2 bucket** (enable R2 once in the dashboard if you never
   have):

```bash
npx wrangler r2 bucket create obelix-documents
```

3. **Set the JWT secret** (any long random string):

```bash
npx wrangler secret put JWT_SECRET
```

4. **Migrate and deploy** (builds the frontend automatically):

```bash
npm run deploy
```

Optional: `npx wrangler secret put NYC_APP_TOKEN` with a
[NYC Open Data app token](https://data.cityofnewyork.us/profile/edit/developer_settings)
to raise Socrata rate limits.

> Building sync fans out to 12 NYC datasets plus D1 writes in one request.
> That fits Workers limits comfortably on the paid plan (1000 subrequests);
> on the free plan (50) a sync can hit the cap if several datasets fall back
> through candidate filters.

## Local development

Run the API + built frontend exactly as production (uses local D1/R2
emulation, no Cloudflare account needed). From the repo root:

```bash
npm install && cp .dev.vars.example .dev.vars
```

```bash
npm run migrate:local
```

```bash
npm run dev
```

That serves http://localhost:8787 — API and app together. The first run
builds the frontend automatically; later runs reuse `frontend/build`
(`npm run build` forces a rebuild).

For frontend hot reload, additionally run CRA against the Worker:

```bash
cd frontend && yarn start
```

with `frontend/.env` containing `REACT_APP_BACKEND_URL=http://localhost:8787`.

### Legacy stack (reference)

`backend/` (FastAPI + MongoDB) still runs the same API on
http://localhost:8000 — see [backend/.env.example](backend/.env.example).
Point `frontend/.env` at it if needed. The two stacks do not share data.

## Repository layout

```
wrangler.jsonc  Worker config (repo root so `npx wrangler deploy` just works)
build.mjs       Pre-deploy hook: worker deps + frontend build
worker/         Cloudflare Worker: Hono API source, D1 migrations
frontend/       React SPA (CRA + CRACO + Tailwind/shadcn)
backend/        Legacy FastAPI + MongoDB API (reference only, not deployed)
tests/          Backend pytest suite (legacy)
AUDIT.md        Cloudflare migration audit: findings and porting decisions
```
