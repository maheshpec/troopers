// k6 smoke test: a tiny load to prove the service is up and meets latency
// thresholds. Run: k6 run tests/performance/k6-smoke.js
// Env: BASE_URL (default http://localhost:3000), TOKEN (a leader/admin token).
import http from "k6/http";
import { check, sleep } from "k6";

const BASE = __ENV.BASE_URL || "http://localhost:3000";
const TOKEN = __ENV.TOKEN || "dev-leader";

export const options = {
  vus: 5,
  duration: "30s",
  thresholds: {
    // PRD NFR-3: p95 < 1.5s. Fail the CI job if we regress.
    http_req_duration: ["p(95)<1500"],
    http_req_failed: ["rate<0.01"],
  },
};

export default function () {
  check(http.get(`${BASE}/healthz`), { "health 200": (r) => r.status === 200 });

  const auth = { headers: { Authorization: `Bearer ${TOKEN}` } };
  check(http.get(`${BASE}/api/members`, auth), {
    "members 200": (r) => r.status === 200,
  });
  sleep(1);
}
