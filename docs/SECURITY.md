# Security — OWASP Top 10 (2021) Mapping

How each risk is addressed, and where the control lives. Tested controls are
exercised by `apps/api/test/functional/security.test.ts` (in-process) and the
OWASP ZAP baseline (`tests/security/`, DAST). See `docs/TESTING.md`.

| # | Risk | Control | Where | Tested |
|---|---|---|---|---|
| **A01** | Broken Access Control | Bearer auth on all `/api/*`; position/role guards (`requireRole`); youth never see money/medical; reminders restricted to leaders | `src/auth.ts`, `core/resource.ts`, each `domain/*` | ✅ |
| **A02** | Cryptographic Failures | TLS terminated at the edge (Cloudflare/Caddy); no secrets in code (12-factor); no card data stored (Stripe hosted elements); logs redact tokens/medical | `src/config.ts`, `src/logger.ts`, infra | partial |
| **A03** | Injection | zod validation at every trust boundary; **`.strict()` schemas reject mass-assignment**; parameterized queries only (no string SQL); BSA id regex-constrained | `domain/*/*.ts`, `db/migrations` | ✅ |
| **A04** | Insecure Design | Rate limiting; YP-safe messaging invariant enforced server-side; body-size cap; balances derived not stored | `src/app.ts`, `domain/communication.ts` | ✅ |
| **A05** | Security Misconfiguration | `@fastify/helmet` security headers; `x-powered-by` off; central error handler returns safe bodies (no stack traces); non-root container; healthcheck | `src/app.ts`, `Dockerfile` | ✅ |
| **A06** | Vulnerable & Outdated Components | `npm audit --audit-level=high` in CI; lockfile committed; minimal deps (YAGNI) | `.github/workflows/ci.yml` | ✅ (CI) |
| **A07** | Identification & Auth Failures | Rate-limited; bearer required; **upgrade path → JWT + MFA for admin/treasurer** (ponytail) | `src/auth.ts` | ✅ (rate limit) |
| **A08** | Software & Data Integrity Failures | CI builds from source; pinned base image; `submittedToCouncilOn` guards duplicate advancement submission | CI, `domain/advancement.ts` | partial |
| **A09** | Security Logging & Monitoring Failures | Structured pino logs; Prometheus metrics; alert rules (down, error rate, latency, 429 spikes); Alertmanager | `src/logger.ts`, `src/metrics.ts`, `infra/monitoring` | — |
| **A10** | SSRF | No user-controlled outbound fetch; sync import is admin-uploaded data, not URL-fetched | `domain/sync.ts` | n/a |

## Youth-protection & COPPA (PRD §9 — invariants)
- **No 1-on-1 adult↔youth messaging.** Enforced in `domain/communication.ts`
  (`youthProtectionViolation`), returns `400 youth_protection`. Unit-tested.
- **Youth PII behind consent.** Photos tagging a non-consented youth are hidden
  (`domain/photos.ts`); medical docs restricted to admin/leader.
- **Nothing sensitive cached offline.** The PWA service worker skips
  `medical|document|payment` paths and never stores auth headers (`apps/web/sw.js`).

## Known gaps (tracked in PONYTAIL-DEBT.md)
Real JWT auth + MFA; TLS automation in IaC; Stripe webhook signature
verification; secrets manager; audit-log persistence; BSA-validated export spec.
