# Testing Strategy

Five layers; the first three run on every commit, all five in CI.

| Layer | Tool | Location | What |
|---|---|---|---|
| **Unit** | vitest | `apps/api/test/unit` | Pure logic: reminders, balances, Scoutbook serializer, YP rule, reconcile, photo consent, config, flags. |
| **Functional** | vitest + `app.inject` | `apps/api/test/functional/api.test.ts` | Real HTTP through the full app: CRUD, RBAC, reminders, export, RSVP, settings, YP guard. |
| **Security regression** | vitest | `apps/api/test/functional/security.test.ts` | OWASP A01/A03/A04/A05/A07 controls at the boundary. |
| **Performance** | k6 | `tests/performance` | Smoke (p95<1.5s gate) + ramped load for a 150-family peak. |
| **DAST / pen test** | OWASP ZAP baseline | `tests/security` | Spider + passive/active checks against a running instance. |

Plus `npm audit` (A06) in CI.

## Run
```bash
cd apps/api
npm test                 # unit + functional + security  (44 tests)
npm run test:coverage    # enforces thresholds (lines/funcs 70, branches 65)

# perf + pen test need a running instance:
k6 run ../../tests/performance/k6-smoke.js
TARGET=http://localhost:3000 ../../tests/security/zap-baseline.sh
```

## Current status
**44 tests passing**, ~88% statement coverage, typecheck clean.

## Conventions
- Every new trust-boundary path (route, validator, auth rule) gets a test.
- Keep non-trivial logic pure so it's unit-testable without standing up I/O.
- Security tests are not optional — they encode invariants (RBAC, injection
  rejection, no stack leaks, rate limiting) that must never silently regress.
