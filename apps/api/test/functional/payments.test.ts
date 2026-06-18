import { createHmac } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/app.js";
import { loadConfig } from "../../src/config.js";
import {
  verifyStripeSignature,
  creditFromEvent,
} from "../../src/domain/payments.js";

const SECRET = "whsec_test_secret";

/** Build a valid Stripe-Signature header for a raw payload. */
function sign(raw: string, secret = SECRET, t = Math.floor(Date.now() / 1000)) {
  const v1 = createHmac("sha256", secret).update(`${t}.${raw}`).digest("hex");
  return `t=${t},v1=${v1}`;
}

describe("verifyStripeSignature (unit)", () => {
  const raw = JSON.stringify({ id: "evt_1" });
  it("accepts a correctly signed payload", () => {
    expect(verifyStripeSignature(raw, sign(raw), SECRET).ok).toBe(true);
  });
  it("rejects a bad signature", () => {
    expect(verifyStripeSignature(raw, "t=1,v1=deadbeef", SECRET).ok).toBe(false);
  });
  it("rejects a stale timestamp", () => {
    const old = Math.floor(Date.now() / 1000) - 10_000;
    expect(verifyStripeSignature(raw, sign(raw, SECRET, old), SECRET).ok).toBe(false);
  });
  it("rejects a missing header", () => {
    expect(verifyStripeSignature(raw, undefined, SECRET).ok).toBe(false);
  });
});

describe("creditFromEvent (unit)", () => {
  it("maps a succeeded intent to a ledger credit", () => {
    const credit = creditFromEvent({
      type: "payment_intent.succeeded",
      data: { object: { amount_received: 2500, metadata: { accountId: "acct-1" } } },
    });
    expect(credit).toEqual({ accountId: "acct-1", amountCents: 2500, memo: expect.any(String) });
  });
  it("ignores unrelated events", () => {
    expect(creditFromEvent({ type: "customer.created", data: { object: {} } })).toBeNull();
  });
  it("ignores events without an accountId", () => {
    expect(
      creditFromEvent({ type: "payment_intent.succeeded", data: { object: { amount: 100 } } }),
    ).toBeNull();
  });
});

describe("Stripe webhook (functional)", () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = (
      await buildApp(
        loadConfig({
          NODE_ENV: "test",
          API_AUTH_TOKENS: "admintok:admin",
          STRIPE_WEBHOOK_SECRET: SECRET,
        } as NodeJS.ProcessEnv),
      )
    ).app;
    await app.ready();
  });
  afterAll(async () => app.close());

  it("credits the ledger on a verified payment", async () => {
    const raw = JSON.stringify({
      type: "payment_intent.succeeded",
      data: { object: { amount_received: 5000, metadata: { accountId: "scout-42" } } },
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/payments/webhook",
      headers: { "content-type": "application/json", "stripe-signature": sign(raw) },
      payload: raw,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().received).toBe(true);

    // The credit shows up in the shared ledger balance.
    const bal = await app.inject({
      method: "GET",
      url: "/api/accounts/scout-42/balance",
      headers: { authorization: "Bearer admintok" },
    });
    expect(bal.json().balanceCents).toBe(5000);
  });

  it("rejects a forged signature", async () => {
    const raw = JSON.stringify({ type: "payment_intent.succeeded", data: { object: {} } });
    const res = await app.inject({
      method: "POST",
      url: "/api/payments/webhook",
      headers: { "content-type": "application/json", "stripe-signature": "t=1,v1=forged" },
      payload: raw,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("invalid_signature");
  });
});
