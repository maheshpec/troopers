# Observability

The three pillars, all wired and runnable via the local compose stack.

## Metrics (Prometheus)
- Exposed at `GET /metrics` (`src/metrics.ts`), a dedicated registry (test-isolated).
- Custom series:
  - `http_requests_total{method,route,status}` — request counts.
  - `http_request_duration_seconds` (histogram, buckets to the 1.5s SLO) — latency.
  - `reminders_generated_total{type}` — reminders-engine output.
  - plus Node default metrics (memory, GC, event loop).
- Scraped by Prometheus (`infra/monitoring/prometheus/prometheus.yml`).

## Dashboards (Grafana)
- Auto-provisioned datasource + dashboard (`infra/monitoring/grafana/`).
- `troopers-api.json`: request rate by status, latency p50/p95/p99 vs SLO,
  5xx ratio, reminders generated, process memory.
- Local: http://localhost:3001 (admin/admin).

## Alerting (Prometheus rules → Alertmanager)
`infra/monitoring/prometheus/alerts.yml`:
| Alert | Condition | Severity |
|---|---|---|
| `ApiDown` | scrape target down >1m | critical |
| `ApiHighLatencyP95` | p95 > 1.5s for 10m (PRD NFR-3) | warning |
| `ApiHighErrorRate` | 5xx ratio > 5% for 5m | critical |
| `ApiRateLimitSpike` | sustained 429s (abuse signal) | warning |

Routed by `infra/monitoring/alertmanager/alertmanager.yml` (placeholder
receiver — wire email/Slack/PagerDuty per environment via env, not committed).

## Logs
Structured JSON to stdout (pino, `src/logger.ts`), 12-factor Factor XI.
Secrets/PII redacted (`authorization`, `*.token`, `*.password`, `*.medical`).
Ship to the platform's log aggregator in production.

## Health
`GET /healthz` (liveness), `GET /readyz` (readiness + flag snapshot). Used by
the Docker healthcheck and any orchestrator.
