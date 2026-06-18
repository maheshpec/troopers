# Ponytail Debt Ledger

Deliberately deferred shortcuts (YAGNI), each with its upgrade path. Per the
ponytail convention, nothing here cuts validation, error handling, security, or
accessibility — these are *implementation* deferrals, not corner-cutting.

> **Resolved:** D1 (Postgres persistence) — see `core/pgRepository.ts`; the
> factory is pg-backed when `DATABASE_URL` is set, in-memory otherwise. Verified
> by `test/integration/pg.test.ts` (runs in CI against a Postgres service).

| # | Shortcut (where) | Why deferred | Upgrade path | Priority |
|---|---|---|---|---|
| ~~D1~~ | ~~In-memory repositories~~ | **DONE** | Postgres repository factory wired (`core/pgRepository.ts`); in-memory remains the no-DB fallback | ✅ |
| D2 | ~~Static dev-token auth~~ → **JWT done**; RS256/JWKS + MFA remain | HS256 JWT verification built & tested (`src/auth.ts`, `jose`); RS256/JWKS rotation + MFA need a live IdP | Medium |
| D3 | ~~Payments stubbed~~ → **webhook + checkout built**; needs Stripe account | Signature-verified webhook credits the ledger (`domain/payments.ts`, Node-crypto HMAC, tested); checkout creates a PaymentIntent when `STRIPE_SECRET_KEY` set (else 501). Only live Stripe keys remain | Medium |
| D4 | Scoutbook export column spec (`domain/advancement.ts`) | Exact BSA spec must be confirmed | Validate pipe-delimited columns with BSA/Scoutbook (PRD §14 OQ-1) before real submissions | **High** |
| D5 | ~~Reminders on-request only~~ → **scheduled job done**; per-parent routing remains | Cron job built (`src/jobs/reminders.ts` + `.github/workflows/reminders.yml`) with a Log/Brevo channel; sends a digest. Only `BREVO_API_KEY` + per-household email routing remain | Medium |
| D6 | No Web Push handler (`apps/web/sw.js`) | Needs VAPID keys; iOS needs installed PWA | Add `push`/`notificationclick` handlers wired to the reminders engine (PRD §5.13) | Medium |
| ~~D7~~ | ~~Photo consent stubbed~~ | **DONE** | Gallery filter sources the member `photoConsent` flag; tagged-youth visibility enforced server-side (PRD §9) | ✅ |
| D8 | Simple-resource areas are CRUD-only (`domain/simpleResources.ts`) | Depth not yet needed | Add per-area logic as prioritized (e.g. equipment checkout overdue, role permission derivation) | Medium |
| D9 | ~~Messages not persisted~~ → **persistence done**; delivery remains | Threads persisted + admin audit view (`messages` table, migration 003). Fan-out via email/SMS/push still pending | Low |
| D10 | Terraform: local state, SSH open, no TLS automation (`infra/terraform`) | Skeleton IaC | Remote state (R2/S3); lock `ssh_allowed_cidrs`; add Caddy/Traefik TLS; don't expose Grafana | Medium |
| D11 | Alertmanager placeholder receiver (`infra/monitoring/alertmanager`) | No channel chosen | Wire email/Slack/PagerDuty via env secrets | Low |
| D12 | Native iOS/Android apps not started | PWA covers phones meanwhile | Cross-platform (React Native/Flutter) on the same API (PRD §10) | Low |
| D13 | ZAP job is non-blocking in CI (`fail_action: false`) | Skeleton stage | Flip to fail on new findings once the surface stabilizes | Low |

Add a row whenever you defer something; remove it when you pay it down.
