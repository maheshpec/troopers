import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireRole } from "../auth.js";
import { registerResource, type Entity, type Repository } from "../core/resource.js";

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

export function registerMoney(app: FastifyInstance) {
  const repo = registerResource(app, {
    name: "transactions",
    schema: TransactionSchema,
    // Money is sensitive: only treasurer-class roles read/write here.
    readRoles: ["admin", "leader"],
    writeRoles: ["admin", "leader"],
  }) as Repository<Transaction>;

  app.get(
    "/api/accounts/:accountId/balance",
    { preHandler: requireRole("admin", "leader", "parent") },
    async (req) => {
      const { accountId } = req.params as { accountId: string };
      const txns = await repo.list();
      return { accountId, balanceCents: balanceForAccount(txns, accountId) };
    },
  );

  // ponytail: online payments are stubbed. Upgrade path -> Stripe PaymentIntent
  // (hosted elements, webhook -> create a credit transaction). No card data
  // ever touches this service (PRD §5.7 constraint, OWASP A02).
  app.post(
    "/api/payments/checkout",
    { preHandler: requireRole("admin", "leader", "parent") },
    async (_req, reply) => {
      reply.code(501);
      return {
        error: "not_implemented",
        message:
          "Stripe checkout pending credentials. See PONYTAIL-DEBT.md (payments).",
      };
    },
  );

  return repo;
}
