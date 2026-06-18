# Engineering Guide

## Stack
- **Runtime:** Node 22, TypeScript (ESM, strict).
- **API:** Fastify 5 (`apps/api`).
- **Validation:** zod at every trust boundary.
- **DB:** Postgres (schema in `db/migrations`); repositories are in-memory today
  behind a `Repository<T>` interface (drop-in upgrade).
- **PWA:** static, no build step (`apps/web`).

## 12-factor
| Factor | Here |
|---|---|
| III Config | All env, zod-validated, **fail-fast** at boot (`src/config.ts`). No secrets in code. |
| IV Backing services | DB/email/SMS are attached resources via URL/env. |
| VI Stateless processes | No in-process session state intended for prod (in-memory repos are the skeleton). |
| VII Port binding | Listens on `$PORT`. |
| IX Disposability | Fast boot; SIGTERM/SIGINT graceful shutdown (`src/server.ts`). |
| XI Logs | JSON event stream to stdout. |

## The resource framework (read this before adding a feature)
`src/core/resource.ts` is the spine. `registerResource(app, { name, schema,
readRoles, writeRoles })` gives any feature area validated, RBAC-guarded CRUD +
an in-memory repo. Add custom routes/logic on top (see `domain/members/routes.ts`
or `domain/advancement.ts`). This is why all 17 areas are consistent and none
re-implement validation/authz/error handling.

## Feature flags
`src/featureFlags.ts` — env-driven (`FLAG_<NAME>`), safe defaults, typed names.
Gate risky/incomplete features behind a flag; the interface is the upgrade seam
to a DB-backed or SaaS provider.

## Conventions (ponytail / YAGNI)
- Build the minimum the task needs; prefer stdlib / existing dep / one line.
- **Never** cut validation, error handling, security, or accessibility.
- Mark deferred shortcuts with `ponytail:` comments naming the upgrade path,
  and add a row to `PONYTAIL-DEBT.md`.
- Keep functions pure where logic is non-trivial (e.g. `reminders.ts`,
  `money.ts`) so it's unit-testable without I/O.

## Definition of done
typecheck clean · tests green · new trust-boundary code tested · security
controls intact · ponytail note + debt row for shortcuts · docs updated.
