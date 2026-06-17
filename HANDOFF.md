# Troopers — Engineering Handoff

*For the next engineer (human or another Claude instance) picking this up
**outside the original build sandbox**. Last updated 2026-06-17.*

This explains exactly what exists, what is real vs. stubbed, what is blocked on
external credentials, and the precise next steps to take it to production.

---

## 1. TL;DR state

- **Planning is done**: `PRD.md` (17 feature areas, youth-protection/COPPA
  constraints) and `HOSTING.md` ($0 default stack).
- **Backend is a working walking skeleton across all 17 areas** (`apps/api`):
  Fastify 5 + TypeScript, **44 tests passing, ~88% coverage**, typecheck clean.
  It boots and serves real HTTP (verified: health, RBAC 401/403, CRUD 201,
  Prometheus metrics).
- **The "stack" is wired**: 12-factor config, structured logging, Prometheus
  metrics, feature flags, OWASP-aware security, health/readiness, graceful
  shutdown, Dockerfile, docker-compose with the full observability trio,
  Grafana dashboard + Prometheus alerts + Alertmanager, Terraform IaC, k6
  perf tests, OWASP ZAP pen test, and CI running all of it.
- **PWA shell exists** (`apps/web`): installable, offline-capable, no build
  step, wired to the API.
- **Not done / blocked**: deep third-party integrations that need credentials
  unavailable in the sandbox (Stripe, the live Scoutbook file spec), the
  Postgres-backed repositories (currently in-memory), real auth (JWT), and the
  native iOS/Android apps. All tracked in `PONYTAIL-DEBT.md`.

> Honest scope note: a *literally complete* production app (live payments,
> App Store/Play binaries, BSA-validated sync) cannot be finished or verified
> without those external accounts. What's here is the maximum that is real and
> test-passing, with every gap explicitly flagged rather than faked.

---

## 2. Architecture in one picture

```
apps/web (PWA, static)  ──HTTPS──►  apps/api (Fastify 5)
                                      │  ├─ core/resource.ts  (validation+RBAC+CRUD factory)
                                      │  ├─ domain/*          (17 feature areas)
                                      │  ├─ config/logger/metrics/featureFlags/auth (the spine)
                                      │  └─ in-memory repos  ── upgrade ──►  Postgres (db/migrations)
                                      │
        /metrics ──► Prometheus ──► Grafana (dashboards) + Alertmanager (alerts)
```

Every feature area is registered through `core/resource.ts`, so each one gets
trust-boundary validation (zod), RBAC, and the central error handler without
duplication. High-value flows add real logic on top (see §4).

---

## 3. How to run & verify (from a clean clone)

```bash
# Backend
cd apps/api
npm ci
npm run typecheck            # clean
npm test                     # 44 passing (unit + functional + security)
npm run test:coverage        # thresholds enforced
API_AUTH_TOKENS="t:admin" PORT=3000 npm run dev   # boots locally

# Full local stack (API + Postgres + Prometheus + Grafana + Alertmanager)
docker compose -f infra/docker/docker-compose.yml up --build
#   API http://localhost:3000   Grafana http://localhost:3001 (admin/admin)
#   Prometheus :9090            Alertmanager :9093

# PWA (no build): serve apps/web/ statically, open it, point it at the API.

# Performance (needs k6) and pen test (needs Docker):
k6 run tests/performance/k6-smoke.js
TARGET=http://localhost:3000 ./tests/security/zap-baseline.sh
```

---

## 4. What's REAL (deep logic, tested)

| Area | File | Notes |
|---|---|---|
| Registration reminders engine | `domain/members/reminders.ts` | Pure, exhaustively unit-tested; configurable lead days (60/30/14/0). The flagship per PRD §5.12/§5.13. |
| Scoutbook advancement export | `domain/advancement.ts` | Pipe-delimited file, only approved+un-submitted records. **Column spec must be BSA-validated** (debt). |
| Money ledger & balances | `domain/money.ts` | Integer cents, balance derived from ledger (can't drift). |
| Event RSVP | `domain/events.ts` | Upsert RSVP, date validation. |
| YP-safe messaging invariant | `domain/communication.ts` | Server-side block on 1-on-1 adult↔youth (PRD §9). Tested. |
| Roster reconcile (BSA sync) | `domain/sync.ts` | Diff local vs council roster by member id. |
| Photo consent filter | `domain/photos.ts` | Hides photos tagging a non-consented youth (COPPA). |
| Configurable unit settings | `domain/settings.ts` | Durations/cadences as data (PRD §5.14). |
| Compliance/treasurer dashboards | `domain/reporting.ts` | Aggregations. |

The remaining areas (households, roles, activity logs, documents, equipment,
reminder rules, registrations) are CRUD-with-validation-and-RBAC via
`domain/simpleResources.ts` — real endpoints, ready for deeper logic.

---

## 5. What's STUBBED / BLOCKED (and why)

See `PONYTAIL-DEBT.md` for the full ledger. The big ones:

1. **Persistence is in-memory.** Swap each `createInMemoryRepository` for a
   Postgres-backed `Repository<T>` (tables already in `db/migrations/001_init.sql`,
   same interface). Start with members/advancement/transactions.
2. **Auth is static dev tokens.** Replace `src/auth.ts` token lookup with JWT
   verification (Supabase Auth or Better Auth) → load positions → derive
   permission scopes. The `requireRole` guard and `AuthContext` shape stay.
3. **Payments** (`POST /api/payments/checkout`) returns 501 — needs Stripe keys.
   Wire PaymentIntent + webhook → credit a `transaction`. No card data in-app.
4. **Scoutbook file column spec** — approximated; confirm with BSA (PRD §14 OQ-1)
   before real submissions.
5. **Web Push** — service worker has the cache logic but no `push` handler
   (needs VAPID keys; iOS requires installed PWA).
6. **Native iOS/Android** — not started; PWA covers phones meanwhile.

---

## 6. Recommended next steps (in order)

1. Stand up Postgres (Supabase free per HOSTING.md) and implement the pg
   repositories behind `Repository<T>`; flip `app.ts` to use them.
2. Replace dev-token auth with real JWT auth + the positions→permissions model
   (PRD §5.2).
3. Wire the reminders engine to a **scheduled job** (the logic is ready) — a
   GitHub Actions cron or a small scheduler — sending via email (Brevo) first.
4. Implement Stripe checkout + webhook (needs account).
5. Validate the Scoutbook export against the live BSA spec.
6. Then deepen the simple-resource areas and start the native apps.

---

## 7. Guardrails (do not regress)

- Youth-protection: no 1-on-1 adult↔youth messaging path; keep
  `communication.ts` invariant + its tests.
- COPPA: youth PII stays behind parental consent; medical docs restricted to
  admin/leader; nothing sensitive cached offline (see `sw.js`).
- 12-factor: no secrets in code; all config via env, validated at boot.
- Keep `npm run typecheck` + `npm test` green; add tests for new
  trust-boundary code; update `PONYTAIL-DEBT.md` when you defer something.
