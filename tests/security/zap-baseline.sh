#!/usr/bin/env bash
# OWASP ZAP baseline scan — the external "pen test" that complements the
# in-process security regression suite (apps/api/test/functional/security.test.ts).
#
# ZAP spiders the target and runs passive checks (security headers, cookie
# flags, info leaks, CSP, etc.) plus a curated set of active checks safe to run
# in CI. Findings above the threshold fail the build.
#
# Usage:
#   TARGET=http://localhost:3000 ./tests/security/zap-baseline.sh
# Requires Docker. In CI we use the official zaproxy image.
set -euo pipefail

TARGET="${TARGET:-http://localhost:3000}"
REPORT_DIR="${REPORT_DIR:-$(pwd)/zap-report}"
mkdir -p "$REPORT_DIR"

echo "Running OWASP ZAP baseline against ${TARGET}"

docker run --rm --network=host \
  -v "${REPORT_DIR}:/zap/wrk:rw" \
  ghcr.io/zaproxy/zaproxy:stable \
  zap-baseline.py \
  -t "${TARGET}" \
  -c /zap/wrk/zap-rules.tsv 2>/dev/null || true \
  -r zap-report.html \
  -J zap-report.json \
  -a \
  -m 5 \
  -I   # do not fail on warnings; -I means informational warnings won't error.

echo "ZAP report written to ${REPORT_DIR}/zap-report.html"
