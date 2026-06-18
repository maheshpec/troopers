import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireRole } from "../auth.js";
import { registerResource, type Entity, type Repository } from "../core/resource.js";
import type { AppDeps } from "../app.js";

/** PRD §5.7 Money: Scout-account ledger. Amounts in integer cents (no floats). */
export const TransactionSchema = z
  .object({
    accountId: z.string().min(1).max(64),
    // Positive = credit (deposit/fundraiser); negative = debit (dues/fees).
    amountCents: z.number().int(),
    kind: z.enum(["dues", "event_fee", "deposit", "fundraiser", "refund", "adjustment"]),
    memo: z.string().max(280).optional(),
  })
  .strict();

export type Transaction = z.infer<typeof TransactionSchema> & Entity;

/** Balance is derived from the ledger — never stored, so it can't drift. */
export function balanceForAccount(
  txns: ReadonlyArray<Transaction>,
  accountId: string,
): number {
  return txns
    .filter((t) => t.accountId === accountId)
    .reduce((sum, t) => sum + t.amountCents, 0);
}

export function registerMoney(
  app: FastifyInstance,
  deps: AppDeps,
  repo: Repository<Transaction>,
) {
  registerResource(app, {
    name: "transactions",
    schema: TransactionSchema,
    // Share the app-level repo so the Stripe webhook credits the same ledger.
    repository: repo as Repository<Entity>,
    // Money is sensitive: only treasurer-class roles read/write here.
    readRoles: ["admin", "leader"],
    writeRoles: ["admin", "leader"],
  });

  app.get(
    "/api/accounts/:accountId/balance",
    { preHandler: requireRole("admin", "leader", "parent") },
    async (req) => {
      const { accountId } = req.params as { accountId: string };
      const txns = await repo.list();
      return { accountId, balanceCents: balanceForAccount(txns, accountId) };
    },
  );

  const CheckoutSchema = z
    .object({
      accountId: z.string().min(1).max(64),
      amountCents: z.number().int().positive().max(1_000_000),
      description: z.string().max(200).optional(),
    })
    .strict();

  // Creates a Stripe PaymentIntent (hosted elements complete it client-side;
  // the webhook later credits the ledger). No card data touches this service
  // (PRD §5.7, OWASP A02). Returns 501 until STRIPE_SECRET_KEY is configured.
  app.post(
    "/api/payments/checkout",
    { preHandler: requireRole("admin", "leader", "parent") },
    async (req, reply) => {
      const body = CheckoutSchema.parse(req.body);
      if (!deps.config.stripe.secretKey) {
        reply.code(501);
        return { error: "not_implemented", message: "STRIPE_SECRET_KEY not configured" };
      }
      // Stripe REST API (no SDK dependency). accountId travels in metadata so
      // the webhook can credit the right Scout account.
      const res = await fetch("https://api.stripe.com/v1/payment_intents", {
        method: "POST",
        headers: {
          authorization: `Bearer ${deps.config.stripe.secretKey}`,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          amount: String(body.amountCents),
          currency: "usd",
          "metadata[accountId]": body.accountId,
          ...(body.description ? { description: body.description } : {}),
        }),
      });
      if (!res.ok) {
        req.log.error({ status: res.status }, "stripe checkout failed");
        reply.code(502);
        return { error: "payment_provider_error", message: "Could not create payment" };
      }
      const intent = (await res.json()) as { client_secret?: string };
      return { clientSecret: intent.client_secret };
    },
  );

  return repo;
}
