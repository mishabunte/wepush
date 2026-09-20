# Engineering Roadmap

## Milestones at a glance

1. **Feature boundaries — complete:** modular backend routes, frontend features,
   request cancellation, and regression coverage.
2. **Structured logging:** correlated JSON logs across Nginx, API, worker, and
   PostgreSQL-facing operations.
3. **Resilience:** failure injection, graceful recovery, backups, and tested
   failover procedures.
4. **Pressure testing:** measured capacity, latency, saturation, and auction
   correctness under projected load.
5. **Security audit:** threat modeling, automated scanning, abuse tests, and an
   independent penetration test.
6. **Production foundation:** CI/CD, secrets, TLS, authentication, RBAC, and
   managed PostgreSQL.
7. **Marketplace workflow:** onboarding, moderation, deliverables, messaging,
   contracts, and notifications.
8. **Billing and settlement:** fees, immutable ledger entries, invoices,
   reconciliation, refunds, and payment-provider integration.
9. **Matching evolution:** versioned scoring, richer signals, explainability,
   offline evaluation, and experiments.
10. **Monitoring:** Prometheus metrics, Grafana dashboards, SLOs, and actionable
    alerts.
11. **Scale:** pagination, caching, partitioning, replicas, and eventually
    sharding when measurements require it.

## Immediate milestone: operational hardening

### 1. Refactor feature boundaries

- Split backend creator, admin, health, and event-stream routes into modules;
  centralize schemas and error mapping; isolate process startup and shutdown.
- Split frontend creator and admin features into pages, components, hooks, and
  formatting utilities; introduce a single shared realtime provider.
- Add transport-level cancellation to the existing stale-response-protected
  frontend data loading.
- Preserve existing HTTP and SQL contracts while moving behavior.

Acceptance criteria:

- Route modules and React pages contain only their feature responsibilities.
- Existing SQL, unit, integration, typecheck, and build checks stay green.
- Creator bid results update automatically after auction closure.

### 2. Add correlated structured logging

- Emit JSON API logs with timestamp, level, service, environment, request ID,
  route, method, status, latency, and sanitized error metadata.
- Give worker executions run IDs, batch counts, durations, failure classes, and
  overdue-campaign metrics.
- Emit Nginx access logs as JSON on stdout and error logs on stderr, including
  request ID, upstream address/status/timing, response size, and rate limiting.
- Define redaction rules for secrets, authorization values, and future personal
  information.

Acceptance criteria:

- One request can be traced from Nginx through Fastify with one request ID.
- HTTP 5xx responses and failed auction runs are queryable without parsing
  human prose.
- Expected validation failures and normal shutdown do not trigger false alerts.

### 3. Validate failover and recovery

- Reconnect PostgreSQL `LISTEN` with capped exponential backoff and jitter,
  retain the last event cursor, replay missed durable events, and expose listener
  readiness.
- Check creator and admin pools independently and distinguish component
  readiness from process liveness.
- Exercise multiple worker replicas using the existing row locks and verify
  data-level exactly-once campaign finalization.
- Add bounded retry policies, graceful draining, container stop grace periods,
  and failure-injection tests.
- Document managed PostgreSQL backup/PITR, migration ordering and rollback, and
  recovery procedures.

Acceptance criteria:

- A killed listener reconnects and delivers every missed durable event.
- A killed worker does not leave a campaign permanently unprocessed.
- Multiple workers never duplicate finalization or exceed a campaign budget.
- Unready API instances stop receiving traffic while unaffected operations stay
  available whenever their dependencies remain healthy.

### 4. Run a measured pressure test

- Keep `load-test.ts` as deterministic scenario and data generation.
- Add k6 scenarios for creator registration, campaign creation, match reads,
  new bids, revisions, admin reads, and SSE connection churn.
- Run projected load for 60 minutes, 2× load for 15 minutes, and a controlled
  ramp-to-failure to establish capacity.
- Capture achieved throughput, p50/p95/p99 latency, unexpected and expected
  error classes, Nginx throttling, database connections, CPU/memory, lock waits,
  query time, event lag, and auction-close delay.

Initial projected-load targets:

- Sustain at least 167 creator registrations, 17 campaigns, and 150 bid actions
  per minute.
- Keep unexpected HTTP errors below 1%; report expected 409/422 outcomes
  separately.
- Keep read p95 below 500 ms and write p95 below 750 ms on the agreed test host.
- Avoid connection exhaustion, deadlocks, duplicate closure, and budget
  overspend.
- Finalize auctions at p95 no later than 20 seconds after their deadline with
  the current ten-second worker interval.
- Deliver SSE events at p95 below two seconds and catch up successfully after a
  reconnect.

### 5. Complete a security audit

- Threat-model the public API, admin interface, worker, PostgreSQL functions,
  SSE stream, Nginx boundary, deployment pipeline, and third-party dependencies.
- Verify authentication and role-based authorization at both the API and database
  boundaries, including least-privilege database roles and explicit schema and
  function grants.
- Review every endpoint and PL/pgSQL function for injection, broken access
  control, unsafe dynamic SQL, privilege escalation, excessive data exposure,
  race conditions, and abuse of business rules.
- Add automated dependency, secret, container-image, and static-analysis scans to
  CI, with severity thresholds and a documented remediation process.
- Validate TLS, security headers, CORS, request-size and rate limits, error
  redaction, audit logging, backup access, credential rotation, and production
  secret storage.
- Run abuse-focused tests for enumeration, replay, malformed input, bid flooding,
  SSE connection exhaustion, denial of service, and attempts to bypass campaign
  eligibility or budget constraints.
- Commission an independent penetration test before handling payments or other
  sensitive production data, then track findings with owners and deadlines.

Acceptance criteria:

- No unresolved critical or high-severity finding remains before production
  launch; accepted risks are documented with an owner, rationale, and review date.
- API and database authorization tests cover every role and sensitive operation,
  including negative cross-account and privilege-escalation cases.
- CI blocks known secrets and dependencies or images with disallowed severity,
  while approved exceptions are time-limited and documented.
- A security incident-response procedure, dependency patching policy, credential
  rotation procedure, and audit evidence are documented and exercised.

## Later milestones

1. **Production foundation:** CI/CD, automated migration gates, managed secrets,
   TLS, authentication and RBAC, backups/PITR, metrics, tracing, alerting, and
   event retention. Introduce the staged PostgreSQL high-availability topology
   described below.
2. **Marketplace workflow:** creator onboarding, campaign editing and
   cancellation, moderation, notifications, deliverables, messaging, contracts,
   and payment settlement.
3. **Billing and settlement:** immutable accounting, platform fees, invoices,
   provider integration, refunds, and reconciliation as described below.
4. **Matching evolution:** versioned scoring rules, richer audience and brand
   safety signals, creator-facing explanations, offline evaluation, and A/B
   testing.
5. **Observability:** centralized structured logs, Prometheus metrics, Grafana
   dashboards, SLOs, and alerting as described below.
6. **Scale:** SQL-level pagination, query budgets, event partitioning and
   archival, read replicas and disposable caching where measurements justify
   them, and queue-backed workloads only when database polling becomes the
   measured bottleneck. Consider sharding only after tuning, partitioning,
   archival, caching, and vertical scaling no longer meet capacity targets.

## Future logging and operational audit trail

Application logs should be structured operational records, while marketplace
and billing audit records should be durable domain data. Logs must never become
the source of truth for bids, auction results, balances, or invoices.

- Send JSON logs from Nginx, Fastify, workers, and deployment jobs to one
  centralized log store. Preserve request, worker-run, campaign, and public
  entity IDs so an operation can be followed across services without logging
  sensitive payloads.
- Standardize timestamp, severity, service, environment, version, event name,
  request ID, duration, outcome, and sanitized error fields. Maintain explicit
  redaction and sampling rules, especially for future identity and payment data.
- Separate high-volume diagnostic retention from longer-lived security and
  billing audit retention. Restrict access, record access to sensitive logs, and
  document deletion and legal-retention policies before production launch.
- Alert on patterns rather than individual expected errors: sustained 5xx rates,
  repeated worker failures, overdue auctions, database exhaustion, listener
  disconnects, authentication abuse, and billing reconciliation failures.

Acceptance criteria:

- A request or worker execution can be traced across the edge, API, database
  call, and emitted durable event using correlation fields.
- Secrets, credentials, authorization values, personal data, and full payment
  payloads are absent from logs and covered by automated redaction tests.
- Log retention, access control, sampling, and incident-search runbooks are
  documented and exercised.

## Future billing and settlement

Billing should be introduced as a separate bounded domain after authentication,
contracts, and deliverable approval exist. PostgreSQL remains authoritative for
the internal ledger; an external payment provider moves money but does not define
the marketplace balance.

- Record immutable double-entry ledger transactions for campaign funding,
  creator earnings, platform fees, adjustments, refunds, and payouts. Corrections
  create compensating entries instead of updating historical amounts.
- Keep every amount paired with its asset and precision. Never combine fiat or
  crypto assets in one balance, and capture exchange-rate snapshots only when a
  product flow explicitly requires conversion.
- Make invoice, charge, refund, webhook, and payout operations idempotent with
  provider reference uniqueness and durable processing states.
- Reconcile provider reports against the internal ledger on a schedule, expose
  discrepancies to operations, and prevent automatic payout when reconciliation
  or compliance checks fail.
- Generate invoices and statements from versioned billing records, with explicit
  platform-fee, tax, refund, and payout status. Define jurisdiction-specific tax,
  identity, and retention requirements before real-money launch.

Acceptance criteria:

- Ledger entries balance per asset, every external movement maps to one internal
  transaction, and replayed webhooks cannot duplicate money movement.
- Automated reconciliation identifies missing, duplicated, or mismatched
  provider transactions and produces an auditable resolution workflow.
- Billing permissions, encryption, backup restoration, and incident handling
  pass the security audit before production payments are enabled.

## Future Prometheus and Grafana monitoring

Prometheus should collect bounded-cardinality service and infrastructure metrics;
Grafana should combine them into operational, product-flow, and capacity
dashboards. Metrics endpoints must be internal-only and must not contain public
IDs, creator names, campaign names, or other unbounded labels.

- Export API request rate, latency histograms, status classes, active requests,
  pool utilization, and dependency errors; export worker runs, processed
  campaigns, failures, auction-close delay, and overdue backlog.
- Monitor PostgreSQL with a managed integration or `postgres_exporter`, including
  connections, transactions, locks, deadlocks, slow queries, cache hit rate,
  replication lag, WAL growth, storage, and backup freshness.
- Add Nginx and host/container metrics for throughput, throttling, upstream
  latency, CPU, memory, restarts, and saturation. Track SSE connections,
  reconnects, replay lag, and listener readiness separately.
- Build Grafana dashboards for service health, creator bidding flow, auction
  processing, PostgreSQL capacity, and future billing reconciliation. Annotate
  dashboards with releases, migrations, and incidents.
- Define availability, latency, event-delivery, and auction-close SLOs. Route
  symptom-based alerts through an alert manager with owners, severity, runbook
  links, deduplication, and escalation policies.

Acceptance criteria:

- A single Grafana overview shows traffic, error rate, latency, saturation,
  database health, SSE health, and auction backlog for each environment.
- Alerts fire in failure-injection tests for API unavailability, connection-pool
  exhaustion, database replication lag, stuck auctions, and failed billing
  reconciliation, then resolve automatically after recovery.
- Prometheus label-cardinality budgets and retention limits are documented and
  enforced before production traffic is enabled.

## Future PostgreSQL topology: failover, replicas, and sharding

These are separate scaling steps and should be introduced in order. Running more
API or worker instances does not require database sharding: they can all share a
PostgreSQL writer while row locks and transactions preserve correctness.

### Stage 1: highly available writer

- Run one writable primary with a standby in another availability zone,
  automatic promotion, a stable writer endpoint, and split-brain protection.
- Keep WAL-based backups and point-in-time recovery independent from replication;
  a standby is not a substitute for a backup.
- Define and test recovery objectives (RPO and RTO), promotion, application
  reconnects, bounded retries, and restoration from backup.
- Let HTTP connection pools reconnect through the writer endpoint. Keep the
  PostgreSQL `LISTEN` connection dedicated and recreate it after disconnects;
  transaction-pooling proxies cannot carry a session-level listener safely.
- Run schema migrations once against the writer, rather than from every API or
  worker replica during startup.

### Stage 2: read replicas

- Add asynchronous replicas for stale-tolerant admin lists, reports, and history.
  Keep writes and read-after-write paths, including live bid status, on the
  writer.
- Route replica reads explicitly, measure replay lag, and fall back to the writer
  when freshness requirements cannot be met.
- Consume live notifications from the writer and use the durable event log to
  recover events missed during a reconnect or failover.

### Stage 3: sharding, only when measurements require it

Sharding adds routing, data migration, cross-shard reporting, and new failure
modes. Consider it only when a tuned and vertically scaled writer, table
partitioning, archival, read replicas, and caching cannot meet the measured load.

- Use a stable hash of `campaign_id` as the initial shard key so a campaign, its
  bids, and auction closure remain on one shard and in one local transaction.
- Keep public IDs opaque and independent of physical placement. A shard directory
  or routing layer should map an ID to its current shard so data can move later.
- Replicate small reference data. Keep creator identity in a canonical directory
  and build matching/search as a read model instead of synchronously querying
  every shard.
- Build cross-shard admin totals and analytics asynchronously in a read model or
  analytical store; do not introduce distributed transactions for reporting.
- Rebalance with an observable migration process: copy and verify data, use
  shadow reads, cut routing over, and retain a rollback window.

Before adopting sharding, record the capacity trigger that requires it, such as
sustained writer CPU or I/O saturation, storage limits, lock contention, or an
SLO miss that simpler measures cannot resolve.

## Suggested Memcached read cache

Memcached can reduce repeated read load and latency, but it must remain an
optional, disposable cache. PostgreSQL and its PL/pgSQL functions stay the source
of truth and continue to make all authorization, eligibility, bid, and auction
decisions.

Use cache-aside reads: look up a versioned key, query PostgreSQL on a miss, then
store the result with a short TTL. Suitable initial candidates are admin summaries
and lists (1-5 seconds), creator campaign matches (5-15 seconds, with the matching
algorithm version in the key), creator lists (30-60 seconds), and stable reference
data (several minutes). Measure each endpoint before caching it.

Do not cache bid submission results, worker queries for campaigns due to close,
readiness checks, SSE cursors, or any value whose staleness could change a write
decision. A Memcached timeout or node loss must fall back to PostgreSQL rather
than fail the request.

Invalidate affected keys best-effort after the corresponding durable event is
committed—for example after campaign, bid, or creator changes—and retain TTLs as
the safety net. Use namespaced keys such as
`wepush:v1:matches:<creator-id>:<algorithm-version>`, add TTL jitter and request
coalescing for hot keys, and monitor hit rate, latency, evictions, and errors.

With multiple API instances, all instances should use the same Memcached pool.
Clients may distribute keys across nodes with consistent hashing, but Memcached
does not provide durable storage or database-style replication; losing a node is
expected to produce cache misses and temporary extra PostgreSQL load.
