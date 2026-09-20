# Database

PostgreSQL 18 owns marketplace matching, bid validation, and auction closure.
Runtime clients use functions in `api`; they receive no direct access to the
underlying `marketplace` schema.

Start PostgreSQL and apply the database files from the repository root:

```sh
docker compose up -d db
./scripts/db-setup.sh
./scripts/db-seed.sh
./scripts/db-test.sh
```

The scripts use `DATABASE_URL` when set and otherwise connect to the Compose
database at `postgresql://postgres:postgres@localhost:5433/wepush`. Port 5433
is used on the host to avoid colliding with a local PostgreSQL on port 5432.
Set `DB_PORT` before `docker compose up` to choose another Compose host port.

The development seed is destructive and resets marketplace data. One campaign
expires three minutes after seeding so the worker path can be demonstrated. Run
the seed again whenever a fresh demonstration window is needed. Database tests
are intended for a disposable development or CI database; the concurrency test
closes any already-due campaigns before creating its isolated fixture.

## Runtime roles

- `marketplace_web` can list creators and matches, list a creator's bids, and
  create or revise a bid.
- `marketplace_worker` can close due campaigns.
- `marketplace_admin` can read dashboard projections, create campaigns and
  simulator creators, stream events, and process due campaigns.
- None of these roles can access the `marketplace` schema directly.

The roles are intentionally created without login credentials. Deployment
provisioning should create login roles, grant them one of these group roles, and
manage their credentials outside migrations.

## Amounts and identifiers

Amounts use `numeric(38,18)` and are returned to Node as decimal strings. Each
campaign references an asset that sets the permitted number of decimal places;
bid submission rejects excess precision before PostgreSQL can round it.

Internal joins use `bigint` identity keys. API functions only accept and return
opaque public IDs containing a resource prefix and 96 random bits encoded as 16
Base64URL characters.
