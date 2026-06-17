import type { FastifyInstance } from "fastify";
import { requireRole } from "../auth.js";
import type { Entity, Repository } from "../core/resource.js";
import type { Member } from "./members/member.js";
import { deriveRegistrationStatus } from "./members/reminders.js";
import { balanceForAccount, type Transaction } from "./money.js";

export interface ReportingDeps {
  members: Repository<Member & Entity>;
  transactions: Repository<Transaction>;
}

/**
 * PRD §5.11 Reporting & Dashboards. Read-only aggregations that power the
 * compliance dashboard and treasurer views. Cheap to compute at our scale;
 * cache later if a report gets heavy (ponytail).
 */
export function registerReporting(app: FastifyInstance, deps: ReportingDeps) {
  app.get(
    "/api/reports/dashboard",
    { preHandler: requireRole("admin", "leader") },
    async () => {
      const today = new Date().toISOString().slice(0, 10);
      const members = await deps.members.list();
      const registration = { registered: 0, expiring: 0, lapsed: 0, dropped: 0 };
      for (const m of members) {
        registration[deriveRegistrationStatus(m.registrationExpiresOn, today)]++;
      }

      const txns = await deps.transactions.list();
      const accountIds = [...new Set(txns.map((t) => t.accountId))];
      const negativeBalances = accountIds.filter(
        (id) => balanceForAccount(txns, id) < 0,
      ).length;

      return {
        asOf: today,
        membership: { total: members.length, registration },
        money: {
          accounts: accountIds.length,
          accountsInArrears: negativeBalances,
        },
      };
    },
  );
}
