import type { FastifyInstance } from "fastify";
import { requireRole } from "../../auth.js";
import { forbidden } from "../../errors.js";
import { registerResource, type Entity, type Repository } from "../../core/resource.js";
import { CreateMemberSchema, type Member } from "./member.js";
import {
  computeRegistrationReminders,
  deriveRegistrationStatus,
} from "./reminders.js";
import type { AppDeps } from "../../app.js";

const todayIso = () => new Date().toISOString().slice(0, 10);

export function registerMembers(
  app: FastifyInstance,
  deps: AppDeps,
): Repository<Member & Entity> {
  const repo = registerResource(app, {
    name: "members",
    schema: CreateMemberSchema,
    // Parents/scouts can read the roster; only admin/leader mutate it.
    readRoles: ["admin", "leader", "parent", "scout"],
    writeRoles: ["admin", "leader"],
  }) as Repository<Member & Entity>;

  /**
   * Registration-renewal reminders. Feature-flagged (PRD §5.13/§5.14) and
   * restricted to roles that manage membership — never exposed to youth, per
   * youth-protection (parents/leaders only).
   */
  app.get(
    "/api/members/registration/reminders",
    { preHandler: requireRole("admin", "leader") },
    async (req) => {
      if (!deps.flags.isEnabled("registration_reminders")) {
        throw forbidden("Feature disabled");
      }
      const members = (await repo.list()) as Member[];
      const today = todayIso();
      const reminders = computeRegistrationReminders(
        members,
        today,
        deps.config.reminders.registrationLeadDays,
      );
      deps.metrics.remindersGenerated.inc(
        { type: "registration_renewal" },
        reminders.length,
      );
      req.log.info(
        { count: reminders.length },
        "generated registration reminders",
      );
      return {
        generatedAt: new Date().toISOString(),
        leadDays: deps.config.reminders.registrationLeadDays,
        data: reminders,
      };
    },
  );

  /** Compliance status snapshot for the dashboard (PRD §5.11 FR-RP-2). */
  app.get(
    "/api/members/registration/status",
    { preHandler: requireRole("admin", "leader") },
    async () => {
      const members = (await repo.list()) as Member[];
      const today = todayIso();
      const counts = { registered: 0, expiring: 0, lapsed: 0, dropped: 0 };
      for (const m of members) {
        counts[deriveRegistrationStatus(m.registrationExpiresOn, today)]++;
      }
      return { asOf: today, counts };
    },
  );

  return repo;
}
