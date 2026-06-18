import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/app.js";
import { loadConfig } from "../../src/config.js";

/**
 * Automated security regression tests — the in-process complement to the
 * external OWASP ZAP pen-test (tests/security/). These assert the OWASP Top 10
 * controls hold at the HTTP boundary.
 */
const ENV = {
  NODE_ENV: "test",
  API_AUTH_TOKENS: "admintok:admin",
  RATE_LIMIT_MAX: "5",
  RATE_LIMIT_WINDOW: "1 minute",
} as NodeJS.ProcessEnv;

const auth = { authorization: "Bearer admintok" };

let app: FastifyInstance;
beforeAll(async () => {
  app = (await buildApp(loadConfig(ENV))).app;
  await app.ready();
});
afterAll(async () => app.close());

describe("A01 Broken Access Control", () => {
  it("rejects missing token", async () => {
    expect((await app.inject({ method: "GET", url: "/api/members" })).statusCode).toBe(401);
  });
  it("rejects an invalid token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/members",
      headers: { authorization: "Bearer nope" },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("A03 Injection", () => {
  it("rejects unexpected/extra fields (strict schema)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/members",
      headers: auth,
      payload: {
        firstName: "A",
        lastName: "B",
        kind: "youth",
        program: "troop",
        isAdmin: true, // mass-assignment attempt
      },
    });
    expect(res.statusCode).toBe(400);
  });
  it("rejects a malformed BSA member id", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/advancement",
      headers: auth,
      payload: {
        bsaMemberId: "1; DROP TABLE members;--",
        memberName: "x",
        advancementType: "rank",
        advancement: "Scout",
        dateCompleted: "2026-01-01",
      },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("A04/A07 Rate limiting", () => {
  it("returns 429 after the configured budget", async () => {
    const codes: number[] = [];
    for (let i = 0; i < 8; i++) {
      const res = await app.inject({ method: "GET", url: "/healthz" });
      codes.push(res.statusCode);
    }
    expect(codes).toContain(429);
  });
});

describe("A05 Security Misconfiguration", () => {
  it("sets security headers via helmet", async () => {
    const res = await app.inject({ method: "GET", url: "/healthz" });
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBeDefined();
  });
  it("does not leak the framework via x-powered-by", async () => {
    const res = await app.inject({ method: "GET", url: "/healthz" });
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
  it("does not leak stack traces on error", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/members",
      headers: auth,
      payload: "not-json",
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(res.body).not.toContain("at Object.");
  });
});
