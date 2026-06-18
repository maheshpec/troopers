# CLAUDE.md — Troopers

Guidance for any Claude instance working in this repo (including outside the
original sandbox). Read this first, then `HANDOFF.md` for full state.

## What this is
A management app for a **single Scouts BSA troop + Cub Scout pack** (replacing
TroopTrack). Planning docs: `PRD.md` (product), `HOSTING.md` (cost-optimized
infra). Code: a working **backend API** (`apps/api`) and an **installable PWA
shell** (`apps/web`).

## Repo map
| Path | What |
|---|---|
| `PRD.md` | Product requirements — 17 feature areas |
| `HOSTING.md` | Hosting plan ($0 default: Supabase + Cloudflare; VPS alt) |
| `apps/api/` | Fastify 5 + TypeScript API (the backend) |
| `apps/web/` | Static installable PWA shell (no build step) |
| `db/migrations/` | Postgres schema (the upgrade target for in-memory repos) |
| `infra/docker/` | docker-compose: API + Postgres + Prometheus + Grafana + Alertmanager |
| `infra/monitoring/` | Prometheus scrape + alert rules, Grafana dashboard, Alertmanager |
| `infra/terraform/` | IaC for the self-hosted VM option (Hetzner) |
| `tests/performance/` | k6 smoke + load |
| `tests/security/` | OWASP ZAP baseline (DAST/pen test) |
| `.github/workflows/ci.yml` | CI: typecheck, tests+coverage, audit, build, k6, ZAP |
| `docs/` | ENGINEERING, OBSERVABILITY, SECURITY (OWASP), TESTING |
| `PONYTAIL-DEBT.md` | Ledger of deliberately-deferred work |

## Working agreements
- **Follow YAGNI (ponytail).** Before adding code: does it need to exist? Is
  there a stdlib/existing-dep/one-line solution? Build the minimum — but
  **never cut validation, error handling, security, or accessibility.**
- Mark deferred shortcuts with a `ponytail:` comment naming the upgrade path,
  and add a row to `PONYTAIL-DEBT.md`.
- **Every feature area** goes through the shared resource framework
  (`apps/api/src/core/resource.ts`) so it inherits validation + RBAC + error
  handling for free.
- **12-factor:** all config via env (`apps/api/src/config.ts`, zod-validated,
  fail-fast). No secrets in code.
- **Youth-protection & COPPA are invariants, not features** (PRD §9). Don't
  add a code path that allows 1-on-1 adult↔youth messaging or exposes youth
  PII without consent.

## Commands (run from `apps/api`)
```bash
npm ci
npm run typecheck      # tsc --noEmit
npm test               # vitest: unit + functional + security + pg integration (75 tests)
npm run test:coverage  # enforces coverage thresholds
npm run dev            # tsx watch (local)
```
Full stack locally: `docker compose -f infra/docker/docker-compose.yml up --build`
(API :3000, Grafana :3001, Prometheus :9090, Alertmanager :9093).
PWA: serve `apps/web/` statically (e.g. Cloudflare Pages) — no build needed.

## Definition of done for a change
1. `npm run typecheck` clean. 2. `npm test` green. 3. New trust-boundary code
has tests. 4. Security controls intact (run security.test.ts). 5. `ponytail:`
+ debt-ledger row for any shortcut. 6. Docs updated if behavior changed.
