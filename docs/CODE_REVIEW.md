# Engineering Review

Review date: 2026-09-20

## Result

**Verdict: approve for take-home submission; further operational hardening is
required before production use.**

The required marketplace loop is complete: creator selection, eligibility and
ranking, exact-decimal bids, scheduled auction closure, budget-safe winner
selection, and won/lost results. The concurrency model and separation of
database roles are stronger than a typical one-day implementation. The live
admin dashboard, durable events, localization, and deterministic workload are
useful extensions.

Validation completed:

- Backend strict typecheck, 14 unit tests, and production build pass.
- Frontend strict typecheck, unit tests, lint, formatting, and production build
  pass.
- Compose configuration is valid; database, API, and frontend report healthy.
- SQL permission, HTTP integration, auction-concurrency, SSE, and short
  projected-workload scenarios were exercised during implementation.
- Playwright covers the complete creator bid-to-result flow and localized admin
  navigation in Chromium.

The prioritized implementation plan and measurable acceptance criteria live in
the separate [engineering roadmap](ROADMAP.md).

## High-priority findings

1. **The workload generator is not a pressure-test harness.** It produces
   realistic deterministic traffic but does not measure percentiles,
   saturation, achieved rate, or resource consumption.

The README now documents the matching formula, winner-selection rule,
idempotency model, architecture, operating commands, and production direction
that were missing in the initial review.

## Medium-priority findings

1. Nginx uses human-oriented access logs while application and worker logs are
   JSON, limiting cross-service correlation.
2. The API trusts forwarded addresses while port 3000 is also published; a
   production profile should expose only Nginx and restrict trusted proxies.
3. The append-only event table needs a retention or archival policy.
4. Creator and admin roster endpoints still return complete result sets;
   cursor pagination should be added before production-scale datasets are used
   interactively.

## Resolved findings

- Creator bid status now refreshes every five seconds without replacing current
  content with a loading state, and refreshes immediately when the browser tab
  becomes visible again.
- Backend HTTP routes and frontend pages are separated by feature, with shared
  schemas, error handling, presentation components, and one admin SSE provider.
- Concurrent frontend responses are sequence-guarded and superseded network
  requests are aborted.
- The PostgreSQL listener reconnects with bounded exponential backoff, replays
  missed durable events, deduplicates notifications, and participates in API
  readiness.
- Failed SSE replay now unsubscribes, discards queued events, and closes the
  stream so the browser can reconnect instead of remaining falsely connected.
- Admin campaign ordering and limiting happen in SQL before bid aggregation.
- Stable API errors are localized without exposing raw database messages.
- Frontend dependencies are pinned; unit, lint, format, and browser regression
  checks are part of the project scripts.

## Low-priority findings

- Replace browser `alert` and `confirm` with accessible dialogs and notices.
- Add screenshots or a short demonstration recording.

## Accepted demo constraints

- Authentication and payments are intentionally omitted as allowed by the
  assignment; admin endpoints must not be internet-exposed.
- Compose provides local orchestration, not PostgreSQL high availability.
- The deterministic greedy selection rule is budget-safe but does not attempt
  globally optimal knapsack allocation.
- PostgreSQL is the business-rule authority and Fastify is intentionally a thin
  HTTP and lifecycle adapter.
