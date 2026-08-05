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
[wrangler.jsonc](worker/wrangler.jsonc)); every other route is served from
`frontend/build` with `single-page-application` fallback, so client-side
routing works on refresh. Auth is a 7-day HS256 JWT (WebCrypto); passwords are
PBKDF2-SHA256.

`backend/` is the original FastAPI + MongoDB implementation, kept as a
reference and for local Mongo-based development. It is **not** part of the
Cloudflare deployment. See [AUDIT.md](AUDIT.md) for why it could not run on
Cloudflare as-is and how each piece was mapped.

## Deploy to Cloudflare

Prereqs: Node 18+, a Cloudflare account, `npx wrangler login`.

```bash
cd worker
npm install
```

1. **Create the D1 database** and paste the printed `database_id` into
   [worker/wrangler.jsonc](worker/wrangler.jsonc):

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

4. **Apply migrations**:

```bash
npm run migrate:remote
```

5. **Build the frontend** (from `frontend/`; production builds use same-origin
   `/api` automatically):

```bash
cd ../frontend && yarn install && yarn build
```

6. **Deploy** (from `worker/`):

```bash
cd ../worker && npm run deploy
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
emulation, no Cloudflare account needed):

```bash
cd worker && npm install && cp .dev.vars.example .dev.vars
```

```bash
cd worker && npm run migrate:local
```

```bash
cd worker && npm run dev
```

That serves http://localhost:8787 — API and app together — provided
`frontend/build` exists (run `yarn build` in `frontend/` once).

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
worker/       Cloudflare Worker: Hono API, D1 migrations, wrangler config
frontend/     React SPA (CRA + CRACO + Tailwind/shadcn)
backend/      Legacy FastAPI + MongoDB API (reference only, not deployed)
tests/        Backend pytest suite (legacy)
AUDIT.md      Cloudflare migration audit: findings and porting decisions
```
