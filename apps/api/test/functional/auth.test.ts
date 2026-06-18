import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { SignJWT } from "jose";
import { buildApp } from "../../src/app.js";
import { loadConfig } from "../../src/config.js";

/**
 * Real JWT auth (D2). HS256 matches Supabase's project JWT secret, so these
 * tokens are minted exactly as the IdP would.
 */
const SECRET = "test-secret-at-least-16-chars-long";
const ENV = {
  NODE_ENV: "test",
  AUTH_JWT_SECRET: SECRET,
  AUTH_JWT_ISSUER: "troopers-test",
  AUTH_ROLE_CLAIM: "role",
} as NodeJS.ProcessEnv;

const key = new TextEncoder().encode(SECRET);

async function token(
  role: string | undefined,
  opts: { expSeconds?: number; issuer?: string } = {},
) {
  let jwt = new SignJWT(role ? { role } : {})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("user-123")
    .setIssuedAt()
    .setIssuer(opts.issuer ?? "troopers-test")
    .setExpirationTime(`${opts.expSeconds ?? 3600}s`);
  return jwt.sign(key);
}

let app: FastifyInstance;
beforeAll(async () => {
  app = (await buildApp(loadConfig(ENV))).app;
  await app.ready();
});
afterAll(async () => app.close());

const get = (auth: string) =>
  app.inject({ method: "GET", url: "/api/members", headers: { authorization: `Bearer ${auth}` } });

describe("JWT authentication", () => {
  it("accepts a valid signed token and applies its role", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/members",
      headers: { authorization: `Bearer ${await token("leader")}` },
      payload: { firstName: "J", lastName: "W", kind: "adult", program: "troop" },
    });
    expect(res.statusCode).toBe(201);
  });

  it("enforces RBAC from the role claim (parent cannot create)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/members",
      headers: { authorization: `Bearer ${await token("parent")}` },
      payload: { firstName: "J", lastName: "W", kind: "adult", program: "troop" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("rejects a tampered signature", async () => {
    const t = await token("admin");
    const tampered = t.slice(0, -3) + "abc";
    expect((await get(tampered)).statusCode).toBe(401);
  });

  it("rejects an expired token", async () => {
    const expired = await new SignJWT({ role: "admin" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("troopers-test")
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(key);
    expect((await get(expired)).statusCode).toBe(401);
  });

  it("rejects a token with a wrong issuer", async () => {
    expect((await get(await token("admin", { issuer: "evil" }))).statusCode).toBe(401);
  });

  it("rejects a token with no/invalid role claim", async () => {
    expect((await get(await token(undefined))).statusCode).toBe(401);
    expect((await get(await token("superuser"))).statusCode).toBe(401);
  });

  it("still rejects a missing token", async () => {
    expect((await app.inject({ method: "GET", url: "/api/members" })).statusCode).toBe(401);
  });
});
