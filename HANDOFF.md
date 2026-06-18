# Troopers — Engineering Handoff

*For the next engineer (human or another Claude instance) picking this up
**outside the original build sandbox**. Last updated 2026-06-17.*

This explains exactly what exists, what is real vs. stubbed, what is blocked on
external credentials, and the precise next steps to take it to production.

---

## 1. TL;DR state

- **Planning is done**: `PRD.md` (17 feature areas, youth-protection/COPPA
  constraints) and `HOSTING.md` ($0 default stack).
- **Backend is a working app across all 17 areas** (`apps/api`): Fastify 5 +
  TypeScript, **75 tests passing** (unit + functional + security + Postgres
  integration), typecheck clean. Boots and serves real HTTP.
- **Persistence is real (D1).** Postgres-backed repositories behind a factory
  (`core/pgRepository.ts`); pg when `DATABASE_URL` is set, in-memory otherwise.
  Migrations in `db/migrations/00{1,2,3}_*.sql`. Verified by pg integration tests.
- **Auth is real (D2).** HS256 JWT verification (`jose`), matching Supabase's
  signing; static tokens remain only as the no-JWT local fallback.
- **Payments built (D3).** Signature-verified Stripe webhook credits the ledger;
  checkout creates a PaymentIntent when keyed. Only a live Stripe account remains.
- **Reminders run on a schedule (D5).** `src/jobs/reminders.ts` + a daily
  GitHub Actions cron; Log channel ($0) or Brevo email when keyed.
- **The "stack" is wired**: 12-factor config, structured logging, Prometheus
  metrics, feature flags, OWASP-aware security, health/readiness, graceful
  shutdown, Dockerfile, docker-compose (+ a TLS prod overlay), Grafana
  dashboard + Prometheus alerts + Alertmanager, Terraform IaC, k6 perf tests,
  OWASP ZAP pen test, and CI (now with a Postgres service) running all of it.
- **PWA shell exists** (`apps/web`): installable, offline-capable, no build step.
- **Genuinely blocked (need external accounts)**: live Scoutbook file spec (D4),
  Stripe keys (D3), Brevo key + per-household email routing (D5), Web Push VAPID
  (D6), native iOS/Android apps (D12). All tracked in `PONYTAIL-DEBT.md`.

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

## 5. What's still BLOCKED (needs external accounts) and why

See `PONYTAIL-DEBT.md` for the full ledger. After the D1/D2/D3/D5/D7/D9/D10
work, only externally-gated items remain:

1. **Scoutbook file column spec (D4)** — the serializer + "only approved/
   un-submitted" selection are built and tested; the exact pipe-delimited column
   order must be confirmed with BSA (PRD §14 OQ-1) before real submissions.
2. **Stripe account (D3)** — webhook verification + ledger credit + checkout are
   built; set `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` to go live.
3. **Brevo key + per-household routing (D5)** — pipeline runs and sends a digest;
   add `BREVO_API_KEY` and wire household emails for per-parent delivery.
4. **Web Push (D6)** — needs VAPID keys; iOS requires the PWA be installed.
5. **RS256/JWKS + MFA (D2)** — needs a live IdP; HS256 path is done.
6. **Native iOS/Android (D12)** — PWA covers phones meanwhile.

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
