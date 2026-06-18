# Troopers

A modern, mobile-first management app for a Scouts BSA troop and Cub Scout pack —
built to replace TroopTrack with a reliable experience, role-based
administration, configurable registration reminders, and a frictionless path to
sync advancement into Scouting America's official systems.

## Docs
- **[PRD.md](./PRD.md)** — product requirements (17 feature areas)
- **[HOSTING.md](./HOSTING.md)** — cost-optimized hosting ($0 default stack)
- **[HANDOFF.md](./HANDOFF.md)** — engineering handoff: what's real vs. stubbed, next steps
- **[CLAUDE.md](./CLAUDE.md)** — working agreements for any contributor
- **[docs/](./docs/)** — ENGINEERING, OBSERVABILITY, SECURITY (OWASP), TESTING
- **[PONYTAIL-DEBT.md](./PONYTAIL-DEBT.md)** — deferred-work ledger

## What's here
| Path | What |
|---|---|
| `apps/api/` | Fastify 5 + TypeScript API — all 17 feature areas, **75 tests** (incl. Postgres integration) |
| `apps/web/` | Installable, offline-capable PWA shell (no build step) |
| `db/migrations/` | Postgres schema |
| `infra/docker/` | docker-compose: API + Postgres + Prometheus + Grafana + Alertmanager |
| `infra/monitoring/` | Prometheus scrape + alerts, Grafana dashboard, Alertmanager |
| `infra/terraform/` | IaC for the self-hosted VM option |
| `tests/performance/` | k6 smoke + load | 
| `tests/security/` | OWASP ZAP baseline (pen test) |
| `.github/workflows/` | CI: typecheck, tests+coverage, audit, build, k6, ZAP |

## Quick start
```bash
cd apps/api && npm ci
npm run typecheck && npm test           # 44 passing
API_AUTH_TOKENS="t:admin" npm run dev    # http://localhost:3000

# full local stack (API + DB + observability):
docker compose -f infra/docker/docker-compose.yml up --build
# PWA: serve apps/web/ statically and point it at the API.
```

## At a glance
- **Programs:** Scouts BSA (Troop) + Cub Scouts (Pack)
- **Platforms:** Installable PWA (now) + native iOS/Android (planned)
- **Deployment:** Single-unit, ~$0/mo on free tiers (see HOSTING.md)
- **Engineering:** 12-factor, feature flags, Prometheus/Grafana/Alertmanager,
  IaC, OWASP-aware security, multi-layer tests — built YAGNI-first (ponytail).
