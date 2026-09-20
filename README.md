# WePush Creator Marketplace

> **TL;DR:** Run `./demo.sh --reset` to build and run the demo in Docker, open
> the creator UI, and start the one-hour live workload.

WePush is a PostgreSQL-driven creator marketplace where creators discover
matched campaigns and bid through a React frontend and thin TypeScript API while
a worker closes auctions safely within budget.

> **Implementation focus:** This take-home deliberately prioritizes technical
> architecture and correctness—database-owned business rules, concurrency
> safety, exact numeric handling, service boundaries, automated tests, and
> operability—over product discovery, visual design, and production-grade UI/UX
> polish. The interface is a functional demonstration of the marketplace
> workflows rather than a finished product experience.

## System at a glance

- **Business logic:** Creators are matched to eligible campaigns, ranked by fit,
  and compete on both suitability and price for the available campaign budget.
- **Backend:** A thin TypeScript/Fastify API exposes PostgreSQL functions while
  an independently runnable worker closes expired auctions.
- **Frontend:** A React application provides creator and live-admin workflows in
  English and German and is served by Nginx in production.
- **Database:** PostgreSQL is the source of truth for matching, validation,
  bidding, concurrency-safe auction closure, permissions, and durable events.

## Architecture and business rules

### Business logic

A creator is eligible only when their genre matches the campaign and their
follower count meets its minimum. Eligible campaigns receive an explainable fit
score: 50 points for genre, up to 25 for followers, and up to 25 for engagement.
Creators may submit or revise one exact-decimal bid per campaign until its
deadline. At closure, pending bids are ranked using 65% fit and 35% price
efficiency, with fit, lower price, earlier submission, and ID as deterministic
tie-breakers. Ranked bids win while they fit within the remaining budget; this
is a deliberate deterministic greedy rule, not a globally optimal knapsack
solver. Row locks, `SKIP LOCKED`, and the `open` → `closed` state transition make
parallel and repeated worker runs safe without duplicate winners or overspend.

### Backend

The Node.js backend uses TypeScript and Fastify as a small transport layer: it
validates HTTP input, manages least-privilege database pools, calls functions in
the SQL `api` schema, maps database errors, and emits structured logs. Auction
closure runs in a separate scheduled worker every ten seconds. The admin view
uses a durable event table plus PostgreSQL `LISTEN/NOTIFY`; Fastify converts
notifications into a replayable Server-Sent Events stream. Health checks and
graceful shutdown support local container orchestration.

### Frontend

The browser application uses React, TypeScript, React Router, Tailwind CSS, and
Vite. Creators can choose a profile, review ranked matches and requirements,
place or revise bids, and inspect bid outcomes. A separate live-admin experience
shows marketplace counters, campaign countdowns and rankings, creator activity,
campaign creation, and auction processing. `i18next` provides English and German
interface text. Vite serves development assets, while a multi-stage image builds
static files for Nginx, which also proxies and rate-limits API traffic.

### Database

PostgreSQL 18 owns the domain rules rather than exposing tables directly. The
private `marketplace` schema stores assets, creators, campaigns, bids, and an
append-only event log; the `api` schema is the only runtime interface. Monetary
values use `numeric(38,18)` with asset-specific precision, internal joins use
compact `bigint` keys, and clients receive opaque 96-bit Base64URL public IDs.
Separate web, worker, and admin roles receive only the function privileges they
need. Transactional event writes make live updates recoverable even when a
notification is missed.

```text
Browser ── static files ───────────────┐
   │                                  │
   └── HTTP / SSE ──> Nginx ──> Fastify API ──> PostgreSQL functions
                                      ▲                │
                                      │                ├── durable events
                                      └── LISTEN ──────┘

Scheduled worker ──────────────────────────────> auction closure function
```

## Next milestone

Feature boundaries, listener recovery, regression coverage, and SQL-side admin
projection are complete. The next step is correlated structured logging,
failure-injection recovery testing, a measured pressure test, and the planned
security audit; see the detailed [roadmap](docs/ROADMAP.md) and supporting
[engineering review](docs/CODE_REVIEW.md).

## Runbook

### Prerequisites

- Docker with Compose support
- Node.js 22.22.2+ LTS or Node.js 24.15.0+ and npm for local development,
  verification, and load generation
- `psql` for the repository database scripts

PostgreSQL is published on `${DB_PORT:-5433}`, the API on
`${API_PORT:-3000}`, and the Nginx frontend on `${FRONTEND_PORT:-8080}`.

### One-command demo

Run the complete Docker demo from the repository root:

```sh
./demo.sh
```

The script applies migrations, provisions runtime roles, seeds an empty
marketplace, builds and starts every service, opens the creator UI, and runs the
one-hour deterministic workload. Existing marketplace data is preserved. Use
`./demo.sh --reset` to restore the small development dataset first, or
`./demo.sh --no-open` in a headless environment. All documented `LOAD_*`, port,
credential, and Compose-project environment variables remain available.

### First-time setup

From the repository root:

```sh
docker compose up -d db
./scripts/db-setup.sh
./scripts/db-provision-runtime.sh
./scripts/db-seed.sh
docker compose up -d --build api worker frontend
docker compose ps
```

Open the creator application at http://localhost:8080 and the live dashboard at
http://localhost:8080/admin.

Development credentials are local-only defaults. Override them with
`WEB_DB_PASSWORD`, `WORKER_DB_PASSWORD`, and `ADMIN_DB_PASSWORD`; local processes
can instead use `DATABASE_URL`, `WORKER_DATABASE_URL`, and `ADMIN_DATABASE_URL`.

### Normal start and reset

Start or rebuild the existing stack without deleting data:

```sh
docker compose up -d --build
```

Reset marketplace rows and restore the small development dataset while keeping
the current schema and Docker volume:

```sh
./scripts/db-seed.sh
```

The seed command is destructive to creators, campaigns, bids, assets, and
events. To completely recreate the Docker database and reapply every migration:

```sh
docker compose down -v
docker compose up -d db
./scripts/db-setup.sh
./scripts/db-provision-runtime.sh
./scripts/db-seed.sh
docker compose up -d --build api worker frontend
```

### Local development

```sh
npm --prefix backend install
npm --prefix frontend install
npm --prefix backend run dev
```

In separate terminals, run the worker and Vite frontend:

```sh
npm --prefix backend run worker:dev
npm --prefix frontend run dev
```

Vite serves http://localhost:5173 and proxies `/api` to port 3000. Production
and Docker execute compiled backend JavaScript and Nginx-served frontend assets.

### Demo flow

1. Open `/` and choose a creator.
2. Review eligible campaigns and their fit scores and requirements.
3. Submit or revise a bid using an exact decimal string.
4. Open **My bids** to see its pending status.
5. Wait for the deadline and worker, or use **Process due** in `/admin`.
6. Keep **My bids** open; it refreshes in the background and shows the final
   won/lost result within five seconds of worker completion.

The admin surface is intentionally unauthenticated for this demo and must not
be exposed as a production administration interface.

### Verification

Run the complete automated checks against the local database:

```sh
npm --prefix backend run typecheck
npm --prefix backend test
npm --prefix backend run build
npm --prefix frontend run typecheck
npm --prefix frontend test
npm --prefix frontend run lint
npm --prefix frontend run format:check
npm --prefix frontend run build
./scripts/db-test.sh
./scripts/db-seed.sh
./scripts/db-provision-runtime.sh
npm --prefix backend run test:integration
npm --prefix frontend exec -- playwright install chromium
npm --prefix frontend run test:e2e
```

Database, integration, and browser tests are intended for a disposable
development or CI database and may create or modify marketplace records. Reseed
afterward if a clean demonstration dataset is required.

### One-hour live workload

The deterministic workload registers 10,000 creators, creates 1,000 campaigns,
and performs 9,000 bid actions over one hour: approximately 167 creator
registrations, 17 campaigns, and 150 bid actions per minute. Every fourth bid
action revises an existing bid, and deadlines are distributed between 2 and 60
minutes so the worker closes auctions during the run.

```sh
./demo.sh --reset
```

The runner executes inside the API container, uses HTTP through Nginx, reports
progress every five seconds, and stops gracefully on Ctrl-C. The services remain
running afterward. A short headless smoke run is:

```sh
LOAD_DURATION_SECONDS=15 LOAD_CREATORS=30 LOAD_CAMPAIGNS=8 LOAD_BIDS=20 \
  ./demo.sh --no-open
```

Available controls are `LOAD_BASE_URL`, `LOAD_DURATION_MINUTES` or
`LOAD_DURATION_SECONDS`, `LOAD_CREATORS`, `LOAD_CAMPAIGNS`, `LOAD_BIDS`,
`LOAD_SEED`, and `LOAD_RETRIES`. This deterministic generator creates realistic
demo traffic; it is not the measured pressure-test harness described in the
roadmap.

### HTTP API summary

- `GET /healthz` — process liveness.
- `GET /readyz` — creator/admin database and realtime-listener readiness.
- `GET /api/v1/creators` — creator profiles.
- `GET /api/v1/creators/:creatorId/matches` — eligible ranked campaigns.
- `GET /api/v1/creators/:creatorId/bids` — creator bid history and status.
- `PUT /api/v1/creators/:creatorId/bids/:campaignId` — create or revise a bid.
- `/api/v1/admin/*` — demo administration, projections, and SSE events.

Bid amounts are JSON strings so JavaScript floating point never changes their
value:

```json
{ "amount": "1250.50" }
```

Nginx limits request bodies to 16 KiB. Creator API traffic is limited to 10
requests per second per client with a burst of 20; admin traffic uses a separate
50 requests-per-second zone with a burst of 100. Rejected bursts receive 429.

## Repository layout

- `demo.sh` — one-command Docker startup, browser launch, and live workload.
- `backend/` — TypeScript API, worker, workload generator, and tests.
- `frontend/` — React application, build configuration, and Nginx image.
- `db/` — migrations, runtime roles, deterministic seeds, and SQL tests.
- `scripts/` — setup, provisioning, reset, and database test helpers.
- `docs/` — engineering review and roadmap.
