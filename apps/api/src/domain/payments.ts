import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { AppConfig } from "../config.js";
import type { Entity, Repository } from "../core/resource.js";
import type { Transaction } from "./money.js";

/**
 * Stripe webhook handling (D3). The card flow itself needs a Stripe account
 * (handoff), but the security-critical part — verifying the webhook signature
 * and crediting the Scout account ledger — is implemented here with Node crypto
 * (Stripe's exact HMAC-SHA256 scheme) and is fully tested without the SDK.
 *
 * Never stores card data; the ledger only ever sees a settled amount + account.
 */
export interface StripeVerifyResult {
  ok: boolean;
  reason?: string;
}

/**
 * Verify a Stripe `Stripe-Signature` header against the raw body.
 * Header format: `t=<unix>,v1=<hex hmac>[,v1=...]`. Signed payload is
 * `${t}.${rawBody}`, HMAC-SHA256 with the endpoint signing secret.
 */
export function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string,
  toleranceSeconds = 300,
  nowSeconds = Math.floor(Date.now() / 1000),
): StripeVerifyResult {
  if (!signatureHeader) return { ok: false, reason: "missing signature" };
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((kv) => {
      const i = kv.indexOf("=");
      return [kv.slice(0, i), kv.slice(i + 1)];
    }),
  );
  const t = Number(parts.t);
  const v1 = parts.v1;
  if (!Number.isFinite(t) || !v1) return { ok: false, reason: "malformed header" };
  if (Math.abs(nowSeconds - t) > toleranceSeconds) {
    return { ok: false, reason: "timestamp outside tolerance" };
  }
  const expected = createHmac("sha256", secret)
    .update(`${t}.${rawBody}`, "utf8")
    .digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "signature mismatch" };
  }
  return { ok: true };
}

/** Map a verified Stripe event to a ledger credit, if applicable. */
export function creditFromEvent(
  event: unknown,
): { accountId: string; amountCents: number; memo: string } | null {
  const e = event as {
    type?: string;
    data?: { object?: { amount_received?: number; amount?: number; metadata?: Record<string, string> } };
  };
  if (e.type !== "payment_intent.succeeded" && e.type !== "checkout.session.completed") {
    return null;
  }
  const obj = e.data?.object;
  const accountId = obj?.metadata?.accountId;
  const amountCents = obj?.amount_received ?? obj?.amount;
  if (!accountId || typeof amountCents !== "number" || amountCents <= 0) return null;
  return { accountId, amountCents, memo: `Stripe ${e.type}` };
}

/**
 * Registers the webhook at the app (unauthenticated — Stripe authenticates via
 * signature) with a raw-body parser scoped to this plugin so the signature can
 * be verified over exact bytes.
 */
export function registerStripeWebhook(
  app: FastifyInstance,
  config: AppConfig,
  transactions: Repository<Transaction & Entity>,
) {
  app.register(async (scope) => {
    // Capture the raw body as a Buffer for this route only (encapsulated).
    scope.addContentTypeParser(
      "application/json",
      { parseAs: "buffer" },
      (_req, body, done) => done(null, body),
    );

    scope.post("/api/payments/webhook", async (req, reply) => {
      if (!config.stripe.webhookSecret) {
        reply.code(501);
        return { error: "not_implemented", message: "Stripe webhook secret not configured" };
      }
      const raw = (req.body as Buffer).toString("utf8");
      const sig = req.headers["stripe-signature"] as string | undefined;
      const verified = verifyStripeSignature(raw, sig, config.stripe.webhookSecret);
      if (!verified.ok) {
        reply.code(400);
        return { error: "invalid_signature", message: verified.reason };
      }
      const credit = creditFromEvent(JSON.parse(raw));
      if (credit) {
        await transactions.create({
          accountId: credit.accountId,
          amountCents: credit.amountCents,
          kind: "deposit",
          memo: credit.memo,
        });
        req.log.info({ accountId: credit.accountId }, "stripe payment credited to ledger");
      }
      return { received: true };
    });
  });
}
