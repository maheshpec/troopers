// k6 load test: ramps to a realistic peak for a 150-family unit (e.g. everyone
// opening the app the night RSVPs are due). Run: k6 run tests/performance/k6-load.js
import http from "k6/http";
import { check } from "k6";

const BASE = __ENV.BASE_URL || "http://localhost:3000";
const TOKEN = __ENV.TOKEN || "dev-leader";
const auth = { headers: { Authorization: `Bearer ${TOKEN}` } };

export const options = {
  stages: [
    { duration: "1m", target: 50 }, // ramp up
    { duration: "3m", target: 50 }, // sustain peak
    { duration: "1m", target: 0 }, // ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<1500", "p(99)<3000"],
    http_req_failed: ["rate<0.01"],
  },
};

export default function () {
  // Read-heavy mix mirrors real usage (browsing roster/calendar/reminders).
  const responses = http.batch([
    ["GET", `${BASE}/api/members`, null, auth],
    ["GET", `${BASE}/api/events`, null, auth],
    ["GET", `${BASE}/api/members/registration/reminders`, null, auth],
  ]);
  responses.forEach((r) => check(r, { "2xx": (res) => res.status < 300 }));
}
