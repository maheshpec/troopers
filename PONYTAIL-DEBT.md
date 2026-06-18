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
| D2 | Static dev-token auth (`src/auth.ts`) | Real IdP needs accounts | Verify JWT (Supabase Auth / Better Auth) via `jose`; load positions → permission scopes; add MFA for admin/treasurer | **High** |
| D3 | Payments return 501 (`domain/money.ts`) | No Stripe credentials | Stripe PaymentIntent + signed webhook → credit a `transaction`; never store card data | **High** |
| D4 | Scoutbook export column spec (`domain/advancement.ts`) | Exact BSA spec must be confirmed | Validate pipe-delimited columns with BSA/Scoutbook (PRD §14 OQ-1) before real submissions | **High** |
| D5 | Reminders run on-request only (`domain/members/routes.ts`) | Scheduler not wired | Run `computeRegistrationReminders` on a cron (GitHub Actions / scheduler) → deliver via Brevo email first, then push/SMS | **High** |
| D6 | No Web Push handler (`apps/web/sw.js`) | Needs VAPID keys; iOS needs installed PWA | Add `push`/`notificationclick` handlers wired to the reminders engine (PRD §5.13) | Medium |
| D7 | Photo consent source stubbed permissive (`app.ts` → `registerPhotos`) | Consent records not modeled yet | Back with guardians' photo-consent flags (PRD §9, COPPA) | Medium |
| D8 | Simple-resource areas are CRUD-only (`domain/simpleResources.ts`) | Depth not yet needed | Add per-area logic as prioritized (e.g. equipment checkout overdue, role permission derivation) | Medium |
| D9 | Messages not persisted/delivered (`domain/communication.ts`) | Storage/providers pending | Persist threads (retained/auditable per §9) + fan out via email/SMS/push | Medium |
| D10 | Terraform: local state, SSH open, no TLS automation (`infra/terraform`) | Skeleton IaC | Remote state (R2/S3); lock `ssh_allowed_cidrs`; add Caddy/Traefik TLS; don't expose Grafana | Medium |
| D11 | Alertmanager placeholder receiver (`infra/monitoring/alertmanager`) | No channel chosen | Wire email/Slack/PagerDuty via env secrets | Low |
| D12 | Native iOS/Android apps not started | PWA covers phones meanwhile | Cross-platform (React Native/Flutter) on the same API (PRD §10) | Low |
| D13 | ZAP job is non-blocking in CI (`fail_action: false`) | Skeleton stage | Flip to fail on new findings once the surface stabilizes | Low |

Add a row whenever you defer something; remove it when you pay it down.
