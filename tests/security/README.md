# Security testing

Two complementary layers, both run in CI:

| Layer | Where | What it catches |
|---|---|---|
| **In-process regression** | `apps/api/test/functional/security.test.ts` | OWASP A01 (authn/authz), A03 (injection/mass-assignment), A04/A07 (rate limiting), A05 (headers, no stack leaks). Fast, deterministic, runs on every commit. |
| **DAST / pen test** | `tests/security/zap-baseline.sh` | OWASP ZAP baseline spider + passive/active checks against a running instance (headers, CSP, cookie flags, info disclosure). |
| **Dependency audit** | `npm audit` in CI | OWASP A06 (vulnerable components). |

## Run locally
```bash
# 1. start the stack
docker compose -f infra/docker/docker-compose.yml up -d --build
# 2. pen test
TARGET=http://localhost:3000 ./tests/security/zap-baseline.sh
# 3. review zap-report/zap-report.html
```

See `docs/SECURITY.md` for the full OWASP Top 10 mapping and which control
lives where.
